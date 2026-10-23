export interface VehicleListing {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  stockNumber?: string;
  inventoryType: 'New' | 'Used' | 'Certified';
  listPrice: number;
  msrp?: number;
  dealerDiscount?: number;
  mileage?: number;
  daysInStock?: number;
  vehicleUrl: string;
  imageUrl?: string;
  dealerId?: string;
  dealerName?: string;
  extractionSource: 'api' | 'sitemap_vdp' | 'html_srp' | 'json_ld' | 'ai_extracted';
  discoveredAt: string;
}

export interface SpecialsOfferImage {
  imageUrl: string;
  pageUrl: string;
  altText?: string;
  title?: string;
  disclaimerSnippet?: string;
  discoveredAt: string;
}

export interface HtmlCrawlManifest {
  dealerId: string;
  dealerName: string;
  targetUrl: string;
  crawledAt: string;
  totalPages: number;
  engineUsed: 'playwright' | 'http';
  mode: 'static' | 'ai-html' | 'auto';
  htmlFiles: string[];
  specialsImages: SpecialsOfferImage[];
  status: 'ready_for_n8n_ai' | 'completed_static' | 'failed';
  totalListingsExtracted?: number;
}

export interface ScrapeTarget {
  id: string;
  name: string;
  url: string;
  inventoryUrl?: string;
  platform?: 'dealercom' | 'dealerinspire' | 'dealeron' | 'cdk' | 'custom' | 'unknown';
  dealerId: string;
}

export type ScrapeMode = 'static' | 'ai-html' | 'auto';

export interface CrawlOptions {
  targetUrl: string;
  dealerId?: string;
  dealerName?: string;
  inventoryType?: 'New' | 'Used' | 'All';
  maxPages?: number;
  mode?: ScrapeMode; // 'static' (zero AI cost), 'ai-html' (saves HTML for N8N + AI), 'auto'
  useSitemapFirst?: boolean;
  tryDirectApi?: boolean;
  saveToDb?: boolean;
  outputDir?: string;
  htmlStorageDir?: string;
  extractSpecialsImages?: boolean;
  specialsUrl?: string;
  crawlSpecials?: boolean;
  specialsOnly?: boolean;
}

export interface CompetitorVehicleSpecial {
  id?: string;
  dealerId: string;
  offerDealerName: string;
  snapshotDate: string; // YYYY-MM-DD
  year: number;
  make: string;
  model: string;
  trim?: string;
  specialType: 'lease' | 'finance' | 'cash';
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
}

export interface StagedVisualSpecial {
  id?: string;
  dealerId: string;
  offerDealerName: string;
  clientDealerName?: string;
  snapshotDate: string; // YYYY-MM-DD
  specialType: 'vehicle' | 'service';
  title?: string;
  details?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  rawText?: string;
  extractedJson?: string;
  imageUrl?: string;
  localImagePath?: string;
  imageHash?: string;
  domain?: string;
}

export interface SpecialsExtractionResult {
  mode: 'html_components' | 'visual_images' | 'mixed' | 'none';
  htmlSpecials: CompetitorVehicleSpecial[];
  visualSpecials: StagedVisualSpecial[];
  savedImages: { imageUrl: string; localPath: string; fileName: string; }[];
}

export interface CrawlResult {
  targetUrl: string;
  domain: string;
  platform: string;
  mode: ScrapeMode;
  totalListingsFound: number;
  newListingsCount: number;
  usedListingsCount: number;
  apiAccessUsed: boolean;
  sitemapUsed: boolean;
  funnelStageUsed?: 'sitemap' | 'direct_api' | 'direct_srp' | 'playwright_browser' | 'none';
  funnelSummary?: string;
  pagesCrawled: number;
  durationSeconds: number;
  outputFile?: string;
  manifestFile?: string;
  listings: VehicleListing[];
  specialsImages?: SpecialsOfferImage[];
  htmlSpecialsCount?: number;
  visualSpecialsCount?: number;
  htmlSpecials?: CompetitorVehicleSpecial[];
  visualSpecials?: StagedVisualSpecial[];
}
