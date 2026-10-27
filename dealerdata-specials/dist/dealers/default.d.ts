import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class DefaultSpecialsScraper implements DealerSpecialsScraper {
    readonly id = "default";
    readonly name = "Default Generic Dealer Scraper";
    readonly domain = "*";
    readonly specialsUrls: string[];
    constructor(id?: string, name?: string, domain?: string, urls?: string[]);
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
