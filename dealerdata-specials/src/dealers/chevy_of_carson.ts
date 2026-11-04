import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import crypto from 'crypto';

export class ChevyOfCarsonScraper implements DealerSpecialsScraper {
  readonly id = 'chevy_of_carson';
  readonly name = 'Chevy Of Carson';
  readonly domain = 'chevyofcarson.com';
  readonly specialsUrls = [
    'https://www.chevyofcarson.com/'
  ];
  readonly useDirectConnection = true;

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
    const cheerio = await import('cheerio');
    let html = ctx.html || '';

    // 1. Wait for Dealer.com ws-specials React root to hydrate slides
    if (ctx.page) {
      try {
        await ctx.page.waitForSelector(
          '#specials1-app-root .slick-slide, #specials2-app-root .slick-slide, .promo[data-promo-id], .promo-type-vehicle',
          { timeout: 15000 }
        );
        await ctx.page.waitForTimeout(1000);
        html = await ctx.page.content();
      } catch (waitErr: any) {
        logger.warn(`Browser DOM wait notice: ${waitErr.message}`);
      }
    }

    // 2. If no HTML could be obtained directly and no page, delegate to Playwright runner
    if (!html && !ctx.page) {
      logger.log(`Browser context required for DOM extraction. Delegating to Playwright...`);
      return { htmlSpecials: [], visualSpecials: [] };
    }

    if (!html) {
      logger.warn(`Could not retrieve rendered HTML for ${dealerName}.`);
      return { htmlSpecials: [], visualSpecials: [] };
    }

    const $ = (cheerio.load || (cheerio as any).default?.load)(html);
    const htmlSpecials: CompetitorVehicleSpecial[] = [];
    const visualSpecials: StagedVisualSpecial[] = [];
    const seenPromoIds = new Set<string>();
    const seenSlideKeys = new Set<string>();
    const today = new Date().toISOString().split('T')[0];

    // Target promo cards strictly within ws-specials carousel widgets
    const promoCards = $(
      '.promo:not(.wsm-specials-display), [data-promo-id]:not(.wsm-specials-display)'
    );
    logger.log(`Processing ${promoCards.length} promo elements found in DOM...`);

    promoCards.each((idx, el) => {
      const card = $(el);
      if (card.hasClass('wsm-specials-display') || card.parent().closest('.promo').length > 0) return;

      const promoId = card.attr('data-promo-id') || card.attr('id') || `coc_${Date.now()}_${idx}`;
      if (seenPromoIds.has(promoId)) return;
      seenPromoIds.add(promoId);

      const isCustomAsset = card.hasClass('custom-asset');
      const isPromoVehicle = card.hasClass('promo-type-vehicle');
      const isPromoEvent = card.hasClass('promo-type-event');

      if (!isCustomAsset && !isPromoVehicle && !isPromoEvent) {
        return;
      }

      // Title & Text extraction
      const dataTitle = (card.attr('data-title') || '').trim();
      const srOnlyText = card.find('.sr-only').text().replace(/\s+/g, ' ').trim();
      const rawTitle = dataTitle || srOnlyText;

      // Filter out non-vehicle / non-sales slides (service, tire, etc.)
      const isService = /service|tire|parts|oil change|brake/i.test(rawTitle) ||
                        (card.attr('data-url-href') || '').includes('/service');
      if (isService) {
        logger.log(`Skipping service slide: "${rawTitle.slice(0, 50)}"`);
        return;
      }

      // Disclaimer extraction
      let disclaimer = '';
      const discMatch = srOnlyText.match(/Disclaimer:\s*(.+)$/i);
      if (discMatch) {
        disclaimer = discMatch[1].trim();
      }

      const fullText = `${dataTitle} ${srOnlyText}`;

      // Model Extraction
      let model = '';
      if (/silverado\s*(1500|2500\s*hd|3500\s*hd|ev)?/i.test(fullText)) {
        const m = fullText.match(/silverado\s*(1500|2500\s*hd|3500\s*hd|ev)?/i);
        model = m && m[1] ? `Silverado ${m[1].replace(/\s+/g, ' ').trim()}` : 'Silverado 1500';
      } else if (/2500\s*hd/i.test(fullText)) {
        model = 'Silverado 2500 HD';
      } else if (/trailblazer/i.test(fullText)) {
        model = 'Trailblazer';
      } else if (/trax/i.test(fullText)) {
        model = 'Trax';
      } else if (/equinox\s*ev/i.test(fullText)) {
        model = 'Equinox EV';
      } else if (/equinox/i.test(fullText)) {
        model = 'Equinox';
      } else if (/blazer\s*ev/i.test(fullText)) {
        model = 'Blazer EV';
      } else if (/blazer/i.test(fullText)) {
        model = 'Blazer';
      } else if (/tahoe/i.test(fullText)) {
        model = 'Tahoe';
      } else if (/suburban/i.test(fullText)) {
        model = 'Suburban';
      } else if (/colorado/i.test(fullText)) {
        model = 'Colorado';
      } else if (/corvette/i.test(fullText)) {
        model = 'Corvette';
      }

      if (!model) {
        logger.warn(`Could not determine vehicle model for promo "${promoId}": "${rawTitle.slice(0, 50)}". Skipping.`);
        return;
      }

      const yearMatch = fullText.match(/\b(202[4-7])\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

      // Extract APR
      const aprMatch = fullText.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*APR/i);
      const apr = aprMatch ? parseFloat(aprMatch[1]) : undefined;

      // Extract Term
      let termMonths: number | undefined;
      const termMonthsMatch = fullText.match(/for\s*([0-9]{2})\s*months/i);
      if (termMonthsMatch) {
        termMonths = parseInt(termMonthsMatch[1], 10);
      } else {
        const termYearsMatch = fullText.match(/for\s*([0-9])\s*years/i);
        if (termYearsMatch) {
          termMonths = parseInt(termYearsMatch[1], 10) * 12;
        }
      }

      // Extract Cash / Bonus Cash / Rebates
      const cashMatch = fullText.match(/\$([0-9,]+)\s*(?:bonus cash|customer cash|rebate|member incentive)/i);
      const cashAmount = cashMatch ? parseFloat(cashMatch[1].replace(/,/g, '')) : undefined;

      const isLease = /lease/i.test(fullText);

      // Classify Special Type
      let specialType: 'apr' | 'cash' | 'lease' | 'finance' = 'finance';
      if (apr !== undefined) {
        specialType = 'apr';
      } else if (cashAmount) {
        specialType = 'cash';
      } else if (isLease) {
        specialType = 'lease';
      }

      // Extract Image URL
      const img = card.find('img');
      let rawImg = img.attr('data-image-url') || img.attr('src') || '';
      let imageUrl = '';
      if (rawImg) {
        rawImg = rawImg.replace(/\?impolicy=.*$/i, '').trim();
        if (rawImg.startsWith('//')) {
          imageUrl = `https:${rawImg}`;
        } else if (rawImg.startsWith('/')) {
          imageUrl = `https://${domain}${rawImg}`;
        } else {
          imageUrl = rawImg;
        }
      }

      // Destination URL
      let destUrl = card.attr('data-url-href') || card.find('a').attr('href') || targetUrl;
      if (destUrl && !destUrl.startsWith('http')) {
        try {
          destUrl = new URL(destUrl, targetUrl).href;
        } catch {}
      }

      // Structured Title
      let titleParts: string[] = [`${year} Chevrolet ${model}`];
      if (apr !== undefined && termMonths) {
        titleParts.push(`${apr}% APR for ${termMonths} Months`);
      } else if (apr !== undefined) {
        titleParts.push(`${apr}% APR`);
      }
      if (cashAmount) {
        titleParts.push(`$${cashAmount.toLocaleString()} Bonus Cash`);
      } else if (isLease) {
        titleParts.push(`Special Lease Offer`);
      }
      const specialTitle = titleParts.join(' - ');

      const uniqueKey = `${year}_${model}_${specialType}_${apr || ''}_${cashAmount || ''}`;
      if (!seenSlideKeys.has(uniqueKey)) {
        seenSlideKeys.add(uniqueKey);

        // 1. Structured HTML / DB Special
        htmlSpecials.push({
          id: `carson_${model.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${specialType}_${Date.now()}_${idx}`,
          dealerId,
          offerDealerName: dealerName,
          snapshotDate: today,
          year,
          make: 'Chevrolet',
          model,
          specialType,
          apr,
          termMonths,
          monthlyPayment: cashAmount ? cashAmount : undefined,
          title: specialTitle,
          disclaimer,
          specialUrl: destUrl,
          imageUrl,
          domain
        });
      }

      // 2. Staged Visual Special (each distinct flyer goes into vision staging)
      const hashSource = `${dealerId}_${promoId}_${model}_${imageUrl}`;
      const imageHash = crypto.createHash('sha256').update(hashSource).digest('hex');

      const rawText = [
        specialTitle,
        `Dealer: ${dealerName}`,
        dataTitle ? `Promo Title: ${dataTitle}` : '',
        srOnlyText ? `Description: ${srOnlyText}` : '',
        apr !== undefined ? `APR: ${apr}%` : '',
        termMonths ? `Term: ${termMonths} months` : '',
        cashAmount ? `Bonus/Incentive: $${cashAmount}` : '',
        disclaimer ? `Legal Disclaimer:\n${disclaimer}` : '',
        `Shop Link: ${destUrl}`
      ].filter(Boolean).join('\n---\n');

      visualSpecials.push({
        id: `stg_${dealerId}_${promoId}`,
        dealerId,
        offerDealerName: dealerName,
        clientDealerName: dealerName,
        snapshotDate: today,
        specialType: 'vehicle_banner',
        title: (dataTitle || specialTitle).slice(0, 190),
        details: JSON.stringify({
          imageUrl,
          destinationUrl: destUrl,
          pageUrl: targetUrl,
          promoId,
          model,
          year,
          apr,
          termMonths,
          cashAmount,
          platform: 'dealercom_ws_specials'
        }),
        status: 'pending',
        rawText,
        imageHash,
        imageUrl,
        domain,
        pageUrl: targetUrl
      });
    });

    logger.log(`Extracted ${htmlSpecials.length} structured specials & ${visualSpecials.length} staged banners from ${dealerName}.`);
    return { htmlSpecials, visualSpecials };
  }
}
