import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

// Import launchScraperJob and log helpers
const { launchScraperJob } = await import('../src/lib/scraperRunner.js');

// Helper to parse CLI arguments
function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}
const hasFlag = (flag) => process.argv.includes(flag);

const storeArg = getArg('--store') || (!process.argv[2]?.startsWith('--') ? process.argv[2] : null);
const runAll = hasFlag('--all');
const dryRun = hasFlag('--dry-run');
const maxRetries = parseInt(getArg('--retries') || '3', 10);
const cooldownSeconds = parseInt(getArg('--cooldown') || '150', 10); // default 2.5 minutes (150s)

/**
 * Format milliseconds into human-readable duration
 */
function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return min > 0 ? `${min}m ${remSec}s` : `${sec}s`;
}

/**
 * Async sleep with optional live countdown
 */
async function sleep(seconds, message = 'Cooling down') {
  for (let rem = seconds; rem > 0; rem--) {
    process.stdout.write(`\r⏳ [${message}] Waiting ${rem}s before retry... `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  process.stdout.write('\r' + ' '.repeat(60) + '\r');
}

/**
 * Check if the current time in a given IANA timezone is 11:00 AM (11:00 - 11:59)
 */
function isTargetHour(timezone = 'America/Los_Angeles', targetHour = 11) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const hourStr = formatter.format(new Date());
    const hour = parseInt(hourStr, 10);
    return hour === targetHour;
  } catch (err) {
    console.warn(`[Timezone] Warning: Invalid timezone "${timezone}", defaulting to America/Los_Angeles`);
    return isTargetHour('America/Los_Angeles', targetHour);
  }
}

/**
 * Get current date string (YYYY-MM-DD) in store's timezone
 */
function getStoreLocalDate(timezone = 'America/Los_Angeles') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // Returns YYYY-MM-DD
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Validates whether a dealership's scrape was 100% successful.
 * Checks run log status, listings count, error keywords, and DB persistence.
 */
async function verifyScrapeSuccess(runId, dealerKey, expectedSnapshotDate) {
  // 1. Fetch run log entry
  const log = await prisma.scraperRunLog.findFirst({
    where: { runId },
    orderBy: { createdAt: 'desc' },
  });

  if (!log) {
    return { success: false, reason: 'No scraper run log found in database' };
  }

  if (log.status !== 'complete') {
    return {
      success: false,
      reason: `Scraper status is "${log.status}" (error: ${log.errorMessage || 'unknown error'})`,
    };
  }

  const listingsFound = log.totalListingsFound || 0;
  if (listingsFound === 0) {
    return { success: false, reason: 'Scraper completed but found 0 vehicle listings' };
  }

  // 2. Check for fatal blocking keywords in logs
  const rawLogs = log.logOutput || '';
  if (rawLogs.includes('status code 402') || rawLogs.includes('status code 403')) {
    return { success: false, reason: 'Detected HTTP 402 / 403 proxy or rate limit error in scraper log' };
  }
  if (rawLogs.includes('REJECTING DB SYNC: 100% of')) {
    return { success: false, reason: '100% of vehicles had $0 price (blocking occurred)' };
  }

  // 3. Verify database rows exist for today's snapshot date
  const cleanKey = dealerKey.replace(/^store_/, '').replace(/^comp_/, '');
  const dbCount = await prisma.competitorVehicleInventory.count({
    where: {
      dealerId: { in: [cleanKey, `store_${cleanKey}`, `comp_${cleanKey}`] },
      snapshotDate: expectedSnapshotDate,
    },
  });

  if (dbCount === 0) {
    return {
      success: false,
      reason: `Scraper reported ${listingsFound} listings, but 0 records were saved in competitor_vehicle_inventory for ${expectedSnapshotDate}`,
    };
  }

  return {
    success: true,
    listingsFound,
    dbSavedCount: dbCount,
  };
}

/**
 * Scrapes a single dealership target with automatic log monitoring and retry backoff.
 */
async function scrapeWithMonitorAndRetry({
  storeId,
  dealerName,
  targetUrl,
  specialsUrl = null,
  crawlSpecials = false,
  snapshotDate,
  isCompetitor = false,
}) {
  const label = isCompetitor ? `[Competitor: ${dealerName}]` : `[Store: ${dealerName}]`;
  console.log(`\n------------------------------------------------------`);
  console.log(`▶ Starting scrape for ${label}`);
  console.log(`  URL: ${targetUrl}`);
  console.log(`  Target Date: ${snapshotDate}`);
  console.log(`------------------------------------------------------`);

  let attempt = 0;
  let finalResult = null;

  while (attempt < maxRetries) {
    attempt++;
    const runId = `wf_${Date.now()}_${storeId}_try${attempt}`;
    const startTime = Date.now();

    console.log(`\n🚀 ${label} Attempt ${attempt} of ${maxRetries}...`);

    try {
      const job = await launchScraperJob({
        runId,
        storeId,
        dealerName,
        targetUrl,
        mode: 'auto',
        maxPages: 0,
        specialsUrl,
        crawlSpecials,
        forceRefresh: true, // Always force fresh crawl for daily workflow
      });

      // Wait for process to fully exit
      if (typeof job?.waitForCompletion === 'function') {
        await job.waitForCompletion();
      }

      // Allow 1 second for logs/DB to flush
      await new Promise((r) => setTimeout(r, 1000));

      // Verify the result
      const verification = await verifyScrapeSuccess(runId, storeId, snapshotDate);
      const elapsed = formatDuration(Date.now() - startTime);

      if (verification.success) {
        console.log(`✅ ${label} SUCCEEDED on attempt ${attempt} in ${elapsed}!`);
        console.log(`   Vehicles scraped & verified in DB: ${verification.dbSavedCount}`);
        return {
          dealerName,
          storeId,
          isCompetitor,
          success: true,
          attempts: attempt,
          listingsFound: verification.listingsFound,
          dbCount: verification.dbSavedCount,
          elapsed,
        };
      } else {
        console.warn(`⚠️  ${label} Attempt ${attempt} INCOMPLETE: ${verification.reason}`);
        finalResult = {
          dealerName,
          storeId,
          isCompetitor,
          success: false,
          attempts: attempt,
          lastError: verification.reason,
          elapsed,
        };

        if (attempt < maxRetries) {
          console.log(`   Applying rate-limit cooldown of ${cooldownSeconds}s before retrying ${dealerName}...`);
          await sleep(cooldownSeconds, `Cooldown for ${dealerName}`);
        }
      }
    } catch (err) {
      const elapsed = formatDuration(Date.now() - startTime);
      console.error(`❌ ${label} Attempt ${attempt} crashed with error: ${err.message}`);
      finalResult = {
        dealerName,
        storeId,
        isCompetitor,
        success: false,
        attempts: attempt,
        lastError: err.message,
        elapsed,
      };

      if (attempt < maxRetries) {
        console.log(`   Applying rate-limit cooldown of ${cooldownSeconds}s before retrying ${dealerName}...`);
        await sleep(cooldownSeconds, `Cooldown for ${dealerName}`);
      }
    }
  }

  console.error(`💥 ${label} FAILED after ${maxRetries} attempts. Last error: ${finalResult?.lastError}`);
  return finalResult;
}

/**
 * Main workflow runner
 */
async function main() {
  console.log('================================================================');
  console.log(' 🛡️  DEALERDATA AUTOMATED INVENTORY SCRAPER & MONITOR WORKFLOW');
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Max Retries: ${maxRetries} | Failure Cooldown: ${cooldownSeconds}s`);
  console.log('================================================================\n');

  // 1. Fetch candidate stores
  const whereClause = {
    active: true,
    scraperActive: true,
  };

  if (storeArg) {
    const cleanArg = storeArg.replace(/^store_/, '');
    whereClause.OR = [
      { name: { contains: storeArg } },
      { dealershipKey: cleanArg },
      { id: storeArg },
      { id: `store_${cleanArg}` },
    ];
  }

  const stores = await prisma.store.findMany({
    where: whereClause,
    include: {
      competitors: {
        where: { active: true, newInventoryUrl: { not: null } },
        orderBy: { competitorName: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  if (stores.length === 0) {
    console.log('No matching active stores found to scrape.');
    process.exit(0);
  }

  // 2. Filter stores based on 11:00 AM local timezone (unless --store or --all is used)
  const storesToProcess = [];

  for (const store of stores) {
    const tz = store.timezone || 'America/Los_Angeles';
    const is11AM = isTargetHour(tz, 11);
    const localDate = getStoreLocalDate(tz);

    console.log(`• Store: "${store.name}" | Timezone: ${tz} | Is 11:00 AM Window: ${is11AM ? 'YES ✅' : 'NO ❌'}`);

    if (storeArg || runAll || is11AM) {
      storesToProcess.push({ store, tz, localDate });
    }
  }

  if (storesToProcess.length === 0) {
    console.log('\nℹ️  No stores are currently in their 11:00 AM local window. Exiting cleanly.');
    console.log('   (Tip: Run with --all or --store "<Name>" to bypass timezone check)');
    process.exit(0);
  }

  if (dryRun) {
    console.log(`\n[Dry Run] Would process ${storesToProcess.length} store(s):`);
    storesToProcess.forEach(({ store, tz, localDate }) => {
      console.log(`  - ${store.name} (${store.dealershipKey}) [${tz}] date: ${localDate} | ${store.competitors.length} competitors`);
    });
    process.exit(0);
  }

  const overallResults = [];

  // 3. Process each eligible store and its competitors sequentially
  for (const { store, tz, localDate } of storesToProcess) {
    console.log(`\n================================================================`);
    console.log(`🏁 PROCESSING STORE SUITE: ${store.name}`);
    console.log(`   Timezone: ${tz} | Snapshot Date: ${localDate}`);
    console.log(`   Competitors to crawl: ${store.competitors.length}`);
    console.log(`================================================================`);

    // A. Scrape parent store first
    if (store.newInventoryUrl) {
      const parentResult = await scrapeWithMonitorAndRetry({
        storeId: store.dealershipKey || store.id,
        dealerName: store.name,
        targetUrl: store.newInventoryUrl,
        specialsUrl: store.specialsUrl,
        crawlSpecials: Boolean(store.crawlSpecials),
        snapshotDate: localDate,
        isCompetitor: false,
      });
      overallResults.push(parentResult);
    } else {
      console.warn(`⚠️ Parent store "${store.name}" has no newInventoryUrl configured.`);
    }

    // B. Scrape competitors sequentially with monitoring & retry
    for (const comp of store.competitors) {
      if (!comp.newInventoryUrl?.trim()) continue;

      const compResult = await scrapeWithMonitorAndRetry({
        storeId: comp.competitorKey || comp.id,
        dealerName: comp.competitorName,
        targetUrl: comp.newInventoryUrl,
        specialsUrl: comp.specialsUrl,
        crawlSpecials: Boolean(comp.crawlSpecials),
        snapshotDate: localDate,
        isCompetitor: true,
      });
      overallResults.push(compResult);
    }
  }

  // 4. Output final execution report
  console.log('\n\n================================================================');
  console.log(' 📊 WORKFLOW EXECUTION SUMMARY');
  console.log('================================================================');

  const summaryRows = overallResults.map((r) => ({
    Dealer: r.dealerName,
    Type: r.isCompetitor ? 'Competitor' : 'Parent Store',
    Status: r.success ? 'SUCCESS ✅' : 'FAILED ❌',
    Attempts: r.attempts,
    Vehicles: r.dbCount || r.listingsFound || 0,
    Duration: r.elapsed,
    Note: r.success ? (r.attempts > 1 ? `Recovered on retry ${r.attempts}` : 'Clean 1st pass') : r.lastError,
  }));

  console.table(summaryRows);

  const totalSuccess = overallResults.filter((r) => r.success).length;
  const totalFailed = overallResults.filter((r) => !r.success).length;

  console.log(`Total Targets: ${overallResults.length} | Succeeded: ${totalSuccess} | Failed: ${totalFailed}`);
  console.log('================================================================\n');

  await prisma.$disconnect();
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('[Workflow Fatal Error]:', e);
  await prisma.$disconnect();
  process.exit(1);
});

