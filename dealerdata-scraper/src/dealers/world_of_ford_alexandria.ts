import { DealerInventoryScraper, InventoryScrapeContext, InventoryScrapeResult } from './types';
import { VehicleListing } from '../types';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import axios from 'axios';

export class WorldOfFordAlexandriaInventoryScraper implements DealerInventoryScraper {
  readonly id = 'world_of_ford_alexandria';
  readonly name = 'World Of Ford Alexandria';
  readonly domain = 'worldoffordalexandria.com';
  readonly inventoryUrls = {
    new: 'https://www.worldoffordalexandria.com/new-inventory/index.htm',
    used: 'https://www.worldoffordalexandria.com/used-inventory/index.htm'
  };
  readonly useDirectConnection = true;

  private readonly userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  async scrape(ctx: InventoryScrapeContext): Promise<InventoryScrapeResult> {
    const { targetUrl, dealerId, dealerName, inventoryType, maxPages, logger } = ctx;
    logger.log(`Starting dedicated inventory scrape for ${dealerName} (${dealerId})...`);

    const rootUrl = 'https://www.worldoffordalexandria.com';
    let startUrl = targetUrl;
    if (!startUrl || startUrl.includes('placeholder')) {
      startUrl =
        inventoryType === 'Used'
          ? this.inventoryUrls.used
          : this.inventoryUrls.new;
    }

    const effectiveMaxPages = maxPages && maxPages > 0 ? maxPages : 50;
    const allListings: VehicleListing[] = [];
    const seenVins = new Set<string>();
    let totalPagesCrawled = 0;

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      logger.log(`Launching dedicated stealth browser for ${this.name}...`);
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security'
        ]
      });

      context = await browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: this.userAgent,
        viewport: { width: 1440, height: 900 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      // Evade webdriver detection
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page: Page = await context.newPage();

      logger.log(`Navigating to initial inventory page: ${startUrl}...`);
      const gotoResp = await page.goto(startUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });

      if (!gotoResp || (gotoResp.status() >= 400 && gotoResp.status() !== 403)) {
        logger.warn(`Initial page load returned HTTP status ${gotoResp?.status()}.`);
      }

      await page.waitForTimeout(2500);

      // Dismiss any popups / consent banners
      await this.dismissPopups(page);

      let pageNum = 1;
      let consecutiveZeroNewPages = 0;

      while (pageNum <= effectiveMaxPages) {
        totalPagesCrawled++;
        const currentUrl = page.url();

        // Extract vehicles directly from Dealer.com DDC dataLayer
        const rawVehicles = await page.evaluate(() => {
          const list = (window as any).DDC?.dataLayer?.vehicles;
          if (Array.isArray(list) && list.length > 0) {
            return list;
          }
          return [];
        });

        logger.log(`Page ${pageNum} (${currentUrl}): found ${rawVehicles.length} vehicles in DDC dataLayer.`);

        let newOnPage = 0;
        for (const v of rawVehicles) {
          if (!v || !v.vin) continue;
          const cleanVin = String(v.vin).trim().toUpperCase();
          if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(cleanVin)) continue;

          if (seenVins.has(cleanVin)) continue;
          seenVins.add(cleanVin);
          newOnPage++;

          // Parse prices
          const listPrice = this.extractPrice(v.pricing?.finalPrice || v.pricing?.priceAfterFees || v.pricing?.internetPrice || v.pricing?.salePrice || v.salePrice || v.internetPrice || v.pricing?.msrp || v.msrp);
          const msrp = this.extractPrice(v.pricing?.msrp || v.msrp);

          // Build vehicle URL
          let vehicleUrl = v.link || '';
          if (vehicleUrl && !vehicleUrl.startsWith('http')) {
            vehicleUrl = `${rootUrl}${vehicleUrl.startsWith('/') ? '' : '/'}${vehicleUrl}`;
          }

          // Build primary image URL
          const imageUrl = Array.isArray(v.images) && v.images[0]?.uri ? v.images[0].uri : undefined;

          const year = Number(v.year || v.modelYear) || new Date().getFullYear();
          const make = v.make || 'Ford';
          const model = v.model || '';
          const trim = v.trim || undefined;
          const stockNumber = v.stockNumber || undefined;
          const mileage = typeof v.odometer === 'number' && v.odometer >= 0 ? v.odometer : undefined;
          const invType: 'New' | 'Used' = (v.inventoryType || v.newOrUsed || '').toLowerCase().includes('used') ? 'Used' : 'New';

          allListings.push({
            vin: cleanVin,
            year,
            make,
            model,
            trim,
            stockNumber,
            inventoryType: invType,
            listPrice: listPrice || msrp || 0,
            msrp: msrp || undefined,
            mileage,
            vehicleUrl: vehicleUrl || currentUrl,
            imageUrl,
            dealerId,
            dealerName,
            extractionSource: 'html_srp',
            discoveredAt: new Date().toISOString()
          });
        }

        logger.log(`Page ${pageNum}: extracted ${newOnPage} new unique vehicles (Total: ${allListings.length}).`);

        if (newOnPage === 0 && rawVehicles.length > 0) {
          consecutiveZeroNewPages++;
          if (consecutiveZeroNewPages >= 2) {
            logger.log(`2 consecutive pages yielded 0 new vehicles. Concluding pagination.`);
            break;
          }
        } else {
          consecutiveZeroNewPages = 0;
        }

        // Locate Next page button
        const nextBtn = page.locator(
          'a[rel="next"], .pagination-next:not(.disabled) a, a[aria-label*="Next" i]:not([aria-disabled="true"]):not([class*="disabled"]), a:has-text("Next")'
        ).first();

        const count = await nextBtn.count();
        if (count === 0) {
          logger.log(`No next button element found on page ${pageNum}. Reached final page.`);
          break;
        }

        const isVisible = await nextBtn.isVisible().catch(() => false);
        if (!isVisible) {
          logger.log(`Next page button is not visible on page ${pageNum}. Reached final page.`);
          break;
        }

        const nextHref = await nextBtn.getAttribute('href');
        const targetUrl = nextHref
          ? (nextHref.startsWith('http') ? nextHref : `${rootUrl}${nextHref.startsWith('/') ? '' : '/'}${nextHref}`)
          : null;

        // Ensure popups, consent banners, and overlays are thoroughly dismissed/purged
        await this.dismissPopups(page);

        // Perform in-page navigation: Multi-tier fallback immune to pointer interception
        try {
          let navigated = false;

          // Tier 1: In-page JS click (completely bypasses CSS/DOM overlay pointer-blocking)
          try {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
              page.evaluate(() => {
                const btn = document.querySelector(
                  'a[rel="next"], .pagination-next:not(.disabled) a, a[aria-label*="Next" i]:not([aria-disabled="true"]):not([class*="disabled"]), a:has-text("Next")'
                ) as HTMLElement;
                if (btn) btn.click();
              })
            ]);
            navigated = page.url() !== currentUrl;
          } catch {}

          // Tier 2: Playwright force click (bypasses hit-testing & pointer interceptions)
          if (!navigated) {
            try {
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
                nextBtn.click({ force: true, timeout: 5000 })
              ]);
              navigated = page.url() !== currentUrl;
            } catch {}
          }

          // Tier 3: Client-side in-page window.location navigation (inherits active session cookies, zero 429 risk)
          if (!navigated && targetUrl) {
            try {
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}),
                page.evaluate((dest) => { window.location.href = dest; }, targetUrl)
              ]);
              navigated = page.url() !== currentUrl;
            } catch {}
          }

          if (!navigated) {
            logger.warn(`Page ${pageNum} did not transition to next page. Concluding pagination.`);
            break;
          }

          // Polite pacing between pages to maintain session and avoid rate-limits
          await page.waitForTimeout(2200);
          pageNum++;
        } catch (clickErr: any) {
          logger.warn(`Next page navigation notice: ${clickErr.message}. Ending pagination.`);
          break;
        }
      }
    } catch (err: any) {
      logger.error(`Error during browser crawl of ${dealerName}: ${err.message}`);
    } finally {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }

    // Supplementary Fallback: If browser yielded 0 listings, fallback to sitemap.xml
    if (allListings.length === 0) {
      logger.warn(`Browser yielded 0 listings for ${dealerName}. Engaging sitemap fallback...`);
      try {
        const sitemapListings = await this.scrapeFromSitemap(rootUrl, dealerId, dealerName, inventoryType, logger);
        if (sitemapListings.length > 0) {
          allListings.push(...sitemapListings);
          logger.log(`Recovered ${sitemapListings.length} vehicles via sitemap fallback.`);
        }
      } catch (smErr: any) {
        logger.error(`Sitemap fallback failed: ${smErr.message}`);
      }
    }

    logger.log(`Dedicated scrape complete for ${dealerName}: ${allListings.length} unique vehicles across ${totalPagesCrawled} pages.`);

    return {
      listings: allListings,
      pagesCrawled: totalPagesCrawled,
      engineUsed: 'playwright'
    };
  }

  private extractPrice(val: any): number | undefined {
    if (typeof val === 'number') {
      return val >= 1000 ? val : undefined;
    }
    if (typeof val === 'string') {
      const cleaned = parseFloat(val.replace(/[^0-9.]/g, ''));
      if (!isNaN(cleaned) && cleaned >= 1000) {
        return cleaned;
      }
    }
    return undefined;
  }

  private async dismissPopups(page: Page): Promise<void> {
    // 1. Click accept / allow buttons if visible
    const popups = [
      '#ca-consent-root button:has-text("Allow")',
      '#ca-consent-root button.ca-button-opt-in',
      'button:has-text("Allow all cookies")',
      'button:has-text("Accept All")',
      'button[aria-label="Close"]',
      'button.close',
      '.modal-close',
      '.dialog-close',
      '#onetrust-accept-btn-handler',
      '.cookie-accept'
    ];
    for (const sel of popups) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 200 }).catch(() => false)) {
          await el.click({ force: true, timeout: 500 }).catch(() => {});
        }
      } catch {}
    }

    // 2. Remove all blocking overlays & consent roots from DOM to guarantee zero pointer interception
    await page.evaluate(() => {
      try {
        const selectors = [
          '#ca-consent-root',
          '.ui-widget-overlay',
          '.ui-dialog',
          '[id*="consent"]',
          '[class*="ca-banner"]',
          '.modal-backdrop',
          '.dialog-backdrop'
        ];
        document.querySelectorAll(selectors.join(', ')).forEach((el) => {
          el.remove();
        });
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
      } catch {}
    }).catch(() => {});
  }

  private async scrapeFromSitemap(
    rootUrl: string,
    dealerId: string,
    dealerName: string,
    inventoryType: 'New' | 'Used' | 'All',
    logger: any
  ): Promise<VehicleListing[]> {
    const sitemapUrl = `${rootUrl}/sitemap.xml`;
    logger.log(`Fetching sitemap from ${sitemapUrl}...`);
    const resp = await axios.get(sitemapUrl, {
      headers: { 'User-Agent': this.userAgent, Accept: 'text/xml,application/xml' },
      timeout: 20000
    });

    const xml = resp.data as string;
    const urlMatches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
    const vdpUrls: string[] = [];

    const isTargetNew = inventoryType === 'New' || inventoryType === 'All';
    const isTargetUsed = inventoryType === 'Used' || inventoryType === 'All';

    for (const raw of urlMatches) {
      const loc = raw.replace(/<\/?loc>/g, '').trim();
      const isNewVdp = loc.includes('/new/Ford/') || (loc.includes('/new/') && loc.endsWith('.htm') && !loc.includes('inventory'));
      const isUsedVdp = loc.includes('/used/Ford/') || (loc.includes('/used/') && loc.endsWith('.htm') && !loc.includes('inventory'));

      if (isTargetNew && isNewVdp) {
        vdpUrls.push(loc);
      } else if (isTargetUsed && isUsedVdp) {
        vdpUrls.push(loc);
      }
    }

    logger.log(`Found ${vdpUrls.length} vehicle VDP URLs in sitemap.`);
    const sitemapListings: VehicleListing[] = [];

    for (const url of vdpUrls) {
      // Extract VIN or details from URL pattern like /2026-Ford-Explorer-...-vin.htm or UUID
      const vinMatch = url.match(/[A-HJ-NPR-Z0-9]{17}/i);
      const yearMatch = url.match(/\/([0-9]{4})-/);
      const modelMatch = url.match(/-Ford-([A-Za-z0-9-]+?)-alexandria/i);

      if (vinMatch) {
        const vin = vinMatch[0].toUpperCase();
        sitemapListings.push({
          vin,
          year: yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear(),
          make: 'Ford',
          model: modelMatch ? modelMatch[1].replace(/-/g, ' ') : 'Vehicle',
          inventoryType: url.includes('/used/') ? 'Used' : 'New',
          listPrice: 0,
          vehicleUrl: url,
          dealerId,
          dealerName,
          extractionSource: 'sitemap_vdp',
          discoveredAt: new Date().toISOString()
        });
      }
    }

    return sitemapListings;
  }
}

