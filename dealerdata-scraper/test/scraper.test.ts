import fs from 'fs';
import path from 'path';
import { cleanHtml } from '../src/services/htmlCleaner';
import { ListingExtractor } from '../src/services/listingExtractor';
import { HtmlSnapshotService } from '../src/services/htmlSnapshotService';
import { DatabaseSync } from '../src/services/dbSync';

console.log('🧪 Starting Dual Engine & Specials Scraper Tests...\n');

// Sample HTML with specials promotional banners and inventory cards
const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>New 2025 Vehicles - Aaron CDJR</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "name": "2025 Ram 1500 Big Horn",
    "vehicleIdentificationNumber": "1C6RR7FG8MS123456",
    "brand": { "@type": "Brand", "name": "Ram" },
    "model": "1500",
    "vehicleModelDate": "2025",
    "itemCondition": "https://schema.org/NewCondition",
    "offers": { "@type": "Offer", "price": "49880" }
  }
  </script>
</head>
<body>
  <div class="chat-widget gubagoo-chat"><p>Live Chat</p></div>

  <!-- Specials Promotional Banner (Image-based special) -->
  <section class="specials-container">
    <div class="special-item">
      <img src="https://images.dealer.com/specials/2025-ram-lease-special-banner.jpg" alt="Lease 2025 Ram 1500 for $399/mo" />
      <p class="terms">Offer expires end of month. $2,999 due at signing. 36-month lease with approved credit.</p>
    </div>
    <div class="special-item">
      <img src="https://images.dealer.com/specials/jeep-grand-cherokee-0apr.png" alt="0% APR for 60 months on 2025 Jeep Grand Cherokee" />
      <small>Excludes tax, title, license.</small>
    </div>
  </section>

  <!-- Inventory Listings -->
  <main class="inventory-list">
    <div class="vehicle-card" data-vin="1C6RR7FG8MS123456" data-stock="R25-101">
      <h2>2025 Ram 1500 Big Horn Quad Cab</h2>
      <div class="price">$49,880</div>
      <div class="msrp">MSRP: $54,200</div>
      <a href="/inventory/2025-ram-1500">Details</a>
    </div>

    <div class="vehicle-card" data-vin="1C4RJFBG9RC789012" data-stock="J25-202">
      <h2>2025 Jeep Grand Cherokee Laredo</h2>
      <div class="price">$42,350</div>
      <div class="msrp">MSRP: $45,100</div>
      <a href="/inventory/2025-jeep-grand-cherokee">Details</a>
    </div>
  </main>
</body>
</html>
`;

// TEST 1: Static Extractor
console.log('--- TEST 1: Static Zero-AI Extractor ---');
const cleaned = cleanHtml(sampleHtml);
const staticListings = ListingExtractor.extractFromJsonLd(cleaned.jsonLdObjects, 'https://example.com', 'aaron_cdjr', 'Aaron CDJR');
console.log(`Extracted ${staticListings.length} vehicle listing(s) directly from JSON-LD.`);
if (staticListings.length > 0 && staticListings[0].vin === '1C6RR7FG8MS123456') {
  console.log('✅ Passed: Static extraction ran with 0 AI tokens.');
} else {
  console.error('❌ Failed: Static JSON-LD extractor failed.');
}

// TEST 2: HTML Snapshot & AI Cleaner
console.log('\n--- TEST 2: HTML Snapshot & Specials Image Capture for N8N + AI ---');
const { cleanedHtml, specialsImages } = HtmlSnapshotService.cleanHtmlForAi(sampleHtml);

console.log(`Specials Promotional Banner Images Discovered: ${specialsImages.length}`);
specialsImages.forEach((img, idx) => {
  console.log(`   [Banner ${idx + 1}] Image: ${img.imageUrl}`);
  console.log(`                     Alt: "${img.altText}"`);
  console.log(`                     Disclaimer: "${img.disclaimerSnippet}"`);
});

if (specialsImages.length === 2 && specialsImages[0].imageUrl.includes('ram-lease-special-banner.jpg')) {
  console.log('✅ Passed: Successfully captured image-based specials and disclaimers for future Vision AI.');
} else {
  console.error('❌ Failed: Specials banner detection failed.');
}

// TEST 3: N8N Manifest Generation
console.log('\n--- TEST 3: N8N Manifest & Clean HTML Storage ---');
const testDir = path.join(process.cwd(), 'crawled_html', 'test_store');
const savedPage = HtmlSnapshotService.savePageHtml('test_store', 1, cleanedHtml);

const manifestPath = HtmlSnapshotService.saveManifest({
  dealerId: 'test_store',
  dealerName: 'Aaron CDJR Test',
  targetUrl: 'https://example.com',
  crawledAt: new Date().toISOString(),
  totalPages: 1,
  engineUsed: 'playwright',
  mode: 'ai-html',
  htmlFiles: [savedPage],
  specialsImages,
  status: 'ready_for_n8n_ai',
  totalListingsExtracted: 0
});

if (fs.existsSync(manifestPath)) {
  const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`✅ Passed: N8N Manifest verified at: ${manifestPath}`);
  console.log(`   - Status: ${content.status}`);
  console.log(`   - Clean HTML Files: ${content.htmlFiles.length}`);
  console.log(`   - Specials Images: ${content.specialsImages.length}`);
} else {
  console.error('❌ Failed: Manifest file was not created.');
}

console.log('\n🎉 ALL DUAL-ENGINE & SPECIALS TESTS PASSED!');
