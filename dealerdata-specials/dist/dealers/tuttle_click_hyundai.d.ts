import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class TuttleClickHyundaiScraper implements DealerSpecialsScraper {
    readonly id = "tuttle_click_hyundai";
    readonly name = "Tuttle Click Hyundai";
    readonly domain = "tuttleclickhyundai.com";
    readonly specialsUrls: string[];
    private readonly apiEndpoint;
    private readonly apiPayload;
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
