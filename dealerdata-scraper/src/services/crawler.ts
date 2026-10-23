import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { VehicleListing } from '../types';
import { cleanHtml } from './htmlCleaner';
import { ListingExtractor } from './listingExtractor';

export interface CrawlEngineOptions {
  startUrl: string;
  dealerId?: string;
  dealerName?: string;
  maxPages?: number;
  inventoryType?: 'New' | 'Used' | 'All';
  requestDelayMs?: number;
}

export class WebsiteCrawler {
  private client: AxiosInstance;
  private visitedUrls: Set<string> = new Set();
  private foundListings: VehicleListing[] = [];

  constructor() {
    this.client = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
  }

  /**
   * Crawls targeted inventory pages following pagination links
   */
  async crawl(options: CrawlEngineOptions): Promise<VehicleListing[]> {
    const isUnlimited = options.maxPages === 0 || options.maxPages === -1 || options.maxPages === undefined;
    const maxPages: number = isUnlimited ? 1000 : (options.maxPages ?? 1000);
    const delay = options.requestDelayMs || 800;

    let currentUrl: string | null = options.startUrl;
    let pageCount = 0;

    console.log(`[Crawler] Starting crawl at: ${options.startUrl} (Max Pages: ${isUnlimited ? 'Unlimited (All Pages)' : maxPages})`);

    while (currentUrl && pageCount < maxPages) {
      if (this.visitedUrls.has(currentUrl)) {
        break;
      }

      this.visitedUrls.add(currentUrl);
      pageCount++;

      console.log(`[Crawler] Fetching page ${pageCount}: ${currentUrl}`);

      try {
        const response = await this.client.get(currentUrl);
        const rawHtml = response.data;

        if (typeof rawHtml !== 'string') {
          console.warn(`[Crawler] Non-string HTML response for ${currentUrl}`);
          break;
        }

        // 1. Clean HTML and extract JSON-LD
        const cleaned = cleanHtml(rawHtml);

        // 2. Extract listings from JSON-LD
        const jsonLdListings = ListingExtractor.extractFromJsonLd(
          cleaned.jsonLdObjects,
          currentUrl,
          options.dealerId,
          options.dealerName
        );

        // 3. Extract listings from HTML cards
        const htmlListings = ListingExtractor.extractFromHtml(
          rawHtml,
          currentUrl,
          options.dealerId,
          options.dealerName
        );

        const pageListings = [...jsonLdListings, ...htmlListings];
        console.log(
          `[Crawler] Page ${pageCount} extracted: ${pageListings.length} raw listings (${jsonLdListings.length} JSON-LD, ${htmlListings.length} HTML)`
        );

        this.foundListings.push(...pageListings);

        if (pageCount > 1 && pageListings.length === 0) {
          console.log(`[Crawler] Page ${pageCount} yielded 0 listings. Reached end of inventory.`);
          break;
        }

        if (rawHtml.includes('Access Denied') || rawHtml.includes('errors.edgesuite.net')) {
          console.warn(`[Crawler] Access Denied / WAF block detected on page ${pageCount}. Halting crawl.`);
          break;
        }

        // 4. Find next page URL
        currentUrl = this.findNextPageUrl(rawHtml, currentUrl);

        if (currentUrl) {
          // Polite delay between requests
          await new Promise((r) => setTimeout(r, delay));
        }
      } catch (err: any) {
        console.error(`[Crawler] Error crawling ${currentUrl}:`, err.message);
        break;
      }
    }

    // Filter by inventory type if requested
    let result = ListingExtractor.deduplicate(this.foundListings);

    if (options.inventoryType === 'New') {
      result = result.filter((item) => item.inventoryType === 'New');
    } else if (options.inventoryType === 'Used') {
      result = result.filter((item) => item.inventoryType === 'Used' || item.inventoryType === 'Certified');
    }

    console.log(
      `[Crawler] Crawl finished. Total unique listings: ${result.length} (Pages crawled: ${pageCount})`
    );

    return result;
  }

  /**
   * Crawls a list of individual Vehicle Detail Page (VDP) URLs discovered via sitemap
   * Uses concurrent batching for speed
   */
  async crawlUrls(
    urls: string[],
    dealerId?: string,
    dealerName?: string,
    maxLimit = 250,
    concurrency = 5
  ): Promise<VehicleListing[]> {
    const targetUrls = urls.slice(0, maxLimit);
    console.log(`[Crawler] Crawling ${targetUrls.length} vehicle detail URLs from sitemap (concurrency: ${concurrency})...`);

    const listings: VehicleListing[] = [];
    const total = targetUrls.length;
    let rateLimited = false;

    for (let i = 0; i < total; i += concurrency) {
      if (rateLimited) {
        console.log(`[Crawler] Rate limit (HTTP 429/403) detected. Rapidly extracting remaining ${total - i} listings directly from sitemap URLs...`);
        const remaining = targetUrls.slice(i);
        const { SitemapDiscovery } = await import('./sitemapDiscovery');
        for (const u of remaining) {
          const slugItem = SitemapDiscovery.extractListingFromUrlSlug(u, dealerId, dealerName);
          if (slugItem) listings.push(slugItem);
        }
        break;
      }

      const chunk = targetUrls.slice(i, i + concurrency);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (url) => {
          try {
            const response = await this.client.get(url);
            const cleaned = cleanHtml(response.data);

            const vdpListings = ListingExtractor.extractFromJsonLd(
              cleaned.jsonLdObjects,
              url,
              dealerId,
              dealerName
            );

            if (vdpListings.length > 0) {
              return vdpListings;
            }

            const fallback = ListingExtractor.extractFromHtml(response.data, url, dealerId, dealerName);
            if (fallback.length > 0) {
              return fallback;
            }

            // Slug fallback
            const { SitemapDiscovery } = await import('./sitemapDiscovery');
            const slugListing = SitemapDiscovery.extractListingFromUrlSlug(url, dealerId, dealerName);
            return slugListing ? [slugListing] : [];
          } catch (err: any) {
            const status = err?.response?.status;
            if (status === 429 || status === 403) {
              rateLimited = true;
            }
            // Slug fallback on network error/blocking
            const { SitemapDiscovery } = await import('./sitemapDiscovery');
            const slugListing = SitemapDiscovery.extractListingFromUrlSlug(url, dealerId, dealerName);
            return slugListing ? [slugListing] : [];
          }
        })
      );

      for (const res of chunkResults) {
        if (res.status === 'fulfilled' && res.value.length > 0) {
          listings.push(...res.value);
        }
      }

      const progress = Math.min(i + concurrency, total);
      if (progress % 20 === 0 || progress === total) {
        console.log(`[Crawler] Sitemap VDP Progress: ${progress}/${total} crawled (${listings.length} listings identified)...`);
      }

      if (i + concurrency < total) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return ListingExtractor.deduplicate(listings);
  }

  /**
   * Identifies pagination / next-page links
   */
  private findNextPageUrl(html: string, currentUrl: string): string | null {
    const $ = cheerio.load(html);

    // Standard pagination selectors
    const nextSelectors = [
      'a[rel="next"]',
      'link[rel="next"]',
      'a.next',
      '.pagination-next a',
      'li.next a',
      '.page-next a',
      'a[aria-label="Next"]',
      'a[aria-label="Next Page"]',
      'a:contains("Next ›")',
      'a:contains("Next >")',
      'a:contains("Next »")',
      'a:contains("Next")'
    ];

    for (const selector of nextSelectors) {
      const el = $(selector).first();
      const href = el.attr('href');
      if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
        try {
          const resolved = new URL(href, currentUrl).toString();
          if (!this.visitedUrls.has(resolved) && resolved !== currentUrl) {
            return resolved;
          }
        } catch {
          // Invalid URL
        }
      }
    }

    // If next button is explicitly disabled, we have reached the end of results
    if ($('.pagination-next.disabled, li.next.disabled, li.pagination-next.disabled, [aria-disabled="true"][aria-label*="next" i]').length > 0) {
      console.log(`[Crawler] Reached last page (disabled Next button in DOM).`);
      return null;
    }

    return null;
  }
}
