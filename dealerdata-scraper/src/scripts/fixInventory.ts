import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import axios from 'axios';
import dotenv from 'dotenv';
import { normalizeVehicle } from '../utils/vehicleNormalization';
import { VehicleListing } from '../types';

dotenv.config();

/**
 * Post-scrape Inventory Normalization Workflow
 *
 * Can fix:
 * 1. Existing JSON files in the output/ directory
 * 2. Existing records in MySQL database (competitor_vehicle_inventory)
 * 3. Existing records in Supabase database (competitor_inventory_pricing)
 */

async function fixJsonOutputFiles(outputDir: string) {
  if (!fs.existsSync(outputDir)) {
    console.log(`Directory ${outputDir} does not exist. Skipping JSON file fix.`);
    return;
  }

  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json') && f.startsWith('listings_'));
  console.log(`\n📂 [1/3 JSON Files] Found ${files.length} JSON listing files in ${outputDir}`);

  let totalFilesUpdated = 0;
  let totalVehiclesFixed = 0;

  for (const file of files) {
    const fullPath = path.join(outputDir, file);
    try {
      const rawContent = fs.readFileSync(fullPath, 'utf-8');
      const listings: VehicleListing[] = JSON.parse(rawContent);
      let changedInFile = 0;

      const normalizedListings = listings.map(item => {
        const fixed = normalizeVehicle(item);
        if (
          fixed.make !== item.make ||
          fixed.model !== item.model ||
          fixed.trim !== item.trim
        ) {
          changedInFile++;
        }
        return fixed;
      });

      if (changedInFile > 0) {
        fs.writeFileSync(fullPath, JSON.stringify(normalizedListings, null, 2), 'utf-8');
        console.log(`  ✅ Fixed ${changedInFile} vehicles in: ${file}`);
        totalFilesUpdated++;
        totalVehiclesFixed += changedInFile;
      }
    } catch (err: any) {
      console.warn(`  ⚠️ Could not process ${file}:`, err.message);
    }
  }

  console.log(`🎉 JSON Fix Complete: ${totalVehiclesFixed} vehicle listings fixed across ${totalFilesUpdated} files.`);
}

async function fixMySQLDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '1254879863';
  const database = process.env.DB_NAME || 'dealerdata';
  const port = parseInt(process.env.DB_PORT || '3306', 10);

  console.log(`\n🔌 [2/3 MySQL Database] Connecting to MySQL database ${database} at ${host}:${port}...`);

  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({ host, user, password, database, port });
    console.log(`Connected successfully to MySQL.`);

    const [rows] = await connection.query(
      'SELECT id, make, model, trim, vehicle_url FROM competitor_vehicle_inventory'
    ) as [any[], any];

    console.log(`Fetched ${rows.length} total inventory records from competitor_vehicle_inventory.`);

    let fixedCount = 0;
    for (const r of rows) {
      const normalized = normalizeVehicle({
        make: r.make,
        model: r.model,
        trim: r.trim,
        vehicleUrl: r.vehicle_url,
      });

      if (
        normalized.make !== r.make ||
        normalized.model !== r.model ||
        (normalized.trim || null) !== (r.trim || null)
      ) {
        await connection.execute(
          'UPDATE competitor_vehicle_inventory SET make = ?, model = ?, trim = ? WHERE id = ?',
          [normalized.make, normalized.model, normalized.trim || null, r.id]
        );
        fixedCount++;
      }
    }

    console.log(`🎉 MySQL Fix Complete: Updated ${fixedCount} records with normalized model & trim.`);
  } catch (err: any) {
    console.log(`ℹ️ MySQL skipped: ${err.message}`);
  } finally {
    if (connection) await connection.end();
  }
}

async function fixSupabaseDatabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log(`\nℹ️ [3/3 Supabase Database] SUPABASE_URL or SUPABASE_KEY not configured. Skipping Supabase.`);
    return;
  }

  console.log(`\n🔌 [3/3 Supabase Database] Connecting to Supabase at ${supabaseUrl}...`);
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };

  try {
    const PAGE_SIZE = 1000;
    let offset = 0;
    let totalChecked = 0;
    let totalUpdated = 0;

    while (true) {
      const fetchUrl = `${supabaseUrl}/rest/v1/competitor_inventory_pricing?select=id,make,model,trim,raw_title,vehicle_url&limit=${PAGE_SIZE}&offset=${offset}`;
      const res = await axios.get(fetchUrl, { headers });
      const rows = res.data || [];
      if (rows.length === 0) break;

      totalChecked += rows.length;

      for (const r of rows) {
        const normalized = normalizeVehicle({
          make: r.make,
          model: r.model,
          trim: r.trim,
          vehicleUrl: r.vehicle_url,
        });

        // Also check if raw_title has hybrid keywords for Hyundai
        let finalModel = normalized.model;
        if (normalized.make === 'Hyundai' && finalModel === 'Santa Fe') {
          if (/\bhybrid\b/i.test(`${r.trim || ''} ${r.raw_title || ''}`)) {
            finalModel = 'Santa Fe Hybrid';
          }
        }

        if (
          normalized.make !== r.make ||
          finalModel !== r.model ||
          (normalized.trim || null) !== (r.trim || null)
        ) {
          const patchUrl = `${supabaseUrl}/rest/v1/competitor_inventory_pricing?id=eq.${r.id}`;
          await axios.patch(
            patchUrl,
            {
              make: normalized.make,
              model: finalModel,
              trim: normalized.trim || null,
            },
            { headers }
          );
          totalUpdated++;
        }
      }

      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    console.log(`🎉 Supabase Fix Complete: Checked ${totalChecked} rows, updated ${totalUpdated} rows in competitor_inventory_pricing.`);
  } catch (err: any) {
    console.warn(`⚠️ Supabase fix error: ${err.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const outputDir = path.join(__dirname, '../../output');

  console.log(`=======================================================`);
  console.log(`🛠️  POST-SCRAPE INVENTORY NORMALIZATION WORKFLOW`);
  console.log(`=======================================================`);

  const onlyJson = args.includes('--json');
  const onlyMysql = args.includes('--mysql');
  const onlySupabase = args.includes('--supabase');
  const skipDb = args.includes('--no-db');

  if (onlyJson) {
    await fixJsonOutputFiles(outputDir);
  } else if (onlyMysql) {
    await fixMySQLDatabase();
  } else if (onlySupabase) {
    await fixSupabaseDatabase();
  } else {
    // Run all applicable
    await fixJsonOutputFiles(outputDir);
    if (!skipDb) {
      await fixMySQLDatabase();
      await fixSupabaseDatabase();
    }
  }

  console.log(`\n✅ Normalization workflow finished successfully.\n`);
}

main().catch(err => {
  console.error('Fatal error running inventory fix workflow:', err);
  process.exit(1);
});
