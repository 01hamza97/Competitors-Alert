import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import crypto from 'crypto';

export class HyundaiOfAnaheimScraper implements DealerSpecialsScraper {
  readonly id = 'hyundai_of_anaheim';
  readonly name = 'Hyundai Of Anaheim';
  readonly domain = 'hyundaiofanaheim.com';
  readonly specialsUrls = [
    'https://www.hyundaiofanaheim.com/specials/new.htm'
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

    // 2. Expand all promo cards by clicking 'Load More' repeatedly
    try {
      let prevCount = 0;
      for (let attempt = 1; attempt <= 15; attempt++) {
        const cards = await page.$$('.promo[data-promo-id], .promo-type-vehicle[data-promo-id], .promo-type-incentive[data-promo-id]');
        if (cards.length > 0 && cards.length === prevCount && attempt > 2) {
          logger.log(`All promo cards expanded (${cards.length} cards in DOM).`);
          break;
        }
        prevCount = cards.length;

        const loadMoreBtn = page.locator([
          'button:has-text("Load More")',
          'a:has-text("Load More")',
          'button:has-text("Show More")',
          '[data-testid*="load-more"]',
          '.load-more-btn',
          '.load-more'
        ].join(', ')).first();

        const isVisible = await loadMoreBtn.isVisible().catch(() => false);
        if (isVisible) {
          logger.log(`Clicking 'Load More' button (current cards in DOM: ${prevCount})...`);
          await loadMoreBtn.click().catch(() => {});
          await page.waitForTimeout(1500);
        } else {
          // Scroll down to trigger any dynamic lazy-load triggers
          await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 3));
          await page.waitForTimeout(800);
          const isVisibleAfterScroll = await loadMoreBtn.isVisible().catch(() => false);
          if (!isVisibleAfterScroll) break;
        }
      }
    } catch (clickErr: any) {
      logger.warn(`Notice while clicking 'Load More': ${clickErr.message}`);
    }

    // 3. Extract loaded DOM with Cheerio
    const cheerio = await import('cheerio');
    const hydratedHtml = await page.content();
    const $ = cheerio.load(hydratedHtml);

    const visualSpecials: StagedVisualSpecial[] = [];
    const seenPromoIds = new Set<string>();
    const today = new Date().toISOString().split('T')[0];

    // Target top-level promo cards
    const promoCards = $('.promo:not(.wsm-specials-display), [data-promo-id]:not(.wsm-specials-display)');
    logger.log(`Processing ${promoCards.length} promo elements found in DOM...`);

    promoCards.each((i, el) => {
      const card = $(el);
      // Skip inner display elements
      if (card.hasClass('wsm-specials-display') || card.parent().closest('.promo').length > 0) return;

      const promoId = card.attr('data-promo-id') || card.attr('id') || `hoa_${Date.now()}_${i}`;
      if (seenPromoIds.has(promoId)) return;
      seenPromoIds.add(promoId);

      // A. Extract Title
      const dataTitle = (card.attr('data-title') || '').trim();
      const h2 = card.find('h2');
      const h2Title = h2.clone().children().remove().end().text().trim();
      const srOnlyText = card.find('.sr-only').text().trim();
      const title = dataTitle || h2Title || srOnlyText.split('.')[0] || `${dealerName} Special #${i + 1}`;

      // B. Filter Out Non-Vehicle Marketing Promos
      const isMarketingPromo = /why buy|about us|value your trade|schedule service|career|advantage|community|contact us|meet our team|military|college grad|service special|parts special|collision/i.test(title);
      if (isMarketingPromo) {
        logger.log(`Skipping non-vehicle promo card: "${title}"`);
        return;
      }

      // C. Extract Rich Text Elements
      const offerSpan = card.find('h2 span').text().trim();
      const ldJson = card.find('script[type="application/ld+json"]').text().trim();
      const disclaimer = card.find('.details-and-disclaimer-button, .disclaimer, small, p.terms').text().trim();

      const textParts = [
        title,
        offerSpan && offerSpan !== title ? offerSpan : '',
        srOnlyText && srOnlyText !== title && srOnlyText !== offerSpan ? srOnlyText : '',
        ldJson ? `Schema: ${ldJson}` : '',
        disclaimer ? `Disclaimer: ${disclaimer}` : ''
      ].filter(Boolean);

      const rawText = textParts.join('\n---\n');

      // Verify card has some vehicle or payment signal
      const hasVehicleSignal =
        /\b(hyundai|elantra|sonata|tucson|santa fe|palisade|ioniq|kona|venue|santa cruz)\b/i.test(rawText) ||
        /\b(lease|purchase|apr|per month|\/mo|\$|discount|savings|bonus cash|cash back|financing)\b/i.test(rawText);

      if (!hasVehicleSignal) {
        logger.log(`Skipping card without vehicle/pricing signal: "${title}"`);
        return;
      }

      // D. Extract Image URL
      const img = card.find('img');
      let rawImgUrl =
        img.attr('data-image-url') ||
        img.attr('src') ||
        img.attr('data-src') ||
        '';

      let cleanImageUrl = '';
      if (rawImgUrl) {
        if (rawImgUrl.startsWith('//')) {
          cleanImageUrl = `https:${rawImgUrl}`;
        } else if (rawImgUrl.startsWith('/')) {
          cleanImageUrl = `https://${domain}${rawImgUrl}`;
        } else {
          cleanImageUrl = rawImgUrl;
        }
        cleanImageUrl = cleanImageUrl.replace(/\?impolicy=.*$/i, '');
      }

      // E. Extract Click / Destination Link
      let destUrl = card.attr('data-url-href') || card.find('a').attr('href') || targetUrl;
      if (destUrl && !destUrl.startsWith('http')) {
        try {
          destUrl = new URL(destUrl, targetUrl).href;
        } catch {}
      }

      // Stable hash
      const hashSource = `${dealerId}_${promoId}_${title}_${cleanImageUrl}`;
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
          imageUrl: cleanImageUrl,
          destinationUrl: destUrl,
          pageUrl: targetUrl,
          promoId,
          cardType: card.hasClass('custom-asset') ? 'custom_asset' : 'incentive'
        }),
        status: 'pending',
        rawText,
        imageHash,
        imageUrl: cleanImageUrl,
        domain,
        pageUrl: targetUrl
      });
    });

    logger.log(`Extracted ${visualSpecials.length} staged text-based specials ready for AI from ${dealerName}.`);
    return { htmlSpecials: [], visualSpecials };
  }
}
