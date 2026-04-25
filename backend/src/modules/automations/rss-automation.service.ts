/**
 * RSS & YouTube Automation Poller (Cron Service)
 * ===============================================
 * Runs on a configurable schedule (default: every 15 minutes) and:
 *
 *  1. Finds all active RSS_FEED automations across all sites.
 *  2. Fetches each RSS feed and detects new items since the last poll.
 *  3. Sends a push notification for each new item using the automation's
 *     notification template (with variable interpolation).
 *  4. Finds all active YOUTUBE_VIDEO automations.
 *  5. Fetches the YouTube channel's RSS feed (every YouTube channel exposes
 *     one at https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID)
 *     and notifies subscribers of new uploads.
 *
 * Variable interpolation in templates:
 *  {{title}}       – item title
 *  {{link}}        – item permalink
 *  {{description}} – item description (truncated)
 *  {{pubDate}}     – publication date
 *  {{author}}      – item author
 *
 * Dependencies:
 *  - NestJS @nestjs/schedule (already installed)
 *  - Node.js built-in fetch (Node 18+) – no external HTTP client required
 *  - No XML parser package: uses a minimal regex-based XML reader that handles
 *    standard RSS 2.0 and Atom feeds.
 *
 * @version 1.0.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Automation, AutomationType } from '../automations/automation.entity';
import { Subscriber } from '../subscribers/subscriber.entity';
import { Notification, NotificationStatus, TargetType } from '../notifications/notification.entity';
import { Site } from '../sites/site.entity';
import { PushService } from '../notifications/push.service';

/** Metadata for a single RSS/Atom feed item. */
interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  author: string;
}

/** Parsed RSS/Atom feed. */
interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

@Injectable()
export class RssAutomationService {
  private readonly logger = new Logger(RssAutomationService.name);

  constructor(
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
    @InjectRepository(Subscriber)
    private readonly subscriberRepo: Repository<Subscriber>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Site)
    private readonly siteRepo: Repository<Site>,
    private readonly pushService: PushService,
  ) { }

  // ── Cron: every 15 minutes ─────────────────────────────────────────────

  /**
   * Main polling loop.  Runs every 15 minutes via the NestJS scheduler.
   *
   * Separated into RSS and YouTube polls so a failure in one branch doesn't
   * block the other.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async pollAllFeeds(): Promise<void> {
    this.logger.debug('[RssAutomation] Starting feed poll cycle...');

    await Promise.allSettled([
      this._pollRssFeeds(),
      this._pollYoutubeFeeds(),
    ]);

    this.logger.debug('[RssAutomation] Feed poll cycle complete.');
  }

  // ── RSS feeds ──────────────────────────────────────────────────────────

  private async _pollRssFeeds(): Promise<void> {
    const automations = await this.automationRepo.find({
      where: { type: AutomationType.RSS_FEED, isActive: true },
    });

    if (!automations.length) return;

    this.logger.log(`[RssAutomation] Polling ${automations.length} RSS automation(s)...`);

    for (const automation of automations) {
      try {
        await this._processFeedAutomation(automation);
      } catch (err) {
        this.logger.error(
          `[RssAutomation] Error processing automation ${automation.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async _pollYoutubeFeeds(): Promise<void> {
    const automations = await this.automationRepo.find({
      where: { type: AutomationType.YOUTUBE_VIDEO, isActive: true },
    });

    if (!automations.length) return;

    this.logger.log(`[RssAutomation] Polling ${automations.length} YouTube automation(s)...`);

    for (const automation of automations) {
      try {
        // YouTube exposes standard Atom feeds for channels
        const channelId = automation.triggerConfig?.channelId;
        if (!channelId) {
          this.logger.warn(`[RssAutomation] YouTube automation ${automation.id} has no channelId.`);
          continue;
        }
        // Build the YouTube Atom feed URL
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
        await this._processFeedAutomation(automation, feedUrl);
      } catch (err) {
        this.logger.error(
          `[RssAutomation] YouTube error for automation ${automation.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  // ── Core processing ────────────────────────────────────────────────────

  /**
   * Fetch and process a single RSS/Atom feed for an automation.
   *
   * @param automation  The Automation entity to process.
   * @param feedUrlOverride  Override the feed URL (used for YouTube).
   */
  private async _processFeedAutomation(
    automation: Automation,
    feedUrlOverride?: string,
  ): Promise<void> {
    const feedUrl = feedUrlOverride || automation.triggerConfig?.feedUrl;
    if (!feedUrl) {
      this.logger.warn(`[RssAutomation] Automation ${automation.id} has no feedUrl – skipping.`);
      return;
    }

    // Fetch the feed
    const xmlText = await this._fetchFeed(feedUrl);
    if (!xmlText) return;

    // Parse it
    const feed = this._parseFeed(xmlText);
    if (!feed.items.length) return;

    // Determine the last-seen item GUID
    const lastSeenGuid: string | null = automation.triggerConfig?.lastSeenGuid || null;
    const lastTriggeredAt: Date | null = automation.lastTriggeredAt;

    // Find new items (items we haven't notified about yet)
    const newItems = feed.items.filter((item) => {
      if (!item.guid) return false; // can't deduplicate without GUID
      if (lastSeenGuid && item.guid === lastSeenGuid) return false; // seen
      // If we have a last-triggered timestamp, skip items older than it
      if (lastTriggeredAt && item.pubDate) {
        const pub = new Date(item.pubDate);
        if (!isNaN(pub.getTime()) && pub <= lastTriggeredAt) return false;
      }
      return true;
    });

    if (!newItems.length) {
      this.logger.debug(`[RssAutomation] No new items for automation ${automation.id}.`);
      return;
    }

    this.logger.log(
      `[RssAutomation] Found ${newItems.length} new item(s) for automation ${automation.id}.`,
    );

    // Fetch subscribers for the site
    const subscribers = await this.subscriberRepo.find({
      where: { siteId: automation.siteId, isActive: true },
    });

    if (!subscribers.length) return;

    // Load site for VAPID keys
    const site = await this.siteRepo.findOne({ where: { id: automation.siteId } });
    if (!site) return;

    // Send one notification per new item (most recent first)
    const template = automation.notificationTemplate || {};
    for (const item of newItems.slice(0, 5)) { // cap at 5 items per poll to avoid spam
      // Create a transient Notification entity for the push payload
      const notification = this.notifRepo.create({
        siteId: automation.siteId,
        title: this._interpolate(template.title || '{{title}}', item),
        message: this._interpolate(template.message || template.body || '{{description}}', item),
        iconUrl: template.iconUrl || undefined,
        imageUrl: template.imageUrl || undefined,
        clickAction: this._interpolate(template.clickAction || '{{link}}', item),
        ttl: template.ttl || 86400,
        urgency: template.urgency || 'normal',
        targetType: TargetType.ALL,
        status: NotificationStatus.SENT,
      });
      const savedNotif = await this.notifRepo.save(notification);

      // Send to each subscriber
      for (const subscriber of subscribers) {
        try {
          await this.pushService.sendToSubscriber(site, subscriber, savedNotif);
        } catch (err) {
          this.logger.error(
            `[RssAutomation] Push failed for item "${item.title}": ${(err as Error).message}`,
          );
        }
      }
    }

    // Update the automation's last-seen state
    automation.triggerConfig = {
      ...automation.triggerConfig,
      lastSeenGuid: newItems[0].guid, // most recent item's GUID
    };
    automation.lastTriggeredAt = new Date();
    automation.totalTriggered += newItems.length;
    await this.automationRepo.save(automation);
  }

  // ── HTTP fetch ─────────────────────────────────────────────────────────

  /**
   * Fetch an RSS/Atom feed URL and return the raw XML text.
   * Returns null on network errors so the caller can skip gracefully.
   */
  private async _fetchFeed(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000); // 10 s

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PoshPush-RSSBot/2.0 (+https://poshnotify.com/bot)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        this.logger.warn(`[RssAutomation] Feed ${url} returned HTTP ${resp.status}.`);
        return null;
      }

      return resp.text();
    } catch (err) {
      this.logger.warn(`[RssAutomation] Failed to fetch feed ${url}: ${(err as Error).message}`);
      return null;
    }
  }

  // ── XML parser ─────────────────────────────────────────────────────────

  /**
   * Minimal RSS 2.0 / Atom feed parser using regex.
   *
   * Supports:
   *  - RSS 2.0 (<item> elements with <title>, <link>, <description>,
   *    <pubDate>, <guid>, <author>)
   *  - Atom 1.0 (<entry> elements with <title>, <link href>, <summary>,
   *    <published>/<updated>, <id>, <author><name>)
   *
   * Does NOT support namespaced tags (media:, content:, etc.) – those are
   * silently ignored.  For production use you may want to swap this out for
   * a proper XML parser package.
   */
  private _parseFeed(xml: string): ParsedFeed {
    // Detect Atom vs RSS
    const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"');

    const feedTitle = this._extractTag(xml, 'title', 0) || 'Untitled Feed';

    const items: FeedItem[] = [];
    const itemTag = isAtom ? 'entry' : 'item';
    const itemRegex = new RegExp(`<${itemTag}[\\s>]([\\s\\S]*?)<\\/${itemTag}>`, 'gi');

    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];

      // Extract link – Atom uses <link href="..." /> or <link rel="alternate" href="..." />
      let link = '';
      if (isAtom) {
        const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
        link = hrefMatch ? hrefMatch[1] : '';
      } else {
        link = this._extractTag(block, 'link') || '';
      }

      // Extract pub date
      const pubDate = isAtom
        ? (this._extractTag(block, 'published') || this._extractTag(block, 'updated') || '')
        : (this._extractTag(block, 'pubDate') || '');

      // Extract GUID / ID
      const guid = isAtom
        ? (this._extractTag(block, 'id') || link)
        : (this._extractTag(block, 'guid') || link);

      // Extract author
      let author = '';
      if (isAtom) {
        const authorBlock = this._extractTag(block, 'author') || '';
        author = this._extractTag(authorBlock, 'name') || '';
      } else {
        author = this._extractTag(block, 'author') || '';
      }

      // Description / summary
      const description = this._extractTag(block, isAtom ? 'summary' : 'description') || '';

      items.push({
        title: this._stripHtml(this._extractTag(block, 'title') || ''),
        link: link.trim(),
        description: this._stripHtml(description).substring(0, 300),
        pubDate: pubDate.trim(),
        guid: guid.trim(),
        author: this._stripHtml(author).trim(),
      });
    }

    return { title: this._stripHtml(feedTitle), items };
  }

  /**
   * Extract the text content of the first occurrence of `tag` in `xml`.
   * Handles both <tag>content</tag> and CDATA sections.
   */
  private _extractTag(xml: string, tag: string, _skip = 0): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    if (!match) return null;
    // Strip CDATA wrappers
    return match[1].replace(/<!\[CDATA\[([\s\S]*?)]]>/gi, '$1').trim();
  }

  /** Remove HTML tags and decode basic HTML entities. */
  private _stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Replace `{{variable}}` placeholders in a template string with values
   * from the feed item.
   */
  private _interpolate(template: string, item: FeedItem): string {
    return template
      .replace(/\{\{title\}\}/g, item.title)
      .replace(/\{\{link\}\}/g, item.link)
      .replace(/\{\{description\}\}/g, item.description)
      .replace(/\{\{pubDate\}\}/g, item.pubDate)
      .replace(/\{\{author\}\}/g, item.author);
  }
}
