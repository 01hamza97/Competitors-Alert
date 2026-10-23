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
exports.cleanHtml = cleanHtml;
const cheerio = __importStar(require("cheerio"));
/**
 * Strips noise, ads, chat widgets, navigation, and scripts from raw HTML,
 * while extracting structured schema.org JSON-LD data and potential vehicle card nodes.
 */
function cleanHtml(rawHtml) {
    const $ = cheerio.load(rawHtml);
    const jsonLdObjects = [];
    // 1. Extract JSON-LD scripts before stripping them
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const text = $(el).text().trim();
            if (!text)
                return;
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                jsonLdObjects.push(...parsed);
            }
            else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
                jsonLdObjects.push(...parsed['@graph']);
            }
            else {
                jsonLdObjects.push(parsed);
            }
        }
        catch {
            // Ignore malformed JSON-LD
        }
    });
    // 2. Remove script and style tags (excluding what we already extracted)
    $('script, style, noscript, iframe, link').remove();
    // 3. Remove common website noise elements (navs, footers, headers, cookie bars, chat widgets)
    $([
        'header',
        'footer',
        'nav',
        'aside',
        '.header',
        '.footer',
        '.navigation',
        '.site-header',
        '.site-footer',
        '.cookie-banner',
        '.cookie-consent',
        '.privacy-notice',
        '#cookie-notice',
        '.chat-widget',
        '#live-chat',
        '.drift-frame-controller',
        '#drift-widget',
        '.gubagoo-chat',
        '.car-chat',
        '#podium-bubble',
        '.modal',
        '.popup',
        'svg',
    ].join(', ')).remove();
    // 4. Identify potential listing / product card containers
    const listingSelectors = [
        '.vehicle-card',
        '.inventory-item',
        '.inventory-card',
        '.vehicle-item',
        '.srp-vehicle',
        '.srp-item',
        '.vehicle-overview',
        '.vehicleList-item',
        '[data-vin]',
        '[data-vehicle-id]',
        '.inv-type-new',
        '.inventory-list__item',
        '.product-card',
        '.listing-item'
    ];
    const listingCardHtmls = [];
    $(listingSelectors.join(', ')).each((_, el) => {
        const cardHtml = $(el).html();
        if (cardHtml && cardHtml.length > 50) {
            listingCardHtmls.push(cardHtml);
        }
    });
    return {
        jsonLdObjects,
        cleanedText: $('body').text().replace(/\s+/g, ' ').trim(),
        cleanedHtml: $.html(),
        listingCardHtmls
    };
}
