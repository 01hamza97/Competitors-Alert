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
exports.UpperMarlboroFordScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class UpperMarlboroFordScraper {
    id = 'upper_marlboro_ford';
    name = 'Upper Marlboro Ford';
    domain = 'uppermarlboroford.com';
    specialsUrls = [
        'https://www.uppermarlboroford.com/'
    ];
    async scrape(ctx) {
        const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
        const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        let html = ctx.html || '';
        // 1. Fast fetch homepage HTML directly via Axios if not provided
        if (!html) {
            logger.log(`Fetching ${dealerName} homepage directly...`);
            try {
                const resp = await axios_1.default.get(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    },
                    timeout: 25000
                });
                html = resp.data;
            }
            catch (reqErr) {
                logger.warn(`Direct fetch notice: ${reqErr.message}. Checking browser context...`);
            }
        }
        // 2. Fall back to Playwright page if direct request did not succeed
        if (!html && ctx.page) {
            try {
                await ctx.page.waitForSelector('#carousel-Main, .carousel-inner', { timeout: 15000 }).catch(() => { });
                html = await ctx.page.content();
            }
            catch (pErr) {
                logger.warn(`Browser DOM wait notice: ${pErr.message}`);
            }
        }
        if (!html) {
            logger.warn(`Could not retrieve HTML for ${dealerName}.`);
            return { htmlSpecials: [], visualSpecials: [] };
        }
        const $ = (cheerio.load || cheerio.default?.load)(html);
        const visualSpecials = [];
        const seenAssetIds = new Set();
        const today = new Date().toISOString().split('T')[0];
        // 3. Select homepage carousel slides
        const slides = $('#carousel-Main .carousel-inner > .item, .bannerWrapper .item.banner-slide');
        logger.log(`Found ${slides.length} raw carousel items on ${dealerName} homepage...`);
        slides.each((i, el) => {
            const item = $(el);
            // Skip mobile duplicates (.hideOnDesktop) to select high-res desktop banners (.hideOnMobile / standard)
            if (item.hasClass('hideOnDesktop'))
                return;
            const a = item.find('a').first();
            let destUrl = a.attr('href') || targetUrl;
            if (destUrl && !destUrl.startsWith('http')) {
                try {
                    destUrl = new URL(destUrl, targetUrl).href;
                }
                catch { }
            }
            const img = item.find('img').first();
            let imgSrc = img.attr('src') || img.attr('data-src') || '';
            if (!imgSrc) {
                // Check picture source tags
                const source = item.find('picture source[media*="min-width"]').first();
                imgSrc = source.attr('srcset') || '';
            }
            if (imgSrc && !imgSrc.startsWith('http')) {
                try {
                    imgSrc = new URL(imgSrc, targetUrl).href;
                }
                catch { }
            }
            if (!imgSrc)
                return;
            const alt = (img.attr('alt') || img.attr('title') || '').trim();
            const assetId = img.attr('data-assetid') || `slide_${i + 1}`;
            const assetName = img.attr('data-assetname') || '';
            const assetExpire = img.attr('data-asset-expire') || '';
            // Skip non-vehicle service, parts, or tire banners
            const isServiceOrParts = destUrl.includes('/service-appointment') ||
                destUrl.includes('/parts') ||
                /\b(real parts|tires?|rebate when you buy four select tires|service appointment|oil change|maintenance|mobile service)\b/i.test(alt) ||
                /\b(tire|service|parts)\b/i.test(assetName);
            if (isServiceOrParts) {
                logger.log(`Skipping service/parts slide #${i + 1}: "${alt}"`);
                return;
            }
            // Verify slide has vehicle, incentive, or inventory intent
            const hasVehicleSignal = /\b(0%|apr|payments?|lease|finance|conquest cash|off msrp|\$|save|discount|military|first responders?|transit|f-150|f-250|super duty|explorer|trucks?|inventory|award|warranty)\b/i.test(alt) ||
                /\b(0apr|nopay|military|sdtransit|truck|brandaward)\b/i.test(assetName) ||
                destUrl.includes('searchnew.aspx') ||
                destUrl.includes('dealeron.us');
            if (!hasVehicleSignal) {
                logger.log(`Skipping general slide #${i + 1}: "${alt}"`);
                return;
            }
            if (seenAssetIds.has(assetId))
                return;
            seenAssetIds.add(assetId);
            const title = alt || assetName.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' ') || `${dealerName} Special #${i + 1}`;
            const textParts = [
                `Offer Title: ${title}`,
                assetExpire ? `Offer Expires: ${assetExpire}` : '',
                `Asset Name: ${assetName}`,
                `Asset ID: ${assetId}`,
                `Promotion Link: ${destUrl}`,
                `Banner Type: Homepage Hero Promotional Flyer`
            ].filter(Boolean);
            const rawText = textParts.join('\n---\n');
            const hashSource = `${dealerId}_${assetId}_${title}_${imgSrc}`;
            const imageHash = crypto_1.default.createHash('sha256').update(hashSource).digest('hex');
            visualSpecials.push({
                id: `stg_${dealerId}_banner_${assetId}`,
                dealerId,
                offerDealerName: dealerName,
                clientDealerName: dealerName,
                snapshotDate: today,
                specialType: 'vehicle_flyer', // Staged for n8n Vision AI
                title: title.slice(0, 190),
                details: JSON.stringify({
                    assetId,
                    assetName,
                    title,
                    imageUrl: imgSrc,
                    destinationUrl: destUrl,
                    pageUrl: targetUrl,
                    assetExpire,
                    platform: 'dealeron_homepage_carousel'
                }),
                status: 'pending',
                rawText,
                imageHash,
                imageUrl: imgSrc,
                domain,
                pageUrl: targetUrl
            });
        });
        logger.log(`Extracted ${visualSpecials.length} marketing campaign flyers from ${dealerName} homepage.`);
        return { htmlSpecials: [], visualSpecials };
    }
}
exports.UpperMarlboroFordScraper = UpperMarlboroFordScraper;
