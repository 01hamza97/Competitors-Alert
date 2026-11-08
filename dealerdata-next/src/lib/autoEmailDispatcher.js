import prisma from './prisma.js';
import { buildCompetitorSnapshotHtml } from './competitorEmailBuilder.js';
import { handleSendPreviewEmail } from './functionsBackend.js';

export const MANDATORY_MONITOR_EMAILS = [
  'emailsampark@gmail.com',
  'mtalha.management@gmail.com',
  'hamza1.00074@gmail.com',
];

/**
 * Resolves all recipient emails for a given store:
 * 1. Store managers and assigned users from MySQL database
 * 2. GM email addresses attached to the store
 * 3. Mandatory monitoring emails requested by administration
 */
export async function getStoreRecipients(storeId) {
  const recipientSet = new Set(MANDATORY_MONITOR_EMAILS.map((e) => e.toLowerCase().trim()));

  const cleanStoreKey = storeId.replace(/^store_/, '');

  try {
    // 1. Fetch store details
    const store = await prisma.store.findFirst({
      where: {
        OR: [
          { id: storeId },
          { id: `store_${cleanStoreKey}` },
          { dealershipKey: cleanStoreKey },
          { scraperStoreId: cleanStoreKey },
        ],
      },
    });

    if (store) {
      // 2. Fetch users assigned to this store from database (GMs, Managers, Admins)
      const users = await prisma.user.findMany({
        where: { competitorReportEnabled: { not: false } },
        select: { email: true, storeIds: true, role: true },
      });

      for (const u of users) {
        const assigned = (u.storeIds || '').split(',').map((s) => s.trim().replace(/^store_/, ''));
        if (
          assigned.includes(cleanStoreKey) ||
          assigned.includes(store.id) ||
          u.role === 'admin'
        ) {
          const clean = (u.email || '').trim().toLowerCase();
          if (clean && !clean.includes('example.com')) {
            recipientSet.add(clean);
          }
        }
      }

      // 3. Fetch pending users assigned to this store
      const pendingUsers = await prisma.pendingUser.findMany({
        select: { email: true, storeIds: true },
      });

      for (const p of pendingUsers) {
        const assigned = (p.storeIds || '').split(',').map((s) => s.trim().replace(/^store_/, ''));
        if (assigned.includes(cleanStoreKey) || assigned.includes(store.id)) {
          const clean = (p.email || '').trim().toLowerCase();
          if (clean && !clean.includes('example.com')) {
            recipientSet.add(clean);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[AutoEmail] Note while fetching store recipients:`, err.message);
  }

  return Array.from(recipientSet);
}

/**
 * Dispatches the CompetiTracker Daily Snapshot email for a completed store scrape
 */
export async function dispatchStoreSnapshotEmail({ storeId, snapshotDate }) {
  console.log(`\n======================================================`);
  console.log(`✉️  [Auto Email] Preparing Daily Snapshot Email for store: ${storeId}`);
  console.log(`======================================================`);

  try {
    const cleanStoreKey = storeId.replace(/^store_/, '');

    const store = await prisma.store.findFirst({
      where: {
        OR: [
          { id: storeId },
          { id: `store_${cleanStoreKey}` },
          { dealershipKey: cleanStoreKey },
          { scraperStoreId: cleanStoreKey },
        ],
      },
      include: { competitors: true },
    });

    if (!store) {
      console.error(`[Auto Email] Cannot send email: Store not found for "${storeId}"`);
      return { success: false, error: 'Store not found' };
    }

    const recipients = await getStoreRecipients(store.id);

    console.log(`[Auto Email] Target Store: "${store.name}"`);
    console.log(`[Auto Email] Snapshot Date: ${snapshotDate || 'Latest available'}`);
    console.log(`[Auto Email] Recipients (${recipients.length}):\n  - ${recipients.join('\n  - ')}`);

    // Build the full HTML template with live database data
    const html = await buildCompetitorSnapshotHtml({
      storeId: store.id,
      storeName: store.name,
      storeKey: store.dealershipKey,
      date: snapshotDate,
    });

    const displayDate = snapshotDate
      ? new Date(snapshotDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const subject = `CompetiTracker Daily Snapshot - ${store.name} - ${displayDate}`;

    // Send email via Resend
    const sendResult = await handleSendPreviewEmail({
      to: recipients,
      subject,
      html,
    });

    if (sendResult?.simulated) {
      console.log(`ℹ️  [Auto Email] Email sending simulated (RESEND_API_KEY not configured locally).`);
    } else {
      console.log(`✅ [Auto Email] Email sent successfully to ${recipients.length} recipients!`);
    }

    return {
      success: true,
      storeName: store.name,
      recipients,
      sendResult,
    };
  } catch (err) {
    console.error(`❌ [Auto Email] Failed to send snapshot email:`, err.message);
    return { success: false, error: err.message };
  }
}
