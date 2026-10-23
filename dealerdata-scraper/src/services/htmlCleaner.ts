import * as cheerio from 'cheerio';

export interface CleanedHtmlResult {
  jsonLdObjects: any[];
  cleanedText: string;
  cleanedHtml: string;
  listingCardHtmls: string[];
}

/**
 * Strips noise, ads, chat widgets, navigation, and scripts from raw HTML,
 * while extracting structured schema.org JSON-LD data and potential vehicle card nodes.
 */
export function cleanHtml(rawHtml: string): CleanedHtmlResult {
  const $ = cheerio.load(rawHtml);
  const jsonLdObjects: any[] = [];

  // 1. Extract JSON-LD scripts before stripping them
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text().trim();
      if (!text) return;
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        jsonLdObjects.push(...parsed);
      } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        jsonLdObjects.push(...parsed['@graph']);
      } else {
        jsonLdObjects.push(parsed);
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  // 2. Remove script and style tags (excluding what we already extracted)
  $('script, style, noscript, iframe, link').remove();

  // 3. Remove common website noise elements (navs, footers, headers, cookie bars, chat widgets)
  $(
    [
      'header',
      'footer',
      'nav',
      'aside',
      '.header',
      '.footer',
      '.navigation',
      '.site-header',
      '.site-footer',
      '.cookie-banner',
      '.cookie-consent',
      '.privacy-notice',
      '#cookie-notice',
      '.chat-widget',
      '#live-chat',
      '.drift-frame-controller',
      '#drift-widget',
      '.gubagoo-chat',
      '.car-chat',
      '#podium-bubble',
      '.modal',
      '.popup',
      'svg',
    ].join(', ')
  ).remove();

  // 4. Identify potential listing / product card containers
  const listingSelectors = [
    '.vehicle-card',
    '.inventory-item',
    '.inventory-card',
    '.vehicle-item',
    '.srp-vehicle',
    '.srp-item',
    '.vehicle-overview',
    '.vehicleList-item',
    '[data-vin]',
    '[data-vehicle-id]',
    '.inv-type-new',
    '.inventory-list__item',
    '.product-card',
    '.listing-item'
  ];

  const listingCardHtmls: string[] = [];
  $(listingSelectors.join(', ')).each((_, el) => {
    const cardHtml = $(el).html();
    if (cardHtml && cardHtml.length > 50) {
      listingCardHtmls.push(cardHtml);
    }
  });

  return {
    jsonLdObjects,
    cleanedText: $('body').text().replace(/\s+/g, ' ').trim(),
    cleanedHtml: $.html(),
    listingCardHtmls
  };
}
