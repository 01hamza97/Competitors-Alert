import {
  DealerSpecialsScraper,
  ScrapeContext,
  CompetitorVehicleSpecial,
  StagedVisualSpecial
} from './types';
import axios from 'axios';
import crypto from 'crypto';

export class WaldorfFordScraper implements DealerSpecialsScraper {
  readonly id = 'waldorf_ford';
  readonly name = 'Waldorf Ford';
  readonly domain = 'waldorfford.com';
  readonly specialsUrls = [
    'https://www.waldorfford.com/'
  ];

  async scrape(ctx: ScrapeContext): Promise<{
    htmlSpecials: CompetitorVehicleSpecial[];
    visualSpecials: StagedVisualSpecial[];
  }> {
    const { targetUrl, dealerId, dealerName, domain, logger } = ctx;
    const cheerio = await import('cheerio');
    let html = ctx.html || '';

    // 1. Fast fetch homepage HTML directly via Axios if not provided
    if (!html) {
      logger.log(`Fetching ${dealerName} homepage directly...`);
      try {
        const resp = await axios.get(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 25000
        });
        html = resp.data;
      } catch (reqErr: any) {
        logger.warn(`Direct fetch notice: ${reqErr.message}. Checking browser context...`);
      }
    }

    // 2. Fall back to Playwright page if direct request did not succeed
    if (!html && ctx.page) {
      try {
        await ctx.page.waitForSelector('#carousel-Main, .carousel-inner', { timeout: 15000 }).catch(() => {});
        html = await ctx.page.content();
      } catch (pErr: any) {
        logger.warn(`Browser DOM wait notice: ${pErr.message}`);
      }
    }

    if (!html) {
      logger.warn(`Could not retrieve HTML for ${dealerName}.`);
      return { htmlSpecials: [], visualSpecials: [] };
    }

    const $ = (cheerio.load || (cheerio as any).default?.load)(html);
    const visualSpecials: StagedVisualSpecial[] = [];
    const seenAssetIds = new Set<string>();
    const today = new Date().toISOString().split('T')[0];

    // 3. Select homepage carousel slides
    const slides = $('#carousel-Main .carousel-inner > .item, .carousel-inner > .item.banner-slide');
    logger.log(`Found ${slides.length} raw carousel items on ${dealerName} homepage...`);

    slides.each((i, el) => {
      const item = $(el);

      // Skip mobile duplicates (.hideOnDesktop) to select high-res desktop banners (.hideOnMobile / standard)
      if (item.hasClass('hideOnDesktop')) return;

      const a = item.find('a').first();
      let destUrl = a.attr('href') || targetUrl;
      if (destUrl && !destUrl.startsWith('http')) {
        try {
          destUrl = new URL(destUrl, targetUrl).href;
        } catch {}
      }

      const img = item.find('img').first();
      let imgSrc = img.attr('src') || img.attr('data-src') || '';
      if (!imgSrc) {
        // Check picture source tags
        const source = item.find('picture source[media*="min-width"]').first();
        imgSrc = source.attr('srcset') || '';
      }
      if (imgSrc && !imgSrc.startsWith('http')) {
        try {
          imgSrc = new URL(imgSrc, targetUrl).href;
        } catch {}
      }

      if (!imgSrc) return;

      const alt = (img.attr('alt') || img.attr('title') || '').trim();
      const assetId = img.attr('data-assetid') || `slide_${i + 1}`;
      const assetName = img.attr('data-assetname') || '';
      const assetExpire = img.attr('data-asset-expire') || '';

      // Skip non-vehicle events or service banners (e.g. Trunk or Treat, Halloween, Service pickup)
      const isCommunityOrService =
        destUrl.includes('eventbrite.com') ||
        /\b(trunk or treat|halloween|food drive|community event|pickup and delivery|oil change|service appointment)\b/i.test(alt) ||
        /\b(trunk or treat|tot|service)\b/i.test(assetName);

      if (isCommunityOrService) {
        logger.log(`Skipping non-vehicle/service slide #${i + 1}: "${alt}"`);
        return;
      }

      // Verify slide has vehicle, incentive, or inventory intent
      const hasVehicleSignal =
        /\b(0%|apr|payments?|lease|finance|off msrp|\$|save|discount|military|first responders?|transit|f-150|f-250|super duty|explorer|trucks?|inventory)\b/i.test(alt) ||
        /\b(0apr|nopay|military|sd|transit|trucks)\b/i.test(assetName) ||
        destUrl.includes('searchnew.aspx') ||
        destUrl.includes('commercial-trucks');

      if (!hasVehicleSignal) {
        logger.log(`Skipping general branding slide #${i + 1}: "${alt}"`);
        return;
      }

      if (seenAssetIds.has(assetId)) return;
      seenAssetIds.add(assetId);

      const title = alt || assetName.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' ') || `${dealerName} Special #${i + 1}`;

      const textParts = [
        `Offer Title: ${title}`,
        assetExpire ? `Offer Expires: ${assetExpire}` : '',
        `Asset Name: ${assetName}`,
        `Asset ID: ${assetId}`,
        `Promotion Link: ${destUrl}`,
        `Banner Type: Homepage Hero Promotional Flyer`
      ].filter(Boolean);

      const rawText = textParts.join('\n---\n');
      const hashSource = `${dealerId}_${assetId}_${title}_${imgSrc}`;
      const imageHash = crypto.createHash('sha256').update(hashSource).digest('hex');

      visualSpecials.push({
        id: `stg_${dealerId}_banner_${assetId}`,
        dealerId,
        offerDealerName: dealerName,
        clientDealerName: dealerName,
        snapshotDate: today,
        specialType: 'vehicle_flyer', // Staged for n8n Vision AI
        title: title.slice(0, 190),
        details: JSON.stringify({
          assetId,
          assetName,
          title,
          imageUrl: imgSrc,
          destinationUrl: destUrl,
          pageUrl: targetUrl,
          assetExpire,
          platform: 'dealeron_homepage_carousel'
        }),
        status: 'pending',
        rawText,
        imageHash,
        imageUrl: imgSrc,
        domain,
        pageUrl: targetUrl
      });
    });

    logger.log(`Extracted ${visualSpecials.length} marketing campaign flyers from ${dealerName} homepage.`);
    return { htmlSpecials: [], visualSpecials };
  }
}
