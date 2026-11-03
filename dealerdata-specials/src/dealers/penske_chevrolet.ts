import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import crypto from 'crypto';

export class PenskeChevroletScraper implements DealerSpecialsScraper {
  readonly id = 'penske_chevrolet';
  readonly name = 'Penske Chevrolet';
  readonly domain = 'penskechevroletofcerritos.com';
  readonly specialsUrls = [
    'https://www.penskechevroletofcerritos.com/'
  ];
  readonly useDirectConnection = true;

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
    const cheerio = await import('cheerio');
    let html = ctx.html || '';

    // 1. If HTML is missing and browser context is available, wait for bannerSec
    if (!html && ctx.page) {
      try {
        await ctx.page.waitForSelector('.bannerSec, #carouselWithDisclaimer-Main, .banner-slide', { timeout: 15000 });
        html = await ctx.page.content();
      } catch (err: any) {
        logger.warn(`Browser DOM wait notice: ${err.message}`);
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
    const today = new Date().toISOString().split('T')[0];

    // Target slides inside DealerOn homepage carousel
    const slides = $('#carouselWithDisclaimer-Main .banner-slide, #carousel-Main .item, .bannerSec .item');
    logger.log(`Found ${slides.length} candidate hero slides in DOM...`);

    const seenSlideKeys = new Set<string>();

    slides.each((idx, el) => {
      const item = $(el);
      const ariaLabel = item.attr('aria-label') || `slide-${idx + 1}`;
      const img = item.find('img').first();
      const alt = (img.attr('alt') || img.attr('title') || '').trim();
      const rawLink = item.find('a').attr('href') || '';
      const assetExpire = img.attr('data-asset-expire') || '';

      // Disclaimer text from data-content
      const discBtn = item.find('#disclaimerBtn-Main, .banner-disclaimer-btn');
      const dataContent = discBtn.attr('data-content') || '';
      let disclaimer = '';
      if (dataContent) {
        try {
          const $disc = (cheerio.load || (cheerio as any).default?.load)(dataContent);
          disclaimer = $disc('.banner-disclaimer-content__text, p').text().replace(/\s+/g, ' ').trim();
        } catch {}
      }

      // Filter out non-vehicle / non-sales slides (e.g. Service, Tires, generic used inventory)
      const isService = /service|tire|parts|oil change|brake/i.test(alt) || rawLink.includes('/service');
      if (isService) {
        logger.log(`Skipping non-sales slide: "${alt || ariaLabel}"`);
        return;
      }

      // Model & Year Extraction
      const fullText = `${alt} ${disclaimer}`;

      let model = '';
      if (/silverado\s*(1500|2500\s*hd|3500\s*hd|ev)?/i.test(fullText)) {
        const m = fullText.match(/silverado\s*(1500|2500\s*hd|3500\s*hd|ev)?/i);
        model = m && m[1] ? `Silverado ${m[1].replace(/\s+/g, ' ').trim()}` : 'Silverado 1500';
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

      const yearMatch = fullText.match(/\b(202[4-7])\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

      // Extract APR
      const aprMatch = `${alt} ${disclaimer}`.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*APR/i);
      const apr = aprMatch ? parseFloat(aprMatch[1]) : undefined;

      // Extract Term
      let termMonths: number | undefined;
      const termMonthsMatch = `${alt} ${disclaimer}`.match(/for\s*([0-9]{2})\s*months/i);
      if (termMonthsMatch) {
        termMonths = parseInt(termMonthsMatch[1], 10);
      } else {
        const termYearsMatch = `${alt} ${disclaimer}`.match(/for\s*([0-9])\s*years/i);
        if (termYearsMatch) {
          termMonths = parseInt(termYearsMatch[1], 10) * 12;
        }
      }

      // Extract Cash / Bonus Cash / Rebates
      const cashMatch = `${alt} ${disclaimer}`.match(/\$([0-9,]+)\s*(?:bonus cash|customer cash|rebate|member incentive)/i);
      const cashAmount = cashMatch ? parseFloat(cashMatch[1].replace(/,/g, '')) : undefined;

      const isLease = /lease/i.test(fullText);

      // Require valid model and specific offer (APR, Cash, or Lease)
      if (!model || (apr === undefined && !cashAmount && !isLease)) {
        logger.log(`Skipping slide without specific pricing/offer signal: "${alt || ariaLabel}"`);
        return;
      }

      // Classify Special Type
      let specialType: 'apr' | 'cash' | 'lease' | 'finance' = 'finance';
      if (apr !== undefined) {
        specialType = 'apr';
      } else if (cashAmount) {
        specialType = 'cash';
      } else if (isLease) {
        specialType = 'lease';
      }

      // Extract High-Res Image URL
      let rawImg = item.find('picture source[media*="min-width"]').attr('srcset') ||
                   img.attr('src') || '';
      let imageUrl = '';
      if (rawImg) {
        rawImg = rawImg.replace(/\s+\d+w$/i, '').trim();
        if (rawImg.startsWith('//')) {
          imageUrl = `https:${encodeURI(rawImg)}`;
        } else if (rawImg.startsWith('/')) {
          imageUrl = `https://${domain}${encodeURI(rawImg)}`;
        } else if (!rawImg.startsWith('http')) {
          imageUrl = `https://${domain}/${encodeURI(rawImg)}`;
        } else {
          imageUrl = encodeURI(rawImg);
        }
      }

      // Destination URL
      let specialUrl = rawLink || targetUrl;
      if (specialUrl && !specialUrl.startsWith('http')) {
        try {
          specialUrl = new URL(specialUrl, targetUrl).href;
        } catch {}
      }

      // Expiration Date
      let expirationDate: string | undefined;
      if (assetExpire) {
        try {
          const exp = new Date(assetExpire);
          if (!isNaN(exp.getTime())) {
            expirationDate = exp.toISOString().split('T')[0];
          }
        } catch {}
      }

      // Build structured title
      let titleParts: string[] = [`${year} Chevrolet ${model}`];
      if (apr !== undefined && termMonths) {
        titleParts.push(`${apr}% APR for ${termMonths} Months`);
      } else if (apr !== undefined) {
        titleParts.push(`${apr}% APR`);
      }
      if (cashAmount) {
        titleParts.push(`$${cashAmount.toLocaleString()} Bonus Cash`);
      }
      const specialTitle = titleParts.join(' - ');

      const uniqueKey = `${year}_${model}_${specialType}_${apr || ''}_${cashAmount || ''}`;
      if (seenSlideKeys.has(uniqueKey)) return;
      seenSlideKeys.add(uniqueKey);

      // 1. Structured HTML / DB Special
      htmlSpecials.push({
        id: `penske_${model.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${specialType}_${Date.now()}_${idx}`,
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
        expirationDate,
        specialUrl,
        imageUrl,
        domain
      });

      // 2. Staged Visual Special (for vision processing / manifest / staging table)
      const hashSource = `${dealerId}_${idx}_${model}_${imageUrl}`;
      const imageHash = crypto.createHash('sha256').update(hashSource).digest('hex');

      const rawText = [
        specialTitle,
        `Dealer: ${dealerName}`,
        alt ? `Caption: ${alt}` : '',
        apr !== undefined ? `APR: ${apr}%` : '',
        termMonths ? `Term: ${termMonths} months` : '',
        cashAmount ? `Bonus/Incentive: $${cashAmount}` : '',
        expirationDate ? `Expires: ${expirationDate}` : '',
        disclaimer ? `Legal Disclaimer:\n${disclaimer}` : '',
        `Shop Link: ${specialUrl}`
      ].filter(Boolean).join('\n---\n');

      visualSpecials.push({
        id: `stg_${dealerId}_slide_${idx + 1}`,
        dealerId,
        offerDealerName: dealerName,
        clientDealerName: dealerName,
        snapshotDate: today,
        specialType: 'vehicle_banner',
        title: specialTitle.slice(0, 190),
        details: JSON.stringify({
          imageUrl,
          destinationUrl: specialUrl,
          pageUrl: targetUrl,
          slideIndex: idx,
          model,
          year,
          apr,
          termMonths,
          cashAmount,
          expirationDate,
          platform: 'dealeron_hero'
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
