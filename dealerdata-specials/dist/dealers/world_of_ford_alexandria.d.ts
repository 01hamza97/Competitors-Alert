import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class WorldOfFordAlexandriaScraper implements DealerSpecialsScraper {
    readonly id = "world_of_ford_alexandria";
    readonly name = "World Of Ford Alexandria";
    readonly domain = "worldoffordalexandria.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
