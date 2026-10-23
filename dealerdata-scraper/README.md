# DealerData Scraper 🏎️💨

High-performance, automotive-specialized scraper, crawler, and clean inventory extractor built for the **DealerData SaaS** platform.

---

## 🌟 Key Capabilities

1. **Intelligent Direct API Probing**:
   - Detects automotive website platforms (**Dealer Inspire, Dealer.com, DealerOn, CDK Global**).
   - If a dealership exposes direct inventory APIs (e.g., `/inventory/search?format=json&status=new` or `/api/widget/WSInventorySummary/get/`), it directly queries and normalizes JSON data for maximum speed and accuracy without DOM parsing.

2. **Sitemap & `robots.txt` Discovery**:
   - Parses `robots.txt` for `Sitemap:` directives.
   - Probes automotive inventory sitemaps (`/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-inventory.xml`, `/vehicle-sitemap.xml`, etc.).
   - Recursively parses sitemap indexes to extract exact Vehicle Detail Page (VDP) URLs.

3. **Noise Stripping & HTML Cleaning (`htmlCleaner.ts`)**:
   - Strips cookie banners, live chat widgets (Gubagoo, Drift, Podium, CarChat24), navbars, footers, ad trackers, and styles.
   - Extracts structured schema.org JSON-LD objects (`Vehicle`, `Car`, `Automobile`, `Product`) before sanitization.

4. **Paginated SRP & VDP Crawler (`crawler.ts`)**:
   - Follows pagination (`rel="next"`, `a.next`, query parameters `?page=2`, etc.) up to configurable depth.
   - Normalizes pricing (List Price, MSRP, Dealer Discounts), VIN, Stock #, Year, Make, Model, Trim, Mileage, and Image URLs.

5. **VIN Deduplication & Freshness Guarantee**:
   - Automatically deduplicates records using the global **17-character VIN** (Vehicle Identification Number), ensuring no duplicate inventory counts across paginated pages or duplicate sitemap entries.
   - Filters specifically for **New** inventory as requested by your clients.

6. **Dual Export (MySQL + JSON)**:
   - Stores raw snapshots in `./output/listings_<domain>_<timestamp>.json`.
   - Seamlessly syncs to the MySQL database `competitor_vehicle_inventory` table for immediate display in DealerData Next.js dashboards.

---

## 🚀 Quick Start

### 1. Installation

```bash
cd dealerdata-scraper
npm install
npm run build
```

### 2. Environment Configuration

Ensure `.env` in `dealerdata-scraper/` contains your MySQL credentials:

```env
DATABASE_URL="mysql://root:1254879863@localhost:3306/dealerdata"
DB_HOST="localhost"
DB_USER="root"
DB_PASSWORD="your_password"
DB_NAME="dealerdata"
DB_PORT="3306"
```

### 3. Running from CLI

```bash
# Scrape a target store's New vehicle inventory (default 3 pages)
npm run scrape -- --url=https://www.aaronfordescondido.com --type=New --pages=3 --dealerId=store_01

# Crawl only via HTML without probing API
npm run scrape -- --url=https://www.targetdealership.com --no-api

# Crawl without writing to database (JSON output only)
npm run scrape -- --url=https://www.targetdealership.com --no-db
```

---

## 💻 Programmatic Usage (Node.js / TypeScript)

You can import and trigger the scraper inside any service or API route:

```typescript
import { scrapeDealership } from './src';

const result = await scrapeDealership({
  targetUrl: 'https://www.targetdealership.com',
  inventoryType: 'New',
  maxPages: 5,
  dealerId: 'store_01',
  saveToDb: true,
  tryDirectApi: true,
  useSitemapFirst: true,
});

console.log(`Found ${result.totalListingsFound} vehicles!`);
console.log(`JSON output saved to: ${result.outputFile}`);
```

---

## 🔄 N8N & Workflow Automation Integration

This project is tailored for direct integration into your planned **N8N workflow**:

1. **Execute Command Node**:
   Trigger `ts-node /path/to/dealerdata-scraper/src/cli.ts --url={{$json.dealership_url}} --dealerId={{$json.dealer_id}}`.
2. **Webhook / API Route**:
   Expose an endpoint or cron trigger to run batch crawls across all competitor dealerships in your database.
3. **Database Sink**:
   All new vehicles are automatically synced directly into `competitor_vehicle_inventory`, instantly updating the SaaS dashboard's Competitor Analysis, Inventory, and Pricing views.
