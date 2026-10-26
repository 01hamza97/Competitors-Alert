import dotenv from 'dotenv';
dotenv.config();

import * as cheerio from 'cheerio';
import { URL } from 'url';
import { BrowserManager } from './core/browser';
import { DatabaseManager } from './core/db';
import { StorageManager } from './core/storage';
import { DealerRegistry } from './dealers/registry';
import {
  SpecialsResult,
  CompetitorVehicleSpecial,
  StagedVisualSpecial,
  ScrapeContext
} from './types';

export interface ScrapeSpecialsOptions {
  dealerId?: string;
  dealerName?: string;
  targetUrl?: string;
  proxyUrl?: string;
  saveToDb?: boolean;
  headless?: boolean;
}

export async function scrapeSpecials(options: ScrapeSpecialsOptions): Promise<SpecialsResult> {
  const startTime = Date.now();
  const storage = new StorageManager(process.env.STORAGE_DIR || 'crawled_specials');
  const browser = new BrowserManager();

  // 1. Resolve dedicated dealer scraper
  const scraper = DealerRegistry.getScraper(options.dealerId, options.targetUrl);
  const dealerId = options.dealerId || scraper.id;
  const dealerName = options.dealerName || scraper.name;

  console.log(`======================================================`);
  console.log(`🎯 DEALERDATA SPECIALS SCRAPER`);
  console.log(`   Dealer ID:    ${dealerId}`);
  console.log(`   Store Name:   ${dealerName}`);
  console.log(`   Scraper Mod:  ${scraper.constructor.name}`);
  console.log(`======================================================\n`);

  // 2. Determine target URLs
  const urlsToScrape: string[] = [];
  if (options.targetUrl) {
    urlsToScrape.push(options.targetUrl);
  } else if (scraper.specialsUrls && scraper.specialsUrls.length > 0) {
    urlsToScrape.push(...scraper.specialsUrls);
  } else {
    throw new Error(`No specials URLs configured for dealer: ${dealerId}. Please pass --url=...`);
  }

  const allHtmlSpecials: CompetitorVehicleSpecial[] = [];
  const allVisualSpecials: StagedVisualSpecial[] = [];
  const errors: string[] = [];
  let primaryDomain = '';

  try {
    await browser.init({
      proxyUrl: options.proxyUrl || process.env.SCRAPER_PROXY_URL,
      headless: options.headless
    });

    for (const url of urlsToScrape) {
      console.log(`\n🔍 [Specials] Crawling specials page: ${url}`);
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        if (!primaryDomain) primaryDomain = domain;

        const { page, html } = await browser.fetchPage(url);
        const $ = cheerio.load(html);

        const ctx: ScrapeContext = {
          page,
          $,
          html,
          targetUrl: url,
          dealerId,
          dealerName,
          domain,
          proxyUrl: options.proxyUrl,
          downloadDir: storage.getDealerDir(dealerId),
          logger: {
            log: (msg) => console.log(`   [${scraper.id}] ${msg}`),
            warn: (msg) => console.warn(`   ⚠️ [${scraper.id}] ${msg}`),
            error: (msg) => console.error(`   ❌ [${scraper.id}] ${msg}`)
          }
        };

        const result = await scraper.scrape(ctx);
        allHtmlSpecials.push(...result.htmlSpecials);
        allVisualSpecials.push(...result.visualSpecials);

        await page.close().catch(() => {});
      } catch (pageErr: any) {
        console.error(`❌ [Specials] Error scraping ${url}:`, pageErr.message);
        errors.push(`${url}: ${pageErr.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  // 3. Generate N8N Vision AI Manifest
  let manifestPath: string | undefined;
  if (allVisualSpecials.length > 0) {
    manifestPath = storage.generateManifest(
      dealerId,
      dealerName,
      urlsToScrape[0] || '',
      allVisualSpecials
    );
  }

  // 4. Sync to MySQL Database
  const shouldSaveToDb = options.saveToDb !== false && process.env.SAVE_TO_DB !== 'false';
  if (shouldSaveToDb) {
    if (allHtmlSpecials.length > 0) {
      await DatabaseManager.syncVehicleSpecials(allHtmlSpecials, dealerId, dealerName);
    }
    if (allVisualSpecials.length > 0) {
      await DatabaseManager.syncSpecialsStaging(allVisualSpecials, dealerId, dealerName);
    }
  }

  const durationMs = Date.now() - startTime;
  const totalExtracted = allHtmlSpecials.length + allVisualSpecials.length;

  console.log(`\n======================================================`);
  console.log(`🏁 SPECIALS SCRAPE COMPLETE for: ${dealerName}`);
  console.log(`   Structured HTML Specials: ${allHtmlSpecials.length}`);
  console.log(`   Visual Specials (Flyers): ${allVisualSpecials.length}`);
  console.log(`   Total Extracted:          ${totalExtracted}`);
  if (manifestPath) {
    console.log(`   N8N Vision AI Manifest:   ${manifestPath}`);
  }
  console.log(`   Duration:                 ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`======================================================\n`);

  return {
    dealerId,
    dealerName,
    targetUrl: urlsToScrape[0] || '',
    domain: primaryDomain,
    scrapedAt: new Date().toISOString(),
    durationMs,
    htmlSpecials: allHtmlSpecials,
    visualSpecials: allVisualSpecials,
    totalExtracted,
    manifestPath,
    errors: errors.length > 0 ? errors : undefined
  };
}

export * from './types';
export * from './dealers/registry';
export * from './dealers/types';
