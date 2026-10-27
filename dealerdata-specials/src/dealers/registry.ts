import { DealerSpecialsScraper } from './types';
import { DefaultSpecialsScraper } from './default';
import { TuttleClickHyundaiScraper } from './tuttle_click_hyundai';
import { LagunaNiguelHyundaiScraper } from './laguna_niguel_hyundai';
import { HuntingtonBeachHyundaiScraper } from './huntington_beach_hyundai';
import { GardenGroveHyundaiScraper } from './garden_grove_hyundai';

export class DealerRegistry {
  private static scrapers: Map<string, DealerSpecialsScraper> = new Map();

  static {
    DealerRegistry.register(new TuttleClickHyundaiScraper());
    DealerRegistry.register(new LagunaNiguelHyundaiScraper());
    const hbh = new HuntingtonBeachHyundaiScraper();
    DealerRegistry.register(hbh);
    DealerRegistry.scrapers.set('huntington_beach_hyundai', hbh);
    DealerRegistry.scrapers.set('hunting_ton_beach_hyundai', hbh);
    DealerRegistry.register(new GardenGroveHyundaiScraper());
  }

  static register(scraper: DealerSpecialsScraper): void {
    const cleanId = scraper.id.toLowerCase().replace(/^store_/, '');
    DealerRegistry.scrapers.set(cleanId, scraper);

    if (scraper.domain && scraper.domain !== '*') {
      const cleanDomain = scraper.domain.toLowerCase().replace(/https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
      DealerRegistry.scrapers.set(cleanDomain, scraper);
    }
  }

  /**
   * Resolves a dedicated dealer scraper by dealer ID or domain.
   */
  static getScraper(identifier?: string, fallbackUrl?: string): DealerSpecialsScraper {
    if (!identifier && !fallbackUrl) {
      return new DefaultSpecialsScraper();
    }

    const clean = (identifier || '').toLowerCase().replace(/^store_/, '');
    if (DealerRegistry.scrapers.has(clean)) {
      return DealerRegistry.scrapers.get(clean)!;
    }

    if (fallbackUrl) {
      try {
        const hostname = new URL(fallbackUrl).hostname.toLowerCase().replace(/^www\./, '');
        if (DealerRegistry.scrapers.has(hostname)) {
          return DealerRegistry.scrapers.get(hostname)!;
        }
      } catch {}
    }

    // Try partial match on registered scraper keys
    for (const [key, scraper] of DealerRegistry.scrapers.entries()) {
      if (clean && key.includes(clean)) {
        return scraper;
      }
    }

    // Fall back to generic default scraper
    return new DefaultSpecialsScraper(identifier, identifier, undefined, fallbackUrl ? [fallbackUrl] : []);
  }

  static getAllScrapers(): DealerSpecialsScraper[] {
    const unique = new Map<string, DealerSpecialsScraper>();
    for (const scraper of DealerRegistry.scrapers.values()) {
      unique.set(scraper.id, scraper);
    }
    return Array.from(unique.values());
  }
}
