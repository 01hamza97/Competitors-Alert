import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class MossBrosCdjrScraper implements DealerSpecialsScraper {
    readonly id = "moss_bros_cdjr";
    readonly name = "Moss Bros CDJR Riverside";
    readonly domain = "mossbroscjdrriverside.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
