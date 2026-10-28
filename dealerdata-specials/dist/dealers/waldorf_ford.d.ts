import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class WaldorfFordScraper implements DealerSpecialsScraper {
    readonly id = "waldorf_ford";
    readonly name = "Waldorf Ford";
    readonly domain = "waldorfford.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
