const fs = require('fs');
const cheerio = require('cheerio');
const axios = require('axios');

async function test() {
  const res = await axios.get('https://www.waldorfford.com/searchnew.aspx', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = res.data;
  const $ = cheerio.load(html);

  // Check JSON-LD
  const jsonLd = $('script[type="application/ld+json"]').map((i, el) => {
    try { return JSON.parse($(el).html()); } catch (e) { return null; }
  }).get().filter(Boolean);
  console.log('JSON-LD blocks count:', jsonLd.length);
  for (const j of jsonLd) {
    if (j['@type'] === 'ItemList' && Array.isArray(j.itemListElement)) {
      console.log('ItemList items count:', j.itemListElement.length);
    }
  }

  // Check vehicle cards in DOM
  const cards = $('[data-vin], .vehicle, .inventory-item, .vehicle-card, .srp-vehicle-item, .item');
  console.log('Cards matching standard selectors:', cards.length);

  // Check VINs
  const vins = [...new Set(html.match(/[A-HJ-NPR-Z0-9]{17}/g) || [])];
  console.log('Unique VINs in raw HTML:', vins.length);

  // Check pagination links
  $('a[href*="page"], a[href*="searchnew.aspx"], .pagination a, [aria-label*="Page"]').each((i, el) => {
    console.log('Pagination link:', $(el).attr('href'), $(el).text().trim());
  });

  // Check any scripts containing endpoint or api
  $('script').each((i, el) => {
    const s = $(el).html() || '';
    if (s.includes('Cosmos') || s.includes('vhcliaa') || s.includes('totalCount') || s.includes('vehicleList')) {
      console.log('Script match snippet:', s.slice(0, 300));
    }
  });
}

test();
