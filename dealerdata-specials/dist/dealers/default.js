"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultSpecialsScraper = void 0;
const parser_1 = require("../core/parser");
const storage_1 = require("../core/storage");
const EXCLUDE_IMAGE_PATTERNS = [
    'logo', 'icon', 'favicon', 'placeholder', 'adchoice', 'comply',
    'cookiebanner', 'tracking', 'analytics', 'pixel', 'badge', 'button',
    'arrow', '.svg', '1x1', 'spacer', 'blank', 'adchoices', 'complyauto',
    'gravatar', 'avatar', 'social', 'header', 'footer', 'nav', 'menu',
    'star', 'rating', 'chat', 'spinner', 'loading', 'loader'
];
class DefaultSpecialsScraper {
    id = 'default';
    name = 'Default Generic Dealer Scraper';
    domain = '*';
    specialsUrls = [];
    constructor(id, name, domain, urls) {
        if (id)
            this.id = id;
        if (name)
            this.name = name;
        if (domain)
            this.domain = domain;
        if (urls)
            this.specialsUrls = urls;
    }
    async scrape(ctx) {
        const { $, targetUrl, dealerId, dealerName, domain, logger } = ctx;
        const htmlSpecials = [];
        const visualSpecials = [];
        if (!$)
            return { htmlSpecials, visualSpecials };
        const storage = new storage_1.StorageManager();
        // 1. EXTRACT STRUCTURED HTML SPECIALS CARDS
        const cardSelectors = [
            '.promo-type-vehicle',
            '.special-card',
            '.offer-card',
            '.vehicle-special',
            '.wsm-specials',
            '.special-item',
            '.deal-item',
            '.specials-item',
            '.vehicle-offer',
            '[data-special-id]',
            '[data-offer-id]',
            '.promo-item'
        ];
        const processedCards = new Set();
        $(cardSelectors.join(', ')).each((_, el) => {
            const card = $(el);
            const cardText = card.text().replace(/\s+/g, ' ').trim();
            if (!cardText || cardText.length < 20)
                return;
            const title = card.find('h1, h2, h3, h4, .title, .vehicle-title, .offer-title, [class*="title"]')
                .first()
                .text()
                .trim() || cardText.slice(0, 80);
            const cardHash = storage_1.StorageManager.hashString(title + cardText.slice(0, 100));
            if (processedCards.has(cardHash))
                return;
            processedCards.add(cardHash);
            const monthlyPayment = parser_1.SpecialsParser.extractMonthlyPayment(cardText);
            const termMonths = parser_1.SpecialsParser.extractTermMonths(cardText);
            const downPayment = parser_1.SpecialsParser.extractDownPayment(cardText);
            const apr = parser_1.SpecialsParser.extractApr(cardText);
            const msrp = parser_1.SpecialsParser.extractMsrp(cardText);
            const expirationDate = parser_1.SpecialsParser.extractExpirationDate(cardText);
            const disclaimer = card.find('.disclaimer, .legal, [class*="disclaimer"], small').text().trim() || undefined;
            const vehicleInfo = parser_1.SpecialsParser.extractVehicleInfo(title);
            let specialType = 'lease';
            if (apr !== undefined && apr >= 0)
                specialType = 'apr';
            else if (/finance|purchas/i.test(cardText))
                specialType = 'finance';
            else if (/cash|rebate/i.test(cardText))
                specialType = 'cash';
            let imageUrl = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || undefined;
            if (imageUrl && !imageUrl.startsWith('http')) {
                try {
                    imageUrl = new URL(imageUrl, targetUrl).href;
                }
                catch { }
            }
            let specialUrl = card.find('a').first().attr('href') || targetUrl;
            if (specialUrl && !specialUrl.startsWith('http')) {
                try {
                    specialUrl = new URL(specialUrl, targetUrl).href;
                }
                catch { }
            }
            if (monthlyPayment || apr !== undefined || downPayment || msrp) {
                htmlSpecials.push({
                    dealerId,
                    offerDealerName: dealerName,
                    year: vehicleInfo.year,
                    make: vehicleInfo.make,
                    model: vehicleInfo.model,
                    trim: vehicleInfo.trim,
                    specialType,
                    monthlyPayment,
                    termMonths,
                    downPayment,
                    apr,
                    msrp,
                    title,
                    disclaimer,
                    expirationDate,
                    specialUrl,
                    imageUrl,
                    domain
                });
            }
        });
        logger.log(`Extracted ${htmlSpecials.length} structured HTML specials.`);
        // 2. EXTRACT PROMOTIONAL BANNER / FLYER IMAGES
        const imageSelectors = [
            'img[src*="special"]',
            'img[src*="offer"]',
            'img[src*="banner"]',
            'img[src*="flyer"]',
            'img[src*="promo"]',
            '.specials-banner img',
            '.special-offer img',
            '.promo-banner img',
            '.offers-grid img',
            '.specials-grid img',
            '.special-item img'
        ];
        const seenImageUrls = new Set();
        const imgElements = $(imageSelectors.join(', '));
        for (let i = 0; i < imgElements.length; i++) {
            const el = imgElements[i];
            const img = $(el);
            let src = img.attr('data-src') || img.attr('src') || img.attr('data-lazy-src') || '';
            if (!src || src.startsWith('data:image'))
                continue;
            if (!src.startsWith('http')) {
                try {
                    src = new URL(src, targetUrl).href;
                }
                catch {
                    continue;
                }
            }
            const lowerSrc = src.toLowerCase();
            const isExcluded = EXCLUDE_IMAGE_PATTERNS.some((p) => lowerSrc.includes(p));
            if (isExcluded)
                continue;
            if (seenImageUrls.has(src))
                continue;
            seenImageUrls.add(src);
            const alt = img.attr('alt') || img.attr('title') || 'Promotional Flyer';
            const downloaded = await storage.downloadImage(src, dealerId, targetUrl);
            if (downloaded) {
                visualSpecials.push({
                    dealerId,
                    offerDealerName: dealerName,
                    clientDealerName: dealerName,
                    specialType: 'vehicle',
                    title: alt,
                    details: src,
                    status: 'pending',
                    imageHash: downloaded.imageHash,
                    imageUrl: src,
                    localImagePath: downloaded.localPath,
                    domain,
                    pageUrl: targetUrl,
                    snapshotDate: new Date().toISOString().split('T')[0]
                });
            }
        }
        logger.log(`Extracted & downloaded ${visualSpecials.length} visual specials flyers for Vision AI.`);
        return { htmlSpecials, visualSpecials };
    }
}
exports.DefaultSpecialsScraper = DefaultSpecialsScraper;
