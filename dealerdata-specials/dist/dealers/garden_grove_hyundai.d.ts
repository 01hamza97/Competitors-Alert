import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class GardenGroveHyundaiScraper implements DealerSpecialsScraper {
    readonly id = "garden_grove_hyundai";
    readonly name = "Garden Grove Hyundai";
    readonly domain = "gardengrovehyundai.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
