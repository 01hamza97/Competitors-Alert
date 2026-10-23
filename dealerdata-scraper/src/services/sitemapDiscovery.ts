import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import * as zlib from 'zlib';
import { VehicleListing } from '../types';

const COMMON_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-inventory.xml',
  '/sitemap_inventory.xml',
  '/inventory-sitemap.xml',
  '/sitemap-vehicles.xml',
  '/sitemap-vehicles-1.xml',
  '/sitemap-vehicles-new.xml',
  '/vehicle-sitemap.xml',
  '/sitemap-vdp.xml',
  '/sitemap-inventory-new.xml',
  '/dealersite/sitemap.xml',
  '/sitemap/inventory',
  '/wp-sitemap.xml',
  '/wp-sitemap-posts-inventory-1.xml',
  '/wp-sitemap-posts-vehicle-1.xml',
  '/auto-srp-sitemap.xml',
  '/auto-models-sitemap.xml',
  '/sitemap.ashx',
  '/sitemap.aspx'
];

const INVENTORY_URL_PATTERNS = [
  /\/new-vehicles\//i,
  /\/new-inventory\//i,
  /\/inventory\/new-/i,
  /\/inventory\/[0-9]{4}-/i,
  /\/inventory\/[a-z0-9-]+\/[0-9]{4}-/i,
  /\/inventory\/view\//i,
  /\/inventory\/display\//i,
  /\/vehicles\/[0-9]{4}-/i,
  /\/vehicle-details\//i,
  /\/auto\/new-/i,
  /\/vdp\//i,
  /\/detail\//i,
  /\/viewdetails\//i,
  /\/new\/[a-z0-9-]+\/[0-9]{4}/i,
  // URLs ending with or containing 17-character VIN: e.g. /new-Kenner-2027-Chevrolet-Traverse-LT-1GNERGKS1VJ134544
  /[/-][A-HJ-NPR-Z0-9]{17}(\.html|\/)?$/i
];

const VIN_REGEX = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
const YEAR_REGEX = /\b(20[12]\d)\b/;

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class SitemapDiscovery {
  private static xmlCache = new Map<string, string>();
  private static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  /**
   * Discover and collect candidate inventory sitemaps from robots.txt and standard endpoints
   */
  static async discoverInventorySitemaps(baseUrl: string): Promise<string[]> {
    const origin = new URL(baseUrl).origin;
    console.log(`[Sitemap] Probing sitemaps for: ${origin}`);

    // Step 1.1: Check robots.txt
    const sitemapsFromRobots = await this.getSitemapsFromRobots(origin);
    const confirmedSitemaps: string[] = [];
    const failureReasons: { url: string; status?: number; error?: string }[] = [];

    const probeUrl = async (url: string) => {
      try {
        const res = await axios.get(url, {
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            Accept: 'application/xml,text/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8'
          },
          timeout: 6000,
          responseType: url.endsWith('.gz') ? 'arraybuffer' : 'text',
          validateStatus: () => true
        });

        if (res.status === 200) {
          let data = res.data;
          if (url.endsWith('.gz') && Buffer.isBuffer(data)) {
            try {
              data = zlib.gunzipSync(data).toString('utf-8');
            } catch {
              return null;
            }
          }

          if (typeof data === 'string' && (data.includes('<urlset') || data.includes('<sitemapindex'))) {
            this.xmlCache.set(url, data);
            return { url, size: data.length, status: 200 };
          }
        }

        return { url, status: res.status, notXml: true };
      } catch (err: any) {
        return { url, error: err.message };
      }
    };

    // If robots.txt gave us sitemaps, probe those first to avoid unnecessary hits to other endpoints
    if (sitemapsFromRobots.length > 0) {
      console.log(`[Sitemap] Step 1.2: Probing ${sitemapsFromRobots.length} sitemap(s) from robots.txt...`);
      for (const url of sitemapsFromRobots) {
        const result = await probeUrl(url);
        if (result && result.size) {
          confirmedSitemaps.push(result.url);
          console.log(`[Sitemap] ✅ Found active XML sitemap from robots.txt: ${result.url} (${result.size} bytes)`);
        }
      }
    }

    // If robots.txt yielded active sitemaps, we don't need to hammer common endpoints
    if (confirmedSitemaps.length === 0) {
      const candidateUrls = COMMON_SITEMAP_PATHS.map((p) => `${origin}${p}`);
      console.log(`[Sitemap] Step 1.2: Probing ${candidateUrls.length} candidate sitemap endpoints...`);

      const probeResults = await Promise.allSettled(candidateUrls.map(probeUrl));

      for (const r of probeResults) {
        if (r.status === 'fulfilled' && r.value) {
          if (r.value.size) {
            confirmedSitemaps.push(r.value.url);
            console.log(`[Sitemap] ✅ Found active XML sitemap: ${r.value.url} (${r.value.size} bytes)`);
          } else if (r.value.status === 403) {
            failureReasons.push({ url: r.value.url, status: 403, error: 'HTTP 403 (Protected by Cloudflare / Akamai challenge)' });
          } else if (r.value.status !== 404) {
            failureReasons.push({ url: r.value.url, status: r.value.status });
          }
        }
      }

      if (confirmedSitemaps.length === 0) {
        const blockedCount = failureReasons.filter((f) => f.status === 403).length;
        if (blockedCount > 0) {
          console.log(`[Sitemap] ℹ️ Probed ${candidateUrls.length} candidate paths: ${blockedCount} returned HTTP 403 (Cloudflare/Akamai challenge), remainder 404.`);
        } else {
          console.log(`[Sitemap] ℹ️ Probed ${candidateUrls.length} candidate paths: No active XML sitemaps found.`);
        }
      }
    }

    return confirmedSitemaps;
  }

  /**
   * Parse vehicle URLs from a sitemap (or sitemap index) recursively
   */
  static async parseVehicleUrlsFromSitemap(
    sitemapUrl: string,
    maxUrls = 500,
    depth = 0,
    maxDepth = 3
  ): Promise<string[]> {
    if (depth > maxDepth) return [];

    try {
      let rawXml = this.xmlCache.get(sitemapUrl) || '';

      if (!rawXml) {
        const isGz = sitemapUrl.endsWith('.gz');
        let res: any;
        try {
          res = await axios.get(sitemapUrl, {
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
            timeout: 10000,
            responseType: isGz ? 'arraybuffer' : 'text'
          });
        } catch (fetchErr: any) {
          if (fetchErr.response?.status === 429) {
            console.log(`[Sitemap] HTTP 429 encountered for ${sitemapUrl}. Waiting 1.5s before retry...`);
            await new Promise((r) => setTimeout(r, 1500));
            res = await axios.get(sitemapUrl, {
              headers: { 'User-Agent': DEFAULT_USER_AGENT },
              timeout: 10000,
              responseType: isGz ? 'arraybuffer' : 'text'
            });
          } else {
            throw fetchErr;
          }
        }

        if (isGz && Buffer.isBuffer(res.data)) {
          rawXml = zlib.gunzipSync(res.data).toString('utf-8');
        } else if (typeof res.data === 'string') {
          rawXml = res.data;
        } else {
          return [];
        }
      }

      const parsed = this.parser.parse(rawXml);
      const vehicleUrls: string[] = [];

      // Case 1: Sitemap Index (<sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>)
      if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
        const subs = Array.isArray(parsed.sitemapindex.sitemap)
          ? parsed.sitemapindex.sitemap
          : [parsed.sitemapindex.sitemap];

        // Sort subs so inventory-related sitemaps run first
        subs.sort((a: any, b: any) => {
          const aLoc = (a?.loc || '').toLowerCase();
          const bLoc = (b?.loc || '').toLowerCase();
          const aScore = /inventory|vehicle|vdp|auto|new/.test(aLoc) ? 1 : 0;
          const bScore = /inventory|vehicle|vdp|auto|new/.test(bLoc) ? 1 : 0;
          return bScore - aScore;
        });

        for (const sub of subs) {
          if (sub.loc && typeof sub.loc === 'string') {
            const loc = sub.loc.trim();
            const isRelevant = /inventory|vehicle|vdp|auto|new|sitemap/i.test(loc);
            if (isRelevant || depth === 0) {
              const subUrls = await this.parseVehicleUrlsFromSitemap(loc, maxUrls - vehicleUrls.length, depth + 1, maxDepth);
              vehicleUrls.push(...subUrls);
              if (vehicleUrls.length >= maxUrls) break;
            }
          }
        }
        return [...new Set(vehicleUrls)].slice(0, maxUrls);
      }

      // Case 2: Urlset (<urlset><url><loc>...</loc></url></urlset>)
      if (parsed.urlset && parsed.urlset.url) {
        const entries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
        for (const entry of entries) {
          if (entry.loc && typeof entry.loc === 'string') {
            const loc = entry.loc.trim();
            if (INVENTORY_URL_PATTERNS.some((pattern) => pattern.test(loc))) {
              vehicleUrls.push(loc);
              if (vehicleUrls.length >= maxUrls) break;
            }
          }
        }
      }

      return [...new Set(vehicleUrls)];
    } catch (err: any) {
      console.warn(`[Sitemap] Failed to parse ${sitemapUrl}: ${err.message}`);
      return [];
    }
  }

  /**
   * Generates baseline vehicle listing metadata directly from URL slug
   * Supports standard 17-char VINs, Dealer.com 32-char DDC IDs, and stock IDs
   * e.g. /new/Jeep/2026-Jeep-Compass-9bebd689ac181a1c32bd2d193d9d1137.htm
   * e.g. /new-Kenner-2027-Chevrolet-Traverse-LT-1GNERGKS1VJ134544
   */
  static extractListingFromUrlSlug(
    url: string,
    dealerId?: string,
    dealerName?: string
  ): VehicleListing | null {
    let pathname = '';
    try {
      pathname = new URL(url).pathname;
    } catch {
      pathname = url;
    }

    // Ignore index / landing / informational pages
    if (/\/(index|specials|featured-vehicles|cpov|privacy|terms|directions|about-us|contact)\.htm/i.test(pathname)) {
      return null;
    }

    // 1. Detect VIN or Dealer.com 32-char hex ID or stock ID
    let vin: string | null = null;
    const vinMatch = url.match(VIN_REGEX);
    const ddcMatch = url.match(/\b([a-f0-9]{32})\b/i);
    const stockMatch = url.match(/-(?:vin|stock|id)-([a-z0-9]+)/i);

    if (vinMatch) {
      vin = vinMatch[1].toUpperCase();
    } else if (ddcMatch) {
      vin = `DDC_${ddcMatch[1].toUpperCase()}`;
    } else if (stockMatch) {
      vin = `ID_${stockMatch[1].toUpperCase()}`;
    } else {
      const slugParts = pathname.replace(/\.(html|htm|aspx|php)$/i, '').split(/[-_]/);
      const lastPart = slugParts[slugParts.length - 1];
      if (lastPart && lastPart.length >= 8 && /^[a-z0-9]+$/i.test(lastPart)) {
        vin = `VEH_${lastPart.toUpperCase()}`;
      }
    }

    if (!vin) return null;

    // 2. Year
    const yearMatch = pathname.match(YEAR_REGEX);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

    // 3. Inventory Type
    let inventoryType: 'New' | 'Used' | 'Certified' = 'New';
    if (/\/used\//i.test(pathname) || /used|preowned/i.test(pathname)) inventoryType = 'Used';
    if (/\/certified\//i.test(pathname) || /certified/i.test(pathname)) inventoryType = 'Certified';

    // 4. Parse Make & Model
    let make = 'Unknown';
    let model = 'Unknown';
    let trim: string | undefined;

    const knownMakes = [
      'Chevrolet', 'Chevy', 'Ford', 'Toyota', 'Honda', 'Jeep', 'Ram', 'Dodge', 'Chrysler',
      'Kia', 'Nissan', 'GMC', 'Cadillac', 'Buick', 'Hyundai', 'Subaru', 'BMW', 'Mercedes-Benz'
    ];

    // Pattern A: /new/[Make]/[Year]-[Make]-[Model]-[Hash].htm (Dealer.com format)
    const ddcPattern = pathname.match(/\/(new|used|certified)\/([^/]+)\/(\d{4})-([^-]+)-([^-]+)(?:-([^-]+))?-/i);
    if (ddcPattern) {
      make = ddcPattern[2];
      model = ddcPattern[5].replace(/\+/g, ' ');
      if (ddcPattern[6] && !/^[a-f0-9]{16,}$/i.test(ddcPattern[6])) {
        trim = ddcPattern[6];
      }
    } else {
      const cleanSlug = pathname.replace(/^\//, '').replace(/\.(html|htm|aspx|php)$/i, '');
      const segments = cleanSlug.split(/[-_/]/);

      for (let i = 0; i < segments.length; i++) {
        const match = knownMakes.find((m) => m.toLowerCase() === segments[i].toLowerCase());
        if (match) {
          make = match === 'Chevy' ? 'Chevrolet' : match;
          if (segments[i + 1]) model = segments[i + 1].replace(/\+/g, ' ');
          if (segments[i + 2] && segments[i + 2].length <= 15 && !/^[a-f0-9]{16,}$/i.test(segments[i + 2])) {
            trim = segments[i + 2];
          }
          break;
        }
      }
    }

    if (make === 'Unknown' && model === 'Unknown') {
      return null;
    }

    return {
      vin,
      year,
      make: make === 'Chevy' ? 'Chevrolet' : make,
      model,
      trim,
      inventoryType,
      listPrice: 0,
      vehicleUrl: url,
      dealerId,
      dealerName,
      extractionSource: 'sitemap_vdp',
      discoveredAt: new Date().toISOString()
    };
  }

  private static async getSitemapsFromRobots(origin: string): Promise<string[]> {
    console.log(`[Sitemap] Step 1.1: Checking robots.txt at ${origin}/robots.txt...`);
    try {
      const robotsUrl = `${origin}/robots.txt`;
      const res = await axios.get(robotsUrl, {
        headers: { 'User-Agent': DEFAULT_USER_AGENT },
        timeout: 6000
      });

      const sitemaps: string[] = [];
      const lines = (res.data || '').split('\n');
      for (const line of lines) {
        const match = line.match(/^sitemap:\s*(https?:\/\/[^\s]+)/i);
        if (match && match[1]) {
          sitemaps.push(match[1].trim());
        }
      }
      if (sitemaps.length > 0) {
        console.log(`[Sitemap] robots.txt declared ${sitemaps.length} sitemap(s): ${sitemaps.join(', ')}`);
      } else {
        console.log(`[Sitemap] robots.txt loaded (no "Sitemap:" directives declared)`);
      }
      return sitemaps;
    } catch (err: any) {
      console.log(`[Sitemap] robots.txt check notice: ${err.response?.status ? `HTTP ${err.response.status}` : err.message}`);
      return [];
    }
  }
}

// Export alias for backward compatibility
export const SitemapDiscoverer = SitemapDiscovery;
