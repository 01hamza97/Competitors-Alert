import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import crypto from 'crypto';

export class UpperMarlboroFordScraper implements DealerSpecialsScraper {
  readonly id = 'upper_marlboro_ford';
  readonly name = 'Upper Marlboro Ford';
  readonly domain = 'uppermarlboroford.com';
  readonly specialsUrls = [
    'https://www.uppermarlboroford.com/newspecials.html'
  ];

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;

    // 1. If no browser page provided yet, return empty so index.ts boots Playwright and passes page
    if (!ctx.page) {
      logger.log(`Browser context required for DOM extraction. Delegating to Playwright...`);
      return { htmlSpecials: [], visualSpecials: [] };
    }

    const page = ctx.page;
    logger.log(`Executing DOM specials extraction for ${dealerName} (${dealerId})...`);

    // 2. Wait for coupon cards and scroll to trigger lazy loading of inventory images
    try {
      await page.waitForSelector('.card__coupon, [id^="special--"]', { timeout: 12000 }).catch(() => {});

      // Progressive scroll to hydrate lazy loaded vehicle photos
      await page.evaluate(async () => {
        const distance = 400;
        const delay = 150;
        const totalHeight = document.body.scrollHeight;
        let currentPosition = 0;

        while (currentPosition < totalHeight) {
          window.scrollBy(0, distance);
          currentPosition += distance;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      });
      await page.waitForTimeout(800);
    } catch (scrollErr: any) {
      logger.warn(`Notice while hydrating DOM/images: ${scrollErr.message}`);
    }

    // 3. Extract loaded DOM with Cheerio
    const cheerio = await import('cheerio');
    const hydratedHtml = await page.content();
    const $ = cheerio.load(hydratedHtml);

    const visualSpecials: StagedVisualSpecial[] = [];
    const seenPromoIds = new Set<string>();
    const today = new Date().toISOString().split('T')[0];

    // Target DealerOn special coupon cards
    const cards = $('.card__coupon, [id^="special--"]');
    logger.log(`Processing ${cards.length} promotional cards found in DOM...`);

    cards.each((i, el) => {
      const card = $(el);
      const promoId =
        card.attr('data-dotagging-promotion-id') ||
        card.attr('id')?.replace(/^special--/, '') ||
        `umf_${Date.now()}_${i}`;

      if (seenPromoIds.has(promoId)) return;
      seenPromoIds.add(promoId);

      // A. Extract Title
      const h2Title = card.find('.card__title--main').text().trim();
      const dotaggingTitle = (card.attr('data-dotagging-promotion-name') || '').trim();
      const title = h2Title || dotaggingTitle || `${dealerName} Special #${i + 1}`;

      // B. Filter Out Non-Vehicle Marketing Promos
      const isMarketingPromo = /why buy|about us|value your trade|schedule service|career|advantage|community|contact us|meet our team|military|college grad|service special|parts special|collision/i.test(title);
      if (isMarketingPromo) {
        logger.log(`Skipping non-vehicle promo card: "${title}"`);
        return;
      }

      // C. Extract Vehicle Details
      const stockNumber = card.find('.card__title--sub').text().trim();
      const expirationText = card.find('.card__expiration').text().trim();

      // D. Extract Pricing Breakdown
      const msrp = card.find('.dealerDiscount .vehiclePricingHighlightAmount').first().text().trim();
      const salePrice = card.find('.featuredPrice .vehiclePricingHighlightAmount').first().text().trim();

      const priceLines: string[] = [];
      card.find('.priceBlockCollapse:first .priceBlockItem').each((_, pItem) => {
        const label = $(pItem).find('.priceBlocItemPriceLabel, .priceBlockItemRebateLabel').text().replace(/\s+/g, ' ').trim();
        const val = $(pItem).find('.priceBlocItemPriceValue, .priceBlockItemRebateValue').text().replace(/\s+/g, ' ').trim();
        if (label && val) {
          priceLines.push(`${label} ${val}`);
        }
      });

      // Extract Rebate Details from modal popover content if available
      let rebateBreakdown = '';
      const rebateBtn = card.find('.priceBlockItemRebateButton');
      const rawContent = rebateBtn.attr('data-content');
      if (rawContent) {
        try {
          const rebate$ = cheerio.load(rawContent);
          const rebates: string[] = [];
          rebate$('li').each((_, rLi) => {
            const itemText = rebate$(rLi).text().replace(/\s+/g, ' ').trim();
            if (itemText) rebates.push(itemText);
          });
          if (rebates.length > 0) {
            rebateBreakdown = `Rebates Breakdown: ${rebates.join(' | ')}`;
          }
        } catch {}
      }

      // E. Extract Vehicle Inventory Image
      const img = card.find('.card__hero img, img').first();
      let imgSrc = img.attr('src') || img.attr('data-src') || '';
      if (imgSrc && !imgSrc.startsWith('http')) {
        try {
          imgSrc = new URL(imgSrc, targetUrl).href;
        } catch {}
      }

      // F. Extract Inventory Link
      let destUrl = card.find('a.view-inventory, a.hero-view-inventory').attr('href') || targetUrl;
      if (destUrl && !destUrl.startsWith('http')) {
        try {
          destUrl = new URL(destUrl, targetUrl).href;
        } catch {}
      }

      // Extract VIN from URL or image path if present
      const vinMatch = `${destUrl} ${imgSrc}`.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
      const vin = vinMatch ? vinMatch[1].toUpperCase() : '';

      // Combine structured text parts for LLM extraction
      const textParts = [
        title,
        vin ? `VIN: ${vin}` : '',
        stockNumber,
        expirationText,
        msrp ? `MSRP: ${msrp}` : '',
        salePrice ? `Sale Price: ${salePrice}` : '',
        priceLines.length > 0 ? `Pricing Stack:\n${priceLines.join('\n')}` : '',
        rebateBreakdown,
        `Inventory URL: ${destUrl}`
      ].filter(Boolean);

      const rawText = textParts.join('\n---\n');

      // Verify card has some vehicle or payment signal
      const hasVehicleSignal =
        /\b(ford|explorer|f-150|f-250|f-350|f-450|mustang|bronco|ranger|maverick|expedition|escape|edge|transit)\b/i.test(rawText) ||
        /\b(sale price|msrp|discount|savings|rebates?|\$)\b/i.test(rawText);

      if (!hasVehicleSignal) {
        logger.log(`Skipping card without vehicle/pricing signal: "${title}"`);
        return;
      }

      // Stable hash
      const hashSource = `${dealerId}_${promoId}_${title}_${imgSrc}`;
      const imageHash = crypto.createHash('sha256').update(hashSource).digest('hex');

      visualSpecials.push({
        id: `stg_${dealerId}_${promoId}`,
        dealerId,
        offerDealerName: dealerName,
        clientDealerName: dealerName,
        snapshotDate: today,
        specialType: 'vehicle_text',
        title: title.slice(0, 190),
        details: JSON.stringify({
          imageUrl: imgSrc,
          destinationUrl: destUrl,
          pageUrl: targetUrl,
          promoId,
          vin,
          msrp,
          salePrice,
          stockNumber,
          platform: 'dealeron'
        }),
        status: 'pending',
        rawText,
        imageHash,
        imageUrl: imgSrc,
        domain,
        pageUrl: targetUrl
      });
    });

    logger.log(`Extracted ${visualSpecials.length} staged text-based specials ready for AI from ${dealerName}.`);
    return { htmlSpecials: [], visualSpecials };
  }
}
