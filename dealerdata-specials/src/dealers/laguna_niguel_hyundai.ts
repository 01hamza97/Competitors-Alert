import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import { SpecialsParser } from '../core/parser';
import { StorageManager } from '../core/storage';

export class LagunaNiguelHyundaiScraper implements DealerSpecialsScraper {
  readonly id = 'laguna_niguel_hyundai';
  readonly name = 'Laguna Niguel Hyundai';
  readonly domain = 'lagunaniguelhyundai.com';
  readonly specialsUrls = [
    'https://www.lagunaniguelhyundai.com/new-vehicles/new-specials/'
  ];

  private readonly HYUNDAI_MODELS = [
    'Tucson Hybrid',
    'Tucson',
    'Santa Fe Hybrid',
    'Santa Fe',
    'Ioniq 5',
    'Ioniq 6',
    'Ioniq 9',
    'Kona Electric',
    'Kona',
    'Elantra Hybrid',
    'Elantra N',
    'Elantra',
    'Sonata Hybrid',
    'Sonata',
    'Palisade',
    'Santa Cruz',
    'Venue'
  ];

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
    const htmlSpecials: CompetitorVehicleSpecial[] = [];
    const visualSpecials: StagedVisualSpecial[] = [];
    const storage = new StorageManager();

    logger.log(`Executing specials scraper for ${dealerName} (${dealerId})...`);

    // =========================================================================
    // STEP 1: Fetch HTML via ZenRows residential proxy / API or reuse context
    // =========================================================================
    let $: cheerio.CheerioAPI | null = ctx.$ || null;

    if (!$) {
      const apiKey = process.env.ZENROWS_API_KEY || 'bf266ef611c316456f4784d9a50b3d92c4ed5eda';
      if (apiKey) {
        try {
          logger.log(`Fetching specials page via ZenRows proxy: ${targetUrl}...`);
          const res = await axios.get('https://api.zenrows.com/v1/', {
            params: {
              apikey: apiKey,
              url: targetUrl,
              js_render: 'true',
              premium_proxy: 'true'
            },
            timeout: 30000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
          });

          if (res.data && typeof res.data === 'string' && res.data.includes('special-offer')) {
            $ = cheerio.load(res.data);
            logger.log(`ZenRows fetch succeeded with ${res.data.length} bytes.`);
          }
        } catch (zenErr: any) {
          logger.warn(`ZenRows fetch notice: ${zenErr.message}`);
        }
      }
    }

    // Fallback: If still not loaded but page exists
    if (!$ && ctx.page) {
      try {
        const pageHtml = await ctx.page.content();
        $ = cheerio.load(pageHtml);
      } catch {}
    }

    if (!$) {
      logger.warn(`Could not load specials HTML for ${dealerName}. Aborting scrape.`);
      return { htmlSpecials, visualSpecials };
    }

    // =========================================================================
    // STEP 2: Parse Dealer Inspire Specials Cards
    // =========================================================================
    const cards = $('.special-offer.card, li[id^="offer-"]');
    logger.log(`Found ${cards.length} promotional cards on specials page.`);

    const seenFlyerImages = new Set<string>();

    for (let i = 0; i < cards.length; i++) {
      const card = $(cards[i]);
      const offerId = card.attr('id') || `offer_${i}`;

      // 1. Extract flyer image
      const img = card.find('a.offer-image-link img, img').first();
      let imgSrc =
        img.attr('data-src') ||
        img.attr('src') ||
        img.attr('data-lazy-src') ||
        '';

      if (imgSrc && !imgSrc.startsWith('http')) {
        try {
          imgSrc = new URL(imgSrc, targetUrl).href;
        } catch {}
      }

      const imgAlt = img.attr('alt') || '';
      const h2Text = card.find('.offer-content h2, h2').text().trim();
      const lightboxTitle =
        card.find('.specialOfferFormCTA').attr('data-lightbox-title') || '';
      const fullText = h2Text || imgAlt || lightboxTitle;

      let ctaLink =
        card.find('a.primary-button').attr('href') ||
        card.find('a.offer-image-link').attr('href') ||
        targetUrl;
      if (ctaLink && !ctaLink.startsWith('http')) {
        try {
          ctaLink = new URL(ctaLink, targetUrl).href;
        } catch {}
      }

      // 2. Download visual flyer for Vision AI & flyer viewer
      let downloadedInfo: { imageHash: string; localPath: string } | null = null;
      if (imgSrc && !imgSrc.startsWith('data:image') && !seenFlyerImages.has(imgSrc)) {
        seenFlyerImages.add(imgSrc);
        try {
          logger.log(`Downloading flyer image for ${offerId}: ${imgSrc}`);
          downloadedInfo = await storage.downloadImage(imgSrc, dealerId, targetUrl);
        } catch (dlErr: any) {
          logger.warn(`Failed downloading image: ${dlErr.message}`);
        }
      }

      if (downloadedInfo) {
        visualSpecials.push({
          id: `stg_${dealerId}_${offerId}`,
          dealerId,
          offerDealerName: dealerName,
          clientDealerName: dealerName,
          specialType: 'vehicle_flyer',
          title: fullText || `${dealerName} Special Flyer`,
          details: ctaLink,
          status: 'pending',
          imageHash: downloadedInfo.imageHash,
          imageUrl: imgSrc,
          localImagePath: downloadedInfo.localPath,
          domain,
          pageUrl: targetUrl,
          snapshotDate: new Date().toISOString().split('T')[0]
        });
      }

      // 3. Extract structured vehicle specials
      const matchedModels = this.extractMatchingModels(fullText);

      if (matchedModels.length === 0) {
        logger.log(`Card ${offerId} is a general promo ("${fullText.slice(0, 50)}..."), staged as visual special.`);
        continue;
      }

      for (const model of matchedModels) {
        let year = 2026;
        const yMatch = fullText.match(/\b(202[4-9])\b/);
        if (yMatch) year = parseInt(yMatch[1], 10);

        let apr: number | undefined = undefined;
        if (/0%\s*(?:apr|financing)/i.test(fullText)) {
          apr = 0;
        } else {
          const aprMatch = fullText.match(/([0-9.]+)\s*%\s*(?:apr|financing)/i);
          if (aprMatch) apr = parseFloat(aprMatch[1]);
        }

        let termMonths: number | undefined = undefined;
        const yearTermMatch = fullText.match(/([0-9])\s*years?/i);
        if (yearTermMatch) {
          termMonths = parseInt(yearTermMatch[1], 10) * 12;
        } else {
          const monthTermMatch = fullText.match(/([0-9]{2})\s*months?/i);
          if (monthTermMatch) termMonths = parseInt(monthTermMatch[1], 10);
        }

        let downPayment: number | undefined = undefined;
        if (
          /0\s*payments?\s*for\s*90\s*days/i.test(fullText) ||
          /\$0\s*down/i.test(fullText) ||
          /zero\s*down/i.test(fullText)
        ) {
          downPayment = 0;
        } else {
          downPayment = SpecialsParser.extractDownPayment(fullText);
        }

        let discount: number | undefined = undefined;
        const discMatch = fullText.match(
          /(?:discount|bonus\s*cash|cash\s*back)\s*\$([0-9,]+)|\$([0-9,]+)\s*(?:discount|retail\s*bonus\s*cash|bonus\s*cash)/i
        );
        if (discMatch) {
          discount = parseFloat((discMatch[1] || discMatch[2]).replace(/,/g, ''));
        }

        let specialType: 'lease' | 'finance' | 'apr' | 'cash' = 'lease';
        let monthlyPayment: number | undefined = undefined;

        if (apr !== undefined && apr >= 0) {
          specialType = 'apr';
        } else if (discount) {
          specialType = 'cash';
          monthlyPayment = discount;
        } else {
          const parsedPayment = SpecialsParser.extractMonthlyPayment(fullText);
          if (parsedPayment) {
            monthlyPayment = parsedPayment;
            specialType = 'lease';
          }
        }

        const cleanModelSlug = model.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const specialId = `spc_${dealerId}_${offerId}_${cleanModelSlug}`;

        htmlSpecials.push({
          id: specialId,
          dealerId,
          offerDealerName: dealerName,
          year,
          make: 'Hyundai',
          model,
          trim: undefined,
          specialType,
          monthlyPayment,
          termMonths,
          downPayment,
          apr,
          title: `${year} Hyundai ${model}`,
          disclaimer: fullText,
          specialUrl: ctaLink,
          imageUrl: imgSrc || undefined,
          domain,
          rawHtmlSnippet: fullText
        });

        logger.log(
          `  -> Structured Special: ${year} Hyundai ${model} | Type: ${specialType} | APR: ${apr ?? 'N/A'}% | Term: ${termMonths ?? 'N/A'}m | Down: $${downPayment ?? 'N/A'}`
        );
      }
    }

    logger.log(
      `Completed ${dealerName} extraction: ${htmlSpecials.length} structured vehicle specials, ${visualSpecials.length} visual flyers.`
    );

    return { htmlSpecials, visualSpecials };
  }

  private extractMatchingModels(text: string): string[] {
    const found: string[] = [];
    for (const m of this.HYUNDAI_MODELS) {
      const reg = new RegExp(`\\b${m.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (reg.test(text)) {
        if (m === 'Tucson' && found.includes('Tucson Hybrid')) continue;
        if (
          m === 'Santa Fe' &&
          found.includes('Santa Fe Hybrid') &&
          !text.match(/santa\s*fe\s*(?:or|,|\/)\s*santa\s*fe\s*hybrid/i)
        ) {
          continue;
        }
        found.push(m);
      }
    }
    return found;
  }
}
