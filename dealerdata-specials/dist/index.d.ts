import { SpecialsResult } from './types';
export interface ScrapeSpecialsOptions {
    dealerId?: string;
    dealerName?: string;
    targetUrl?: string;
    proxyUrl?: string;
    saveToDb?: boolean;
    headless?: boolean;
}
export declare function scrapeSpecials(options: ScrapeSpecialsOptions): Promise<SpecialsResult>;
export * from './types';
export * from './dealers/registry';
export * from './dealers/types';
