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
exports.WorldOfFordAlexandriaScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class WorldOfFordAlexandriaScraper {
    id = 'world_of_ford_alexandria';
    name = 'World Of Ford Alexandria';
    domain = 'worldoffordalexandria.com';
    specialsUrls = [
        'https://www.worldoffordalexandria.com/'
    ];
    async scrape(ctx) {
        const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
        const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        let html = ctx.html || '';
        // 1. If HTML wasn't already loaded or provided in context, attempt fast render via ZenRows API
        if (!html) {
            const apiKey = process.env.ZENROWS_API_KEY;
            if (apiKey) {
                logger.log(`Fetching ${dealerName} via ZenRows API (js_render=true, wait_for=.promo[data-promo-id])...`);
                try {
                    const zenrowsUrl = `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(targetUrl)}&js_render=true&wait_for=${encodeURIComponent('.promo[data-promo-id]')}`;
                    const resp = await axios_1.default.get(zenrowsUrl, { timeout: 45000 });
                    if (resp.data && typeof resp.data === 'string' && resp.data.includes('promo')) {
                        html = resp.data;
                    }
                }
                catch (zenErr) {
                    logger.warn(`ZenRows fetch notice: ${zenErr.message}`);
                }
            }
        }
        // 2. If HTML is missing or does not contain promo cards, wait for specials widget in Playwright
        if ((!html || !html.includes('data-promo-id')) && ctx.page) {
            try {
                await ctx.page.waitForSelector('#specials1-app-root .slick-slide, #specials2-app-root .slick-slide, .promo[data-promo-id], .promo-type-vehicle', { timeout: 15000 });
                await ctx.page.waitForTimeout(1000);
                html = await ctx.page.content();
            }
            catch (waitErr) {
                logger.warn(`Browser DOM wait notice: ${waitErr.message}`);
            }
        }
        // 3. If no HTML could be obtained directly or it lacks promo cards, delegate to Playwright runner
        if ((!html || !html.includes('data-promo-id')) && !ctx.page) {
            logger.log(`Browser context required for DOM extraction. Delegating to Playwright...`);
            return { htmlSpecials: [], visualSpecials: [] };
        }
        if (!html) {
            logger.warn(`Could not retrieve rendered HTML for ${dealerName}.`);
            return { htmlSpecials: [], visualSpecials: [] };
        }
        const $ = (cheerio.load || cheerio.default?.load)(html);
        const visualSpecials = [];
        const seenPromoIds = new Set();
        const today = new Date().toISOString().split('T')[0];
        // Target promo cards strictly within ws-specials carousel widgets
        const promoCards = $('.promo:not(.wsm-specials-display), [data-promo-id]:not(.wsm-specials-display)');
        logger.log(`Processing ${promoCards.length} promo elements found in DOM...`);
        promoCards.each((i, el) => {
            const card = $(el);
            // Skip inner display wrappers or cloned slides if already processed
            if (card.hasClass('wsm-specials-display') || card.parent().closest('.promo').length > 0)
                return;
            const promoId = card.attr('data-promo-id') || card.attr('id') || `wfa_${Date.now()}_${i}`;
            if (seenPromoIds.has(promoId))
                return;
            seenPromoIds.add(promoId);
            // We strictly require custom-asset vehicle marketing flyers.
            // Individual inventory specials / markdown text cards are NEVER extracted.
            const isCustomAsset = card.hasClass('custom-asset');
            const isPromoVehicle = card.hasClass('promo-type-vehicle');
            if (!isPromoVehicle || !isCustomAsset) {
                // Skip non-vehicle branding/events (e.g. JDP Award, MLB, Lifetime Edge) and inventory cards
                return;
            }
            // A. Extract Title & Text Elements
            const dataTitle = (card.attr('data-title') || '').trim();
            const srOnlyText = card.find('.sr-only').text().trim();
            const title = dataTitle || srOnlyText.split('.')[0] || `${dealerName} Special #${i + 1}`;
            // B. Filter Out Non-Vehicle Events or General Dealership Marketing
            const isExcludedPromo = /\b(jdp brand award|mlb run the dirt|run the dirt|lifetime edge|service guarantee|we'll buy your car|buy your car|certified pre-owned|why buy|about us|value your trade|schedule service|career|meet our team)\b/i.test(title) ||
                card.hasClass('promo-type-event');
            if (isExcludedPromo) {
                logger.log(`Skipping branding/event promo: "${title}"`);
                return;
            }
            // C. Extract High-Resolution Flyer Creative Image URL
            const img = card.find('img').first();
            let rawImgUrl = img.attr('data-image-url') ||
                img.attr('src') ||
                img.attr('data-src') ||
                '';
            if (!rawImgUrl)
                return;
            let cleanImageUrl = rawImgUrl;
            if (cleanImageUrl.startsWith('//')) {
                cleanImageUrl = `https:${cleanImageUrl}`;
            }
            else if (cleanImageUrl.startsWith('/')) {
                cleanImageUrl = `https://${domain}${cleanImageUrl}`;
            }
            // Remove downsize parameter to retain high-res creative flyer
            cleanImageUrl = cleanImageUrl.replace(/\?impolicy=.*$/i, '');
            // Strictly ensure this is a graphical marketing flyer creative
            const hasFlyerImage = isCustomAsset ||
                /dbcreative/i.test(cleanImageUrl) ||
                /pictures\.dealer\.com\/f\/forddirect/i.test(cleanImageUrl);
            if (!hasFlyerImage) {
                logger.log(`Skipping standard inventory listing card without flyer creative: "${title}"`);
                return;
            }
            // D. Verify Vehicle & Financing Signal
            const ldJson = card.find('script[type="application/ld+json"]').text().trim();
            const disclaimer = card.find('.details-and-disclaimer-button, .disclaimer, small, p.terms').text().trim();
            const textParts = [
                `Offer Title: ${title}`,
                srOnlyText ? `Offer Details: ${srOnlyText}` : '',
                ldJson ? `Schema: ${ldJson}` : '',
                disclaimer ? `Disclaimer: ${disclaimer}` : '',
                `Flyer Image: ${cleanImageUrl}`
            ].filter(Boolean);
            const rawText = textParts.join('\n---\n');
            const hasVehicleSignal = /\b(ford|f-150|f-250|f-350|f-450|explorer|bronco|mustang|ranger|maverick|expedition|escape|edge|transit)\b/i.test(rawText) &&
                /\b(lease|purchase|apr|\/mo|per month|\$|discount|savings|bonus cash|cash back|financing)\b/i.test(rawText);
            if (!hasVehicleSignal) {
                logger.log(`Skipping promo without vehicle financing signal: "${title}"`);
                return;
            }
            // E. Destination Link
            let destUrl = card.attr('data-url-href') ||
                card.find('a[href*="promotionId"], a').attr('href') ||
                targetUrl;
            if (destUrl && !destUrl.startsWith('http')) {
                try {
                    destUrl = new URL(destUrl, targetUrl).href;
                }
                catch { }
            }
            const hashSource = `${dealerId}_${promoId}_${title}_${cleanImageUrl}`;
            const imageHash = crypto_1.default.createHash('sha256').update(hashSource).digest('hex');
            visualSpecials.push({
                id: `stg_${dealerId}_flyer_${promoId}`,
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
                    promoId,
                    platform: 'dealercom_custom_asset_flyer'
                }),
                status: 'pending',
                rawText,
                imageHash,
                imageUrl: cleanImageUrl,
                domain,
                pageUrl: targetUrl
            });
        });
        logger.log(`Extracted ${visualSpecials.length} marketing campaign flyers from ${dealerName} (Strictly 0 inventory specials).`);
        return { htmlSpecials: [], visualSpecials };
    }
}
exports.WorldOfFordAlexandriaScraper = WorldOfFordAlexandriaScraper;
