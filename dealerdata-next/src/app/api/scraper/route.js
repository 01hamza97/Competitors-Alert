import { NextResponse } from 'next/server';
import path from 'path';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { launchScraperJob, createRunLog, updateRunLog } from '@/lib/scraperRunner';

/**
 * Helper to fetch logs safely via Prisma model or raw SQL
 */
async function getLogs() {
  if (prisma.scraperRunLog?.findMany) {
    try {
      return await prisma.scraperRunLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
    } catch {
      // Fallback to raw query
    }
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM scraper_run_logs ORDER BY created_at DESC LIMIT 30`
  );

  return (rows || []).map((r) => ({
    id: r.id,
    runId: r.run_id,
    storeId: r.store_id,
    dealerName: r.dealer_name,
    targetUrl: r.target_url,
    mode: r.mode,
    status: r.status,
    totalListingsFound: r.total_listings_found,
    newListingsCount: r.new_listings_count,
    usedListingsCount: r.used_listings_count,
    pagesCrawled: r.pages_crawled,
    storageType: r.storage_type,
    localManifestPath: r.local_manifest_path,
    outputFile: r.output_file,
    logOutput: r.log_output,
    errorMessage: r.error_message,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  }));
}


/**
 * GET /api/scraper
 * Returns stores with their latest scrape status and recent run logs
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.replace('Bearer ', '') ||
      request.cookies.get('dealerdata_session')?.value ||
      request.cookies.get('session_token')?.value;
    const user = await getSessionUser(token);

    // Fetch stores
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        name: true,
        dealershipKey: true,
        newInventoryUrl: true,
        scraperPlatform: true,
        scraperActive: true,
        updatedAt: true,
      },
    });

    // Fetch competitors
    const competitors = await prisma.storeCompetitor.findMany({
      select: {
        id: true,
        storeId: true,
        competitorName: true,
        competitorKey: true,
        newInventoryUrl: true,
        scraperPlatform: true,
        active: true,
        updatedAt: true,
        store: { select: { name: true } },
      },
    });

    // Fetch recent 30 scrape logs safely
    const logs = await getLogs();

    // Map latest scrape status per store/competitor
    const storeStatusMap = {};
    for (const log of logs) {
      const targetId = log.storeId;
      if (targetId && !storeStatusMap[targetId]) {
        storeStatusMap[targetId] = {
          lastStatus: log.status,
          lastRunAt: log.createdAt,
          totalListings: log.totalListingsFound,
          newListings: log.newListingsCount,
          mode: log.mode,
          runId: log.runId,
        };
      }
    }

    const storesWithStatus = stores.map((s) => ({
      ...s,
      isCompetitor: false,
      scrapeStatus: storeStatusMap[s.id] || storeStatusMap[s.dealershipKey] || {
        lastStatus: 'idle',
        lastRunAt: null,
        totalListings: 0,
        newListings: 0,
        mode: 'auto',
      },
    }));

    const competitorsWithStatus = competitors.map((c) => ({
      id: c.id,
      storeId: c.storeId,
      name: `${c.competitorName} (vs ${c.store?.name || 'Client'})`,
      rawName: c.competitorName,
      dealershipKey: c.competitorKey,
      newInventoryUrl: c.newInventoryUrl,
      scraperPlatform: c.scraperPlatform,
      scraperActive: c.active,
      isCompetitor: true,
      scrapeStatus: storeStatusMap[c.competitorKey] || storeStatusMap[c.id] || {
        lastStatus: 'idle',
        lastRunAt: null,
        totalListings: 0,
        newListings: 0,
        mode: 'auto',
      },
    }));

    const totalRuns = logs.length;
    const successfulRuns = logs.filter((l) => l.status === 'complete').length;
    const failedRuns = logs.filter((l) => l.status === 'failed').length;
    const runningRuns = logs.filter((l) => l.status === 'running').length;

    return NextResponse.json({
      success: true,
      stores: storesWithStatus,
      competitors: competitorsWithStatus,
      recentLogs: logs,
      stats: {
        totalRuns,
        successfulRuns,
        failedRuns,
        runningRuns,
      },
    });
  } catch (error) {
    console.error('[API /api/scraper] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/scraper
 * Triggers a live scraper run directly from the UI
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.replace('Bearer ', '') ||
      request.cookies.get('dealerdata_session')?.value ||
      request.cookies.get('session_token')?.value;
    const user = await getSessionUser(token);

    const body = await request.json();
    const { storeId, targetUrl, mode = 'auto', maxPages = 0, dealerName } = body;

    let scrapeUrl = targetUrl;
    let resolvedName = dealerName || 'Target Dealership';

    let cleanTargetId = storeId || 'custom_store';

    let resolvedSpecialsUrl = body.specialsUrl || null;
    let resolvedCrawlSpecials = Boolean(body.crawlSpecials);

    if (storeId) {
      if (storeId.startsWith('comp_')) {
        const comp = await prisma.storeCompetitor.findFirst({
          where: { OR: [{ id: storeId }, { competitorKey: storeId }] },
        });
        if (comp) {
          cleanTargetId = comp.competitorKey;
          scrapeUrl = comp.newInventoryUrl || scrapeUrl;
          resolvedName = comp.competitorName || resolvedName;
          resolvedSpecialsUrl = comp.specialsUrl || resolvedSpecialsUrl;
          resolvedCrawlSpecials = Boolean(comp.crawlSpecials);
        }
      } else {
        const store = await prisma.store.findFirst({
          where: { OR: [{ id: storeId }, { dealershipKey: storeId }] },
          include: { competitors: true },
        });
        if (store) {
          cleanTargetId = store.dealershipKey || store.id;
          scrapeUrl = store.newInventoryUrl || scrapeUrl;
          resolvedName = store.name || resolvedName;
          resolvedSpecialsUrl = store.specialsUrl || resolvedSpecialsUrl;
          resolvedCrawlSpecials = Boolean(store.crawlSpecials);
        }
      }
    }

    if (!scrapeUrl) {
      return NextResponse.json(
        { success: false, error: 'A valid dealership inventory URL is required.' },
        { status: 400 }
      );
    }

    const runId = `run_${Date.now()}_${cleanTargetId}`;

    const forceRefresh = Boolean(body.forceRefresh);
    const inventoryTtlHours = body.inventoryTtlHours !== undefined ? Number(body.inventoryTtlHours) : undefined;
    const specialsOnly = Boolean(body.specialsOnly);
    const includeCompetitors = body.includeCompetitors !== undefined ? Boolean(body.includeCompetitors) : !specialsOnly;

    const storeJob = await launchScraperJob({
      runId,
      storeId: cleanTargetId,
      dealerName: resolvedName,
      targetUrl: scrapeUrl,
      mode,
      maxPages,
      specialsUrl: resolvedSpecialsUrl,
      crawlSpecials: specialsOnly ? true : resolvedCrawlSpecials,
      specialsOnly,
      forceRefresh,
      inventoryTtlHours,
    });

    // If client store has active competitors, queue them sequentially
    if (includeCompetitors && storeId && !storeId.startsWith('comp_')) {
      const storeRecord = await prisma.store.findFirst({
        where: { OR: [{ id: storeId }, { dealershipKey: storeId }] },
        include: {
          competitors: {
            where: { active: true, newInventoryUrl: { not: null } },
          },
        },
      });

      if (storeRecord?.competitors?.length > 0) {
        // Deduplicate
        const compMap = new Map();
        for (const c of storeRecord.competitors) {
          if (!c.newInventoryUrl?.trim()) continue;
          const k = c.competitorKey || c.id;
          const prev = compMap.get(k);
          if (!prev) {
            compMap.set(k, c);
          } else if ((prev.newInventoryUrl || '').includes('special') && !(c.newInventoryUrl || '').includes('special')) {
            compMap.set(k, c);
          }
        }
        const queuedComps = Array.from(compMap.values());

        if (queuedComps.length > 0) {
          (async () => {
            if (typeof storeJob?.waitForCompletion === 'function') {
              try {
                await storeJob.waitForCompletion();
              } catch (e) {}
            }

            for (const comp of queuedComps) {
              try {
                const compRunId = `run_${Date.now()}_comp_${comp.competitorKey}`;
                const compJob = await launchScraperJob({
                  runId: compRunId,
                  storeId: comp.competitorKey,
                  dealerName: comp.competitorName,
                  targetUrl: comp.newInventoryUrl,
                  mode,
                  maxPages,
                  specialsUrl: comp.specialsUrl,
                  crawlSpecials: Boolean(comp.crawlSpecials),
                  forceRefresh,
                  inventoryTtlHours,
                });
                if (typeof compJob?.waitForCompletion === 'function') {
                  await compJob.waitForCompletion();
                }
              } catch (err) {
                console.error('[API /api/scraper] Competitor scrape error:', err.message);
              }
            }
          })();
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Scraper launched successfully for ${resolvedName}`,
      runId,
      status: 'running',
    });
  } catch (error) {
    console.error('[API /api/scraper] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
