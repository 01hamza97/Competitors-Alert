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
exports.PrinceFrederickFordScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class PrinceFrederickFordScraper {
    id = 'prince_frederick_ford';
    name = 'Prince Frederick Ford';
    domain = 'princefrederickford.com';
    specialsUrls = [
        'https://www.princefrederickford.com/'
    ];
    async scrape(ctx) {
        const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
        const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        let html = ctx.html || '';
        // 1. Directly fetch RetailReady / StreamCompanies top carousel API
        let retailReadyHtml = '';
        try {
            const rrResp = await axios_1.default.post('https://api-incentives.retailready.ai/api/carousel?v2&columns=3', {}, {
                headers: {
                    'Authorization': 'Bearer 363c6dbe12ac26669512a3d9f7aef0ee34323133',
                    'Referer': 'https://www.princefrederickford.com/',
                    'Origin': 'https://www.princefrederickford.com',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-ch-ua-mobile': '?0'
                },
                timeout: 10000
            });
            if (rrResp.data && rrResp.data.status === 'valid' && rrResp.data.content) {
                retailReadyHtml = rrResp.data.content;
                logger.log(`Directly fetched RetailReady top carousel API (${retailReadyHtml.length} bytes).`);
            }
        }
        catch (rrErr) {
            logger.warn(`RetailReady carousel direct API notice: ${rrErr.message}`);
        }
        // 2. If browser page context exists and top carousel is missing, wait for it to hydrate in Playwright
        if (ctx.page && (!html || !html.includes('sb-slide'))) {
            try {
                await ctx.page.waitForSelector('.sb-slide, .sb-slider-container, #carousel-Main', { timeout: 12000 }).catch(() => { });
                await ctx.page.waitForTimeout(1000);
                html = await ctx.page.content();
            }
            catch (waitErr) {
                logger.warn(`Browser DOM wait notice: ${waitErr.message}`);
            }
        }
        // 3. If HTML wasn't already loaded, attempt direct HTTP GET for DealerOn static carousel
        if (!html) {
            try {
                logger.log(`Attempting direct HTTP fetch for ${dealerName}...`);
                const resp = await axios_1.default.get(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    },
                    timeout: 20000
                });
                html = resp.data;
            }
            catch (httpErr) {
                logger.warn(`Direct fetch notice: ${httpErr.message}`);
            }
        }
        // 4. Fallback to ZenRows API only if process.env.ZENROWS_API_KEY is configured
        if (!html && process.env.ZENROWS_API_KEY) {
            const waitSelector = targetUrl.includes('newspecial') ? '.disc-blue-wrap' : '.sb-slide';
            logger.log(`Fetching ${dealerName} via ZenRows API (js_render=true, wait_for=${waitSelector})...`);
            try {
                const zenrowsUrl = `https://api.zenrows.com/v1/?apikey=${process.env.ZENROWS_API_KEY}&url=${encodeURIComponent(targetUrl)}&js_render=true&wait_for=${encodeURIComponent(waitSelector)}`;
                const resp = await axios_1.default.get(zenrowsUrl, { timeout: 45000 });
                if (resp.data && typeof resp.data === 'string' && (resp.data.includes('sb-slide') || resp.data.includes('disc-blue-wrap') || resp.data.includes('carousel-Main'))) {
                    html = resp.data;
                }
            }
            catch (zenErr) {
                logger.warn(`ZenRows fetch notice: ${zenErr.message}`);
            }
        }
        if (!html && !ctx.page && !retailReadyHtml) {
            logger.log(`Browser context required for DOM extraction. Delegating to Playwright...`);
            return { htmlSpecials: [], visualSpecials: [] };
        }
        // Append RetailReady carousel content if not already present in the HTML DOM
        if (retailReadyHtml && (!html || !html.includes('sb-slide'))) {
            html = (html || '') + '\n' + retailReadyHtml;
        }
        if (!html) {
            logger.warn(`Could not retrieve rendered HTML for ${dealerName}.`);
            return { htmlSpecials: [], visualSpecials: [] };
        }
        const $ = (cheerio.load || cheerio.default?.load)(html);
        const visualSpecials = [];
        const seenIds = new Set();
        const today = new Date().toISOString().split('T')[0];
        // ==========================================
        // SECTION 1: Top StreamCompanies / RetailReady Visual Campaign Banners (.sb-slide / .disc-blue-wrap)
        // ==========================================
        const streamBanners = $('.sb-slide, .disc-blue-wrap');
        logger.log(`Processing ${streamBanners.length} top stream disclaimer offer element(s)...`);
        streamBanners.each((i, el) => {
            const banner = $(el);
            const disclaimerId = banner.attr('data-disclaimer-id') ||
                banner.find('[data-disclaimer-id]').attr('data-disclaimer-id') ||
                `disc_${i + 1}`;
            if (seenIds.has(disclaimerId))
                return;
            seenIds.add(disclaimerId);
            const img = banner.find('img').first();
            let rawImg = (img.attr('src') || img.attr('data-src') || '').replace(/&amp;/g, '&');
            let alt = (img.attr('alt') || '').trim();
            const a = banner.find('a').first();
            let destUrl = a.attr('href') || targetUrl;
            if (destUrl && !destUrl.startsWith('http')) {
                try {
                    destUrl = new URL(destUrl, targetUrl).href;
                }
                catch { }
            }
            let title = alt;
            let disclaimer = '';
            let vin = '';
            let apr = '';
            let cleanImageUrl = rawImg;
            // Case A: StreamCompanies Scene7 dynamically rendered flyer (found in #sb-slider on homepage)
            if (rawImg.includes('scene7.com')) {
                try {
                    const urlObj = new URL(rawImg);
                    disclaimer = urlObj.searchParams.get('$DISCLAIMER') || '';
                    vin = urlObj.searchParams.get('$VehicleVIN') || '';
                    apr = urlObj.searchParams.get('$apr') || '';
                    const vehicle = (urlObj.searchParams.get('$VEHICLE') || '').replace(/_/g, ' ');
                    if (vehicle && (!title || title.length < 5))
                        title = vehicle;
                }
                catch { }
            }
            // Case B: RetailReady HTML structure (found in .disc-blue-wrap on specials page)
            if (banner.hasClass('disc-blue-wrap')) {
                const headerTitle = banner.find('.disc-body header').text().replace(/\s+/g, ' ').trim();
                if (headerTitle)
                    title = headerTitle;
                const numbersText = banner.find('.disc-numbers').text().replace(/\s+/g, ' ').trim();
                const vinMatch = numbersText.match(/VIN\s+([A-HJ-NPR-Z0-9]{17})/i);
                if (vinMatch)
                    vin = vinMatch[1].toUpperCase();
                const dText = banner.find('footer .disc-disc').text().replace(/\s+/g, ' ').trim();
                if (dText)
                    disclaimer = dText;
                const heroImg = banner.find('.hero-img img').attr('src') || banner.find('.disc-bg').attr('src');
                if (heroImg)
                    cleanImageUrl = heroImg;
            }
            if (!title)
                title = `${dealerName} Special #${i + 1}`;
            if (!cleanImageUrl)
                return;
            const rawText = [
                `Offer Title: ${title}`,
                vin ? `VIN: ${vin}` : '',
                apr ? `APR Financing: ${apr}` : '',
                disclaimer ? `Disclaimer: ${disclaimer}` : '',
                `Flyer Image: ${cleanImageUrl}`
            ].filter(Boolean).join('\n---\n');
            const hashSource = `${dealerId}_${disclaimerId}_${title}_${cleanImageUrl}`;
            const imageHash = crypto_1.default.createHash('sha256').update(hashSource).digest('hex');
            visualSpecials.push({
                id: `stg_${dealerId}_stream_${disclaimerId}`,
                dealerId,
                offerDealerName: dealerName,
                clientDealerName: dealerName,
                snapshotDate: today,
                specialType: 'vehicle_flyer', // Staged exclusively for n8n Vision AI
                title: title.slice(0, 190),
                details: JSON.stringify({
                    imageUrl: cleanImageUrl,
                    destinationUrl: destUrl,
                    pageUrl: targetUrl,
                    disclaimerId,
                    vin,
                    apr,
                    platform: 'retailready_stream_banner'
                }),
                status: 'pending',
                rawText,
                imageHash,
                imageUrl: cleanImageUrl,
                domain,
                pageUrl: targetUrl
            });
        });
        // ==========================================
        // SECTION 2: Homepage DealerOn Hero Carousel Banners (#carousel-Main)
        // ==========================================
        const heroSlides = $('#carousel-Main .carousel-inner > .item, .carousel-inner > .item.banner-slide');
        logger.log(`Processing ${heroSlides.length} DealerOn hero carousel item(s)...`);
        heroSlides.each((i, el) => {
            const item = $(el);
            // Skip mobile duplicates (.hideOnDesktop) to select high-res desktop banners
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
            // Skip non-vehicle service/parts links (e.g. Sunbit, tire/service coupons)
            if (/service-parts|sunbit|buy-now-pay-later|collision/i.test(destUrl)) {
                return;
            }
            const img = item.find('img').first();
            let imgSrc = img.attr('src') || img.attr('data-src') || '';
            if (!imgSrc) {
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
            // Skip service/sunbit asset names
            if (/Auto_Web_|sunbit/i.test(assetName) || /sunbit/i.test(alt)) {
                return;
            }
            // Extract popover disclaimer if present on button
            const disclaimerBtn = item.find('button.banner-disclaimer-btn, button[data-content]');
            const rawDisclaimerHtml = disclaimerBtn.attr('data-content') || '';
            let disclaimerText = '';
            if (rawDisclaimerHtml) {
                const $disc = (cheerio.load || cheerio.default?.load)(rawDisclaimerHtml);
                disclaimerText = $disc('.banner-disclaimer-content__text, p').text().replace(/\s+/g, ' ').trim();
            }
            let title = alt;
            if (!title || title.length < 3) {
                title = assetName
                    .replace(/^Prince_Frederick_Ford_/i, '')
                    .replace(/_Desktop_1920x600_.*$/i, '')
                    .replace(/[-_.]/g, ' ')
                    .trim();
            }
            title = `${dealerName} - ${title || `Promotional Offer #${i + 1}`}`;
            const promoKey = `hero_${assetId}_${assetName}`;
            if (seenIds.has(promoKey))
                return;
            seenIds.add(promoKey);
            const rawText = [
                `Offer Title: ${title}`,
                assetExpire ? `Expiration: ${assetExpire}` : '',
                disclaimerText ? `Disclaimer: ${disclaimerText}` : '',
                `Flyer Image: ${imgSrc}`
            ].filter(Boolean).join('\n---\n');
            const hashSource = `${dealerId}_${promoKey}_${title}_${imgSrc}`;
            const imageHash = crypto_1.default.createHash('sha256').update(hashSource).digest('hex');
            visualSpecials.push({
                id: `stg_${dealerId}_hero_${assetId}`,
                dealerId,
                offerDealerName: dealerName,
                clientDealerName: dealerName,
                snapshotDate: today,
                specialType: 'vehicle_flyer', // Staged exclusively for n8n Vision AI
                title: title.slice(0, 190),
                details: JSON.stringify({
                    imageUrl: imgSrc,
                    destinationUrl: destUrl,
                    pageUrl: targetUrl,
                    assetId,
                    assetName,
                    assetExpire,
                    platform: 'dealeron_hero_carousel'
                }),
                status: 'pending',
                rawText,
                imageHash,
                imageUrl: imgSrc,
                domain,
                pageUrl: targetUrl
            });
        });
        // NOTE: Inventory coupon cards (.card__coupon) are strictly excluded.
        // As per user specification, we do not extract inventory specials for any dealership.
        logger.log(`Extracted ${visualSpecials.length} visual marketing campaign flyers from ${dealerName} (Strictly 0 inventory specials).`);
        return { htmlSpecials: [], visualSpecials };
    }
}
exports.PrinceFrederickFordScraper = PrinceFrederickFordScraper;
