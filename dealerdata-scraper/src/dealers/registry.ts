import { DealerInventoryScraper } from './types';
import { CovinaKiaInventoryScraper } from './covina_kia';

export class DealerInventoryRegistry {
  private static scrapers: Map<string, DealerInventoryScraper> = new Map();

  static {
    const covinaKia = new CovinaKiaInventoryScraper();
    DealerInventoryRegistry.register(covinaKia);
    DealerInventoryRegistry.scrapers.set('covina_kia', covinaKia);
    DealerInventoryRegistry.scrapers.set('covinakia', covinaKia);
    DealerInventoryRegistry.scrapers.set('covinakia.com', covinaKia);
  }

  static register(scraper: DealerInventoryScraper): void {
    const cleanId = scraper.id.toLowerCase().replace(/^store_/, '');
    DealerInventoryRegistry.scrapers.set(cleanId, scraper);

    if (scraper.domain && scraper.domain !== '*') {
      const cleanDomain = scraper.domain.toLowerCase().replace(/https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
      DealerInventoryRegistry.scrapers.set(cleanDomain, scraper);
    }
  }

  /**
   * Resolves a dedicated dealer inventory scraper by dealer ID or URL.
   */
  static getScraper(identifier?: string, fallbackUrl?: string): DealerInventoryScraper | undefined {
    if (identifier) {
      const clean = identifier.toLowerCase().replace(/^store_/, '');
      if (DealerInventoryRegistry.scrapers.has(clean)) {
        return DealerInventoryRegistry.scrapers.get(clean)!;
      }
    }

    if (fallbackUrl) {
      try {
        const u = new URL(fallbackUrl);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        if (DealerInventoryRegistry.scrapers.has(host)) {
          return DealerInventoryRegistry.scrapers.get(host)!;
        }
      } catch {}
    }

    return undefined;
  }

  static hasScraper(identifier?: string, fallbackUrl?: string): boolean {
    return !!DealerInventoryRegistry.getScraper(identifier, fallbackUrl);
  }
}
