import { Page } from 'playwright';
import * as cheerio from 'cheerio';

export type SpecialType = 'lease' | 'finance' | 'cash' | 'apr' | 'vehicle' | 'service';

export interface CompetitorVehicleSpecial {
  id?: string;
  dealerId: string;
  offerDealerName?: string;
  snapshotDate?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  specialType: SpecialType;
  monthlyPayment?: number;
  termMonths?: number;
  downPayment?: number;
  apr?: number;
  msrp?: number;
  title?: string;
  disclaimer?: string;
  expirationDate?: string;
  specialUrl?: string;
  imageUrl?: string;
  domain?: string;
  rawHtmlSnippet?: string;
}

export interface StagedVisualSpecial {
  id?: string;
  dealerId: string;
  offerDealerName?: string;
  clientDealerName?: string;
  snapshotDate?: string;
  specialType: string;
  title: string;
  details?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  rawText?: string;
  extractedJson?: any;
  imageHash: string;
  imageUrl: string;
  localImagePath?: string;
  domain?: string;
  pageUrl?: string;
}

export interface SpecialOfferImage {
  src: string;
  alt?: string;
  title?: string;
  pageUrl?: string;
  width?: number;
  height?: number;
}

export interface SpecialsResult {
  dealerId: string;
  dealerName: string;
  targetUrl: string;
  domain: string;
  scrapedAt: string;
  durationMs: number;
  htmlSpecials: CompetitorVehicleSpecial[];
  visualSpecials: StagedVisualSpecial[];
  totalExtracted: number;
  manifestPath?: string;
  errors?: string[];
}

export interface ScrapeContext {
  page: Page;
  $: cheerio.CheerioAPI;
  html: string;
  targetUrl: string;
  dealerId: string;
  dealerName: string;
  domain: string;
  proxyUrl?: string;
  downloadDir: string;
  logger: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface DealerConfig {
  id: string;
  name: string;
  domain: string;
  specialsUrls: string[];
  active?: boolean;
}

export interface DealerSpecialsScraper {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly specialsUrls: string[];
  scrape(context: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }>;
}
