import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class UpperMarlboroFordScraper implements DealerSpecialsScraper {
    readonly id = "upper_marlboro_ford";
    readonly name = "Upper Marlboro Ford";
    readonly domain = "uppermarlboroford.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
