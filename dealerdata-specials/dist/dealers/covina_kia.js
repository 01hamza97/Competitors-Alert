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
exports.CovinaKiaScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class CovinaKiaScraper {
    id = 'covina_kia';
    name = 'Covina KIA';
    domain = 'covinakia.com';
    specialsUrls = [
        'https://www.covinakia.com/new-vehicle-special-offers/'
    ];
    async scrape(ctx) {
        const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
        const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        let html = ctx.html || '';
        // 1. If HTML wasn't already loaded or Cloudflare is detected, fetch via ZenRows API with js_render
        if (!html || html.includes('Attention Required! | Cloudflare') || html.includes('cf-browser-verification')) {
            const apiKey = process.env.ZENROWS_API_KEY || 'bf266ef611c316456f4784d9a50b3d92c4ed5eda';
            logger.log(`Fetching ${dealerName} via ZenRows API (js_render=true, wait_for=.disc-wave-wrap)...`);
            try {
                const zenrowsUrl = `https://api.zenrows.com/v1/?apikey=${apiKey}&url=${encodeURIComponent(targetUrl)}&js_render=true&wait_for=.disc-wave-wrap`;
                const resp = await axios_1.default.get(zenrowsUrl, { timeout: 45000 });
                html = resp.data;
            }
            catch (zenErr) {
                logger.warn(`ZenRows API notice: ${zenErr.message}`);
            }
        }
        // 2. If still no HTML and browser page is available, try waiting for .disc-wave-wrap in page
        if (!html && ctx.page) {
            try {
                await ctx.page.waitForSelector('.disc-wave-wrap, [data-disclaimer-id]', { timeout: 20000 });
                html = await ctx.page.content();
            }
            catch (pErr) {
                logger.warn(`Browser DOM wait notice: ${pErr.message}`);
            }
        }
        if (!html) {
            logger.warn(`Could not retrieve rendered HTML for ${dealerName}.`);
            return { htmlSpecials: [], visualSpecials: [] };
        }
        const $ = (cheerio.load || cheerio.default?.load)(html);
        const visualSpecials = [];
        const seenIds = new Set();
        const today = new Date().toISOString().split('T')[0];
        const cards = $('.disc-wave-wrap, [data-disclaimer-id]');
        logger.log(`Processing ${cards.length} disclaimer offer card(s) found in DOM...`);
        cards.each((i, el) => {
            const card = $(el);
            const disclaimerId = card.attr('data-disclaimer-id') || `covina_kia_${i + 1}`;
            if (seenIds.has(disclaimerId))
                return;
            seenIds.add(disclaimerId);
            // A. Extract Title
            const headline = card.find('.headline').text().trim();
            const subHeadline = card.find('.sub-headline').text().trim();
            const title = `${headline} ${subHeadline}`.replace(/\s+/g, ' ').trim() || `${dealerName} Special #${i + 1}`;
            // B. Extract Pricing & Offer Info
            const infoHeader = card.find('.disc-info-header').text().trim();
            const infoAmount = card.find('.disc-info-content').text().trim();
            const infoFooter = card.find('.disc-info-footer').text().trim();
            const offerHeadline = [infoHeader, infoAmount, infoFooter].filter(Boolean).join(' ');
            // C. Extract Legal Disclaimer
            const disclaimer = card.find('.disc-disc').text().replace(/\s+/g, ' ').trim();
            // D. Extract VIN, Stock, MSRP from disclaimer
            const vinMatch = disclaimer.match(/VIN\s+([A-HJ-NPR-Z0-9]{17})/i);
            const vin = vinMatch ? vinMatch[1].toUpperCase() : '';
            const stkMatch = disclaimer.match(/Stk#?\s*([A-Z0-9]+)/i);
            const stock = stkMatch ? stkMatch[1] : '';
            const msrpMatch = disclaimer.match(/MSRP\s+\$([0-9,]+)/i);
            const msrp = msrpMatch ? `$${msrpMatch[1]}` : '';
            const expiresMatch = disclaimer.match(/Expires\s+([0-9/]+)/i);
            const expires = expiresMatch ? expiresMatch[1] : '';
            // E. Extract Hero Image
            let imgSrc = '';
            const heroArea = card.find('.disc-hero-area').attr('style') || '';
            const bgMatch = heroArea.match(/url\(['"]?(https:\/\/[^)'"]+)['"]?\)/i);
            if (bgMatch) {
                imgSrc = bgMatch[1];
            }
            if (!imgSrc) {
                const img = card.find('img').first();
                imgSrc = img.attr('src') || '';
            }
            // F. Destination Shop Link
            let destUrl = card.find('a.disc-btn').attr('href') || targetUrl;
            if (destUrl && !destUrl.startsWith('http')) {
                try {
                    destUrl = new URL(destUrl, targetUrl).href;
                }
                catch { }
            }
            // Combine structured text parts for LLM extraction
            const textParts = [
                title,
                vin ? `VIN: ${vin}` : '',
                stock ? `Stock #: ${stock}` : '',
                msrp ? `MSRP: ${msrp}` : '',
                offerHeadline ? `Offer: ${offerHeadline}` : '',
                expires ? `Offer Expires: ${expires}` : '',
                disclaimer ? `Legal Disclaimer:\n${disclaimer}` : '',
                `Shop URL: ${destUrl}`
            ].filter(Boolean);
            const rawText = textParts.join('\n---\n');
            // Stable hash
            const hashSource = `${dealerId}_${disclaimerId}_${title}_${imgSrc}`;
            const imageHash = crypto_1.default.createHash('sha256').update(hashSource).digest('hex');
            visualSpecials.push({
                id: `stg_${dealerId}_${disclaimerId}`,
                dealerId,
                offerDealerName: dealerName,
                clientDealerName: dealerName,
                snapshotDate: today,
                specialType: 'vehicle_text',
                title: title.slice(0, 190),
                details: JSON.stringify({
                    imageUrl: imgSrc,
                    destinationUrl: destUrl,
                    pageUrl: targetUrl,
                    disclaimerId,
                    vin,
                    stockNumber: stock,
                    msrp,
                    offerHeadline,
                    expires,
                    platform: 'retailready_streamcompanies'
                }),
                status: 'pending',
                rawText,
                imageHash,
                imageUrl: imgSrc,
                domain,
                pageUrl: targetUrl
            });
        });
        logger.log(`Extracted ${visualSpecials.length} staged text-based specials ready for AI from ${dealerName}.`);
        return { htmlSpecials: [], visualSpecials };
    }
}
exports.CovinaKiaScraper = CovinaKiaScraper;
