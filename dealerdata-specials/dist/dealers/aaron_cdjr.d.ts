import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class AaronCdjrScraper implements DealerSpecialsScraper {
    readonly id = "aaron_cdjr";
    readonly name = "Aaron CDJR";
    readonly domain = "aaroncdjr.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
