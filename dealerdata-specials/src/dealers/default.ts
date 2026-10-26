import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import { SpecialsParser } from '../core/parser';
import { StorageManager } from '../core/storage';

const EXCLUDE_IMAGE_PATTERNS = [
  'logo', 'icon', 'favicon', 'placeholder', 'adchoice', 'comply',
  'cookiebanner', 'tracking', 'analytics', 'pixel', 'badge', 'button',
  'arrow', '.svg', '1x1', 'spacer', 'blank', 'adchoices', 'complyauto',
  'gravatar', 'avatar', 'social', 'header', 'footer', 'nav', 'menu',
  'star', 'rating', 'chat', 'spinner', 'loading', 'loader'
];

export class DefaultSpecialsScraper implements DealerSpecialsScraper {
  readonly id = 'default';
  readonly name = 'Default Generic Dealer Scraper';
  readonly domain = '*';
  readonly specialsUrls: string[] = [];

  constructor(id?: string, name?: string, domain?: string, urls?: string[]) {
    if (id) (this as any).id = id;
    if (name) (this as any).name = name;
    if (domain) (this as any).domain = domain;
    if (urls) (this as any).specialsUrls = urls;
  }

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { $, targetUrl, dealerId, dealerName, domain, logger } = ctx;
    const htmlSpecials: CompetitorVehicleSpecial[] = [];
    const visualSpecials: StagedVisualSpecial[] = [];
    if (!$) return { htmlSpecials, visualSpecials };
    const storage = new StorageManager();

    // 1. EXTRACT STRUCTURED HTML SPECIALS CARDS
    const cardSelectors = [
      '.promo-type-vehicle',
      '.special-card',
      '.offer-card',
      '.vehicle-special',
      '.wsm-specials',
      '.special-item',
      '.deal-item',
      '.specials-item',
      '.vehicle-offer',
      '[data-special-id]',
      '[data-offer-id]',
      '.promo-item'
    ];

    const processedCards = new Set<string>();

    $(cardSelectors.join(', ')).each((_, el) => {
      const card = $(el);
      const cardText = card.text().replace(/\s+/g, ' ').trim();
      if (!cardText || cardText.length < 20) return;

      const title =
        card.find('h1, h2, h3, h4, .title, .vehicle-title, .offer-title, [class*="title"]')
          .first()
          .text()
          .trim() || cardText.slice(0, 80);

      const cardHash = StorageManager.hashString(title + cardText.slice(0, 100));
      if (processedCards.has(cardHash)) return;
      processedCards.add(cardHash);

      const monthlyPayment = SpecialsParser.extractMonthlyPayment(cardText);
      const termMonths = SpecialsParser.extractTermMonths(cardText);
      const downPayment = SpecialsParser.extractDownPayment(cardText);
      const apr = SpecialsParser.extractApr(cardText);
      const msrp = SpecialsParser.extractMsrp(cardText);
      const expirationDate = SpecialsParser.extractExpirationDate(cardText);
      const disclaimer = card.find('.disclaimer, .legal, [class*="disclaimer"], small').text().trim() || undefined;

      const vehicleInfo = SpecialsParser.extractVehicleInfo(title);

      let specialType: 'lease' | 'finance' | 'apr' | 'cash' = 'lease';
      if (apr !== undefined && apr >= 0) specialType = 'apr';
      else if (/finance|purchas/i.test(cardText)) specialType = 'finance';
      else if (/cash|rebate/i.test(cardText)) specialType = 'cash';

      let imageUrl = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || undefined;
      if (imageUrl && !imageUrl.startsWith('http')) {
        try {
          imageUrl = new URL(imageUrl, targetUrl).href;
        } catch {}
      }

      let specialUrl = card.find('a').first().attr('href') || targetUrl;
      if (specialUrl && !specialUrl.startsWith('http')) {
        try {
          specialUrl = new URL(specialUrl, targetUrl).href;
        } catch {}
      }

      if (monthlyPayment || apr !== undefined || downPayment || msrp) {
        htmlSpecials.push({
          dealerId,
          offerDealerName: dealerName,
          year: vehicleInfo.year,
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          trim: vehicleInfo.trim,
          specialType,
          monthlyPayment,
          termMonths,
          downPayment,
          apr,
          msrp,
          title,
          disclaimer,
          expirationDate,
          specialUrl,
          imageUrl,
          domain
        });
      }
    });

    logger.log(`Extracted ${htmlSpecials.length} structured HTML specials.`);

    // 2. EXTRACT PROMOTIONAL BANNER / FLYER IMAGES
    const imageSelectors = [
      'img[src*="special"]',
      'img[src*="offer"]',
      'img[src*="banner"]',
      'img[src*="flyer"]',
      'img[src*="promo"]',
      '.specials-banner img',
      '.special-offer img',
      '.promo-banner img',
      '.offers-grid img',
      '.specials-grid img',
      '.special-item img'
    ];

    const seenImageUrls = new Set<string>();

    const imgElements = $(imageSelectors.join(', '));
    for (let i = 0; i < imgElements.length; i++) {
      const el = imgElements[i];
      const img = $(el);
      let src = img.attr('data-src') || img.attr('src') || img.attr('data-lazy-src') || '';
      if (!src || src.startsWith('data:image')) continue;

      if (!src.startsWith('http')) {
        try {
          src = new URL(src, targetUrl).href;
        } catch {
          continue;
        }
      }

      const lowerSrc = src.toLowerCase();
      const isExcluded = EXCLUDE_IMAGE_PATTERNS.some((p) => lowerSrc.includes(p));
      if (isExcluded) continue;

      if (seenImageUrls.has(src)) continue;
      seenImageUrls.add(src);

      const alt = img.attr('alt') || img.attr('title') || 'Promotional Flyer';
      const downloaded = await storage.downloadImage(src, dealerId, targetUrl);

      if (downloaded) {
        visualSpecials.push({
          dealerId,
          offerDealerName: dealerName,
          clientDealerName: dealerName,
          specialType: 'vehicle',
          title: alt,
          details: src,
          status: 'pending',
          imageHash: downloaded.imageHash,
          imageUrl: src,
          localImagePath: downloaded.localPath,
          domain,
          pageUrl: targetUrl,
          snapshotDate: new Date().toISOString().split('T')[0]
        });
      }
    }

    logger.log(`Extracted & downloaded ${visualSpecials.length} visual specials flyers for Vision AI.`);

    return { htmlSpecials, visualSpecials };
  }
}
