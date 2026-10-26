import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import { SpecialsParser } from '../core/parser';
import { StorageManager } from '../core/storage';

export class TuttleClickHyundaiScraper implements DealerSpecialsScraper {
  readonly id = 'tuttle_click_hyundai';
  readonly name = 'Tuttle Click Hyundai';
  readonly domain = 'tuttleclickhyundai.com';
  readonly specialsUrls = [
    'https://www.tuttleclickhyundai.com/new-hyundai-offers-in-irvine-ca.htm'
  ];

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
    const htmlSpecials: CompetitorVehicleSpecial[] = [];
    const visualSpecials: StagedVisualSpecial[] = [];
    const storage = new StorageManager();

    logger.log(`Executing exact specials extractor for Tuttle Click Hyundai...`);

    // Wait for Dealer.com specials widget to mount in the DOM
    try {
      await ctx.page.waitForSelector('.promo-type-vehicle, .promo-type-incentive, [id^="promo-"]', { timeout: 8000 });
    } catch {}

    const cheerio = await import('cheerio');
    const hydratedHtml = await ctx.page.content();
    const $ = cheerio.load(hydratedHtml);

    // =========================================================================
    // 1. IMAGE-BASED SPECIALS (Custom Asset Flyers for N8N / Vision AI)
    // Structure:
    // <div class="... promo-type-vehicle ... custom-asset" id="promo-VEHICLE-...">
    //   <a href="/all-inventory/index.htm?promotionId=...">
    //     <img data-image-url="https://pictures.dealer.com/t/tuttleclickhyundaica/...jpg">
    //   </a>
    // </div>
    // =========================================================================
    const flyerCards = $('.promo-type-vehicle.custom-asset, [id^="promo-VEHICLE-"]');
    const seenFlyerImages = new Set<string>();

    for (let i = 0; i < flyerCards.length; i++) {
      const card = $(flyerCards[i]);
      const promoId = card.attr('id') || `flyer_${i}`;
      const img = card.find('img');
      const rawUrl = img.attr('data-image-url') || img.attr('src');
      if (!rawUrl || rawUrl.startsWith('data:image')) continue;

      // Strip query parameters (?impolicy=downsize_bkpt...) to get full high-res flyer image
      const fullImageUrl = rawUrl.split('?')[0];
      if (seenFlyerImages.has(fullImageUrl)) continue;
      seenFlyerImages.add(fullImageUrl);

      let targetLink = card.find('a').attr('href') || targetUrl;
      if (targetLink && !targetLink.startsWith('http')) {
        try {
          targetLink = new URL(targetLink, targetUrl).href;
        } catch {}
      }

      logger.log(`Downloading visual flyer: ${fullImageUrl}`);
      const downloaded = await storage.downloadImage(fullImageUrl, dealerId, targetUrl);

      if (downloaded) {
        visualSpecials.push({
          id: `stg_${dealerId}_${promoId}`,
          dealerId,
          offerDealerName: dealerName,
          clientDealerName: dealerName,
          specialType: 'vehicle_flyer',
          title: `${dealerName} Special Flyer`,
          details: targetLink,
          status: 'pending',
          imageHash: downloaded.imageHash,
          imageUrl: fullImageUrl,
          localImagePath: downloaded.localPath,
          domain,
          pageUrl: targetUrl,
          snapshotDate: new Date().toISOString().split('T')[0]
        });
      }
    }

    logger.log(`Captured ${visualSpecials.length} visual flyer specials for N8N Vision AI.`);

    // =========================================================================
    // 2. TEXT-BASED SPECIALS (Incentive / Structured Offers for MySQL DB)
    // Structure:
    // <div class="promo promo-type-incentive non-custom-asset" data-promo-id="...">
    //   <h2>
    //     2027 Hyundai Sonata Hybrid
    //     <span class="w-100 d-block font-weight-normal">Combo APR Offer: 5.69% APR for 60 months...</span>
    //   </h2>
    //   <a href="/new-inventory/index.htm?promotionId=...">View Qualifying Vehicle(s)</a>
    //   <button data-href="?promotionId=...&promotionType=INCENTIVE...">Offer Details</button>
    // </div>
    // =========================================================================
    const textCards = $('.promo-type-incentive.non-custom-asset, [data-promo-id]');
    const seenPromoIds = new Set<string>();

    textCards.each((_, el) => {
      const card = $(el);
      const promoId = card.attr('data-promo-id') || card.attr('id') || '';
      if (promoId && seenPromoIds.has(promoId)) return;
      if (promoId) seenPromoIds.add(promoId);

      const h2 = card.find('h2');
      const sub = h2.find('span');
      const offerText = sub.text().trim();
      sub.remove();
      const vehicleTitle = h2.text().trim();

      const combinedText = `${vehicleTitle} ${offerText}`.trim();
      if (!combinedText) return;

      const vehicleInfo = SpecialsParser.extractVehicleInfo(vehicleTitle);
      const monthlyPayment = SpecialsParser.extractMonthlyPayment(offerText);
      const termMonths = SpecialsParser.extractTermMonths(offerText);
      const downPayment = SpecialsParser.extractDownPayment(offerText);
      const apr = SpecialsParser.extractApr(offerText);
      const msrp = SpecialsParser.extractMsrp(offerText);
      const expirationDate = SpecialsParser.extractExpirationDate(offerText);

      let inventoryLink = card.find('a[href*="promotionId"], a').attr('href') || targetUrl;
      if (inventoryLink && !inventoryLink.startsWith('http')) {
        try {
          inventoryLink = new URL(inventoryLink, targetUrl).href;
        } catch {}
      }

      let carImageUrl = card.find('img.incentive-image, img').attr('src');
      if (carImageUrl && !carImageUrl.startsWith('http')) {
        try {
          carImageUrl = new URL(carImageUrl, targetUrl).href;
        } catch {}
      }

      const disclaimerButton = card.find('button[data-href], button[data-title]');
      const disclaimerHref = disclaimerButton.attr('data-href');
      const disclaimerText = disclaimerHref
        ? `Offer Details & Disclaimers: ${disclaimerHref}`
        : card.find('.disclaimer, small').text().trim() || undefined;

      let specialType: 'lease' | 'finance' | 'apr' | 'cash' = 'lease';
      if (apr !== undefined && apr >= 0) specialType = 'apr';
      else if (/finance|buy/i.test(offerText)) specialType = 'finance';
      else if (/cash|rebate/i.test(offerText)) specialType = 'cash';

      const specialId = promoId ? `spc_${dealerId}_${promoId}` : undefined;

      htmlSpecials.push({
        id: specialId,
        dealerId,
        offerDealerName: dealerName,
        year: vehicleInfo.year,
        make: vehicleInfo.make || 'Hyundai',
        model: vehicleInfo.model,
        trim: vehicleInfo.trim,
        specialType,
        monthlyPayment,
        termMonths,
        downPayment,
        apr,
        msrp,
        title: vehicleTitle,
        disclaimer: disclaimerText,
        expirationDate,
        specialUrl: inventoryLink,
        imageUrl: carImageUrl,
        domain,
        rawHtmlSnippet: offerText
      });
    });

    logger.log(`Extracted ${htmlSpecials.length} structured text specials for MySQL DB.`);

    return { htmlSpecials, visualSpecials };
  }
}
