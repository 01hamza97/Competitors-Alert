import { DealerInventoryScraper, InventoryScrapeContext, InventoryScrapeResult } from './types';
import { VehicleListing } from '../types';
import { ListingExtractor } from '../services/listingExtractor';
import axios from 'axios';

export class GeorgeChevroletInventoryScraper implements DealerInventoryScraper {
  readonly id = 'george_chevorlet';
  readonly name = 'George Chevrolet';
  readonly domain = 'georgechevy.com';
  readonly inventoryUrls = {
    new: 'https://www.georgechevy.com/new-vehicles/',
    used: 'https://www.georgechevy.com/used-vehicles/'
  };
  readonly useDirectConnection = true;

  private readonly apiUrl = 'https://websites-search.api.carscommerce.inc/api/v1/listings/24383/search';
  private readonly apiKey = 'OQa8l7SzMctJyr5bhSG9jYvlGnZUQfgl';

  async scrape(ctx: InventoryScrapeContext): Promise<InventoryScrapeResult> {
    const { targetUrl, dealerId, dealerName, inventoryType, maxPages, logger } = ctx;
    logger.log(`Starting dedicated inventory scrape for ${dealerName} (${dealerId})...`);

    // 1. FAST-PATH: Native CarsCommerce API (Direct, High Performance, 100% accurate)
    try {
      const typeFilters: string[] = [];
      if (inventoryType === 'New') {
        typeFilters.push('New', 'Demo');
      } else if (inventoryType === 'Used') {
        typeFilters.push('Used', 'Certified');
      } else {
        typeFilters.push('New', 'Demo', 'Used', 'Certified');
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
            filters: { status: ['publish', 'modified', 'pend-sale'] },
            facetFilters: {
              type: typeFilters,
              custom_text_4: ['False']
            },
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

      const deduplicated = ListingExtractor.deduplicate(allListings);
      if (deduplicated.length > 0) {
        logger.log(`Successfully extracted ${deduplicated.length} total listings via CarsCommerce API (total vehicles on site: ${totalVehicles}).`);
        return {
          listings: deduplicated,
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
        viewport: { width: 1440, height: 900 }
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page = await context.newPage();
      logger.log(`Navigating to ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Turnstile bypass wait
      for (let i = 0; i < 20; i++) {
        const body = await page.content();
        if (!body.includes('Verifying you are human') && !body.includes('cf-turnstile-response')) {
          break;
        }
        try {
          const cfBox = page.locator('#challenge-stage iframe, iframe[src*="cloudflare"], .ctp-checkbox-label').first();
          if (await cfBox.isVisible({ timeout: 200 })) {
            await cfBox.click({ timeout: 500 }).catch(() => {});
          }
        } catch {}
        await page.waitForTimeout(1000);
      }

      await page.waitForSelector('.vehicle-card, [data-vin], .result-title', { timeout: 15000 }).catch(() => {});

      const html = await page.content();
      const listings = ListingExtractor.extractFromHtml(html, targetUrl, dealerId, dealerName);
      logger.log(`Playwright fallback extracted ${listings.length} listings from DOM.`);
      return {
        listings: ListingExtractor.deduplicate(listings),
        pagesCrawled: 1,
        engineUsed: 'playwright'
      };
    } finally {
      await browser.close();
    }
  }
}
