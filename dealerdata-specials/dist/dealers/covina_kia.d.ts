import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class CovinaKiaScraper implements DealerSpecialsScraper {
    readonly id = "covina_kia";
    readonly name = "Covina KIA";
    readonly domain = "covinakia.com";
    readonly specialsUrls: string[];
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
