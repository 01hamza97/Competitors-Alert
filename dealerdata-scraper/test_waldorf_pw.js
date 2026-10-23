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
    if (u.includes('/api/') || u.includes('cosmos') || u.includes('vehicles') || u.includes('srp')) {
      if (!u.includes('.js') && !u.includes('.css') && !u.includes('.png') && !u.includes('.jpg')) {
        let snippet = '';
        try {
          const t = await res.text();
          if (t.includes('vin') || t.includes('totalCount') || t.includes('vehicles')) {
            snippet = t.slice(0, 300);
          }
        } catch {}
        console.log(`[API RESPONSE ${res.status()}] ${u}`);
        if (snippet) console.log(`   Data snippet: ${snippet}`);
      }
    }
  });

  console.log('Navigating to Waldorf Ford searchnew.aspx...');
  await page.goto('https://www.waldorfford.com/searchnew.aspx', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(5000);

  // Check what total count displays in the UI
  const totalText = await page.evaluate(() => {
    const el = document.querySelector('.total-count, .vehicle-count, [data-total], .srp-count, h1, .inventory-count');
    return el ? el.innerText : '';
  });
  console.log('Total text in UI:', totalText);

  await browser.close();
}

probe().catch(console.error);
