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
const crypto_1 = __importDefault(require("crypto"));
class BanisterFordOfMarlowHeightsScraper {
    id = 'banister_ford_of_marlow_heights';
    name = 'Banister Ford of Marlow Heights';
    domain = 'banisterfordofmarlowheights.com';
    specialsUrls = [
        'https://www.banisterfordofmarlowheights.com/new-vehicles/?flags.type=Special'
    ];
    async scrape(ctx) {
        const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
        // 1. If no browser page provided yet, return empty so index.ts boots Playwright and passes page
        if (!ctx.page) {
            logger.log(`Browser context required for DOM extraction. Delegating to Playwright...`);
            return { htmlSpecials: [], visualSpecials: [] };
        }
        const page = ctx.page;
        logger.log(`Executing DOM specials extraction for ${dealerName} (${dealerId})...`);
        // 2. Wait for Algolia Hits to render and scroll to trigger lazy loading of vehicle images
        try {
            await page.waitForSelector('.ais-Hits-item, .listing[data-vehicle-vin]', { timeout: 15000 }).catch(() => { });
            await page.waitForTimeout(1500);
            // Progressive scroll down to ensure all Algolia cards and DealerLink photos hydrate
            await page.evaluate(async () => {
                const distance = 500;
                const delay = 120;
                const totalHeight = document.body.scrollHeight;
                let currentPosition = 0;
                while (currentPosition < totalHeight) {
                    window.scrollBy(0, distance);
                    currentPosition += distance;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            });
            await page.waitForTimeout(800);
        }
        catch (scrollErr) {
            logger.warn(`Notice while hydrating DOM/images: ${scrollErr.message}`);
        }
        // 3. Extract loaded DOM with Cheerio
        const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        const hydratedHtml = await page.content();
        const $ = cheerio.load(hydratedHtml);
        const visualSpecials = [];
        const seenVins = new Set();
        const today = new Date().toISOString().split('T')[0];
        // Target Algolia listing cards with vehicle data attributes
        const cards = $('.ais-Hits-item .listing, .listing[data-vehicle-vin]');
        logger.log(`Processing ${cards.length} promotional vehicle cards found in DOM...`);
        cards.each((i, el) => {
            const card = $(el);
            const vin = card.attr('data-vehicle-vin') || `vin_${Date.now()}_${i}`;
            if (seenVins.has(vin))
                return;
            seenVins.add(vin);
            // A. Extract Structured Metadata Attributes
            const year = card.attr('data-vehicle-year') || '';
            const make = card.attr('data-ag-make') || card.attr('data-vehicle-make-model')?.split(' ')[0] || 'Ford';
            const model = card.attr('data-ag-model') || '';
            const trim = card.attr('data-ag-trim') || '';
            const stock = card.attr('data-vehicle-stock-number') || '';
            const agPrice = card.attr('data-ag-price') || '';
            const vdpPath = card.attr('data-ag-vdp-url') || card.find('a[href*="/vehicle/"]').attr('href') || '';
            const carTitleHeader = card.find('h2.car-title').text().replace(/\s+/g, ' ').trim();
            const title = `${year} ${make} ${model} ${trim}`.trim() || carTitleHeader || `${dealerName} Special #${i + 1}`;
            // B. Extract Pricing Breakdown
            let msrp = '';
            let docFee = '';
            let incentives = '';
            let dealerDiscount = '';
            let salePrice = '';
            card.find('.dv-pricing-main').each((_, pEl) => {
                const text = $(pEl).text().replace(/\s+/g, ' ').trim();
                const strongVal = $(pEl).find('.dv-pricing-stack-strong, .dv-pricing-stack-value-default').last().text().trim();
                if (/MSRP/i.test(text))
                    msrp = strongVal;
                else if (/Doc Fee/i.test(text))
                    docFee = strongVal;
                else if (/Incentives/i.test(text))
                    incentives = strongVal;
                else if (/Discount/i.test(text))
                    dealerDiscount = strongVal;
                else if (/Sale Price|Our Price/i.test(text))
                    salePrice = strongVal;
            });
            if (!salePrice && agPrice) {
                salePrice = `$${Number(agPrice).toLocaleString()}`;
            }
            // Extract itemized conditional/rebate details if present
            const itemizedRebates = [];
            card.find('.ag-incentive-line-item').each((_, rEl) => {
                const rTitle = $(rEl).find('.ag-incentive-title').text().replace(/\s+/g, ' ').trim();
                const rVal = $(rEl).find('.ag-incentive-value').text().replace(/\s+/g, ' ').trim();
                if (rTitle && rVal)
                    itemizedRebates.push(`${rTitle}: ${rVal}`);
            });
            // C. Extract Vehicle Inventory Image
            const img = card.find('.vehicle-views img, img.srp-click-image').first();
            let imgSrc = img.attr('src') || img.attr('data-src') || '';
            if (imgSrc && !imgSrc.startsWith('http')) {
                try {
                    imgSrc = new URL(imgSrc, targetUrl).href;
                }
                catch { }
            }
            // D. Full Destination Link
            let destUrl = vdpPath || targetUrl;
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
                docFee ? `Doc Fee: ${docFee}` : '',
                incentives ? `Incentives: ${incentives}` : '',
                itemizedRebates.length > 0 ? `Rebates Breakdown: ${itemizedRebates.join(' | ')}` : '',
                dealerDiscount ? `Dealer Discount: ${dealerDiscount}` : '',
                salePrice ? `Final Sale Price: ${salePrice}` : '',
                `Vehicle URL: ${destUrl}`
            ].filter(Boolean);
            const rawText = textParts.join('\n---\n');
            // Stable hash
            const hashSource = `${dealerId}_${vin}_${title}_${imgSrc}`;
            const imageHash = crypto_1.default.createHash('sha256').update(hashSource).digest('hex');
            visualSpecials.push({
                id: `stg_${dealerId}_${vin}`,
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
                    vin,
                    stockNumber: stock,
                    msrp,
                    salePrice,
                    platform: 'algolia_dealer_inspire'
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
exports.BanisterFordOfMarlowHeightsScraper = BanisterFordOfMarlowHeightsScraper;
