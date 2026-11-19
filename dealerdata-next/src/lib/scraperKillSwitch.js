import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import prisma from './prisma.js';

// Global in-memory registry of active child processes: runId -> { pid, child, storeId, dealerName, startedAt }
if (!global.__activeScraperProcesses) {
  global.__activeScraperProcesses = new Map();
}
export const activeScraperProcesses = global.__activeScraperProcesses;

const KILL_SWITCH_FILE = path.join(process.cwd(), 'data', 'scraper_kill_switch.json');
const TEMP_KILL_SWITCH_FILE = '/tmp/dealerdata_scraper_kill.json';

/**
 * Ensures data directory exists
 */
function ensureDataDir() {
  const dir = path.dirname(KILL_SWITCH_FILE);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {}
  }
}

/**
 * Registers an active scraper child process
 */
export function registerScraperProcess(runId, { child, storeId, dealerName }) {
  if (!runId || !child) return;
  activeScraperProcesses.set(runId, {
    runId,
    pid: child.pid,
    child,
    storeId,
    dealerName,
    startedAt: Date.now(),
  });
}

/**
 * Unregisters a scraper process when it finishes
 */
export function unregisterScraperProcess(runId) {
  if (!runId) return;
  activeScraperProcesses.delete(runId);
}

/**
 * Force kills a process and its child processes (e.g. Playwright, Chromium, node)
 */
export function killProcessTree(pid) {
  if (!pid) return;
  try {
    // Kill process group if detached
    process.kill(-pid, 'SIGKILL');
  } catch (e1) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (e2) {}
  }

  // On Unix/Linux/macOS, also pkill any direct child processes of this PID
  if (process.platform !== 'win32') {
    try {
      exec(`pkill -9 -P ${pid}`, () => {});
    } catch (_) {}
  }
}

/**
 * Checks whether the Kill Switch is currently active.
 * Checked by:
 * 1. Persistent JSON file
 * 2. Database entry in scraper_run_logs (SYSTEM_KILL_SWITCH)
 * 3. Environment variable AUTO_SCRAPE_ENABLED=false / DISABLE_AUTO_SCRAPE=true
 */
export async function isKillSwitchActive() {
  // 1. Check environment variables
  if (process.env.AUTO_SCRAPE_ENABLED === 'false' || process.env.DISABLE_AUTO_SCRAPE === 'true') {
    return {
      active: true,
      reason: 'Automated scraping disabled via environment variable (AUTO_SCRAPE_ENABLED=false)',
      updatedBy: 'system_env',
      updatedAt: new Date().toISOString(),
    };
  }

  // 2. Check local file lock
  for (const f of [KILL_SWITCH_FILE, TEMP_KILL_SWITCH_FILE]) {
    if (fs.existsSync(f)) {
      try {
        const raw = fs.readFileSync(f, 'utf-8');
        const data = JSON.parse(raw);
        if (data && data.active) {
          return {
            active: true,
            reason: data.reason || 'Scraper Kill Switch engaged by admin',
            updatedBy: data.updatedBy || 'admin',
            updatedAt: data.updatedAt || new Date().toISOString(),
          };
        }
      } catch (_) {}
    }
  }

  // 3. Check database record
  try {
    const dbRecord = await prisma.scraperRunLog.findFirst({
      where: { runId: 'SYSTEM_KILL_SWITCH' },
      orderBy: { updatedAt: 'desc' },
    });
    if (dbRecord && dbRecord.status === 'active') {
      return {
        active: true,
        reason: dbRecord.errorMessage || 'Emergency stop engaged in database',
        updatedBy: dbRecord.dealerName || 'admin',
        updatedAt: dbRecord.updatedAt.toISOString(),
      };
    }
  } catch (_) {}

  return { active: false };
}

/**
 * Activates or deactivates the global Kill Switch
 */
export async function setKillSwitchState(active, { reason = 'Emergency stop engaged by admin', updatedBy = 'admin' } = {}) {
  ensureDataDir();
  const payload = {
    active: Boolean(active),
    reason: Boolean(active) ? reason : null,
    updatedBy,
    updatedAt: new Date().toISOString(),
  };

  // Write file
  try {
    fs.writeFileSync(KILL_SWITCH_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (_) {}
  try {
    fs.writeFileSync(TEMP_KILL_SWITCH_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (_) {}

  // Update DB entry
  try {
    const existing = await prisma.scraperRunLog.findFirst({
      where: { runId: 'SYSTEM_KILL_SWITCH' },
    });

    if (existing) {
      await prisma.scraperRunLog.update({
        where: { id: existing.id },
        data: {
          status: active ? 'active' : 'disabled',
          errorMessage: active ? reason : null,
          dealerName: updatedBy,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.scraperRunLog.create({
        data: {
          runId: 'SYSTEM_KILL_SWITCH',
          mode: 'system',
          status: active ? 'active' : 'disabled',
          dealerName: updatedBy,
          errorMessage: active ? reason : null,
          logOutput: `Kill switch state updated to: ${active ? 'ACTIVE' : 'DISABLED'} by ${updatedBy}`,
        },
      });
    }
  } catch (err) {
    console.warn('[KillSwitch] DB sync warning:', err.message);
  }

  // If activating kill switch, immediately terminate all running processes and mark running logs failed
  if (active) {
    await killAllRunningScrapers(`Emergency Kill Switch activated by ${updatedBy}`);
  }

  return payload;
}

/**
 * Terminates all running scraper processes and updates DB status
 */
export async function killAllRunningScrapers(reason = 'Force terminated by admin') {
  console.log(`[KillSwitch] 🛑 Killing all active scraper processes... Reason: ${reason}`);

  // 1. Kill all registered in-memory processes
  for (const [runId, info] of activeScraperProcesses.entries()) {
    try {
      console.log(`[KillSwitch] Killing registered run ${runId} (PID: ${info.pid})...`);
      killProcessTree(info.pid);
    } catch (_) {}
    activeScraperProcesses.delete(runId);
  }

  // 2. Run OS-level pkill cleanup for rogue/hung processes on Unix/Linux/macOS
  if (process.platform !== 'win32') {
    try {
      exec('pkill -9 -f "dealerdata-scraper/dist/cli" || true', () => {});
      exec('pkill -9 -f "dealerdata-specials/dist/cli" || true', () => {});
      exec('pkill -9 -f "daily_store_scraper_workflow.js" || true', () => {});
      exec('pkill -9 -f "chromium.*dealerdata" || true', () => {});
    } catch (_) {}
  }

  // 3. Update all currently running scraper logs in DB to failed/aborted
  try {
    const updated = await prisma.scraperRunLog.updateMany({
      where: {
        status: 'running',
        runId: { not: 'SYSTEM_KILL_SWITCH' },
      },
      data: {
        status: 'failed',
        errorMessage: reason,
        completedAt: new Date(),
      },
    });
    console.log(`[KillSwitch] Marked ${updated.count} running scraper log(s) as aborted.`);
  } catch (err) {
    console.warn('[KillSwitch] Failed to update running logs in DB:', err.message);
  }

  return { success: true };
}

/**
 * Terminates a single scraper run by its runId
 */
export async function killSingleScraper(runId, reason = 'Terminated by admin') {
  if (!runId) return { success: false, error: 'No runId provided' };

  console.log(`[KillSwitch] Terminating scrape run: ${runId}...`);

  // Kill if registered in memory
  const info = activeScraperProcesses.get(runId);
  if (info) {
    killProcessTree(info.pid);
    activeScraperProcesses.delete(runId);
  }

  // Update DB run log
  try {
    await prisma.scraperRunLog.updateMany({
      where: {
        OR: [{ runId }, { id: runId }],
        status: 'running',
      },
      data: {
        status: 'failed',
        errorMessage: reason,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(`[KillSwitch] Error updating run log for ${runId}:`, err.message);
  }

  return { success: true, runId };
}

/**
 * Resets zombie/stuck jobs that have had status='running' for longer than olderThanMinutes
 */
export async function resetStuckJobs(olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  try {
    const result = await prisma.scraperRunLog.updateMany({
      where: {
        status: 'running',
        startedAt: { lte: cutoff },
        runId: { not: 'SYSTEM_KILL_SWITCH' },
      },
      data: {
        status: 'failed',
        errorMessage: `Execution timed out (> ${olderThanMinutes} minutes without completion). Automatically reset by admin.`,
        completedAt: new Date(),
      },
    });

    console.log(`[KillSwitch] Reset ${result.count} stuck scraper job(s) older than ${olderThanMinutes}m.`);
    return { success: true, resetCount: result.count };
  } catch (err) {
    console.error('[KillSwitch] Error resetting stuck jobs:', err);
    return { success: false, error: err.message };
  }
}
