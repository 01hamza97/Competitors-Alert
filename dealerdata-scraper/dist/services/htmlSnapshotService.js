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
exports.HtmlSnapshotService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const cheerio = __importStar(require("cheerio"));
const r2Storage_1 = require("./r2Storage");
class HtmlSnapshotService {
    /**
     * Prepares and cleans raw HTML specifically for compact AI consumption,
     * stripping bloated JS bundles, styles, SVGs, while preserving vehicle listings,
     * JSON-LD scripts, and specials promotional banners.
     */
    static cleanHtmlForAi(rawHtml) {
        const $ = cheerio.load(rawHtml);
        const specialsImages = [];
        // 1. Detect and collect specials / promotional banner images before stripping
        const specialsSelectors = [
            'img[src*="special" i]',
            'img[src*="banner" i]',
            'img[src*="offer" i]',
            'img[src*="lease" i]',
            'img[alt*="special" i]',
            'img[alt*="offer" i]',
            'img[alt*="lease" i]',
            '.special-item img',
            '.specials-banner img',
            '.offer-card img',
            '.vehicle-special img'
        ];
        $(specialsSelectors.join(', ')).each((_, el) => {
            const img = $(el);
            const src = img.attr('data-src') || img.attr('src');
            if (src && !src.startsWith('data:image')) {
                const parentCard = img.closest('.special-item, .offer-card, .vehicle-special, .slide, .banner, div');
                const disclaimer = parentCard.find('.disclaimer, .legal, small, p.terms').text().trim() || undefined;
                specialsImages.push({
                    imageUrl: src,
                    pageUrl: '',
                    altText: img.attr('alt') || undefined,
                    title: img.attr('title') || undefined,
                    disclaimerSnippet: disclaimer ? disclaimer.substring(0, 300) : undefined,
                    discoveredAt: new Date().toISOString()
                });
            }
        });
        // 2. Remove script & style tags (keep ld+json for structured schema)
        $('script:not([type="application/ld+json"])').remove();
        $('style, link[rel="stylesheet"], noscript, iframe, svg').remove();
        // 3. Remove common layout noise
        $([
            'header',
            'footer',
            'nav',
            'aside',
            '.site-header',
            '.site-footer',
            '.navigation',
            '.cookie-banner',
            '.cookie-consent',
            '.chat-widget',
            '#live-chat',
            '.gubagoo-chat',
            '#drift-widget',
            '.modal',
            '.popup'
        ].join(', ')).remove();
        return {
            cleanedHtml: $.html(),
            specialsImages
        };
    }
    /**
     * Saves a cleaned HTML page to the dealer's snapshot folder, and syncs to R2 if configured.
     */
    static async savePageHtml(dealerId, pageNumber, cleanedHtml, baseStorageDir = path_1.default.join(process.cwd(), 'crawled_html')) {
        const today = new Date().toISOString().split('T')[0];
        const targetFolder = path_1.default.join(baseStorageDir, dealerId, today);
        if (!fs_1.default.existsSync(targetFolder)) {
            fs_1.default.mkdirSync(targetFolder, { recursive: true });
        }
        const localFilePath = path_1.default.join(targetFolder, `page_${pageNumber}.html`);
        fs_1.default.writeFileSync(localFilePath, cleanedHtml, 'utf-8');
        console.log(`[Snapshot] Saved clean HTML page ${pageNumber} to local disk: ${localFilePath}`);
        // If Cloudflare R2 is configured, also upload to R2
        if (r2Storage_1.R2StorageService.isR2Configured()) {
            const r2Key = `crawled_html/${dealerId}/${today}/page_${pageNumber}.html`;
            await r2Storage_1.R2StorageService.uploadContent(cleanedHtml, r2Key, 'text/html');
        }
        return localFilePath;
    }
    /**
     * Generates or updates manifest.json in the crawl directory for N8N + AI to consume,
     * and syncs to Cloudflare R2 if configured.
     */
    static async saveManifest(manifest, baseStorageDir = path_1.default.join(process.cwd(), 'crawled_html')) {
        const today = new Date().toISOString().split('T')[0];
        const targetFolder = path_1.default.join(baseStorageDir, manifest.dealerId, today);
        if (!fs_1.default.existsSync(targetFolder)) {
            fs_1.default.mkdirSync(targetFolder, { recursive: true });
        }
        const manifestJsonString = JSON.stringify(manifest, null, 2);
        const localManifestPath = path_1.default.join(targetFolder, 'manifest.json');
        fs_1.default.writeFileSync(localManifestPath, manifestJsonString, 'utf-8');
        console.log(`[Manifest] Generated local N8N manifest at: ${localManifestPath}`);
        // If Cloudflare R2 is configured, also upload to R2
        if (r2Storage_1.R2StorageService.isR2Configured()) {
            const r2Key = `crawled_html/${manifest.dealerId}/${today}/manifest.json`;
            await r2Storage_1.R2StorageService.uploadContent(manifestJsonString, r2Key, 'application/json');
        }
        return localManifestPath;
    }
}
exports.HtmlSnapshotService = HtmlSnapshotService;
