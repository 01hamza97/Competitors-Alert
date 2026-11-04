import { DealerSpecialsScraper } from './types';
import { DefaultSpecialsScraper } from './default';
import { TuttleClickHyundaiScraper } from './tuttle_click_hyundai';
import { LagunaNiguelHyundaiScraper } from './laguna_niguel_hyundai';
import { HuntingtonBeachHyundaiScraper } from './huntington_beach_hyundai';
import { GardenGroveHyundaiScraper } from './garden_grove_hyundai';
import { HyundaiOfAnaheimScraper } from './hyundai_of_anaheim';
import { WaldorfFordScraper } from './waldorf_ford';
import { WorldOfFordAlexandriaScraper } from './world_of_ford_alexandria';
import { BanisterFordOfMarlowHeightsScraper } from './banister_ford_of_marlow_heights';
import { UpperMarlboroFordScraper } from './upper_marlboro_ford';
import { PrinceFrederickFordScraper } from './prince_frederick_ford';
import { CovinaKiaScraper } from './covina_kia';
import { PomonaKiaScraper } from './pomona_kia';
import { KiaOfCerritosScraper } from './kia_of_cerritos';
import { KiaOfDtlaScraper } from './kia_of_dtla';
import { HarborChevyScraper } from './harbor_chevy';
import { GeorgeChevroletScraper } from './george_chevrolet';
import { PenskeChevroletScraper } from './penske_chevrolet';
import { PremierChevroletScraper } from './premier_chevrolet';
import { ChevyOfCarsonScraper } from './chevy_of_carson';

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
    const hoa = new HyundaiOfAnaheimScraper();
    DealerRegistry.register(hoa);
    DealerRegistry.scrapers.set('hyundai_of_anaheim', hoa);
    DealerRegistry.scrapers.set('anaheim_hyundai', hoa);
    DealerRegistry.register(new WaldorfFordScraper());
    DealerRegistry.register(new WorldOfFordAlexandriaScraper());
    DealerRegistry.register(new BanisterFordOfMarlowHeightsScraper());
    DealerRegistry.register(new UpperMarlboroFordScraper());
    DealerRegistry.register(new PrinceFrederickFordScraper());
    DealerRegistry.register(new CovinaKiaScraper());
    DealerRegistry.register(new PomonaKiaScraper());
    const koc = new KiaOfCerritosScraper();
    DealerRegistry.register(koc);
    DealerRegistry.scrapers.set('kia_cerritos', koc);
    DealerRegistry.scrapers.set('kia_of_cerritos', koc);
    DealerRegistry.scrapers.set('kiacerritos', koc);
    const kod = new KiaOfDtlaScraper();
    DealerRegistry.register(kod);
    DealerRegistry.scrapers.set('kia_dtla', kod);
    DealerRegistry.scrapers.set('kia_of_dtla', kod);
    DealerRegistry.scrapers.set('kiaofdtla', kod);
    const harbor = new HarborChevyScraper();
    DealerRegistry.register(harbor);
    DealerRegistry.scrapers.set('harbor_chevy', harbor);
    DealerRegistry.scrapers.set('harborchevy', harbor);
    DealerRegistry.scrapers.set('harbor_chevrolet', harbor);
    DealerRegistry.scrapers.set('harborchevrolet', harbor);
    DealerRegistry.scrapers.set('1792686342012_52is1', harbor);
    DealerRegistry.scrapers.set('store_1792686342012_52is1', harbor);
    const george = new GeorgeChevroletScraper();
    DealerRegistry.register(george);
    DealerRegistry.scrapers.set('george_chevorlet', george);
    DealerRegistry.scrapers.set('george_chevrolet', george);
    DealerRegistry.scrapers.set('georgechevy', george);
    DealerRegistry.scrapers.set('george_chevy', george);
    DealerRegistry.scrapers.set('georgechevy.com', george);
    DealerRegistry.scrapers.set('storecompetitor_1792686429771_om86m', george);
    DealerRegistry.scrapers.set('1792686429771_om86m', george);
    const penske = new PenskeChevroletScraper();
    DealerRegistry.register(penske);
    DealerRegistry.scrapers.set('penske_chevrolet', penske);
    DealerRegistry.scrapers.set('penskechevrolet', penske);
    DealerRegistry.scrapers.set('penske_chevy', penske);
    DealerRegistry.scrapers.set('penskechevy', penske);
    DealerRegistry.scrapers.set('penskechevroletofcerritos.com', penske);
    DealerRegistry.scrapers.set('storecompetitor_1792686519183_jlhq1', penske);
    DealerRegistry.scrapers.set('1792686519183_jlhq1', penske);
    const premier = new PremierChevroletScraper();
    DealerRegistry.register(premier);
    DealerRegistry.scrapers.set('premier_chevrolet', premier);
    DealerRegistry.scrapers.set('premierchevrolet', premier);
    DealerRegistry.scrapers.set('premier_chevy', premier);
    DealerRegistry.scrapers.set('premierchevy', premier);
    DealerRegistry.scrapers.set('premierchevybp.com', premier);
    DealerRegistry.scrapers.set('storecompetitor_1792686616118_qrupm', premier);
    DealerRegistry.scrapers.set('1792686616118_qrupm', premier);
    const carson = new ChevyOfCarsonScraper();
    DealerRegistry.register(carson);
    DealerRegistry.scrapers.set('chevy_of_carson', carson);
    DealerRegistry.scrapers.set('chevyofcarson', carson);
    DealerRegistry.scrapers.set('carson_chevy', carson);
    DealerRegistry.scrapers.set('carsonchevy', carson);
    DealerRegistry.scrapers.set('chevyofcarson.com', carson);
    DealerRegistry.scrapers.set('storecompetitor_1792686701120_2j3b6', carson);
    DealerRegistry.scrapers.set('1792686701120_2j3b6', carson);
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
