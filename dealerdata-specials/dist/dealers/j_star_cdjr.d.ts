import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class JStarCdjrScraper implements DealerSpecialsScraper {
    readonly id = "j_star_cdjr";
    readonly name = "J Star Chrysler Dodge Jeep Ram Fiat";
    readonly domain = "jstarcdjrofanaheimhills.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
