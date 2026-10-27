import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
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
 */
async function fixJsonOutputFiles(outputDir: string) {
  if (!fs.existsSync(outputDir)) {
    console.log(`Directory ${outputDir} does not exist. Skipping JSON file fix.`);
    return;
  }

  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json') && f.startsWith('listings_'));
  console.log(`\n📂 Found ${files.length} JSON listing files in ${outputDir}`);

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

  console.log(`\n🎉 JSON Fix Complete: ${totalVehiclesFixed} vehicle listings fixed across ${totalFilesUpdated} files.`);
}

async function fixMySQLDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '1254879863';
  const database = process.env.DB_NAME || 'dealerdata';
  const port = parseInt(process.env.DB_PORT || '3306', 10);

  console.log(`\n🔌 Connecting to MySQL database ${database} at ${host}:${port}...`);

  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection({ host, user, password, database, port });
    console.log(`Connected successfully to database.`);

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

    console.log(`🎉 Database Fix Complete: Updated ${fixedCount} records with normalized model & trim.`);
  } catch (err: any) {
    console.warn(`⚠️ MySQL Database fix skipped/failed: ${err.message}`);
  } finally {
    if (connection) await connection.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const outputDir = path.join(__dirname, '../../output');

  console.log(`=======================================================`);
  console.log(`🛠️  POST-SCRAPE INVENTORY NORMALIZATION WORKFLOW`);
  console.log(`=======================================================`);

  const skipDb = args.includes('--no-db');
  const skipJson = args.includes('--no-json');

  if (!skipJson) {
    await fixJsonOutputFiles(outputDir);
  }

  if (!skipDb) {
    await fixMySQLDatabase();
  }

  console.log(`\n✅ Normalization workflow finished successfully.\n`);
}

main().catch(err => {
  console.error('Fatal error running inventory fix workflow:', err);
  process.exit(1);
});
