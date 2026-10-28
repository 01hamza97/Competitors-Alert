import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import crypto from 'crypto';

export class BanisterFordOfMarlowHeightsScraper implements DealerSpecialsScraper {
  readonly id = 'banister_ford_of_marlow_heights';
  readonly name = 'Banister Ford of Marlow Heights';
  readonly domain = 'banisterfordofmarlowheights.com';
  readonly specialsUrls = [
    'https://www.banisterfordofmarlowheights.com/new-vehicles/?flags.type=Special'
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

    // Ensure flags.type=Special is present for Banister Ford specials
    let normalizedTargetUrl = targetUrl;
    try {
      const u = new URL(targetUrl);
      if (u.searchParams.get('flags.type') !== 'Special') {
        u.searchParams.set('flags.type', 'Special');
        normalizedTargetUrl = u.toString();
        logger.log(`Normalized specials URL to include flags.type=Special: ${normalizedTargetUrl}`);
      }
    } catch {}

    const visualSpecials: StagedVisualSpecial[] = [];
    const seenVins = new Set<string>();
    const today = new Date().toISOString().split('T')[0];
    const cheerio = await import('cheerio');

    let currentPage = 1;
    let maxPages = 1;

    while (currentPage <= maxPages && currentPage <= 10) {
      const pageUrl = currentPage === 1 
        ? normalizedTargetUrl 
        : `${normalizedTargetUrl.split('?')[0]}?${new URLSearchParams({ ...Object.fromEntries(new URL(normalizedTargetUrl).searchParams), pg: String(currentPage) }).toString()}`;

      if (currentPage > 1 || page.url() !== normalizedTargetUrl) {
        logger.log(`Navigating to page ${currentPage} of ${maxPages} (${pageUrl})...`);
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      }

      // Wait for Algolia Hits to render
      try {
        await page.waitForSelector('.ais-Hits-item, .listing[data-vehicle-vin]', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1200);

        // Progressive scroll down to ensure cards and DealerLink photos hydrate
        await page.evaluate(async () => {
          const distance = 600;
          const delay = 100;
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
        logger.warn(`Notice while hydrating DOM/images on page ${currentPage}: ${scrollErr.message}`);
      }

      // Check total pages on first page
      if (currentPage === 1) {
        const detectedMaxPages = await page.evaluate(() => {
          const text = document.querySelector('.ais-pagination-wrapper')?.textContent || '';
          const match = text.match(/Page\s+\d+\s+of\s+(\d+)/i);
          return match ? parseInt(match[1], 10) : 1;
        });
        maxPages = detectedMaxPages || 1;
        logger.log(`Detected ${maxPages} total page(s) on Algolia inventory.`);
      }

      // Extract loaded DOM with Cheerio
      const hydratedHtml = await page.content();
      const $ = cheerio.load(hydratedHtml);
      const cards = $('.ais-Hits-item .listing, .listing[data-vehicle-vin]');
      logger.log(`Page ${currentPage}: processing ${cards.length} vehicle cards found in DOM...`);

      if (cards.length === 0) {
        break;
      }

    cards.each((i, el) => {
      const card = $(el);
      const vin = card.attr('data-vehicle-vin') || `vin_${Date.now()}_${i}`;
      if (seenVins.has(vin)) return;
      seenVins.add(vin);

      // A. Extract Structured Metadata Attributes
      const year = card.attr('data-vehicle-year') || '';
      const make = card.attr('data-ag-make') || card.attr('data-vehicle-make-model')?.split(' ')[0] || 'Ford';
      const model = card.attr('data-ag-model') || '';
      const trim = card.attr('data-ag-trim') || '';
      const stock = card.attr('data-vehicle-stock-number') || '';
      const agPrice = card.attr('data-ag-price') || '';
      const vdpPath = card.attr('data-ag-vdp-url') || card.find('a[href*="/vehicle/"]').attr('href') || '';

      const carTitleHeader = card.find('h2.car-title').text().replace(/\s+/g, ' ').trim();
      const title = `${year} ${make} ${model} ${trim}`.trim() || carTitleHeader || `${dealerName} Special #${i + 1}`;

      // B. Extract Pricing Breakdown
      let msrp = '';
      let docFee = '';
      let incentives = '';
      let dealerDiscount = '';
      let salePrice = '';

      card.find('.dv-pricing-main').each((_, pEl) => {
        const text = $(pEl).text().replace(/\s+/g, ' ').trim();
        const strongVal = $(pEl).find('.dv-pricing-stack-strong, .dv-pricing-stack-value-default').last().text().trim();

        if (/MSRP/i.test(text)) msrp = strongVal;
        else if (/Doc Fee/i.test(text)) docFee = strongVal;
        else if (/Incentives/i.test(text)) incentives = strongVal;
        else if (/Discount/i.test(text)) dealerDiscount = strongVal;
        else if (/Sale Price|Our Price/i.test(text)) salePrice = strongVal;
      });

      if (!salePrice && agPrice) {
        salePrice = `$${Number(agPrice).toLocaleString()}`;
      }

      // Extract itemized conditional/rebate details if present
      const itemizedRebates: string[] = [];
      card.find('.ag-incentive-line-item').each((_, rEl) => {
        const rTitle = $(rEl).find('.ag-incentive-title').text().replace(/\s+/g, ' ').trim();
        const rVal = $(rEl).find('.ag-incentive-value').text().replace(/\s+/g, ' ').trim();
        if (rTitle && rVal) itemizedRebates.push(`${rTitle}: ${rVal}`);
      });

      // C. Extract Vehicle Inventory Image
      const img = card.find('.vehicle-views img, img.srp-click-image').first();
      let imgSrc = img.attr('src') || img.attr('data-src') || '';
      if (imgSrc && !imgSrc.startsWith('http')) {
        try {
          imgSrc = new URL(imgSrc, targetUrl).href;
        } catch {}
      }

      // D. Full Destination Link
      let destUrl = vdpPath || targetUrl;
      if (destUrl && !destUrl.startsWith('http')) {
        try {
          destUrl = new URL(destUrl, targetUrl).href;
        } catch {}
      }

      // Combine structured text parts for LLM extraction
      const textParts = [
        title,
        vin ? `VIN: ${vin}` : '',
        stock ? `Stock #: ${stock}` : '',
        msrp ? `MSRP: ${msrp}` : '',
        docFee ? `Doc Fee: ${docFee}` : '',
        incentives ? `Incentives: ${incentives}` : '',
        itemizedRebates.length > 0 ? `Rebates Breakdown: ${itemizedRebates.join(' | ')}` : '',
        dealerDiscount ? `Dealer Discount: ${dealerDiscount}` : '',
        salePrice ? `Final Sale Price: ${salePrice}` : '',
        `Vehicle URL: ${destUrl}`
      ].filter(Boolean);

      const rawText = textParts.join('\n---\n');

      // Stable hash
      const hashSource = `${dealerId}_${vin}_${title}_${imgSrc}`;
      const imageHash = crypto.createHash('sha256').update(hashSource).digest('hex');

      visualSpecials.push({
        id: `stg_${dealerId}_${vin}`,
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
          vin,
          stockNumber: stock,
          msrp,
          salePrice,
          platform: 'algolia_dealer_inspire'
        }),
        status: 'pending',
        rawText,
        imageHash,
        imageUrl: imgSrc,
        domain,
        pageUrl: targetUrl
      });
    });

      currentPage++;
    }

    logger.log(`Extracted a total of ${visualSpecials.length} staged text-based specials across all pages from ${dealerName}.`);
    return { htmlSpecials: [], visualSpecials };
  }
}
