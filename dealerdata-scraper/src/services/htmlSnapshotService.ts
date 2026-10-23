import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { HtmlCrawlManifest, SpecialsOfferImage } from '../types';
import { R2StorageService } from './r2Storage';

export class HtmlSnapshotService {
  /**
   * Prepares and cleans raw HTML specifically for compact AI consumption,
   * stripping bloated JS bundles, styles, SVGs, while preserving vehicle listings,
   * JSON-LD scripts, and specials promotional banners.
   */
  static cleanHtmlForAi(rawHtml: string): { cleanedHtml: string; specialsImages: SpecialsOfferImage[]; } {
    const $ = cheerio.load(rawHtml);
    const specialsImages: SpecialsOfferImage[] = [];

    // 1. Detect and collect specials / promotional banner images before stripping
    const specialsSelectors = [
      'img[src*="special" i]',
      'img[src*="banner" i]',
      'img[src*="offer" i]',
      'img[src*="lease" i]',
      'img[alt*="special" i]',
      'img[alt*="offer" i]',
      'img[alt*="lease" i]',
      '.special-item img',
      '.specials-banner img',
      '.offer-card img',
      '.vehicle-special img'
    ];

    $(specialsSelectors.join(', ')).each((_, el) => {
      const img = $(el);
      const src = img.attr('data-src') || img.attr('src');
      if (src && !src.startsWith('data:image')) {
        const parentCard = img.closest('.special-item, .offer-card, .vehicle-special, .slide, .banner, div');
        const disclaimer = parentCard.find('.disclaimer, .legal, small, p.terms').text().trim() || undefined;

        specialsImages.push({
          imageUrl: src,
          pageUrl: '',
          altText: img.attr('alt') || undefined,
          title: img.attr('title') || undefined,
          disclaimerSnippet: disclaimer ? disclaimer.substring(0, 300) : undefined,
          discoveredAt: new Date().toISOString()
        });
      }
    });

    // 2. Remove script & style tags (keep ld+json for structured schema)
    $('script:not([type="application/ld+json"])').remove();
    $('style, link[rel="stylesheet"], noscript, iframe, svg').remove();

    // 3. Remove common layout noise
    $(
      [
        'header',
        'footer',
        'nav',
        'aside',
        '.site-header',
        '.site-footer',
        '.navigation',
        '.cookie-banner',
        '.cookie-consent',
        '.chat-widget',
        '#live-chat',
        '.gubagoo-chat',
        '#drift-widget',
        '.modal',
        '.popup'
      ].join(', ')
    ).remove();

    return {
      cleanedHtml: $.html(),
      specialsImages
    };
  }

  /**
   * Saves a cleaned HTML page to the dealer's snapshot folder, and syncs to R2 if configured.
   */
  static async savePageHtml(
    dealerId: string,
    pageNumber: number,
    cleanedHtml: string,
    baseStorageDir = path.join(process.cwd(), 'crawled_html')
  ): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    const targetFolder = path.join(baseStorageDir, dealerId, today);

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const localFilePath = path.join(targetFolder, `page_${pageNumber}.html`);
    fs.writeFileSync(localFilePath, cleanedHtml, 'utf-8');
    console.log(`[Snapshot] Saved clean HTML page ${pageNumber} to local disk: ${localFilePath}`);

    // If Cloudflare R2 is configured, also upload to R2
    if (R2StorageService.isR2Configured()) {
      const r2Key = `crawled_html/${dealerId}/${today}/page_${pageNumber}.html`;
      await R2StorageService.uploadContent(cleanedHtml, r2Key, 'text/html');
    }

    return localFilePath;
  }

  /**
   * Generates or updates manifest.json in the crawl directory for N8N + AI to consume,
   * and syncs to Cloudflare R2 if configured.
   */
  static async saveManifest(
    manifest: HtmlCrawlManifest,
    baseStorageDir = path.join(process.cwd(), 'crawled_html')
  ): Promise<string> {
    const today = new Date().toISOString().split('T')[0];
    const targetFolder = path.join(baseStorageDir, manifest.dealerId, today);

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const manifestJsonString = JSON.stringify(manifest, null, 2);
    const localManifestPath = path.join(targetFolder, 'manifest.json');
    fs.writeFileSync(localManifestPath, manifestJsonString, 'utf-8');
    console.log(`[Manifest] Generated local N8N manifest at: ${localManifestPath}`);

    // If Cloudflare R2 is configured, also upload to R2
    if (R2StorageService.isR2Configured()) {
      const r2Key = `crawled_html/${manifest.dealerId}/${today}/manifest.json`;
      await R2StorageService.uploadContent(manifestJsonString, r2Key, 'application/json');
    }

    return localManifestPath;
  }
}
