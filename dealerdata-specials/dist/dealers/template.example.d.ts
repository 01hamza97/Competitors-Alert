import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
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
export declare class ExampleDealerScraper implements DealerSpecialsScraper {
    readonly id = "example_dealer";
    readonly name = "Example Dealership";
    readonly domain = "exampledealer.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
