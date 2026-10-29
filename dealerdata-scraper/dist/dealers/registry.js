"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealerInventoryRegistry = void 0;
const covina_kia_1 = require("./covina_kia");
const pomona_kia_1 = require("./pomona_kia");
const kia_of_cerritos_1 = require("./kia_of_cerritos");
const kia_of_dtla_1 = require("./kia_of_dtla");
class DealerInventoryRegistry {
    static scrapers = new Map();
    static {
        // 1. Covina KIA
        const covinaKia = new covina_kia_1.CovinaKiaInventoryScraper();
        DealerInventoryRegistry.register(covinaKia);
        DealerInventoryRegistry.scrapers.set('covina_kia', covinaKia);
        DealerInventoryRegistry.scrapers.set('covinakia', covinaKia);
        DealerInventoryRegistry.scrapers.set('covinakia.com', covinaKia);
        // 2. Pomona KIA
        const pomonaKia = new pomona_kia_1.PomonaKiaInventoryScraper();
        DealerInventoryRegistry.register(pomonaKia);
        DealerInventoryRegistry.scrapers.set('pomona_kia', pomonaKia);
        DealerInventoryRegistry.scrapers.set('pomonakia', pomonaKia);
        DealerInventoryRegistry.scrapers.set('pomonakia.com', pomonaKia);
        // 3. KIA Cerritos
        const kiaCerritos = new kia_of_cerritos_1.KiaOfCerritosInventoryScraper();
        DealerInventoryRegistry.register(kiaCerritos);
        DealerInventoryRegistry.scrapers.set('kia_cerritos', kiaCerritos);
        DealerInventoryRegistry.scrapers.set('kia_of_cerritos', kiaCerritos);
        DealerInventoryRegistry.scrapers.set('kiacerritos', kiaCerritos);
        DealerInventoryRegistry.scrapers.set('kiacerritos.com', kiaCerritos);
        // 4. KIA Of DTLA
        const kiaDtla = new kia_of_dtla_1.KiaOfDtlaInventoryScraper();
        DealerInventoryRegistry.register(kiaDtla);
        DealerInventoryRegistry.scrapers.set('kia_of_dtla', kiaDtla);
        DealerInventoryRegistry.scrapers.set('kia_dtla', kiaDtla);
        DealerInventoryRegistry.scrapers.set('kiaofdtla', kiaDtla);
        DealerInventoryRegistry.scrapers.set('kiaofdtla.com', kiaDtla);
    }
    static register(scraper) {
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
    static getScraper(identifier, fallbackUrl) {
        if (identifier) {
            const clean = identifier.toLowerCase().replace(/^store_/, '');
            if (DealerInventoryRegistry.scrapers.has(clean)) {
                return DealerInventoryRegistry.scrapers.get(clean);
            }
        }
        if (fallbackUrl) {
            try {
                const u = new URL(fallbackUrl);
                const host = u.hostname.toLowerCase().replace(/^www\./, '');
                if (DealerInventoryRegistry.scrapers.has(host)) {
                    return DealerInventoryRegistry.scrapers.get(host);
                }
            }
            catch { }
        }
        return undefined;
    }
    static hasScraper(identifier, fallbackUrl) {
        return !!DealerInventoryRegistry.getScraper(identifier, fallbackUrl);
    }
}
exports.DealerInventoryRegistry = DealerInventoryRegistry;
