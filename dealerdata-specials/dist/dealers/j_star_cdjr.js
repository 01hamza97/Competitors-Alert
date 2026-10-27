"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JStarCdjrScraper = void 0;
const parser_1 = require("../core/parser");
const storage_1 = require("../core/storage");
class JStarCdjrScraper {
    id = 'j_star_cdjr';
    name = 'J Star Chrysler Dodge Jeep Ram Fiat';
    domain = 'jstarcdjrofanaheimhills.com';
    specialsUrls = [
        'https://www.jstarcdjrofanaheimhills.com/specials/new/',
        'https://www.jstarcdjrofanaheimhills.com/specials/',
        'https://www.jstarcdjrofanaheimhills.com/special-offers/'
    ];
    async scrape(ctx) {
        const { $, targetUrl, dealerId, dealerName, domain, logger } = ctx;
        const htmlSpecials = [];
        const visualSpecials = [];
        const storage = new storage_1.StorageManager();
        logger.log(`[J Star CDJR] Running custom PixelMotion / WordPress specials extractor...`);
        // 1. PixelMotion & WordPress Custom Specials Cards
        const cardSelectors = [
            '.pm-special',
            '.special-item',
            '.pm-motors-special',
            '.vehicle-special',
            '.inventory-special-item',
            '.offer-card',
            '.wp-block-group'
        ];
        const seenCards = new Set();
        $(cardSelectors.join(', ')).each((_, el) => {
            const card = $(el);
            const text = card.text().replace(/\s+/g, ' ').trim();
            if (!text || text.length < 25)
                return;
            const title = card.find('h1, h2, h3, h4, .title, .special-title, [class*="title"]')
                .first()
                .text()
                .trim() || text.slice(0, 60);
            const hash = storage_1.StorageManager.hashString(title + text.slice(0, 50));
            if (seenCards.has(hash))
                return;
            seenCards.add(hash);
            const monthlyPayment = parser_1.SpecialsParser.extractMonthlyPayment(text);
            const termMonths = parser_1.SpecialsParser.extractTermMonths(text);
            const downPayment = parser_1.SpecialsParser.extractDownPayment(text);
            const apr = parser_1.SpecialsParser.extractApr(text);
            const msrp = parser_1.SpecialsParser.extractMsrp(text);
            const expirationDate = parser_1.SpecialsParser.extractExpirationDate(text);
            const disclaimer = card.find('.disclaimer, .legal, small').text().trim() || undefined;
            const vehicleInfo = parser_1.SpecialsParser.extractVehicleInfo(title);
            let specialType = 'lease';
            if (apr !== undefined && apr >= 0)
                specialType = 'apr';
            else if (/finance|buy/i.test(text))
                specialType = 'finance';
            let imageUrl = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || undefined;
            if (imageUrl && !imageUrl.startsWith('http')) {
                try {
                    imageUrl = new URL(imageUrl, targetUrl).href;
                }
                catch { }
            }
            if (monthlyPayment || apr !== undefined || downPayment) {
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
                    specialUrl: targetUrl,
                    imageUrl,
                    domain
                });
            }
        });
        // 2. PixelMotion Promotional Banner Images
        const imgSelectors = [
            '.pm-special img',
            '.specials-container img',
            'img[src*="pixelmotion"]',
            'img[src*="special"]',
            'img[src*="offer"]',
            'img[src*="lease"]'
        ];
        const seenImages = new Set();
        const imgs = $(imgSelectors.join(', '));
        for (let i = 0; i < imgs.length; i++) {
            const img = $(imgs[i]);
            let src = img.attr('data-src') || img.attr('src') || '';
            if (!src || src.startsWith('data:image') || src.includes('logo') || src.includes('icon'))
                continue;
            if (!src.startsWith('http')) {
                try {
                    src = new URL(src, targetUrl).href;
                }
                catch {
                    continue;
                }
            }
            if (seenImages.has(src))
                continue;
            seenImages.add(src);
            const alt = img.attr('alt') || 'J Star CDJR Special Offer';
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
        return { htmlSpecials, visualSpecials };
    }
}
exports.JStarCdjrScraper = JStarCdjrScraper;
