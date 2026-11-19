import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import {
  isKillSwitchActive,
  setKillSwitchState,
  killAllRunningScrapers,
  killSingleScraper,
  resetStuckJobs,
  activeScraperProcesses,
} from '@/lib/scraperKillSwitch';

/**
 * GET /api/scraper/control
 * Returns the current kill switch state, active child processes, and running jobs.
 * Restricted to Admins only.
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.replace('Bearer ', '') ||
      request.cookies.get('dealerdata_session')?.value ||
      request.cookies.get('session_token')?.value;
    const user = await getSessionUser(token);

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only administrators can access scraper control settings.' },
        { status: 403 }
      );
    }

    const killSwitch = await isKillSwitchActive();

    // Query all currently 'running' scraper run logs
    const runningRows = await prisma.scraperRunLog.findMany({
      where: {
        status: 'running',
        runId: { not: 'SYSTEM_KILL_SWITCH' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const runningJobs = runningRows.map((r) => {
      const startTime = new Date(r.startedAt || r.createdAt).getTime();
      const elapsedMs = Date.now() - startTime;
      const isStuck = elapsedMs > 15 * 60 * 1000; // > 15 mins considered stuck

      return {
        id: r.id,
        runId: r.runId,
        storeId: r.storeId,
        dealerName: r.dealerName || r.storeId,
        startedAt: r.startedAt || r.createdAt,
        mode: r.mode,
        targetUrl: r.targetUrl,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
        isStuck,
      };
    });

    return NextResponse.json({
      success: true,
      killSwitch,
      runningCount: runningJobs.length,
      runningJobs,
      activeProcessCount: activeScraperProcesses.size,
    });
  } catch (err) {
    console.error('[API /api/scraper/control] GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/scraper/control
 * Executes administrative scraper kill switch actions:
 * - 'toggle_kill_switch': Activates or deactivates the emergency halt
 * - 'kill_all': Instantly kills all running crawler processes and aborts running jobs
 * - 'kill_run': Terminates a specific running dealership scrape
 * - 'reset_stuck': Resets zombie jobs that have been running for > 15 mins
 * Restricted to Admins only.
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.replace('Bearer ', '') ||
      request.cookies.get('dealerdata_session')?.value ||
      request.cookies.get('session_token')?.value;
    const user = await getSessionUser(token);

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied: Only administrators can use the scraper kill switch.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, runId, active, reason, olderThanMinutes } = body;
    const adminIdentifier = user.email || user.fullName || 'Admin';

    if (action === 'toggle_kill_switch') {
      const result = await setKillSwitchState(Boolean(active), {
        reason: reason || (active ? 'Emergency stop engaged by admin' : 'Scraper resumed by admin'),
        updatedBy: adminIdentifier,
      });

      return NextResponse.json({
        success: true,
        message: active
          ? 'Emergency Kill Switch ACTIVATED. All crawling processes terminated and scraping halted.'
          : 'Emergency Kill Switch DEACTIVATED. Normal scraping operations resumed.',
        killSwitch: result,
      });
    }

    if (action === 'kill_all') {
      await killAllRunningScrapers(`Force killed by admin (${adminIdentifier})`);
      return NextResponse.json({
        success: true,
        message: 'All running crawler processes have been forcefully terminated.',
      });
    }

    if (action === 'kill_run') {
      if (!runId) {
        return NextResponse.json({ success: false, error: 'runId is required' }, { status: 400 });
      }
      await killSingleScraper(runId, `Terminated by admin (${adminIdentifier})`);
      return NextResponse.json({
        success: true,
        message: `Scraper run ${runId} terminated successfully.`,
      });
    }

    if (action === 'reset_stuck') {
      const result = await resetStuckJobs(olderThanMinutes || 15);
      return NextResponse.json({
        success: true,
        message: `Successfully reset ${result.resetCount || 0} stuck scraper job(s).`,
        resetCount: result.resetCount || 0,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: "${action}"` }, { status: 400 });
  } catch (err) {
    console.error('[API /api/scraper/control] POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
