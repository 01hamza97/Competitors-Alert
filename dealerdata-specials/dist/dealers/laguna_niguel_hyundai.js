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
exports.LagunaNiguelHyundaiScraper = void 0;
const crypto_1 = __importDefault(require("crypto"));
class LagunaNiguelHyundaiScraper {
    id = 'laguna_niguel_hyundai';
    name = 'Laguna Niguel Hyundai';
    domain = 'lagunaniguelhyundai.com';
    specialsUrls = [
        'https://www.lagunaniguelhyundai.com/new-vehicles/new-specials/'
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
        // 2. Wait for specials card container and scroll page to trigger lazy loading of images
        try {
            await page.waitForSelector('.special-offer, li[id^="offer-"], .card-content', { timeout: 12000 }).catch(() => { });
            // Scroll progressively down the page to hydrate all lazy-loaded DealerInspire cards & images
            await page.evaluate(async () => {
                const distance = 400;
                const delay = 150;
                const totalHeight = document.body.scrollHeight;
                let currentPosition = 0;
                while (currentPosition < totalHeight) {
                    window.scrollBy(0, distance);
                    currentPosition += distance;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            });
            await page.waitForTimeout(1000);
        }
        catch (scrollErr) {
            logger.warn(`Notice while hydrating DOM/images: ${scrollErr.message}`);
        }
        // 3. Extract loaded DOM with Cheerio
        const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        const hydratedHtml = await page.content();
        const $ = cheerio.load(hydratedHtml);
        const visualSpecials = [];
        const seenOfferIds = new Set();
        const today = new Date().toISOString().split('T')[0];
        // Target DealerInspire special-offer cards
        const cards = $('.special-offer.card, li[id^="offer-"]');
        logger.log(`Processing ${cards.length} promotional cards found in DOM...`);
        cards.each((i, el) => {
            const card = $(el);
            const offerId = card.attr('id') || `offer_${Date.now()}_${i}`;
            if (seenOfferIds.has(offerId))
                return;
            seenOfferIds.add(offerId);
            // A. Extract Titles and Headings
            const h2Text = card.find('.offer-content h2, h2').text().trim();
            const lightboxBtn = card.find('.specialOfferFormCTA');
            const lightboxTitle = (lightboxBtn.attr('data-lightbox-title') || '').trim();
            const title = h2Text || lightboxTitle || `${dealerName} Special #${i + 1}`;
            // B. Filter Out Generic Marketing Banners (e.g. Manager's Specials, Service, Parts, Collision)
            const isGenericMarketing = /manager'?s?\s*specials?|service\s*special|parts?\s*special|oil\s*change|tire|brake|battery|collision|career|why\s*buy|contact\s*us|schedule\s*service|community|meet\s*our\s*team/i.test(title);
            // C. Extract Flyer Image and Alt Text
            const img = card.find('a.offer-image-link img, img').first();
            let imgSrc = img.attr('data-src') ||
                img.attr('src') ||
                img.attr('data-lazy-src') ||
                '';
            if (imgSrc && !imgSrc.startsWith('http')) {
                try {
                    imgSrc = new URL(imgSrc, targetUrl).href;
                }
                catch { }
            }
            const imgAlt = (img.attr('alt') || '').trim();
            // D. Extract Description / Fine Print
            const desc = card.find('.offer-description, .description, .disclaimer, small').text().trim();
            // E. Extract Vehicle Data Attribute (from CTA button if available)
            let vehicleAttrText = '';
            const vehicleAttr = lightboxBtn.attr('data-vehicle');
            if (vehicleAttr) {
                try {
                    const v = JSON.parse(vehicleAttr);
                    if (v.model_year || v.model || v.trim) {
                        vehicleAttrText = `Vehicle Info: ${v.model_year || ''} ${v.make || 'Hyundai'} ${v.model || ''} ${v.trim || ''}`.trim();
                    }
                }
                catch { }
            }
            // Combine rich text elements into rawText for LLM extraction
            const textParts = [
                title,
                imgAlt && imgAlt !== title ? `Flyer Banner: ${imgAlt}` : '',
                desc ? `Terms & Details: ${desc}` : '',
                vehicleAttrText,
                lightboxTitle && lightboxTitle !== title && lightboxTitle !== imgAlt ? `Offer: ${lightboxTitle}` : ''
            ].filter(Boolean);
            const rawText = textParts.join('\n---\n');
            // Verify card contains vehicle model or pricing signals
            const hasVehicleSignal = /\b(hyundai|elantra|sonata|tucson|santa fe|palisade|ioniq|kona|venue|santa cruz)\b/i.test(rawText);
            const hasPricingSignal = /\b(lease|purchase|apr|financing|per month|\/mo|\$|discount|savings|bonus cash|cash back|payments?)\b/i.test(rawText);
            if (isGenericMarketing && !hasPricingSignal) {
                logger.log(`Skipping non-vehicle / generic marketing banner: "${title}"`);
                return;
            }
            if (!hasVehicleSignal && !hasPricingSignal) {
                logger.log(`Skipping card without vehicle/pricing signal: "${title}"`);
                return;
            }
            // F. Extract CTA / Click Link
            let ctaLink = card.find('a.primary-button').attr('href') ||
                card.find('a.offer-image-link').attr('href') ||
                targetUrl;
            if (ctaLink && !ctaLink.startsWith('http')) {
                try {
                    ctaLink = new URL(ctaLink, targetUrl).href;
                }
                catch { }
            }
            // Stable hash
            const hashSource = `${dealerId}_${offerId}_${title}_${imgSrc}`;
            const imageHash = crypto_1.default.createHash('sha256').update(hashSource).digest('hex');
            visualSpecials.push({
                id: `stg_${dealerId}_${offerId}`,
                dealerId,
                offerDealerName: dealerName,
                clientDealerName: dealerName,
                snapshotDate: today,
                specialType: 'vehicle_text',
                title: title.slice(0, 190),
                details: JSON.stringify({
                    imageUrl: imgSrc,
                    destinationUrl: ctaLink,
                    pageUrl: targetUrl,
                    offerId,
                    platform: 'dealerinspire'
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
exports.LagunaNiguelHyundaiScraper = LagunaNiguelHyundaiScraper;
