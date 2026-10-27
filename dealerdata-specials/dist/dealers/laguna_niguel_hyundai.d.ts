import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class LagunaNiguelHyundaiScraper implements DealerSpecialsScraper {
    readonly id = "laguna_niguel_hyundai";
    readonly name = "Laguna Niguel Hyundai";
    readonly domain = "lagunaniguelhyundai.com";
    readonly specialsUrls: string[];
    private readonly HYUNDAI_MODELS;
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
    private extractMatchingModels;
}
