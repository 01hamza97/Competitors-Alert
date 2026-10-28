import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { URL } from 'url';

export interface BrowserOptions {
  proxyUrl?: string;
  headless?: boolean;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private isUsingProxy: boolean = false;
  private currentOptions?: BrowserOptions;

  static parseProxy(proxyUrl?: string): { server: string; username?: string; password?: string } | undefined {
    const raw = proxyUrl || process.env.SCRAPER_PROXY_URL;
    if (!raw || raw === 'direct' || raw === 'none' || raw === 'false') {
      return undefined;
    }
    try {
      const u = new URL(raw);
      const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
      const username = u.username ? decodeURIComponent(u.username) : undefined;
      const password = u.password ? decodeURIComponent(u.password) : undefined;
      return { server, username, password };
    } catch {
      return undefined;
    }
  }

  async init(options?: BrowserOptions): Promise<BrowserContext> {
    this.currentOptions = options;
    const pwProxy = BrowserManager.parseProxy(options?.proxyUrl);
    this.isUsingProxy = !!pwProxy;

    if (pwProxy) {
      console.log(`[Browser] Launching Chromium through proxy: ${pwProxy.server} (user: ${pwProxy.username ? 'configured' : 'none'})...`);
    } else {
      console.log('[Browser] Launching Chromium with stealth config (direct connection)...');
    }

    const isHeadless = options?.headless !== undefined
      ? options.headless
      : process.env.HEADLESS !== 'false';

    this.browser = await chromium.launch({
      headless: isHeadless,
      proxy: pwProxy,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list'
      ]
    });

    this.context = await this.browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles'
    });

    // Remove webdriver flag to evade standard bot detections
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    return this.context;
  }

  async getContext(options?: BrowserOptions): Promise<BrowserContext> {
    if (!this.context) {
      await this.init(options);
    }
    return this.context!;
  }

  /**
   * Loads a target URL, evades anti-bot challenges, scrolls to hydrate cards, and returns the page and HTML.
   */
  async fetchPage(url: string, timeoutMs = 35000): Promise<{ page: Page; html: string; status: number }> {
    const ctx = await this.getContext(this.currentOptions);
    let page = await ctx.newPage();

    console.log(`[Browser] Navigating to: ${url}`);
    let response;

    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    } catch (err: any) {
      if (this.isUsingProxy) {
        console.warn(`[Browser] Proxy error on navigation (${err.message}). Retrying on direct connection...`);
        await page.close().catch(() => {});
        await this.close();
        await this.init({ ...this.currentOptions, proxyUrl: 'direct' });
        page = await this.context!.newPage();
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      } else {
        throw err;
      }
    }

    // Immediate check for Access Denied / WAF block on proxy
    const immediateTitle = await page.title().catch(() => '');
    const immediateHtml = await page.content().catch(() => '');
    const isBlocked =
      response?.status() === 429 ||
      response?.status() === 403 ||
      immediateTitle.includes('Access Denied') ||
      immediateTitle.includes('Too Many Requests') ||
      immediateTitle.includes('429') ||
      immediateHtml.includes('errors.edgesuite.net') ||
      immediateHtml.includes('<h1>Access Denied</h1>') ||
      immediateHtml.includes('Too Many Requests') ||
      immediateHtml.includes('Reference #18.');

    if (isBlocked && this.isUsingProxy) {
      console.warn(`[Browser] Proxy IP was rate-limited or blocked (status: ${response?.status()}, title: "${immediateTitle}"). Falling back to direct stealth connection...`);
      await page.close().catch(() => {});
      await this.close();
      await this.init({ ...this.currentOptions, proxyUrl: 'direct' });
      page = await this.context!.newPage();
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    }

    // Rate-limit cooldown or Cloudflare challenge check
    const startWait = Date.now();
    while (Date.now() - startWait < 30000) {
      const bodyText = await page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
      if (bodyText.includes('Too many requests') || (bodyText.length < 50 && !bodyText.includes('special'))) {
        console.log(`[Browser] Rate limit cooldown / empty response on ${url}. Waiting 15s...`);
        await page.waitForTimeout(15000);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => {});
        continue;
      }
      break;
    }

    // Hydrate lazy-loaded specials cards (scroll down)
    await page.evaluate(async () => {
      const distance = 800;
      const getMaxScroll = () => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      let current = 0;
      while (current < getMaxScroll() && current < 15000) {
        window.scrollBy(0, distance);
        current += distance;
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });

    await page.waitForTimeout(1200);

    const html = await page.content();
    const status = response ? response.status() : 200;
    return { page, html, status };
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
