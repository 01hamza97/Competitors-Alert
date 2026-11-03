import { PrismaClient } from '@prisma/client';
import { buildCompetitorSnapshotHtml } from '../src/lib/competitorEmailBuilder.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function runDailySnapshotAutomation() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Automation] Missing RESEND_API_KEY. Aborting.');
    process.exit(1);
  }

  const fromAddress = process.env.RESEND_FROM || 'CompetiTracker <reports@mktgtrends.com>';
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://competitoralerts.ai';

  console.log('======================================================');
  console.log(' CompetiTracker Daily Automated Email Dispatch');
  console.log(` Time: ${new Date().toISOString()}`);
  console.log('======================================================\n');

  // 1. Fetch all stores with competitors
  const stores = await prisma.store.findMany({
    include: { competitors: true },
    orderBy: { name: 'asc' },
  });

  // 2. Fetch users and pending users to resolve subscribers
  const users = await prisma.user.findMany({
    select: { email: true, storeIds: true, dealerGroupIds: true },
  });
  const pendingUsers = await prisma.pendingUser.findMany({
    select: { email: true, storeIds: true, dealerGroupIds: true },
  });

  console.log(`Found ${stores.length} store(s) in system.`);

  for (const store of stores) {
    // Only send if store has competitors tracked
    if (!store.competitors || store.competitors.length === 0) {
      console.log(`[Skip] "${store.name}" has 0 tracked competitors.`);
      continue;
    }

    // Resolve recipients: gm_emails + users assigned to store
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
    if (recipients.length === 0) {
      console.log(`[Skip] "${store.name}" has no registered recipients (no GM emails or assigned users).`);
      continue;
    }

    console.log(`\nProcessing "${store.name}":`);
    console.log(`  Competitors: ${store.competitors.length}`);
    console.log(`  Recipients (${recipients.length}): ${recipients.join(', ')}`);

    try {
      const html = await buildCompetitorSnapshotHtml({
        storeId: store.id,
        storeName: store.name,
        storeKey: store.dealershipKey,
        dashboardUrl,
      });

      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const subject = `CompetiTracker Daily Snapshot - ${store.name} - ${todayStr}`;

      let res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          reply_to: 'hello@mktgtrends.com',
          to: recipients,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.message && err.message.toLowerCase().includes('domain') && !fromAddress.includes('resend.dev')) {
          console.warn('  Domain not verified on Resend; retrying via onboarding@resend.dev...');
          res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'CompetiTracker <onboarding@resend.dev>',
              to: recipients,
              subject,
              html,
            }),
          });
        }
      }

      const data = await res.json();
      if (res.ok) {
        console.log(`  SUCCESS! Delivered to ${recipients.length} recipients. Resend ID: ${data.id}`);
      } else {
        console.error(`  FAILED to deliver for "${store.name}":`, data);
      }
    } catch (err) {
      console.error(`  ERROR building email for "${store.name}":`, err.message);
    }
  }

  console.log('\n[Automation] Completed daily snapshot email dispatch run.');
}

runDailySnapshotAutomation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
