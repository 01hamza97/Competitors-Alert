import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/scraper/[runId]
 * Fetches real-time log output and status for a specific scrape run
 */
export async function GET(request, { params }) {
  try {
    const { runId } = await params;

    const log = await prisma.scraperRunLog.findFirst({
      where: {
        OR: [{ runId: runId }, { id: runId }],
      },
    });

    if (!log) {
      return NextResponse.json({ success: false, error: 'Run log not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      log,
    });
  } catch (error) {
    console.error('[API /api/scraper/[runId]] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
