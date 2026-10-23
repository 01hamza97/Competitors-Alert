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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingExtractor = void 0;
const cheerio = __importStar(require("cheerio"));
const vehicleNormalization_1 = require("../utils/vehicleNormalization");
// Standard 17-character VIN regex (letters A-Z except I, O, Q, and digits 0-9)
const VIN_REGEX = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
const PRICE_REGEX = /\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/;
const YEAR_REGEX = /\b(20[12]\d)\b/;
class ListingExtractor {
    /**
     * Extract listings from schema.org JSON-LD objects
     */
    static extractFromJsonLd(jsonObjects, pageUrl, dealerId, dealerName) {
        const listings = [];
        // Flatten any ItemList objects or Dealer.com CollectionPage objects into child items
        const flattenedObjects = [];
        for (const obj of jsonObjects) {
            if (!obj || typeof obj !== 'object')
                continue;
            if (Array.isArray(obj)) {
                flattenedObjects.push(...obj);
                continue;
            }
            flattenedObjects.push(obj);
            // Standard ItemList
            if ((obj['@type'] === 'ItemList' || obj.itemListElement) && Array.isArray(obj.itemListElement)) {
                for (const item of obj.itemListElement) {
                    if (item && typeof item === 'object') {
                        const inner = item.item || item;
                        if (inner && typeof inner === 'object') {
                            flattenedObjects.push(inner);
                        }
                    }
                }
            }
            // Dealer.com CollectionPage / WebPage with itemOffered
            const itemOffered = obj.about?.offers?.itemOffered ||
                obj.offers?.itemOffered ||
                obj.itemOffered ||
                (Array.isArray(obj.about) ? obj.about.flatMap((a) => a?.offers?.itemOffered || []) : []);
            if (Array.isArray(itemOffered)) {
                for (const item of itemOffered) {
                    if (item && typeof item === 'object') {
                        flattenedObjects.push(item);
                    }
                }
            }
            // mainEntity itemListElement or hasPart
            if (obj.mainEntity && Array.isArray(obj.mainEntity.itemListElement)) {
                for (const item of obj.mainEntity.itemListElement) {
                    const inner = item.item || item;
                    if (inner && typeof inner === 'object') {
                        flattenedObjects.push(inner);
                    }
                }
            }
            if (Array.isArray(obj.hasPart)) {
                for (const part of obj.hasPart) {
                    if (part && typeof part === 'object') {
                        flattenedObjects.push(part);
                    }
                }
            }
        }
        for (const obj of flattenedObjects) {
            if (!obj || typeof obj !== 'object')
                continue;
            const type = obj['@type'] || '';
            const rawVin = obj.vehicleIdentificationNumber || obj.vin || obj.identifier || obj.sku || '';
            const vinFromUrl = (obj.url || '').match(VIN_REGEX)?.[1];
            const vinMatch = rawVin.toString().match(VIN_REGEX) || (vinFromUrl ? [null, vinFromUrl] : null);
            const isVehicle = /Vehicle|Car|Automobile|Product|ListItem/i.test(Array.isArray(type) ? type.join(' ') : type) ||
                vinMatch ||
                obj.vehicleIdentificationNumber ||
                obj.vin;
            if (!isVehicle)
                continue;
            const vin = vinMatch ? vinMatch[1].toUpperCase() : '';
            if (!vin)
                continue;
            const year = parseInt(obj.vehicleModelDate ||
                obj.productionDate ||
                (obj.name ? obj.name.match(YEAR_REGEX)?.[1] : '') ||
                '2025', 10);
            let make = '';
            const rawBrand = obj.brand || obj.manufacturer;
            if (typeof rawBrand === 'object' && rawBrand !== null) {
                make = rawBrand.name || '';
            }
            else if (typeof rawBrand === 'string') {
                make = rawBrand;
            }
            let model = typeof obj.model === 'object' && obj.model !== null ? obj.model.name || '' : (obj.model || '');
            let trim = obj.vehicleConfiguration || obj.trim || undefined;
            if (!make && obj.name) {
                const cleanedName = obj.name.replace(YEAR_REGEX, '').trim();
                const parts = cleanedName.split(/\s+/);
                if (parts.length >= 1) {
                    make = parts[0];
                    if (parts.length >= 2) {
                        model = parts[1];
                    }
                    if (parts.length > 2 && !trim) {
                        trim = parts.slice(2).join(' ');
                    }
                }
            }
            if (!trim && obj.name && model) {
                const cleanName = obj.name
                    .replace(/^(New|Used|Certified|Pre-Owned)\s+/i, '')
                    .replace(YEAR_REGEX, '')
                    .replace(new RegExp(make, 'i'), '')
                    .replace(new RegExp(model, 'i'), '')
                    .trim();
                if (cleanName && cleanName.length <= 30) {
                    trim = cleanName;
                }
            }
            const name = obj.name || `${year} ${make} ${model}`;
            // Price extraction
            let listPrice = 0;
            let msrp;
            if (obj.offers) {
                const offers = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
                if (offers) {
                    listPrice =
                        parseFloat(offers.price || offers.priceSpecification?.price || offers.highPrice || offers.lowPrice || '0') || 0;
                }
            }
            if (!listPrice && obj.price) {
                listPrice = parseFloat(obj.price.toString().replace(/[^0-9.]/g, '')) || 0;
            }
            if (listPrice < 1000) {
                listPrice = 0;
            }
            // Condition extraction
            let inventoryType = 'New';
            const condition = (obj.itemCondition || '').toLowerCase();
            if (condition.includes('used') || condition.includes('preowned')) {
                inventoryType = 'Used';
            }
            else if (condition.includes('certified')) {
                inventoryType = 'Certified';
            }
            else if (pageUrl.toLowerCase().includes('/used-') || pageUrl.toLowerCase().includes('/used/')) {
                inventoryType = 'Used';
            }
            // Image
            let imageUrl;
            if (typeof obj.image === 'string') {
                imageUrl = obj.image;
            }
            else if (Array.isArray(obj.image) && obj.image.length > 0) {
                imageUrl = typeof obj.image[0] === 'string' ? obj.image[0] : obj.image[0]?.url;
            }
            else if (obj.image?.url) {
                imageUrl = obj.image.url;
            }
            const normMake = (0, vehicleNormalization_1.normalizeMake)(make) || make || 'Unknown';
            const normModel = (0, vehicleNormalization_1.normalizeModel)(normMake, model) || model || 'Unknown';
            const normTrim = (0, vehicleNormalization_1.normalizeTrim)(trim || obj.vehicleConfiguration || obj.trim, normModel) || undefined;
            listings.push({
                vin,
                year: isNaN(year) ? 2025 : year,
                make: normMake,
                model: normModel,
                trim: normTrim,
                stockNumber: obj.sku || obj.vehicleIdentificationNumber || undefined,
                inventoryType,
                listPrice: listPrice || 0,
                msrp,
                mileage: obj.mileageFromOdometer?.value ? parseFloat(obj.mileageFromOdometer.value) : undefined,
                vehicleUrl: obj.url || pageUrl,
                imageUrl,
                dealerId,
                dealerName,
                extractionSource: 'json_ld',
                discoveredAt: new Date().toISOString()
            });
        }
        return listings;
    }
    /**
     * Extract listings from raw HTML Search Result Page (SRP) or vehicle card elements
     */
    static extractFromHtml(html, baseUrl, dealerId, dealerName) {
        const $ = cheerio.load(html);
        const listings = [];
        // Common card selectors across major automotive platforms
        const cardSelectors = [
            '[data-vehicle]',
            '.result-wrap',
            '.vehicle-card',
            '.inventory-card',
            '.srp-item',
            '.srp-vehicle',
            '.inventory-list__item',
            '.vehicle-overview',
            '.vehicleList-item',
            '.hproduct',
            '.product-item',
            '.hit',
            '[data-vehicle-id]',
            '[data-vin]'
        ];
        const cards = $(cardSelectors.join(', '));
        const seenVins = new Set();
        if (cards.length > 0) {
            cards.each((_, el) => {
                let card = $(el);
                // If matched element is an inner component (e.g. div.vin-row[data-vin]), resolve to closest card container
                const parentContainer = card.closest('.result-wrap, [data-vehicle], .vehicle-card, .inventory-card, .srp-item, .srp-vehicle, .inventory-list__item, .vehicle-overview, .vehicleList-item, .hproduct, .product-item, .hit, [data-vehicle-id]');
                if (parentContainer.length > 0) {
                    card = parentContainer;
                }
                // Check for Dealer Inspire / modern platform serialized data-vehicle attribute
                let dvObj = null;
                const rawDv = card.attr('data-vehicle') || card.find('[data-vehicle]').attr('data-vehicle');
                if (rawDv) {
                    try {
                        dvObj = typeof rawDv === 'object' ? rawDv : JSON.parse(rawDv);
                    }
                    catch { }
                }
                // 1. VIN (must be a valid 17-character automotive VIN)
                let rawVinCandidate = (dvObj?.vin) ||
                    card.attr('data-vin') ||
                    card.find('[data-vin]').attr('data-vin') ||
                    '';
                const cardText = card.text().replace(/\s+/g, ' ').trim();
                const vinMatch = rawVinCandidate.match(VIN_REGEX) || cardText.match(VIN_REGEX);
                if (!vinMatch)
                    return;
                const vin = vinMatch[1].toUpperCase();
                if (seenVins.has(vin))
                    return;
                seenVins.add(vin);
                const cardClass = (card.attr('class') || '').toLowerCase();
                // 2. Year, Make, Model, Title
                let year = dvObj?.year ? parseInt(dvObj.year, 10) : 0;
                let make = dvObj?.make || '';
                let model = dvObj?.model || '';
                let trim = dvObj?.trim || undefined;
                let stockNumber = dvObj?.stock || card.attr('data-stock');
                let listPrice = 0;
                let msrp;
                if (dvObj?.pricing) {
                    listPrice = parseFloat(dvObj.pricing.our_price || dvObj.pricing.price || dvObj.pricing.msrp || 0) || 0;
                    if (dvObj.pricing.msrp)
                        msrp = parseFloat(dvObj.pricing.msrp);
                }
                let inventoryType = 'New';
                if (dvObj?.type) {
                    if (dvObj.type.toLowerCase().includes('used'))
                        inventoryType = 'Used';
                    else if (dvObj.type.toLowerCase().includes('cert'))
                        inventoryType = 'Certified';
                }
                let link = dvObj?.vdp_url;
                let img = dvObj?.media?.images?.[0] || dvObj?.media?.thumbnails?.[0];
                const titleEl = card.find('h1.result-title, h2.result-title, .result-title, [data-testid="vehicle-name"], h1, h2, h3, h4, .vehicle-title, [data-testid="vehicle-title"], .title, a[href*="inventory/"], a[href*="vehicles/"]');
                let titleText = '';
                titleEl.each((_, t) => {
                    const txt = $(t).text().replace(/\s+/g, ' ').trim();
                    if (txt && !titleText && !/^vin:?/i.test(txt)) {
                        titleText = txt;
                    }
                });
                if (!titleText || /^vin:?/i.test(titleText)) {
                    // Look for Year Make Model pattern in card text
                    const m = cardText.match(/\b(20\d{2})\s+([A-Za-z]+)\s+([A-Za-z0-9-]+(?:\s+[A-Za-z0-9-]+)?)/);
                    if (m) {
                        titleText = m[0];
                    }
                    else {
                        titleText = cardText;
                    }
                }
                if (!year) {
                    const yearMatch = titleText.match(YEAR_REGEX);
                    year = yearMatch ? parseInt(yearMatch[1], 10) : 2025;
                }
                if (!make || make === 'Unknown' || !model || model === 'Unknown') {
                    const titleWithoutPrefix = titleText
                        .replace(/^new\s+/i, '')
                        .replace(/^used\s+/i, '')
                        .replace(/^cpo\s+/i, '')
                        .replace(/^certified\s+/i, '')
                        .trim();
                    const parts = titleWithoutPrefix.replace(new RegExp(`.*?${year}`), '').trim().split(' ');
                    if (parts[0] && !/^vin:?$/i.test(parts[0])) {
                        make = parts[0];
                        model = parts.slice(1, 3).join(' ') || 'Unknown';
                    }
                }
                // 3. Price
                let dealerDiscount;
                // Clean fee elements, accessory add-ons, and disclaimers FIRST so they can never contaminate price
                const cleanCard = card.clone();
                cleanCard
                    .find('.dealer-fee, [class*="fee"], [class*="disclaimer"], p.disclaimer, .pricing-stack-incentive-disclaimer, .conditional-incentives-breakdown, footer, script, style')
                    .remove();
                let finalPrice = 0;
                // Step 3A: Labeled price blocks (prioritizing Net Price, Total Price, Sale Price, Dealer Price, Our Price)
                cleanCard.find('.price-block, tr, dl, .pricing-row, .price-row, li').each((_, el) => {
                    const text = $(el).text().replace(/\s+/g, ' ').trim();
                    const label = $(el).find('.price-label, th, dt, .label').text().replace(/\s+/g, ' ').trim().toLowerCase();
                    const priceText = $(el).find('.price, td, dd, .value, [data-testid*="price-value"]').text().replace(/\s+/g, ' ').trim();
                    const match = (priceText || text).match(PRICE_REGEX);
                    if (!match)
                        return;
                    const val = parseFloat(match[1].replace(/,/g, ''));
                    if (val < 1000)
                        return; // Ignore small fees/rebates (e.g. $85 doc fee, $37 reg fee)
                    if (/total\s*price|net\s*price|sale\s*price|dealer\s*price|final\s*price|our\s*price|internet\s*price/i.test(label || text)) {
                        finalPrice = val;
                    }
                    else if (/msrp|retail/i.test(label || text) && !msrp) {
                        msrp = val;
                    }
                    else if (/dealer\s*discount|discount|savings/i.test(label || text) && !dealerDiscount) {
                        dealerDiscount = val;
                    }
                });
                // Step 3B: Specific selector matching (prioritizing Net / Total / Sale / Final / Our Price)
                if (!finalPrice) {
                    const finalPriceEl = cleanCard.find('.price-block.our-price .price, [data-testid*="final-price-value"], .final-price, .sale-price, .net-price, .total-price, .our-price');
                    if (finalPriceEl.length > 0) {
                        const m = finalPriceEl.first().text().match(PRICE_REGEX);
                        if (m) {
                            const val = parseFloat(m[1].replace(/,/g, ''));
                            if (val >= 1000)
                                finalPrice = val;
                        }
                    }
                }
                if (!msrp) {
                    const msrpEl = cleanCard.find('.price-block:not(.our-price):not(.dealer-fee) .price, .msrp, [data-msrp]');
                    if (msrpEl.length > 0) {
                        const m = msrpEl.first().text().match(PRICE_REGEX);
                        if (m) {
                            const val = parseFloat(m[1].replace(/,/g, ''));
                            if (val >= 1000)
                                msrp = val;
                        }
                    }
                }
                if (!listPrice || listPrice < 1000) {
                    listPrice = finalPrice || msrp || 0;
                }
                // Sanity check: Vehicles never cost under $1000; reject fees contaminating listPrice
                if (listPrice < 1000) {
                    listPrice = 0;
                }
                if (!dealerDiscount && msrp && listPrice && msrp > listPrice) {
                    dealerDiscount = msrp - listPrice;
                }
                // 4. Stock #
                if (!stockNumber) {
                    const stockMatch = cardText.match(/Stock\s*#?:?\s*([A-Za-z0-9-]+)/i);
                    if (stockMatch)
                        stockNumber = stockMatch[1].replace(/vin.*$/i, '').trim();
                }
                // 5. Inventory Type (New / Used / Certified)
                if (!dvObj?.type) {
                    if (cardClass.includes('used-vehicle') ||
                        cardClass.includes('used_vehicle') ||
                        cardClass.includes('pre-owned') ||
                        /^used\b/i.test(titleText)) {
                        inventoryType = 'Used';
                    }
                    else if (cardClass.includes('cpo-vehicle') ||
                        cardClass.includes('certified') ||
                        cardClass.includes('cpo') ||
                        /^certified\b/i.test(titleText)) {
                        inventoryType = 'Certified';
                    }
                    else if (cardClass.includes('new-vehicle') ||
                        /^new\b/i.test(titleText)) {
                        inventoryType = 'New';
                    }
                    else {
                        const lowerCard = cardText.toLowerCase();
                        if (lowerCard.includes('certified pre-owned') || lowerCard.includes('certified used')) {
                            inventoryType = 'Certified';
                        }
                        else if (lowerCard.includes('pre-owned') || lowerCard.includes('used vehicle')) {
                            inventoryType = 'Used';
                        }
                    }
                }
                // 6. Link / Vehicle URL
                if (!link) {
                    link = card.find('a[href]').attr('href') || '';
                }
                if (link && !link.startsWith('http')) {
                    try {
                        link = new URL(link, baseUrl).toString();
                    }
                    catch {
                        link = baseUrl;
                    }
                }
                else if (!link) {
                    link = baseUrl;
                }
                // 7. Image URL
                if (!img) {
                    img =
                        card.find('img[data-src]').attr('data-src') ||
                            card.find('img[src]').attr('src') ||
                            undefined;
                }
                if (img && !img.startsWith('http')) {
                    try {
                        img = new URL(img, baseUrl).toString();
                    }
                    catch {
                        img = undefined;
                    }
                }
                const normMake = (0, vehicleNormalization_1.normalizeMake)(make) || make || 'Unknown';
                const normModel = (0, vehicleNormalization_1.normalizeModel)(normMake, model) || model || 'Unknown';
                listings.push({
                    vin,
                    year,
                    make: normMake,
                    model: normModel,
                    trim,
                    stockNumber,
                    inventoryType,
                    listPrice,
                    msrp,
                    dealerDiscount: dealerDiscount || (msrp && listPrice && msrp > listPrice ? msrp - listPrice : undefined),
                    vehicleUrl: link,
                    imageUrl: img,
                    dealerId,
                    dealerName,
                    extractionSource: 'html_srp',
                    discoveredAt: new Date().toISOString()
                });
            });
        }
        return listings;
    }
    /**
     * Extract listings directly from CarsCommerce / Dealer Inspire JSON API payload
     */
    static extractFromCarsCommerce(listingsData, baseUrl, dealerId, dealerName) {
        if (!Array.isArray(listingsData))
            return [];
        return listingsData
            .map((item) => {
            const vin = String(item.vin || '').toUpperCase();
            if (vin.length !== 17)
                return null;
            const year = parseInt(item.year || 0, 10) || 2025;
            const rawMake = item.make || '';
            const rawModel = item.model || '';
            const trim = item.trim || undefined;
            const stockNumber = item.stock || undefined;
            const inventoryType = item.type === 'Used' ? 'Used' : (item.type === 'Certified' ? 'Certified' : 'New');
            let listPrice = parseFloat(item.pricing?.our_price ||
                item.pricing?.sale_price ||
                item.pricing?.dealer_price ||
                item.pricing?.net_price ||
                item.pricing?.price ||
                item.pricing?.msrp ||
                0) || 0;
            if (listPrice < 1000) {
                listPrice = 0;
            }
            const msrp = item.pricing?.msrp ? parseFloat(item.pricing.msrp) : undefined;
            const dealerDiscount = msrp && listPrice && msrp > listPrice ? msrp - listPrice : undefined;
            const mileage = item.mileage ? parseInt(item.mileage, 10) : undefined;
            const vehicleUrl = item.vdp_url || baseUrl;
            const imageUrl = item.media?.images?.[0] || item.media?.thumbnails?.[0] || undefined;
            const normMake = (0, vehicleNormalization_1.normalizeMake)(rawMake) || rawMake || 'Unknown';
            const normModel = (0, vehicleNormalization_1.normalizeModel)(normMake, rawModel) || rawModel || 'Unknown';
            const result = {
                vin,
                year,
                make: normMake,
                model: normModel,
                trim,
                stockNumber,
                inventoryType,
                listPrice,
                msrp,
                dealerDiscount,
                mileage,
                vehicleUrl,
                imageUrl,
                dealerId,
                dealerName,
                extractionSource: 'api',
                discoveredAt: new Date().toISOString()
            };
            return result;
        })
            .filter((v) => v !== null);
    }
    /**
     * Deduplicates vehicle listings by 17-character VIN, keeping the most comprehensive record
     */
    static deduplicate(listings) {
        const map = new Map();
        for (const item of listings) {
            if (!item.vin || item.vin.length < 5)
                continue;
            const existing = map.get(item.vin);
            if (!existing) {
                map.set(item.vin, item);
            }
            else {
                // Merge records, preferring populated fields and valid vehicle prices (>= $1000)
                const validPrice = (p) => (p && p >= 1000 ? p : 0);
                const bestListPrice = validPrice(item.listPrice) || validPrice(existing.listPrice) || 0;
                const bestMsrp = validPrice(item.msrp) || validPrice(existing.msrp) || undefined;
                const bestDiscount = (item.dealerDiscount && item.dealerDiscount > 0) ? item.dealerDiscount : existing.dealerDiscount;
                map.set(item.vin, {
                    ...existing,
                    listPrice: bestListPrice,
                    msrp: bestMsrp,
                    dealerDiscount: bestDiscount,
                    imageUrl: item.imageUrl || existing.imageUrl,
                    trim: existing.trim || item.trim,
                    stockNumber: existing.stockNumber || item.stockNumber,
                    mileage: existing.mileage || item.mileage
                });
            }
        }
        return Array.from(map.values());
    }
}
exports.ListingExtractor = ListingExtractor;
