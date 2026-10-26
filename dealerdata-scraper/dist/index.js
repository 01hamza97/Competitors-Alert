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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeDealership = scrapeDealership;
const url_1 = require("url");
const platformDetector_1 = require("./services/platformDetector");
const sitemapDiscovery_1 = require("./services/sitemapDiscovery");
const crawler_1 = require("./services/crawler");
const listingExtractor_1 = require("./services/listingExtractor");
const dbSync_1 = require("./services/dbSync");
const playwrightCrawler_1 = require("./services/playwrightCrawler");
__exportStar(require("./types"), exports);
__exportStar(require("./services/platformDetector"), exports);
__exportStar(require("./services/sitemapDiscovery"), exports);
__exportStar(require("./services/htmlCleaner"), exports);
__exportStar(require("./services/listingExtractor"), exports);
__exportStar(require("./services/crawler"), exports);
__exportStar(require("./services/dbSync"), exports);
__exportStar(require("./services/htmlSnapshotService"), exports);
__exportStar(require("./services/playwrightCrawler"), exports);
__exportStar(require("./services/specialsExtractor"), exports);
/**
 * Master Scraping Pipeline (Cascading Multi-Stage Funnel):
 *
 * 1. FUNNEL STAGE 1: Sitemap Discovery & XML Crawl
 *    Probes robots.txt and XML sitemaps. Discovers and crawls vehicle VDPs.
 *
 * 2. FUNNEL STAGE 2: Direct Platform API & Native Feeds
 *    Queries native automotive REST endpoints (CarsCommerce, DealerInspire, Dealer.com, CDK).
 *
 * 3. FUNNEL STAGE 3: Direct Target URL Search Results Page (SRP) Crawl
 *    Fetches target inventory URL, extracts JSON-LD (ItemList/Vehicle) + HTML cards, follows pagination.
 *
 * 4. FUNNEL STAGE 4: Headless Browser / Playwright Automation
 *    Renders dynamic client-side DOM, executes JavaScript, bypasses bot challenges, captures clean snapshots.
 */
async function scrapeDealership(options) {
    const startTime = Date.now();
    const parsedUrl = new url_1.URL(options.targetUrl);
    const domain = parsedUrl.origin;
    const inventoryType = options.inventoryType || 'New';
    const dealerId = options.dealerId || 'default_dealer';
    const dealerName = options.dealerName || parsedUrl.hostname;
    const mode = options.mode || 'auto';
    const isUnlimited = options.maxPages === 0 || options.maxPages === -1 || options.maxPages === undefined;
    console.log(`\n======================================================`);
    console.log(`🎯 DEALERDATA SCRAPER MULTI-STAGE FUNNEL`);
    console.log(`   Target Store: ${dealerName} (${dealerId})`);
    console.log(`   Target URL:   ${options.targetUrl}`);
    console.log(`   Scrape Mode:  ${mode.toUpperCase()}`);
    console.log(`   Inventory:    ${inventoryType} | Depth: ${isUnlimited ? 'Unlimited (All Pages)' : `${options.maxPages} pages`}`);
    console.log(`======================================================\n`);
    let listings = [];
    const sitemapFallbackListings = [];
    let specialsImages = [];
    let apiAccessUsed = false;
    let sitemapUsed = false;
    let funnelStageUsed = 'none';
    let pagesCrawled = 0;
    let manifestFile;
    // -------------------------------------------------------------------------
    // SPECIALS-ONLY MODE: Specials extraction is disabled from the main inventory scraper
    // -------------------------------------------------------------------------
    if (options.specialsOnly) {
        console.log(`\n⚡ [SPECIALS DISABLED] Specials extraction has been removed from scraper.`);
        return {
            targetUrl: options.targetUrl,
            domain,
            platform: 'unknown',
            mode,
            totalListingsFound: 0,
            newListingsCount: 0,
            usedListingsCount: 0,
            apiAccessUsed: false,
            sitemapUsed: false,
            funnelStageUsed: 'none',
            funnelSummary: 'Specials extraction disabled',
            pagesCrawled: 0,
            durationSeconds: 0,
            listings: [],
            specialsImages: [],
            htmlSpecialsCount: 0,
            visualSpecialsCount: 0,
            htmlSpecials: [],
            visualSpecials: [],
        };
    }
    const isDirectInventoryUrl = /inventory|all-inventory|new-vehicles|used-vehicles|searchnew|searchused|searchall/i.test(options.targetUrl);
    const shouldTrySitemapFirst = options.useSitemapFirst === true || (!isDirectInventoryUrl && options.useSitemapFirst !== false);
    // -------------------------------------------------------------------------
    // FUNNEL STAGE 1: Direct Platform API & Native Feeds
    // -------------------------------------------------------------------------
    let detectedPlatform = 'unknown';
    if (mode !== 'ai-html' && listings.length === 0 && options.tryDirectApi !== false) {
        console.log(`\n⚡ [Funnel Step 1/4: Direct API & Native Feeds]`);
        console.log(`   Checking known JSON API feeds & provider endpoints for ${domain}...`);
        try {
            detectedPlatform = await platformDetector_1.PlatformDetector.detectPlatform(options.targetUrl || domain, options.proxyUrl);
            console.log(`   [Platform] Detected Provider: ${detectedPlatform.toUpperCase()}`);
            if (detectedPlatform !== 'dealercom') {
                const apiResult = await platformDetector_1.PlatformDetector.checkDirectApi(domain, dealerId, options.maxPages, options.proxyUrl);
                if (apiResult.hasDirectApi && apiResult.listings.length > 0) {
                    console.log(`✨ [Funnel Step 1: Direct API] SUCCESS: Extracted ${apiResult.listings.length} listings from ${apiResult.endpoint}`);
                    listings.push(...apiResult.listings);
                    apiAccessUsed = true;
                    funnelStageUsed = 'direct_api';
                    pagesCrawled = 1;
                }
            }
        }
        catch (apiErr) {
            console.warn(`   [Funnel Step 1: Direct API] Notice: ${apiErr.message}`);
        }
        if (listings.length === 0) {
            console.log(`⚠️  [Funnel Step 1: Direct API] Direct API not available or empty.`);
            console.log(`   Advancing down funnel to Step 2 (Sitemap Discovery)...`);
        }
    }
    // -------------------------------------------------------------------------
    // FUNNEL STAGE 2: Sitemap Discovery & XML Crawling (when applicable)
    // -------------------------------------------------------------------------
    if (mode !== 'ai-html' && listings.length === 0 && shouldTrySitemapFirst) {
        console.log(`\n🔍 [Funnel Step 2/4: Sitemap Discovery]`);
        console.log(`   Probing ${domain} for robots.txt & XML inventory sitemaps...`);
        try {
            const sitemaps = await sitemapDiscovery_1.SitemapDiscovery.discoverInventorySitemaps(domain, options.proxyUrl);
            if (sitemaps.length > 0) {
                console.log(`   Discovered ${sitemaps.length} candidate sitemap(s). Searching for vehicle inventory URLs...`);
                for (const sitemapUrl of sitemaps) {
                    const maxUrlScan = isUnlimited ? 1000 : Math.max(100, (options.maxPages || 10) * 50);
                    const vehicleUrls = await sitemapDiscovery_1.SitemapDiscovery.parseVehicleUrlsFromSitemap(sitemapUrl, maxUrlScan, 0, 3, options.proxyUrl);
                    if (vehicleUrls.length > 0) {
                        console.log(`   Discovered ${vehicleUrls.length} vehicle inventory URLs from: ${sitemapUrl}`);
                        const crawler = new crawler_1.WebsiteCrawler({ proxyUrl: options.proxyUrl });
                        const vdpLimit = isUnlimited ? 500 : Math.min(vehicleUrls.length, (options.maxPages || 10) * 30);
                        const vdpListings = await crawler.crawlUrls(vehicleUrls, dealerId, dealerName, vdpLimit, 5);
                        // Check if listings actually have prices; slug fallbacks with $0 are only a last-resort fallback
                        const pricedListings = vdpListings.filter((l) => (l.listPrice || 0) > 0);
                        if (pricedListings.length > 0) {
                            listings.push(...vdpListings);
                            sitemapUsed = true;
                            funnelStageUsed = 'sitemap';
                            pagesCrawled += Math.min(vehicleUrls.length, vdpLimit);
                            console.log(`✨ [Funnel Step 2: Sitemap] SUCCESS: Harvested ${vdpListings.length} vehicles with prices via sitemap crawl!`);
                            break;
                        }
                        else if (vdpListings.length > 0) {
                            console.log(`⚠️  [Funnel Step 2: Sitemap] Notice: Harvested ${vdpListings.length} URLs from sitemap, but 0 had real prices. Retaining as fallback and advancing to live SRP & Playwright...`);
                            if (sitemapFallbackListings.length === 0) {
                                sitemapFallbackListings.push(...vdpListings);
                            }
                        }
                    }
                }
            }
        }
        catch (sitemapErr) {
            console.warn(`   [Funnel Step 2: Sitemap] Notice: ${sitemapErr.message}`);
        }
        if (listings.length === 0) {
            console.log(`⚠️  [Funnel Step 2: Sitemap] No inventory sitemaps with pricing accessible.`);
            console.log(`   Advancing down funnel to Step 3 (Direct Target URL SRP Crawl)...`);
        }
    }
    // -------------------------------------------------------------------------
    // FUNNEL STAGE 3: Direct Target URL SRP & Pagination Crawl
    // -------------------------------------------------------------------------
    if (mode !== 'ai-html' && listings.length === 0) {
        console.log(`\n🌐 [Funnel Step 3/4: Direct Target URL SRP Crawl]`);
        console.log(`   Fetching target inventory URL directly: ${options.targetUrl}`);
        console.log(`   Crawling HTML search results & following pagination...`);
        try {
            const crawler = new crawler_1.WebsiteCrawler({ proxyUrl: options.proxyUrl });
            const crawled = await crawler.crawl({
                startUrl: options.targetUrl,
                dealerId,
                dealerName,
                maxPages: options.maxPages,
                inventoryType
            });
            if (crawled.length > 0) {
                const pricedCount = crawled.filter((l) => (l.listPrice || 0) > 0).length;
                if (pricedCount > 0) {
                    listings.push(...crawled);
                    funnelStageUsed = 'direct_srp';
                    pagesCrawled = crawled.length;
                    console.log(`✨ [Funnel Step 3: Direct SRP] SUCCESS: Extracted ${crawled.length} vehicles (${pricedCount} with valid prices) from paginated SRP!`);
                }
                else {
                    console.log(`⚠️  [Funnel Step 3: Direct SRP] Harvested ${crawled.length} listings from static SRP, but ALL prices are $0.`);
                    console.log(`   Rejecting all-$0 static crawl to force live rendering in Stage 4 (Headless Browser / Playwright)...`);
                    if (sitemapFallbackListings.length === 0) {
                        sitemapFallbackListings.push(...crawled);
                    }
                }
            }
        }
        catch (srpErr) {
            console.warn(`   [Funnel Step 3: Direct SRP] Notice: ${srpErr.message}`);
        }
        if (listings.length === 0) {
            console.log(`⚠️  [Funnel Step 3: Direct SRP] Static SRP crawl yielded 0 priced listings (blocked or dynamic JS required).`);
            // Fallback: If sitemap was not run in Step 2, run it now before launching Playwright
            if (!sitemapUsed && options.useSitemapFirst !== false && detectedPlatform !== 'dealercom') {
                console.log(`\n🔍 [Funnel Step 3.5: Sitemap Discovery Fallback]`);
                console.log(`   Direct SRP failed/blocked. Probing ${domain} for XML inventory sitemaps...`);
                try {
                    const sitemaps = await sitemapDiscovery_1.SitemapDiscovery.discoverInventorySitemaps(domain, options.proxyUrl);
                    if (sitemaps.length > 0) {
                        console.log(`   Discovered ${sitemaps.length} candidate sitemap(s). Searching for vehicle inventory URLs...`);
                        for (const sitemapUrl of sitemaps) {
                            const maxUrlScan = isUnlimited ? 1000 : Math.max(100, (options.maxPages || 10) * 50);
                            const vehicleUrls = await sitemapDiscovery_1.SitemapDiscovery.parseVehicleUrlsFromSitemap(sitemapUrl, maxUrlScan, 0, 3, options.proxyUrl);
                            if (vehicleUrls.length > 0) {
                                console.log(`   Discovered ${vehicleUrls.length} vehicle inventory URLs from: ${sitemapUrl}`);
                                const crawler = new crawler_1.WebsiteCrawler({ proxyUrl: options.proxyUrl });
                                const vdpLimit = isUnlimited ? 500 : Math.min(vehicleUrls.length, (options.maxPages || 10) * 30);
                                const vdpListings = await crawler.crawlUrls(vehicleUrls, dealerId, dealerName, vdpLimit, 5);
                                const pricedListings = vdpListings.filter((l) => (l.listPrice || 0) > 0);
                                if (pricedListings.length > 0) {
                                    listings.push(...vdpListings);
                                    sitemapUsed = true;
                                    funnelStageUsed = 'sitemap';
                                    pagesCrawled += Math.min(vehicleUrls.length, vdpLimit);
                                    console.log(`✨ [Funnel Step 3.5: Sitemap Fallback] SUCCESS: Harvested ${vdpListings.length} vehicles with prices via sitemap!`);
                                    break;
                                }
                                else if (vdpListings.length > 0 && sitemapFallbackListings.length === 0) {
                                    sitemapFallbackListings.push(...vdpListings);
                                }
                            }
                        }
                    }
                }
                catch (sitemapErr) {
                    console.warn(`   [Funnel Step 3.5: Sitemap Fallback] Notice: ${sitemapErr.message}`);
                }
            }
            if (listings.length === 0) {
                console.log(`   Advancing down funnel to Step 4 (Headless Browser / Playwright Automation)...`);
            }
        }
    }
    // -------------------------------------------------------------------------
    // FUNNEL STAGE 4: Playwright Headless Browser (Dynamic JS / SPA / AI Snapshots)
    // -------------------------------------------------------------------------
    if (mode === 'ai-html' || (mode === 'auto' && listings.length === 0)) {
        console.log(`\n📸 [Funnel Step 4/4: Headless Browser Engine (Playwright)]`);
        console.log(`   Launching browser to execute JavaScript, render dynamic DOM, and capture snapshots...`);
        const playwrightCrawler = new playwrightCrawler_1.PlaywrightCrawler();
        try {
            const crawlResult = await playwrightCrawler.crawl({
                startUrl: options.targetUrl,
                dealerId,
                dealerName,
                maxPages: options.maxPages,
                saveHtmlFiles: true,
                extractStaticListings: mode === 'auto',
                htmlStorageDir: options.htmlStorageDir,
                proxyUrl: options.proxyUrl
            });
            pagesCrawled = crawlResult.manifest.totalPages;
            specialsImages = crawlResult.specialsImages;
            if (crawlResult.listings.length > 0) {
                listings.push(...crawlResult.listings);
                funnelStageUsed = 'playwright_browser';
                console.log(`✨ [Funnel Step 4: Playwright] SUCCESS: Extracted ${crawlResult.listings.length} listings from rendered DOM!`);
            }
            manifestFile = `${options.htmlStorageDir || 'crawled_html'}/${dealerId}/${new Date().toISOString().split('T')[0]}/manifest.json`;
        }
        catch (pwErr) {
            console.error(`❌ [Funnel Step 4: Playwright] Error during browser crawl:`, pwErr.message);
        }
    }
    // If all live methods yielded 0 listings, fall back to sitemap/static slug listings as last resort
    if (listings.length === 0 && sitemapFallbackListings.length > 0) {
        console.log(`⚠️  [Funnel Fallback] Live methods yielded 0 listings. Falling back to ${sitemapFallbackListings.length} sitemap/static fallback listings...`);
        listings.push(...sitemapFallbackListings);
        funnelStageUsed = sitemapUsed ? 'sitemap' : 'direct_srp';
    }
    // -------------------------------------------------------------------------
    // STEP 5: Deduplicate by VIN & Filter for New Inventory
    // -------------------------------------------------------------------------
    const deduplicated = listingExtractor_1.ListingExtractor.deduplicate(listings);
    const finalListings = inventoryType === 'New'
        ? deduplicated.filter((item) => item.inventoryType === 'New')
        : deduplicated;
    const newListingsCount = finalListings.filter((i) => i.inventoryType === 'New').length;
    const usedListingsCount = finalListings.filter((i) => i.inventoryType !== 'New').length;
    // -------------------------------------------------------------------------
    // STEP 6: Save Output & Database Sync
    // -------------------------------------------------------------------------
    let outputFile;
    if (finalListings.length > 0) {
        outputFile = dbSync_1.DatabaseSync.saveToJsonFile(finalListings, parsedUrl.hostname, options.outputDir);
        if (options.saveToDb !== false) {
            const validPricedCount = finalListings.filter((i) => (i.listPrice || 0) > 0).length;
            if (validPricedCount === 0 && finalListings.length > 0) {
                console.warn(`⚠️  [DatabaseSync] REJECTING DB SYNC: 100% of ${finalListings.length} vehicles have $0 price (blocking or rate limiting occurred). Preserving existing database snapshot.`);
            }
            else {
                await dbSync_1.DatabaseSync.syncToDatabase(finalListings, dealerId);
            }
        }
    }
    // Specials extraction has been removed to keep the pipeline 100% focused on fast, reliable inventory crawling.
    const htmlSpecialsList = [];
    const visualSpecialsList = [];
    const durationSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
    const funnelSummary = `Resolved via: Stage ${funnelStageUsed.toUpperCase()} (${finalListings.length} vehicles in ${durationSeconds}s)`;
    console.log(`\n======================================================`);
    console.log(`🏁 FUNNEL PIPELINE COMPLETE for: ${dealerName}`);
    console.log(`   Funnel Stage Used: ${funnelStageUsed.toUpperCase()}`);
    console.log(`   Total Unique Listings: ${finalListings.length}`);
    console.log(`   New: ${newListingsCount} | Used: ${usedListingsCount}`);
    if (manifestFile)
        console.log(`   N8N AI Manifest: ${manifestFile}`);
    if (outputFile)
        console.log(`   Listings JSON: ${outputFile}`);
    console.log(`   Duration: ${durationSeconds}s`);
    console.log(`======================================================\n`);
    return {
        targetUrl: options.targetUrl,
        domain,
        platform: detectedPlatform,
        mode,
        totalListingsFound: finalListings.length,
        newListingsCount,
        usedListingsCount,
        apiAccessUsed,
        sitemapUsed,
        funnelStageUsed,
        funnelSummary,
        pagesCrawled,
        durationSeconds,
        outputFile,
        manifestFile,
        listings: finalListings,
        specialsImages,
        htmlSpecialsCount: htmlSpecialsList.length,
        visualSpecialsCount: visualSpecialsList.length,
        htmlSpecials: htmlSpecialsList,
        visualSpecials: visualSpecialsList
    };
}
