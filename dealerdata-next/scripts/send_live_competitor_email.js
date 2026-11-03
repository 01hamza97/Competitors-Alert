import { PrismaClient } from '@prisma/client';
import { buildCompetitorSnapshotHtml } from '../src/lib/competitorEmailBuilder.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

async function main() {
  const storeQuery = getArg('--store') || (!process.argv[2]?.startsWith('--') ? process.argv[2] : null);
  const toEmail = getArg('--to') || (!process.argv[3]?.startsWith('--') && !process.argv[2]?.startsWith('--') ? process.argv[3] : null) || process.env.TEST_EMAIL_TO;
  const targetDate = getArg('--date') || null;
  const apiKey = process.env.RESEND_API_KEY || getArg('--key');

  if (!storeQuery) {
    console.log('Available stores in database:');
    const stores = await prisma.store.findMany({
      select: { id: true, name: true, dealershipKey: true },
      orderBy: { name: 'asc' },
    });
    stores.forEach(s => console.log(`  - "${s.name}" (key: ${s.dealershipKey}, id: ${s.id})`));
    console.log('\nUsage:');
    console.log('  node scripts/send_live_competitor_email.js --store "Aaron Kia" --to you@example.com [--date 2026-11-03] [--key re_...]');
    return;
  }

  console.log(`\n======================================================`);
  console.log(` Generating CompetiTracker Live Snapshot Email`);
  console.log(` Target Store: ${storeQuery}`);
  console.log(` Recipient:    ${toEmail || '(Preview only, no --to provided)'}`);
  console.log(`======================================================\n`);

  const html = await buildCompetitorSnapshotHtml({
    storeName: storeQuery,
    storeKey: storeQuery,
    date: targetDate,
  });

  console.log(`Generated live HTML (${html.length} bytes).`);

  if (toEmail) {
    if (!apiKey) {
      console.error('\nMissing RESEND_API_KEY in environment or --key.');
      console.error('Please pass --key re_... or set RESEND_API_KEY in your .env file.');
      process.exit(1);
    }

    const fromAddress = process.env.RESEND_FROM || 'CompetiTracker <reports@mktgtrends.com>';
    console.log(`Sending email to ${toEmail} via Resend...`);

    let res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        reply_to: 'hello@mktgtrends.com',
        to: [toEmail],
        subject: `CompetiTracker Daily Snapshot - ${storeQuery}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.message && err.message.toLowerCase().includes('domain') && !fromAddress.includes('resend.dev')) {
        console.warn('Custom domain not verified yet. Retrying via onboarding@resend.dev...');
        res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CompetiTracker <onboarding@resend.dev>',
            to: [toEmail],
            subject: `CompetiTracker Daily Snapshot - ${storeQuery}`,
            html,
          }),
        });
      }
    }

    const data = await res.json();
    if (!res.ok) {
      console.error('Failed to send via Resend:', data);
      process.exit(1);
    }

    console.log('\n Email sent successfully!');
    console.log(' Resend Email ID:', data.id);
  } else {
    // Save preview to disk
    const previewFile = path.resolve(__dirname, '../../scratch/live_email_preview.html');
    import('fs').then(fs => {
      fs.mkdirSync(path.dirname(previewFile), { recursive: true });
      fs.writeFileSync(previewFile, html, 'utf8');
      console.log(`\n Saved live email preview to:\n ${previewFile}`);
      console.log(`\n To open in browser:\n open ${previewFile}`);
    });
  }
}

main()
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
