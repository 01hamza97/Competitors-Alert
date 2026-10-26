import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import prisma from '@/lib/prisma';
import { normalizeDomain } from '@/lib/domainUtils';

/**
 * Creates a run log entry in MySQL
 */
export async function createRunLog(data) {
  if (prisma.scraperRunLog?.create) {
    try {
      return await prisma.scraperRunLog.create({ data });
    } catch {
      // Fallback to raw SQL
    }
  }

  const id = `srl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO scraper_run_logs (id, run_id, store_id, dealer_name, target_url, domain, mode, status, started_at, storage_type, log_output, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    id,
    data.runId,
    data.storeId,
    data.dealerName,
    data.targetUrl,
    data.domain || null,
    data.mode,
    data.status,
    data.startedAt,
    data.storageType,
    data.logOutput
  );

  return { id, ...data };
}

/**
 * Updates a run log entry in MySQL
 */
export async function updateRunLog(id, data) {
  if (prisma.scraperRunLog?.update) {
    try {
      return await prisma.scraperRunLog.update({ where: { id }, data });
    } catch {
      // Fallback
    }
  }

  await prisma.$executeRawUnsafe(
    `UPDATE scraper_run_logs SET
       status = ?,
       completed_at = NOW(),
       total_listings_found = ?,
       new_listings_count = ?,
       used_listings_count = ?,
       local_manifest_path = ?,
       output_file = ?,
       log_output = ?,
       error_message = ?,
       domain = COALESCE(domain, ?),
       updated_at = NOW()
     WHERE id = ?`,
    data.status,
    data.totalListingsFound || 0,
    data.newListingsCount || 0,
    data.usedListingsCount || 0,
    data.localManifestPath || null,
    data.outputFile || null,
    data.logOutput || null,
    data.errorMessage || null,
    data.domain || null,
    id
  );
}

/**
 * Resolves the root directory of the dedicated dealerdata-specials engine
 */
export function getSpecialsDir() {
  const candidates = [
    path.join(process.cwd(), '..', 'dealerdata-specials'),
    path.join(process.cwd(), 'dealerdata-specials'),
    '/var/www/Competitors-Alert/dealerdata-specials',
    '/var/www/dealerdata/dealerdata-specials',
  ];
  for (const d of candidates) {
    if (fs.existsSync(d)) return d;
  }
  return path.join(process.cwd(), '..', 'dealerdata-specials');
}

/**
 * Launches an asynchronous dedicated specials scraper for a dealership.
 */
export async function launchSpecialsJob({
  runId,
  storeId,
  dealerName,
  targetUrl,
  specialsUrl,
  forceRefresh = false,
  proxyUrl,
}) {
  const cleanTargetStoreId = (storeId || 'manual_run').replace(/^store_/, '');
  const generatedRunId = runId || `run_${Date.now()}_${cleanTargetStoreId}_specials`;
  const effectiveUrl = specialsUrl || targetUrl;
  const domain = normalizeDomain(effectiveUrl || targetUrl);

  // 1. Create run log entry in MySQL
  const runLog = await createRunLog({
    runId: generatedRunId,
    storeId: cleanTargetStoreId,
    dealerName: dealerName || 'Dealership',
    targetUrl: effectiveUrl,
    domain,
    mode: 'specials',
    status: 'running',
    startedAt: new Date(),
    storageType: process.env.R2_BUCKET_NAME ? 'r2' : 'local',
    logOutput: `[${new Date().toISOString()}] Initiated dedicated specials scrape ${generatedRunId} for ${dealerName} (${effectiveUrl})...\nMode: specials\n`,
  });

  const specialsDir = getSpecialsDir();
  const distCli = path.join(specialsDir, 'dist', 'cli.js');
  const useCompiled = fs.existsSync(distCli);

  const bin = useCompiled ? 'node' : 'npx';
  const binArgs = useCompiled ? ['dist/cli.js'] : ['ts-node', 'src/cli.ts'];

  const args = [
    ...binArgs,
    `--dealer=${cleanTargetStoreId}`,
    `--url=${effectiveUrl}`,
    `--dealerName=${dealerName || 'Dealership'}`,
  ];

  let resolvedProxy = proxyUrl || process.env.SCRAPER_PROXY_URL;
  if (!resolvedProxy) {
    const candidates = [
      path.join(specialsDir, '.env'),
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env'),
      '/var/www/Competitors-Alert/dealerdata-specials/.env',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8');
          const m = content.match(/^SCRAPER_PROXY_URL=["']?([^"'\r\n]+)["']?/m);
          if (m && m[1]) {
            resolvedProxy = m[1].trim();
            break;
          }
        } catch {}
      }
    }
  }

  if (resolvedProxy && resolvedProxy !== 'direct' && resolvedProxy !== 'none') {
    args.push(`--proxy=${resolvedProxy}`);
  }

  console.log(`[Specials Runner] Launching dedicated specials scraper in: ${specialsDir}`);
  console.log(`[Specials Runner] Command: ${bin} ${args.join(' ')}`);

  let accumulatedLogs = `[${new Date().toISOString()}] Spawning dedicated specials scraper...\n`;

  const child = spawn(bin, args, {
    cwd: specialsDir,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'mysql://root:1254879863@localhost:3306/dealerdata-2',
      ...(resolvedProxy ? { SCRAPER_PROXY_URL: resolvedProxy } : {}),
    },
    shell: false,
  });

  let lastLogFlush = Date.now();
  const flushLiveLogs = () => {
    if (Date.now() - lastLogFlush > 2000) {
      lastLogFlush = Date.now();
      prisma.scraperRunLog
        .update({
          where: { id: runLog.id },
          data: { logOutput: accumulatedLogs },
        })
        .catch(() => {});
    }
  };

  child.stdout.on('data', (data) => {
    const text = data.toString();
    accumulatedLogs += text;
    flushLiveLogs();
  });

  child.stderr.on('data', (data) => {
    const text = data.toString();
    accumulatedLogs += `[ERROR] ${text}`;
    flushLiveLogs();
  });

  child.on('close', async (code) => {
    console.log(`[Specials Runner] Specials scrape ${generatedRunId} exited with code: ${code}`);

    const htmlSpecialsMatch = accumulatedLogs.match(/Structured HTML Specials:\s*(\d+)/i);
    const visualSpecialsMatch = accumulatedLogs.match(/Visual Specials \(Flyers\):\s*(\d+)/i);
    const totalMatch = accumulatedLogs.match(/Total Extracted:\s*(\d+)/i);
    const manifestMatch = accumulatedLogs.match(/N8N Vision AI Manifest:\s*(.+)/i);

    const htmlCount = htmlSpecialsMatch ? parseInt(htmlSpecialsMatch[1], 10) : 0;
    const visualCount = visualSpecialsMatch ? parseInt(visualSpecialsMatch[1], 10) : 0;
    const totalCount = totalMatch ? parseInt(totalMatch[1], 10) : (htmlCount + visualCount);
    const manifestPath = manifestMatch ? manifestMatch[1].trim() : null;

    const finalStatus = code === 0 ? 'complete' : 'failed';

    try {
      await updateRunLog(runLog.id, {
        status: finalStatus,
        completedAt: new Date(),
        totalListingsFound: totalCount,
        newListingsCount: htmlCount,
        usedListingsCount: visualCount,
        localManifestPath: manifestPath,
        logOutput: accumulatedLogs,
        errorMessage: code !== 0 ? `Specials process exited with error code ${code}` : null,
      });
    } catch (err) {
      console.error('[Specials Runner] Failed to update run log on exit:', err.message);
    }
  });

  return {
    runId: generatedRunId,
    logId: runLog.id,
    status: 'running',
    waitForCompletion: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve(child.exitCode);
        } else {
          child.on('close', resolve);
        }
      }),
  };
}

/**
 * Launches an asynchronous scraper background process for a dealership.
 * If fresh global data exists for this domain within the TTL (strictly capped at 6h),
 * it reuses the existing global data and skips live Playwright/browser execution!
 */
export async function launchScraperJob({
  runId,
  storeId,
  dealerName,
  targetUrl,
  mode = 'auto',
  maxPages = 0,
  specialsUrl,
  crawlSpecials,
  specialsOnly = false,
  forceRefresh = false,
  inventoryTtlHours,
}) {
  const generatedRunId = runId || `run_${Date.now()}_${storeId || 'manual'}`;
  const domain = normalizeDomain(targetUrl);

  // If user requested specials only, directly delegate to dedicated specials scraper
  if (specialsOnly) {
    return launchSpecialsJob({
      runId: generatedRunId,
      storeId,
      dealerName,
      targetUrl,
      specialsUrl,
      forceRefresh,
    });
  }

  // ── Global Cache / Freshness Check (Strictly max 6 hours TTL) ───────────────
  const envTtlRaw = process.env.SCRAPER_CACHE_TTL_HOURS;
  const envTtl = envTtlRaw !== undefined && envTtlRaw.trim() !== '' ? Number(envTtlRaw) : 6;
  const requestedTtl = inventoryTtlHours !== undefined ? Number(inventoryTtlHours) : envTtl;
  const isCacheDisabled = specialsOnly || forceRefresh || (requestedTtl !== undefined && !isNaN(requestedTtl) && requestedTtl <= 0);

  if (!isCacheDisabled && domain) {
    try {
      // Never allow TTL to exceed 6 hours
      const effectiveTtlHours = Math.min(requestedTtl, 6);
      const INVENTORY_TTL_MS = effectiveTtlHours * 60 * 60 * 1000;
      const freshRun = await prisma.scraperRunLog.findFirst({
        where: {
          domain,
          status: 'complete',
          completedAt: { gte: new Date(Date.now() - INVENTORY_TTL_MS) },
        },
        orderBy: { completedAt: 'desc' },
      });

      if (freshRun && (freshRun.totalListingsFound || 0) > 0) {
        console.log(`[Scraper Runner] ⚡ GLOBAL CACHE HIT for domain "${domain}". Reusing run ${freshRun.runId} (${freshRun.totalListingsFound} vehicles).`);

        const cleanTargetStoreId = (storeId || 'custom_store').replace(/^store_/, '');

        // If the requesting storeId is different, link global inventory & specials to this store
        if (cleanTargetStoreId && cleanTargetStoreId !== (freshRun.storeId || '').replace(/^store_/, '')) {
          try {
            await prisma.$executeRawUnsafe(
              `INSERT IGNORE INTO competitor_vehicle_inventory (
                id, dealer_id, snapshot_date, vin, stock_number, year, make, model, trim,
                inventory_type, list_price, msrp, dealer_discount, mileage, vehicle_url, image_url, domain, created_at
              )
              SELECT 
                CONCAT('inv_', ?, '_', vin), ?, snapshot_date, vin, stock_number, year, make, model, trim,
                inventory_type, list_price, msrp, dealer_discount, mileage, vehicle_url, image_url, domain, NOW()
              FROM competitor_vehicle_inventory
              WHERE domain = ? AND snapshot_date = (SELECT MAX(snapshot_date) FROM competitor_vehicle_inventory WHERE domain = ?)`,
              cleanTargetStoreId,
              cleanTargetStoreId,
              domain,
              domain
            );

            await prisma.$executeRawUnsafe(
              `INSERT IGNORE INTO competitor_vehicle_specials (
                id, dealer_id, offer_dealer_name, snapshot_date, year, make, model, trim, special_type,
                monthly_payment, term_months, down_payment, apr, msrp, title, disclaimer, expiration_date, special_url, image_url, domain, created_at
              )
              SELECT 
                CONCAT('spc_', ?, '_', SUBSTRING(SHA2(CONCAT(id, ?), 256), 1, 10)), ?, offer_dealer_name, snapshot_date, year, make, model, trim, special_type,
                monthly_payment, term_months, down_payment, apr, msrp, title, disclaimer, expiration_date, special_url, image_url, domain, NOW()
              FROM competitor_vehicle_specials
              WHERE domain = ? AND snapshot_date = (SELECT MAX(snapshot_date) FROM competitor_vehicle_specials WHERE domain = ?)`,
              cleanTargetStoreId,
              cleanTargetStoreId,
              cleanTargetStoreId,
              domain,
              domain
            );
          } catch (linkErr) {
            console.warn('[Scraper Runner] Global data linking note:', linkErr.message);
          }
        }

        const runLog = await createRunLog({
          runId: generatedRunId,
          storeId: storeId || 'custom_store',
          dealerName,
          targetUrl,
          domain,
          mode,
          status: 'complete',
          startedAt: new Date(),
          completedAt: new Date(),
          totalListingsFound: freshRun.totalListingsFound,
          newListingsCount: freshRun.newListingsCount,
          usedListingsCount: freshRun.usedListingsCount,
          outputFile: freshRun.outputFile,
          localManifestPath: freshRun.localManifestPath,
          storageType: freshRun.storageType || 'local',
          logOutput: `[${new Date().toISOString()}] GLOBAL CACHE HIT for domain: ${domain}\nReused scrape data from previous run (${freshRun.runId}) completed at ${freshRun.completedAt.toISOString()} (fresh within 6-hour TTL window).\nTotal Listings: ${freshRun.totalListingsFound} (New: ${freshRun.newListingsCount}, Used: ${freshRun.usedListingsCount})\nSkipped crawler process & browser launch (100% cost saved, 0 risk of bot blocks).`,
        });

        return {
          runId: generatedRunId,
          logId: runLog.id,
          status: 'complete',
          cacheHit: true,
          waitForCompletion: () => Promise.resolve(0),
        };
      }
    } catch (cacheErr) {
      console.warn('[Scraper Runner] Cache check fallback:', cacheErr.message);
    }
  }

  // 1. Create run log for live scrape
  const runLog = await createRunLog({
    runId: generatedRunId,
    storeId: storeId || 'custom_store',
    dealerName,
    targetUrl,
    domain,
    mode,
    status: 'running',
    startedAt: new Date(),
    storageType: process.env.R2_BUCKET_NAME ? 'r2' : 'local',
    logOutput: `[${new Date().toISOString()}] Initiated live scrape run ${generatedRunId} for ${dealerName} (${targetUrl})...\nMode: ${mode} | Page Depth: ${maxPages === 0 ? 'Unlimited (All Pages)' : `${maxPages} pages`}\n`,
  });

  // 2. Spawn scraper CLI worker asynchronously
  const scraperDir = path.join(process.cwd(), '..', 'dealerdata-scraper');
  const distCli = path.join(scraperDir, 'dist', 'cli.js');
  const useCompiled = fs.existsSync(distCli);

  const bin = useCompiled ? 'node' : 'npx';
  const binArgs = useCompiled ? ['dist/cli.js'] : ['ts-node', 'src/cli.ts'];

  const args = [
    ...binArgs,
    `--url=${targetUrl}`,
    `--mode=${mode}`,
    `--pages=${maxPages}`,
    `--dealerId=${storeId || 'manual_run'}`,
    `--dealerName=${dealerName || 'Dealership'}`,
  ];

  if (specialsUrl) {
    args.push(`--specialsUrl=${specialsUrl}`);
  }
  if (specialsOnly) {
    args.push('--specialsOnly');
    args.push('--crawlSpecials');
  } else if (crawlSpecials) {
    args.push('--crawlSpecials');
  }

  let proxyUrl = process.env.SCRAPER_PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  if (!proxyUrl) {
    const candidates = [
      path.join(scraperDir, '.env'),
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env'),
      '/var/www/Competitors-Alert/dealerdata-scraper/.env',
      '/var/www/Competitors-Alert/dealerdata-next/.env.local',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8');
          const m = content.match(/^SCRAPER_PROXY_URL=["']?([^"'\r\n]+)["']?/m);
          if (m && m[1]) {
            proxyUrl = m[1].trim();
            break;
          }
        } catch {}
      }
    }
  }

  if (proxyUrl) {
    args.push(`--proxy=${proxyUrl}`);
  }

  console.log(`[Scraper Runner] Launching scraper in: ${scraperDir}`);
  console.log(`[Scraper Runner] Command: ${bin} ${args.join(' ')}`);

  let accumulatedLogs = `[${new Date().toISOString()}] Spawning crawler process...\n`;

  const child = spawn(bin, args, {
    cwd: scraperDir,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'mysql://root:1254879863@localhost:3306/dealerdata',
      ...(proxyUrl ? { SCRAPER_PROXY_URL: proxyUrl } : {}),
    },
    shell: false,
  });

  let lastLogFlush = Date.now();
  const flushLiveLogs = () => {
    if (Date.now() - lastLogFlush > 2000) {
      lastLogFlush = Date.now();
      prisma.scraperRunLog
        .update({
          where: { id: runLog.id },
          data: { logOutput: accumulatedLogs },
        })
        .catch(() => {});
    }
  };

  child.stdout.on('data', (data) => {
    const text = data.toString();
    accumulatedLogs += text;
    flushLiveLogs();
  });

  child.stderr.on('data', (data) => {
    const text = data.toString();
    accumulatedLogs += `[ERROR] ${text}`;
    flushLiveLogs();
  });

  child.on('close', async (code) => {
    console.log(`[Scraper Runner] Scraper run ${generatedRunId} exited with code: ${code}`);

    let totalFound = 0;
    let newCount = 0;
    let usedCount = 0;

    // Extract from final summary block if present, else fallback to last occurrence
    const finalSummaryMatch = accumulatedLogs.match(/FUNNEL PIPELINE COMPLETE[\s\S]*?Total Unique Listings:\s*(\d+)/i);
    const allTotalMatches = [...accumulatedLogs.matchAll(/Total Unique Listings:\s*(\d+)/gi)];
    if (finalSummaryMatch) {
      totalFound = parseInt(finalSummaryMatch[1], 10);
    } else if (allTotalMatches.length > 0) {
      totalFound = parseInt(allTotalMatches[allTotalMatches.length - 1][1], 10);
    } else {
      const extractedMatch = accumulatedLogs.match(/Extracted\s*(\d+)\s*listings/i);
      if (extractedMatch) totalFound = parseInt(extractedMatch[1], 10);
    }

    const finalNewMatch = accumulatedLogs.match(/FUNNEL PIPELINE COMPLETE[\s\S]*?New:\s*(\d+)/i);
    const allNewMatches = [...accumulatedLogs.matchAll(/New Inventory:\s*(\d+)/gi)];
    if (finalNewMatch) {
      newCount = parseInt(finalNewMatch[1], 10);
    } else if (allNewMatches.length > 0) {
      newCount = parseInt(allNewMatches[allNewMatches.length - 1][1], 10);
    }

    const finalUsedMatch = accumulatedLogs.match(/FUNNEL PIPELINE COMPLETE[\s\S]*?Used:\s*(\d+)/i);
    const allUsedMatches = [...accumulatedLogs.matchAll(/Used Inventory:\s*(\d+)/gi)];
    if (finalUsedMatch) {
      usedCount = parseInt(finalUsedMatch[1], 10);
    } else if (allUsedMatches.length > 0) {
      usedCount = parseInt(allUsedMatches[allUsedMatches.length - 1][1], 10);
    }

    const manifestMatch =
      accumulatedLogs.match(/N8N AI Manifest generated at:\s*(.+)/i) ||
      accumulatedLogs.match(/N8N AI Manifest:\s*(.+)/i);
    const manifestPath = manifestMatch ? manifestMatch[1].trim() : null;

    const outputMatch =
      accumulatedLogs.match(/Listings JSON:\s*(.+)/i) ||
      accumulatedLogs.match(/Saved \d+ vehicle listings to:\s*(.+)/i);
    const outputFile = outputMatch ? outputMatch[1].trim() : null;

    const stageMatch =
      accumulatedLogs.match(/Funnel Stage Used:\s*([A-Z_]+)/i) ||
      accumulatedLogs.match(/Funnel Stage:\s*([A-Z_]+)/i);
    const funnelStage = stageMatch ? stageMatch[1].trim() : null;

    const finalStatus = code === 0 ? 'complete' : 'failed';

    try {
      await updateRunLog(runLog.id, {
        status: finalStatus,
        completedAt: new Date(),
        totalListingsFound: totalFound,
        newListingsCount: newCount || totalFound,
        usedListingsCount: usedCount,
        localManifestPath: manifestPath,
        outputFile: outputFile,
        logOutput: accumulatedLogs,
        errorMessage: code !== 0 ? `Process exited with error code ${code}` : null,
      });
    } catch (err) {
      console.error('[Scraper Runner] Failed to update run log on process exit:', err.message);
    }

    // Auto-trigger dedicated specials scraper after successful inventory crawl if requested or specialsUrl is present
    if (code === 0 && (crawlSpecials || specialsUrl)) {
      try {
        console.log(`[Scraper Runner] Inventory crawl complete for ${dealerName}. Automatically triggering dedicated specials crawl...`);
        const specialsRunId = `${generatedRunId}_specials`;
        launchSpecialsJob({
          runId: specialsRunId,
          storeId,
          dealerName,
          targetUrl,
          specialsUrl,
          forceRefresh: true,
          proxyUrl,
        }).catch((err) => console.error(`[Scraper Runner] Auto specials crawl error for ${dealerName}:`, err.message));
      } catch (specialsErr) {
        console.error(`[Scraper Runner] Auto specials trigger error for ${dealerName}:`, specialsErr.message);
      }
    }
  });

  return {
    runId: generatedRunId,
    logId: runLog.id,
    status: 'running',
    waitForCompletion: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve(child.exitCode);
        } else {
          child.on('close', resolve);
        }
      }),
  };
}
