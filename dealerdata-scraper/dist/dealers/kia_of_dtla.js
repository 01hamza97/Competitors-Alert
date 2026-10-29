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
exports.KiaOfDtlaInventoryScraper = void 0;
const vehicleNormalization_1 = require("../utils/vehicleNormalization");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
class KiaOfDtlaInventoryScraper {
    id = 'kia_of_dtla';
    name = 'KIA Of DTLA';
    domain = 'kiaofdtla.com';
    inventoryUrls = {
        new: 'https://www.kiaofdtla.com/inventory/new',
        used: 'https://www.kiaofdtla.com/inventory/used'
    };
    useDirectConnection = true;
    userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    async scrape(ctx) {
        const { targetUrl, dealerId, dealerName, inventoryType, maxPages, logger } = ctx;
        logger.log(`Starting dedicated inventory scrape for ${dealerName} (${dealerId})...`);
        const rootUrl = 'https://www.kiaofdtla.com';
        const baseUrl = inventoryType === 'Used' ? `${rootUrl}/inventory/used` : `${rootUrl}/inventory/new`;
        logger.log(`Fetching model directory page: ${baseUrl}...`);
        const initialResp = await axios_1.default.get(baseUrl, {
            headers: { 'User-Agent': this.userAgent, Accept: 'text/html' },
            timeout: 15000
        });
        const initialHtml = initialResp.data;
        // Extract model paths like /inventory/new/kia/sorento
        const pathPattern = inventoryType === 'Used'
            ? /inventory\/used\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/g
            : /inventory\/new\/kia\/[a-zA-Z0-9-]+/g;
        const matchedPaths = initialHtml.match(pathPattern) || [];
        const uniqueModelPaths = Array.from(new Set(matchedPaths));
        logger.log(`Found ${uniqueModelPaths.length} distinct model categories on ${dealerName}.`);
        const allListings = [];
        const seenVins = new Set();
        let totalPagesCrawled = 1;
        for (const modelPath of uniqueModelPaths) {
            let page = 1;
            const modelMaxPages = maxPages && maxPages > 0 ? maxPages : 10;
            while (page <= modelMaxPages) {
                const pageUrl = `${rootUrl}/${modelPath}?paymenttype=cash&instock=true&intransit=true&inproduction=true&page=${page}`;
                try {
                    const resp = await axios_1.default.get(pageUrl, {
                        headers: { 'User-Agent': this.userAgent, Accept: 'text/html' },
                        timeout: 15000
                    });
                    totalPagesCrawled++;
                    const $ = cheerio.load(resp.data);
                    const boxes = $('.srp-vehicle-box');
                    if (boxes.length === 0) {
                        break;
                    }
                    let newOnPage = 0;
                    boxes.each((i, el) => {
                        const card = $(el);
                        const vinText = card.find('.vin').text().trim();
                        const vinMatch = vinText.match(/[A-HJ-NPR-Z0-9]{17}/);
                        if (!vinMatch)
                            return;
                        const vin = vinMatch[0].toUpperCase();
                        if (seenVins.has(vin))
                            return;
                        seenVins.add(vin);
                        newOnPage++;
                        const rawTitle = card.find('.vehicle-title, h2, h3, [class*="title"]').first().text().trim().replace(/\s+/g, ' ');
                        const rawStock = card.find('.stockNumber, .stock, [class*="stock"]').first().text().trim().replace(/\s+/g, ' ');
                        const stockNumber = rawStock.replace(/^stock\s*/i, '').replace(/[^a-zA-Z0-9-]/g, '').trim() || undefined;
                        const cardHref = card.attr('href') || '';
                        const vehicleUrl = cardHref.startsWith('http') ? cardHref : `${rootUrl}${cardHref}`;
                        const imgEl = card.find('img').first();
                        const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || undefined;
                        // Pricing extraction
                        const cardText = card.text().replace(/\s+/g, ' ');
                        let listPrice = 0;
                        let msrp;
                        const totalMatch = cardText.match(/Total\s+Price\s*\$([0-9,]+)/i) ||
                            cardText.match(/Total\s+Sales\s+Price\s*\$([0-9,]+)/i) ||
                            cardText.match(/Sale\s+Price\s*\$([0-9,]+)/i) ||
                            cardText.match(/Our\s+Price\s*\$([0-9,]+)/i);
                        if (totalMatch) {
                            listPrice = parseFloat(totalMatch[1].replace(/,/g, ''));
                        }
                        const msrpMatch = cardText.match(/MSRP\s*\$([0-9,]+)/i);
                        if (msrpMatch) {
                            msrp = parseFloat(msrpMatch[1].replace(/,/g, ''));
                        }
                        if (!listPrice && msrp) {
                            listPrice = msrp;
                        }
                        const dealerDiscount = msrp && listPrice && msrp > listPrice ? msrp - listPrice : undefined;
                        // Model / Year / Trim extraction
                        const yearMatch = rawTitle.match(/\b(202[4-9])\b/);
                        const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
                        const titleWithoutYear = rawTitle.replace(/\b202[4-9]\b/, '').trim();
                        const words = titleWithoutYear.split(' ').filter(Boolean);
                        let make = 'Kia';
                        let model = 'Unknown';
                        let trim;
                        if (words[0] && words[0].toLowerCase() === 'kia') {
                            model = words[1] || 'Unknown';
                            if (words[2] && /hybrid|ev|phev|plug-in/i.test(words[2])) {
                                model = `${words[1]} ${words[2]}`;
                                trim = words.slice(3).join(' ') || undefined;
                            }
                            else {
                                trim = words.slice(2).join(' ') || undefined;
                            }
                        }
                        else if (words.length > 0) {
                            model = words[0];
                            trim = words.slice(1).join(' ') || undefined;
                        }
                        const normMake = (0, vehicleNormalization_1.normalizeMake)(make);
                        const normModel = (0, vehicleNormalization_1.normalizeModel)(normMake, model);
                        allListings.push({
                            vin,
                            year,
                            make: normMake,
                            model: normModel,
                            trim,
                            stockNumber,
                            inventoryType: inventoryType === 'Used' ? 'Used' : 'New',
                            listPrice,
                            msrp,
                            dealerDiscount,
                            vehicleUrl,
                            imageUrl,
                            dealerId,
                            dealerName,
                            extractionSource: 'html_srp',
                            discoveredAt: new Date().toISOString()
                        });
                    });
                    if (newOnPage > 0) {
                        const categoryName = modelPath.split('/').pop() || modelPath;
                        logger.log(`[${categoryName}] Page ${page}: extracted ${newOnPage} vehicles (running total: ${allListings.length})`);
                    }
                    if (newOnPage === 0) {
                        break;
                    }
                    page++;
                }
                catch (pageErr) {
                    logger.warn(`Error on ${modelPath} page ${page}: ${pageErr.message}`);
                    break;
                }
            }
        }
        logger.log(`Successfully extracted ${allListings.length} listings from SRP model categories.`);
        // Supplementary Step: Check inventoryvdpsitemap.xml for active dealer inventory not indexed in SRP model categories
        try {
            const sitemapUrl = `${rootUrl}/inventoryvdpsitemap.xml`;
            logger.log(`Auditing sitemap ${sitemapUrl} for unindexed lot units...`);
            const sitemapResp = await axios_1.default.get(sitemapUrl, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 10000
            });
            const sitemapXml = sitemapResp.data;
            const urlMatches = sitemapXml.match(/<loc>(.*?)<\/loc>/g) || [];
            const cleanUrls = urlMatches.map(u => u.replace(/<\/?loc>/g, ''));
            const targetTypePrefix = inventoryType === 'Used' ? '/viewdetails/used/' : '/viewdetails/new/';
            const missingVdpUrls = [];
            for (const u of cleanUrls) {
                if (!u.includes(targetTypePrefix))
                    continue;
                const vinMatch = u.match(/\/([a-zA-Z0-9]{17})\//i);
                if (!vinMatch)
                    continue;
                const vin = vinMatch[1].toUpperCase();
                if (!seenVins.has(vin)) {
                    seenVins.add(vin);
                    missingVdpUrls.push({ vin, url: u });
                }
            }
            if (missingVdpUrls.length > 0) {
                logger.log(`Found ${missingVdpUrls.length} unindexed units in sitemap. Hydrating details via VDP...`);
                const chunkSize = 10;
                for (let i = 0; i < missingVdpUrls.length; i += chunkSize) {
                    const chunk = missingVdpUrls.slice(i, i + chunkSize);
                    await Promise.all(chunk.map(async ({ vin, url }) => {
                        try {
                            totalPagesCrawled++;
                            const vdpResp = await axios_1.default.get(url, {
                                headers: { 'User-Agent': this.userAgent },
                                timeout: 10000
                            });
                            const $vdp = cheerio.load(vdpResp.data);
                            const rawTitle = $vdp('h1').text().trim().replace(/\s+/g, ' ') ||
                                $vdp('title').text().trim().replace(/\s+/g, ' ');
                            const pageText = $vdp('body').text().replace(/\s+/g, ' ');
                            let listPrice = 0;
                            let msrp;
                            const totalMatch = pageText.match(/Total\s+Price\s*\$([0-9,]+)/i) ||
                                pageText.match(/Total\s+Sales\s+Price\s*\$([0-9,]+)/i) ||
                                pageText.match(/Sale\s+Price\s*\$([0-9,]+)/i) ||
                                pageText.match(/Our\s+Price\s*\$([0-9,]+)/i);
                            if (totalMatch) {
                                listPrice = parseFloat(totalMatch[1].replace(/,/g, ''));
                            }
                            const msrpMatch = pageText.match(/MSRP\s*\$([0-9,]+)/i);
                            if (msrpMatch) {
                                msrp = parseFloat(msrpMatch[1].replace(/,/g, ''));
                            }
                            if (!listPrice && msrp) {
                                listPrice = msrp;
                            }
                            const stockField = $vdp('.stock-number-field').text().trim();
                            const stockMatch = stockField.replace(/stock:?\s*/i, '').replace(/[^a-zA-Z0-9-]/g, '').trim();
                            const stockNumber = stockMatch || undefined;
                            const imageUrl = $vdp('meta[property="og:image"]').attr('content') || undefined;
                            // Parse title
                            const yearMatch = rawTitle.match(/\b(202[4-9])\b/);
                            const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
                            const titleWithoutYear = rawTitle.replace(/\b202[4-9]\b/, '').replace(/Kia\s+Downtown.*$/i, '').trim();
                            const words = titleWithoutYear.split(' ').filter(Boolean);
                            let make = 'Kia';
                            let model = 'Unknown';
                            let trim;
                            if (words[0] && words[0].toLowerCase() === 'kia') {
                                model = words[1] || 'Unknown';
                                if (words[2] && /hybrid|ev|phev|plug-in/i.test(words[2])) {
                                    model = `${words[1]} ${words[2]}`;
                                    trim = words.slice(3).join(' ') || undefined;
                                }
                                else {
                                    trim = words.slice(2).join(' ') || undefined;
                                }
                            }
                            else if (words.length > 0) {
                                model = words[0];
                                trim = words.slice(1).join(' ') || undefined;
                            }
                            const normMake = (0, vehicleNormalization_1.normalizeMake)(make);
                            const normModel = (0, vehicleNormalization_1.normalizeModel)(normMake, model);
                            allListings.push({
                                vin,
                                year,
                                make: normMake,
                                model: normModel,
                                trim,
                                stockNumber,
                                inventoryType: inventoryType === 'Used' ? 'Used' : 'New',
                                listPrice,
                                msrp,
                                dealerDiscount: msrp && listPrice && msrp > listPrice ? msrp - listPrice : undefined,
                                vehicleUrl: url,
                                imageUrl,
                                dealerId,
                                dealerName,
                                extractionSource: 'sitemap_vdp',
                                discoveredAt: new Date().toISOString()
                            });
                        }
                        catch (err) {
                            const urlParts = url.split('/').filter(Boolean);
                            const slug = urlParts[urlParts.length - 1] || '';
                            const slugParts = slug.split('-');
                            const year = parseInt(slugParts[0], 10) || new Date().getFullYear();
                            const make = 'Kia';
                            const model = slugParts[2] ? slugParts[2].toUpperCase() : 'Unknown';
                            allListings.push({
                                vin,
                                year,
                                make: (0, vehicleNormalization_1.normalizeMake)(make),
                                model: (0, vehicleNormalization_1.normalizeModel)('Kia', model),
                                inventoryType: inventoryType === 'Used' ? 'Used' : 'New',
                                listPrice: 0,
                                vehicleUrl: url,
                                dealerId,
                                dealerName,
                                extractionSource: 'sitemap_vdp',
                                discoveredAt: new Date().toISOString()
                            });
                        }
                    }));
                }
                logger.log(`Hydrated ${missingVdpUrls.length} sitemap units. Total inventory count is now ${allListings.length}.`);
            }
        }
        catch (sitemapErr) {
            logger.warn(`Sitemap fallback error: ${sitemapErr.message}`);
        }
        logger.log(`Successfully completed scrape with ${allListings.length} total listings.`);
        return {
            listings: allListings,
            pagesCrawled: totalPagesCrawled,
            engineUsed: 'http'
        };
    }
}
exports.KiaOfDtlaInventoryScraper = KiaOfDtlaInventoryScraper;
