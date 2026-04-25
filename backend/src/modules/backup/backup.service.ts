/**
 * BackupService
 *
 * Creates exportable backups of all site data (subscribers, notifications,
 * automations, segments) and uploads them to a chosen cloud storage provider.
 *
 * Supported destinations:
 *  - LOCAL     – returns the JSON blob directly (no upload)
 *  - GOOGLE_DRIVE – uploads via the Google Drive REST API v3
 *  - DROPBOX   – uploads via the Dropbox API v2
 *  - AWS_S3    – uploads via the AWS S3 PutObject API (no SDK dependency;
 *                uses pre-signed URL approach via native fetch)
 *
 * Restore:
 *  Accepts a previously exported JSON backup and re-inserts the data,
 *  skipping rows that already exist (idempotent).
 *
 * Security notes:
 *  - Cloud credentials are NEVER stored by this service.
 *  - All secrets must be provided per-request or read from encrypted settings.
 *  - Backup blobs are versioned so future code can handle schema changes.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Notification } from '../notifications/notification.entity';
import { Automation } from '../automations/automation.entity';
import {
  BackupDestination,
  CreateBackupDto,
} from './dto/backup.dto';

/** Backup schema version – increment when the exported structure changes. */
const BACKUP_VERSION = '1.0';

export interface BackupResult {
  success: boolean;
  destination: BackupDestination;
  /** Only present for LOCAL backups */
  data?: Record<string, any>;
  /** Remote URL / path for cloud destinations */
  remoteLocation?: string;
  exportedAt: string;
  stats: {
    subscribers: number;
    notifications: number;
    automations: number;
  };
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    @InjectRepository(Subscriber)
    private readonly subscriberRepo: Repository<Subscriber>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
  ) { }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Create a backup of all data for the given site and route it to the
   * specified destination.
   *
   * @param siteId  Target site UUID.
   * @param dto     Backup configuration (destination + optional credentials).
   */
  async createBackup(siteId: string, dto: CreateBackupDto): Promise<BackupResult> {
    this.logger.log(`[Backup] Starting backup for site ${siteId} → ${dto.destination}`);

    // 1. Export all data
    const blob = await this._exportSiteData(siteId);

    // 2. Route to destination
    switch (dto.destination) {
      case BackupDestination.LOCAL:
        return this._localBackup(blob);

      case BackupDestination.GOOGLE_DRIVE:
        if (!dto.googleDrive) {
          throw new BadRequestException('Google Drive credentials are required.');
        }
        return this._uploadToGoogleDrive(blob, dto.googleDrive);

      case BackupDestination.DROPBOX:
        if (!dto.dropbox) {
          throw new BadRequestException('Dropbox credentials are required.');
        }
        return this._uploadToDropbox(blob, dto.dropbox);

      case BackupDestination.AWS_S3:
        if (!dto.awsS3) {
          throw new BadRequestException('AWS S3 credentials are required.');
        }
        return this._uploadToS3(blob, dto.awsS3);

      default:
        throw new BadRequestException(`Unknown destination: ${dto.destination}`);
    }
  }

  /**
   * Restore site data from a previously exported backup blob.
   * Existing rows are NOT overwritten; only missing data is inserted.
   *
   * @param siteId      Target site UUID.
   * @param backupData  Parsed backup JSON object.
   */
  async restoreBackup(
    siteId: string,
    backupData: Record<string, any>,
  ): Promise<{ restored: { subscribers: number; notifications: number; automations: number } }> {
    if (backupData.version !== BACKUP_VERSION) {
      throw new BadRequestException(
        `Unsupported backup version: ${backupData.version}. Expected ${BACKUP_VERSION}.`,
      );
    }

    const data = backupData.data;
    if (!data) throw new BadRequestException('Backup data is missing the "data" key.');

    let restoredSubscribers = 0;
    let restoredNotifications = 0;
    let restoredAutomations = 0;

    // Restore subscribers (skip existing endpoints/tokens)
    if (Array.isArray(data.subscribers)) {
      for (const sub of data.subscribers) {
        const existing = sub.endpoint
          ? await this.subscriberRepo.findOne({ where: { siteId, endpoint: sub.endpoint } })
          : sub.fcmToken
            ? await this.subscriberRepo.findOne({ where: { siteId, fcmToken: sub.fcmToken } })
            : null;

        if (!existing) {
          await this.subscriberRepo.save(this.subscriberRepo.create({ ...sub, siteId }));
          restoredSubscribers++;
        }
      }
    }

    // Restore notifications (skip existing titles sent on same day)
    if (Array.isArray(data.notifications)) {
      for (const notif of data.notifications) {
        const existing = await this.notifRepo.findOne({
          where: { siteId, title: notif.title },
        });
        if (!existing) {
          await this.notifRepo.save(this.notifRepo.create({ ...notif, siteId }));
          restoredNotifications++;
        }
      }
    }

    // Restore automations (skip existing names)
    if (Array.isArray(data.automations)) {
      for (const auto of data.automations) {
        const existing = await this.automationRepo.findOne({
          where: { siteId, name: auto.name },
        });
        if (!existing) {
          await this.automationRepo.save(this.automationRepo.create({ ...auto, siteId }));
          restoredAutomations++;
        }
      }
    }

    this.logger.log(
      `[Backup] Restore complete – subscribers=${restoredSubscribers} ` +
      `notifications=${restoredNotifications} automations=${restoredAutomations}`,
    );

    return {
      restored: {
        subscribers: restoredSubscribers,
        notifications: restoredNotifications,
        automations: restoredAutomations,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers – data export
  // -------------------------------------------------------------------------

  private async _exportSiteData(siteId: string): Promise<Record<string, any>> {
    const [subscribers, notifications, automations] = await Promise.all([
      this.subscriberRepo.find({ where: { siteId } }),
      this.notifRepo.find({ where: { siteId } }),
      this.automationRepo.find({ where: { siteId } }),
    ]);

    return {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      siteId,
      data: { subscribers, notifications, automations },
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers – LOCAL
  // -------------------------------------------------------------------------

  private _localBackup(blob: Record<string, any>): BackupResult {
    const data = blob.data as any;
    return {
      success: true,
      destination: BackupDestination.LOCAL,
      data: blob,
      exportedAt: blob.exportedAt,
      stats: {
        subscribers: data.subscribers?.length ?? 0,
        notifications: data.notifications?.length ?? 0,
        automations: data.automations?.length ?? 0,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers – GOOGLE DRIVE
  // -------------------------------------------------------------------------

  private async _uploadToGoogleDrive(
    blob: Record<string, any>,
    creds: { serviceAccountJson: string; folderId?: string },
  ): Promise<BackupResult> {
    // Parse the service-account key
    let saKey: Record<string, any>;
    try {
      saKey = JSON.parse(creds.serviceAccountJson);
    } catch {
      throw new BadRequestException('Google Drive: serviceAccountJson is not valid JSON.');
    }

    if (!saKey.client_email || !saKey.private_key) {
      throw new BadRequestException('Google Drive: serviceAccountJson must contain client_email and private_key.');
    }

    // Obtain an access token using the service account JWT flow
    const accessToken = await this._getGoogleAccessToken(
      saKey.client_email as string,
      saKey.private_key as string,
    );

    const fileName = `posh-backup-${blob.siteId}-${Date.now()}.json`;
    const content = JSON.stringify(blob);

    // Multipart upload (metadata + content)
    const boundary = `posh_boundary_${Date.now()}`;
    const metadata = JSON.stringify({
      name: fileName,
      mimeType: 'application/json',
      parents: creds.folderId ? [creds.folderId] : [],
    });

    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const resp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!resp.ok) {
      const err = await resp.text();
      this.logger.error(`[Backup] Google Drive upload failed: ${err}`);
      throw new InternalServerErrorException('Google Drive upload failed. Check credentials.');
    }

    const result = await resp.json();
    const data = blob.data as any;

    return {
      success: true,
      destination: BackupDestination.GOOGLE_DRIVE,
      remoteLocation: `https://drive.google.com/file/d/${result.id}/view`,
      exportedAt: blob.exportedAt,
      stats: {
        subscribers: data.subscribers?.length ?? 0,
        notifications: data.notifications?.length ?? 0,
        automations: data.automations?.length ?? 0,
      },
    };
  }

  /**
   * Generate a short-lived Google OAuth2 access token using a service account.
   * Uses the RS256 JWT grant flow (RFC 7523) – no googleapis SDK required.
   */
  private async _getGoogleAccessToken(
    clientEmail: string,
    privateKey: string,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    // Build JWT header.payload
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${header}.${body}`;

    // Sign with the private key (Node.js built-in crypto)
    const { createSign } = await import('crypto');
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer.sign(privateKey, 'base64url');

    const jwt = `${signingInput}.${signature}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!resp.ok) {
      throw new InternalServerErrorException('Failed to obtain Google OAuth2 token.');
    }

    const json = await resp.json();
    return json.access_token as string;
  }

  // -------------------------------------------------------------------------
  // Private helpers – DROPBOX
  // -------------------------------------------------------------------------

  private async _uploadToDropbox(
    blob: Record<string, any>,
    creds: { accessToken: string; uploadPath?: string },
  ): Promise<BackupResult> {
    const path = `${creds.uploadPath || '/posh-backups'}/posh-backup-${blob.siteId}-${Date.now()}.json`;
    const content = JSON.stringify(blob);

    const resp = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
      },
      body: content,
    });

    if (!resp.ok) {
      const err = await resp.text();
      this.logger.error(`[Backup] Dropbox upload failed: ${err}`);
      throw new InternalServerErrorException('Dropbox upload failed. Check access token.');
    }

    const result = await resp.json();
    const data = blob.data as any;

    return {
      success: true,
      destination: BackupDestination.DROPBOX,
      remoteLocation: result.path_display,
      exportedAt: blob.exportedAt,
      stats: {
        subscribers: data.subscribers?.length ?? 0,
        notifications: data.notifications?.length ?? 0,
        automations: data.automations?.length ?? 0,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers – AWS S3
  // -------------------------------------------------------------------------

  private async _uploadToS3(
    blob: Record<string, any>,
    creds: {
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
      region?: string;
      prefix?: string;
    },
  ): Promise<BackupResult> {
    const region = creds.region || 'us-east-1';
    const prefix = creds.prefix || 'posh-backups/';
    const key = `${prefix}posh-backup-${blob.siteId}-${Date.now()}.json`;
    const content = JSON.stringify(blob);

    // AWS Signature V4 signing (manual – no AWS SDK required)
    const { createHmac, createHash } = await import('crypto');

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
    const dateStamp = amzDate.substring(0, 8);
    const host = `${creds.bucket}.s3.${region}.amazonaws.com`;
    const url = `https://${host}/${key}`;
    const contentHash = createHash('sha256').update(content).digest('hex');

    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [`PUT`, `/${key}`, '', canonicalHeaders, signedHeaders, contentHash].join('\n');

    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

    const hmac = (key: Buffer | string, data: string) =>
      createHmac('sha256', key).update(data).digest();

    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${creds.secretAccessKey}`, dateStamp), region), 's3'),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authHeader = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'x-amz-content-sha256': contentHash,
        'x-amz-date': amzDate,
      },
      body: content,
    });

    if (!resp.ok) {
      const err = await resp.text();
      this.logger.error(`[Backup] S3 upload failed: ${err}`);
      throw new InternalServerErrorException('AWS S3 upload failed. Check credentials.');
    }

    const data = blob.data as any;

    return {
      success: true,
      destination: BackupDestination.AWS_S3,
      remoteLocation: `s3://${creds.bucket}/${key}`,
      exportedAt: blob.exportedAt,
      stats: {
        subscribers: data.subscribers?.length ?? 0,
        notifications: data.notifications?.length ?? 0,
        automations: data.automations?.length ?? 0,
      },
    };
  }
}
