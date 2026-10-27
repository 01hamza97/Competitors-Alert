"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleDealerScraper = void 0;
const storage_1 = require("../core/storage");
/**
 * Dealership X Specials Scraper Template
 *
 * Instructions:
 * 1. Target URL(s): Exact promotions/specials URL.
 * 2. If the special is an IMAGE/FLYER:
 *    - Query that exact image container selector.
 *    - Download and stage it for N8N / Vision AI processing.
 * 3. If the special is STRUCTURED HTML:
 *    - Query the exact card selector and extract fields.
 */
class ExampleDealerScraper {
    id = 'example_dealer';
    name = 'Example Dealership';
    domain = 'exampledealer.com';
    specialsUrls = [
        'https://www.exampledealer.com/specials/new.htm'
    ];
    async scrape(ctx) {
        const { $, targetUrl, dealerId, dealerName, domain, logger } = ctx;
        const htmlSpecials = [];
        const visualSpecials = [];
        const storage = new storage_1.StorageManager();
        // -------------------------------------------------------------
        // CASE A: Visual Image / Flyer Specials (for N8N Vision AI)
        // Target the EXACT flyer image element provided by the user.
        // -------------------------------------------------------------
        // const flyerElements = $('.exact-flyer-selector img');
        // for (let i = 0; i < flyerElements.length; i++) {
        //   const src = $(flyerElements[i]).attr('src');
        //   if (src) {
        //     const downloaded = await storage.downloadImage(src, dealerId, targetUrl);
        //     if (downloaded) {
        //       visualSpecials.push({
        //         dealerId,
        //         offerDealerName: dealerName,
        //         specialType: 'vehicle',
        //         title: 'Special Flyer',
        //         status: 'pending',
        //         imageHash: downloaded.imageHash,
        //         imageUrl: src,
        //         localImagePath: downloaded.localPath,
        //         domain,
        //         pageUrl: targetUrl,
        //         snapshotDate: new Date().toISOString().split('T')[0]
        //       });
        //     }
        //   }
        // }
        // -------------------------------------------------------------
        // CASE B: Structured HTML Specials (Direct DB Sync)
        // Target the EXACT card structure provided by the user.
        // -------------------------------------------------------------
        // $('.exact-card-selector').each((_, el) => {
        //   const card = $(el);
        //   // Extract exact fields here
        // });
        return { htmlSpecials, visualSpecials };
    }
}
exports.ExampleDealerScraper = ExampleDealerScraper;
