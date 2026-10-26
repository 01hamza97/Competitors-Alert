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
exports.PlaywrightCrawler = void 0;
const axios_1 = __importDefault(require("axios"));
const playwright_1 = require("playwright");
const htmlSnapshotService_1 = require("./htmlSnapshotService");
const listingExtractor_1 = require("./listingExtractor");
class PlaywrightCrawler {
    browser = null;
    context = null;
    async init() {
        if (!this.browser) {
            console.log('[Playwright] Launching headless browser with stealth config...');
            this.browser = await playwright_1.chromium.launch({
                headless: true,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            });
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                viewport: { width: 1440, height: 900 },
                locale: 'en-US',
                timezoneId: 'America/Los_Angeles',
                extraHTTPHeaders: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'Upgrade-Insecure-Requests': '1'
                }
            });
            // Remove webdriver flag to evade standard bot detections
            await this.context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
            });
        }
    }
    async close() {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        console.log('[Playwright] Browser closed.');
    }
    /**
     * Crawls targeted pages using Playwright, rendering JavaScript and saving clean HTML snapshots
     */
    async crawl(options) {
        await this.init();
        const page = await this.context.newPage();
        const isUnlimited = options.maxPages === 0 || options.maxPages === -1 || options.maxPages === undefined;
        const maxPages = isUnlimited ? 40 : Math.min(options.maxPages ?? 40, 40);
        const htmlFiles = [];
        const allSpecialsImages = [];
        const staticListings = [];
        console.log(`[Playwright] Starting crawl. Page Depth: ${isUnlimited ? 'Unlimited (All Pages)' : maxPages}`);
        let currentUrl = options.startUrl;
        let pageCount = 0;
        const visitedUrls = new Set();
        const crawledVinsSet = new Set();
        // Listen for client-side inventory search APIs (e.g. CarsCommerce / Dealer Inspire)
        const interceptedApiListings = [];
        let interceptedApiDone = false;
        page.on('response', async (res) => {
            const u = res.url();
            if (u.includes('websites-search.api.carscommerce.inc') || u.includes('/api/v1/listings/')) {
                try {
                    const json = await res.json();
                    if (json?.data?.listings && Array.isArray(json.data.listings)) {
                        console.log(`[Playwright] Intercepted CarsCommerce API! Found ${json.data.listings.length} listings (total stock: ${json.data.total_vehicle_count}).`);
                        const apiItems = listingExtractor_1.ListingExtractor.extractFromCarsCommerce(json.data.listings, options.startUrl, options.dealerId, options.dealerName);
                        interceptedApiListings.push(...apiItems);
                        // Auto-fetch remaining pages directly via CarsCommerce API in fast-lane
                        if (json.data.total_vehicle_count > json.data.listings.length && !interceptedApiDone) {
                            interceptedApiDone = true;
                            try {
                                const req = res.request();
                                const headers = req.headers();
                                const apiKey = headers['x-api-key'] || 'OQa8l7SzMctJyr5bhSG9jYvlGnZUQfgl';
                                const totalPages = Math.ceil(json.data.total_vehicle_count / 100);
                                for (let p = 2; p <= Math.min(totalPages, 50); p++) {
                                    const moreRes = await axios_1.default.post(u, {
                                        page: p,
                                        perPage: 100,
                                        sort: [{ field: 'stock', order: 'asc' }],
                                        facetFilters: { type_slug: ['New'] },
                                        requestedFields: ['vin', 'stock', 'type', 'year', 'make', 'model', 'trim', 'vdp_url', 'pricing', 'extra_fields']
                                    }, {
                                        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                                        timeout: 10000
                                    });
                                    const moreListings = moreRes.data?.data?.listings || [];
                                    if (moreListings.length > 0) {
                                        const moreItems = listingExtractor_1.ListingExtractor.extractFromCarsCommerce(moreListings, options.startUrl, options.dealerId, options.dealerName);
                                        interceptedApiListings.push(...moreItems);
                                    }
                                    if (moreListings.length < 100)
                                        break;
                                }
                                console.log(`[Playwright] CarsCommerce auto-fetch complete: ${interceptedApiListings.length}/${json.data.total_vehicle_count} total vehicles.`);
                            }
                            catch (apiErr) {
                                console.warn(`[Playwright] CarsCommerce auto-fetch remaining pages notice:`, apiErr.message);
                            }
                        }
                    }
                }
                catch { }
            }
        });
        let consecutiveZeroNewVinPages = 0;
        let alreadyLoadedInBrowser = false;
        try {
            while (currentUrl && pageCount < maxPages) {
                const normalizedUrl = currentUrl.trim();
                if (visitedUrls.has(normalizedUrl)) {
                    console.log(`[Playwright] Already visited ${normalizedUrl}. Pagination finished.`);
                    break;
                }
                visitedUrls.add(normalizedUrl);
                pageCount++;
                try {
                    if (!alreadyLoadedInBrowser) {
                        try {
                            await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
                        }
                        catch (gotoErr) {
                            if (gotoErr.message && gotoErr.message.includes('Download is starting')) {
                                console.warn(`[Playwright] Target URL started file download instead of HTML document. Continuing DOM check...`);
                            }
                            else {
                                throw gotoErr;
                            }
                        }
                    }
                    alreadyLoadedInBrowser = false;
                    // Wait for rate-limit cooldown or Cloudflare Turnstile / anti-bot challenge to resolve
                    let isChallengePage = false;
                    const challengeStart = Date.now();
                    const maxChallengeWaitMs = 35000;
                    while (Date.now() - challengeStart < maxChallengeWaitMs) {
                        let bodyText = '';
                        let pageTitle = '';
                        let hasCfWrapper = false;
                        let hasTurnstile = false;
                        try {
                            bodyText = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
                            pageTitle = await page.title().catch(() => '');
                            hasCfWrapper = await page.evaluate(() => document.querySelector('.di-cf-wrapper') !== null).catch(() => false);
                            hasTurnstile = await page.locator('#challenge-stage iframe, iframe[src*="cloudflare"], .ctp-checkbox-label, .di-cf-wrapper').first().isVisible({ timeout: 200 }).catch(() => false);
                        }
                        catch {
                            // Page is navigating/redirecting, keep waiting
                            await page.waitForTimeout(1000);
                            continue;
                        }
                        if (bodyText.includes('Too many requests') || (bodyText.length < 50 && pageCount > 1)) {
                            console.log(`[Playwright] Rate limit / empty response on ${normalizedUrl}. Cooling down 15s...`);
                            await page.waitForTimeout(15000);
                            try {
                                await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 });
                            }
                            catch { }
                            continue;
                        }
                        const inChallenge = bodyText.includes('Verifying you are human') ||
                            bodyText.includes('Verification successful') ||
                            bodyText.includes('cf-browser-verification') ||
                            pageTitle.includes('Just a moment') ||
                            pageTitle.includes('Attention Required') ||
                            pageTitle === 'Dealer Website' ||
                            hasCfWrapper ||
                            hasTurnstile;
                        if (inChallenge) {
                            isChallengePage = true;
                            console.log(`[Playwright] Cloudflare / Turnstile challenge active on ${normalizedUrl}. Waiting for resolution (${Math.round((Date.now() - challengeStart) / 1000)}s)...`);
                            try {
                                const cfBox = page.locator('#challenge-stage iframe, iframe[src*="cloudflare"], .ctp-checkbox-label').first();
                                if (await cfBox.isVisible({ timeout: 300 })) {
                                    await cfBox.click({ timeout: 600 }).catch(() => { });
                                }
                            }
                            catch { }
                            await page.waitForTimeout(1500);
                        }
                        else {
                            if (isChallengePage) {
                                console.log(`[Playwright] Challenge resolved successfully after ${Math.round((Date.now() - challengeStart) / 1000)}s on ${normalizedUrl}. Waiting for page settle...`);
                                await page.waitForTimeout(2000);
                            }
                            isChallengePage = false;
                            break;
                        }
                    }
                    if (isChallengePage) {
                        console.warn(`[Playwright] Cloudflare challenge did not pass on ${normalizedUrl}. Reloading page...`);
                        await page.waitForTimeout(3000);
                        await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => { });
                        await page.waitForTimeout(2000);
                        const titleAfterReload = await page.title().catch(() => '');
                        if (titleAfterReload.includes('Just a moment') || titleAfterReload.includes('Attention Required') || titleAfterReload === 'Dealer Website') {
                            console.warn(`[Playwright] Page ${normalizedUrl} remains blocked by Cloudflare. Skipping extraction.`);
                            currentUrl = await this.findNextPage(page, normalizedUrl, visitedUrls);
                            continue;
                        }
                    }
                    // Wait for dynamic inventory container / React / Algolia / LVRP to render vehicle cards
                    try {
                        await page.waitForSelector('.result-wrap, [data-vehicle], .vehicle-card, .vehicle, .hit, .inventory-item, [data-vin], [data-vehicle-id], .vehicle-overview', { timeout: 12000 });
                    }
                    catch { }
                    await page.waitForTimeout(1500);
                    // Hydrate lazy-loaded vehicle cards across modern platforms (Dealer.com, CDK, Fox Dealer, etc. use IntersectionObserver)
                    await page.evaluate(async () => {
                        const distance = 800;
                        const getMaxScroll = () => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
                        let current = 0;
                        // Scroll down step-by-step so all virtualized / skeleton cards enter viewport and hydrate
                        while (current < getMaxScroll() && current < 25000) {
                            window.scrollBy(0, distance);
                            current += distance;
                            await new Promise((resolve) => setTimeout(resolve, 60));
                        }
                        await new Promise((resolve) => setTimeout(resolve, 200));
                        window.scrollTo(0, document.body.scrollHeight);
                        await new Promise((resolve) => setTimeout(resolve, 300));
                        window.scrollTo(0, 0);
                    }).catch(() => { });
                    await page.waitForTimeout(1200);
                    // Extract directly from Dealer.com DDC dataLayer if present on page
                    try {
                        const ddcVehicles = await page.evaluate(() => {
                            const vehicles = window.DDC?.dataLayer?.vehicles;
                            if (Array.isArray(vehicles) && vehicles.length > 0) {
                                return vehicles.map((v) => ({
                                    vin: v.vin,
                                    year: v.year || v.modelYear,
                                    make: v.make,
                                    model: v.model,
                                    trim: v.trim,
                                    stockNumber: v.stockNumber,
                                    inventoryType: v.inventoryType || v.newOrUsed || 'New',
                                    listPrice: v.pricing?.finalPrice ||
                                        v.pricing?.salePrice ||
                                        v.pricing?.askingPrice ||
                                        v.salePrice ||
                                        v.askingPrice ||
                                        v.internetPrice ||
                                        v.pricing?.msrp ||
                                        v.msrp,
                                    msrp: v.pricing?.msrp || v.msrp,
                                    mileage: v.odometer,
                                    vehicleUrl: v.link,
                                    imageUrl: Array.isArray(v.images) && v.images[0]?.uri ? v.images[0].uri : undefined
                                }));
                            }
                            return null;
                        });
                        if (ddcVehicles && ddcVehicles.length > 0) {
                            console.log(`[Playwright] Found ${ddcVehicles.length} vehicles in Dealer.com DDC dataLayer.`);
                            for (const dv of ddcVehicles) {
                                if (dv.vin && /^[A-HJ-NPR-Z0-9]{17}$/i.test(dv.vin)) {
                                    const rawListPrice = typeof dv.listPrice === 'string'
                                        ? parseFloat(dv.listPrice.replace(/[^0-9.]/g, ''))
                                        : typeof dv.listPrice === 'number'
                                            ? dv.listPrice
                                            : undefined;
                                    const cleanedListPrice = rawListPrice && rawListPrice >= 1000 ? rawListPrice : undefined;
                                    const rawMsrp = typeof dv.msrp === 'string'
                                        ? parseFloat(dv.msrp.replace(/[^0-9.]/g, ''))
                                        : typeof dv.msrp === 'number'
                                            ? dv.msrp
                                            : undefined;
                                    const cleanedMsrp = rawMsrp && rawMsrp >= 1000 ? rawMsrp : undefined;
                                    const fullUrl = dv.vehicleUrl
                                        ? dv.vehicleUrl.startsWith('http')
                                            ? dv.vehicleUrl
                                            : new URL(dv.vehicleUrl, normalizedUrl).href
                                        : normalizedUrl;
                                    interceptedApiListings.push({
                                        vin: dv.vin.toUpperCase(),
                                        year: Number(dv.year) || new Date().getFullYear(),
                                        make: dv.make || '',
                                        model: dv.model || '',
                                        trim: dv.trim || undefined,
                                        stockNumber: dv.stockNumber || undefined,
                                        inventoryType: dv.inventoryType
                                            ? dv.inventoryType.toLowerCase().includes('used')
                                                ? 'Used'
                                                : 'New'
                                            : 'New',
                                        listPrice: (cleanedListPrice && !isNaN(cleanedListPrice) ? cleanedListPrice : cleanedMsrp) || 0,
                                        msrp: cleanedMsrp && !isNaN(cleanedMsrp) ? cleanedMsrp : undefined,
                                        mileage: typeof dv.mileage === 'number' ? dv.mileage : undefined,
                                        vehicleUrl: fullUrl,
                                        imageUrl: dv.imageUrl,
                                        dealerId: options.dealerId,
                                        dealerName: options.dealerName || 'Unknown Dealer',
                                        extractionSource: 'html_srp',
                                        discoveredAt: new Date().toISOString()
                                    });
                                }
                            }
                        }
                    }
                    catch { }
                    // Dismiss any obvious cookie / newsletter / chat modals if they appear
                    await this.dismissPopups(page);
                    // Get full rendered HTML
                    const rawHtml = await page.content();
                    // Check for Access Denied / WAF blocking
                    const pageTitle = await page.title().catch(() => '');
                    if (pageTitle.includes('Access Denied') ||
                        rawHtml.includes('errors.edgesuite.net') ||
                        rawHtml.includes('<h1>Access Denied</h1>') ||
                        rawHtml.includes('Reference #18.')) {
                        console.warn(`[Playwright] Access Denied / WAF block detected on page ${pageCount} (${normalizedUrl}). Halting pagination.`);
                        break;
                    }
                    // 1. Clean HTML and extract specials images
                    const { cleanedHtml, specialsImages } = htmlSnapshotService_1.HtmlSnapshotService.cleanHtmlForAi(rawHtml);
                    // Associate pageUrl with specials images
                    specialsImages.forEach((img) => (img.pageUrl = normalizedUrl));
                    allSpecialsImages.push(...specialsImages);
                    // 2. Save clean HTML to disk for N8N + AI
                    if (options.saveHtmlFiles !== false) {
                        const savedPath = await htmlSnapshotService_1.HtmlSnapshotService.savePageHtml(options.dealerId, pageCount, cleanedHtml, options.htmlStorageDir);
                        htmlFiles.push(savedPath);
                    }
                    // 3. Extract listings using BOTH embedded JSON-LD, rendered HTML cards, and intercepted APIs
                    let extractedThisPage = 0;
                    if (options.extractStaticListings !== false) {
                        const { cleanHtml } = await Promise.resolve().then(() => __importStar(require('./htmlCleaner')));
                        const cleaned = cleanHtml(rawHtml);
                        const jsonLdListings = listingExtractor_1.ListingExtractor.extractFromJsonLd(cleaned.jsonLdObjects, normalizedUrl, options.dealerId, options.dealerName);
                        const htmlListings = listingExtractor_1.ListingExtractor.extractFromHtml(rawHtml, normalizedUrl, options.dealerId, options.dealerName);
                        const combined = [...jsonLdListings, ...htmlListings, ...interceptedApiListings];
                        interceptedApiListings.length = 0; // drain captured
                        extractedThisPage = combined.length;
                        let newVinsFoundThisPage = 0;
                        for (const item of combined) {
                            if (!crawledVinsSet.has(item.vin)) {
                                crawledVinsSet.add(item.vin);
                                newVinsFoundThisPage++;
                            }
                        }
                        staticListings.push(...combined);
                        // If a subsequent page yields 0 new listings or 0 new unique VINs:
                        // Softened guard: requires 2 consecutive zero-yield pages before bailing out,
                        // preventing premature exit on large inventories (e.g. George Chevy) due to temporary DOM pagination lag.
                        if (pageCount > 1 && (combined.length === 0 || newVinsFoundThisPage === 0)) {
                            consecutiveZeroNewVinPages++;
                            console.log(`[Playwright] Page ${pageCount} yielded 0 new unique vehicles (extracted: ${combined.length}, new VINs: ${newVinsFoundThisPage}, strike: ${consecutiveZeroNewVinPages}/2).`);
                            if (consecutiveZeroNewVinPages >= 2) {
                                console.log(`[Playwright] 2 consecutive pages yielded 0 new vehicles. Ending pagination.`);
                                break;
                            }
                        }
                        else {
                            consecutiveZeroNewVinPages = 0;
                        }
                    }
                    // 4. Find next page and navigate (In-Page click for SPAs / Dealer.com, fallback to URL goto)
                    const nextNav = await this.navigateToNextPage(page, normalizedUrl, visitedUrls, pageCount);
                    if (nextNav) {
                        currentUrl = nextNav.nextUrl;
                        alreadyLoadedInBrowser = nextNav.navigatedViaClick;
                        if (!alreadyLoadedInBrowser) {
                            await page.waitForTimeout(2000);
                        }
                    }
                    else {
                        console.log(`[Playwright] No next page found. Reached end of pagination.`);
                        break;
                    }
                }
                catch (pageErr) {
                    console.warn(`[Playwright] Error on page ${pageCount} (${normalizedUrl}):`, pageErr.message);
                    break;
                }
            }
        }
        finally {
            await page.close();
            await this.close();
        }
        const deduplicatedListings = listingExtractor_1.ListingExtractor.deduplicate(staticListings);
        // Build manifest for N8N
        const manifest = {
            dealerId: options.dealerId,
            dealerName: options.dealerName || options.dealerId,
            targetUrl: options.startUrl,
            crawledAt: new Date().toISOString(),
            totalPages: pageCount,
            engineUsed: 'playwright',
            mode: options.extractStaticListings && deduplicatedListings.length > 0 ? 'static' : 'ai-html',
            htmlFiles,
            specialsImages: allSpecialsImages,
            status: 'ready_for_n8n_ai',
            totalListingsExtracted: deduplicatedListings.length
        };
        if (options.saveHtmlFiles !== false) {
            await htmlSnapshotService_1.HtmlSnapshotService.saveManifest(manifest, options.htmlStorageDir);
        }
        return {
            manifest,
            listings: deduplicatedListings,
            specialsImages: allSpecialsImages
        };
    }
    async dismissPopups(page) {
        const dismissSelectors = [
            'button[aria-label="Close"]',
            'button.close',
            '.modal-close',
            '.dialog-close',
            '#onetrust-accept-btn-handler',
            '.cookie-accept'
        ];
        for (const sel of dismissSelectors) {
            try {
                const el = page.locator(sel).first();
                if (await el.isVisible({ timeout: 400 })) {
                    await el.click({ timeout: 500 });
                }
            }
            catch {
                // Ignore
            }
        }
    }
    async navigateToNextPage(page, currentUrl, visitedUrls, pageCount) {
        const pageUrl = page.url();
        // Check if next button is explicitly disabled in the DOM
        try {
            const hasDisabledNext = await page
                .locator('li.pagination-next.disabled, .pagination-next.disabled, li.next.disabled, .disabled a[aria-label*="next" i], [aria-disabled="true"][aria-label*="next" i]')
                .first()
                .isVisible({ timeout: 200 })
                .catch(() => false);
            if (hasDisabledNext) {
                console.log(`[Playwright] Reached last page (disabled Next button detected in DOM).`);
                return null;
            }
        }
        catch { }
        // 1. Selector list for next button / link
        const nextSelectors = [
            'li.pagination-next:not(.disabled) a',
            '.pagination-next:not(.disabled) a',
            'a[aria-label*="Go to next page" i]',
            'a[aria-label*="Next Page" i]',
            'a[aria-label*="Next" i]',
            'a[rel="next"]',
            '.pagination-arrow.pagination-next a',
            'a.go-to-page:has-text("Next")',
            'a[href*="_p="]:has-text("Next")',
            'a.pagination-next',
            'li.next:not(.disabled) a',
            'a.next',
            'ul.pagination li.active + li a',
            'a:has-text("Next ›")',
            'a:has-text("Next >")',
            'a:has-text("Next »")',
            'a:has-text("Next")'
        ];
        for (const sel of nextSelectors) {
            try {
                const el = page.locator(sel).first();
                if ((await el.count()) > 0) {
                    const href = await el.getAttribute('href');
                    const resolved = href && !href.startsWith('javascript:') && !href.startsWith('#')
                        ? new URL(href, pageUrl).toString()
                        : null;
                    if (resolved && (visitedUrls.has(resolved) || resolved === currentUrl))
                        continue;
                    // Attempt in-page SPA click navigation first to preserve session & avoid cold reload rate-limits
                    try {
                        await el.scrollIntoViewIfNeeded({ timeout: 1500 });
                        await el.click({ timeout: 2500 });
                        await page.waitForTimeout(2000);
                        const afterUrl = page.url();
                        const targetUrl = resolved || afterUrl;
                        if (targetUrl && !visitedUrls.has(targetUrl)) {
                            return { nextUrl: targetUrl, navigatedViaClick: true };
                        }
                    }
                    catch {
                        // Click failed or threw; fall back to URL navigation
                        if (resolved && !visitedUrls.has(resolved) && resolved !== currentUrl) {
                            return { nextUrl: resolved, navigatedViaClick: false };
                        }
                    }
                }
            }
            catch { }
        }
        // 2. Next numbered page (e.g. page 2, page 3, etc. for Dealer.com & custom pagination)
        try {
            const nextNum = pageCount + 1;
            const numLink = page
                .locator(`a[href*="start="]:has-text("${nextNum}"), ul.pagination a:has-text("${nextNum}"), .pagination a:has-text("${nextNum}")`)
                .first();
            if ((await numLink.count()) > 0) {
                const href = await numLink.getAttribute('href');
                const resolved = href && !href.startsWith('javascript:') && !href.startsWith('#')
                    ? new URL(href, pageUrl).toString()
                    : null;
                if (resolved && !visitedUrls.has(resolved)) {
                    try {
                        await numLink.scrollIntoViewIfNeeded({ timeout: 1500 });
                        await numLink.click({ timeout: 2500 });
                        await page.waitForTimeout(2000);
                        return { nextUrl: resolved, navigatedViaClick: true };
                    }
                    catch {
                        return { nextUrl: resolved, navigatedViaClick: false };
                    }
                }
            }
        }
        catch { }
        // 3. Fallback: <link rel="next"> tag
        try {
            const linkNext = await page.locator('link[rel="next"]').first().getAttribute('href');
            if (linkNext && !linkNext.startsWith('javascript:') && !linkNext.startsWith('#')) {
                const resolved = new URL(linkNext, pageUrl).toString();
                if (!visitedUrls.has(resolved) && resolved !== currentUrl && resolved !== pageUrl) {
                    return { nextUrl: resolved, navigatedViaClick: false };
                }
            }
        }
        catch { }
        return null;
    }
    async findNextPage(page, currentUrl, visitedUrls) {
        const res = await this.navigateToNextPage(page, currentUrl, visitedUrls, 0);
        return res ? res.nextUrl : null;
    }
}
exports.PlaywrightCrawler = PlaywrightCrawler;
