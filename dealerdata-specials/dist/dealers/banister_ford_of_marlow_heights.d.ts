import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class BanisterFordOfMarlowHeightsScraper implements DealerSpecialsScraper {
    readonly id = "banister_ford_of_marlow_heights";
    readonly name = "Banister Ford of Marlow Heights";
    readonly domain = "banisterfordofmarlowheights.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
