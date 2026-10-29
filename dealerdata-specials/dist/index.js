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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeSpecials = scrapeSpecials;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const url_1 = require("url");
const browser_1 = require("./core/browser");
const db_1 = require("./core/db");
const storage_1 = require("./core/storage");
const registry_1 = require("./dealers/registry");
async function scrapeSpecials(options) {
    const startTime = Date.now();
    const storage = new storage_1.StorageManager(process.env.STORAGE_DIR || 'crawled_specials');
    const browser = new browser_1.BrowserManager();
    // 1. Resolve dedicated dealer scraper
    const scraper = registry_1.DealerRegistry.getScraper(options.dealerId, options.targetUrl);
    const dealerId = options.dealerId || scraper.id;
    const dealerName = options.dealerName || scraper.name;
    console.log(`======================================================`);
    console.log(`🎯 DEALERDATA SPECIALS SCRAPER`);
    console.log(`   Dealer ID:    ${dealerId}`);
    console.log(`   Store Name:   ${dealerName}`);
    console.log(`   Scraper Mod:  ${scraper.constructor.name}`);
    console.log(`======================================================\n`);
    // 2. Determine target URLs
    const urlsToScrape = [];
    if (options.targetUrl) {
        urlsToScrape.push(options.targetUrl);
    }
    else if (scraper.specialsUrls && scraper.specialsUrls.length > 0) {
        urlsToScrape.push(...scraper.specialsUrls);
    }
    else {
        throw new Error(`No specials URLs configured for dealer: ${dealerId}. Please pass --url=...`);
    }
    const allHtmlSpecials = [];
    const allVisualSpecials = [];
    const errors = [];
    let primaryDomain = '';
    let browserInitialized = false;
    try {
        for (const url of urlsToScrape) {
            console.log(`\n🔍 [Specials] Processing specials for: ${url}`);
            try {
                const domain = new url_1.URL(url).hostname.replace(/^www\./, '');
                if (!primaryDomain)
                    primaryDomain = domain;
                const ctx = {
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
                // 1. Try scraper directly (fast API or lightweight HTTP)
                let result = await scraper.scrape(ctx).catch((err) => {
                    console.warn(`   ⚠️ [${scraper.id}] Direct scrape notice: ${err.message}`);
                    return { htmlSpecials: [], visualSpecials: [] };
                });
                // 2. If direct extraction found no specials, fall back to headless browser
                if (result.htmlSpecials.length === 0 && result.visualSpecials.length === 0) {
                    if (!browserInitialized) {
                        const proxyToUse = scraper.useDirectConnection
                            ? 'direct'
                            : (options.proxyUrl || process.env.SCRAPER_PROXY_URL);
                        await browser.init({
                            proxyUrl: proxyToUse,
                            headless: options.headless
                        });
                        browserInitialized = true;
                    }
                    const { page, html } = await browser.fetchPage(url);
                    const $ = cheerio.load(html);
                    ctx.page = page;
                    ctx.$ = $;
                    ctx.html = html;
                    result = await scraper.scrape(ctx);
                    await page.close().catch(() => { });
                }
                allHtmlSpecials.push(...result.htmlSpecials);
                allVisualSpecials.push(...result.visualSpecials);
            }
            catch (pageErr) {
                console.error(`❌ [Specials] Error scraping ${url}:`, pageErr.message);
                errors.push(`${url}: ${pageErr.message}`);
            }
        }
    }
    finally {
        if (browserInitialized) {
            await browser.close();
        }
    }
    // 3. Generate N8N Vision AI Manifest
    let manifestPath;
    if (allVisualSpecials.length > 0) {
        manifestPath = storage.generateManifest(dealerId, dealerName, urlsToScrape[0] || '', allVisualSpecials);
    }
    // 4. Sync to MySQL Database
    const shouldSaveToDb = options.saveToDb !== false && process.env.SAVE_TO_DB !== 'false';
    if (shouldSaveToDb) {
        if (allHtmlSpecials.length > 0) {
            await db_1.DatabaseManager.syncVehicleSpecials(allHtmlSpecials, dealerId, dealerName);
        }
        if (allVisualSpecials.length > 0) {
            await db_1.DatabaseManager.syncSpecialsStaging(allVisualSpecials, dealerId, dealerName);
            if (process.env.N8N_WEBHOOK_URL) {
                try {
                    console.log(`[N8N] Notifying N8N webhook of ${allVisualSpecials.length} staged visual specials...`);
                    await axios_1.default.post(process.env.N8N_WEBHOOK_URL, {
                        event: 'specials_staged',
                        dealerId,
                        dealerName,
                        count: allVisualSpecials.length,
                        manifestPath,
                        timestamp: new Date().toISOString()
                    }, { timeout: 10000 });
                    console.log(`[N8N] Webhook notification delivered.`);
                }
                catch (webhookErr) {
                    console.warn(`[N8N] Webhook notification notice: ${webhookErr.message}`);
                }
            }
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
__exportStar(require("./types"), exports);
__exportStar(require("./dealers/registry"), exports);
__exportStar(require("./dealers/types"), exports);
