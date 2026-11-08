import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleTrigger(request);
}

export async function POST(request) {
  return handleTrigger(request);
}

async function handleTrigger(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key') || request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET || 'dealerdata_daily_cron_secret';

    if (key !== expectedSecret && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
    }

    const store = searchParams.get('store');
    const all = searchParams.get('all') === 'true';

    const scriptPath = path.join(process.cwd(), 'scripts', 'daily_store_scraper_workflow.js');
    const args = [scriptPath];

    if (store) args.push('--store', store);
    if (all) args.push('--all');

    // Launch detached in background so HTTP request returns quickly
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.unref();

    return NextResponse.json({
      success: true,
      message: 'Automated scraper workflow initiated in background.',
      params: { store: store || null, all },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

