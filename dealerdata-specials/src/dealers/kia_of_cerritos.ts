import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import crypto from 'crypto';

export class KiaOfCerritosScraper implements DealerSpecialsScraper {
  readonly id = 'kia_of_cerritos';
  readonly name = 'Kia Of Cerritos';
  readonly domain = 'kiacerritos.com';
  readonly specialsUrls = [
    'https://www.kiacerritos.com/',
    'https://www.kiacerritos.com/new-vehicle-specials/'
  ];

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;

    // 1. Browser context required for Cloudflare clearance and dynamic DOM rendering
    if (!ctx.page) {
      logger.log(`Browser context required for ${dealerName}. Delegating to Playwright...`);
      return { htmlSpecials: [], visualSpecials: [] };
    }

    const page = ctx.page;
    logger.log(`Executing specials extraction for ${dealerName} (${dealerId}) on ${targetUrl}...`);

    // 2. Wait for Cloudflare clearance if challenge is displayed
    const startWait = Date.now();
    while (Date.now() - startWait < 20000) {
      const pageTitle = await page.title().catch(() => '');
      if (pageTitle.includes('Just a moment') || pageTitle.includes('Attention Required')) {
        logger.log(`Cloudflare challenge active on ${targetUrl}. Waiting for clearance...`);
        await page.waitForTimeout(2000);
        continue;
      }
      break;
    }

    const htmlSpecials: CompetitorVehicleSpecial[] = [];
    const visualSpecials: StagedVisualSpecial[] = [];
    const seenImages = new Set<string>();
    const today = new Date().toISOString().split('T')[0];

    const isSpecialsPage = targetUrl.includes('/new-vehicle-specials') || targetUrl.includes('/specials');

    // ==========================================
    // A. SPECIALS PAGE CARDS EXTRACTION
    // ==========================================
    if (isSpecialsPage) {
      try {
        await page.waitForSelector('.special-offer.card, li.special-offer, .special-offer', { timeout: 15000 });
        await page.waitForTimeout(1500);
      } catch (e: any) {
        logger.warn(`Waiting for specials cards selector notice: ${e.message}`);
      }

      const rawCards = await page.$$eval('.special-offer.card, li.special-offer', (cards) => {
        return cards.map((c, idx) => {
          const cardId = c.id || c.getAttribute('data-offer-id') || `offer_${idx + 1}`;
          const h2 = c.querySelector('h2')?.textContent?.trim() || '';
          const cta = c.querySelector('.specialOfferFormCTA');
          const claimTitle = cta?.getAttribute('data-lightbox-title') || '';
          
          const imgEl = c.querySelector('.offer-image-link img, img');
          const imgSrc = imgEl?.getAttribute('src') || '';
          const imgAlt = imgEl?.getAttribute('alt') || '';
          
          const linkEl = c.querySelector('.offer-image-link, a.primary-button, a[data-diso-event="special-offers-cta1"]');
          const link = (linkEl as HTMLAnchorElement)?.href || '';
          
          const discEl = c.querySelector('.disclaimer p, .disclaimer, .disclaimer-content');
          const disclaimer = discEl?.textContent?.replace(/\s+/g, ' ')?.trim() || '';

          return {
            cardId,
            h2,
            claimTitle,
            imgSrc,
            imgAlt,
            link,
            disclaimer
          };
        });
      }).catch(() => []);

      logger.log(`Found ${rawCards.length} specials offer card(s) on ${dealerName} specials page.`);

      for (const card of rawCards) {
        const title = card.h2 || card.claimTitle || `${dealerName} Special`;
        const disclaimer = card.disclaimer || '';
        const imgUrl = (card.imgSrc || '').trim();

        // 1. Structured HTML Special Extraction
        const yearMatch = title.match(/\b(202[4-9])\b/) || disclaimer.match(/\b(202[4-9])\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

        // Model extraction
        const modelRegex = /\b(EV3|EV6|EV9|Niro\s*EV|Niro|Seltos|Sportage|Sorento|Telluride|Carnival|K4|K5|Forte|Soul)\b/i;
        const modelMatch = title.match(modelRegex) || disclaimer.match(modelRegex);
        let model = modelMatch ? modelMatch[1].trim() : '';
        if (/niro\s*ev/i.test(model)) model = 'Niro EV';

        // Trim extraction
        let trim = '';
        const trimMatch = title.match(/\b(LX|LXS|S|EX|SX|SX-Prestige|GT-Line|GT|X-Line|X-Pro|Nightfall)\b/i);
        if (trimMatch) {
          trim = trimMatch[1].trim();
        }

        // Pricing & Terms from disclaimer
        let specialType: 'lease' | 'finance' | 'cash' | 'apr' | 'vehicle' = 'vehicle';
        let monthlyPayment: number | undefined;
        let termMonths: number | undefined;
        let downPayment: number | undefined;
        let apr: number | undefined;
        let msrp: number | undefined;

        if (/closed-end\s*lease/i.test(disclaimer) || /payment\s+of\s+\$?\d+\s+per\s+month/i.test(disclaimer)) {
          specialType = 'lease';
        } else if (/APR/i.test(disclaimer) || /financed/i.test(disclaimer)) {
          specialType = 'finance';
        }

        const payMatch = disclaimer.match(/payment\s+of\s+\$([0-9,]+)\s+per\s+month(?:\s+for\s+(\d+)\s+months)?/i);
        if (payMatch) {
          monthlyPayment = parseFloat(payMatch[1].replace(/,/g, ''));
          if (payMatch[2]) termMonths = parseInt(payMatch[2], 10);
        }

        if (!termMonths) {
          const termMatch = disclaimer.match(/(\d+)[-\s]months/i);
          if (termMatch) termMonths = parseInt(termMatch[1], 10);
        }

        const downMatch = disclaimer.match(/due\s+at\s+signing:?\s*\$([0-9,]+)/i);
        if (downMatch) {
          downPayment = parseFloat(downMatch[1].replace(/,/g, ''));
        }

        const aprMatch = disclaimer.match(/([0-9.]+)%\s*APR/i);
        if (aprMatch) {
          apr = parseFloat(aprMatch[1]);
        }

        const msrpMatch = disclaimer.match(/MSRP:?\s*\$([0-9,]+)/i);
        if (msrpMatch) {
          msrp = parseFloat(msrpMatch[1].replace(/,/g, ''));
        }

        let expirationDate: string | undefined;
        const expMatch = disclaimer.match(/expires\s+([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{2,4})/i);
        if (expMatch) {
          const mm = expMatch[1].padStart(2, '0');
          const dd = expMatch[2].padStart(2, '0');
          let yyyy = expMatch[3];
          if (yyyy.length === 2) yyyy = `20${yyyy}`;
          expirationDate = `${yyyy}-${mm}-${dd}`;
        }

        if (model || monthlyPayment || apr) {
          htmlSpecials.push({
            dealerId,
            offerDealerName: dealerName,
            snapshotDate: today,
            year,
            make: 'Kia',
            model: model || 'Models',
            trim: trim || undefined,
            specialType,
            monthlyPayment,
            termMonths,
            downPayment,
            apr,
            msrp,
            title,
            disclaimer,
            expirationDate,
            specialUrl: card.link || targetUrl,
            imageUrl: imgUrl,
            domain
          });
        }

        // 2. Stage Visual Special for N8N AI Vision
        if (imgUrl && !seenImages.has(imgUrl)) {
          seenImages.add(imgUrl);
          const imageHash = crypto.createHash('sha256').update(`${dealerId}_${imgUrl}`).digest('hex');
          const stagingId = `stg_${dealerId}_${imageHash.slice(0, 16)}`;

          const textParts = [
            `Dealer: ${dealerName}`,
            `Headline: ${title}`,
            card.claimTitle && card.claimTitle !== title ? `Offer Blurb: ${card.claimTitle}` : '',
            disclaimer ? `Disclaimer: ${disclaimer}` : '',
            `Shop URL: ${card.link || targetUrl}`,
            `Source Page: ${targetUrl}`,
            `Platform: DealerInspire Specials Card`
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
              destinationUrl: card.link || targetUrl,
              pageUrl: targetUrl,
              cardId: card.cardId,
              model,
              trim,
              platform: 'dealerinspire_specials_card'
            }),
            status: 'pending',
            rawText: textParts.join('\n---\n'),
            imageHash,
            imageUrl: imgUrl,
            domain,
            pageUrl: targetUrl
          });
        }
      }
    }

    // ==========================================
    // B. HOMEPAGE HERO CAROUSEL EXTRACTION
    // ==========================================
    const hasHeroSlider = await page.$('.sbBlock__hero9--slider, #di-slider--slider2434, [class*="hero"] .swiper-slide, .sb-swiper').catch(() => null);
    if (hasHeroSlider || !isSpecialsPage) {
      try {
        await page.waitForSelector(
          '.sbBlock__hero9--slider, #di-slider--slider2434, [class*="hero"] .swiper-slide, .sb-swiper',
          { timeout: 15000 }
        );
        await page.waitForTimeout(2000);
      } catch (e: any) {
        logger.warn(`Waiting for hero slider notice: ${e.message}`);
      }

      const rawSlides = await page.$$eval(
        '.sbBlock__hero9--slider .swiper-slide:not(.swiper-slide-duplicate), #di-slider--slider2434 .swiper-slide:not(.swiper-slide-duplicate), [class*="hero"] .swiper-slide:not(.swiper-slide-duplicate)',
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

            const discEl = s.querySelector('.disclaimer-content, .sb-swiper__disclaimer, .sbOverlay');
            const disclaimer = discEl ? discEl.textContent?.replace(/\s+/g, ' ')?.trim() : '';

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
              disclaimer: disclaimer || '',
              chosenImage
            };
          });
        }
      ).catch(() => []);

      logger.log(`Found ${rawSlides.length} hero slider item(s) on ${dealerName} homepage.`);

      for (const slide of rawSlides) {
        const imgUrl = (slide.chosenImage || '').trim();
        if (!imgUrl || seenImages.has(imgUrl)) continue;

        // Discard generic dealer branding slides (#1 Dealer, Why Buy From Us)
        const slideTitle = slide.dataTitle || '';
        const slideAlt = slide.imgAlt || '';
        const isBranding =
          /why\s+buy/i.test(slideTitle) ||
          /why\s+buy/i.test(slideAlt) ||
          /#1\s+dealer/i.test(slideTitle) ||
          /congrats\s+slide/i.test(slideAlt) ||
          imgUrl.includes('WhyBuy');

        if (isBranding) continue;

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
          slide.disclaimer ? `Disclaimer: ${slide.disclaimer}` : '',
          `Shop / Destination URL: ${slide.link || targetUrl}`,
          `Source Page: ${targetUrl}`,
          `Platform: DealerInspire Hero Carousel`
        ].filter(Boolean);

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
            disclaimer: slide.disclaimer,
            platform: 'dealerinspire_hero_carousel'
          }),
          status: 'pending',
          rawText: textParts.join('\n---\n'),
          imageHash,
          imageUrl: imgUrl,
          domain,
          pageUrl: targetUrl
        });
      }
    }

    logger.log(
      `Extracted ${htmlSpecials.length} structured HTML special(s) and ${visualSpecials.length} visual flyer(s) from ${targetUrl}.`
    );

    return { htmlSpecials, visualSpecials };
  }
}
