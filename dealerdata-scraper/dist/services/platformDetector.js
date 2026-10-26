"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformDetector = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const proxyHelper_1 = require("./proxyHelper");
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
class PlatformDetector {
    /**
     * Detects the automotive CMS platform and checks for known API access.
     */
    static async detectPlatform(targetUrl, proxyUrl) {
        const origin = new URL(targetUrl).origin;
        console.log(`[PlatformDetector] Analyzing target platform for: ${origin}`);
        // Fast check: Dealer.com canonical inventory path structure
        if (targetUrl.includes('/new-inventory/index.htm') ||
            targetUrl.includes('/used-inventory/index.htm') ||
            targetUrl.includes('/inventory/index.htm')) {
            console.log(`[PlatformDetector] Identified Dealer.com via canonical URL pattern.`);
            return 'dealercom';
        }
        try {
            let res;
            try {
                res = await axios_1.default.get(targetUrl, {
                    headers: {
                        'User-Agent': DEFAULT_USER_AGENT,
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    },
                    timeout: 12000,
                    ...(0, proxyHelper_1.getAxiosProxyConfig)(proxyUrl),
                });
            }
            catch (proxyErr) {
                if (proxyUrl && proxyUrl !== 'direct') {
                    console.warn(`[PlatformDetector] Request with proxy failed (${proxyErr.message}). Retrying with direct connection...`);
                    res = await axios_1.default.get(targetUrl, {
                        headers: {
                            'User-Agent': DEFAULT_USER_AGENT,
                            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        },
                        timeout: 10000,
                    });
                }
                else {
                    throw proxyErr;
                }
            }
            const html = res.data;
            const $ = cheerio.load(html);
            // Check 1: Dealer Inspire
            if (html.includes('dealerinspire') ||
                html.includes('data-di-') ||
                html.includes('/inventory/search') ||
                $('script[src*="dealerinspire"]').length > 0) {
                return 'dealerinspire';
            }
            // Check 2: Dealer.com
            if (html.includes('dealer.com') ||
                html.includes('ddc-') ||
                html.includes('window.DDC') ||
                $('script[src*="dealer.com"]').length > 0) {
                return 'dealercom';
            }
            // Check 3: DealerOn
            if (html.includes('dealeron.com') ||
                html.includes('dealeron') ||
                $('script[src*="dealeron"]').length > 0) {
                return 'dealeron';
            }
            // Check 4: CDK Global
            if (html.includes('cdkglobal') ||
                html.includes('cdk.com') ||
                html.includes('window.cdk')) {
                return 'cdk';
            }
            return 'custom';
        }
        catch (err) {
            console.warn(`[PlatformDetector] Warning: Could not analyze homepage: ${err.message}`);
            return 'unknown';
        }
    }
    /**
     * Probes known automotive API endpoints and extracts structured listings if available.
     */
    static async checkDirectApi(origin, dealerId, maxPages = 0, proxyUrl) {
        const proxyConfig = (0, proxyHelper_1.getAxiosProxyConfig)(proxyUrl);
        // 1. Check if configured in dealers.json (CarsCommerce / DealerInspire API)
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs')));
            const path = await Promise.resolve().then(() => __importStar(require('path')));
            const configPaths = [
                path.join(process.cwd(), 'config', 'dealers.json'),
                path.join(process.cwd(), '..', 'legacy-playwright-scraper', 'dealers.json'),
                path.join(__dirname, '..', '..', 'config', 'dealers.json')
            ];
            let dealersData = [];
            for (const p of configPaths) {
                if (fs.existsSync(p)) {
                    dealersData = JSON.parse(fs.readFileSync(p, 'utf-8'));
                    break;
                }
            }
            if (dealersData.length > 0) {
                let matchedDealer = null;
                const normalizedTarget = origin.toLowerCase().replace(/https?:\/\/(www\.)?/, '');
                const normalizedId = (dealerId || '').toLowerCase().replace(/^(store|comp)_/, '');
                for (const store of dealersData) {
                    const storeIdMatch = (store.scraper_store_id || '').toLowerCase() === normalizedId;
                    for (const d of store.dealers || []) {
                        const dUrl = (d.new_inventory_url || '').toLowerCase();
                        const dId = (d.competitor_id || '').toLowerCase();
                        const isTargetMatch = dId === normalizedId || dUrl.includes(normalizedTarget) || (storeIdMatch && (d.dealer_type === 'client' || dId === normalizedId));
                        if (isTargetMatch && d.api_url) {
                            matchedDealer = d;
                            break;
                        }
                    }
                    if (matchedDealer)
                        break;
                }
                if (matchedDealer && matchedDealer.api_url) {
                    const apiUrl = matchedDealer.api_url;
                    const apiKey = matchedDealer.api_key || 'OQa8l7SzMctJyr5bhSG9jYvlGnZUQfgl';
                    console.log(`[Direct API] Found preconfigured API for ${matchedDealer.dealer_name}: ${apiUrl}`);
                    const listings = [];
                    const pageCap = maxPages === 0 ? 1000 : maxPages;
                    // -----------------------------------------------------------------
                    // 1.A. Typesense Search API (Dealer Venom / Modern SPAs)
                    // -----------------------------------------------------------------
                    if (matchedDealer.platform === 'typesense' || apiUrl.includes('typesense')) {
                        const typesenseKey = matchedDealer.api_key || 'eQUa8iq30l8Tu908Drz9WKqar6tCJGd4';
                        let page = 1;
                        const perPage = 250;
                        const seenVins = new Set();
                        let totalCount = 0;
                        while (page <= pageCap) {
                            let res;
                            try {
                                res = await axios_1.default.get(apiUrl, {
                                    params: {
                                        q: '*',
                                        query_by: 'vin',
                                        filter_by: 'condition:=New',
                                        per_page: perPage,
                                        page
                                    },
                                    headers: { 'x-typesense-api-key': typesenseKey },
                                    timeout: 15000,
                                    ...proxyConfig
                                });
                            }
                            catch (reqErr) {
                                if (proxyUrl && proxyUrl !== 'direct') {
                                    console.warn(`[Typesense API] Request with proxy failed (${reqErr.message}). Retrying directly...`);
                                    res = await axios_1.default.get(apiUrl, {
                                        params: {
                                            q: '*',
                                            query_by: 'vin',
                                            filter_by: 'condition:=New',
                                            per_page: perPage,
                                            page
                                        },
                                        headers: { 'x-typesense-api-key': typesenseKey },
                                        timeout: 15000
                                    });
                                }
                                else {
                                    throw reqErr;
                                }
                            }
                            totalCount = res.data?.found || 0;
                            const hits = res.data?.hits || [];
                            for (const hit of hits) {
                                const doc = hit.document;
                                if (!doc?.vin)
                                    continue;
                                const normalizedVin = doc.vin.trim().toUpperCase();
                                if (seenVins.has(normalizedVin))
                                    continue;
                                seenVins.add(normalizedVin);
                                const parseMoney = (val) => {
                                    if (typeof val === 'number')
                                        return val;
                                    if (!val)
                                        return 0;
                                    const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
                                    return isNaN(num) ? 0 : num;
                                };
                                const price = parseMoney(doc.finalPrice) ||
                                    parseMoney(doc.price) ||
                                    parseMoney(doc.internetPrice) ||
                                    parseMoney(doc.sellingPrice) ||
                                    parseMoney(doc.msrp) ||
                                    0;
                                const msrp = parseMoney(doc.msrp) || undefined;
                                const discounts = parseMoney(doc.dealerDiscount) || parseMoney(doc.totalSavings) || undefined;
                                const vdpUrl = doc.vdpUrl ? (doc.vdpUrl.startsWith('http') ? doc.vdpUrl : `${origin}${doc.vdpUrl}`) : origin;
                                const imageUrl = Array.isArray(doc.imageUrls) && doc.imageUrls.length > 0 ? doc.imageUrls[0] : undefined;
                                listings.push({
                                    vin: normalizedVin,
                                    year: parseInt(doc.year, 10) || new Date().getFullYear(),
                                    make: doc.make || 'Unknown',
                                    model: doc.model || 'Unknown',
                                    trim: doc.trim || '',
                                    stockNumber: doc.stockNumber || '',
                                    inventoryType: (doc.condition || 'New').toLowerCase().includes('used') ? 'Used' : 'New',
                                    listPrice: price,
                                    msrp,
                                    dealerDiscount: discounts,
                                    vehicleUrl: vdpUrl,
                                    imageUrl,
                                    dealerId,
                                    extractionSource: 'api',
                                    discoveredAt: new Date().toISOString()
                                });
                            }
                            console.log(`[Direct API] Typesense API page ${page}: fetched ${hits.length} vehicles (${listings.length}/${totalCount} total)`);
                            if (!hits.length || hits.length < perPage || page * perPage >= totalCount) {
                                break;
                            }
                            page++;
                        }
                        if (listings.length > 0) {
                            return { hasDirectApi: true, endpoint: apiUrl, listings };
                        }
                    }
                    // -----------------------------------------------------------------
                    // 1.B. DealerOn Cosmos SRP API
                    // -----------------------------------------------------------------
                    if (matchedDealer.platform === 'dealeron' || apiUrl.includes('/cosmos/srp/vehicles/')) {
                        let page = 1;
                        const pn = 96;
                        const seenVins = new Set();
                        let totalCount = 0;
                        while (page <= pageCap) {
                            const cosmosUrl = `${apiUrl}&pt=${page}&pn=${pn}&displayCardsShown=${(page - 1) * pn}`;
                            let res;
                            try {
                                res = await axios_1.default.get(cosmosUrl, {
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                                        Referer: matchedDealer.new_inventory_url || origin,
                                        Origin: origin
                                    },
                                    timeout: 15000,
                                    ...proxyConfig
                                });
                            }
                            catch (reqErr) {
                                if (proxyUrl && proxyUrl !== 'direct') {
                                    console.warn(`[DealerOn API] Request with proxy failed (${reqErr.message}). Retrying directly...`);
                                    res = await axios_1.default.get(cosmosUrl, {
                                        headers: {
                                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                                            Referer: matchedDealer.new_inventory_url || origin,
                                            Origin: origin
                                        },
                                        timeout: 15000
                                    });
                                }
                                else {
                                    throw reqErr;
                                }
                            }
                            totalCount = res.data?.Paging?.PaginationDataModel?.TotalCount || 0;
                            const cards = res.data?.DisplayCards || [];
                            for (const c of cards) {
                                const vc = c.VehicleCard;
                                if (!vc)
                                    continue;
                                const vin = (vc.VehicleImageCarouselModel?.Vin ||
                                    vc.VehicleImageModel?.VehicleImageCarouselModel?.Vin ||
                                    vc.VehicleImageModel?.Vin ||
                                    vc.Vin ||
                                    vc.VehicleDetailUrl?.match(/[A-HJ-NPR-Z0-9]{17}/)?.[0] ||
                                    vc.VehicleImageModel?.VehicleDetailUrl?.match(/[A-HJ-NPR-Z0-9]{17}/)?.[0] ||
                                    '').toUpperCase();
                                if (!vin || vin.length < 10)
                                    continue;
                                if (seenVins.has(vin))
                                    continue;
                                seenVins.add(vin);
                                let price = parseFloat(String(vc.TaggingPrice || 0).replace(/[^0-9.]/g, '')) || 0;
                                let msrp = undefined;
                                let discounts = undefined;
                                if (vc.VehiclePriceLibrary) {
                                    try {
                                        const decoded = Buffer.from(vc.VehiclePriceLibrary, 'base64').toString('utf-8');
                                        const parts = {};
                                        decoded.split(';').forEach((p) => {
                                            const [k, v] = p.split(':');
                                            if (k && v)
                                                parts[k.trim()] = parseFloat(v);
                                        });
                                        msrp = parts['MSRP'] || parts['calc_MSRP'] || undefined;
                                        price =
                                            parts['Selling Price'] ||
                                                parts['Internet Price'] ||
                                                parts['calc_FINAL PRICE'] ||
                                                parts['calc_INTERNET PRICE'] ||
                                                msrp ||
                                                price;
                                        discounts = parts['calc_Dealer Discount'] || parts['calc_You Save'] || undefined;
                                    }
                                    catch { }
                                }
                                if (!price && msrp)
                                    price = msrp;
                                const nameEncoded = vc.VehicleImageModel?.VehicleNameHtmlEncoded || vc.VehicleTitle || '';
                                const yearMatch = nameEncoded.match(/\b(202[0-9])\b/);
                                const year = yearMatch ? parseInt(yearMatch[1], 10) : parseInt(vc.Year || '2026', 10);
                                const nameWithoutYear = nameEncoded.replace(/\b202[0-9]\b/, '').trim();
                                const nameParts = nameWithoutYear.split(' ').filter(Boolean);
                                const make = vc.Make || nameParts[0] || 'Unknown';
                                const model = nameParts[1] || vc.Model || 'Unknown';
                                const trim = nameParts.slice(2).join(' ') || vc.Trim || '';
                                const vdpUrl = vc.VehicleImageModel?.VehicleDetailUrl || `${origin}/new-${vin}`;
                                const photoSrc = vc.VehicleImageModel?.VehiclePhotoSrc;
                                const imageUrl = photoSrc ? (photoSrc.startsWith('http') ? photoSrc : `${origin}${photoSrc}`) : undefined;
                                listings.push({
                                    vin,
                                    year,
                                    make,
                                    model,
                                    trim,
                                    stockNumber: vc.ShowStockNumber?.StockNumber || vin,
                                    inventoryType: 'New',
                                    listPrice: price,
                                    msrp,
                                    dealerDiscount: discounts,
                                    vehicleUrl: vdpUrl,
                                    imageUrl,
                                    dealerId,
                                    extractionSource: 'api',
                                    discoveredAt: new Date().toISOString()
                                });
                            }
                            console.log(`[Direct API] DealerOn Cosmos API page ${page}: fetched ${cards.length} cards (${listings.length}/${totalCount} total)`);
                            if (!cards.length || cards.length < pn || listings.length >= totalCount || page * pn >= totalCount) {
                                break;
                            }
                            page++;
                        }
                        if (listings.length > 0) {
                            return { hasDirectApi: true, endpoint: apiUrl, listings };
                        }
                    }
                    // -----------------------------------------------------------------
                    // 1.C. CarsCommerce / Dealer Inspire API
                    // -----------------------------------------------------------------
                    let page = 1;
                    const perPage = 100;
                    let totalCount = 0;
                    const seenVins = new Set();
                    const sortField = matchedDealer.api_sort_field || 'stock';
                    const sortOrder = matchedDealer.api_sort_order || 'asc';
                    while (page <= pageCap) {
                        const facetFilters = {};
                        if (matchedDealer.api_type_slug) {
                            facetFilters.type_slug = matchedDealer.api_type_slug;
                        }
                        else {
                            facetFilters.type_slug = ['New'];
                        }
                        if (matchedDealer.api_location_field && matchedDealer.api_location_values) {
                            facetFilters[matchedDealer.api_location_field] = matchedDealer.api_location_values;
                        }
                        const payload = {
                            page,
                            perPage,
                            sort: [{ field: sortField, order: sortOrder }],
                            facetFilters,
                            requestedFields: [
                                'vin', 'stock', 'type', 'year', 'make', 'model', 'trim',
                                'vdp_url', 'pricing', 'extra_fields'
                            ]
                        };
                        const response = await axios_1.default.post(apiUrl, payload, {
                            headers: {
                                'Content-Type': 'application/json',
                                Origin: origin,
                                Referer: matchedDealer.new_inventory_url || origin,
                                'x-api-key': apiKey
                            },
                            timeout: 15000,
                            ...proxyConfig
                        });
                        const rawListings = response.data?.data?.listings || [];
                        totalCount = response.data?.data?.total_vehicle_count || 0;
                        for (const item of rawListings) {
                            if (!item.vin || item.vin.length < 5)
                                continue;
                            const normalizedVin = item.vin.trim().toUpperCase();
                            if (seenVins.has(normalizedVin))
                                continue;
                            seenVins.add(normalizedVin);
                            const price = parseFloat(item.pricing?.our_price || item.pricing?.price || item.pricing?.msrp || 0);
                            const msrp = parseFloat(item.pricing?.msrp || 0) || undefined;
                            const discounts = parseFloat(item.pricing?.discounts || 0) || undefined;
                            listings.push({
                                vin: normalizedVin,
                                year: parseInt(item.year, 10) || new Date().getFullYear(),
                                make: item.make || 'Unknown',
                                model: item.model || 'Unknown',
                                trim: item.trim || '',
                                stockNumber: item.stock || '',
                                inventoryType: (item.type || 'New').toLowerCase().includes('used') ? 'Used' : 'New',
                                listPrice: price,
                                msrp,
                                dealerDiscount: discounts,
                                vehicleUrl: item.vdp_url || matchedDealer.new_inventory_url || origin,
                                imageUrl: item.primary_image_url || undefined,
                                dealerId,
                                extractionSource: 'api',
                                discoveredAt: new Date().toISOString()
                            });
                        }
                        console.log(`[Direct API] CarsCommerce API page ${page}: fetched ${rawListings.length} vehicles (${listings.length}/${totalCount} total)`);
                        if (!rawListings.length || rawListings.length < perPage || page * perPage >= totalCount) {
                            break;
                        }
                        page++;
                    }
                    if (listings.length > 0) {
                        return {
                            hasDirectApi: true,
                            endpoint: apiUrl,
                            listings
                        };
                    }
                }
            }
        }
        catch (confErr) {
            console.warn(`[Direct API] Preconfigured API check failed:`, confErr.message);
        }
        // 1.5. Check Team Velocity native JSON API feed (/inventory-new.json)
        try {
            const tvUrl = `${origin}/inventory-new.json?page=1`;
            const tvRes = await axios_1.default.get(tvUrl, {
                headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'application/json' },
                timeout: 8000,
                ...proxyConfig
            });
            if (tvRes.status === 200 && tvRes.data && Array.isArray(tvRes.data.vehicles) && tvRes.data.vehicles.length > 0) {
                console.log(`[Direct API] Detected Team Velocity native JSON feed: ${tvUrl} (Total stock: ${tvRes.data.totalVehicles || 0})`);
                const listings = [];
                let curPage = 1;
                const totalPages = tvRes.data.totalPages || 1;
                const pageCap = maxPages === 0 ? 1000 : maxPages;
                let pageData = tvRes.data;
                while (curPage <= totalPages && curPage <= pageCap) {
                    if (curPage > 1) {
                        const nextRes = await axios_1.default.get(`${origin}/inventory-new.json?page=${curPage}`, {
                            headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'application/json' },
                            timeout: 10000,
                            ...proxyConfig
                        });
                        pageData = nextRes.data;
                    }
                    const vList = pageData.vehicles || [];
                    for (const v of vList) {
                        if (!v.vin || v.vin.length < 5)
                            continue;
                        const price = parseFloat(v.sellingPrice || v.msrp || 0);
                        const msrp = parseFloat(v.msrp || 0) || undefined;
                        const dealerDiscount = parseFloat(v.dealerDiscount || 0) || undefined;
                        listings.push({
                            vin: v.vin.toUpperCase(),
                            year: parseInt(v.year, 10) || new Date().getFullYear(),
                            make: v.make || 'Unknown',
                            model: v.model || 'Unknown',
                            trim: v.trim || '',
                            stockNumber: v.stockNumber || '',
                            inventoryType: (v.inventoryType || 'New').toLowerCase().includes('used') ? 'Used' : 'New',
                            listPrice: price,
                            msrp,
                            dealerDiscount,
                            mileage: typeof v.miles === 'number' ? v.miles : undefined,
                            vehicleUrl: v.vdpUrl || origin,
                            imageUrl: v.imageUrls && v.imageUrls[0] ? v.imageUrls[0] : undefined,
                            dealerId,
                            extractionSource: 'api',
                            discoveredAt: new Date().toISOString()
                        });
                    }
                    console.log(`[Direct API] Team Velocity page ${curPage}: fetched ${vList.length} vehicles (${listings.length}/${pageData.totalVehicles || 0} total)`);
                    if (curPage >= totalPages || vList.length === 0)
                        break;
                    curPage++;
                }
                if (listings.length > 0) {
                    return {
                        hasDirectApi: true,
                        endpoint: `${origin}/inventory-new.json`,
                        listings
                    };
                }
            }
        }
        catch { }
        // 2. Fallback to candidate endpoint probing
        const candidateEndpoints = [
            `${origin}/inventory/search?format=json&status=new&page=1`,
            `${origin}/api/widget/WSInventorySummary/get/?inventoryType=new`,
            `${origin}/api/inventory?condition=new`,
            `${origin}/api/v1/inventory/search?type=new`
        ];
        for (const endpoint of candidateEndpoints) {
            try {
                const res = await axios_1.default.get(endpoint, {
                    headers: {
                        'User-Agent': DEFAULT_USER_AGENT,
                        Accept: 'application/json'
                    },
                    timeout: 7000,
                    ...proxyConfig
                });
                if (res.status === 200 && res.data) {
                    const data = res.data;
                    const rawVehicles = data.vehicles || data.results || data.data || (Array.isArray(data) ? data : []);
                    if (Array.isArray(rawVehicles) && rawVehicles.length > 0) {
                        const listings = [];
                        for (const item of rawVehicles) {
                            const vin = item.vin || item.VIN || item.vinNumber;
                            if (!vin || vin.length < 5)
                                continue;
                            const year = parseInt(item.year || item.modelYear, 10) || new Date().getFullYear();
                            const make = item.make || item.vehicleMake || 'Unknown';
                            const model = item.model || item.vehicleModel || 'Unknown';
                            const trim = item.trim || item.vehicleTrim || '';
                            const stockNumber = item.stockNumber || item.stock || '';
                            const listPrice = parseFloat(item.price || item.listPrice || item.retailPrice || item.salePrice || 0);
                            const msrp = parseFloat(item.msrp || 0) || undefined;
                            const mileage = parseInt(item.mileage || item.odometer || 0, 10) || undefined;
                            const vehicleUrl = item.url ? (item.url.startsWith('http') ? item.url : `${origin}${item.url}`) : origin;
                            const imageUrl = item.image || item.photoUrl || item.thumbnail || undefined;
                            listings.push({
                                vin: vin.toUpperCase(),
                                year,
                                make,
                                model,
                                trim,
                                stockNumber,
                                inventoryType: 'New',
                                listPrice,
                                msrp,
                                mileage,
                                vehicleUrl,
                                imageUrl,
                                dealerId,
                                extractionSource: 'api',
                                discoveredAt: new Date().toISOString()
                            });
                        }
                        if (listings.length > 0) {
                            return {
                                hasDirectApi: true,
                                endpoint,
                                listings
                            };
                        }
                    }
                }
            }
            catch {
                // Continue probing other candidate endpoints
            }
        }
        return {
            hasDirectApi: false,
            listings: []
        };
    }
}
exports.PlatformDetector = PlatformDetector;
