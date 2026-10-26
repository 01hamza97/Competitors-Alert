import { DealerSpecialsScraper } from './types';
import { DefaultSpecialsScraper } from './default';
import { JStarCdjrScraper } from './j_star_cdjr';
import { TuttleClickHyundaiScraper } from './tuttle_click_hyundai';
import { HuntingtonBeachHyundaiScraper } from './huntington_beach_hyundai';
import { MossBrosCdjrScraper } from './moss_bros_cdjr';
import { AaronCdjrScraper } from './aaron_cdjr';

export class DealerRegistry {
  private static scrapers: Map<string, DealerSpecialsScraper> = new Map();

  static {
    // Register custom dealer scrapers
    DealerRegistry.register(new JStarCdjrScraper());
    DealerRegistry.register(new TuttleClickHyundaiScraper());
    DealerRegistry.register(new HuntingtonBeachHyundaiScraper());
    DealerRegistry.register(new MossBrosCdjrScraper());
    DealerRegistry.register(new AaronCdjrScraper());
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
   * Resolves a dedicated dealer scraper by dealer ID, name, or domain.
   * If not found, falls back to DefaultSpecialsScraper.
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

    // Try partial match on registered scraper domains
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
