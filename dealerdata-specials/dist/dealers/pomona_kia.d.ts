import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class PomonaKiaScraper implements DealerSpecialsScraper {
    readonly id = "pomona_kia";
    readonly name = "Pomona Kia";
    readonly domain = "pomonakia.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
