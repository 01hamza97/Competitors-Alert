const { chromium } = require('playwright');

async function testPage2() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on('request', req => {
    const u = req.url();
    if (u.includes('cosmos/srp/vehicles') || u.includes('searchnew.aspx')) {
      console.log('REQUEST:', req.method(), u);
    }
  });

  console.log('Navigating to Waldorf Ford searchnew.aspx...');
  await page.goto('https://www.waldorfford.com/searchnew.aspx', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(4000);

  // Look for pagination buttons / links
  const page2Btn = page.locator('a[href*="pageNumber=2"], a[aria-label*="Page 2"], .pagination a:has-text("2"), a[data-page="2"]').first();
  const isVisible = await page2Btn.isVisible().catch(() => false);
  console.log('Page 2 button visible:', isVisible);
  if (isVisible) {
    const href = await page2Btn.getAttribute('href');
    console.log('Page 2 href:', href);
    await page2Btn.click();
    await page.waitForTimeout(4000);
  } else {
    // List all pagination links
    const links = await page.$$eval('.pagination a, [class*="pagination"] a', els => els.map(e => ({ text: e.innerText, href: e.getAttribute('href') })));
    console.log('Pagination links found:', links);
  }

  await browser.close();
}

testPage2().catch(console.error);
