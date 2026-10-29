import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import crypto from 'crypto';

export class PomonaKiaScraper implements DealerSpecialsScraper {
  readonly id = 'pomona_kia';
  readonly name = 'Pomona Kia';
  readonly domain = 'pomonakia.com';
  readonly specialsUrls = [
    'https://www.pomonakia.com/'
  ];

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;

    // 1. If browser page is not provided, delegate to Playwright in index.ts
    if (!ctx.page) {
      logger.log(`Browser context required for hero carousel extraction. Delegating to Playwright...`);
      return { htmlSpecials: [], visualSpecials: [] };
    }

    const page = ctx.page;
    logger.log(`Executing homepage hero slider extraction for ${dealerName} (${dealerId})...`);

    // 2. Wait for hero slider / swiper to hydrate in DOM
    try {
      await page.waitForSelector(
        '.sbBlock__hero9--slider, #di-slider--slider199, [class*="hero"] .swiper-slide, .sb-swiper',
        { timeout: 15000 }
      );
      // Brief pause to allow swiper calculation
      await page.waitForTimeout(2000);
    } catch (e: any) {
      logger.warn(`Waiting for slider notice: ${e.message}`);
    }

    // 3. Extract slides from the hero slider
    const rawSlides = await page.$$eval(
      '.sbBlock__hero9--slider .swiper-slide:not(.swiper-slide-duplicate), #di-slider--slider199 .swiper-slide:not(.swiper-slide-duplicate), [class*="hero"] .swiper-slide:not(.swiper-slide-duplicate)',
      (slides) => {
        return slides.map((s, idx) => {
          const dataTitle = s.getAttribute('data-title') || '';
          const a = s.querySelector('a');
          const link = a ? a.href : '';
          const picture = s.querySelector('picture');
          const sourceDesktop = picture ? picture.querySelector('source[media*="min-width"]') : null;
          const desktopSrcset = sourceDesktop ? sourceDesktop.getAttribute('srcset') : '';
          const sourceMobile = picture ? picture.querySelector('source[media*="max-width"]') : null;
          const mobileSrcset = sourceMobile ? sourceMobile.getAttribute('srcset') : '';
          const img = s.querySelector('img');
          const imgSrc = img ? img.getAttribute('src') : '';
          const imgAlt = img ? img.getAttribute('alt') : '';

          let chosenImage = '';
          if (desktopSrcset) {
            chosenImage = desktopSrcset.split(',')[0].trim().split(' ')[0];
          } else if (imgSrc) {
            chosenImage = imgSrc;
          } else if (mobileSrcset) {
            chosenImage = mobileSrcset.split(',')[0].trim().split(' ')[0];
          }

          return {
            slideIndex: idx + 1,
            dataTitle,
            imgAlt,
            link,
            chosenImage
          };
        });
      }
    ).catch(() => []);

    logger.log(`Found ${rawSlides.length} hero slider item(s) on ${dealerName} homepage.`);

    const visualSpecials: StagedVisualSpecial[] = [];
    const seenImages = new Set<string>();
    const today = new Date().toISOString().split('T')[0];

    for (const slide of rawSlides) {
      const imgUrl = (slide.chosenImage || '').trim();
      if (!imgUrl || seenImages.has(imgUrl)) continue;

      // Discard generic transparent model line-up cutouts if any slipped through
      if (imgUrl.includes('/modelImages/angled-left/')) continue;

      seenImages.add(imgUrl);

      // Clean title
      const rawTitle = slide.dataTitle || slide.imgAlt || `${dealerName} Special #${slide.slideIndex}`;
      const cleanTitle = rawTitle
        .replace(/\s*–\s*\d+x\d+.*$/i, '')
        .replace(/\s*–\s*\d+×\d+.*$/i, '')
        .trim();

      const imageHash = crypto
        .createHash('sha256')
        .update(`${dealerId}_${imgUrl}`)
        .digest('hex');

      const stagingId = `stg_${dealerId}_${imageHash.slice(0, 16)}`;

      const textParts = [
        `Dealer: ${dealerName}`,
        `Banner Headline: ${cleanTitle}`,
        slide.imgAlt && slide.imgAlt !== cleanTitle ? `Banner Alt Text: ${slide.imgAlt}` : '',
        `Shop / Destination URL: ${slide.link || targetUrl}`,
        `Source Page: ${targetUrl}`,
        `Platform: DealerInspire Hero Carousel`
      ].filter(Boolean);

      const rawText = textParts.join('\n---\n');

      visualSpecials.push({
        id: stagingId,
        dealerId,
        offerDealerName: dealerName,
        clientDealerName: dealerName,
        snapshotDate: today,
        specialType: 'vehicle_flyer',
        title: cleanTitle.slice(0, 190),
        details: JSON.stringify({
          imageUrl: imgUrl,
          destinationUrl: slide.link || targetUrl,
          pageUrl: targetUrl,
          slideIndex: slide.slideIndex,
          dataTitle: slide.dataTitle,
          imgAlt: slide.imgAlt,
          platform: 'dealerinspire_hero_carousel'
        }),
        status: 'pending',
        rawText,
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
