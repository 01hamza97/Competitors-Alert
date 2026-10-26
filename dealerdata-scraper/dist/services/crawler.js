"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsiteCrawler = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const htmlCleaner_1 = require("./htmlCleaner");
const listingExtractor_1 = require("./listingExtractor");
const proxyHelper_1 = require("./proxyHelper");
class WebsiteCrawler {
    client;
    visitedUrls = new Set();
    foundListings = [];
    constructor(options) {
        const proxyConfig = (0, proxyHelper_1.getAxiosProxyConfig)(options?.proxyUrl);
        this.client = axios_1.default.create({
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            ...proxyConfig
        });
    }
    /**
     * Crawls targeted inventory pages following pagination links
     */
    async crawl(options) {
        const isUnlimited = options.maxPages === 0 || options.maxPages === -1 || options.maxPages === undefined;
        const maxPages = isUnlimited ? 1000 : (options.maxPages ?? 1000);
        const delay = options.requestDelayMs || 800;
        let currentUrl = options.startUrl;
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
                const cleaned = (0, htmlCleaner_1.cleanHtml)(rawHtml);
                // 2. Extract listings from JSON-LD
                const jsonLdListings = listingExtractor_1.ListingExtractor.extractFromJsonLd(cleaned.jsonLdObjects, currentUrl, options.dealerId, options.dealerName);
                // 3. Extract listings from HTML cards
                const htmlListings = listingExtractor_1.ListingExtractor.extractFromHtml(rawHtml, currentUrl, options.dealerId, options.dealerName);
                const pageListings = [...jsonLdListings, ...htmlListings];
                console.log(`[Crawler] Page ${pageCount} extracted: ${pageListings.length} raw listings (${jsonLdListings.length} JSON-LD, ${htmlListings.length} HTML)`);
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
            }
            catch (err) {
                console.error(`[Crawler] Error crawling ${currentUrl}:`, err.message);
                break;
            }
        }
        // Filter by inventory type if requested
        let result = listingExtractor_1.ListingExtractor.deduplicate(this.foundListings);
        if (options.inventoryType === 'New') {
            result = result.filter((item) => item.inventoryType === 'New');
        }
        else if (options.inventoryType === 'Used') {
            result = result.filter((item) => item.inventoryType === 'Used' || item.inventoryType === 'Certified');
        }
        console.log(`[Crawler] Crawl finished. Total unique listings: ${result.length} (Pages crawled: ${pageCount})`);
        return result;
    }
    /**
     * Crawls a list of individual Vehicle Detail Page (VDP) URLs discovered via sitemap
     * Uses concurrent batching for speed
     */
    async crawlUrls(urls, dealerId, dealerName, maxLimit = 250, concurrency = 5) {
        const targetUrls = urls.slice(0, maxLimit);
        console.log(`[Crawler] Crawling ${targetUrls.length} vehicle detail URLs from sitemap (concurrency: ${concurrency})...`);
        const listings = [];
        const total = targetUrls.length;
        let rateLimited = false;
        for (let i = 0; i < total; i += concurrency) {
            if (rateLimited) {
                console.log(`[Crawler] Rate limit (HTTP 429/403) detected. Rapidly extracting remaining ${total - i} listings directly from sitemap URLs...`);
                const remaining = targetUrls.slice(i);
                const { SitemapDiscovery } = await Promise.resolve().then(() => __importStar(require('./sitemapDiscovery')));
                for (const u of remaining) {
                    const slugItem = SitemapDiscovery.extractListingFromUrlSlug(u, dealerId, dealerName);
                    if (slugItem)
                        listings.push(slugItem);
                }
                break;
            }
            const chunk = targetUrls.slice(i, i + concurrency);
            const chunkResults = await Promise.allSettled(chunk.map(async (url) => {
                try {
                    const response = await this.client.get(url);
                    const cleaned = (0, htmlCleaner_1.cleanHtml)(response.data);
                    const vdpListings = listingExtractor_1.ListingExtractor.extractFromJsonLd(cleaned.jsonLdObjects, url, dealerId, dealerName);
                    if (vdpListings.length > 0) {
                        return vdpListings;
                    }
                    const fallback = listingExtractor_1.ListingExtractor.extractFromHtml(response.data, url, dealerId, dealerName);
                    if (fallback.length > 0) {
                        return fallback;
                    }
                    // Slug fallback
                    const { SitemapDiscovery } = await Promise.resolve().then(() => __importStar(require('./sitemapDiscovery')));
                    const slugListing = SitemapDiscovery.extractListingFromUrlSlug(url, dealerId, dealerName);
                    return slugListing ? [slugListing] : [];
                }
                catch (err) {
                    const status = err?.response?.status;
                    if (status === 429 || status === 403) {
                        rateLimited = true;
                    }
                    // Slug fallback on network error/blocking
                    const { SitemapDiscovery } = await Promise.resolve().then(() => __importStar(require('./sitemapDiscovery')));
                    const slugListing = SitemapDiscovery.extractListingFromUrlSlug(url, dealerId, dealerName);
                    return slugListing ? [slugListing] : [];
                }
            }));
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
        return listingExtractor_1.ListingExtractor.deduplicate(listings);
    }
    /**
     * Identifies pagination / next-page links
     */
    findNextPageUrl(html, currentUrl) {
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
                }
                catch {
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
exports.WebsiteCrawler = WebsiteCrawler;
