import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import crypto from 'crypto';

export class KiaOfDtlaScraper implements DealerSpecialsScraper {
  readonly id = 'kia_of_dtla';
  readonly name = 'KIA Of DTLA';
  readonly domain = 'kiaofdtla.com';
  readonly specialsUrls = [
    'https://www.kiaofdtla.com/'
  ];

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;

    // 1. Browser context required for dynamic Vue rotational carousel
    if (!ctx.page) {
      logger.log(`Browser context required for ${dealerName}. Delegating to Playwright...`);
      return { htmlSpecials: [], visualSpecials: [] };
    }

    const page = ctx.page;
    logger.log(`Executing homepage hero carousel extraction for ${dealerName} (${dealerId})...`);

    // 2. Wait for rotational banner / carousel in DOM
    try {
      await page.waitForSelector(
        '.search-six-pack-carousel, #carousel-rotational-banner, #rotaional-carousel, .primary-rotational-banner, .carousel__track',
        { timeout: 15000 }
      );
      await page.waitForTimeout(2000);
    } catch (e: any) {
      logger.warn(`Waiting for carousel selector notice: ${e.message}`);
    }

    // 3. Extract slides from carousel
    const rawSlides = await page.$$eval(
      '.search-six-pack-carousel .carousel__slide, #rotaional-carousel .carousel__slide, .primary-rotational-banner .carousel__slide',
      (slides) => {
        return slides.map((s, idx) => {
          const img = s.querySelector('img');
          const rawSrc = img?.getAttribute('src') || img?.src || '';
          const alt = img?.getAttribute('alt')?.trim() || '';
          const a = s.querySelector('a');
          const href = a?.getAttribute('href') || (a as HTMLAnchorElement)?.href || '';
          const promoData = a?.getAttribute('ga-promo-data') || '';

          // Ensure full quality parameter for N8N AI Vision
          let highResSrc = rawSrc;
          if (highResSrc.includes('quality=')) {
            highResSrc = highResSrc.replace(/quality=\d+/, 'quality=95');
          }

          return {
            slideIndex: idx + 1,
            slideId: s.id || `slide-${idx}`,
            alt,
            src: highResSrc,
            href,
            promoData
          };
        });
      }
    ).catch(() => []);

    logger.log(`Found ${rawSlides.length} carousel slide item(s) on ${dealerName} homepage.`);

    const visualSpecials: StagedVisualSpecial[] = [];
    const seenImageKeys = new Set<string>();
    const today = new Date().toISOString().split('T')[0];

    for (const slide of rawSlides) {
      const imgUrl = (slide.src || '').trim();
      if (!imgUrl) continue;

      // Extract unique library image ID if available, e.g. fileNameOrId=949282
      const idMatch = imgUrl.match(/fileNameOrId=([a-zA-Z0-9]+)/i);
      const imgKey = idMatch ? idMatch[1] : imgUrl;
      if (seenImageKeys.has(imgKey)) continue;
      seenImageKeys.add(imgKey);

      // Filter out non-vehicle dealership branding & service banners
      const alt = slide.alt || '';
      const isNonVehicle =
        /experience\s+the\s+new/i.test(alt) ||
        /express\s+service/i.test(alt) ||
        /service/i.test(alt) ||
        /value\s+your\s+trade/i.test(alt) ||
        /trade-?in/i.test(alt) ||
        imgKey === '206099' || // Value Your Trade
        imgKey === '805560' || // Express Service
        imgKey === '807448';   // Experience the New Dealership

      if (isNonVehicle) {
        continue;
      }

      // Determine appropriate title
      let title = '';
      if (imgKey === '891592') {
        title = '2026 Kia Niro EV - Save $3,500 MyFirstEV Program';
      } else if (imgKey === '891589') {
        title = '2026 Kia EV6 - Save $3,500 MyFirstEV Program';
      } else if (alt && !/rotational\s*banner/i.test(alt)) {
        title = alt.toLowerCase().startsWith('kia') ? alt : `Kia ${alt}`;
      } else {
        title = `${dealerName} Special #${slide.slideIndex}`;
      }

      const imageHash = crypto
        .createHash('sha256')
        .update(`${dealerId}_${imgKey}`)
        .digest('hex');

      const stagingId = `stg_${dealerId}_${imageHash.slice(0, 16)}`;
      const destUrl = slide.href || 'https://www.kiaofdtla.com/inventory/new';

      const textParts = [
        `Dealer: ${dealerName}`,
        `Banner Headline: ${title}`,
        alt && alt !== title ? `Banner Alt Tag: ${alt}` : '',
        slide.promoData ? `Promo Tag: ${slide.promoData}` : '',
        `Destination URL: ${destUrl}`,
        `Source Page: ${targetUrl}`,
        `Platform: SecureOfferSites / Vue Carousel`
      ].filter(Boolean);

      visualSpecials.push({
        id: stagingId,
        dealerId,
        offerDealerName: dealerName,
        clientDealerName: dealerName,
        snapshotDate: today,
        specialType: 'vehicle_flyer',
        title: title.slice(0, 190),
        details: JSON.stringify({
          imageUrl: imgUrl,
          destinationUrl: destUrl,
          pageUrl: targetUrl,
          slideIndex: slide.slideIndex,
          alt: slide.alt,
          imageKey: imgKey,
          platform: 'secureoffersites_rotational_carousel'
        }),
        status: 'pending',
        rawText: textParts.join('\n---\n'),
        imageHash,
        imageUrl: imgUrl,
        domain,
        pageUrl: targetUrl
      });
    }

    logger.log(`Extracted ${visualSpecials.length} visual flyer special(s) ready for AI Vision from ${dealerName}.`);
    return { htmlSpecials: [], visualSpecials };
  }
}
