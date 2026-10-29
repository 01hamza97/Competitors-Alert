import { VehicleListing } from '../types';
import { Page } from 'playwright';

export interface InventoryScrapeContext {
  page?: Page;
  targetUrl: string;
  dealerId: string;
  dealerName: string;
  domain: string;
  inventoryType: 'New' | 'Used' | 'All';
  maxPages?: number;
  proxyUrl?: string;
  logger: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface InventoryScrapeResult {
  listings: VehicleListing[];
  pagesCrawled: number;
  engineUsed: 'api' | 'playwright' | 'http';
}

export interface DealerInventoryScraper {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly inventoryUrls: {
    new?: string;
    used?: string;
  };
  useDirectConnection?: boolean;
  scrape(ctx: InventoryScrapeContext): Promise<InventoryScrapeResult>;
}
