import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const scraperStoreId = process.env.SCRAPER_STORE_ID;

if (!supabaseUrl || !supabaseKey || !anthropicKey || !scraperStoreId) {
  throw new Error("Missing required environment variables");
}

const anthropic = new Anthropic({ apiKey: anthropicKey });
const now = new Date();
const today = now.toISOString().split("T")[0];
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
const prevMonth = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0");
const prevYear = now.getMonth() === 0 ? currentYear - 1 : currentYear;

// DI CDN image patterns - platform-based, not dealer-specific
// All DI dealers use: di-uploads-pod{N}.dealerinspire.com/{slug}/uploads/{year}/{month}/
const SPECIAL_IMAGE_CDNS = [
  "vehicle-images.carscommerce.inc",
  "di-uploads-pod",
  "pictures.dealer.com",
  "gtmassets.dealerinspire.com",
  "images.dealer.com/ddc/",
];

const EXCLUDE_PATTERNS = [
  "logo", "icon", "favicon", "placeholder", "adchoice",
  "comply", "cookiebanner", "tracking", "analytics", "pixel",
  "badge", "button", "arrow", ".svg", "1x1", "spacer", "blank",
  "adchoices", "complyauto", "gravatar", "avatar"
];

// Store configs with DI pod/slug for CDN approach
const STORE_CONFIGS = {
  aaron_ford_escondido: {
    dealer_id: "aaron_ford_escondido",
    client_dealer_name: "Aaron Ford Escondido",
    group_name: "Aaron Automotive Group",
    platform: "dealercom",
    specials_url: "https://www.aaronfordescondido.com/new-vehicles/new-vehicle-specials/",
    competitors: [
      { name: "Encinitas Ford", platform: "dealerinspire", di_pod: "45", di_slug: "encinitasford", specials_url: "https://www.encinitasford.com/new-vehicles/new-vehicle-specials/" },
      { name: "Ken Grody Ford Carlsbad", platform: "dealerinspire", di_pod: "39", di_slug: "kengrodyfordsandiego", specials_url: "https://www.kengrodyfordsandiego.com/new-vehicles/new-vehicle-specials/" }
    ]
  },
  aaron_ford_lake_elsinore: {
    dealer_id: "aaron_ford_lake_elsinore", client_dealer_name: "Aaron Ford Lake Elsinore",
    group_name: "Aaron Automotive Group", platform: "dealercom",
    specials_url: "https://www.aaronfordlakeelsinore.com/new-vehicles/new-vehicle-specials/",
    competitors: []
  },
  aaron_ford_of_poway: {
    dealer_id: "aaron_ford_of_poway", client_dealer_name: "Aaron Ford of Poway",
    group_name: "Aaron Automotive Group", platform: "dealercom",
    specials_url: "https://www.aaronfordofpoway.com/new-vehicles/new-vehicle-specials/",
    competitors: []
  },
  aaron_cdjr: {
    dealer_id: "aaron_cdjr", client_dealer_name: "Aaron CDJR",
    group_name: "Aaron Automotive Group", platform: "dealercom",
    specials_url: "https://www.aaronchryslerdodgejeepram.com/new-vehicles/new-vehicle-specials/",
    competitors: [
      { name: "Ontario CDJR", platform: "dealerinspire", di_pod: null, di_slug: null, specials_url: "https://www.jeepchryslerdodgeramofontario.com/new-vehicles/new-vehicle-specials/" },
      { name: "J Star CDJR", platform: "pixelmotion", di_pod: null, di_slug: null, specials_url: "https://www.jstarcdjrofanaheimhills.com/specials/" },
      { name: "Moss Bros CDJR", platform: "pixelmotion", di_pod: null, di_slug: null, specials_url: "https://www.mossbroscdjr.com/specials/" }
    ]
  },
  aaron_chevrolet: {
    dealer_id: "aaron_chevrolet", client_dealer_name: "Aaron Chevrolet",
    group_name: "Aaron Automotive Group", platform: "dealercom",
    specials_url: "https://www.aaronchevrolet.com/new-vehicles/new-vehicle-specials/",
    competitors: []
  },
  aaron_kia: {
    dealer_id: "aaron_kia", client_dealer_name: "Aaron Kia",
    group_name: "Aaron Automotive Group", platform: "dealercom",
    specials_url: "https://www.aaronkia.com/specials/",
    competitors: [
      { name: "Citrus Motors Kia", platform: "dealerinspire", di_pod: "45", di_slug: "citruskia", specials_url: "https://www.citruskia.net/new-vehicles/new-vehicle-specials/" },
      { name: "Pomona Kia", platform: "dealerinspire", di_pod: "45", di_slug: "pomonakia", specials_url: "https://www.pomonakia.com/new-vehicles/new-vehicle-specials/" },
      { name: "Riverside Kia", platform: "dealerinspire", di_pod: "45", di_slug: "riversidekia", specials_url: "https://www.riversidekia.com/new-vehicles/new-vehicle-specials/" }
    ]
  },
  geaux_chevrolet: {
    dealer_id: "geaux_chevrolet", client_dealer_name: "Geaux Chevrolet",
    group_name: "Geaux Chevrolet", platform: "dealerinspire",
    di_pod: null, di_slug: null,
    specials_url: "https://www.geauxchevrolet.com/new-vehicles/new-vehicle-specials/",
    competitors: []
  },
  norm_reeves_ford: {
    dealer_id: "norm_reeves_ford", client_dealer_name: "Norm Reeves Ford",
    group_name: "norm_reeves", platform: "dealerinspire",
    di_pod: "41", di_slug: "normreevesfordsuperstorecerritos",
    specials_url: "https://www.normreevesford.com/new-vehicles/new-vehicle-specials/",
    competitors: [
      { name: "Central Ford", platform: "dealerinspire", di_pod: "45", di_slug: "centralfordofsouthgate", specials_url: "https://www.centralfordla.net/new-vehicles/new-vehicle-specials/" },
      { name: "Ford of Long Beach", platform: "dealercom", di_pod: null, di_slug: null, specials_url: "https://www.bpfordoflongbeach.com/specials/" },
      { name: "Ken Grody Ford Buena Park", platform: "dealerinspire", di_pod: "39", di_slug: "kengrodyfordorangecounty", specials_url: "https://www.kengrodyfordorangecounty.com/new-vehicles/new-vehicle-specials/" }
    ]
  }
};

// ─── DI CDN: fetch image URLs directly without hitting the dealer website ────

async function getDISpecialImageUrls(diPod, diSlug, dealerName, specialsUrl) {
  const imageUrls = [];
  
  // Check current and previous month's uploads
  const months = [
    { year: currentYear, month: currentMonth },
    { year: prevYear, month: prevMonth }
  ];
  
  for (const { year, month } of months) {
    const cdnBase = `https://di-uploads-pod${diPod}.dealerinspire.com/${diSlug}/uploads/${year}/${month}/`;
    console.log(`Checking DI CDN: ${cdnBase}`);
    
    try {
      const resp = await axios.get(cdnBase, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 10000
      });
      
      // Parse directory listing or HTML for image filenames
      const html = resp.data || "";
      const imgMatches = html.matchAll(/href=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi);
      
      for (const match of imgMatches) {
        const filename = match[1];
        const fullUrl = filename.startsWith("http") ? filename : `${cdnBase}${filename}`;
        // Filter to likely specials images (not thumbnails/small images)
        if (!fullUrl.includes("-150x") && !fullUrl.includes("-300x") && 
            !fullUrl.includes("-100x") && !fullUrl.includes("thumb")) {
          imageUrls.push(fullUrl);
        }
      }
      
      if (imageUrls.length > 0) {
        console.log(`Found ${imageUrls.length} images in CDN for ${dealerName} (${year}/${month})`);
        break; // Found images for this month, no need to check previous
      }
    } catch (err) {
      console.log(`CDN directory listing failed for ${dealerName} (${year}/${month}): ${err.message}`);
    }
  }
  
  // If CDN directory listing didn't work, try fetching the specials page HTML via axios
  // (not Playwright - just raw HTTP, which may bypass Cloudflare for HTML-only requests)
  if (imageUrls.length === 0) {
    console.log(`CDN directory listing not available for ${dealerName}, trying specials page raw fetch...`);
    // Try fetching the actual specials page HTML directly - sometimes bypasses CF
    const urls = await getSpecialImageUrlsFromHTML(specialsUrl, dealerName);
    imageUrls.push(...urls);
  }
  
  return [...new Set(imageUrls)].slice(0, 15);
}

// ─── Raw HTML fetch (no browser) ─────────────────────────────────────────────

async function getSpecialImageUrlsFromHTML(specialsUrl, dealerName) {
  try {
    const resp = await axios.get(specialsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 15000
    });
    
    const html = String(resp.data || "");
    const imageUrls = [];
    
    // Find all img src and data-src attributes
    const srcMatches = html.matchAll(/(?:src|data-src|data-lazy-src)=["']([^"']+)["']/gi);
    for (const match of srcMatches) {
      const src = match[1];
      if (isSpecialImage(src)) imageUrls.push(src);
    }
    
    console.log(`Raw HTML fetch for ${dealerName}: ${html.length} chars, ${imageUrls.length} special images`);
    return imageUrls;
  } catch (err) {
    console.log(`Raw HTML fetch failed for ${dealerName}: ${err.message}`);
    return [];
  }
}

// ─── Playwright stealth (for non-DI sites like Dealer.com) ───────────────────

async function getSpecialImageUrlsViaBrowser(specialsUrl, dealerName) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"]
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
      locale: "en-US"
    });

    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    try {
      await page.goto(specialsUrl, { waitUntil: "networkidle", timeout: 45000 });
    } catch {
      await page.goto(specialsUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    }

    // Wait for content to load
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(2000);
      const chars = await page.evaluate(() => (document.body.innerText || "").length);
      if (chars > 500) break;
    }

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    const imageUrls = await page.evaluate(({ cdns, excludes }) => {
      const urls = [];
      document.querySelectorAll("img").forEach(img => {
        const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "";
        if (!src || !src.startsWith("http")) return;
        const lower = src.toLowerCase();
        if (excludes.some(p => lower.includes(p))) return;
        if (cdns.some(cdn => lower.includes(cdn))) urls.push(src);
      });
      return [...new Set(urls)].slice(0, 15);
    }, { cdns: SPECIAL_IMAGE_CDNS, excludes: EXCLUDE_PATTERNS });

    const chars = await page.evaluate(() => (document.body.innerText || "").length);
    const title = await page.evaluate(() => document.title);
    console.log(`Browser fetch ${specialsUrl}: ${chars} chars, ${imageUrls.length} images, title: "${title}"`);
    imageUrls.forEach(u => console.log(`  Image: ${u}`));

    await context.close();
    return imageUrls;
  } catch (err) {
    console.log(`Browser fetch failed for ${dealerName}: ${err.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

function isSpecialImage(src) {
  if (!src || !src.startsWith("http")) return false;
  const lower = src.toLowerCase();
  if (EXCLUDE_PATTERNS.some(p => lower.includes(p))) return false;
  if (SPECIAL_IMAGE_CDNS.some(cdn => lower.includes(cdn))) return true;
  return false;
}

// ─── Claude Vision ────────────────────────────────────────────────────────────

async function downloadImageAsBase64(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const base64 = Buffer.from(response.data).toString("base64");
    const contentType = (response.headers["content-type"] || "image/jpeg").split(";")[0];
    return { base64, contentType };
  } catch (err) {
    console.log(`Failed to download image ${imageUrl}: ${err.message}`);
    return null;
  }
}

async function analyzeImageWithVision(imageUrl, dealerName) {
  const imgData = await downloadImageAsBase64(imageUrl);
  if (!imgData) return null;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: imgData.contentType, data: imgData.base64 }
          },
          {
            type: "text",
            text: `This is a car dealership special offer image for ${dealerName}.

Extract the vehicle special offer. Look for: year, make, model, trim, offer type (Lease/APR/Discount), monthly payment ($), term (months), down payment ($), APR rate (%).

If this is NOT a vehicle special (e.g. logo, branding, announcement without pricing), return: null

Respond ONLY with JSON or null:
{
  "year": 2026,
  "make": "Ford",
  "model": "Bronco",
  "trim": "Big Bend 4x4",
  "offer_type": "Lease",
  "offer_details": "369.57",
  "term": 36,
  "down_payment": 5219.57,
  "ai_confidence": "high",
  "ai_notes": "Clear lease terms visible"
}`
          }
        ]
      }]
    });

    const text = response.content[0].text.trim();
    if (text === "null" || text.toLowerCase() === "null") return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const special = JSON.parse(jsonMatch[0]);
    if (special && (special.make || special.model)) {
      special.image_url = imageUrl;
      console.log(`✅ Vision extracted: ${special.year} ${special.make} ${special.model} — ${special.offer_type} $${special.offer_details}`);
      return special;
    }
    return null;
  } catch (err) {
    console.log(`Vision failed for ${imageUrl}: ${err.message}`);
    return null;
  }
}

// ─── Main processing ──────────────────────────────────────────────────────────

async function processDealer(store, dealerName, platform, diPod, diSlug, specialsUrl) {
  console.log(`\n=== Processing specials for: ${dealerName} ===`);

  let imageUrls = [];

  if (platform === "dealerinspire" && diPod && diSlug) {
    // Strategy 1: DI CDN direct access (no Cloudflare)
    imageUrls = await getDISpecialImageUrls(diPod, diSlug, dealerName, specialsUrl);
  }
  
  if (imageUrls.length === 0) {
    // Strategy 2: Browser (for Dealer.com and non-DI sites)
    imageUrls = await getSpecialImageUrlsViaBrowser(specialsUrl, dealerName);
  }

  console.log(`Total images found for ${dealerName}: ${imageUrls.length}`);

  // Analyze each image with Claude Vision
  const specials = [];
  for (const url of imageUrls) {
    await new Promise(r => setTimeout(r, 500));
    const special = await analyzeImageWithVision(url, dealerName);
    if (special) {
      special.source_page = "specials_page";
      specials.push(special);
    }
  }

  console.log(`Specials extracted for ${dealerName}: ${specials.length}`);

  // Delete existing pending rows for today
  const params = new URLSearchParams({
    dealer_id: `eq.${store.dealer_id}`,
    offer_dealer_name: `eq.${dealerName}`,
    snapshot_date: `eq.${today}`,
    status: "eq.pending"
  });

  await axios.delete(`${supabaseUrl}/rest/v1/specials_staging?${params}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: "return=minimal" }
  });

  // Always save at least a placeholder
  const rowsToInsert = specials.length > 0 ? specials.map(s => ({
    dealer_id: store.dealer_id,
    group_name: store.group_name,
    client_dealer_name: store.client_dealer_name,
    offer_dealer_name: dealerName,
    snapshot_date: today,
    scraped_at: new Date().toISOString(),
    special_type: "vehicle",
    source_page: s.source_page || "specials_page",
    source_url: specialsUrl,
    year: s.year || null,
    make: s.make || null,
    model: s.model || null,
    trim: s.trim || null,
    offer_type: s.offer_type || null,
    offer_details: String(s.offer_details || ""),
    term: s.term || null,
    down_payment: s.down_payment || null,
    image_url: s.image_url || null,
    status: "pending",
    ai_confidence: s.ai_confidence || "medium",
    ai_notes: s.ai_notes || null
  })) : [{
    dealer_id: store.dealer_id,
    group_name: store.group_name,
    client_dealer_name: store.client_dealer_name,
    offer_dealer_name: dealerName,
    snapshot_date: today,
    scraped_at: new Date().toISOString(),
    special_type: "vehicle",
    source_page: "specials_page",
    source_url: specialsUrl,
    status: "pending",
    ai_confidence: "low",
    ai_notes: `No specials found — ${imageUrls.length} images checked, none matched vehicle specials`
  }];

  await axios.post(`${supabaseUrl}/rest/v1/specials_staging`, rowsToInsert, {
    headers: {
      apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json", Prefer: "return=minimal"
    }
  });

  console.log(`Saved ${rowsToInsert.length} rows for ${dealerName}`);
}

async function run() {
  const store = STORE_CONFIGS[scraperStoreId];
  if (!store) throw new Error(`Unknown store: ${scraperStoreId}`);
  console.log(`Starting specials scrape for: ${store.client_dealer_name}`);

  await processDealer(store, store.client_dealer_name, store.platform, store.di_pod, store.di_slug, store.specials_url);

  for (const comp of store.competitors) {
    await new Promise(r => setTimeout(r, 2000));
    await processDealer(store, comp.name, comp.platform, comp.di_pod, comp.di_slug, comp.specials_url);
  }

  console.log(`\nSpecials scrape complete for ${store.client_dealer_name}`);
}

run().catch(err => {
  console.error("Scrape error:", err.message);
  process.exit(1);
});
