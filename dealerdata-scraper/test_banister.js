const { chromium } = require('playwright');

async function probe() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on('response', async res => {
    const u = res.url();
    if (u.includes('carscommerce') || u.includes('/api/v1/listings/')) {
      console.log('CARSCOMMERCE RESPONSE:', res.status(), u);
      try {
        const j = await res.json();
        console.log('   Data:', {
          total: j?.data?.total_vehicle_count,
          count: j?.data?.listings?.length,
          ccid: j?.data?.ccid
        });
      } catch {}
    }
  });

  console.log('Navigating to Banister Ford...');
  await page.goto('https://www.banisterfordofmarlowheights.com/new-vehicles/', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(6000);

  // Check pagination links
  const links = await page.$$eval('a[href*="_p="], a.go-to-page, .pagination a', els => els.map(e => ({ text: e.innerText, href: e.getAttribute('href') })));
  console.log('Pagination links on page 1:', links);

  await browser.close();
}

probe().catch(console.error);
