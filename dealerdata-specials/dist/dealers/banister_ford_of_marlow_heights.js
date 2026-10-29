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
exports.BanisterFordOfMarlowHeightsScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
class BanisterFordOfMarlowHeightsScraper {
    id = 'banister_ford_of_marlow_heights';
    name = 'Banister Ford of Marlow Heights';
    domain = 'banisterfordofmarlowheights.com';
    specialsUrls = [
        'https://www.banisterfordofmarlowheights.com/new-vehicles/?flags.type=Special'
    ];
    async scrape(ctx) {
        const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
        const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        let html = ctx.html || '';
        // 1. If HTML wasn't already loaded or provided in context, attempt fast render via ZenRows API
        if (!html) {
            const apiKey = process.env.ZENROWS_API_KEY || '6ecae7778b309ecac79a32c25bc77b94a86c07a3';
            logger.log(`Fetching ${dealerName} via ZenRows API (js_render=true, wait_for=.dv-offers-top-banner-new-srp)...`);
            try {
                const zenrowsUrl = `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(targetUrl)}&js_render=true&wait_for=${encodeURIComponent('.dv-offers-top-banner-new-srp')}`;
                const resp = await axios_1.default.get(zenrowsUrl, { timeout: 45000 });
                if (resp.data && typeof resp.data === 'string' && resp.data.includes('dv-offers-top-banner-new-srp')) {
                    html = resp.data;
                }
            }
            catch (zenErr) {
                logger.warn(`ZenRows fetch notice: ${zenErr.message}`);
            }
        }
        // 2. If still no HTML and browser page context exists, wait for top banner carousel in Playwright
        if (!html && ctx.page) {
            try {
                logger.log(`Waiting for top banner carousel to hydrate in Playwright...`);
                await ctx.page.waitForSelector('.dv-offers-top-banner-new-srp, .dv-offers-top-banner-new-srp-wrapper', {
                    timeout: 20000
                });
                await ctx.page.waitForTimeout(1000);
                html = await ctx.page.content();
            }
            catch (waitErr) {
                logger.warn(`Browser DOM wait notice: ${waitErr.message}`);
            }
        }
        if (!html && !ctx.page) {
            logger.log(`Browser context required for DOM extraction. Delegating to Playwright...`);
            return { htmlSpecials: [], visualSpecials: [] };
        }
        if (!html) {
            logger.warn(`Could not retrieve rendered HTML for ${dealerName}.`);
            return { htmlSpecials: [], visualSpecials: [] };
        }
        const $ = (cheerio.load || cheerio.default?.load)(html);
        const visualSpecials = [];
        const seenImageUrls = new Set();
        const today = new Date().toISOString().split('T')[0];
        // Target the top promotional banner carousel slides
        // Strictly ignoring inventory vehicle cards (.listing[data-vehicle-vin]) below the carousel
        const slides = $('.dv-offers-top-banner-new-srp:not(.slick-cloned)');
        logger.log(`Processing ${slides.length} promotional flyer banner slide(s)...`);
        slides.each((i, el) => {
            const slide = $(el);
            // A. Extract Legal Disclaimer & Financing Terms
            const disclaimerBtn = slide.find('.dv-offers-banner-disclaimer-btn');
            const disclaimer = (disclaimerBtn.attr('data-disclaimer') || '').trim();
            // B. Extract Desktop Link and Offer Title
            const desktopLink = slide.find('a.dv-offers-top-banner-new-srp-desktop');
            let title = (desktopLink.find('.dv-offers-offer-title-hidden').first().text() ||
                desktopLink.attr('title') ||
                '')
                .replace(/\|\s*Banister Ford.*$/i, '')
                .trim();
            if (!title) {
                title = `${dealerName} Special #${i + 1}`;
            }
            // C. Extract High-Resolution Creative Flyer Image
            const img = desktopLink.find('img').first();
            let rawImg = img.attr('src') || img.attr('data-src') || '';
            if (!rawImg) {
                const mobileImg = slide.find('a.dv-offers-top-banner-new-srp-mobile img').first();
                rawImg = mobileImg.attr('src') || mobileImg.attr('data-src') || '';
            }
            if (!rawImg)
                return;
            // Strip query parameters to retain high-res graphical flyer asset
            let cleanImageUrl = rawImg.replace(/\?auto=compress.*$/i, '');
            if (cleanImageUrl.startsWith('//')) {
                cleanImageUrl = `https:${cleanImageUrl}`;
            }
            else if (cleanImageUrl.startsWith('/')) {
                cleanImageUrl = `https://${domain}${cleanImageUrl}`;
            }
            if (seenImageUrls.has(cleanImageUrl))
                return;
            seenImageUrls.add(cleanImageUrl);
            // D. Extract Destination Link
            let destUrl = desktopLink.attr('href') || targetUrl;
            if (destUrl && !destUrl.startsWith('http')) {
                try {
                    destUrl = new URL(destUrl, targetUrl).href;
                }
                catch { }
            }
            // E. Extract VIN or Stock from disclaimer if specified
            const vinMatch = disclaimer.match(/VIN:\s*([A-HJ-NPR-Z0-9]{17})/i);
            const vin = vinMatch ? vinMatch[1].toUpperCase() : '';
            const stkMatch = disclaimer.match(/STOCK#:\s*([A-Z0-9]+)/i);
            const stock = stkMatch ? stkMatch[1] : '';
            const rawText = [
                `Offer Title: ${title}`,
                vin ? `VIN: ${vin}` : '',
                stock ? `Stock: ${stock}` : '',
                disclaimer ? `Disclaimer: ${disclaimer}` : '',
                `Flyer Image: ${cleanImageUrl}`
            ].filter(Boolean).join('\n---\n');
            const assetBase = path_1.default.basename(cleanImageUrl).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
            const promoId = assetBase || `slide_${i + 1}`;
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
                    vin,
                    stock,
                    platform: 'dealeralchemist_top_banner'
                }),
                status: 'pending',
                rawText,
                imageHash,
                imageUrl: cleanImageUrl,
                domain,
                pageUrl: targetUrl
            });
        });
        // NOTE: Inventory cards (.listing[data-vehicle-vin]) on the page are strictly excluded.
        // As per user specification, we do not extract inventory specials for any dealership.
        logger.log(`Extracted ${visualSpecials.length} visual marketing campaign flyers from ${dealerName} (Strictly 0 inventory specials).`);
        return { htmlSpecials: [], visualSpecials };
    }
}
exports.BanisterFordOfMarlowHeightsScraper = BanisterFordOfMarlowHeightsScraper;
