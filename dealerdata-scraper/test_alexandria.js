const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const urls = [
    'https://www.worldoffordalexandria.com/featured-vehicles/new.htm',
    'https://www.worldoffordalexandria.com/promotions/new/index.htm',
    'https://www.worldoffordalexandria.com/global-incentives/index.htm',
    'https://www.worldoffordalexandria.com/new-specials.htm',
    'https://www.worldoffordalexandria.com/specials/new.htm'
  ];

  for (const u of urls) {
    try {
      const res = await axios.get(u, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        maxRedirects: 5,
        validateStatus: () => true
      });
      console.log(`URL: ${u} -> Status: ${res.status}, Length: ${res.data?.length || 0}`);
      if (res.status === 200 && res.data) {
        const $ = cheerio.load(res.data);
        const title = $('title').text().trim();
        console.log(`   Title: ${title}`);
        const text = $('body').text().replace(/\s+/g, ' ');
        const hasSpecials = /special|offer|lease|apr|save|discount/i.test(text);
        const cards = $('[data-vin], .vehicle, .item, .featured-vehicle, .promo').length;
        console.log(`   Has special keywords: ${hasSpecials}, Cards: ${cards}`);
      }
    } catch (e) {
      console.log(`URL: ${u} error:`, e.message);
    }
  }

  // Also check homepage menu links for specials
  try {
    const res = await axios.get('https://www.worldoffordalexandria.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(res.data);
    console.log('\nSpecials links on World of Ford Alexandria homepage:');
    $('a[href*="special"], a[href*="featured"], a[href*="incentive"], a[href*="promo"]').each((i, el) => {
      console.log(`   [${$(el).text().trim()}] -> ${$(el).attr('href')}`);
    });
  } catch (e) {
    console.log('Homepage error:', e.message);
  }
}

test();
