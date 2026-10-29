"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Diagnostic & Cleanup Script for competitor_vehicle_inventory
 *
 * Usage:
 *   npx ts-node src/scripts/cleanStaleInventory.ts [dealerId]
 *   Example: npx ts-node src/scripts/cleanStaleInventory.ts pomona_kia
 */
async function main() {
    const targetDealer = (process.argv[2] || 'pomona_kia').replace(/^store_/, '').replace(/^comp_/, '');
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '1254879863';
    const database = process.env.DB_NAME || 'dealerdata';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    console.log(`\n======================================================`);
    console.log(`🧹 INVENTORY CLEANUP & DEDUPLICATION: ${targetDealer}`);
    console.log(`   Host: ${host}:${port} | Database: ${database}`);
    console.log(`======================================================\n`);
    let connection = null;
    try {
        connection = await promise_1.default.createConnection({ host, user, password, database, port });
        console.log(`✅ Connected to MySQL successfully.\n`);
        // 1. Check snapshots and counts
        const [snapRows] = await connection.query(`SELECT snapshot_date, dealer_id, COUNT(*) as row_count, COUNT(DISTINCT vin) as unique_vins
       FROM competitor_vehicle_inventory 
       WHERE (dealer_id = ? OR dealer_id = ? OR dealer_id = ?)
       GROUP BY snapshot_date, dealer_id 
       ORDER BY snapshot_date DESC 
       LIMIT 5`, [targetDealer, `store_${targetDealer}`, `comp_${targetDealer}`]);
        console.log(`📊 Recent Snapshots in DB:`);
        console.table(snapRows);
        if (snapRows.length === 0) {
            console.log(`No records found for dealer: ${targetDealer}`);
            return;
        }
        const latestDate = snapRows[0].snapshot_date;
        console.log(`\n🎯 Inspecting latest snapshot: ${latestDate}`);
        // 2. Check for duplicate VINs in the latest snapshot
        const [dupVins] = await connection.query(`SELECT vin, COUNT(*) as count, GROUP_CONCAT(id) as ids, GROUP_CONCAT(dealer_id) as dealers
       FROM competitor_vehicle_inventory
       WHERE (dealer_id = ? OR dealer_id = ? OR dealer_id = ?)
         AND snapshot_date = ?
       GROUP BY vin
       HAVING COUNT(*) > 1`, [targetDealer, `store_${targetDealer}`, `comp_${targetDealer}`, latestDate]);
        if (dupVins.length > 0) {
            console.log(`⚠️ Found ${dupVins.length} duplicate VINs across different IDs/prefixes in snapshot ${latestDate}:`);
            console.table(dupVins.slice(0, 10));
            let prunedDups = 0;
            for (const d of dupVins) {
                const ids = (d.ids || '').split(',');
                // Keep the canonical one (id = inv_${targetDealer}_${vin}) if present, else keep the first one
                const canonicalId = `inv_${targetDealer}_${d.vin}`;
                const toDelete = ids.filter((id) => id !== canonicalId);
                // If none was canonical, keep one, delete the rest
                const deleteIds = toDelete.length === ids.length ? ids.slice(1) : toDelete;
                if (deleteIds.length > 0) {
                    await connection.query(`DELETE FROM competitor_vehicle_inventory WHERE id IN (?)`, [deleteIds]);
                    prunedDups += deleteIds.length;
                }
            }
            console.log(`✅ Pruned ${prunedDups} duplicate rows from snapshot ${latestDate}.\n`);
        }
        else {
            console.log(`✅ Zero duplicate VINs found in snapshot ${latestDate}.\n`);
        }
        // 3. Final summary
        const [finalCount] = await connection.query(`SELECT COUNT(*) as total_rows, COUNT(DISTINCT vin) as total_vins
       FROM competitor_vehicle_inventory
       WHERE (dealer_id = ? OR dealer_id = ? OR dealer_id = ?)
         AND snapshot_date = ?`, [targetDealer, `store_${targetDealer}`, `comp_${targetDealer}`, latestDate]);
        console.log(`🏁 Snapshot ${latestDate} Final State:`);
        console.table(finalCount);
    }
    catch (err) {
        console.error(`❌ Cleanup failed:`, err.message);
    }
    finally {
        if (connection)
            await connection.end();
    }
}
main().catch(console.error);
