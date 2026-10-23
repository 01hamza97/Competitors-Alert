const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function generatePdf() {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DealerData - Supported Platforms & Architecture Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.4;
      font-size: 11.5px;
      margin: 0;
      padding: 0;
    }

    .page {
      width: 100%;
      min-height: 275mm;
      max-height: 277mm;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
    }

    .page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }

    .page-content {
      flex: 1;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }

    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.4px;
      margin: 0 0 2px 0;
    }

    .brand-subtitle {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
      margin: 0;
    }

    .meta-badge {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 4px 10px;
      text-align: right;
    }

    .meta-badge .date {
      font-size: 11px;
      font-weight: 700;
      color: #0369a1;
      display: block;
    }

    .meta-badge .version {
      font-size: 10px;
      color: #0284c7;
    }

    .executive-card {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 12px;
    }

    .executive-card h3 {
      margin: 0 0 4px 0;
      font-size: 11.5px;
      font-weight: 700;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .executive-card p {
      margin: 0;
      color: #e2e8f0;
      font-size: 11px;
      line-height: 1.45;
    }

    h2 {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin: 12px 0 6px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: #e0f2fe;
      color: #0284c7;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 700;
    }

    p.intro-text {
      margin: 0 0 6px 0;
      color: #475569;
      font-size: 10.5px;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 6px 0 10px 0;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      overflow: hidden;
      font-size: 10.5px;
      page-break-inside: avoid;
    }

    th {
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.3px;
    }

    td {
      padding: 5px 8px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      vertical-align: middle;
      line-height: 1.35;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) td {
      background: #fafafc;
    }

    .badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 9.5px;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }

    .badge-blue {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }

    .badge-green {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }

    .badge-purple {
      background: #f3e8ff;
      color: #7e22ce;
      border: 1px solid #e9d5ff;
    }

    .badge-amber {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    .funnel-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 6px;
      margin-bottom: 4px;
      page-break-inside: avoid;
    }

    .funnel-step {
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 8px 10px;
      background: #f8fafc;
    }

    .funnel-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .funnel-number {
      width: 17px;
      height: 17px;
      border-radius: 50%;
      background: #0284c7;
      color: white;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .funnel-title {
      font-weight: 700;
      font-size: 11px;
      color: #0f172a;
    }

    .funnel-body {
      font-size: 10px;
      color: #64748b;
      margin: 0;
      line-height: 1.4;
    }

    .specials-card-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 6px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }

    .spec-card {
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 8px 10px;
      background: #ffffff;
    }

    .spec-card h4 {
      margin: 0 0 3px 0;
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
    }

    .spec-card p {
      font-size: 10px;
      color: #64748b;
      margin: 0;
      line-height: 1.4;
    }

    .stat-pill {
      font-weight: 700;
      color: #0284c7;
    }

    .footer {
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 9.5px;
    }
  </style>
</head>
<body>

  <!-- ======================== PAGE 1 ======================== -->
  <div class="page">
    <div class="page-content">
      <!-- HEADER -->
      <div class="header">
        <div>
          <h1 class="brand-title">DealerData Intelligence</h1>
          <p class="brand-subtitle">Automotive Scraper Platform Support & Architecture Specification</p>
        </div>
        <div class="meta-badge">
          <span class="date">October 2026</span>
          <span class="version">Scraper Engine v2.4 (Enterprise)</span>
        </div>
      </div>

      <!-- EXECUTIVE SUMMARY -->
      <div class="executive-card">
        <h3>Executive Architecture Summary</h3>
        <p>
          The DealerData scraping subsystem implements a dual-architecture paradigm: <strong>dedicated native adapters</strong> optimized for top tier automotive CMS vendors (Dealer.com, Dealer Inspire, DealerOn, CDK Global, etc.) coupled with an autonomous <strong>Universal Cascading Funnel</strong> capable of crawling any dealer website via XML sitemaps, Schema.org JSON-LD extraction, and headless stealth Playwright automation.
        </p>
      </div>

      <!-- SECTION 1: NATIVE PLATFORM ADAPTERS -->
      <h2><span class="section-icon">01</span> Dedicated Automotive Platform Adapters</h2>
      <p class="intro-text">Platforms with dedicated drivers, internal state extractors, and direct REST/GraphQL feeds:</p>

      <table>
        <thead>
          <tr>
            <th style="width: 20%;">Platform / Code</th>
            <th style="width: 22%;">Vendor & Ecosystem</th>
            <th style="width: 26%;">Extraction Mechanism</th>
            <th style="width: 32%;">Key Features & Capabilities</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Dealer.com</strong><br><span class="badge badge-blue">dealercom</span></td>
            <td>Cox Automotive</td>
            <td>Direct SRP + <code style="font-size:9.5px;">DDC.WS.state</code> + Playwright</td>
            <td>
              • Parses internal state <code style="font-size:9px;">DDC.WS.state['ws-inv-data']</code><br>
              • Native WIS incentive, rebate & lease parser<br>
              • DDC URL facet handler (<code style="font-size:9px;">/new-inventory/index.htm</code>)
            </td>
          </tr>
          <tr>
            <td><strong>Dealer Inspire</strong><br><span class="badge badge-green">dealerinspire</span></td>
            <td>Cars Commerce / Cars.com</td>
            <td>CarsCommerce REST API + JSON-LD</td>
            <td>
              • Direct API with <code style="font-size:9px;">x-api-key</code> authorization<br>
              • Fallback endpoint <code style="font-size:9px;">/inventory/search?format=json</code><br>
              • High-res CDN image stream (<code style="font-size:9px;">carscommerce.inc</code>)
            </td>
          </tr>
          <tr>
            <td><strong>DealerOn</strong><br><span class="badge badge-purple">dealeron</span></td>
            <td>DealerOn Inc.</td>
            <td>JSON-LD Schema + SRP Card Engine</td>
            <td>
              • Schema.org <code style="font-size:9px;">ItemList</code> / <code style="font-size:9px;">Vehicle</code> extraction<br>
              • Native widget summary query probe<br>
              • Clean VIN-keyed pricing & stock resolution
            </td>
          </tr>
          <tr>
            <td><strong>CDK Global</strong><br><span class="badge badge-amber">cdk</span></td>
            <td>CDK / DealerTrack</td>
            <td>Runtime DOM + Playwright Stealth</td>
            <td>
              • Detects <code style="font-size:9px;">window.cdk</code> & vendor scripts<br>
              • Handles complex multi-store dealer portals<br>
              • Stealth anti-bot challenge bypass
            </td>
          </tr>
          <tr>
            <td><strong>Team Velocity</strong><br><span class="badge badge-blue">teamvelocity</span></td>
            <td>Apollo Automotive Sites</td>
            <td>HTML SRP + Specials Selectors</td>
            <td>
              • Apollo-specific inventory card & title parser<br>
              • Dynamic pricing and incentive tags
            </td>
          </tr>
          <tr>
            <td><strong>Pixel Motion</strong><br><span class="badge badge-green">pixelmotion</span></td>
            <td>Pixel Motion Automotive</td>
            <td>HTML SRP + Media CDN Engine</td>
            <td>
              • Custom layout facet filters & inventory tables<br>
              • Banner specials via <code style="font-size:9px;">pixelmotion.com</code> CDN
            </td>
          </tr>
          <tr>
            <td><strong>AutoFi</strong><br><span class="badge badge-purple">autofi</span></td>
            <td>AutoFi Inc.</td>
            <td>Widget Probe + Dynamic DOM</td>
            <td>
              • Digital retailing pricing overlay extraction<br>
              • Payment breakdown (lease vs finance terms)
            </td>
          </tr>
        </tbody>
      </table>

      <!-- SECTION 2: UNIVERSAL 4-STAGE CASCADING FUNNEL -->
      <h2><span class="section-icon">02</span> The Universal 4-Stage Cascading Funnel</h2>
      <p class="intro-text">For unlisted or custom dealer CMS websites (<code style="font-size:10px;">mode: "auto"</code>), the crawler executes this sequential fallback funnel:</p>

      <div class="funnel-grid">
        <div class="funnel-step">
          <div class="funnel-header">
            <div class="funnel-number">1</div>
            <div class="funnel-title">Sitemap Discovery & VDP Crawl</div>
          </div>
          <p class="funnel-body">
            Probes <code style="font-size:9.5px;">robots.txt</code> and sitemap indexes (<code style="font-size:9.5px;">sitemap_inventory.xml</code>, <code style="font-size:9.5px;">vehicles.xml</code>). Concurrently crawls direct vehicle URLs (VDPs) with zero browser overhead.
          </p>
        </div>
        <div class="funnel-step">
          <div class="funnel-header">
            <div class="funnel-number">2</div>
            <div class="funnel-title">Direct Platform API & Feeds</div>
          </div>
          <p class="funnel-body">
            Probes standard automotive REST endpoints and JSON feeds (CarsCommerce, <code style="font-size:9.5px;">/api/inventory</code>, <code style="font-size:9.5px;">WSInventorySummary</code>). Retrieves clean structured records instantly.
          </p>
        </div>
        <div class="funnel-step">
          <div class="funnel-header">
            <div class="funnel-number">3</div>
            <div class="funnel-title">Direct Target URL SRP Crawl</div>
          </div>
          <p class="funnel-body">
            Fetches search results pages directly using HTTP stealth headers. Parses embedded JSON-LD graphs and extracts cards across 11 universal automotive CSS selectors.
          </p>
        </div>
        <div class="funnel-step">
          <div class="funnel-header">
            <div class="funnel-number">4</div>
            <div class="funnel-title">Stealth Playwright Headless Browser</div>
          </div>
          <p class="funnel-body">
            Automates full Chromium browser with anti-detection evasions (pre-warmed origins, Cloudflare Turnstile handling, lazy-load auto-scroll, and DOM capture).
          </p>
        </div>
      </div>
    </div>

    <!-- FOOTER P1 -->
    <div class="footer">
      <span>DealerData Performance Suite &bull; Confidential & Proprietary</span>
      <span>Page 1 of 2</span>
    </div>
  </div>

  <!-- ======================== PAGE 2 ======================== -->
  <div class="page">
    <div class="page-content">
      <!-- SECTION 3: SPECIALS & LEASE INCENTIVES EXTRACTION -->
      <h2><span class="section-icon">03</span> Specials, Lease & Visual Flyer Extraction Engine</h2>
      <p class="intro-text">Dealership specials are published either as structured HTML components or visual promotional flyer images. The scraper pipeline handles both seamlessly:</p>

      <div class="specials-card-grid">
        <div class="spec-card">
          <h4>1. Structured HTML Component Specials</h4>
          <p>
            Extracts lease/finance parameters directly from HTML DOM or JSON-LD:
            <br>• <strong>Monthly Payment:</strong> Regex patterns for <code style="font-size:9.5px;">$XX/mo</code>, <code style="font-size:9.5px;">per month</code>
            <br>• <strong>Lease Term:</strong> Detects terms (e.g., 24, 36, 39, 48 months)
            <br>• <strong>Down Payment (DAS):</strong> Due-at-signing & down payment extraction
            <br>• <strong>APR & Discounts:</strong> Special APR rates & MSRP rebates
            <br>• Directly synced to <code style="font-size:9.5px;">competitor_vehicle_specials</code>.
          </p>
        </div>
        <div class="spec-card">
          <h4>2. Visual Graphic Flyer Staging (AI Vision Ready)</h4>
          <p>
            When specials are embedded inside graphic flyers (e.g. J Star CDJR):
            <br>• <strong>Smart CDN Filter:</strong> Filters out logos, social icons, and tracking pixels
            <br>• <strong>SHA-256 Content Hashing:</strong> Computes <code style="font-size:9.5px;">image_hash</code> on download
            <br>• <strong>Global AI Cache:</strong> Checks if image was parsed previously by AI in any workspace, avoiding duplicate Vision AI API costs
            <br>• Staged in <code style="font-size:9.5px;">specials_staging</code>.
          </p>
        </div>
      </div>

      <!-- SECTION 4: PRODUCTION LIVE DISTRIBUTION -->
      <h2><span class="section-icon">04</span> Current Production Store Distribution</h2>
      <p class="intro-text">Current distribution of active stores and competitors monitored in the database:</p>

      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Platform Identifier</th>
            <th style="width: 40%;">Configuration Mode</th>
            <th style="width: 12%; text-align: center;">Stores</th>
            <th style="width: 12%; text-align: center;">Competitors</th>
            <th style="width: 11%; text-align: center;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Auto / Universal</strong> (<code style="font-size:9.5px;">auto</code>)</td>
            <td>Autonomous 4-Tier Funnel</td>
            <td style="text-align: center;">3</td>
            <td style="text-align: center;">5</td>
            <td style="text-align: center;"><strong class="stat-pill">8</strong></td>
          </tr>
          <tr>
            <td><strong>Dealer Inspire</strong> (<code style="font-size:9.5px;">dealerinspire</code>)</td>
            <td>Native CarsCommerce API + JSON-LD</td>
            <td style="text-align: center;">0</td>
            <td style="text-align: center;">6</td>
            <td style="text-align: center;"><strong class="stat-pill">6</strong></td>
          </tr>
          <tr>
            <td><strong>Dealer.com</strong> (<code style="font-size:9.5px;">dealercom</code>)</td>
            <td>DDC State + SRP Crawl</td>
            <td style="text-align: center;">4</td>
            <td style="text-align: center;">3</td>
            <td style="text-align: center;"><strong class="stat-pill">7</strong></td>
          </tr>
          <tr>
            <td><strong>DealerOn</strong> (<code style="font-size:9.5px;">dealeron</code>)</td>
            <td>Schema.org ItemList + Search Widget</td>
            <td style="text-align: center;">0</td>
            <td style="text-align: center;">2</td>
            <td style="text-align: center;"><strong class="stat-pill">2</strong></td>
          </tr>
          <tr>
            <td><strong>AutoFi</strong> (<code style="font-size:9.5px;">autofi</code>)</td>
            <td>AutoFi Retail Widget Probe</td>
            <td style="text-align: center;">0</td>
            <td style="text-align: center;">2</td>
            <td style="text-align: center;"><strong class="stat-pill">2</strong></td>
          </tr>
          <tr>
            <td><strong>Team Velocity</strong> (<code style="font-size:9.5px;">teamvelocity</code>)</td>
            <td>Apollo Card Selectors</td>
            <td style="text-align: center;">0</td>
            <td style="text-align: center;">1</td>
            <td style="text-align: center;"><strong class="stat-pill">1</strong></td>
          </tr>
        </tbody>
      </table>

      <!-- SECTION 5: PERFORMANCE & COST EFFICIENCY CONTROLS -->
      <h2><span class="section-icon">05</span> Efficiency, Caching & Anti-Block Safeguards</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 26%;">Feature</th>
            <th style="width: 24%;">Configuration</th>
            <th style="width: 50%;">Operational Benefit</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Global Domain Scrape Cache</strong></td>
            <td><span class="badge badge-green">Strict 6-Hour TTL</span></td>
            <td>Prevents redundant browser launches when multiple stores monitor the same competitor domain. Instant sub-second response.</td>
          </tr>
          <tr>
            <td><strong>SHA-256 Flyer AI Deduplication</strong></td>
            <td><span class="badge badge-blue">image_hash</span></td>
            <td>Identical promotional flyers reuse completed AI Vision extractions globally, saving up to 90% of LLM processing fees.</td>
          </tr>
          <tr>
            <td><strong>Inherit-and-Override Store Overlay</strong></td>
            <td><span class="badge badge-purple">workspace_special_overrides</span></td>
            <td>Stores can customize or adjust canonical specials without breaking continuous sync with fresh global scrapes.</td>
          </tr>
          <tr>
            <td><strong>Stealth Cloudflare Resolution</strong></td>
            <td><span class="badge badge-amber">Pre-Warm + Turnstile</span></td>
            <td>Automated pre-warming via origin homepage eliminates 403 blocks on sensitive dealership CDNs.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- FOOTER P2 -->
    <div class="footer">
      <span>DealerData Performance Suite &bull; Confidential & Proprietary</span>
      <span>Page 2 of 2</span>
    </div>
  </div>

</body>
</html>
`;

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  // Output paths
  const rootPdfPath = path.resolve(__dirname, '..', '..', 'DealerData_Supported_Scraper_Platforms.pdf');
  const publicPdfPath = path.resolve(__dirname, '..', '..', 'dealerdata-next', 'public', 'DealerData_Supported_Scraper_Platforms.pdf');

  await page.pdf({
    path: rootPdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '8mm',
      bottom: '8mm',
      left: '10mm',
      right: '10mm'
    }
  });

  // Also copy to public directory for easy browser download
  fs.copyFileSync(rootPdfPath, publicPdfPath);

  await browser.close();

  console.log('Refined 2-page PDF generated successfully at:');
  console.log('1.', rootPdfPath);
  console.log('2.', publicPdfPath);
}

generatePdf().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
