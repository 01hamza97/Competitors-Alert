const { chromium } = require('playwright');
const { getPlaywrightProxy } = require('./dist/services/proxyHelper');

async function testWithProxy() {
  const pwProxy = getPlaywrightProxy();
  console.log('Testing Tuttle Click Hyundai via Playwright WITH PROXY:', pwProxy);
  const browser = await chromium.launch({
    headless: true,
    proxy: pwProxy,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  try {
    const res = await page.goto('https://www.tuttleclickhyundai.com/new-inventory/index.htm', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('HTTP status:', res.status());
    console.log('Title:', await page.title());
    const content = await page.content();
    console.log('Has Access Denied?', content.includes('Access Denied') || content.includes('errors.edgesuite.net'));
    console.log('Content snippet:', content.substring(0, 400));
  } catch (e) {
    console.error('Proxy error:', e.message);
  } finally {
    await browser.close();
  }
}

testWithProxy();
