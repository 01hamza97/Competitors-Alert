import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { CompetitorVehicleSpecial, StagedVisualSpecial, SpecialsExtractionResult } from '../types';
import { PlaywrightCrawler } from './playwrightCrawler';
import { normalizeDomain } from '../utils/domain';
import { getAxiosProxyConfig } from './proxyHelper';

const KNOWN_MAKES = [
  'Jeep', 'Ram', 'Dodge', 'Chrysler', 'Ford', 'Chevrolet', 'Chevy', 'GMC',
  'Buick', 'Cadillac', 'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia',
  'Subaru', 'Mazda', 'Volkswagen', 'VW', 'BMW', 'Mercedes-Benz', 'Mercedes',
  'Audi', 'Lexus', 'Acura', 'Infiniti', 'Lincoln', 'Volvo', 'Porsche',
  'Genesis', 'Land Rover', 'Jaguar', 'Alfa Romeo', 'Maserati'
];

const EXCLUDE_IMAGE_PATTERNS = [
  'logo', 'icon', 'favicon', 'placeholder', 'adchoice', 'comply',
  'cookiebanner', 'tracking', 'analytics', 'pixel', 'badge', 'button',
  'arrow', '.svg', '1x1', 'spacer', 'blank', 'adchoices', 'complyauto',
  'gravatar', 'avatar', 'social', 'header', 'footer', 'nav', 'menu',
  'star', 'rating', 'chat', 'spinner', 'loading', 'loader'
];

const SPECIAL_IMAGE_CDNS = [
  'vehicle-images.carscommerce.inc',
  'di-uploads-pod',
  'pictures.dealer.com',
  'gtmassets.dealerinspire.com',
  'images.dealer.com',
  'pixelmotion.com',
  'dealerspike.com'
];

export class SpecialsExtractor {
  /**
   * Fetches the specials page using fast HTTP with stealth headers,
   * falling back to Playwright if blocked (403/503/Cloudflare) or dynamic JS rendering.
   */
  static async fetchSpecialsHtml(specialsUrl: string): Promise<string> {
    console.log(`[SpecialsExtractor] Fetching specials page: ${specialsUrl}`);

    let httpHtmlFallback: string | null = null;

    // Strategy 1: Fast HTTP GET with stealth browser headers
    try {
      const response = await axios.get(specialsUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        },
        timeout: 15000,
        maxRedirects: 5,
        ...getAxiosProxyConfig()
      });

      const html = String(response.data || '');
      // Check if html contains rendered specials cards with actual prices (avoid static JSON-LD shells without pricing)
      const hasPriceNumbers = /\$\s*[0-9]{2,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?/.test(html);
      const hasRenderedCards =
        /class=["'][^"']*(?:promo-type-vehicle|special-card|offer-card|vehicle-special|wsm-specials|special-item|deal-item)/i.test(html) &&
        hasPriceNumbers;
      const isDynamicOfferDetails = specialsUrl.includes('offerdetails-') || specialsUrl.includes('manager-special');

      if (
        html.length > 1000 &&
        !html.includes('cf-browser-verification') &&
        !html.includes('Just a moment...') &&
        !html.includes('Access Denied')
      ) {
        httpHtmlFallback = html;
      }

      if (
        html.length > 1000 &&
        (hasRenderedCards || specialsUrl.includes('flags.type=')) &&
        !isDynamicOfferDetails &&
        !html.includes('cf-browser-verification') &&
        !html.includes('Just a moment...')
      ) {
        console.log(`[SpecialsExtractor] Successfully fetched ${html.length} bytes with rendered specials via HTTP.`);
        return html;
      }
      console.log(`[SpecialsExtractor] Static HTML lacks rendered price components (or is a dynamic offer details page). Using Playwright headless browser to render dynamic specials...`);
    } catch (httpErr: any) {
      console.log(`[SpecialsExtractor] HTTP fetch failed (${httpErr.message}). Falling back to Playwright headless browser...`);
    }

    // Strategy 2: Headless Playwright Browser
    const playwright = new PlaywrightCrawler();
    try {
      await playwright.init();
      const page = await (playwright as any).context.newPage();
      try {
        const parsed = new URL(specialsUrl);
        const originUrl = parsed.origin;

        // Step 2.1: Pre-warm origin homepage to obtain Cloudflare / CDN session cookies and bypass 403 bot challenges
        try {
          console.log(`[SpecialsExtractor] Pre-warming connection via origin homepage: ${originUrl}`);
          await page.goto(originUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(3000);
        } catch (warmErr: any) {
          console.log(`[SpecialsExtractor] Pre-warm notice: ${warmErr.message}`);
        }

        // Step 2.2: Navigate to target specials URL
        console.log(`[SpecialsExtractor] Navigating to specials URL: ${specialsUrl}`);
        const response = await page.goto(specialsUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(2000);

        // Step 2.3: Wait for Cloudflare challenge / Turnstile to resolve
        const challengeStart = Date.now();
        const maxChallengeWaitMs = 35000;
        let isChallenge = false;

        while (Date.now() - challengeStart < maxChallengeWaitMs) {
          let bodyText = '';
          let pageTitle = '';
          let hasCfWrapper = false;
          let hasTurnstile = false;

          try {
            bodyText = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
            pageTitle = await page.title().catch(() => '');
            hasCfWrapper = await page.evaluate(() => document.querySelector('.di-cf-wrapper') !== null).catch(() => false);
            hasTurnstile = await page.locator('#challenge-stage iframe, iframe[src*="cloudflare"], .ctp-checkbox-label, .di-cf-wrapper').first().isVisible({ timeout: 200 }).catch(() => false);
          } catch {
            await page.waitForTimeout(1000);
            continue;
          }

          const inChallenge =
            bodyText.includes('Verifying you are human') ||
            bodyText.includes('Verification successful') ||
            bodyText.includes('cf-browser-verification') ||
            pageTitle.includes('Just a moment') ||
            pageTitle.includes('Attention Required') ||
            pageTitle === 'Dealer Website' ||
            hasCfWrapper ||
            hasTurnstile;

          if (inChallenge) {
            isChallenge = true;
            console.log(`[SpecialsExtractor] Cloudflare challenge active on ${specialsUrl}. Waiting (${Math.round((Date.now() - challengeStart) / 1000)}s)...`);
            try {
              const cfBox = page.locator('#challenge-stage iframe, iframe[src*="cloudflare"], .ctp-checkbox-label').first();
              if (await cfBox.isVisible({ timeout: 300 })) {
                await cfBox.click({ timeout: 600 }).catch(() => {});
              }
            } catch {}
            await page.waitForTimeout(1500);
          } else {
            if (isChallenge) {
              console.log(`[SpecialsExtractor] Challenge cleared after ${Math.round((Date.now() - challengeStart) / 1000)}s on ${specialsUrl}. Waiting for settle...`);
              await page.waitForTimeout(2000);
            }
            break;
          }
        }

        // Wait for dynamic specials or price cards to hydrate in DOM
        try {
          await page.waitForSelector(
            '.vehiclePricingDetails, .priceBlockItem, [id^="buy-"], .special-card, .offer-card, .promo, .vehicle-special, .deal-item',
            { timeout: 8000 }
          );
        } catch {}

        // Scroll to bottom and back to top to trigger lazy loaded images
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)).catch(() => {});
        await page.waitForTimeout(1000);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
        await page.waitForTimeout(1500);
        await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
        await page.waitForTimeout(500);

        const renderedHtml = await page.content();
        console.log(`[SpecialsExtractor] Playwright rendered ${renderedHtml.length} bytes of dynamic DOM.`);
        if (
          (renderedHtml.length < 500 ||
            renderedHtml.includes('Access Denied') ||
            renderedHtml.includes('errors.edgesuite.net')) &&
          httpHtmlFallback
        ) {
          console.log(`[SpecialsExtractor] Playwright was blocked by WAF/Access Denied. Using HTTP fallback HTML (${httpHtmlFallback.length} bytes)...`);
          return httpHtmlFallback;
        }
        return renderedHtml;
      } finally {
        await page.close().catch(() => {});
        await playwright.close().catch(() => {});
      }
    } catch (pwErr: any) {
      console.error(`[SpecialsExtractor] Playwright fetch failed: ${pwErr.message}`);
      if (httpHtmlFallback) {
        console.log(`[SpecialsExtractor] Using HTTP fallback HTML (${httpHtmlFallback.length} bytes)...`);
        return httpHtmlFallback;
      }
      return '';
    }
  }

  /**
   * Main extractor: inspects HTML for structured HTML component cards vs visual banner images.
   * - If HTML component cards with pricing are found, extracts them into `htmlSpecials`.
   * - If visual images/banners are found, downloads them to disk and creates `visualSpecials` staging records.
   */
  static async extract(
    html: string,
    specialsUrl: string,
    dealerId: string,
    dealerName: string
  ): Promise<SpecialsExtractionResult> {
    const $ = cheerio.load(html);
    const parsedUrl = new URL(specialsUrl);
    const origin = parsedUrl.origin;
    const today = new Date().toISOString().split('T')[0];
    const cleanDealerId = (dealerId || '').replace(/^store_/, '');

    const htmlSpecials: CompetitorVehicleSpecial[] = [];
    const seenSpecialKeys = new Set<string>();
    const modelImageMap = new Map<string, string>();

    const addSpecial = (spec: CompetitorVehicleSpecial) => {
      // Ensure id fits safely within MySQL column constraints (max 50 chars)
      if (spec.id && spec.id.length > 50) {
        const hash = crypto.createHash('md5').update(spec.id).digest('hex').slice(0, 8);
        spec.id = `${spec.id.slice(0, 40)}_${hash}`;
      }
      const key = `${spec.year}_${spec.make}_${spec.model}_${spec.specialType}_${spec.monthlyPayment || spec.msrp || spec.apr || spec.title}`.toLowerCase();
      if (!seenSpecialKeys.has(key)) {
        seenSpecialKeys.add(key);
        htmlSpecials.push(spec);
      }
    };

    // -----------------------------------------------------------------------
    // STEP 0: Check Direct Platform Search API for Specials (e.g. Typesense / Dealer Venom)
    // -----------------------------------------------------------------------
    try {
      const configPaths = [
        path.join(process.cwd(), 'config', 'dealers.json'),
        path.join(process.cwd(), '..', 'legacy-playwright-scraper', 'dealers.json'),
        path.join(__dirname, '..', '..', 'config', 'dealers.json')
      ];

      let dealersData: any[] = [];
      for (const p of configPaths) {
        if (fs.existsSync(p)) {
          dealersData = JSON.parse(fs.readFileSync(p, 'utf-8'));
          break;
        }
      }

      if (dealersData.length > 0) {
        let matchedDealer: any = null;
        const normalizedTarget = origin.toLowerCase().replace(/https?:\/\/(www\.)?/, '');
        const normalizedId = cleanDealerId.toLowerCase();

        for (const store of dealersData) {
          const storeIdMatch = (store.scraper_store_id || '').toLowerCase() === normalizedId;
          for (const d of store.dealers || []) {
            const dUrl = (d.new_inventory_url || '').toLowerCase();
            const dId = (d.competitor_id || '').toLowerCase();
            const isTargetMatch = dId === normalizedId || dUrl.includes(normalizedTarget) || (storeIdMatch && (d.dealer_type === 'client' || dId === normalizedId));
            if (isTargetMatch && (d.api_url || d.platform === 'typesense')) {
              matchedDealer = d;
              break;
            }
          }
          if (matchedDealer) break;
        }

        if (matchedDealer && (matchedDealer.platform === 'typesense' || matchedDealer.api_url?.includes('typesense'))) {
          const apiUrl = matchedDealer.api_url;
          const apiKey = matchedDealer.api_key || 'eQUa8iq30l8Tu908Drz9WKqar6tCJGd4';
          console.log(`[SpecialsExtractor] Found Typesense API for specials (${matchedDealer.dealer_name}): ${apiUrl}`);

          const res = await axios.get(apiUrl, {
            params: {
              q: '*',
              query_by: 'vin',
              filter_by: 'condition:=New && flags.type:=Special',
              per_page: 250
            },
            headers: { 'x-typesense-api-key': apiKey },
            timeout: 15000,
            ...getAxiosProxyConfig()
          });

          const hits = res.data?.hits || [];
          console.log(`[SpecialsExtractor] Typesense returned ${hits.length} active specials.`);

          for (const hit of hits) {
            const doc = hit.document;
            if (!doc?.vin) continue;
            const vin = doc.vin.trim().toUpperCase();
            const year = parseInt(doc.year, 10) || new Date().getFullYear();
            const make = doc.make || 'Ford';
            const model = doc.model || 'Unknown';
            const trim = doc.trim || '';
            const title = doc.vehicleTitle || `${year} ${make} ${model} ${trim}`.trim();

            const msrp = parseFloat(String(doc.msrp || '').replace(/[^0-9.]/g, '')) || undefined;
            const price = typeof doc.price === 'number'
              ? doc.price
              : parseFloat(String(doc.finalPrice || doc.sellingPrice || doc.price || 0).replace(/[^0-9.]/g, '')) || msrp;

            let specialType: 'lease' | 'finance' | 'cash' = 'cash';
            let disclaimer = '';
            let expirationDate: string | undefined = undefined;

            if (doc.incentives && Array.isArray(doc.incentives) && doc.incentives.length > 0) {
              const inc = doc.incentives[0];
              if (inc.disclaimer) disclaimer = inc.disclaimer;
              if (inc.expiryDate) expirationDate = inc.expiryDate.split('T')[0];
              if (inc.title?.toLowerCase().includes('finance') || inc.description?.toLowerCase().includes('apr')) {
                specialType = 'finance';
              }
            }
            if (!disclaimer && doc.dealerFees?.[0]?.disclaimer) {
              disclaimer = doc.dealerFees[0].disclaimer;
            }

            const vdpUrl = doc.vdpUrl ? (doc.vdpUrl.startsWith('http') ? doc.vdpUrl : `${origin}${doc.vdpUrl}`) : specialsUrl;
            const imageUrl = Array.isArray(doc.imageUrls) && doc.imageUrls.length > 0 ? doc.imageUrls[0] : undefined;

            addSpecial({
              id: `spc_${cleanDealerId}_${vin}`,
              dealerId: cleanDealerId,
              offerDealerName: dealerName,
              snapshotDate: today,
              year,
              make,
              model,
              trim,
              specialType,
              msrp,
              title,
              disclaimer: disclaimer || undefined,
              expirationDate,
              specialUrl: vdpUrl,
              imageUrl,
              domain: origin.replace(/https?:\/\//, '')
            });
          }
        }
      }
    } catch (apiErr: any) {
      console.warn(`[SpecialsExtractor] Notice: Direct specials API query failed:`, apiErr.message);
    }

    // -----------------------------------------------------------------------
    // STEP 1A: Extract Schema.org JSON-LD Vehicle Offers (Standard on Dealer.com, DealerOn, DealerInspire)
    // -----------------------------------------------------------------------
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const rawContent = $(el).html();
        if (!rawContent) return;
        const json = JSON.parse(rawContent);

        const offerItems: any[] = [];
        if (Array.isArray(json.about?.offers?.itemOffered)) {
          offerItems.push(...json.about.offers.itemOffered);
        }
        if (Array.isArray(json.itemListElement)) {
          for (const item of json.itemListElement) {
            offerItems.push(item.item || item);
          }
        }
        if (
          json['@type'] === 'Vehicle' ||
          json['@type'] === 'Car' ||
          json['@type'] === 'Product' ||
          json['@type'] === 'Offer'
        ) {
          offerItems.push(json);
        }

        offerItems.forEach((v: any, index: number) => {
          const rawPrice = v.offers?.price || v.offers?.[0]?.price || v.price;
          const price = rawPrice ? parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) : undefined;
          let year = parseInt(v.vehicleModelDate || v.modelDate || 0, 10);
          let make = v.brand?.name || v.manufacturer?.name || v.brand || 'Unknown';
          let model = v.model || 'Unknown';
          let title = v.name || `${year || ''} ${make} ${model}`.trim();
          const imageUrl = typeof v.image === 'string' ? v.image : (Array.isArray(v.image) ? v.image[0] : undefined);
          const itemUrl = v.url || v.offers?.url || v.offers?.[0]?.url;
          const resolvedUrl = itemUrl ? (itemUrl.startsWith('http') ? itemUrl : `${origin}${itemUrl.startsWith('/') ? '' : '/'}${itemUrl}`) : specialsUrl;

          if (!year) {
            const yearMatch = title.match(/\b(202[3-7])\b/);
            if (yearMatch) year = parseInt(yearMatch[1], 10);
            else year = new Date().getFullYear();
          }

          if (make === 'Unknown') {
            for (const m of KNOWN_MAKES) {
              if (new RegExp(`\\b${m}\\b`, 'i').test(title)) {
                make = m;
                break;
              }
            }
            if (make === 'Unknown') {
              for (const m of KNOWN_MAKES) {
                if (new RegExp(`\\b${m}\\b`, 'i').test(dealerName + ' ' + specialsUrl)) {
                  make = m;
                  break;
                }
              }
            }
          }

          if (imageUrl && make !== 'Unknown' && model !== 'Unknown') {
            modelImageMap.set(`${year}_${make}_${model}`.toLowerCase(), imageUrl);
            modelImageMap.set(`${make}_${model}`.toLowerCase(), imageUrl);
          }

          // Extract Trim
          let trim: string | undefined = v.vehicleConfiguration || v.trim;
          if (model === 'Unknown' && make !== 'Unknown') {
            const { normalizeVehicle } = require('../utils/vehicleNormalization');
            const cleanTitle = title.replace(/\b(NEW|USED|CERTIFIED|APR|Offer valid through.*)\b/gi, '').trim();
            const norm = normalizeVehicle({ make, model: cleanTitle });
            if (norm.model) {
              model = norm.model;
              if (!trim && norm.trim) trim = norm.trim;
            }
          } else if (!trim && title && make !== 'Unknown' && model !== 'Unknown') {
            const safeMake = make.replace(/[^a-zA-Z0-9]/g, '\\$&');
            const safeModel = model.replace(/[^a-zA-Z0-9]/g, '\\$&');
            const trimRegex = new RegExp(`\\b${safeMake}\\s+${safeModel}\\s+([^,\\-\\n\\|#]+)`, 'i');
            const tMatch = title.match(trimRegex);
            if (tMatch && tMatch[1]) {
              const candidate = tMatch[1].replace(/\b(4x4|4x2|AWD|FWD|RWD|New|Used|Certified|VIN:.*|Stock:.*)\b/gi, '').trim();
              if (candidate && candidate.length < 50) {
                trim = candidate;
              }
            }
          }

          // Parse detailed pricing / lease parameters from JSON-LD
          const desc = v.description || v.offers?.description || '';
          let monthlyPayment: number | undefined;
          let termMonths: number | undefined;
          let downPayment: number | undefined;
          let apr: number | undefined;
          let specialType: 'lease' | 'finance' | 'cash' = 'cash';

          const combinedText = `${title} ${desc} ${JSON.stringify(v.offers || {})}`;

          const monthMatch = combinedText.match(/\$(?:USD\s*)?([0-9]{2,4})(?:\.[0-9]{2})?\s*(?:\/|\s+per\s+)?mo\b/i);
          if (monthMatch) {
            monthlyPayment = parseFloat(monthMatch[1]);
            specialType = 'lease';
          }

          const termMatch = combinedText.match(/\b([0-9]{2})\s*(?:months|month|mos|mo)\b/i);
          if (termMatch) {
            termMonths = parseInt(termMatch[1], 10);
          }

          const downMatch = combinedText.match(/\$(?:USD\s*)?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{2,5})\s*(?:due at signing|down payment|down|initial payment|DAS)\b/i);
          if (downMatch) {
            downPayment = parseFloat(downMatch[1].replace(/,/g, ''));
          }

          const aprMatch = combinedText.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*apr/i);
          if (aprMatch) {
            apr = parseFloat(aprMatch[1]);
            if (!monthlyPayment) specialType = 'finance';
          }

          if (!monthlyPayment && price && price >= 99 && price <= 1800 && /\b(lease|mo|month|pmt|payment)\b/i.test(combinedText)) {
            monthlyPayment = price;
            specialType = 'lease';
          }

          const expirationDate = v.validThrough ? v.validThrough.split('T')[0] : undefined;
          const isOffer = v['@type'] === 'Offer';

          if (make !== 'Unknown' && (price || title || monthlyPayment || isOffer)) {
            addSpecial({
              id: `spc_${cleanDealerId}_${year}_${make}_${model.replace(/[^a-zA-Z0-9]/g, '_')}_jsonld_${index}`,
              dealerId: cleanDealerId,
              offerDealerName: dealerName,
              snapshotDate: today,
              year,
              make,
              model,
              trim,
              specialType: /apr/i.test(title) ? 'finance' : specialType,
              msrp: price,
              monthlyPayment,
              termMonths,
              downPayment,
              apr,
              expirationDate,
              title: title.slice(0, 190),
              specialUrl: resolvedUrl,
              imageUrl
            });
          }
        });
      } catch (err) {}
    });

    // -----------------------------------------------------------------------
    // STEP 1B: Extract Platform Native State & Incentives (e.g. Dealer.com DDC.WS.state)
    // -----------------------------------------------------------------------
    const ddcMatches = [...html.matchAll(/DDC\.WS\.state\['ws-inv-data'\]\['([^']+)'\]\s*=\s*({.+?});(?:\n|<\/script>)/gs)];
    for (const m of ddcMatches) {
      try {
        const bus = JSON.parse(m[2]);
        const incs = bus.WIS?.incentives || bus.incentives || {};
        const incKeys = Object.keys(incs);

        incKeys.forEach((k, index) => {
          const inc = incs[k];
          const fullTitle = inc.shortTitle || inc.title;
          if (!fullTitle) return;

          let specialType: 'lease' | 'finance' | 'cash' = 'lease';
          if (inc.specific?._type === 'FINANCE') specialType = 'finance';
          else if (inc.specific?._type === 'CASH') specialType = 'cash';
          else if (/apr/i.test(fullTitle)) specialType = 'finance';
          else if (/cash|rebate/i.test(fullTitle)) specialType = 'cash';

          let apr: number | undefined;
          const aprMatch = `${fullTitle} ${inc.disclaimer || ''}`.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*apr/i);
          if (aprMatch) apr = parseFloat(aprMatch[1]);

          let termMonths: number | undefined;
          const termMatch = `${fullTitle} ${inc.disclaimer || ''}`.match(/\b([0-9]{2})\s*(?:months|month|mos|mo)\b/i);
          if (termMatch) termMonths = parseInt(termMatch[1], 10);

          let downPayment: number | undefined;
          const downMatch = (inc.disclaimer || '').match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{2,5})\s*(?:down payment|down|due at signing)/i);
          if (downMatch) downPayment = parseFloat(downMatch[1].replace(/,/g, ''));

          let monthlyPayment: number | undefined;
          const monthMatch = (inc.disclaimer || '').match(/\$([0-9]{2,4})(?:\.[0-9]{2})?\s*(?:monthly payments|\/mo|per month)/i);
          if (monthMatch) monthlyPayment = parseFloat(monthMatch[1]);
          else if (specialType === 'cash') {
            const cashMatch = `${fullTitle} ${inc.disclaimer || ''}`.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{3,5})\s*(?:cash back|bonus cash|customer cash|allowance|rebate|discount|off)?/i);
            if (cashMatch) monthlyPayment = parseFloat(cashMatch[1].replace(/,/g, ''));
          }

          const yearMatch = fullTitle.match(/\b(202[3-7])\b/);
          const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

          let make = inc.make || 'Unknown';
          if (make === 'Unknown') {
            for (const m of KNOWN_MAKES) {
              if (new RegExp(`\\b${m}\\b`, 'i').test(fullTitle)) {
                make = m;
                break;
              }
            }
          }

          let model = inc.title || 'Incentive Offer';
          if (make !== 'Unknown') {
            const mMatch = fullTitle.match(new RegExp(`\\b${make}\\s+([A-Za-z0-9-]+(?:\\s+[A-Za-z0-9-]+){0,2})`, 'i'));
            if (mMatch && mMatch[1]) model = mMatch[1].trim();
          }

          let trim: string | undefined = inc.trim;
          if (!trim && fullTitle && make !== 'Unknown') {
            const safeMake = make.replace(/[^a-zA-Z0-9]/g, '\\$&');
            const safeModel = model.replace(/[^a-zA-Z0-9]/g, '\\$&');
            const trimRegex = new RegExp(`\\b${safeMake}\\s+${safeModel}\\s+([A-Za-z0-9/+-]+(?:\\s+[A-Za-z0-9/+-]+){0,2})`, 'i');
            const tMatch = fullTitle.match(trimRegex);
            if (tMatch && tMatch[1] && !/offer|cash|apr|bonus|rebate|select|special/i.test(tMatch[1])) {
              trim = tMatch[1].trim();
            }
          }

          let incImageUrl = inc.imageUrl || inc.image || inc.photoUrl;
          if (!incImageUrl && make !== 'Unknown' && model !== 'Unknown') {
            incImageUrl = modelImageMap.get(`${year}_${make}_${model}`.toLowerCase()) || modelImageMap.get(`${make}_${model}`.toLowerCase());
          }

          addSpecial({
            id: `spc_${cleanDealerId}_${year}_${make}_${model.replace(/[^a-zA-Z0-9]/g, '_')}_inc_${index}`,
            dealerId: cleanDealerId,
            offerDealerName: dealerName,
            snapshotDate: today,
            year,
            make: make !== 'Unknown' ? make : dealerName,
            model,
            trim,
            specialType,
            apr,
            termMonths,
            downPayment,
            monthlyPayment,
            title: fullTitle.slice(0, 190),
            disclaimer: inc.disclaimer ? inc.disclaimer.slice(0, 2000) : undefined,
            expirationDate: inc.expirationDate,
            specialUrl: specialsUrl,
            imageUrl: incImageUrl
          });
        });
      } catch (err) {}
    }

    // -----------------------------------------------------------------------
    // STEP 1C: Extract HTML Component DOM Cards (Cheerio)
    // -----------------------------------------------------------------------
    const cardSelectors = [
      '.promo',
      '.promo-type-vehicle',
      '.wsm-specials-display',
      '[data-testid*="desktop4x3"]',
      '.special-card',
      '.specials-card',
      '.vehicle-special',
      '.offer-card',
      '.special-item',
      '.specials-item',
      '.inventory-special',
      '.deal-item',
      '.specials-list__item',
      '.special-offer',
      '.new-vehicle-special',
      '.featured-special',
      '.lease-special',
      '[data-special-id]',
      '[class*="special-offer"]',
      '[class*="vehicle-offer"]',
      '.specials-list article',
      '.specials-grid .card',
      '.item.hproduct',
      '.inventoryList .item',
      'article[data-vin]'
    ];

    const rawImageUrls: { url: string; altText?: string; disclaimer?: string; title?: string }[] = [];
    let foundCards = $(cardSelectors.join(', '));

    // Fallback: search for elements containing monthly lease patterns ($.../mo) if standard selectors missed
    if (foundCards.length === 0) {
      const candidates: any[] = [];
      $('*').each((_, el) => {
        const text = $(el).text();
        if (
          /\$(?:USD\s*)?[0-9]{2,4}\s*(?:\/|\s+per\s+)?mo\b/i.test(text) &&
          KNOWN_MAKES.some((m) => new RegExp(`\\b${m}\\b`, 'i').test(text))
        ) {
          const hasCandidateParent = candidates.some((cand) => $(cand).has(el as any).length > 0);
          if (!hasCandidateParent && $(el).children().length > 1 && text.length < 1500) {
            candidates.push(el);
          }
        }
      });
      if (candidates.length > 0) {
        foundCards = $(candidates as any);
      }
    }

    if (foundCards.length > 0) {
      console.log(`[SpecialsExtractor] Discovered ${foundCards.length} potential HTML special cards on ${specialsUrl}`);

      foundCards.each((index, el) => {
        const card = $(el);
        const cardText = card.text().replace(/\s+/g, ' ').trim();

        const titleEl = card.find('h1, h2, h3, h4, .title, .vehicle-title, .offer-title, [data-title], .sr-only').first();
        const rawTitle = (titleEl.text() || card.find('strong, b').first().text() || cardText.slice(0, 80)).replace(/\s+/g, ' ').trim();

        let year = new Date().getFullYear();
        const yearMatch = rawTitle.match(/\b(202[3-7])\b/) || cardText.match(/\b(202[3-7])\b/);
        if (yearMatch) {
          year = parseInt(yearMatch[1], 10);
        }

        let make = 'Unknown';
        for (const m of KNOWN_MAKES) {
          if (new RegExp(`\\b${m}\\b`, 'i').test(rawTitle) || new RegExp(`\\b${m}\\b`, 'i').test(cardText)) {
            make = m;
            break;
          }
        }
        if (make === 'Unknown') {
          for (const m of KNOWN_MAKES) {
            if (new RegExp(`\\b${m}\\b`, 'i').test(dealerName + ' ' + specialsUrl)) {
              make = m;
              break;
            }
          }
        }

        let model = 'Vehicle Special';
        let trim = card.find('[data-trim], .trim, .vehicle-trim, .spec-trim').first().text().trim() || undefined;

        if (make !== 'Unknown') {
          try {
            const { normalizeVehicle } = require('../utils/vehicleNormalization');
            const cleanTitle = rawTitle.replace(/\b(NEW|USED|CERTIFIED|APR|Offer valid through.*)\b/gi, '').trim();
            const norm = normalizeVehicle({ make, model: cleanTitle, trim });
            if (norm.model && norm.model !== 'Vehicle Special') {
              model = norm.model;
              if (!trim && norm.trim) trim = norm.trim;
            }
          } catch {}

          if (model === 'Vehicle Special') {
            const modelRegex = new RegExp(`\\b${make}\\s+([A-Za-z0-9-]+(?:\\s+[A-Za-z0-9-]+){0,3})`, 'i');
            const modelMatch = rawTitle.match(modelRegex) || cardText.match(modelRegex);
            if (modelMatch && modelMatch[1]) {
              model = modelMatch[1].replace(/\b(Lease|Special|Offer|New|Deal|Finance)\b/gi, '').trim();
            }
          }
        }

        let specialType: 'lease' | 'finance' | 'cash' = 'lease';
        if (/\b(?:finance|financing|apr)\b/i.test(cardText) && !/\/(?:mo|month)/i.test(cardText)) {
          specialType = 'finance';
        } else if (/\b(?:cash|rebate|customer cash|bonus cash)\b/i.test(cardText) && !/\/(?:mo|month)/i.test(cardText)) {
          specialType = 'cash';
        }

        let monthlyPayment: number | undefined;
        const paymentMatch = cardText.match(/\$(?:USD\s*)?([0-9]{2,4})(?:\.[0-9]{2})?\s*(?:\/|\s+per\s+)?mo\b/i);
        if (paymentMatch) {
          monthlyPayment = parseFloat(paymentMatch[1]);
        } else if (specialType === 'cash') {
          const cashMatch = `${rawTitle} ${cardText}`.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{3,5})\s*(?:cash back|bonus cash|customer cash|allowance|rebate|discount|off|savings)?/i);
          if (cashMatch) {
            monthlyPayment = parseFloat(cashMatch[1].replace(/,/g, ''));
          }
        }

        let termMonths: number | undefined;
        const termMatch = cardText.match(/\b([0-9]{2})\s*(?:months|month|mos|mo)\b/i);
        if (termMatch) {
          termMonths = parseInt(termMatch[1], 10);
        }

        let downPayment: number | undefined;
        const downMatch = cardText.match(
          /\$(?:USD\s*)?([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{2,5})\s*(?:due at signing|down payment|down|initial payment|DAS)\b/i
        );
        if (downMatch) {
          downPayment = parseFloat(downMatch[1].replace(/,/g, ''));
        }

        let apr: number | undefined;
        const aprMatch = cardText.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*apr/i);
        if (aprMatch) {
          apr = parseFloat(aprMatch[1]);
        }

        let msrp: number | undefined;
        const msrpMatch = cardText.match(/(?:msrp|retail|starting at|total price|sale price)\s*[:\-]?\s*\$(?:USD\s*)?([0-9]{1,3}(?:,[0-9]{3})*)/i);
        if (msrpMatch) {
          msrp = parseFloat(msrpMatch[1].replace(/,/g, ''));
        }

        let expirationDate: string | undefined;
        const expMatch = cardText.match(
          /(?:expires?|offer ends?|valid through|valid thru|through)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+[0-9]{1,2},?\s+[0-9]{4})/i
        );
        if (expMatch) {
          expirationDate = expMatch[1];
        }

        const disclaimerEl = card.find('.disclaimer, .legal, .fine-print, small, p.disclaimer, p.legal, p.terms, div.disclaimer, div.legal').first();
        const disclaimer = (disclaimerEl.text() || '').trim() || undefined;

        const linkEl = card.find('a[href]').first();
        let specialUrlHref: string | undefined;
        if (linkEl.length > 0) {
          const rawHref = linkEl.attr('href');
          if (rawHref) {
            specialUrlHref = rawHref.startsWith('http') ? rawHref : `${origin}${rawHref.startsWith('/') ? '' : '/'}${rawHref}`;
          }
        }

        const imgEl = card.find('img').first();
        let cardImageUrl: string | undefined;
        if (imgEl.length > 0) {
          const rawSrc = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src');
          if (rawSrc && !rawSrc.startsWith('data:image')) {
            cardImageUrl = rawSrc.startsWith('http') ? rawSrc : `${origin}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`;
          }
        }

        if (cardImageUrl && make !== 'Unknown' && model !== 'Unknown') {
          modelImageMap.set(`${year}_${make}_${model}`.toLowerCase(), cardImageUrl);
          modelImageMap.set(`${make}_${model}`.toLowerCase(), cardImageUrl);
        }

        if (!trim) {
          trim = card.find('[data-trim], .trim, .vehicle-trim, .spec-trim').first().text().trim() || undefined;
        }
        if (!trim && rawTitle && make !== 'Unknown' && model !== 'Unknown') {
          const safeMake = make.replace(/[^a-zA-Z0-9]/g, '\\$&');
          const safeModel = model.replace(/[^a-zA-Z0-9]/g, '\\$&');
          const trimRegex = new RegExp(`\\b${safeMake}\\s+${safeModel}\\s+([^,\\-\\n\\|#]+)`, 'i');
          const tMatch = rawTitle.match(trimRegex);
          if (tMatch && tMatch[1]) {
            const candidate = tMatch[1]
              .replace(/\s*(?:[.,;:]|\$|for\s+[\$0-9]|mo\s+for|months\s+valid|lease\s+for|\/mo|valid\s+through|valid\s+throug|open\s+details).*$/i, '')
              .replace(/\b(4x4|4x2|AWD|FWD|RWD|New|Used|Certified|VIN:.*|Stock:.*)\b/gi, '')
              .trim();
            if (candidate && candidate.length < 50) {
              trim = candidate;
            }
          }
        }

        if (model.toLowerCase() === 'bronco big' && (!trim || trim.toLowerCase() === 'bend')) {
          model = 'Bronco';
          trim = 'Big Bend';
        } else if (model.toLowerCase().startsWith('explorer active')) {
          model = 'Explorer';
          trim = 'Active';
        }

        let finalCardImageUrl = cardImageUrl;
        if (!finalCardImageUrl && make !== 'Unknown' && model !== 'Unknown') {
          finalCardImageUrl = modelImageMap.get(`${year}_${make}_${model}`.toLowerCase()) || modelImageMap.get(`${make}_${model}`.toLowerCase());
        }

        const hasPricing = monthlyPayment !== undefined || downPayment !== undefined || apr !== undefined || msrp !== undefined;
        const isPromoCard = card.hasClass('promo') || card.hasClass('promo-type-vehicle') || card.hasClass('wsm-specials-display');

        if ((make !== 'Unknown' && (hasPricing || isPromoCard)) || (monthlyPayment !== undefined && termMonths !== undefined)) {
          addSpecial({
            id: `spc_${cleanDealerId}_${year}_${make}_${model.replace(/[^a-zA-Z0-9]/g, '_')}_${specialType}_${index}`,
            dealerId: cleanDealerId,
            offerDealerName: dealerName,
            snapshotDate: today,
            year,
            make: make !== 'Unknown' ? make : dealerName,
            model,
            trim,
            specialType: /apr/i.test(rawTitle) ? 'finance' : specialType,
            monthlyPayment,
            termMonths,
            downPayment,
            apr,
            msrp,
            title: rawTitle.replace(/\.?\s*Offer valid through.*$/i, '').slice(0, 190),
            disclaimer: disclaimer ? disclaimer.slice(0, 2000) : undefined,
            expirationDate,
            specialUrl: specialUrlHref || specialsUrl,
            imageUrl: finalCardImageUrl
          });
        } else if (cardImageUrl) {
          // Card has no HTML text pricing, but has an image graphic (e.g. J Star CDJR visual flyers)!
          // Automatically stage it as a visual special flyer
          if (!rawImageUrls.some((item) => item.url === cardImageUrl)) {
            const exp = card.find('.specials-expiration, .expiration, .expires').text().replace(/Expires:\s*/i, '').trim();
            rawImageUrls.push({
              url: cardImageUrl,
              title: rawTitle && rawTitle !== 'Vehicle Special' ? rawTitle : (make !== 'Unknown' ? `${year} ${make} ${model}` : undefined),
              disclaimer: disclaimer || (exp ? `Expires: ${exp}` : undefined),
              altText: imgEl.attr('alt') || undefined
            });
          }
        }
      });
    }

    // -----------------------------------------------------------------------
    // STEP 1D: Extract & Enrich DealerOn Dynamic Specials (.vehiclePricingDetails / #buy-{VIN})
    // -----------------------------------------------------------------------
    $('.vehiclePricingDetails').each((i, el) => {
      try {
        const container = $(el).closest('.row, [class*="vehicle"], [class*="item"], div');
        const buyTab = $(el).closest('[id^="buy-"]');
        const vin =
          buyTab.attr('id')?.replace(/^buy-/, '') ||
          container.find('[id^="buy-"]').attr('id')?.replace(/^buy-/, '') ||
          container.text().match(/\b([A-HJ-NPR-Z0-9]{17})\b/)?.[1];

        let msrp: number | undefined;
        let finalPrice: number | undefined;
        let discount: number | undefined;
        let downPayment: number | undefined;
        let monthlyPayment: number | undefined;

        $(el).find('li.priceBlockItem').each((_, item) => {
          const label = $(item).find('.priceBlocItemPriceLabel, .priceBlockItemPriceLabel').text().trim().toLowerCase();
          const valText = $(item).find('.priceBlocItemPriceValue, .priceBlockItemPriceValue').text().replace(/[^0-9.]/g, '');
          const val = parseFloat(valText);
          if (isNaN(val)) return;

          if (label.includes('msrp')) msrp = val;
          else if (label.includes('discount')) discount = val;
          else if (label.includes('total price') || label.includes('net cost') || label.includes('our price') || label.includes('sale price')) finalPrice = val;
          else if (label.includes('down')) downPayment = val;
          else if (label.includes('lease') || label.includes('monthly') || label.includes('payment')) monthlyPayment = val;
        });

        // 1. Try to enrich matching special from JSON-LD
        let matched = false;
        if (vin) {
          for (const sp of htmlSpecials) {
            if ((sp.id && sp.id.includes(vin)) || (sp.specialUrl && sp.specialUrl.includes(vin))) {
              if (msrp && !sp.msrp) sp.msrp = msrp;
              if (finalPrice && (!sp.monthlyPayment || sp.specialType === 'cash')) {
                sp.monthlyPayment = finalPrice;
              }
              if (downPayment && !sp.downPayment) sp.downPayment = downPayment;
              if (monthlyPayment) {
                sp.monthlyPayment = monthlyPayment;
                sp.specialType = 'lease';
              }
              matched = true;
              break;
            }
          }
        }

        // 2. If not matched, create new structured special from container
        if (!matched && (msrp || finalPrice || monthlyPayment)) {
          const titleEl = container.find('a[href*="-202"], h1, h2, h3, h4, .title').first();
          const title = titleEl.text().replace(/\s+/g, ' ').trim();
          const yearMatch = title.match(/\b(202[3-7])\b/);
          const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
          let make = 'Unknown';
          for (const m of KNOWN_MAKES) {
            if (new RegExp(`\\b${m}\\b`, 'i').test(title)) {
              make = m;
              break;
            }
          }
          if (make === 'Unknown') make = dealerName || 'Chevrolet';
          const modelMatch = title.replace(new RegExp(`^.*\\b${make}\\s+`, 'i'), '').trim();
          const model = modelMatch || 'Special Offer';
          const itemUrl = titleEl.attr('href');
          const resolvedUrl = itemUrl ? (itemUrl.startsWith('http') ? itemUrl : `${origin}${itemUrl.startsWith('/') ? '' : '/'}${itemUrl}`) : specialsUrl;

          addSpecial({
            id: `spc_${cleanDealerId}_${year}_${make}_${model.replace(/[^a-zA-Z0-9]/g, '_')}_dealeron_${i}`,
            dealerId: cleanDealerId,
            offerDealerName: dealerName,
            snapshotDate: today,
            year,
            make,
            model,
            specialType: monthlyPayment ? 'lease' : 'cash',
            msrp: msrp || finalPrice,
            monthlyPayment: monthlyPayment || finalPrice,
            downPayment,
            title: (title || `${year} ${make} ${model} Special`).slice(0, 190),
            specialUrl: resolvedUrl,
            imageUrl: container.find('img').attr('src')
          });
        }
      } catch {}
    });

    console.log(`[SpecialsExtractor] Extracted ${htmlSpecials.length} structured HTML / JSON-LD specials.`);

    // -----------------------------------------------------------------------
    // STEP 2: Detect & Download Visual Banner Specials (Images)
    // -----------------------------------------------------------------------
    const visualSpecials: StagedVisualSpecial[] = [];
    const savedImages: { imageUrl: string; localPath: string; fileName: string }[] = [];

    $('img').each((_, el) => {
      const img = $(el);
      const src =
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('data-original') ||
        img.attr('src') ||
        '';

      if (!src || src.startsWith('data:image')) return;

      const fullUrl = src.startsWith('http') ? src : `${origin}${src.startsWith('/') ? '' : '/'}${src}`;
      const lower = fullUrl.toLowerCase();
      const altText = (img.attr('alt') || '').trim();
      const imgTitle = (img.attr('title') || '').trim();

      if (EXCLUDE_IMAGE_PATTERNS.some((p) => lower.includes(p) || altText.toLowerCase().includes(p))) {
        return;
      }

      const isCdnMatch = SPECIAL_IMAGE_CDNS.some((cdn) => lower.includes(cdn));
      const isKeywordMatch =
        /special|offer|banner|incentive|lease|promo|deal|rebate|below|wbc|monthly/i.test(fullUrl) ||
        /special|offer|lease|deal|finance|incentive/i.test(altText) ||
        /special|offer|lease|deal|finance/i.test(imgTitle) ||
        (/uploads\//i.test(fullUrl) && (altText.length > 5 || imgTitle.length > 5));
      const isParentMatch =
        img.closest(
          '.specials-item, .special-item, .specials-image, .special-image, .specials-grid, .banner, .slide, .offers, .specials-banner, [class*="special"], [class*="offer"], [class*="deal"], .di-special-container, .card'
        ).length > 0;

      if (isCdnMatch || isKeywordMatch || isParentMatch) {
        const parentSection = img.closest('.specials-item, .special-item, .offer-card, .banner, .slide, section, div');
        const disclaimer =
          parentSection.find('.disclaimer, .legal, small, p.terms, p.disclaimer').first().text().trim() ||
          undefined;

        // Rich Alt-Text Extraction (e.g. Ontario CDJR where full lease/purchase details are in alt tags)
        if (altText && altText.length > 30) {
          const altPaymentMatch = altText.match(/\$([0-9]{2,4})(?:\.[0-9]{2})?\s*(?:\/|\s+per\s+)?mo\b/i);
          const altAprMatch = altText.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*apr/i);
          const altMsrpMatch = altText.match(/MSRP:\s*\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{4,6})/i);
          const altSavingsMatch = altText.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{3,5})\s*(?:savings|discount|below msrp|rebate)/i);

          let altMake = 'Unknown';
          for (const m of KNOWN_MAKES) {
            if (new RegExp(`\\b${m}\\b`, 'i').test(altText)) {
              altMake = m;
              break;
            }
          }

          if (altMake !== 'Unknown' && (altPaymentMatch || altAprMatch || altMsrpMatch || altSavingsMatch)) {
            const altYearMatch = altText.match(/\b(202[3-7])\b/);
            const altYear = altYearMatch ? parseInt(altYearMatch[1], 10) : new Date().getFullYear();
            const mMatch = altText.match(new RegExp(`\\b${altMake}\\s+([A-Za-z0-9-]+(?:\\s+[A-Za-z0-9-]+){0,2})`, 'i'));
            const altModel = mMatch && mMatch[1] ? mMatch[1].trim() : 'Special Offer';

            const altDownMatch = altText.match(/\$([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{2,5})\s*(?:total due at signing|due at signing|down)/i);
            const altTermMatch = altText.match(/\b([0-9]{2})\s*(?:months|month|mos)\b/i);
            const altExpMatch = altText.match(/Expires\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i);

            // Extract trim from alt text
            const safeMake = altMake.replace(/[^a-zA-Z0-9]/g, '\\$&');
            const safeModel = altModel.replace(/[^a-zA-Z0-9]/g, '\\$&');
            const tMatch = altText.match(new RegExp(`\\b${safeMake}\\s+${safeModel}\\s+([A-Za-z0-9/+-]+(?:\\s+[A-Za-z0-9/+-]+){0,2})`, 'i'));
            let altTrim: string | undefined;
            if (tMatch && tMatch[1] && !/with|for|at|savings|lease|purchase|special/i.test(tMatch[1])) {
              altTrim = tMatch[1].trim();
            }

            addSpecial({
              id: `spc_${cleanDealerId}_${altYear}_${altMake}_${altModel.replace(/[^a-zA-Z0-9]/g, '_')}_alt_${rawImageUrls.length}`,
              dealerId: cleanDealerId,
              offerDealerName: dealerName,
              snapshotDate: today,
              year: altYear,
              make: altMake,
              model: altModel,
              trim: altTrim,
              specialType: altPaymentMatch ? 'lease' : altAprMatch ? 'finance' : 'cash',
              monthlyPayment: altPaymentMatch ? parseFloat(altPaymentMatch[1]) : undefined,
              downPayment: altDownMatch ? parseFloat(altDownMatch[1].replace(/,/g, '')) : undefined,
              termMonths: altTermMatch ? parseInt(altTermMatch[1], 10) : undefined,
              apr: altAprMatch ? parseFloat(altAprMatch[1]) : undefined,
              msrp: altMsrpMatch ? parseFloat(altMsrpMatch[1].replace(/,/g, '')) : undefined,
              title: altText.slice(0, 190),
              disclaimer: altText,
              expirationDate: altExpMatch ? altExpMatch[1] : undefined,
              specialUrl: specialsUrl,
              imageUrl: fullUrl
            });
          }
        }

        if (!rawImageUrls.some((item) => item.url === fullUrl)) {
          rawImageUrls.push({
            url: fullUrl,
            altText: altText || undefined,
            title: imgTitle || undefined,
            disclaimer
          });
        }
      }
    });

    console.log(`[SpecialsExtractor] Discovered ${rawImageUrls.length} visual specials image candidates.`);
    const domain = normalizeDomain(specialsUrl);

    for (let i = 0; i < Math.min(rawImageUrls.length, 25); i++) {
      const item = rawImageUrls[i];
      const downloaded = await this.downloadImage(item.url, cleanDealerId, i);

      if (downloaded) {
        savedImages.push({
          imageUrl: item.url,
          localPath: downloaded.localPath,
          fileName: downloaded.fileName
        });
      }

      const stagingId = `stg_${cleanDealerId}_${Date.now()}_${i}`;
      const title = item.altText || item.title || `${dealerName} Visual Special Offer #${i + 1}`;
      const imageHash = downloaded?.imageHash;

      // Check if this image flyer was already processed by Vision AI in ANY workspace
      let status: 'pending' | 'completed' = 'pending';
      let extractedJson: string | undefined = undefined;
      let rawText = item.disclaimer || item.altText || undefined;
      let isAiCached = false;
      let cachedFromId: string | undefined = undefined;

      if (imageHash) {
        const cached = await this.checkCachedAiSpecial(imageHash);
        if (cached && cached.extractedJson) {
          status = 'completed';
          extractedJson = cached.extractedJson;
          if (cached.rawText) rawText = cached.rawText;
          isAiCached = true;
          cachedFromId = cached.cachedFromId;
          console.log(`⚡ [AI Vision Cache Hit] Flyer image hash ${imageHash.slice(0, 10)} was already processed by AI! Reusing cached extractions for ${dealerName}.`);

          // Attempt to parse cached extracted JSON into htmlSpecials automatically
          try {
            const parsedAi = JSON.parse(cached.extractedJson);
            const items = Array.isArray(parsedAi) ? parsedAi : [parsedAi];
            for (let aiIdx = 0; aiIdx < items.length; aiIdx++) {
              const aiSpec = items[aiIdx];
              if (aiSpec && (aiSpec.model || aiSpec.make)) {
                const currentYear = new Date().getFullYear();
                const aiYear = parseInt(aiSpec.year, 10) || currentYear;
                const aiMake = aiSpec.make || dealerName || 'Unknown';
                const aiModel = aiSpec.model || 'Special Offer';
                addSpecial({
                  id: `spc_ai_${cleanDealerId}_${aiYear}_${aiMake.replace(/[^a-zA-Z0-9]/g, '_')}_${aiModel.replace(/[^a-zA-Z0-9]/g, '_')}_${aiIdx}`,
                  dealerId: cleanDealerId,
                  offerDealerName: dealerName,
                  snapshotDate: today,
                  year: aiYear,
                  make: aiMake,
                  model: aiModel,
                  trim: aiSpec.trim || undefined,
                  specialType: aiSpec.special_type || aiSpec.specialType || 'lease',
                  monthlyPayment: aiSpec.monthly_payment || aiSpec.monthlyPayment || undefined,
                  termMonths: aiSpec.term_months || aiSpec.term || undefined,
                  downPayment: aiSpec.down_payment || aiSpec.downPayment || undefined,
                  apr: aiSpec.apr || undefined,
                  msrp: aiSpec.msrp || undefined,
                  title: aiSpec.title || title.slice(0, 190),
                  disclaimer: aiSpec.disclaimer || rawText,
                  expirationDate: aiSpec.expiration_date || aiSpec.expirationDate || undefined,
                  specialUrl: specialsUrl,
                  imageUrl: item.url,
                  domain
                });
              }
            }
          } catch {}
        }
      }

      visualSpecials.push({
        id: stagingId,
        dealerId: cleanDealerId,
        offerDealerName: dealerName,
        clientDealerName: dealerName,
        snapshotDate: today,
        specialType: 'vehicle',
        title: title.slice(0, 190),
        details: JSON.stringify({
          imageUrl: item.url,
          localImagePath: downloaded?.localPath || null,
          publicUrl: downloaded?.publicUrl || null,
          pageUrl: specialsUrl,
          fileName: downloaded?.fileName || null,
          downloadedAt: downloaded ? new Date().toISOString() : null,
          downloadStatus: downloaded ? 'saved' : 'pending_remote_fetch',
          imageHash: imageHash || null,
          isAiCached,
          cachedFromId: cachedFromId || null
        }),
        status,
        rawText,
        extractedJson,
        imageUrl: item.url,
        localImagePath: downloaded?.localPath,
        imageHash,
        domain
      });
    }

    let mode: 'html_components' | 'visual_images' | 'mixed' | 'none' = 'none';
    if (htmlSpecials.length > 0 && visualSpecials.length > 0) {
      mode = 'mixed';
    } else if (htmlSpecials.length > 0) {
      mode = 'html_components';
    } else if (visualSpecials.length > 0) {
      mode = 'visual_images';
    }

    console.log(`[SpecialsExtractor] Summary: Mode=${mode.toUpperCase()} | HTML Specials=${htmlSpecials.length} | Visual Staged=${visualSpecials.length} | Saved Images=${savedImages.length}`);

    return {
      mode,
      htmlSpecials,
      visualSpecials,
      savedImages
    };
  }

  /**
   * Checks if an image flyer has already been parsed by AI vision in any workspace
   */
  static async checkCachedAiSpecial(imageHash: string): Promise<{
    extractedJson: string;
    rawText?: string;
    title?: string;
    cachedFromId?: string;
  } | null> {
    if (!imageHash) return null;
    let connection: mysql.Connection | null = null;
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '1254879863',
        database: process.env.DB_NAME || 'dealerdata',
        port: parseInt(process.env.DB_PORT || '3306', 10)
      });

      const [rows]: any = await connection.execute(
        `SELECT id, title, raw_text, extracted_json 
         FROM specials_staging 
         WHERE image_hash = ? AND (status = 'completed' OR status = 'approved') AND extracted_json IS NOT NULL
         LIMIT 1`,
        [imageHash]
      );

      if (rows && rows.length > 0) {
        return {
          extractedJson: rows[0].extracted_json,
          rawText: rows[0].raw_text,
          title: rows[0].title,
          cachedFromId: rows[0].id
        };
      }
    } catch (err: any) {
      console.warn(`[SpecialsExtractor] Notice: Cache lookup failed for imageHash ${imageHash.slice(0, 8)}:`, err.message);
    } finally {
      if (connection) await connection.end().catch(() => {});
    }
    return null;
  }

  /**
   * Downloads an image file, calculates SHA-256 hash, and saves it locally.
   */
  private static async downloadImage(
    imageUrl: string,
    dealerId: string,
    index: number
  ): Promise<{ localPath: string; publicUrl: string; fileName: string; imageHash: string } | null> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        ...getAxiosProxyConfig()
      });

      const buffer = Buffer.from(response.data);
      const imageHash = crypto.createHash('sha256').update(buffer).digest('hex');

      const contentType = String(response.headers['content-type'] || 'image/jpeg');
      let extension = 'jpg';
      if (contentType.includes('png')) extension = 'png';
      else if (contentType.includes('webp')) extension = 'webp';
      else if (contentType.includes('gif')) extension = 'gif';

      const fileName = `special_${dealerId}_${Date.now()}_${index}.${extension}`;

      // 1. Save in dealerdata-scraper/output/specials_images/<dealerId>/
      const scraperTargetDir = path.join(process.cwd(), 'output', 'specials_images', dealerId);
      if (!fs.existsSync(scraperTargetDir)) {
        fs.mkdirSync(scraperTargetDir, { recursive: true });
      }
      const scraperLocalPath = path.join(scraperTargetDir, fileName);
      fs.writeFileSync(scraperLocalPath, buffer);

      // 2. Also save in Next.js public directory if available: ../dealerdata-next/public/uploads/specials_images/<dealerId>/
      const nextPublicDir = path.join(process.cwd(), '..', 'dealerdata-next', 'public', 'uploads', 'specials_images', dealerId);
      if (fs.existsSync(path.join(process.cwd(), '..', 'dealerdata-next', 'public'))) {
        if (!fs.existsSync(nextPublicDir)) {
          fs.mkdirSync(nextPublicDir, { recursive: true });
        }
        const nextLocalPath = path.join(nextPublicDir, fileName);
        fs.writeFileSync(nextLocalPath, buffer);
      }

      console.log(`[SpecialsExtractor] Saved special image (hash: ${imageHash.slice(0, 10)}): ${scraperLocalPath}`);
      return {
        localPath: scraperLocalPath,
        publicUrl: `/uploads/specials_images/${dealerId}/${fileName}`,
        fileName,
        imageHash
      };
    } catch (err: any) {
      console.warn(`[SpecialsExtractor] Could not download image from ${imageUrl}: ${err.message}`);
      return null;
    }
  }
}
