import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class PrinceFrederickFordScraper implements DealerSpecialsScraper {
    readonly id = "prince_frederick_ford";
    readonly name = "Prince Frederick Ford";
    readonly domain = "princefrederickford.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
