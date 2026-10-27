import { DealerSpecialsScraper } from './types';
export declare class DealerRegistry {
    private static scrapers;
    static register(scraper: DealerSpecialsScraper): void;
    /**
     * Resolves a dedicated dealer scraper by dealer ID or domain.
     */
    static getScraper(identifier?: string, fallbackUrl?: string): DealerSpecialsScraper;
    static getAllScrapers(): DealerSpecialsScraper[];
}
