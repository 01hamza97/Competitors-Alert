"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealerRegistry = void 0;
const default_1 = require("./default");
const tuttle_click_hyundai_1 = require("./tuttle_click_hyundai");
const laguna_niguel_hyundai_1 = require("./laguna_niguel_hyundai");
const huntington_beach_hyundai_1 = require("./huntington_beach_hyundai");
const garden_grove_hyundai_1 = require("./garden_grove_hyundai");
const hyundai_of_anaheim_1 = require("./hyundai_of_anaheim");
const waldorf_ford_1 = require("./waldorf_ford");
const world_of_ford_alexandria_1 = require("./world_of_ford_alexandria");
const banister_ford_of_marlow_heights_1 = require("./banister_ford_of_marlow_heights");
const upper_marlboro_ford_1 = require("./upper_marlboro_ford");
const prince_frederick_ford_1 = require("./prince_frederick_ford");
const covina_kia_1 = require("./covina_kia");
const pomona_kia_1 = require("./pomona_kia");
class DealerRegistry {
    static scrapers = new Map();
    static {
        DealerRegistry.register(new tuttle_click_hyundai_1.TuttleClickHyundaiScraper());
        DealerRegistry.register(new laguna_niguel_hyundai_1.LagunaNiguelHyundaiScraper());
        const hbh = new huntington_beach_hyundai_1.HuntingtonBeachHyundaiScraper();
        DealerRegistry.register(hbh);
        DealerRegistry.scrapers.set('huntington_beach_hyundai', hbh);
        DealerRegistry.scrapers.set('hunting_ton_beach_hyundai', hbh);
        DealerRegistry.register(new garden_grove_hyundai_1.GardenGroveHyundaiScraper());
        const hoa = new hyundai_of_anaheim_1.HyundaiOfAnaheimScraper();
        DealerRegistry.register(hoa);
        DealerRegistry.scrapers.set('hyundai_of_anaheim', hoa);
        DealerRegistry.scrapers.set('anaheim_hyundai', hoa);
        DealerRegistry.register(new waldorf_ford_1.WaldorfFordScraper());
        DealerRegistry.register(new world_of_ford_alexandria_1.WorldOfFordAlexandriaScraper());
        DealerRegistry.register(new banister_ford_of_marlow_heights_1.BanisterFordOfMarlowHeightsScraper());
        DealerRegistry.register(new upper_marlboro_ford_1.UpperMarlboroFordScraper());
        DealerRegistry.register(new prince_frederick_ford_1.PrinceFrederickFordScraper());
        DealerRegistry.register(new covina_kia_1.CovinaKiaScraper());
        DealerRegistry.register(new pomona_kia_1.PomonaKiaScraper());
    }
    static register(scraper) {
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
    static getScraper(identifier, fallbackUrl) {
        if (!identifier && !fallbackUrl) {
            return new default_1.DefaultSpecialsScraper();
        }
        const clean = (identifier || '').toLowerCase().replace(/^store_/, '');
        if (DealerRegistry.scrapers.has(clean)) {
            return DealerRegistry.scrapers.get(clean);
        }
        if (fallbackUrl) {
            try {
                const hostname = new URL(fallbackUrl).hostname.toLowerCase().replace(/^www\./, '');
                if (DealerRegistry.scrapers.has(hostname)) {
                    return DealerRegistry.scrapers.get(hostname);
                }
            }
            catch { }
        }
        // Try partial match on registered scraper keys
        for (const [key, scraper] of DealerRegistry.scrapers.entries()) {
            if (clean && key.includes(clean)) {
                return scraper;
            }
        }
        // Fall back to generic default scraper
        return new default_1.DefaultSpecialsScraper(identifier, identifier, undefined, fallbackUrl ? [fallbackUrl] : []);
    }
    static getAllScrapers() {
        const unique = new Map();
        for (const scraper of DealerRegistry.scrapers.values()) {
            unique.set(scraper.id, scraper);
        }
        return Array.from(unique.values());
    }
}
exports.DealerRegistry = DealerRegistry;
