"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const registry_1 = require("./dealers/registry");
async function main() {
    const args = process.argv.slice(2);
    const getArg = (name) => {
        const prefix = `--${name}=`;
        const match = args.find((a) => a.startsWith(prefix));
        return match ? match.slice(prefix.length) : undefined;
    };
    const hasFlag = (name) => {
        return args.includes(`--${name}`);
    };
    if (hasFlag('help') || hasFlag('h')) {
        console.log(`
DealerData Specials Scraper CLI

Usage:
  npm run scrape -- [options]

Options:
  --dealer=<id>      Dealer identifier (e.g. j_star_cdjr, tuttle_click_hyundai)
  --url=<url>         Direct specials target URL to scrape
  --dealerName=<name> Custom dealer display name
  --proxy=<proxyUrl>  Explicit proxy URL (defaults to SCRAPER_PROXY_URL in .env)
  --no-db             Skip saving extracted specials to MySQL database
  --head              Run Chromium in headed mode (visible browser)
  --all               Run specials scraper for all configured dealerships sequentially
  --list              List all registered dealer scrapers
    `);
        process.exit(0);
    }
    if (hasFlag('list')) {
        console.log('\nRegistered Dealer Specials Scrapers:');
        const all = registry_1.DealerRegistry.getAllScrapers();
        for (const d of all) {
            console.log(`- ${d.id.padEnd(28)} | ${d.name} (${d.specialsUrls.length} configured URLs)`);
        }
        console.log();
        process.exit(0);
    }
    const runAll = hasFlag('all');
    const dealerId = getArg('dealer') || getArg('dealer-id') || getArg('dealerId');
    const targetUrl = getArg('url') || args.find((a) => !a.startsWith('--') && (a.startsWith('http://') || a.startsWith('https://')));
    const dealerName = getArg('dealerName') || getArg('dealer-name');
    const saveToDb = !hasFlag('no-db');
    const proxyUrl = getArg('proxy');
    const headless = !hasFlag('head');
    if (runAll) {
        const scrapers = registry_1.DealerRegistry.getAllScrapers();
        console.log(`\n🚀 Running Specials Scraper across ${scrapers.length} configured dealers...\n`);
        for (const scraper of scrapers) {
            try {
                await (0, index_1.scrapeSpecials)({
                    dealerId: scraper.id,
                    dealerName: scraper.name,
                    saveToDb,
                    proxyUrl,
                    headless
                });
            }
            catch (err) {
                console.error(`❌ Failed scraping dealer ${scraper.id}: ${err.message}`);
            }
        }
        process.exit(0);
    }
    if (!dealerId && !targetUrl) {
        console.error('Error: Please specify either --dealer=<id> or --url=<targetUrl>. Run with --help for details.');
        process.exit(1);
    }
    try {
        await (0, index_1.scrapeSpecials)({
            dealerId,
            dealerName,
            targetUrl,
            saveToDb,
            proxyUrl,
            headless
        });
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ Specials scraper fatal error:', err.message);
        process.exit(1);
    }
}
main();
