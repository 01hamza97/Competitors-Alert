import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class HuntingtonBeachHyundaiScraper implements DealerSpecialsScraper {
    readonly id = "hunting_ton_beach_hyundai";
    readonly name = "Hunting Ton Beach Hyundai";
    readonly domain = "huntingtonbeachhyundai.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
