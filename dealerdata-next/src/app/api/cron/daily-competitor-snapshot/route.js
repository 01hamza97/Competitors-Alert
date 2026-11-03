import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildCompetitorSnapshotHtml } from '@/lib/competitorEmailBuilder';
import { handleSendPreviewEmail } from '@/lib/functionsBackend';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleCronDispatch(request);
}

export async function POST(request) {
  return handleCronDispatch(request);
}

async function handleCronDispatch(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key') || request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET || 'dealerdata_daily_cron_secret';

    if (key !== expectedSecret && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
    }

    const stores = await prisma.store.findMany({
      include: { competitors: true },
      orderBy: { name: 'asc' },
    });

    const users = await prisma.user.findMany({
      select: { email: true, storeIds: true },
    });
    const pendingUsers = await prisma.pendingUser.findMany({
      select: { email: true, storeIds: true },
    });

    const results = [];

    for (const store of stores) {
      if (!store.competitors || store.competitors.length === 0) continue;

      const recipientSet = new Set();
      if (store.gmEmails) {
        store.gmEmails.split(',').forEach(e => {
          const clean = e.trim().toLowerCase();
          if (clean) recipientSet.add(clean);
        });
      }

      [...users, ...pendingUsers].forEach(u => {
        const assignedStores = (u.storeIds || '').split(',').map(s => s.trim()).filter(Boolean);
        if (assignedStores.includes(store.id)) {
          const clean = u.email?.trim().toLowerCase();
          if (clean) recipientSet.add(clean);
        }
      });

      const recipients = [...recipientSet];
      if (recipients.length === 0) continue;

      try {
        const html = await buildCompetitorSnapshotHtml({
          storeId: store.id,
          storeName: store.name,
          storeKey: store.dealershipKey,
        });

        const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const subject = `CompetiTracker Daily Snapshot - ${store.name} - ${todayStr}`;

        const sendRes = await handleSendPreviewEmail({
          to: recipients,
          subject,
          html,
        });

        results.push({
          store: store.name,
          recipients: recipients.length,
          success: true,
          ...sendRes,
        });
      } catch (err) {
        results.push({
          store: store.name,
          recipients: recipients.length,
          success: false,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      stores: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron daily-competitor-snapshot] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
