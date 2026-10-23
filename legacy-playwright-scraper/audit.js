import axios from "axios";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const alertEmail = "hello@mktgtrends.com";

const today = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

async function query(sql) {
  const res = await axios.post(
    `${supabaseUrl}/rest/v1/rpc/execute_sql`,
    { query: sql },
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      }
    }
  );
  return res.data;
}

async function getRows(table, filters) {
  const params = new URLSearchParams(filters);
  const res = await axios.get(
    `${supabaseUrl}/rest/v1/${table}?${params.toString()}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    }
  );
  return res.data;
}

async function sendAlert(issues) {
  const rows = issues.map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#333">${i.store}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666">${i.competitor}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#e53e3e">${i.issue}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888">${i.detail}</td>
    </tr>
  `).join("");

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#1a1a2e;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">⚠️ MKTG Trends — Scraper Audit Alert</h2>
        <p style="color:#aaa;margin:4px 0 0;font-size:13px">${today} — ${issues.length} issue${issues.length > 1 ? "s" : ""} detected</p>
      </div>
      <div style="background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;padding:0">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f7f7f7">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase">Store</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase">Dealer</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase">Issue</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;text-transform:uppercase">Detail</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p style="color:#aaa;font-size:12px;margin-top:16px">
        Check the <a href="https://app.base44.com/apps/69d7e569248b60d0af8b8ec0" style="color:#667eea">Base44 dashboard</a> 
        or <a href="https://github.com/mktgtrends/mktgtrends-competitor-scraper/actions" style="color:#667eea">GitHub Actions</a> for details.
      </p>
    </div>
  `;

  await axios.post(
    "https://api.resend.com/emails",
    {
      from: "MKTG Trends Scraper <alerts@mktgtrends.com>",
      to: alertEmail,
      subject: `⚠️ Scraper Alert — ${issues.length} issue${issues.length > 1 ? "s" : ""} detected (${today})`,
      html
    },
    {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  console.log(`Alert email sent — ${issues.length} issues reported.`);
}

async function runAudit() {
  const issues = [];

  // 1. Get today's inventory summary
  const todayRows = await getRows("competitor_inventory_pricing", {
    "snapshot_date": `eq.${today}`,
    "inventory_type": "eq.new",
    "select": "dealer_id,client_dealer_name,competitor_id,competitor_dealer_name,inventory_count,low_price"
  });

  // 2. Get yesterday's summary for comparison
  const yesterdayRows = await getRows("competitor_inventory_pricing", {
    "snapshot_date": `eq.${yesterday}`,
    "inventory_type": "eq.new",
    "select": "dealer_id,competitor_id,competitor_dealer_name,inventory_count,low_price"
  });

  if (!todayRows.length) {
    issues.push({
      store: "ALL STORES",
      competitor: "—",
      issue: "No data today",
      detail: `No rows found in competitor_inventory_pricing for ${today}`
    });
    await sendAlert(issues);
    return;
  }

  // Group today by dealer_id + competitor_id
  const todayMap = {};
  for (const row of todayRows) {
    const key = `${row.dealer_id}||${row.competitor_id}`;
    if (!todayMap[key]) {
      todayMap[key] = {
        dealer_id: row.dealer_id,
        client_dealer_name: row.client_dealer_name,
        competitor_id: row.competitor_id,
        competitor_dealer_name: row.competitor_dealer_name,
        total_count: 0,
        priced_count: 0,
        total_rows: 0
      };
    }
    todayMap[key].total_count += Number(row.inventory_count || 0);
    todayMap[key].total_rows += 1;
    if (row.low_price) todayMap[key].priced_count += 1;
  }

  // Group yesterday by dealer_id + competitor_id
  const yesterdayMap = {};
  for (const row of yesterdayRows) {
    const key = `${row.dealer_id}||${row.competitor_id}`;
    if (!yesterdayMap[key]) {
      yesterdayMap[key] = { total_count: 0, priced_count: 0, total_rows: 0 };
    }
    yesterdayMap[key].total_count += Number(row.inventory_count || 0);
    yesterdayMap[key].total_rows += 1;
    if (row.low_price) yesterdayMap[key].priced_count += 1;
  }

  // Run checks for each dealer scraped today
  for (const [key, today_data] of Object.entries(todayMap)) {
    const yesterday_data = yesterdayMap[key];
    const label = today_data.competitor_dealer_name;
    const store = today_data.client_dealer_name;

    // CHECK 1: Zero inventory
    if (today_data.total_count === 0) {
      issues.push({
        store,
        competitor: label,
        issue: "Zero inventory",
        detail: `0 vehicles scraped today. Had ${yesterday_data?.total_count ?? "unknown"} yesterday.`
      });
      continue;
    }

    // CHECK 2: Count dropped more than 30% vs yesterday
    if (yesterday_data && yesterday_data.total_count > 10) {
      const drop = (yesterday_data.total_count - today_data.total_count) / yesterday_data.total_count;
      if (drop > 0.30) {
        issues.push({
          store,
          competitor: label,
          issue: "Count dropped >30%",
          detail: `Yesterday: ${yesterday_data.total_count} → Today: ${today_data.total_count} (${Math.round(drop * 100)}% drop)`
        });
      }
    }

    // CHECK 3: Pricing not being recorded for client stores
    // Only check client stores (competitor_id === dealer_id) and DI/AutoFi platforms that should have pricing
    if (today_data.competitor_id === today_data.dealer_id) {
      const priceRate = today_data.priced_count / today_data.total_rows;
      if (today_data.total_rows > 10 && priceRate < 0.5) {
        issues.push({
          store,
          competitor: label,
          issue: "Pricing missing",
          detail: `Only ${Math.round(priceRate * 100)}% of rows have pricing. ${today_data.priced_count} of ${today_data.total_rows} rows priced.`
        });
      }
    }

    // CHECK 4: Competitor count spiked more than 50% vs yesterday (could indicate location filter broke)
    if (yesterday_data && yesterday_data.total_count > 10) {
      const spike = (today_data.total_count - yesterday_data.total_count) / yesterday_data.total_count;
      if (spike > 0.50) {
        issues.push({
          store,
          competitor: label,
          issue: "Count spiked >50%",
          detail: `Yesterday: ${yesterday_data.total_count} → Today: ${today_data.total_count} (${Math.round(spike * 100)}% increase — possible location filter issue)`
        });
      }
    }
  }

  // CHECK 5: Any store from yesterday completely missing today (scrape didn't run)
  const todayDealerIds = new Set(Object.values(todayMap).map(d => d.dealer_id));
  const yesterdayDealerIds = new Set(Object.keys(yesterdayMap).map(k => k.split("||")[0]));

  for (const dealer_id of yesterdayDealerIds) {
    if (!todayDealerIds.has(dealer_id)) {
      issues.push({
        store: dealer_id,
        competitor: "—",
        issue: "Scrape didn't run",
        detail: `No data found for today. Check GitHub Actions for failed run.`
      });
    }
  }

  if (issues.length === 0) {
    console.log(`Audit complete — no issues found for ${today}.`);
    return;
  }

  console.log(`Audit found ${issues.length} issue(s). Sending alert...`);
  issues.forEach(i => console.log(` - [${i.store}] ${i.competitor}: ${i.issue} — ${i.detail}`));
  await sendAlert(issues);
}

runAudit().catch(err => {
  console.error("Audit script failed:", err.message);
  process.exit(1);
});
