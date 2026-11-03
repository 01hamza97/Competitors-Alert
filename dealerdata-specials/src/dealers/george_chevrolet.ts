import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import crypto from 'crypto';

export class GeorgeChevroletScraper implements DealerSpecialsScraper {
  readonly id = 'george_chevorlet';
  readonly name = 'George Chevrolet';
  readonly domain = 'georgechevy.com';
  readonly specialsUrls = [
    'https://www.georgechevy.com/'
  ];
  readonly useDirectConnection = true;

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
    const cheerio = await import('cheerio');
    let html = ctx.html || '';

    // 1. If HTML is missing and browser context is available, ensure carousel DOM is loaded
    if (!html && ctx.page) {
      try {
        await ctx.page.waitForSelector('.sb-swiper, .swiper-slide', { timeout: 15000 });
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

    // Target slides specifically inside hero swiper carousel, excluding duplicates
    const heroSlider = $('.sb-swiper[data-testid="slider"], [id^="di-slider--"], .sb-swiper').first();
    let slides = heroSlider.find('.swiper-slide:not(.swiper-slide-duplicate)');
    if (slides.length === 0) {
      slides = $('.sb-swiper .swiper-slide:not(.swiper-slide-duplicate)');
    }
    logger.log(`Found ${slides.length} candidate hero slides in DOM...`);

    const seenSlideKeys = new Set<string>();

    slides.each((idx, el) => {
      const slide = $(el);
      const dataTitle = (slide.attr('data-title') || '').trim();
      const slideTestId = slide.attr('data-testid') || `slide-${idx + 1}`;
      const slideIndex = slide.attr('data-swiper-slide-index') || `${idx}`;

      const img = slide.find('picture img').first();
      const alt = (img.attr('alt') || '').trim();
      const rawLink = slide.find('a.linkWrapper').attr('href') || '';
      const disclaimer = slide.find('.disclaimer-content').text().replace(/\s+/g, ' ').trim();

      // Filter out non-vehicle / non-sales slides (welcome, tires, service, accessories)
      const isService = /service|tire|parts|oil change|brake/i.test(dataTitle) ||
                        /service|tire|parts|oil change|brake/i.test(alt) ||
                        rawLink.includes('/service/');
      const isWelcome = /welcome/i.test(dataTitle) || /welcome to/i.test(alt);

      if (isService || isWelcome) {
        logger.log(`Skipping non-sales slide: "${dataTitle || alt || slideTestId}"`);
        return;
      }

      // Model & Year Extraction
      const fullText = `${dataTitle} ${alt} ${disclaimer}`;

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

      if (!model) {
        logger.warn(`Could not determine vehicle model for slide: "${dataTitle || alt}". Skipping.`);
        return;
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

      // Classify Special Type
      let specialType: 'apr' | 'cash' | 'lease' | 'finance' = 'finance';
      if (apr !== undefined) {
        specialType = 'apr';
      } else if (cashAmount) {
        specialType = 'cash';
      } else if (/lease/i.test(fullText)) {
        specialType = 'lease';
      }

      // Extract High-Res Image URL (preferred desktop 1800x760)
      let imageUrl = slide.find('picture source[media*="min-width"]').attr('srcset') ||
                     img.attr('src') ||
                     slide.find('img').attr('src') || '';
      if (imageUrl) {
        imageUrl = imageUrl.trim().split(/\s+/)[0];
        if (imageUrl.startsWith('//')) {
          imageUrl = `https:${imageUrl}`;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = `https://${domain}${imageUrl}`;
        }
      }

      // Destination URL
      let specialUrl = rawLink || targetUrl;
      if (specialUrl && !specialUrl.startsWith('http')) {
        try {
          specialUrl = new URL(specialUrl, targetUrl).href;
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
        id: `george_${model.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${specialType}_${Date.now()}_${idx}`,
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
        specialUrl,
        imageUrl,
        domain
      });

      // 2. Staged Visual Special (for vision processing / manifest / staging table)
      const hashSource = `${dealerId}_${slideTestId}_${model}_${imageUrl}`;
      const imageHash = crypto.createHash('sha256').update(hashSource).digest('hex');

      const rawText = [
        specialTitle,
        `Dealer: ${dealerName}`,
        alt ? `Caption: ${alt}` : '',
        apr !== undefined ? `APR: ${apr}%` : '',
        termMonths ? `Term: ${termMonths} months` : '',
        cashAmount ? `Bonus/Incentive: $${cashAmount}` : '',
        disclaimer ? `Legal Disclaimer:\n${disclaimer}` : '',
        `Shop Link: ${specialUrl}`
      ].filter(Boolean).join('\n---\n');

      visualSpecials.push({
        id: `stg_${dealerId}_${slideTestId}`,
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
          slideIndex,
          slideTestId,
          model,
          year,
          apr,
          termMonths,
          cashAmount,
          platform: 'dealer_inspire_hero'
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
