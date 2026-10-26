# DealerData Specials Scraper (`dealerdata-specials`)

Dedicated, modular specials scraper for automotive dealership promotional offers, lease specials, APR deals, and visual marketing flyers.

Designed with **complete dealer isolation**: every dealership has its own isolated scraper file so you can add, fix, or customize one store without touching or risking others.

---

## ⚡ Features

- **ZenRows Residential Proxy Routing**: Pre-configured with ZenRows rotating US residential proxies to bypass Akamai EdgeSuite, Cloudflare Turnstile, and Wordfence firewalls.
- **Stealth Headless Chromium**: Automates JavaScript execution, dynamic DOM rendering, and lazy-loaded card hydration using Playwright.
- **Isolated Dealer Scrapers**: Every dealership has its own TypeScript module in `src/dealers/` (e.g. `j_star_cdjr.ts`, `tuttle_click_hyundai.ts`).
- **Default Heuristic Fallback**: Any new or unconfigured store works out-of-the-box via `default.ts`.
- **Dual Output Support**:
  1. **Structured HTML Specials**: Monthly payment, lease term, down payment, APR %, MSRP, and legal disclaimers synced directly to `competitor_vehicle_specials`.
  2. **Visual Flyer / Banner Images**: Downloaded locally with SHA-256 deduplication and staged into `specials_staging` + N8N `manifest.json` for Vision AI processing.

---

## 📁 Project Structure

```
dealerdata-specials/
├── .env                       # ZenRows proxy & MySQL credentials
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts               # Programmatic scrapeSpecials() orchestrator
│   ├── cli.ts                 # CLI entry point
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces & types
│   ├── core/
│   │   ├── browser.ts         # Playwright Chromium manager with ZenRows proxy
│   │   ├── parser.ts          # Financial extraction regex (lease, APR, DAS, MSRP)
│   │   ├── db.ts              # MySQL sync (competitor_vehicle_specials & specials_staging)
│   │   └── storage.ts         # Image downloader & N8N manifest.json generator
│   └── dealers/
│       ├── types.ts           # DealerSpecialsScraper interface
│       ├── registry.ts        # Central scraper registry & router
│       ├── default.ts         # Fallback scraper for unconfigured stores
│       ├── j_star_cdjr.ts     # J Star CDJR (PixelMotion / WordPress)
│       ├── tuttle_click_hyundai.ts      # Tuttle Click Hyundai (Dealer.com)
│       ├── huntington_beach_hyundai.ts  # Huntington Beach Hyundai (Dealer.com)
│       ├── moss_bros_cdjr.ts  # Moss Bros CDJR (Dealer.com)
│       └── aaron_cdjr.ts      # Aaron CDJR (Dealer.com)
```

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd dealerdata-specials
npm install
```

### 2. Configure `.env`

A pre-configured `.env` is created with your ZenRows proxy:
```ini
SCRAPER_PROXY_URL="http://bf266ef611c316456f4784d9a50b3d92c4ed5eda:proxy_country=us&premium_proxy=true@proxy.zenrows.com:8001"
ZENROWS_API_KEY="bf266ef611c316456f4784d9a50b3d92c4ed5eda"

DB_HOST="localhost"
DB_USER="root"
DB_PASSWORD="your_password"
DB_NAME="dealerdata-2"
DB_PORT="3306"
```

---

## 🛠️ CLI Usage

### List All Configured Scrapers
```bash
npm run scrape -- --list
```

### Scrape a Specific Dealer by ID
```bash
# J Star CDJR
npm run scrape -- --dealer=j_star_cdjr

# Tuttle Click Hyundai
npm run scrape -- --dealer=tuttle_click_hyundai

# Huntington Beach Hyundai
npm run scrape -- --dealer=hunting_ton_beach_hyundai
```

### Scrape an Ad-Hoc Target URL
```bash
npm run scrape -- --url="https://www.exampledealer.com/new-specials.htm" --dealer=example_dealer
```

### Scrape All Registered Dealers Sequentially
```bash
npm run scrape:all
```

### Skip Database Sync (Dry Run)
```bash
npm run scrape -- --dealer=j_star_cdjr --no-db
```

---

## ➕ How to Add a New Dealership (2 Minutes)

To add a new dealership, create a dedicated file in `src/dealers/` and register it:

1. **Create `src/dealers/my_new_dealer.ts`**:
   ```typescript
   import { DealerSpecialsScraper, ScrapeContext, CompetitorVehicleSpecial, StagedVisualSpecial } from './types';
   import { DefaultSpecialsScraper } from './default';

   export class MyNewDealerScraper implements DealerSpecialsScraper {
     readonly id = 'my_new_dealer';
     readonly name = 'My New Dealership';
     readonly domain = 'mynewdealer.com';
     readonly specialsUrls = [
       'https://www.mynewdealer.com/specials/new/'
     ];

     async scrape(ctx: ScrapeContext) {
       // You can inherit generic logic:
       const fallback = new DefaultSpecialsScraper();
       const result = await fallback.scrape(ctx);

       // Or add dealer-specific custom DOM parsing here:
       // ...

       return result;
     }
   }
   ```

2. **Register it in `src/dealers/registry.ts`**:
   ```typescript
   import { MyNewDealerScraper } from './my_new_dealer';

   // In static initialization:
   DealerRegistry.register(new MyNewDealerScraper());
   ```

3. **Run your new scraper**:
   ```bash
   npm run scrape -- --dealer=my_new_dealer
   ```
