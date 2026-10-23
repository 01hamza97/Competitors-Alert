import fs from "fs";
import axios from "axios";
import { chromium } from "playwright";

let dealers;

async function loadDealersFromSupabase() {
  const groupsResponse = await axios.get(
    `${supabaseUrl}/rest/v1/scraper_groups?active=eq.true&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    }
  );

  const storesResponse = await axios.get(
    `${supabaseUrl}/rest/v1/scraper_stores?active=eq.true&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    }
  );

  const dealersResponse = await axios.get(
    `${supabaseUrl}/rest/v1/scraper_dealers?active=eq.true&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    }
  );

  const groups = groupsResponse.data || [];
  const stores = storesResponse.data || [];
  const dealerRows = dealersResponse.data || [];

  return stores.map(store => ({
    scraper_store_id: store.scraper_store_id,
    store_name: store.store_name,
    default_make: store.default_make || "",
    group_id: store.group_id,
    scrape_frequency: "weekly",
    active: store.active,
    dealers: dealerRows
      .filter(dealer => dealer.scraper_store_id === store.scraper_store_id)
      .map(dealer => ({
        dealer_name: dealer.dealer_name,
        competitor_id: dealer.competitor_id,
        dealer_type: dealer.dealer_type,
        platform: dealer.platform,
        new_inventory_url: dealer.new_inventory_url,
        used_inventory_url: dealer.used_inventory_url,
        api_url: dealer.api_url,
        api_key: dealer.api_key,
        api_per_page: dealer.api_per_page,
        default_make: dealer.default_make,
        skip_make_param: dealer.skip_make_param,
        new_price_labels: dealer.new_price_labels || [],
        used_price_labels: dealer.used_price_labels || [],
        facet_labels: dealer.facet_labels || {},
        filter_examples: dealer.filter_examples || {},
        active: dealer.active
      }))
  })).filter(store => store.dealers.length > 0);
}

async function loadDealersFromBase44() {
  const base44ConfigUrl = process.env.BASE44_CONFIG_URL;
  const scraperApiSecret = process.env.SCRAPER_API_SECRET;

  if (!base44ConfigUrl || !scraperApiSecret) {
    throw new Error("Missing BASE44_CONFIG_URL or SCRAPER_API_SECRET");
  }

  const response = await axios.get(base44ConfigUrl, {
    headers: {
      "X-Scraper-Secret": scraperApiSecret
    }
  });

  const stores = response.data?.stores || [];

  if (!stores.length) {
    throw new Error("No active Base44 scraper stores found");
  }

  return stores.map(store => {
    const clientDealer = {
      dealer_name: store.store_name,
      competitor_id: store.scraper_store_id,
      dealer_type: "client",
      platform: store.platform,
      new_inventory_url: store.new_inventory_url,
      used_inventory_url: store.used_inventory_url,
      api_url: store.api_url,
      api_key: store.api_key,
      api_per_page: store.api_per_page,
      default_make: store.default_make,
      skip_make_param: false,
      new_price_labels: store.new_price_labels || [],
      used_price_labels: store.used_price_labels || [],
      facet_labels: store.facet_labels || {},
      filter_examples: store.filter_examples || {},
      active: true
    };

    const competitors = (store.competitors || []).map(competitor => ({
      dealer_name: competitor.dealer_name,
      competitor_id: competitor.competitor_id,
      dealer_type: "competitor",
      platform: competitor.platform,
      new_inventory_url: competitor.new_inventory_url,
      used_inventory_url: competitor.used_inventory_url,
      api_url: competitor.api_url,
      api_key: competitor.api_key,
      api_per_page: competitor.api_per_page,
      default_make: competitor.default_make,
      skip_make_param: false,
      new_price_labels: competitor.new_price_labels || [],
      used_price_labels: competitor.used_price_labels || [],
      facet_labels: competitor.facet_labels || {},
      filter_examples: competitor.filter_examples || {},
      api_location_field: competitor.api_location_field || null,
      api_location_values: competitor.api_location_values || [],
      active: true
    }));

    return {
  scraper_store_id: store.scraper_store_id,
  store_name: store.store_name,
  default_make: store.default_make || "",
  group_id: store.group_id,
  dealership_key: store.dealership_key,
  scrape_frequency: store.scrape_frequency || "manual_only",
  active: store.active !== false,
  scraper_active: store.scraper_active !== false,
  platform: store.platform || null,
  dealers: [clientDealer, ...competitors]
};
  });
}

async function loadDealerConfig() {
  try {
    const base44Dealers = await loadDealersFromBase44();

    if (!base44Dealers || !base44Dealers.length) {
      throw new Error("No active Base44 dealer config found");
    }

    console.log("Loaded dealer config from Base44");
    return base44Dealers;
  } catch (base44Error) {
    console.log("Base44 dealer config failed. Trying Supabase config fallback.");
    console.log(base44Error.message);
  }

  try {
    const supabaseDealers = await loadDealersFromSupabase();

    if (!supabaseDealers || !supabaseDealers.length) {
      throw new Error("No active Supabase dealer config found");
    }

    console.log("Loaded dealer config from Supabase");
    return supabaseDealers;
  } catch (supabaseError) {
    console.log("Supabase dealer config failed. Using dealers.json fallback.");
    console.log(supabaseError.message);

    return JSON.parse(fs.readFileSync("dealers.json", "utf8"));
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const runType = process.env.RUN_TYPE || "dealer";
const scraperStoreId = process.env.SCRAPER_STORE_ID;
const groupId = process.env.GROUP_ID;

const runId = process.env.RUN_ID || "";
const scraperRunLogId = process.env.SCRAPER_RUN_LOG_ID || "";
const base44UpdateScraperRunLogUrl =
  process.env.BASE44_UPDATE_SCRAPER_RUN_LOG_URL || "";

const scrapeTimestamp = new Date().toISOString();
const scrapeDate = scrapeTimestamp.split("T")[0];

const MAX_CARD_PAGES = 90;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTextValue(value) {
  const text = cleanText(value);
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "undefined" || lower === "null") return "";
  return text;
}

function cleanPrice(priceText) {
  if (!priceText) return null;

  const text = String(priceText);

  if (/call|please|contact|unavailable|coming soon/i.test(text)) {
    return null;
  }

  const matches = text.match(/\$[\s]*[0-9][0-9,]*(?:\.[0-9]{2})?/g);
  if (!matches || !matches.length) return null;

  const numbers = matches
    .map(value => Number(value.replace(/[^0-9.]/g, "")))
    .filter(value => Number.isFinite(value) && value > 0);

  if (!numbers.length) return null;

  return numbers[numbers.length - 1];
}

function extractYear(title) {
  const cleanedTitle = String(title || "")
    .replace(/^New\s+/i, "")
    .trim();

  const match = cleanedTitle.match(/^\d{4}/);

  return match ? Number(match[0]) : null;
}

function getFacetLabels(dealer) {
  return {
    year: dealer.facet_labels?.year || "Year",
    make: dealer.facet_labels?.make || "Make",
    model: dealer.facet_labels?.model || "Model",
    trim: dealer.facet_labels?.trim || "Trim"
  };
}

function getFilterExampleUrl(dealer, inventoryType) {
  const example = dealer.filter_examples?.[inventoryType];

  if (!example) return "";

  if (typeof example === "string") {
    return example;
  }

  if (typeof example === "object") {
    return example.trim || example.model || example.make || example.year || "";
  }

  return "";
}

function getParamNamesFromExamples(dealer, inventoryType) {
  const examples = dealer.filter_examples?.[inventoryType];

  if (!examples) {
    return { year: "year", make: "make", model: "model", trim: "trim" };
  }

  const urls = [];

  if (typeof examples === "string") {
    urls.push(examples);
  } else if (typeof examples === "object") {
    for (const value of Object.values(examples)) {
      if (typeof value === "string" && value) {
        urls.push(value);
      }
    }
  }

  const keys = new Set();

  for (const exampleUrl of urls) {
    try {
      const url = new URL(exampleUrl);
      for (const key of url.searchParams.keys()) {
        keys.add(key);
      }
    } catch (error) {}
  }

  const findKey = (possibleKeys, fallback) => {
    for (const possibleKey of possibleKeys) {
      if (keys.has(possibleKey)) return possibleKey;
    }

    return fallback;
  };

  return {
    year: findKey(["year", "yearrange", "years"], "year"),
    make: findKey(["make", "Make"], "make"),
    model: findKey(["model", "Model", "ModelAndTrim"], "model"),
    trim: findKey(["trim", "custom_trim", "Trim", "ModelAndTrim"], "trim")
  };
}

function addParams(baseUrl, params) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function gotoPage(page, url) {
  if (!page || typeof page.goto !== "function") {
    console.log(`Skipping gotoPage because page is missing or closed: ${url}`);
    return false;
  }

  console.log(`Opening: ${url}`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    return true;
  } catch (err) {
    console.log(`gotoPage failed for ${url}: ${err.message}`);
    return false;
  }
}

async function quickScroll(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}

async function getWebsiteTotal(page) {
  const text = await page.evaluate(() => document.body.innerText || "");

  const vehicleMatch = text.match(/([0-9,]+)\s+Vehicle(?:s)?/i);
  if (vehicleMatch) return Number(vehicleMatch[1].replace(/,/g, ""));

  const matchMatch = text.match(/([0-9,]+)\s+Matches/i);
  if (matchMatch) return Number(matchMatch[1].replace(/,/g, ""));

  return null;
}

function parseVehicleTitleFallback(rawTitle) {
  const title = normalizeTextValue(rawTitle);
  const result = { make: "", model: "", trim: "" };
  const cleanedTitle = title.replace(/^New\s+/i, "");
const withoutYear = cleanedTitle.replace(/^\d{4}\s+/, "");

  const knownMakes = [
    "Acura", "Alfa Romeo", "Audi", "BMW", "Buick", "CADILLAC", "Cadillac",
    "Chevrolet", "Chrysler", "Dodge", "Ford", "Genesis", "GMC", "Honda",
    "Hyundai", "INFINITI", "Infiniti", "Jeep", "Kia", "Lamborghini",
    "Land Rover", "Lexus", "LEXUS", "Lincoln", "Mazda", "Mercedes-Benz",
    "MINI", "Nissan", "Ram", "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo"
  ];

  const make = knownMakes.find(m =>
    withoutYear.toLowerCase().startsWith(m.toLowerCase() + " ")
  );

  if (!make) {
    result.model = title;
    return result;
  }

  result.make = make;
  let remaining = withoutYear.slice(make.length).trim();

  const bodyWords = [
    "Sport Utility", "SUV", "Pickup", "Truck", "Sedan", "Coupe", "Van",
    "Passenger Van", "Hatchback", "Wagon", "TRUCK"
  ];

  for (const bodyWord of bodyWords) {
    remaining = remaining.replace(new RegExp("\\s+" + bodyWord + "$", "i"), "");
  }

  const multiWordModels = [
  "Carnival Hybrid",
  "K4 Hatchback",
  "Niro EV",
  "Sorento Hybrid",
  "Sorento Plug-In Hybrid",
  "Sportage Hybrid",
  "Sportage Plug-In Hybrid",
  "Telluride Hybrid",
  "Bronco Sport",
  "Mustang Mach-E",
  "F-150 Lightning",
  "Corolla Hybrid", "Corolla Cross", "Silverado 1500", "Sierra 1500",
  "Sierra 2500 HD", "Sierra 2500HD", "Sierra 3500 HD", "Yukon XL",
  "Grand Wagoneer", "Wagoneer L", "Navigator L", "Range Rover Sport",
  "Range Rover", "Model Y", "Model X", "Model 3", "EQB 300",
  "CR-V", "HR-V", "ID.4", "Mazda3 Hatchback", "Mazda3 Sedan"
];

  const modelMatch = multiWordModels.find(m =>
    remaining.toLowerCase().startsWith(m.toLowerCase())
  );

  if (modelMatch) {
    result.model = modelMatch;
    result.trim = remaining.slice(modelMatch.length).trim();
    return result;
  }

  const parts = remaining.split(" ");
  result.model = parts[0] || "";
  result.trim = parts.slice(1).join(" ");
  return result;
}

function normalizeChevyModelTrim(make, model, trim) {
  if (String(make).toLowerCase() !== "chevrolet") {
    return { model, trim };
  }

  const cleanModel = normalizeTextValue(model);
  const cleanTrim = normalizeTextValue(trim);

  const combos = [
    "Silverado 1500",
    "Silverado 2500 HD",
    "Silverado 3500 HD",
    "Blazer EV",
    "Equinox EV",
    "Corvette Stingray",
    "Corvette Z06",
    "Corvette E-Ray"
  ];

  for (const combo of combos) {
    const firstWord = combo.split(" ")[0];

    if (
      cleanModel.toLowerCase() === firstWord.toLowerCase() &&
      cleanTrim.toLowerCase().startsWith(combo.slice(firstWord.length).trim().toLowerCase())
    ) {
      return {
        model: combo,
        trim: cleanTrim.slice(combo.slice(firstWord.length).trim().length).trim()
      };
    }
  }

  return { model: cleanModel, trim: cleanTrim };
}

async function supabaseDeleteRows(store, dealer, inventoryType) {
  const params = new URLSearchParams({
    dealer_id: `eq.${store.scraper_store_id}`,
    client_dealer_name: `eq.${store.store_name}`,
    competitor_dealer_name: `eq.${dealer.dealer_name}`,
    snapshot_date: `eq.${scrapeDate}`,
    inventory_type: `eq.${inventoryType}`
  });

  await axios.delete(`${supabaseUrl}/rest/v1/competitor_inventory_pricing?${params.toString()}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: "return=minimal"
    }
  });
}

async function supabaseInsertRows(rows) {
  if (!rows.length) return;

  const url = `${supabaseUrl}/rest/v1/competitor_inventory_pricing`;

  for (let i = 0; i < rows.length; i += 500) {
    await axios.post(url, rows.slice(i, i + 500), {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      }
    });
  }
}

function makeBaseRow({ store, dealer, inventoryType, year, make, model, trim, count, source, lowPrice = null, highPrice = null, priceText = "" }) {
  return {
    dealer_id: store.scraper_store_id,
    competitor_id: dealer.competitor_id,
    group_name: store.group_id,
    client_dealer_name: store.store_name,
    competitor_dealer_name: dealer.dealer_name,
    snapshot_date: scrapeDate,
    imported_at: scrapeTimestamp,
    scrape_timestamp: scrapeTimestamp,
    inventory_type: inventoryType,
    year: year ? Number(String(year).split("-")[0]) || null : null,
    make: normalizeTextValue(make),
    model: normalizeTextValue(model),
    trim: normalizeTextValue(trim),
    raw_title: [year, make, model, trim].filter(Boolean).join(" "),
    inventory_count: count,
    low_price: lowPrice,
    high_price: highPrice,
    price_text: priceText || "",
    price_status: source === "dealercom_filter_count" ? "filter_count" : "unknown",
    source_file_name: source
  };
}

async function extractFacetOptionsFromVisibleText(page, facetName) {
  const text = await page.evaluate(() => document.body.innerText || "");

  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const facetNames = [
    "Vehicle Status", "Year", "Model Year", "Make", "Brand", "Manufacturer",
    "Model", "Vehicle", "Trim", "Series", "Package", "Price",
    "Exterior Color", "Interior Color", "Body Style", "Fuel Type",
    "Transmission", "Mileage", "MPG/MPGe", "Features", "Drivetrain",
    "Engine", "Cab Style", "Bed Length"
  ];

  const startIndex = lines.findIndex(line =>
    line.toLowerCase() === facetName.toLowerCase()
  );

  if (startIndex === -1) return [];

  let endIndex = lines.length;

  for (let i = startIndex + 1; i < lines.length; i++) {
    if (facetNames.some(name => lines[i].toLowerCase() === name.toLowerCase())) {
      endIndex = i;
      break;
    }
  }

  const rawLines = lines.slice(startIndex + 1, endIndex);
  const options = [];
  const seen = new Set();

  for (const line of rawLines) {
    if (
      /^view/i.test(line) ||
      /^clear/i.test(line) ||
      /^search/i.test(line) ||
      /^min$/i.test(line) ||
      /^max$/i.test(line) ||
      /^\$/.test(line)
    ) {
      continue;
    }

    const match = line.match(/^(.+?)\s+([0-9,]+)$/) || line.match(/^(.+?)\s*\(([0-9,]+)\)$/);
    if (!match) continue;

    const value = normalizeTextValue(match[1]);
    const count = Number(match[2].replace(/,/g, ""));

    if (!value || !Number.isFinite(count)) continue;
    if (
  /include|exclude|price available|no price|payment|matches|clear|view/i.test(value)
) {
  continue;
}

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    options.push({ value, count });
  }

  return options;
}

async function extractDealerComFacetOptions(page, facetName) {
  console.log(`CLICKING FACET: ${facetName}`);

  try {
    const button = page.getByText(new RegExp(`^${facetName}$`, "i")).first();
    await button.click({ timeout: 5000 });
    await page.waitForTimeout(800);
  } catch (error) {
    return [];
  }

  const text = await page.locator("body").innerText();
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);

  const facetNames = [
    "Vehicle Status", "Year", "Make", "Model", "Body Style", "Trim",
    "Mileage", "Exterior Color", "Interior Color", "Interior Material",
    "Engine", "Transmission", "Drive Line", "Fuel Type", "Packages", "Features"
  ];

  const startIndex = lines.findIndex(line =>
    line.toLowerCase() === facetName.toLowerCase()
  );

  if (startIndex === -1) return [];

  let endIndex = lines.length;

  for (let i = startIndex + 1; i < lines.length; i++) {
    if (facetNames.some(name => lines[i].toLowerCase() === name.toLowerCase())) {
      endIndex = i;
      break;
    }
  }

  const rawLines = lines.slice(startIndex + 1, endIndex);
  const options = [];
  const seen = new Set();

  for (const line of rawLines) {
    const match =
      line.match(/^(.+?)\s+([0-9,]+)$/) ||
      line.match(/^(.+?)\s*\(([0-9,]+)\)$/) ||
      line.match(/^(.+?)﻿([0-9,]+)$/);

    if (!match) continue;

    const value = normalizeTextValue(match[1]);
    const count = Number(match[2].replace(/,/g, ""));
    const key = value.toLowerCase();

    if (!value || !Number.isFinite(count)) continue;
    if (
  /include|exclude|price available|no price|payment|matches|clear|view/i.test(value)
) {
  continue;
}

    if (
  facetName.toLowerCase() === "year" &&
  !/^\d{4}(?:-\d{4})?$/.test(value)
) {
  continue;
}

    if (facetName.toLowerCase() === "make") {
  console.log(`MAKE FOUND: ${value}`);
}

    if (seen.has(key)) continue;

    seen.add(key);
    options.push({ value, count });
  }

  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } catch (error) {}

  if (!options.length) {
  const inputOptions = await page.evaluate((facetName) => {
    const inputName = String(facetName || "").toLowerCase();

    return Array.from(
      document.querySelectorAll(`input[name="${inputName}"]`)
    ).map(input => {
      const label =
        document.querySelector(`label[for="${input.id}"]`) ||
        input.closest("div")?.querySelector("label");

      const match = label?.textContent?.match(/([0-9,]+)\s*$/);

      return {
        value: input.value,
        count: match ? Number(match[1].replace(/,/g, "")) : 0
      };
    }).filter(item => item.value && item.count > 0);
  }, facetName);

  options.push(...inputOptions);
}
  
  return options;
}

async function scrapeFilterCounts(page, store, dealer, inventoryType, baseUrl) {
  const rows = [];
  const paramNames = getParamNamesFromExamples(dealer, inventoryType);
  const facetLabels = getFacetLabels(dealer);

  console.log(`Filter params for ${dealer.dealer_name} ${inventoryType}:`, paramNames);
  console.log(`Facet labels for ${dealer.dealer_name}:`, facetLabels);

  await gotoPage(page, baseUrl);

  if (inventoryType === "used" && dealer.dealer_type === "client") {
    const usedDebugText = await page.evaluate(() => document.body.innerText || "");
    console.log(`USED DEBUG ${dealer.dealer_name}: page url ${page.url()}`);
    console.log(`USED DEBUG ${dealer.dealer_name}: text length ${usedDebugText.length}`);
    console.log(`USED DEBUG ${dealer.dealer_name}: has Year ${/Year/i.test(usedDebugText)}`);
    console.log(`USED DEBUG ${dealer.dealer_name}: has Make ${/Make/i.test(usedDebugText)}`);
    console.log(`USED DEBUG ${dealer.dealer_name}: has Model ${/Model/i.test(usedDebugText)}`);
    console.log(`USED DEBUG ${dealer.dealer_name}: has Trim ${/Trim/i.test(usedDebugText)}`);
  }

  const websiteTotal = await getWebsiteTotal(page);

console.log(`${dealer.dealer_name} ${inventoryType} website total: ${websiteTotal}`);

  let years = await extractDealerComFacetOptions(page, facetLabels.year);

if (!years.length) {
  years = await extractFacetOptionsFromVisibleText(page, facetLabels.year);
}

// Dealer.com can render a stale/partial facet count while the same filtered SRP
// contains the current inventory. Aaron Ford Escondido showed 2027:9 in the
// facet while ?year=2027 showed 55 vehicles. Reconcile every discovered year
// against the filtered SRP total and use the SRP count when it differs.
if (dealer.platform === "dealercom" && inventoryType === "new" && years.length) {
  const reconciledYears = [];

  for (const yearOption of years) {
    const yearValue = String(yearOption.value || "").split("-")[0];
    const yearUrl = addParams(baseUrl, { [paramNames.year]: yearValue });

    await gotoPage(page, yearUrl);
    const srpCount = await getWebsiteTotal(page);
    const facetCount = Number(yearOption.count || 0);
    const finalCount = srpCount > 0 ? srpCount : facetCount;

    if (srpCount > 0 && srpCount !== facetCount) {
      console.log(
        `${dealer.dealer_name} ${inventoryType} year ${yearValue} facet/SRP mismatch: facet=${facetCount}, srp=${srpCount}; using SRP count`
      );
    }

    reconciledYears.push({
      ...yearOption,
      value: yearValue,
      count: finalCount
    });
  }

  years = reconciledYears;
  await gotoPage(page, baseUrl);
}

  console.log("YEARS RETURNED:", JSON.stringify(years));
  console.log(`Years found: ${years.map(x => `${x.value}:${x.count}`).join(", ")}`);

  if (!years.length && dealer.platform === "dealercom" && inventoryType === "new") {
  const currentYear = new Date().getFullYear();
  const possibleYears = [];

  for (let year = currentYear - 5; year <= currentYear + 2; year++) {
    possibleYears.push(String(year));
  }

  const yearResults = [];

  for (const yearValue of possibleYears) {
    const yearUrl = addParams(baseUrl, {
      [paramNames.year]: `${yearValue}-${yearValue}`
    });

    await gotoPage(page, yearUrl);

    if (
  dealer.dealer_name === "Moss Bros Chevrolet" &&
  yearValue === 2025
) {
  const total2025 = await getWebsiteTotal(page);

  console.log(
    `MOSS CHEVY 2025 URL TOTAL = ${total2025}`
  );
}

    const count = await getWebsiteTotal(page);

const yearTitles = await page.evaluate(() => {
  const text = document.body.innerText || "";
  return Array.from(
    text.matchAll(/20\d{2}\s+Chevrolet\s+[^\n]+/g)
  ).map(m => m[0]).slice(0, 20);
});

console.log(
  `YEAR URL CHECK: ${yearValue}-${yearValue} | total=${count} | titles=${JSON.stringify(yearTitles)}`
);

if (count && count > 0) {
  yearResults.push({
    value: `${yearValue}-${yearValue}`,
    count
  });
}
  }

  years = yearResults;

  console.log(
    `Dealer.com year URL fallback years found: ${years.map(x => `${x.value}:${x.count}`).join(", ")}`
  );
}

if (!years.length) {
  console.log(`${dealer.dealer_name} ${inventoryType} no filter year options found. Skipping Total summary row.`);
  return rows;
}

  for (const yearOption of years) {
    const year = yearOption.value;
    const yearUrl = addParams(baseUrl, { [paramNames.year]: year });

    await gotoPage(page, yearUrl);

    let makes = await extractDealerComFacetOptions(page, facetLabels.make);

if (!makes.length) {
  makes = await extractFacetOptionsFromVisibleText(page, facetLabels.make);
}
    const makeSelectorConfigured =
  Boolean(dealer.filter_examples?.[inventoryType]?.make) &&
  !dealer.skip_make_param;
    const defaultMake = normalizeTextValue(dealer.default_make || store.default_make || "");

    if (!makes.length && !makeSelectorConfigured && defaultMake) {
      makes = [{
        value: defaultMake,
        count: yearOption.count || await getWebsiteTotal(page) || 0
      }];

      console.log(`${dealer.dealer_name} ${inventoryType} ${year} using default_make ${defaultMake} because no make selector is configured`);
    }

    console.log(`${dealer.dealer_name} ${inventoryType} ${year} makes found: ${makes.map(x => `${x.value}:${x.count}`).join(", ")}`);

    if (!makes.length) {
      const count = await getWebsiteTotal(page);
      rows.push(makeBaseRow({
        store,
        dealer,
        inventoryType,
        year,
        make: "",
        model: "All Models",
        trim: "",
        count: count || yearOption.count || 0,
        source: "dealercom_filter_count"
      }));
      continue;
    }

    for (const makeOption of makes) {
      const make = makeOption.value;
      const makeUrl = addParams(baseUrl, {
  [paramNames.year]: year,
  [paramNames.make]: make
});

      await gotoPage(page, makeUrl);

      let models = await extractDealerComFacetOptions(page, facetLabels.model);

if (!models.length) {
  models = await extractFacetOptionsFromVisibleText(page, facetLabels.model);
}
      console.log(`${dealer.dealer_name} ${inventoryType} ${year} ${make} models found: ${models.map(x => `${x.value}:${x.count}`).join(", ")}`);
      
      if (!models.length) {
        const count = await getWebsiteTotal(page);
        rows.push(makeBaseRow({
          store,
          dealer,
          inventoryType,
          year,
          make,
          model: "All Models",
          trim: "",
          count: count || makeOption.count || 0,
          source: "dealercom_filter_count"
        }));
        continue;
      }

      for (const modelOption of models) {
        const model = modelOption.value;
        let modelUrl = addParams(baseUrl, {
  [paramNames.year]: year,
  [paramNames.make]: make,
  [paramNames.model]: model
});

if (inventoryType === "used" && dealer.dealer_type === "client" && dealer.used_inventory_url) {
  const usedUrl = new URL(dealer.used_inventory_url);
  for (const [key, value] of usedUrl.searchParams.entries()) {
    modelUrl = addParams(modelUrl, { [key]: value });
  }

  console.log(`USED LOCATION-SCOPED URL: ${modelUrl}`);
}

        await gotoPage(page, modelUrl);

if (inventoryType === "used" && dealer.dealer_type === "client") {
  const pageCount = await getWebsiteTotal(page);

  const safeUsedCount =
    Number.isFinite(Number(pageCount))
      ? Number(pageCount)
      : Number(modelOption.count || 0);

  console.log(
    `USED FAST MODE: ${year} ${make} ${model} | modelCount=${modelOption.count} | pageCount=${pageCount} | savedCount=${safeUsedCount}`
  );

  rows.push(makeBaseRow({
    store,
    dealer,
    inventoryType,
    year,
    make,
    model,
    trim: "",
    count: safeUsedCount,
    source: "dealercom_used_filter_count_fast"
  }));

  continue;
}

let trims =
  dealer.platform === "dealercom" && inventoryType === "new"
    ? await extractDealerComFacetOptions(page, facetLabels.trim)
    : await extractFacetOptionsFromVisibleText(page, facetLabels.trim);

if (!trims.length) {
  trims = await extractFacetOptionsFromVisibleText(page, facetLabels.trim);
}
        console.log(`${dealer.dealer_name} ${inventoryType} ${year} ${make} ${model} trims found: ${trims.map(x => `${x.value}:${x.count}`).join(", ")}`);

const trimTotal = trims.reduce(
  (sum, t) => sum + (t.count || 0),
  0
);

if (trims.length && trimTotal !== modelOption.count) {
  const missingTrimCount = modelOption.count - trimTotal;

  console.log(
    `COUNT MISMATCH: ${year} ${make} ${model} | model=${modelOption.count} | trims=${trimTotal} | blankTrim=${missingTrimCount}`
  );

  if (missingTrimCount > 0) {
    rows.push(makeBaseRow({
      store,
      dealer,
      inventoryType,
      year,
      make,
      model,
      trim: "",
      count: missingTrimCount,
      source: "dealercom_filter_count"
    }));
  }
}

if (!trims.length) {
     const pageCount = await getWebsiteTotal(page);

  console.log(
    `NO TRIMS FALLBACK: ${year} ${make} ${model} | modelCount=${modelOption.count} | pageCount=${pageCount}`
  );
          
  rows.push(makeBaseRow({
    store,
    dealer,
    inventoryType,
    year,
    make,
    model,
    trim: "",
    count: modelOption.count || pageCount || 0,
    source: "dealercom_filter_count"
  }));
  continue;
}

        for (const trimOption of trims) {
          const trim = trimOption.value;
          const trimUrl = addParams(baseUrl, {
            [paramNames.year]: year,
            [paramNames.make]: make,
            [paramNames.model]: model,
            [paramNames.trim]: trim
          });

          await gotoPage(page, trimUrl);

const trimCount = await getWebsiteTotal(page);

const priceRange =
  dealer.platform === "dealercom" && inventoryType === "new"
    ? await getDealerComPagePriceRange(page, dealer)
    : { lowPrice: null, highPrice: null, priceText: "" };

rows.push(makeBaseRow({
  store,
  dealer,
  inventoryType,
  year,
  make,
  model,
  trim,
  count: trimCount || trimOption.count || 0,
  lowPrice: priceRange.lowPrice,
  highPrice: priceRange.highPrice,
  priceText: priceRange.priceText,
  source: "dealercom_filter_count"
}));
        }
      }
    }
  }

  const total = rows.reduce((sum, row) => sum + Number(row.inventory_count || 0), 0);

  console.log(`${dealer.dealer_name} ${inventoryType} FILTER rows: ${rows.length}`);
  console.log(`${dealer.dealer_name} ${inventoryType} FILTER total: ${total}`);
  console.log(`${dealer.dealer_name} ${inventoryType} WEBSITE total: ${websiteTotal}`);
  console.log(`${dealer.dealer_name} ${inventoryType} FILTER difference: ${total - websiteTotal}`);

  return rows;
}

async function extractPixelMotionFacetCountsFromUrls(page, urls) {
  const results = [];

  for (const item of urls) {
    await gotoPage(page, item.url);

    const pageText = await page.locator("body").innerText();
    const expectedValue = String(item.value);
    const yearVehiclePattern = new RegExp(
      "\\b(?:New\\s+)?" + expectedValue + "\\s+(?:Chrysler|Dodge|Jeep|RAM|Ram)\\b",
      "i"
    );

    const count = yearVehiclePattern.test(pageText)
      ? await getWebsiteTotal(page)
      : 0;

    results.push({
      value: item.value,
      count: count || 0
    });
  }

  return results;
}

async function getPixelMotionUrlCount(page, url) {
  await gotoPage(page, url);
  return await getWebsiteTotal(page);
}
async function getPixelMotionPagePriceRange(page, dealer) {
  const labels = dealer.new_price_labels || [];
  const pageText = await page.locator("body").innerText();
  const lines = pageText.split("\n").map(line => line.trim()).filter(Boolean);
  const prices = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineHasLabel = labels.some(label => line.toLowerCase().includes(String(label).toLowerCase()));

    if (lineHasLabel) {
      const currentPrice = cleanPrice(line);
      const nextPrice = cleanPrice(lines[i + 1] || "");

      if (currentPrice) prices.push(currentPrice);
      if (nextPrice) prices.push(nextPrice);
    }
  }

  if (!prices.length) {
    const fallbackPrices = pageText.match(/\$[\s]*[0-9][0-9,]*(?:\.[0-9]{2})?/g) || [];
    for (const priceText of fallbackPrices) {
      const price = cleanPrice(priceText);
      if (price) prices.push(price);
    }
  }

  const cleanPrices = prices.filter(price => Number.isFinite(price) && price > 1000);

  if (!cleanPrices.length) {
    return { lowPrice: null, highPrice: null, priceText: "" };
  }

  const lowPrice = Math.min(...cleanPrices);
  const highPrice = Math.max(...cleanPrices);

  return {
    lowPrice,
    highPrice,
    priceText: `$${lowPrice} - $${highPrice}`
  };
}

async function extractPixelMotionModalOptions(page, facetName) {
  try {
    const button = page.getByText(new RegExp('^' + facetName + '$', 'i')).first();
    await button.click({ timeout: 5000 });
    await page.waitForTimeout(800);
  } catch (error) {
    return [];
  }

  const text = await page.locator('body').innerText();
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const options = [];
  const seen = new Set();

  for (const line of lines) {
    const match = line.match(/^(.+?)\s*\(([0-9,]+)\)$/);
    if (!match) continue;

    const value = normalizeTextValue(match[1]);
    const count = Number(match[2].replace(/,/g, ''));
    const lower = value.toLowerCase();

    if (!value || !Number.isFinite(count)) continue;
    if (['year','make','model','trim','price','category','transmission','drive train','engine type','fuel type','features','availability'].includes(lower)) continue;
    if (/^(close|select|view|new|used)$/i.test(value)) continue;

    if (seen.has(lower)) continue;
    seen.add(lower);

    options.push({ value, count });
  }

  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch (error) {}

  return options;
}

function buildPixelMotionPathUrl(baseUrl, parts) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanParts = parts
    .filter(Boolean)
    .map(part => encodeURIComponent(String(part).replace(/\s+/g, "-")));

  return `${cleanBase}/${cleanParts.join("/")}/`;
}
async function scrapePixelMotionFilterCounts(page, store, dealer, inventoryType, baseUrl) {
  const rows = [];
  const paramNames = getParamNamesFromExamples(dealer, inventoryType);
  const facetLabels = getFacetLabels(dealer);

  console.log("Using Pixel Motion filter scraper");
  console.log(`Pixel Motion filter params for ${dealer.dealer_name} ${inventoryType}:`, paramNames);
  console.log(`Pixel Motion facet labels for ${dealer.dealer_name}:`, facetLabels);

  await gotoPage(page, baseUrl);

  const websiteTotal = await getWebsiteTotal(page);
  console.log(`${dealer.dealer_name} ${inventoryType} Pixel Motion website total: ${websiteTotal}`);

  const yearExample = dealer.filter_examples?.[inventoryType]?.year || "";
const makeExample = dealer.filter_examples?.[inventoryType]?.make || "";
const modelExample = dealer.filter_examples?.[inventoryType]?.model || "";
const trimExample = dealer.filter_examples?.[inventoryType]?.trim || "";

const currentYear = new Date().getFullYear();

const yearCandidates = [];

for (let year = currentYear - 5; year <= currentYear + 2; year++) {
  yearCandidates.push(String(year));
}

const yearUrls = yearCandidates.map(year => ({
  value: year,
  url: buildPixelMotionPathUrl(baseUrl, [year])
}));

if (yearExample) {
  const yearUrl = new URL(yearExample);

  const pathParts = yearUrl.pathname
  .split("/")
  .map(part => part.trim())
  .filter(Boolean);

const yearValue = pathParts[pathParts.length - 1] || "";

  if (yearValue) {
    yearUrls.push({
      value: yearValue,
      url: yearExample
    });
  }
}

const years = await extractPixelMotionFacetCountsFromUrls(page, yearUrls);
const validYears = [];
const seenYears = new Set();

for (const yearOption of years) {
  const key = String(yearOption.value);

  if (yearOption.count > 0 && !seenYears.has(key)) {
    seenYears.add(key);
    validYears.push(yearOption);
  }
}

console.log(
  `Pixel Motion years found: ${validYears.map(x => `${x.value}:${x.count}`).join(", ")}`
);

  if (!validYears.length) {
    rows.push(makeBaseRow({
      store,
      dealer,
      inventoryType,
      year: null,
      make: "",
      model: "Total",
      trim: "",
      count: websiteTotal || 0,
      source: "dealercom_filter_count"
    }));

    return rows;
  }

  for (const yearOption of validYears) {
    const year = yearOption.value;
    const yearUrl = `${baseUrl.replace(/\/$/, "")}/${year}/`;

    await gotoPage(page, yearUrl);

    const makeCandidates = ["Chrysler", "Dodge", "Jeep", "RAM"];

const makes = [];

for (const makeCandidate of makeCandidates) {
  const makeUrl = buildPixelMotionPathUrl(baseUrl, [year, makeCandidate]);
  const makeCount = await getPixelMotionUrlCount(page, makeUrl);

  if (makeCount > 0) {
    makes.push({
      value: makeCandidate,
      count: makeCount
    });
  }
}

console.log(`Pixel Motion ${year} makes found: ${makes.map(x => `${x.value}:${x.count}`).join(", ")}`);

if (!makes.length) {
      rows.push(makeBaseRow({
        store,
        dealer,
        inventoryType,
        year,
        make: "",
        model: "All Models",
        trim: "",
        count: yearOption.count || 0,
        source: "dealercom_filter_count"
      }));
      continue;
    }

    for (const makeOption of makes) {
      const make = makeOption.value;
const makeUrl = buildPixelMotionPathUrl(baseUrl, [year, make]);

await gotoPage(page, makeUrl);

const modelCandidates = await extractPixelMotionModalOptions(page, facetLabels.model);
const models = [];

for (const modelCandidate of modelCandidates) {
  const modelUrl = buildPixelMotionPathUrl(baseUrl, [year, make, modelCandidate.value]);
  const modelCount = await getPixelMotionUrlCount(page, modelUrl);

  if (modelCount > 0) {
    models.push({ value: modelCandidate.value, count: modelCount, url: modelUrl });
  }
}

console.log(
  `Pixel Motion ${year} ${make} models found: ${
    models.map(x => `${x.value}:${x.count}`).join(", ")
  }`
);

      if (!models.length) {
        rows.push(makeBaseRow({
          store,
          dealer,
          inventoryType,
          year,
          make,
          model: "All Models",
          trim: "",
          count: makeOption.count || 0,
          source: "dealercom_filter_count"
        }));
        continue;
      }

      for (const modelOption of models) {
        const model = modelOption.value;
const modelUrl = modelOption.url || buildPixelMotionPathUrl(baseUrl, [year, make, model]);

await gotoPage(page, modelUrl);

const trimCandidates = await extractPixelMotionModalOptions(page, facetLabels.trim);
const trims = [];

for (const trimCandidate of trimCandidates) {
  const trimValue = trimCandidate.value;
  const trimUrl = buildPixelMotionPathUrl(baseUrl, [year, make, model, trimValue]);
  const trimCount = await getPixelMotionUrlCount(page, trimUrl);

  if (trimCount > 0) {
    trims.push({ value: trimValue, count: trimCount, url: trimUrl });
  }
}

console.log(
  `Pixel Motion ${year} ${make} ${model} trims found: ${
    trims.map(x => `${x.value}:${x.count}`).join(", ")
  }`
);

        if (!trims.length) {
          rows.push(makeBaseRow({
            store,
            dealer,
            inventoryType,
            year,
            make,
            model,
            trim: "",
            count: modelOption.count || 0,
            source: "dealercom_filter_count"
          }));
          continue;
        }

        for (const trimOption of trims) {
          await gotoPage(page, trimOption.url);
          const priceRange = await getPixelMotionPagePriceRange(page, dealer);

          rows.push(makeBaseRow({
            store,
            dealer,
            inventoryType,
            year,
            make,
            model,
            trim: trimOption.value,
            count: trimOption.count || 0,
            lowPrice: priceRange.lowPrice,
            highPrice: priceRange.highPrice,
            priceText: priceRange.priceText,
            source: "dealercom_filter_count"
          }));
        }
      }
    }
  }

  const total = rows.reduce((sum, row) => sum + Number(row.inventory_count || 0), 0);

  console.log(`${dealer.dealer_name} ${inventoryType} PIXEL MOTION FILTER rows: ${rows.length}`);
  console.log(`${dealer.dealer_name} ${inventoryType} PIXEL MOTION FILTER total: ${total}`);
  console.log(`${dealer.dealer_name} ${inventoryType} PIXEL MOTION WEBSITE total: ${websiteTotal}`);
  console.log(`${dealer.dealer_name} ${inventoryType} PIXEL MOTION FILTER difference: ${total - websiteTotal}`);

  return rows;
}

function buildDealerInspireFacetUrl(baseUrl, filters) {
  const url = new URL(baseUrl);

  for (const [field, value] of Object.entries(filters)) {
    if (!value) continue;
    url.searchParams.set(`_dFR[${field}][0]`, value);
  }

  return url.toString();
}

async function extractDealerInspireModalOptions(page, facetName) {
  try {
    const button = page.getByText(new RegExp(`^${facetName}$`, "i")).first();
    await button.click({ timeout: 5000 });
    await page.waitForTimeout(800);
  } catch (error) {
    return [];
  }

  const text = await page.locator("body").innerText();
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);

  const options = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const value = normalizeTextValue(lines[i]);
    const countLine = lines[i + 1] || "";
    const match = countLine.match(/^([0-9,]+)\s+available$/i);

    if (!value || !match) continue;

    const count = Number(match[1].replace(/,/g, ""));
    const key = value.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);

    options.push({ value, count });
  }

  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } catch (error) {}

  return options;
}

async function scrapeDealerInspireFacetRows(page, store, dealer, inventoryType, baseUrl) {
  const rows = [];
  const fields = dealer.dealerinspire_facet_fields || {
    year: "year",
    make: "make",
    model: "model",
    trim: "trim"
  };

  console.log(`Using Dealer Inspire FACET scraper for ${dealer.dealer_name}`);

  await gotoPage(page, baseUrl);

  const websiteTotal = await getWebsiteTotal(page);
  console.log(`${dealer.dealer_name} ${inventoryType} Dealer Inspire website total: ${websiteTotal}`);

  const years = await extractDealerInspireModalOptions(page, "Year");
  const yearOptions = years.length ? years : [{ value: "", count: websiteTotal || 0 }];

  for (const yearOption of yearOptions) {
    const yearFilters = yearOption.value ? { [fields.year]: yearOption.value } : {};

    await gotoPage(page, buildDealerInspireFacetUrl(baseUrl, yearFilters));

    const makes = await extractDealerInspireModalOptions(page, "Make");
    const makeOptions = makes.length
      ? makes
      : [{ value: dealer.default_make || store.default_make || "Ford", count: yearOption.count }];

    for (const makeOption of makeOptions) {
      const makeFilters = {
        ...yearFilters,
        [fields.make]: makeOption.value
      };

      await gotoPage(page, buildDealerInspireFacetUrl(baseUrl, makeFilters));

      const models = await extractDealerInspireModalOptions(page, "Model");

      console.log(
        `${dealer.dealer_name} ${yearOption.value || "all years"} ${makeOption.value} models found: ${
          models.map(x => `${x.value}:${x.count}`).join(", ")
        }`
      );

      for (const modelOption of models) {
        const modelFilters = {
          ...makeFilters,
          [fields.model]: modelOption.value
        };

        await gotoPage(page, buildDealerInspireFacetUrl(baseUrl, modelFilters));

        const trims = await extractDealerInspireModalOptions(page, "Trim");

        if (!trims.length) {
          rows.push(makeBaseRow({
            store,
            dealer,
            inventoryType,
            year: yearOption.value,
            make: makeOption.value,
            model: modelOption.value,
            trim: "",
            count: modelOption.count,
            source: "dealerinspire_facet_scraper"
          }));
          continue;
        }

        for (const trimOption of trims) {
          rows.push(makeBaseRow({
            store,
            dealer,
            inventoryType,
            year: yearOption.value,
            make: makeOption.value,
            model: modelOption.value,
            trim: trimOption.value,
            count: trimOption.count,
            source: "dealerinspire_facet_scraper"
          }));
        }
      }
    }
  }

  const total = rows.reduce((sum, row) => sum + Number(row.inventory_count || 0), 0);

  console.log(`${dealer.dealer_name} ${inventoryType} DEALER INSPIRE FACET rows: ${rows.length}`);
  console.log(`${dealer.dealer_name} ${inventoryType} DEALER INSPIRE FACET total: ${total}`);
  console.log(`${dealer.dealer_name} ${inventoryType} DEALER INSPIRE website total: ${websiteTotal}`);
  console.log(`${dealer.dealer_name} ${inventoryType} DEALER INSPIRE difference: ${total - websiteTotal}`);

  return rows;
}

async function scrapeDealerInspireApiRows(store, dealer, inventoryType) {
  const apiUrl = dealer.api_url;
  if (!apiUrl) throw new Error(`Missing api_url for ${dealer.dealer_name}`);

  const allListings = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    console.log(`Dealer Inspire API page ${page}`);

    const useCustomDealerInspirePayload =
  dealer.platform === "dealerinspire" &&
  dealer.api_url;

const payload = useCustomDealerInspirePayload
  ? {
      page,
      perPage: dealer.api_per_page || 100,
      sort: dealer.api_sort || [
  {
    field: dealer.api_sort_field || "make",
    order: dealer.api_sort_order || "asc"
  },
  {
    field: "low_price",
    order: "asc"
  }
],
      filters: {
        status: ["publish", "modified", "pend-sale"]
      },
      facetFilters: {
  ...(dealer.api_location_field && dealer.api_location_values
    ? { [dealer.api_location_field]: dealer.api_location_values }
    : {}),

  type: inventoryType === "used"
  ? ["Used", "Certified"]
  : (dealer.api_inventory_types || ["New", "CTP", "Demo"]),

type_slug: inventoryType === "used" ? ["Used"] : (dealer.api_type_slug || ["New"]),
},
      requestedFields: [
  "vin",
  "stock",
  "type",
  "year",
  "make",
  "model",
  "trim",
  "model_number",
  "model_series",
  "date_in_stock",
  "mileage",
  "features",
  "vdp_url",
  "source_id",
  "body_details",
  "styles",
  "mechanical",
  "pricing",
  "payments",
  "dealer",
  "media",
  "extra_fields",
  "oem_fields",
  "in_transit",
  "is_demo",
  "is_loaner",
  "is_special",
  "packages",
  "warranty",
  "history_report",
  "status",
  "window_sticker_url",
  "brochure",
  "manufacturer_model_code"
]
    }
  : {
      page,
      perPage,
      sort: [{ field: "low_price", order: "desc" }],
      filters: {
        status: ["publish", "modified", "pend-sale"]
      },
      facetFilters: {
        special_use_category: ["No"],
        custom_text_3: ["JCDRF Ontario"],
        type: ["New"]
      },
      requestedFields: [
        "vin", "stock", "type", "year", "make", "model", "trim",
        "vdp_url", "pricing", "extra_fields"
      ]
    };

    const response = await axios.post(apiUrl, payload, {
  headers: {
  "Content-Type": "application/json",

  Origin: new URL(dealer.new_inventory_url).origin,
  Referer: dealer.new_inventory_url,

  "x-api-key": dealer.api_key || "OQa8l7SzMctJyr5bhSG9jYvlGnZUQfgl"
}
});
    
    const listings = response.data?.data?.listings || [];
    const total = response.data?.data?.total_vehicle_count || 0;

    console.log(`Listings found: ${listings.length} of ${total}`);

    allListings.push(...listings);

    if (!listings.length || allListings.length >= total) break;

    page++;
  }

  const modelCounts = {};

for (const vehicle of allListings) {
  const model = normalizeTextValue(vehicle.model) || "Unknown";
  modelCounts[model] = (modelCounts[model] || 0) + 1;
}

console.log("Dealer Inspire API model counts:");
Object.entries(modelCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([model, count]) => {
    console.log(`${model}: ${count}`);
  });
  
  return allListings.map(vehicle => {
    const lowPrice =
      Number(vehicle.extra_fields?.lightning?.pricing?.low?.value) ||
      Number(vehicle.pricing?.our_price) ||
      Number(vehicle.pricing?.price) ||
      null;

    const highPrice =
      Number(vehicle.extra_fields?.lightning?.pricing?.high?.value) ||
      Number(vehicle.pricing?.msrp) ||
      Number(vehicle.pricing?.original_price) ||
      lowPrice ||
      null;

    return {
      dealer_id: store.scraper_store_id,
      competitor_id: dealer.competitor_id,
      group_name: store.group_id,
      client_dealer_name: store.store_name,
      competitor_dealer_name: dealer.dealer_name,
      snapshot_date: scrapeDate,
      imported_at: scrapeTimestamp,
      scrape_timestamp: scrapeTimestamp,
      inventory_type: inventoryType,
      year: vehicle.year || null,
      make: normalizeTextValue(vehicle.make),
      model: normalizeTextValue(vehicle.model),
      trim: normalizeTextValue(vehicle.trim),
      raw_title: vehicle.extra_fields?.title || `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`,
      inventory_count: 1,
      low_price: lowPrice,
      high_price: highPrice,
      price_text: lowPrice ? `$${lowPrice}` : "",
      price_status: lowPrice ? "priced" : "unknown",
      source_file_name: "dealerinspire_api_scraper"
    };
  });
}

async function scrapeDealerInspireApiCountRows(store, dealer, inventoryType) {
  const apiUrl = dealer.api_url;
  if (!apiUrl) throw new Error(`Missing api_url for ${dealer.dealer_name}`);

  const allListings = [];
  let page = 1;

  while (true) {
    console.log(`Dealer Inspire USED COUNT API page ${page}`);

    const payload = {
      page,
      perPage: dealer.api_per_page || 100,
      sort: dealer.api_sort || [
        {
          field: dealer.api_sort_field || "make",
          order: dealer.api_sort_order || "asc"
        }
      ],
      filters: {
        status: ["publish", "modified", "pend-sale"]
      },
      facetFilters: {
        ...(dealer.api_location_field && dealer.api_location_values
          ? { [dealer.api_location_field]: dealer.api_location_values }
          : {}),

        type: ["Used", "Certified"],
        type_slug: ["Used"]
      },
      requestedFields: [
        "vin",
        "type",
        "year",
        "make",
        "model",
        "trim",
        "dealer",
        "extra_fields"
      ]
    };

    const refererUrl = dealer.used_inventory_url || dealer.new_inventory_url;

    const response = await axios.post(apiUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        Origin: new URL(refererUrl).origin,
        Referer: refererUrl,
        "x-api-key": dealer.api_key || "OQa8l7SzMctJyr5bhSG9jYvlGnZUQfgl"
      }
    });

    const listings = response.data?.data?.listings || [];
    const total = response.data?.data?.total_vehicle_count || 0;

    console.log(`Dealer Inspire USED COUNT listings found: ${listings.length} of ${total}`);

    allListings.push(...listings);

    if (!listings.length || allListings.length >= total) break;

    page++;
  }

  const grouped = new Map();

  for (const vehicle of allListings) {
    const year = vehicle.year || null;
    const make = normalizeTextValue(vehicle.make);
    const model = normalizeTextValue(vehicle.model) || "Unknown";
    const trim = normalizeTextValue(vehicle.trim);

    const key = [year, make, model, trim].join("|");

    if (!grouped.has(key)) {
      grouped.set(key, {
        year,
        make,
        model,
        trim,
        count: 0
      });
    }

    grouped.get(key).count += 1;
  }

  const rows = Array.from(grouped.values()).map(item =>
    makeBaseRow({
      store,
      dealer,
      inventoryType,
      year: item.year,
      make: item.make,
      model: item.model,
      trim: item.trim,
      count: item.count,
      source: "dealerinspire_api_used_count_only"
    })
  );

  const total = rows.reduce((sum, row) => sum + Number(row.inventory_count || 0), 0);

  console.log(`${dealer.dealer_name} used DEALER INSPIRE API COUNT rows: ${rows.length}`);
  console.log(`${dealer.dealer_name} used DEALER INSPIRE API COUNT total: ${total}`);

  return rows;
}

async function extractVehicles(page, priceLabels) {
  const cards = page.locator("li.vehicle-card.vehicle-card-detailed");
  const count = await cards.count();
  const vehicles = [];

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);

    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const data = await card.evaluate((el, priceLabels) => {
      function cleanText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
      }

      function cleanAttr(value) {
        if (!value) return "";
        const lower = String(value).toLowerCase();
        if (lower === "undefined" || lower === "null") return "";
        return String(value).trim();
      }

      const titleAnchor = Array.from(el.querySelectorAll("a"))
        .find(a => /^\d{4}\s/.test(cleanText(a.innerText || a.textContent)));

      const rawTitle = cleanText(titleAnchor?.innerText || titleAnchor?.textContent || "");
      const metadataEl = el.querySelector("[data-year][data-make][data-model]");

      const visibleText = el.innerText || "";
      const fullText = el.textContent || visibleText || "";
      const combinedText = `${visibleText}\n${fullText}`;

      let priceText = null;
      let priceStatus = "unknown";

      for (const label of priceLabels || []) {
        if (label === "direct_price") continue;

        const labelRegex = new RegExp(
          label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]{0,250}?(\\$[\\d,]+)",
          "i"
        );

        const match = combinedText.match(labelRegex);

        if (match) {
          priceText = match[1];
          priceStatus = "priced";
          break;
        }
      }

      if (!priceText) {
        const allPrices = Array.from(combinedText.matchAll(/\$[\d,]+/g)).map(m => m[0]);

        if (allPrices.length) {
          priceText = allPrices[allPrices.length - 1];
          priceStatus = "priced";
        }
      }

      if (!priceText && /call|please call|contact dealer|confirm price/i.test(combinedText)) {
        priceText = "Please Call";
        priceStatus = "call_for_price";
      }

      return {
  raw_title: rawTitle,
  price_text: priceText,
  price_status: priceStatus,
  year: cleanAttr(metadataEl?.getAttribute("data-year")),
  make: cleanAttr(metadataEl?.getAttribute("data-make")),
  model: cleanAttr(metadataEl?.getAttribute("data-model")),
  trim: cleanAttr(metadataEl?.getAttribute("data-trim")),
  vin: cleanAttr(metadataEl?.getAttribute("data-vin")),
  stock: cleanAttr(
    (
      combinedText.match(/Stock\s*#?:?\s*([A-Z0-9\-]+)/i) || []
    )[1]
  )
};
    }, priceLabels);

    vehicles.push(data);
  }

  return vehicles;
}

async function getNextPageHref(page) {
  const nextButton = page.locator('a[aria-label="Go to next page"]').first();

  if (!(await nextButton.count())) return null;

  return await nextButton.getAttribute("href");
}

function getVehiclePageSignature(vehicles) {
  return vehicles.map(v => `${v.vin}|${v.raw_title}`).join("|");
}

function groupCardRows(vehicles, store, dealer, inventoryType) {
  const rows = [];
  const seenVins = new Set();
  const seenStockNumbers = new Set();

  let duplicateVinCount = 0;
  let missingYearCount = 0;

  for (const vehicle of vehicles) {
    const vinKey = normalizeTextValue(vehicle.vin);

    if (vinKey) {
      if (seenVins.has(vinKey)) {
        duplicateVinCount++;
        console.log("Duplicate VIN skipped:", vinKey);
        continue;
      }
      seenVins.add(vinKey);
    }

    const stockKey = normalizeTextValue(vehicle.stock || vehicle.stock_number || "");

    if (stockKey) {
      if (seenStockNumbers.has(stockKey)) {
        duplicateVinCount++;
        console.log("Duplicate stock skipped:", stockKey);
        continue;
      }
      seenStockNumbers.add(stockKey);
    }

    const year = vehicle.year ? Number(vehicle.year) : extractYear(vehicle.raw_title);

    if (!year) {
      missingYearCount++;
      console.log("Skipped missing year:", vehicle.raw_title);
      continue;
    }

    let make = normalizeTextValue(vehicle.make);
    let model = normalizeTextValue(vehicle.model);
    let trim = normalizeTextValue(vehicle.trim);

    if (dealer.platform !== "dealeron" && vehicle.raw_title) {
      const fallback = parseVehicleTitleFallback(vehicle.raw_title);

      if (!make && fallback.make) make = fallback.make;

      if (
        fallback.model &&
        fallback.model.toLowerCase() !== String(model || "").toLowerCase()
      ) {
        model = fallback.model;
      }

      if (!trim && fallback.trim) trim = fallback.trim;
    }

    const normalizedChevy = normalizeChevyModelTrim(make, model, trim);
    model = normalizedChevy.model;
    trim = normalizedChevy.trim;

    let rawPriceNumber = cleanPrice(vehicle.price_text);

    if (rawPriceNumber && rawPriceNumber > 250000) {
      const shortened = Number(String(rawPriceNumber).slice(0, -2));

      if (shortened >= 10000 && shortened <= 250000) {
        rawPriceNumber = shortened;
      }
    }

    const priceNumber =
      rawPriceNumber &&
      rawPriceNumber >= 10000 &&
      rawPriceNumber <= 250000
        ? rawPriceNumber
        : null;

    const safePriceText = priceNumber ? vehicle.price_text : "";
    const safePriceStatus = priceNumber ? (vehicle.price_status || "priced") : "unknown";

    rows.push({
      dealer_id: store.scraper_store_id,
      competitor_id: dealer.competitor_id,
      group_name: store.group_id,
      client_dealer_name: store.store_name,
      competitor_dealer_name: dealer.dealer_name,
      snapshot_date: scrapeDate,
      imported_at: scrapeTimestamp,
      scrape_timestamp: scrapeTimestamp,
      inventory_type: inventoryType,
      year,
      make,
      model,
      trim,
      raw_title: vehicle.raw_title,
      inventory_count: 1,
      low_price: priceNumber,
      high_price: priceNumber,
      price_text: safePriceText,
      price_status: safePriceStatus,
      source_file_name: "github_card_price_scraper"
    });
  }

  console.log("Card rows created:", rows.length);
  console.log("Duplicate VIN count:", duplicateVinCount);
  console.log("Missing year count:", missingYearCount);
  console.log("Raw vehicles count:", vehicles.length);

  return rows;
}

async function getDealerComPagePriceRange(page, dealer) {
  const labels = dealer.new_price_labels || [];
  const pageText = await page.locator("body").innerText();
  const lines = pageText.split("\n").map(line => line.trim()).filter(Boolean);
  const prices = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineHasLabel = labels.some(label =>
      line.toLowerCase().includes(String(label).toLowerCase())
    );

    if (lineHasLabel) {
      const currentPrice = cleanPrice(line);
      const nextPrice = cleanPrice(lines[i + 1] || "");

      if (currentPrice) prices.push(currentPrice);
      if (nextPrice) prices.push(nextPrice);
    }
  }

  const cleanPrices = prices.filter(price =>
    Number.isFinite(price) && price >= 10000 && price <= 250000
  );

  if (!cleanPrices.length) {
    return { lowPrice: null, highPrice: null, priceText: "" };
  }

  const lowPrice = Math.min(...cleanPrices);
  const highPrice = Math.max(...cleanPrices);

  return {
    lowPrice,
    highPrice,
    priceText: `$${lowPrice} - $${highPrice}`
  };
}

async function getDealerOnPriceRange(page) {
  const text = await page.evaluate(() => document.body.innerText || "");
  const prices = [];

  const matches = text.match(/\$[\s]*[0-9][0-9,]*(?:\.[0-9]{2})?/g) || [];

  for (const priceText of matches) {
    const price = cleanPrice(priceText);
    if (price && price >= 10000 && price <= 250000) {
      prices.push(price);
    }
  }

  if (!prices.length) {
    return { lowPrice: null, highPrice: null, priceText: "" };
  }

  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);

  return {
    lowPrice,
    highPrice,
    priceText: `$${lowPrice} - $${highPrice}`
  };
}

async function scrapeFordDirectSrpRows(store, dealer, inventoryType, page) {
  const baseUrl = dealer.new_inventory_url;
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  const rows = [];
  const seen = new Set();

  for (let pageNumber = 1; pageNumber <= 30; pageNumber++) {
    const pageUrl = pageNumber === 1 ? baseUrl : `${cleanBaseUrl}/srp-page-${pageNumber}/`;
    console.log(`${dealer.dealer_name} direct SRP opening page ${pageNumber}: ${pageUrl}`);

    await gotoPage(page, pageUrl);
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await quickScroll(page);
    await page.waitForTimeout(1500);

    const pageRows = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const starts = [...text.matchAll(/(?:^|\n)New\s+(20\d{2})\s+Ford\s*\n/gi)];
      const out = [];

      for (let i = 0; i < starts.length; i++) {
        const start = starts[i].index || 0;
        const end = i + 1 < starts.length ? (starts[i + 1].index || text.length) : text.length;
        const block = text.slice(start, end);

        const titleMatch = block.match(/New\s+(20\d{2})\s+Ford\s*\n+([^\n]+)/i);
        if (!titleMatch) continue;

        const year = Number(titleMatch[1]);
        const vehicleLine = (titleMatch[2] || "").trim();
        const stock = (block.match(/Stock\s*#:\s*\n?\s*([A-Z0-9-]+)/i) || [])[1] || "";
        const vin = (block.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i) || [])[1] || "";
        const finalPrice = (block.match(/Final Price\s*\n?\s*\$([\d,]+)/i) || [])[1];
        const salePrice =
          (block.match(/Sale Price\s*\n?\s*\$([\d,]+)/i) || [])[1] ||
          (block.match(/Net Price\s*\n?\s*\$([\d,]+)/i) || [])[1];
        const msrp = (block.match(/MSRP\s*\n?\s*\$([\d,]+)/i) || [])[1];

        const priceText = salePrice || finalPrice || msrp || "";
        const price = priceText ? Number(priceText.replace(/,/g, "")) : null;

        out.push({ year, vehicleLine, stock, vin, price });
      }

      return out;
    });

    let added = 0;
    for (const item of pageRows) {
      const key = item.vin || item.stock || `${item.year}|${item.vehicleLine}|${pageNumber}|${added}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const parsed = parseVehicleTitleFallback(`New ${item.year} Ford ${item.vehicleLine}`);
      rows.push({
        dealer_id: store.scraper_store_id,
        competitor_id: dealer.competitor_id,
        group_name: store.group_id,
        client_dealer_name: store.store_name,
        competitor_dealer_name: dealer.dealer_name,
        snapshot_date: scrapeDate,
        imported_at: scrapeTimestamp,
        scrape_timestamp: scrapeTimestamp,
        inventory_type: inventoryType,
        year: item.year,
        make: "Ford",
        model: parsed.model || item.vehicleLine,
        trim: parsed.trim || "",
        raw_title: `${item.year} Ford ${item.vehicleLine}`,
        inventory_count: 1,
        low_price: item.price,
        high_price: item.price,
        price_text: item.price ? `$${item.price}` : "",
        price_status: item.price ? "priced" : "unknown",
        source_file_name: "encinitas_direct_srp"
      });
      added++;
    }

    console.log(`${dealer.dealer_name} direct SRP page ${pageNumber}: parsed ${pageRows.length}, added ${added}, total ${rows.length}`);

    if (pageNumber > 1 && pageRows.length === 0) break;
  }

  const byYear = {};
  for (const row of rows) byYear[row.year] = (byYear[row.year] || 0) + 1;
  console.log(`${dealer.dealer_name} direct SRP years: ${JSON.stringify(byYear)}`);

  if (!rows.length) {
    throw new Error(`${dealer.dealer_name} direct SRP produced zero rows; preserving existing Supabase snapshot.`);
  }

  return rows;
}

async function scrapeAutoFiApiRows(store, dealer, inventoryType, page) {
  const apiUrl = dealer.api_url;

  if (!apiUrl) {
    throw new Error(`Missing api_url for AutoFi dealer ${dealer.dealer_name}`);
  }

  const allWebsiteVins = new Set();

  const pageCardByVin = new Map();

  const pageCardByStock = new Map();

  page.on("request", request => {
    if (
      request.url().includes("hippo.prod.core.autofi.io/api/v2/vehicles") &&
      request.method() === "POST"
    ) {
      try {
        const payload = request.postDataJSON();
        const vins = payload?.filters?.vin || [];
        const dealers = payload?.filters?.dealer || [];

        if (
          dealers.includes(dealer.autofi_dealer_id) &&
          Array.isArray(vins) &&
          vins.length
        ) {
          vins.forEach(vin => allWebsiteVins.add(String(vin).toUpperCase()));
        }
      } catch (error) {}
    }
  });

  const cleanBaseUrl = dealer.new_inventory_url.replace(/\/$/, "");

  let previousVinCount = 0;

  for (let pageNumber = 1; pageNumber <= 60; pageNumber++) {
    const pageUrl =
      pageNumber === 1
        ? dealer.new_inventory_url
        : `${cleanBaseUrl}/srp-page-${pageNumber}/`;

    console.log(`${dealer.dealer_name} AutoFi opening inventory page ${pageNumber}: ${pageUrl}`);

    await gotoPage(page, pageUrl);

await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(12000);
await quickScroll(page);
await page.waitForTimeout(3000);

    if (dealer.use_autofi_page_price_override) {
  const debugText = await page.locator("body").innerText();

  console.log("AUTOFI PAGE DEBUG:");
  console.log(debugText.substring(0, 5000));

  const pageCardRows = await page.evaluate(() => {
    const text = document.body.innerText || "";

    const blocks = text
      .split(/(?=New\s+20\d{2}\s+Ford\s+)/g)
      .filter(block =>
        block.includes("Stock #:") &&
        (
          block.includes("Sale Price") ||
          block.includes("Final Price") ||
          block.includes("Net Price")
        )
      );

    return blocks.map(block => {
      const stock = (block.match(/Stock\s*#:\s*\n?\s*([A-Z0-9]+)/i) || [])[1] || "";

      const saleMatch =
        block.match(/Sale Price\s*\n?\s*\$([\d,]+)/i) ||
        block.match(/Final Price\s*\n?\s*\$([\d,]+)/i) ||
        block.match(/Net Price\s*\n?\s*\$([\d,]+)/i);

      const msrpMatch = block.match(/MSRP\s*\n?\s*\$([\d,]+)/i);

      return {
        stock,
        salePrice: saleMatch ? Number(saleMatch[1].replace(/,/g, "")) : null,
        msrp: msrpMatch ? Number(msrpMatch[1].replace(/,/g, "")) : null
      };
    }).filter(row => row.stock);
  });

  for (const row of pageCardRows) {
    if (row.stock) {
      pageCardByStock.set(
        String(row.stock).toUpperCase(),
        row
      );
    }
  }

  console.log(
    `${dealer.dealer_name} page card prices captured after page ${pageNumber}: ${pageCardByStock.size}`
  );
}

    const currentVinCount = allWebsiteVins.size;

    console.log(
      `${dealer.dealer_name} AutoFi VINs captured after page ${pageNumber}: ${currentVinCount}`
    );

    if (pageNumber > 1 && currentVinCount === previousVinCount) {
      console.log(`${dealer.dealer_name} AutoFi no new VINs found. Stopping pagination.`);
      break;
    }

    previousVinCount = currentVinCount;
  }

  // Encinitas Ford's SRP can expose newer model years (for example 2027)
  // without those vehicles appearing in the VIN requests captured during normal
  // page-number pagination. Scan the site's year-filtered SRPs as a supplement
  // so newly-added model years are not silently omitted.
  if (/encinitas\s+ford/i.test(dealer.dealer_name || "")) {
    const origin = new URL(dealer.new_inventory_url).origin;
    const currentYear = new Date().getFullYear();

    for (let year = currentYear - 1; year <= currentYear + 2; year++) {
      const yearUrl = `${origin}/inventory/all-vehicles/new/models-Ford/years-${year}--${year}/`;
      const before = allWebsiteVins.size;

      console.log(`${dealer.dealer_name} AutoFi supplemental year scan ${year}: ${yearUrl}`);

      await gotoPage(page, yearUrl);
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(8000);
      await quickScroll(page);
      await page.waitForTimeout(2000);

      console.log(
        `${dealer.dealer_name} AutoFi year ${year} added ${allWebsiteVins.size - before} VINs`
      );
    }
  }

  const websiteVins = Array.from(allWebsiteVins);

  console.log(`${dealer.dealer_name} AutoFi total website VINs captured: ${websiteVins.length}`);

  const allVehicles = [];

  for (let i = 0; i < websiteVins.length; i += 75) {
    const vinBatch = websiteVins.slice(i, i + 75);

    const payload = {
      format: "json",
      limit: dealer.api_limit || 1000,
      offset: 0,
      filters: {
        dealer: [dealer.autofi_dealer_id],
        vin: vinBatch
      }
    };

    const response = await axios.post(apiUrl, payload, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        dealers: dealer.autofi_dealer_id,
        autofiservice: "autofi-panda-prod:vehiclesV2",
        Origin: new URL(dealer.new_inventory_url).origin,
        Referer: dealer.new_inventory_url,
        "User-Agent": "Mozilla/5.0"
      }
    });

    console.log(
  `${dealer.dealer_name} batch VINs requested: ${vinBatch.length}`
);

console.log(
  `${dealer.dealer_name} batch vehicles returned: ${
    response.data?.data?.vehicles?.length || 0
  }`
);

    const vehicles = response.data?.data?.vehicles || [];

    console.log(
      `${dealer.dealer_name} AutoFi batch ${Math.floor(i / 75) + 1} vehicles returned: ${vehicles.length}`
    );

    allVehicles.push(...vehicles);
  }

  const seenVins = new Set();

  const vehicles = allVehicles.filter(vehicle => {
    const vin = String(vehicle.vin || "").toUpperCase();
    if (!vin) return true;
    if (seenVins.has(vin)) return false;
    seenVins.add(vin);
    return true;
  });

  console.log(`${dealer.dealer_name} AutoFi final vehicles returned: ${vehicles.length}`);

  const returnedVins = new Set(
  allVehicles
    .map(vehicle => String(vehicle.vin || "").toUpperCase())
    .filter(Boolean)
);

const missingVins = websiteVins.filter(vin => !returnedVins.has(String(vin).toUpperCase()));

console.log(`${dealer.dealer_name} AutoFi missing VINs: ${missingVins.length}`);
console.log(missingVins);

const fallbackRows = [];

if (dealer.use_autofi_missing_vin_page_fallback) {
  const origin = new URL(dealer.new_inventory_url).origin;

  for (const vin of missingVins) {
    const fallbackUrl = `${origin}/inventory/all-vehicles/text-${vin}/`;

    console.log(`${dealer.dealer_name} fallback opening missing VIN: ${fallbackUrl}`);

    await gotoPage(page, fallbackUrl);
    await page.waitForTimeout(5000);

    const fallbackData = await page.evaluate(() => {
      const text = document.body.innerText || "";

      const titleMatch = text.match(/New\s+20\d{2}\s+Ford\s+[\s\S]*?(?=Compare|Window Sticker|Ext:|Stock #:|Fuel Type:|MSRP)/i);
      const rawTitle = titleMatch
        ? titleMatch[0].replace(/\s+/g, " ").trim()
        : "";

      const msrpMatch = text.match(/MSRP\s*\n?\s*\$([\d,]+)/i);
      const stockMatch = text.match(/Stock\s*#:\s*\n?\s*([A-Z0-9]+)/i);

      return {
        rawTitle,
        stock: stockMatch ? stockMatch[1] : "",
        msrp: msrpMatch ? Number(msrpMatch[1].replace(/,/g, "")) : null
      };
    });

    if (!fallbackData.rawTitle || !fallbackData.msrp) {
      console.log(`${dealer.dealer_name} fallback skipped ${vin}: missing title or MSRP`);
      continue;
    }

    const parsed = parseVehicleTitleFallback(fallbackData.rawTitle);
    const year = extractYear(fallbackData.rawTitle);

    fallbackRows.push({
      dealer_id: store.scraper_store_id,
      competitor_id: dealer.competitor_id,
      group_name: store.group_id,
      client_dealer_name: store.store_name,
      competitor_dealer_name: dealer.dealer_name,
      snapshot_date: scrapeDate,
      imported_at: scrapeTimestamp,
      scrape_timestamp: scrapeTimestamp,
      inventory_type: inventoryType,
      year,
      make: parsed.make || "Ford",
      model: parsed.model,
      trim: parsed.trim,
      raw_title: fallbackData.rawTitle,
      inventory_count: 1,
      low_price: fallbackData.msrp,
      high_price: fallbackData.msrp,
      price_text: `$${fallbackData.msrp}`,
      price_status: "msrp_only",
      source_file_name: "autofi_missing_vin_msrp_fallback"
    });

    console.log(`${dealer.dealer_name} fallback row added ${vin}: ${fallbackData.rawTitle} $${fallbackData.msrp}`);
  }
}

const apiRows = vehicles.map(vehicle => {
    const stockKey = String(
  vehicle.stockNumber ||
  vehicle.stock ||
  vehicle.stockNo ||
  ""
).toUpperCase();

const cardData = pageCardByStock.get(stockKey) || {};

const lowPrice =
  cardData.salePrice ||
  Number(vehicle.sellingPrice) ||
  Number(vehicle.dealerRetailPrice) ||
  Number(vehicle.msrp) ||
  null;

const highPrice =
  cardData.salePrice ||
  Number(vehicle.sellingPrice) ||
  Number(vehicle.dealerRetailPrice) ||
  Number(vehicle.msrp) ||
  null;

    if (cardData.salePrice) {
  console.log(
    `SALE PRICE FOUND ${vehicle.vin} stock ${stockKey}: ${cardData.salePrice}`
  );
}

    return {
      dealer_id: store.scraper_store_id,
      competitor_id: dealer.competitor_id,
      group_name: store.group_id,
      client_dealer_name: store.store_name,
      competitor_dealer_name: dealer.dealer_name,
      snapshot_date: scrapeDate,
      imported_at: scrapeTimestamp,
      scrape_timestamp: scrapeTimestamp,
      inventory_type: inventoryType,
      year: vehicle.year || null,
      make: normalizeTextValue(vehicle.make),
      model: normalizeTextValue(vehicle.model),
      trim: normalizeTextValue(vehicle.trim),
      raw_title: `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""} ${vehicle.trim || ""}`.trim(),
      inventory_count: 1,
      low_price: lowPrice,
      high_price: highPrice,
      price_text: lowPrice ? `$${lowPrice}` : "",
      price_status: lowPrice ? "priced" : "unknown",
      source_file_name: "autofi_api_scraper"
    };
  });
  return [...apiRows, ...fallbackRows];
}

async function scrapeDealerOnApiRows(store, dealer, inventoryType) {
  const apiUrl = dealer.api_url;

  if (!apiUrl) {
    throw new Error(`Missing api_url for DealerOn dealer ${dealer.dealer_name}`);
  }

  const allCards = [];

let pageNumber = 1;
let totalPages = 1;

while (pageNumber <= totalPages) {

  const pageUrl = new URL(apiUrl);

  pageUrl.searchParams.set("pt", pageNumber);

  console.log(`DealerOn API page ${pageNumber}`);

  const response = await axios.get(pageUrl.toString(), {
    headers: {
      Accept: "application/json",
      Referer: dealer.new_inventory_url || apiUrl,
      "User-Agent": "Mozilla/5.0"
    }
  });

  const data = response.data || {};

  const cards = data.DisplayCards || [];

  totalPages = Number(data.Paging?.PaginationDataModel?.TotalPages || 1);

  console.log(
    `${dealer.dealer_name} DealerOn API page ${pageNumber} cards: ${cards.length}`
  );

  allCards.push(...cards);

  pageNumber++;
}

console.log(
  `${dealer.dealer_name} DealerOn API total cards found: ${allCards.length}`
);

const seenVins = new Set();

return allCards
  .filter(card => !card.IsAdCard && card.VehicleCard)
  .filter(card => {
    const vehicle = card.VehicleCard;
    const vin =
      vehicle.VehicleImageModel?.VehicleImageCarouselModel?.Vin ||
      vehicle.VehicleFeaturesModel?.VehicleVin ||
      "";
    
    if (!vin) return true;
    if (seenVins.has(vin)) return false;

    seenVins.add(vin);
    return true;
  })
  .map(card => {

    const vehicle = card.VehicleCard;

    const vin =
      vehicle.VehicleImageModel?.VehicleImageCarouselModel?.Vin ||
      vehicle.VehicleFeaturesModel?.VehicleVin ||
      "";

    const name =
      vehicle.VehicleImageModel?.VehicleNameHtmlEncoded ||
      "";

let priceNumber = null;

const buyContent =
  vehicle.WasabiVehiclePricingPanelViewModel
    ?.PriceStakViewModel
    ?.PriceStakTabsModel
    ?.BuyContent || "";

const featuredPriceMatch = buyContent.match(
  /vehiclePricingHighlightAmount[^>]*>\$?([\d,]+)</i
);

if (featuredPriceMatch) {
  priceNumber = Number(
    featuredPriceMatch[1].replace(/,/g, "")
  );
}

if (!priceNumber) {
  priceNumber =
    Number(
      String(vehicle.TaggingPrice || "")
        .replace(/[^0-9]/g, "")
    ) || null;
}

    const nameParts = cleanText(name).split(" ");
    const year = Number(nameParts[0]) || null;
    const make = nameParts[1] || "";
    const model = nameParts[2] || "";
    const trim = nameParts.slice(3).join(" ");

    return {
      dealer_id: store.scraper_store_id,
      competitor_id: dealer.competitor_id,
      group_name: store.group_id,
      client_dealer_name: store.store_name,
      competitor_dealer_name: dealer.dealer_name,
      snapshot_date: scrapeDate,
      imported_at: scrapeTimestamp,
      scrape_timestamp: scrapeTimestamp,
      inventory_type: inventoryType,
      year,
      make: normalizeTextValue(make),
      model: normalizeTextValue(model),
      trim: normalizeTextValue(trim),
      raw_title: name,
      inventory_count: 1,
      low_price: priceNumber,
      high_price: priceNumber,
      price_text: priceNumber ? `$${priceNumber}` : "",
      price_status: priceNumber ? "priced" : "unknown",
      source_file_name: "dealeron_api_scraper"
    };
  });
}

async function scrapeDealerOnCardRows(page, store, dealer, inventoryType, baseUrl, priceLabels) {
  await gotoPage(page, baseUrl);

  const rawVehicles = [];
  const seenPages = new Set();

  for (let pageNumber = 1; pageNumber <= MAX_CARD_PAGES; pageNumber++) {
    console.log(`DealerOn page ${pageNumber}`);

    await quickScroll(page);

    const vehicles = await page.evaluate((priceLabels) => {
      function cleanText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
      }

      const cards = Array.from(document.querySelectorAll("div, li, article"));

      const rows = [];
      const seen = new Set();

      for (const card of cards) {
        const text = cleanText(card.innerText || card.textContent || "");

        if (!/\b20\d{2}\s+Chevrolet\b/i.test(text)) continue;
        if (!/\$/i.test(text)) continue;

        const titleMatch = text.match(/(?:New\s+)?(20\d{2}\s+Chevrolet[^\n]+)/i);
        const rawTitle = cleanText(titleMatch?.[1] || "")
  .split("View Details")[0]
  .split("Sale Price")[0]
  .split("MSRP")[0]
  .trim();

        if (!rawTitle) continue;

        const vinMatch = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
        const vin = vinMatch ? vinMatch[0] : rawTitle;

        if (seen.has(vin)) continue;
        seen.add(vin);

        let priceText = "";

        for (const label of priceLabels || []) {
          const regex = new RegExp(
            label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
            "[\\s\\S]{0,120}?(\\$[\\d,]+)",
            "i"
          );

          const match = text.match(regex);

          if (match?.[1]) {
            priceText = match[1];
            break;
          }
        }

        if (!priceText) {
          const allPrices = Array.from(text.matchAll(/\$[\d,]+/g)).map(m => m[0]);
          priceText = allPrices.find(price => {
  const n = Number(price.replace(/[^0-9]/g, ""));
  return n >= 10000 && n <= 250000;
}) || "";
        }

        const parsed = (() => {
  const url = new URL(window.location.href);

  const yearrange = url.searchParams.get("yearrange") || "";
  const makeParam = url.searchParams.get("Make") || "";
  const modelTrimParam = url.searchParams.get("ModelAndTrim") || "";

  let year = "";
  let model = "";
  let trim = "";

  if (yearrange.includes("-")) {
    year = yearrange.split("-")[0];
  }

  if (modelTrimParam.includes(":")) {
    const parts = modelTrimParam.split(":");
    model = parts[0] || "";
    trim = parts[1] || "";
  } else {
    model = modelTrimParam;
  }

  return {
    year,
    make: makeParam,
    model,
    trim
  };
})();

rows.push({
  raw_title: rawTitle,
  price_text: priceText,
  price_status: priceText ? "priced" : "unknown",
  year: parsed.year,
  make: parsed.make,
  model: parsed.model,
  trim: parsed.trim,
  vin
});
      }

      return rows;
    }, priceLabels);

    console.log(`Vehicles found: ${vehicles.length}`);

    const signature = getVehiclePageSignature(vehicles);

    if (seenPages.has(signature)) {
      console.log("Repeated page content detected.");
      break;
    }

    seenPages.add(signature);

    for (const vehicle of vehicles) {
      rawVehicles.push(vehicle);
    }

    const nextButton = page.locator("a.next, a[aria-label='Next'], .next-page").first();

    if (!(await nextButton.count())) break;

    const href = await nextButton.getAttribute("href");

    if (!href) break;

    const nextUrl = new URL(href, page.url()).toString();

    await gotoPage(page, nextUrl);
  }

  const rows = groupCardRows(rawVehicles, store, dealer, inventoryType);

  console.log(`${dealer.dealer_name} ${inventoryType} DEALERON rows: ${rows.length}`);

  return rows;
}

async function scrapeCardRows(page, store, dealer, inventoryType, baseUrl, priceLabels) {
  await gotoPage(page, baseUrl);

  const rawVehicles = [];
  const seenPages = new Set();

  for (let pageNumber = 1; pageNumber <= MAX_CARD_PAGES; pageNumber++) {
    console.log(`Card scrape page ${pageNumber}`);

    await quickScroll(page);

    const vehicles = await extractVehicles(page, priceLabels);

    console.log(`Vehicles found: ${vehicles.length}`);

    const signature = getVehiclePageSignature(vehicles);

    if (seenPages.has(signature)) {
      console.log("Repeated page content detected.");
      break;
    }

    seenPages.add(signature);

    for (const vehicle of vehicles) rawVehicles.push(vehicle);

    const nextHref = await getNextPageHref(page);
    if (!nextHref) break;

    const nextUrlObj = new URL(nextHref, page.url());
    const baseUrlObj = new URL(baseUrl);

    for (const [key, value] of baseUrlObj.searchParams.entries()) {
      if (!nextUrlObj.searchParams.has(key)) {
        nextUrlObj.searchParams.set(key, value);
      }
    }

    const nextUrl = nextUrlObj.toString();

    await gotoPage(page, nextUrl);
  }

  const rows = groupCardRows(rawVehicles, store, dealer, inventoryType);

  console.log(`${dealer.dealer_name} ${inventoryType} CARD rows: ${rows.length}`);

  return rows;
}

async function scrapePixelMotionRows(page, store, dealer, inventoryType, baseUrl) {
  await gotoPage(page, baseUrl);

  console.log("Trying to select 300 results per page...");

  const set300 = await page.evaluate(() => {
  const selects = [...document.querySelectorAll("select")];

  const select = selects.find(sel =>
    [...sel.options].some(option => option.value === "300" || option.text.trim() === "300")
  );

  if (!select) return false;

  const option = [...select.options].find(option =>
    option.value === "300" || option.text.trim() === "300"
  );

  select.value = option.value;

  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));

  return true;
});

if (set300) {
  console.log("300 results select changed.");
  await page.waitForTimeout(8000);
} else {
  console.log("300 results select not found.");
}
  await quickScroll(page);

const text = await page.evaluate(() => document.body.innerText || "");

const totalMatch = text.match(/([0-9,]+)\s+Vehicles Found/i);
const websiteTotal = totalMatch
  ? Number(totalMatch[1].replace(/,/g, ""))
  : null;

console.log(`Pixel Motion website total: ${websiteTotal}`);

const blocks = text
  .split(/\n(?=(?:New\s+)?\d{4}\s+(?:Jeep|RAM|Ram|Dodge|Chrysler)\s+)/g)
  .filter(Boolean)
  .map(s => String(s).trim())
  .filter(s => s.includes("Stock #:"));

console.log(`Pixel Motion blocks found: ${blocks.length}`);

const rows = [];
const seenStocks = new Set();

for (const block of blocks) {
  const stockMatch = block.match(/Stock #:\s*\n\s*([A-Z0-9\-]+)/i);
  const stock = stockMatch ? stockMatch[1].trim() : "";

  const titleLine = block
  .split("\n")
  .map(x => x.trim())
  .find(x =>
    /(?:New\s+)?\d{4}\s+(?:Jeep|RAM|Ram|Dodge|Chrysler)/i.test(x)
  );

const rawTitle = titleLine || "";

  if (stock && seenStocks.has(stock)) continue;
  if (stock) seenStocks.add(stock);

  const parsed = parseVehicleTitleFallback(rawTitle);
  const year = extractYear(rawTitle);

  const msrpMatch = block.match(/MSRP:\s*\S*\s*\$?([\d,]+)/i);
  const saleMatch = block.match(/Sale Price:\s*\$?([\d,]+)/i);
  const netMatch = block.match(/Net Price:\s*\$?([\d,]+)/i);

  const msrp = msrpMatch ? Number(msrpMatch[1].replace(/,/g, "")) : null;
  const salePrice = saleMatch ? Number(saleMatch[1].replace(/,/g, "")) : null;
  const netPrice = netMatch ? Number(netMatch[1].replace(/,/g, "")) : null;

  const finalPrice = salePrice || netPrice || msrp || null;

  rows.push({
    dealer_id: store.scraper_store_id,
    competitor_id: dealer.competitor_id,
    group_name: store.group_id,
    client_dealer_name: store.store_name,
    competitor_dealer_name: dealer.dealer_name,
    snapshot_date: scrapeDate,
    imported_at: scrapeTimestamp,
    scrape_timestamp: scrapeTimestamp,
    inventory_type: inventoryType,
    year,
    make: parsed.make,
    model: parsed.model,
    trim: parsed.trim,
    raw_title: rawTitle,
    inventory_count: 1,
    low_price: finalPrice,
    high_price: finalPrice,
    price_text: finalPrice ? `$${finalPrice}` : "",
    price_status: finalPrice ? "priced" : "unknown",
    source_file_name: "pixelmotion_scraper"
  });
}

  const modelCounts = {};

for (const row of rows) {
  const key = row.model || "Unknown";
  modelCounts[key] = (modelCounts[key] || 0) + 1;
}

console.log("Pixel Motion model counts:");
Object.entries(modelCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([model, count]) => {
    console.log(`${model}: ${count}`);
  });
  
console.log(`Pixel Motion total rows created: ${rows.length}`);

return rows;
}

function cleanTeamVelocityMoney(value) {
  if (value === null || value === undefined) return null;

  const number = Number(String(value).replace(/[^0-9.]/g, ""));

  return Number.isFinite(number) && number >= 10000 && number <= 250000
    ? number
    : null;
}

async function scrapeTeamVelocityFacetRows(store, dealer, inventoryType) {
  const inventoryOrigin = new URL(dealer.new_inventory_url).origin;
  const teamVelocityMake = dealer.teamvelocity_make || store.default_make || "Ford";

  const buildApiUrl = (year = null) => {
    const url = new URL("/api/Inventory/getinventorymultiselectionfilters/v2", inventoryOrigin);
    url.searchParams.set("Type", inventoryType === "new" ? "New" : "Used");
    url.searchParams.set("PaymentType", "cash");
    url.searchParams.set("Makes", teamVelocityMake);
    if (year) url.searchParams.set("Years", String(year));
    url.searchParams.set("SortType", "stockhtol");
    url.searchParams.set("InTransit", "true");
    url.searchParams.set("InProduction", "true");
    url.searchParams.set("InStock", "true");
    url.searchParams.set("EVDealer", "true");
    url.searchParams.set("ModelEFiltered", "true");
    url.searchParams.set("ModelEGroupedAccounts", "");
    url.searchParams.set("SourceFrom", "inventorycontroller");
    return url.toString();
  };

  const requestFilters = async (year = null) => {
    const response = await axios.get(buildApiUrl(year), {
      headers: {
        Accept: "application/json",
        Referer: dealer.new_inventory_url,
        "User-Agent": "Mozilla/5.0"
      }
    });
    return response.data || {};
  };

  const initialData = await requestFilters();
  const filters = initialData.filters || {};
  const years = filters.years || [];

  console.log("TEAM VELOCITY FULL RESPONSE:");
  console.log(JSON.stringify(initialData, null, 2));
  console.log(
    "TEAM VELOCITY YEARS RETURNED:",
    JSON.stringify(years.map(item => ({
      value: item.value || item.text,
      count: Number(item.count || 0)
    })))
  );

  const validYears = years
    .map(item => ({
      year: Number(item.value || item.text),
      count: Number(item.count || 0)
    }))
    .filter(item => Number.isFinite(item.year) && item.year >= 2000 && item.count > 0);

  if (!validYears.length) {
    throw new Error(
      `${dealer.dealer_name} Team Velocity returned no usable year facets; preserving existing Supabase snapshot.`
    );
  }

  const rows = [];

  for (const yearItem of validYears) {
    const yearData = await requestFilters(yearItem.year);
    const yearFilters = yearData.filters || {};
    const models = yearFilters.models || [];

    console.log(
      `${dealer.dealer_name} Team Velocity year ${yearItem.year}: facet count=${yearItem.count}, models=${models.length}`
    );

    for (const item of models) {
      const model = normalizeTextValue(item.value || item.text);
      const count = Number(item.count || 0);

      if (!model || model.toLowerCase() === "all" || count <= 0) continue;

      const row = makeBaseRow({
        store,
        dealer,
        inventoryType,
        year: yearItem.year,
        make: teamVelocityMake,
        model,
        trim: "",
        count,
        source: "teamvelocity_filter_count"
      });

      row.raw_title = item.url || "";
      rows.push(row);
    }
  }

  const total = rows.reduce((sum, row) => sum + Number(row.inventory_count || 0), 0);
  const expectedTotal = validYears.reduce((sum, item) => sum + item.count, 0);

  console.log(
    `${dealer.dealer_name} Team Velocity years: ${validYears.map(x => `${x.year}:${x.count}`).join(", ")}`
  );
  console.log(`${dealer.dealer_name} Team Velocity year/model rows: ${rows.length}`);
  console.log(`${dealer.dealer_name} Team Velocity total: ${total}`);
  console.log(`${dealer.dealer_name} Team Velocity expected year total: ${expectedTotal}`);

  if (!rows.length || total <= 0) {
    throw new Error(
      `${dealer.dealer_name} Team Velocity produced zero year/model rows; preserving existing Supabase snapshot.`
    );
  }

  return rows;
}

async function scrapeTeamVelocityModelPriceRows(page, store, dealer, inventoryType, modelRows) {
  const rows = [];

  for (const modelRow of modelRows) {
    if (!modelRow.raw_title) continue;

    const baseModelUrl = modelRow.raw_title;
    const seenVins = new Set();

    for (let pageNumber = 1; pageNumber <= 20; pageNumber++) {
      const url = new URL(baseModelUrl);
      url.searchParams.set("page", String(pageNumber));
      url.searchParams.set("sorttype", "priceltoh");

      await gotoPage(page, url.toString());
      await page.waitForTimeout(1500);

      const debugText = await page.locator("body").innerText();

console.log("DEBUG MODEL:", modelRow.model);
console.log("DEBUG URL:", url.toString());
console.log("DEBUG TEXT LENGTH:", debugText.length);
console.log(debugText.substring(0, 3000));

      const pageRows = await page.evaluate((modelName) => {
        function cleanText(value) {
          return String(value || "").replace(/\s+/g, " ").trim();
        }

        function cleanPrice(value) {
          const match = String(value || "").match(/\$[\s]*[0-9][0-9,]*/);
          return match ? Number(match[0].replace(/[^0-9]/g, "")) : null;
        }

        const text = document.body.innerText || "";
        const chunks = text.split(/(?=\b20\d{2}\s+Ford\s+)/g);
        const vehicles = [];

        for (const chunk of chunks) {
          const titleMatch = chunk.match(/\b(20\d{2}\s+Ford\s+[^\n]+?)\s+(?:Your Price|Employee Price|MSRP|Disclosure|vin)\b/i);
          const vinMatch = chunk.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);

          if (!titleMatch || !vinMatch) continue;

          const rawTitle = cleanText(titleMatch[1]);
          const vin = vinMatch[0].toUpperCase();

          const yourPriceMatch = chunk.match(/Your Price\s+\$[\d,]+/i);
          const employeePriceMatch = chunk.match(/Employee Price\s+\$[\d,]+/i);
          const msrpMatch = chunk.match(/MSRP\s+\$[\d,]+/i);

          const priceText =
            yourPriceMatch?.[0] ||
            employeePriceMatch?.[0] ||
            msrpMatch?.[0] ||
            "";

          const price = cleanPrice(priceText);

          const parts = rawTitle.split(" ");
          const year = Number(parts[0]) || null;
          const make = parts[1] || "Ford";
          const model = modelName;
          const afterMake = parts.slice(2).join(" ");
          const trim = cleanText(afterMake.replace(new RegExp("^" + modelName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), ""));

          vehicles.push({
            rawTitle,
            vin,
            year,
            make,
            model,
            trim,
            price
          });
        }

        return vehicles;
      }, modelRow.model);

      if (!pageRows.length) break;

      for (const vehicle of pageRows) {
        if (seenVins.has(vehicle.vin)) continue;
        seenVins.add(vehicle.vin);

        rows.push({
          dealer_id: store.scraper_store_id,
          competitor_id: dealer.competitor_id,
          group_name: store.group_id,
          client_dealer_name: store.store_name,
          competitor_dealer_name: dealer.dealer_name,
          snapshot_date: scrapeDate,
          imported_at: scrapeTimestamp,
          scrape_timestamp: scrapeTimestamp,
          inventory_type: inventoryType,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim,
          raw_title: vehicle.rawTitle,
          inventory_count: 1,
          low_price: vehicle.price,
          high_price: vehicle.price,
          price_text: vehicle.price ? `$${vehicle.price}` : "",
          price_status: vehicle.price ? "priced" : "unknown",
          source_file_name: "teamvelocity_card_scraper"
        });
      }
    }

    console.log(`Team Velocity ${modelRow.model} card rows: ${seenVins.size}`);
  }

  console.log(`Team Velocity total card rows created: ${rows.length}`);
  return rows;
}

    
async function saveRows(rows, store, dealer, inventoryType) {
  console.log(`Deleting existing rows for ${dealer.dealer_name} ${inventoryType}`);

  await supabaseDeleteRows(store, dealer, inventoryType);

  console.log(`Inserting ${rows.length} total rows for ${dealer.dealer_name} ${inventoryType}`);

  try {
  await supabaseInsertRows(rows);
} catch (error) {
  console.error("Supabase insert failed:");
  console.error(error.response?.data || error.message);
  throw error;
}

  const filterTotal = rows
  .filter(row =>
    row.source_file_name === "dealercom_filter_count" ||
    row.source_file_name === "teamvelocity_filter_count" ||
    row.source_file_name === "teamvelocity_card_scraper"
  )
  .reduce((sum, row) => sum + Number(row.inventory_count || 0), 0);

  const cardTotal = rows
    .filter(row =>
      row.source_file_name === "github_card_price_scraper" ||
      row.source_file_name === "dealerinspire_api_scraper" ||
      row.source_file_name === "dealerinspire_api_used_count_only" ||
      row.source_file_name === "pixelmotion_scraper" ||
      row.source_file_name === "dealeron_api_scraper" ||
      row.source_file_name === "autofi_api_scraper"
  )
  .reduce((sum, row) => sum + Number(row.inventory_count || 0), 0);

  console.log(`Saved filter count total: ${filterTotal}`);
  console.log(`Saved card/API count total: ${cardTotal}`);
}

async function updateBase44ScraperRunLog(payload) {
  if (!base44UpdateScraperRunLogUrl) {
    console.log("No BASE44_UPDATE_SCRAPER_RUN_LOG_URL set. Skipping Base44 run log update.");
    return;
  }

  if (!runId && !scraperRunLogId) {
    console.log("No RUN_ID or SCRAPER_RUN_LOG_ID set. Skipping Base44 run log update.");
    return;
  }

  try {
    await axios.post(
      base44UpdateScraperRunLogUrl,
      {
        run_id: runId || undefined,
        scraper_run_log_id: scraperRunLogId || undefined,
        ...payload
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Scraper-Secret": process.env.SCRAPER_API_SECRET
        }
      }
    );

    console.log(`Updated Base44 ScraperRunLog: ${payload.status}`);
  } catch (err) {
    console.error("Failed to update Base44 ScraperRunLog:");
    console.error(err.response?.data || err.message);
  }
}
dealers = await loadDealerConfig();


console.log("Loaded stores:", dealers.length);

dealers.forEach(d => {
  console.log({
    scraper_store_id: d.scraper_store_id,
    store_name: d.store_name,
    active: d.active,
    scraper_active: d.scraper_active,
    platform: d.platform
  });
});

console.log("RUN_TYPE:", runType);
console.log("SCRAPER_STORE_ID:", scraperStoreId);
console.log("GROUP_ID:", groupId);

let storesToRun = dealers;

if (runType === "dealer") {
  storesToRun = dealers.filter(d => d.scraper_store_id === scraperStoreId);
}

if (runType === "group") {
  storesToRun = dealers.filter(d => d.group_id === groupId);
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-dev-shm-usage"
  ]
});

const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 1200 },
  locale: "en-US",
  timezoneId: "America/Los_Angeles"
});

for (const store of storesToRun) {
  console.log(`Running store: ${store.store_name}`);

  for (const dealer of store.dealers) {
    if (!dealer.active) continue;

    if (dealer.platform === "dealercom") {
  console.log(`Using Dealer.com scraper for ${dealer.dealer_name}`);

} else if (dealer.platform === "dealerinspire") {

  if (dealer.use_dealerinspire_facets) {
    console.log(`Using Dealer Inspire FACET scraper for ${dealer.dealer_name}`);
  } else {
    console.log(`Using Dealer Inspire API scraper for ${dealer.dealer_name}`);
  }

} else if (dealer.platform === "pixelmotion") {

  console.log(`Using Pixel Motion scraper for ${dealer.dealer_name}`);

} else if (dealer.platform === "dealeron") {

  console.log(`Using DealerOn scraper for ${dealer.dealer_name}`);

} else if (dealer.platform === "autofi") {

  console.log(`Using AutoFi scraper for ${dealer.dealer_name}`);

} else if (dealer.platform === "teamvelocity") {

  console.log(`Using Team Velocity scraper for ${dealer.dealer_name}`);

} else {

  console.log(`Unsupported platform ${dealer.platform}`);

}

    for (const inventoryType of ["new", "used"]) {
      const baseUrl =
        inventoryType === "new"
          ? dealer.new_inventory_url
          : dealer.used_inventory_url;

      if (!baseUrl) continue;

      const priceLabels =
        inventoryType === "new"
          ? dealer.new_price_labels || [dealer.new_price_label].filter(Boolean)
          : dealer.used_price_labels || [dealer.used_price_label].filter(Boolean);

      const filterPage = await context.newPage();

const shouldOpenCardPage =
  dealer.platform !== "dealerinspire" &&
  dealer.platform !== "pixelmotion" &&
  (
    inventoryType === "new" ||
    (inventoryType === "used" && dealer.dealer_type === "client")
  );

const cardPage = shouldOpenCardPage
  ? await context.newPage()
  : null;

      try {
        console.log("======================================");
        console.log(`Scraping ${dealer.dealer_name} ${inventoryType}`);
        console.log(baseUrl);

        if (inventoryType === "used" && dealer.dealer_type !== "client") {
          console.log(`Skipping used inventory for competitor ${dealer.dealer_name}.`);
          continue;
        }

        let filterRows = [];

        if (
  inventoryType === "used" &&
  dealer.dealer_type === "client" &&
  dealer.platform === "dealerinspire" &&
  dealer.api_url
) {
  console.log(`Using Dealer Inspire used API count-only mode for ${dealer.dealer_name}. No pricing will be collected.`);

  filterRows = await scrapeDealerInspireApiCountRows(
    store,
    dealer,
    inventoryType
  );
} else if (
  inventoryType === "used" &&
  dealer.dealer_type === "client" &&
  dealer.platform === "dealerinspire"
) {
  console.log(`Dealer Inspire used API URL missing for ${dealer.dealer_name}. Falling back to facet scraper.`);

  filterRows = await scrapeDealerInspireFacetRows(
    filterPage,
    store,
    dealer,
    inventoryType,
    baseUrl
  );
} else if (dealer.platform === "pixelmotion") {
  filterRows = await scrapePixelMotionFilterCounts(
    filterPage,
    store,
    dealer,
    inventoryType,
    baseUrl
  );
} else if (
  dealer.platform === "dealercom" ||
  dealer.dealer_type === "client" ||
  inventoryType === "used"
) {
  filterRows = await scrapeFilterCounts(
    filterPage,
    store,
    dealer,
    inventoryType,
    baseUrl
  );
} else {
  console.log(`Skipping filter count scrape for competitor ${dealer.dealer_name}. New competitor count comes from card/API rows.`);
}

        let cardRows = [];

        if (
  inventoryType === "new" &&
  dealer.platform === "dealerinspire" &&
  dealer.use_dealerinspire_facets
) {
  if (/el\s+cajon\s+ford/i.test(dealer.dealer_name || "") && dealer.api_url) {
    console.log(`Using Dealer Inspire API for ${dealer.dealer_name} to collect year/model counts and vehicle pricing.`);
    cardRows = await scrapeDealerInspireApiRows(
      store,
      dealer,
      inventoryType
    );
  } else {
    cardRows = await scrapeDealerInspireFacetRows(
      filterPage,
      store,
      dealer,
      inventoryType,
      baseUrl
    );
  }
} else if (
  inventoryType === "new" &&
  dealer.platform === "dealerinspire" &&
  dealer.api_url
) {
  cardRows = await scrapeDealerInspireApiRows(
    store,
    dealer,
    inventoryType
  );
} else if (inventoryType === "new" && dealer.platform === "dealerinspire") {

  console.log(`Skipping Dealer Inspire card scrape for ${dealer.dealer_name}. No API URL configured.`);

} else if (inventoryType === "new" && dealer.platform === "dealeron") {

  cardRows = await scrapeDealerOnApiRows(
    store,
    dealer,
    inventoryType
  );

} else if (inventoryType === "new" && dealer.platform === "teamvelocity") {

  // Use the Team Velocity filter API for authoritative year/model counts.
  filterRows = await scrapeTeamVelocityFacetRows(
    store,
    dealer,
    inventoryType
  );

  // Tim Moran's public SRP now exposes inventory and starting prices. Attempt
  // model-level card pricing and merge it with the authoritative facet rows.
  // If Akamai blocks a model page, keep the count row rather than losing inventory.
  if (/tim\s+moran\s+ford/i.test(dealer.dealer_name || "")) {
    try {
      const priceRows = await scrapeTeamVelocityModelPriceRows(
        cardPage,
        store,
        dealer,
        inventoryType,
        filterRows
      );

      const priceByKey = new Map();
      for (const row of priceRows) {
        const key = `${row.year}|${normalizeTextValue(row.model).toLowerCase()}`;
        if (!priceByKey.has(key)) priceByKey.set(key, []);
        if (Number(row.low_price) > 0) priceByKey.get(key).push(Number(row.low_price));
      }

      for (const row of filterRows) {
        const key = `${row.year}|${normalizeTextValue(row.model).toLowerCase()}`;
        const prices = priceByKey.get(key) || [];
        if (!prices.length) continue;

        row.low_price = Math.min(...prices);
        row.high_price = Math.max(...prices);
        row.price_text = `${row.low_price} - ${row.high_price}`;
        row.price_status = "priced";
      }

      const pricedModels = filterRows.filter(row => Number(row.low_price) > 0).length;
      console.log(`${dealer.dealer_name} Team Velocity priced model rows: ${pricedModels}/${filterRows.length}`);
    } catch (priceError) {
      console.log(`${dealer.dealer_name} Team Velocity price scrape failed; preserving count rows: ${priceError.message}`);
    }
  }

  cardRows = [];

} else if (inventoryType === "new" && dealer.platform === "autofi") {

  if (/encinitas\s+ford|raceway\s+ford/i.test(dealer.dealer_name || "")) {
    console.log(`Using direct SRP scraper for ${dealer.dealer_name} because its AutoFi VIN requests are incomplete or not exposed to Playwright.`);
    cardRows = await scrapeFordDirectSrpRows(
      store,
      dealer,
      inventoryType,
      cardPage
    );
  } else {
    cardRows = await scrapeAutoFiApiRows(
      store,
      dealer,
      inventoryType,
      cardPage
    );
  }

} else if (inventoryType === "new" && dealer.platform === "dealercom") {

  console.log(`Skipping Dealer.com new card scrape for ${dealer.dealer_name}. Using filter rows only.`);

  cardRows = [];

} else if (inventoryType === "new" && dealer.platform === "pixelmotion") {

  console.log(`Skipping Pixel Motion new card scrape for ${dealer.dealer_name}. Using filter rows only.`);

  cardRows = [];

} else if (inventoryType === "new") {

  cardRows = await scrapeCardRows(
    cardPage,
    store,
    dealer,
    inventoryType,
    baseUrl,
    priceLabels
  );
} else if (
  inventoryType === "used" &&
  dealer.dealer_type === "client" &&
  dealer.platform === "dealercom"
) {

  console.log(
    `Skipping Dealer.com used card scrape for ${dealer.dealer_name}. Using filter counts only.`
  );

  cardRows = [];

} else {
  console.log(`Skipping used card scrape for ${dealer.dealer_name}. Used inventory only needs filter counts.`);
}

        const rowsToSave =
  dealer.platform === "dealercom" && inventoryType === "new"
    ? filterRows
    : [...filterRows, ...cardRows];

await saveRows(rowsToSave, store, dealer, inventoryType);
      } catch (err) {
        console.error(`Error scraping ${dealer.dealer_name} ${inventoryType}`);
        console.error(err.message);
      }

      await filterPage.close();
      if (cardPage) await cardPage.close();
    }
  }
}

await context.close();
await browser.close();

await updateBase44ScraperRunLog({
  status: "complete",
  completed_at: new Date().toISOString(),
  snapshot_date: scrapeDate
});

console.log("Finished.");
