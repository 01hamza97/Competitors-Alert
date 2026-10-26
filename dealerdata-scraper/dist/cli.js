"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const proxyHelper_1 = require("./services/proxyHelper");
async function main() {
    const args = process.argv.slice(2);
    const getArg = (name) => {
        const match = args.find((a) => a.startsWith(`--${name}=`));
        return match ? match.split('=')[1] : undefined;
    };
    const hasFlag = (name) => {
        return args.includes(`--${name}`);
    };
    const positionalUrl = args.find((a) => !a.startsWith('--') && (a.startsWith('http://') || a.startsWith('https://')));
    const url = getArg('url') || positionalUrl || process.env.TARGET_URL || 'https://www.mossbroscjdrriverside.com/new-inventory/index.htm';
    const inventoryType = getArg('type') || 'New';
    const mode = getArg('mode') || 'auto';
    const rawPages = getArg('pages');
    const maxPages = (!rawPages || rawPages === '0' || rawPages === '-1' || rawPages === 'unlimited' || rawPages === 'all')
        ? 0
        : parseInt(rawPages, 10);
    const dealerId = getArg('dealerId') || getArg('dealer-id') || getArg('dealer_id') || 'test_dealer_01';
    const dealerName = getArg('dealerName') || getArg('dealer-name') || undefined;
    const saveToDb = !hasFlag('no-db');
    const tryDirectApi = !hasFlag('no-api');
    const useSitemapFirst = hasFlag('sitemap-first') ? true : (hasFlag('no-sitemap') ? false : undefined);
    const proxyUrl = getArg('proxy') || (0, proxyHelper_1.getProxyUrl)();
    console.log(`Starting Scraper CLI with parameters:`);
    console.log(`- Target URL: ${url}`);
    console.log(`- Scrape Mode: ${mode} (static | ai-html | auto)`);
    console.log(`- Type: ${inventoryType}`);
    console.log(`- Page Depth: ${maxPages === 0 ? 'Unlimited (All Pages)' : `${maxPages} pages`}`);
    console.log(`- Dealer ID: ${dealerId}`);
    console.log(`- Save to DB: ${saveToDb}`);
    if (proxyUrl) {
        const masked = proxyUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
        console.log(`- Proxy: ${masked}`);
    }
    try {
        const result = await (0, index_1.scrapeDealership)({
            targetUrl: url,
            inventoryType,
            mode,
            maxPages,
            dealerId,
            dealerName,
            saveToDb,
            tryDirectApi,
            useSitemapFirst,
            proxyUrl,
            crawlSpecials: false,
            specialsOnly: false
        });
        console.log(`\n🎉 Scraper run complete!`);
        if (result.funnelStageUsed) {
            console.log(`📍 Funnel Stage: ${result.funnelStageUsed.toUpperCase()}`);
        }
        if (result.manifestFile) {
            console.log(`📄 N8N AI Manifest generated at: ${result.manifestFile}`);
        }
        process.exit(0);
    }
    catch (error) {
        console.error(`❌ Scrape execution failed:`, error.message);
        process.exit(1);
    }
}
main();
