import { DealerInventoryScraper, InventoryScrapeContext, InventoryScrapeResult } from './types';
import { VehicleListing } from '../types';
import { ListingExtractor } from '../services/listingExtractor';
import axios from 'axios';

export class PomonaKiaInventoryScraper implements DealerInventoryScraper {
  readonly id = 'pomona_kia';
  readonly name = 'Pomona KIA';
  readonly domain = 'pomonakia.com';
  readonly inventoryUrls = {
    new: 'https://www.pomonakia.com/new-vehicles/',
    used: 'https://www.pomonakia.com/used-vehicles/'
  };
  readonly useDirectConnection = true;

  private readonly apiUrl = 'https://websites-search.api.carscommerce.inc/api/v1/listings/202616/search';
  private readonly apiKey = 'OQa8l7SzMctJyr5bhSG9jYvlGnZUQfgl';

  async scrape(ctx: InventoryScrapeContext): Promise<InventoryScrapeResult> {
    const { targetUrl, dealerId, dealerName, inventoryType, maxPages, logger } = ctx;
    logger.log(`Starting dedicated inventory scrape for ${dealerName} (${dealerId})...`);

    // 1. FAST-PATH: Native CarsCommerce API (Direct, High Performance, 100% accurate)
    try {
      const typeFilters: string[] = [];
      if (inventoryType === 'New') {
        typeFilters.push('New');
      } else if (inventoryType === 'Used') {
        typeFilters.push('Used', 'Certified');
      } else {
        typeFilters.push('New', 'Used', 'Certified');
      }

      logger.log(`Querying native CarsCommerce API endpoint: ${this.apiUrl} (types: ${typeFilters.join(', ')})...`);

      const allListings: VehicleListing[] = [];
      let page = 1;
      let totalVehicles = 0;
      const perPage = 100;
      const effectiveMaxPages = maxPages && maxPages > 0 ? maxPages : 50;

      while (page <= effectiveMaxPages) {
        logger.log(`Fetching API page ${page}...`);
        const resp = await axios.post(
          this.apiUrl,
          {
            page,
            perPage,
            sort: [{ field: 'stock', order: 'asc' }],
            facetFilters: { type_slug: typeFilters },
            requestedFields: [
              'vin',
              'stock',
              'type',
              'year',
              'make',
              'model',
              'trim',
              'vdp_url',
              'pricing',
              'extra_fields',
              'mileage',
              'media'
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey
            },
            timeout: 20000
          }
        );

        if (!resp.data?.data) {
          logger.warn(`API page ${page} returned empty data payload.`);
          break;
        }

        const data = resp.data.data;
        totalVehicles = data.total_vehicle_count || 0;
        const rawListings = data.listings || [];

        if (rawListings.length === 0) {
          break;
        }

        const extracted = ListingExtractor.extractFromCarsCommerce(
          rawListings,
          targetUrl,
          dealerId,
          dealerName
        );

        allListings.push(...extracted);
        logger.log(`Page ${page}: extracted ${extracted.length} vehicles (${allListings.length}/${totalVehicles} total).`);

        if (allListings.length >= totalVehicles || rawListings.length < perPage) {
          break;
        }
        page++;
      }

      if (allListings.length > 0) {
        logger.log(`Successfully extracted ${allListings.length} total listings via CarsCommerce API.`);
        return {
          listings: allListings,
          pagesCrawled: page,
          engineUsed: 'api'
        };
      }
    } catch (apiErr: any) {
      logger.warn(`Native CarsCommerce API failed (${apiErr.message}). Falling back to Playwright...`);
    }

    // 2. FALLBACK: Playwright with Stealth & Cloudflare Turnstile Bypass
    logger.log(`Launching direct Playwright fallback for ${dealerName}...`);
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 900 },
        locale: 'en-US'
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page = await context.newPage();
      logger.log(`Navigating to ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

      // Wait for Cloudflare Turnstile to clear (~6-10s)
      const challengeStart = Date.now();
      while (Date.now() - challengeStart < 25000) {
        const text = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
        const title = await page.title().catch(() => '');
        if (
          !text.includes('Verifying you are human') &&
          !text.includes('keep your website experience safe') &&
          !title.includes('Just a moment')
        ) {
          logger.log(`Cloudflare Turnstile cleared!`);
          break;
        }
        await page.waitForTimeout(2000);
      }

      await page.waitForSelector('[data-vin], .vehicle-card, .srp-vehicle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);

      const html = await page.content();
      const extracted = ListingExtractor.extractFromHtml(html, targetUrl, dealerId, dealerName);

      logger.log(`Playwright extracted ${extracted.length} vehicles from page.`);
      return {
        listings: extracted,
        pagesCrawled: 1,
        engineUsed: 'playwright'
      };
    } finally {
      await browser.close().catch(() => {});
    }
  }
}
