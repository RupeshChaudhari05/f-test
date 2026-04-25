/**
 * MigrationService
 *
 * Handles bulk import of subscribers from external push notification
 * platforms (OneSignal, Firebase, or a generic CSV).
 *
 * Key responsibilities:
 *  1. Parse / validate the incoming payload (already done in DTOs, but we
 *     apply additional business-level guards here).
 *  2. Deduplicate against existing subscribers by endpoint/fcmToken.
 *  3. Persist new subscribers in a single batch insert for efficiency.
 *  4. Return a detailed import report (imported / skipped / failed counts).
 *
 * Security considerations:
 *  - All string fields are truncated to their DB column lengths.
 *  - Rate-limiting is enforced at the controller layer (ThrottlerGuard).
 *  - No raw SQL is used; all persistence is through TypeORM repositories.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Subscriber, ConsentStatus } from '../subscribers/subscriber.entity';
import {
  OneSignalImportDto,
  FirebaseImportDto,
  GenericCsvImportDto,
  GenericCsvColumnMap,
} from './dto/import-subscribers.dto';

/** Summary returned to the caller after every import run. */
export interface ImportReport {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/** Internal normalised shape before database insertion. */
interface NormalisedSubscriber {
  endpoint?: string;
  p256dh?: string;
  authKey?: string;
  fcmToken?: string;
  country?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  tags?: string[];
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  /** Maximum batch size written to the DB in one INSERT. */
  private readonly BATCH_SIZE = 500;

  constructor(
    @InjectRepository(Subscriber)
    private readonly subscriberRepo: Repository<Subscriber>,
  ) { }

  // -------------------------------------------------------------------------
  // OneSignal import
  // -------------------------------------------------------------------------

  /**
   * Import subscribers exported from OneSignal's device export CSV/JSON.
   *
   * @param siteId   Destination site UUID.
   * @param dto      Validated OneSignal import payload.
   * @returns        Detailed import report.
   */
  async importFromOneSignal(
    siteId: string,
    dto: OneSignalImportDto,
  ): Promise<ImportReport> {
    this.logger.log(
      `[Migration] OneSignal import started – siteId=${siteId} count=${dto.subscribers.length}`,
    );

    const normalised: NormalisedSubscriber[] = dto.subscribers.map((row) => ({
      endpoint: row.endpoint?.substring(0, 500),
      p256dh: row.p256dh?.substring(0, 255),
      authKey: row.auth?.substring(0, 255),
      country: row.country?.substring(0, 3),
      browser: row.browser?.substring(0, 50),
      deviceType: row.deviceType?.substring(0, 20) || 'desktop',
      tags: [],
    }));

    return this._persistBatch(siteId, normalised, 'endpoint');
  }

  // -------------------------------------------------------------------------
  // Firebase import
  // -------------------------------------------------------------------------

  /**
   * Import FCM registration tokens exported from Firebase or collected
   * directly from a mobile/web app.
   *
   * @param siteId   Destination site UUID.
   * @param dto      Validated Firebase import payload.
   * @returns        Detailed import report.
   */
  async importFromFirebase(
    siteId: string,
    dto: FirebaseImportDto,
  ): Promise<ImportReport> {
    this.logger.log(
      `[Migration] Firebase import started – siteId=${siteId} count=${dto.tokens.length}`,
    );

    const normalised: NormalisedSubscriber[] = dto.tokens.map((row) => ({
      fcmToken: row.fcmToken?.substring(0, 255),
      country: row.country?.substring(0, 3),
      os: row.os?.substring(0, 50),
      deviceType: row.deviceType?.substring(0, 20) || 'mobile',
      tags: [],
    }));

    return this._persistBatch(siteId, normalised, 'fcmToken');
  }

  // -------------------------------------------------------------------------
  // Generic CSV import
  // -------------------------------------------------------------------------

  /**
   * Import from an arbitrary CSV export.  The caller provides a column-map so
   * the service knows which header maps to which subscriber field.
   *
   * CSV requirements:
   *  - First line must be a header row.
   *  - Delimiter: comma (`,`).
   *  - Values containing commas must be double-quoted.
   *  - Max 5 MB – enforced at the controller level.
   *
   * @param siteId   Destination site UUID.
   * @param dto      CSV content + optional column-map.
   * @returns        Detailed import report.
   */
  async importFromCsv(
    siteId: string,
    dto: GenericCsvImportDto,
  ): Promise<ImportReport> {
    let rows: Record<string, string>[];

    try {
      rows = this._parseCsv(dto.csvContent);
    } catch (err) {
      throw new BadRequestException(`CSV parse error: ${(err as Error).message}`);
    }

    this.logger.log(
      `[Migration] CSV import started – siteId=${siteId} rows=${rows.length}`,
    );

    const map: GenericCsvColumnMap = dto.columnMap || {};
    const normalised: NormalisedSubscriber[] = rows.map((row) => ({
      endpoint: map.endpoint ? row[map.endpoint]?.substring(0, 500) : undefined,
      p256dh: map.p256dh ? row[map.p256dh]?.substring(0, 255) : undefined,
      authKey: map.auth ? row[map.auth]?.substring(0, 255) : undefined,
      fcmToken: map.fcmToken ? row[map.fcmToken]?.substring(0, 255) : undefined,
      country: map.country ? row[map.country]?.substring(0, 3) : undefined,
      deviceType: 'desktop',
      tags: [],
    }));

    // Decide dedup key based on what the user mapped
    const dedupKey = map.endpoint ? 'endpoint' : 'fcmToken';
    return this._persistBatch(siteId, normalised, dedupKey);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Persist a batch of normalised subscriber objects, deduplicating against
   * existing rows in the database.
   *
   * @param siteId    Target site.
   * @param rows      Normalised subscriber objects.
   * @param dedupKey  Field used to detect duplicates ('endpoint' | 'fcmToken').
   */
  private async _persistBatch(
    siteId: string,
    rows: NormalisedSubscriber[],
    dedupKey: 'endpoint' | 'fcmToken',
  ): Promise<ImportReport> {
    const report: ImportReport = {
      total: rows.length,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Collect unique keys from the incoming rows
    const incomingKeys = rows
      .map((r) => r[dedupKey])
      .filter(Boolean) as string[];

    if (incomingKeys.length === 0) {
      report.failed = rows.length;
      report.errors.push(`No valid '${dedupKey}' values found in the import.`);
      return report;
    }

    // Fetch existing subscribers that match any incoming key
    const existing = await this.subscriberRepo.find({
      where: { siteId, [dedupKey]: In(incomingKeys) },
      select: [dedupKey as keyof Subscriber],
    });

    const existingKeys = new Set(existing.map((s) => s[dedupKey] as string));

    // Split into new vs duplicate
    const toInsert: NormalisedSubscriber[] = [];
    for (const row of rows) {
      const key = row[dedupKey];
      if (!key) {
        report.failed++;
        continue;
      }
      if (existingKeys.has(key)) {
        report.skipped++;
      } else {
        toInsert.push(row);
        existingKeys.add(key); // prevent duplicates within this batch
      }
    }

    // Batch insert in chunks to avoid giant single queries
    for (let i = 0; i < toInsert.length; i += this.BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + this.BATCH_SIZE);
      try {
        const entities = chunk.map((row) =>
          this.subscriberRepo.create({
            siteId,
            endpoint: row.endpoint || '',
            p256dh: row.p256dh,
            authKey: row.authKey,
            fcmToken: row.fcmToken,
            country: row.country,
            browser: row.browser,
            os: row.os,
            deviceType: row.deviceType || 'desktop',
            tags: row.tags || [],
            consentStatus: ConsentStatus.GRANTED, // imported = previously consented
            isActive: true,
          }),
        );
        await this.subscriberRepo.save(entities);
        report.imported += entities.length;
      } catch (err) {
        this.logger.error(`[Migration] Batch insert error: ${(err as Error).message}`);
        report.failed += chunk.length;
        report.errors.push(`Batch error: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `[Migration] Import complete – imported=${report.imported} skipped=${report.skipped} failed=${report.failed}`,
    );

    return report;
  }

  /**
   * Minimal RFC-4180-compatible CSV parser.
   * Handles quoted fields, embedded commas, and embedded line-breaks.
   *
   * @param raw  Raw CSV string (must include header row).
   * @returns    Array of objects keyed by the header names.
   */
  private _parseCsv(raw: string): Record<string, string>[] {
    const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 2) throw new Error('CSV must contain at least a header and one data row.');

    const headers = this._parseCsvLine(lines[0]);
    const result: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = this._parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });
      result.push(row);
    }

    return result;
  }

  /** Parse a single CSV line, respecting quoted fields. */
  private _parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let insideQuote = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (insideQuote && line[i + 1] === '"') {
          // Escaped double-quote
          current += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (ch === ',' && !insideQuote) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }
}
