import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
export declare class HyundaiOfAnaheimScraper implements DealerSpecialsScraper {
    readonly id = "hyundai_of_anaheim";
    readonly name = "Hyundai Of Anaheim";
    readonly domain = "hyundaiofanaheim.com";
    readonly specialsUrls: string[];
    private readonly apiEndpoint;
    private readonly apiPayload;
    scrape(ctx: ScrapeContext): Promise<{
        htmlSpecials: CompetitorVehicleSpecial[];
        visualSpecials: StagedVisualSpecial[];
    }>;
}
