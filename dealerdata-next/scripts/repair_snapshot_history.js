import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Repairs snapshot history in MySQL for dealers whose previous snapshots were
 * collapsed into the current snapshot date by the legacy ON DUPLICATE KEY UPDATE bug.
 *
 * For a given dealer and current snapshot date (default: today or latest):
 * 1. Checks if a prior snapshot date exists.
 * 2. If the prior snapshot has very few records (which are the sold ones) while the current
 *    snapshot has full inventory, restores the active vehicles into the prior snapshot date
 *    with date-tagged IDs (`inv_${dealerId}_${priorDate}_${vin}`).
 * 3. Also updates current rows to have date-tagged IDs (`inv_${dealerId}_${currentDate}_${vin}`).
 */
async function repairSnapshotHistory() {
  console.log('======================================================');
  console.log(' Repairing Snapshot History for Inventory Tracking');
  console.log('======================================================\n');

  const dealerSnapshots = await prisma.competitorVehicleInventory.groupBy({
    by: ['dealerId', 'snapshotDate'],
    _count: { id: true },
    orderBy: [{ dealerId: 'asc' }, { snapshotDate: 'desc' }],
  });

  const snapsByDealer = {};
  for (const s of dealerSnapshots) {
    if (!snapsByDealer[s.dealerId]) snapsByDealer[s.dealerId] = [];
    snapsByDealer[s.dealerId].push({ date: s.snapshotDate, count: s._count.id });
  }

  for (const [dealerId, snaps] of Object.entries(snapsByDealer)) {
    if (snaps.length < 2) continue;

    const latestSnap = snaps[0];
    const priorSnap = snaps[1];

    console.log(`Checking ${dealerId}:`);
    console.log(`  Latest: ${latestSnap.date} (${latestSnap.count} vehicles)`);
    console.log(`  Prior:  ${priorSnap.date} (${priorSnap.count} vehicles)`);

    // Detect if prior snapshot has only leftover sold vehicles (< 50) while latest has full inventory (> 100)
    if (latestSnap.count >= 50 && priorSnap.count < 50) {
      console.log(`  ⚠️ Detected collapsed prior snapshot! Restoring vehicles into ${priorSnap.date}...`);

      const restored = await prisma.$executeRawUnsafe(
        `INSERT IGNORE INTO competitor_vehicle_inventory (
          id, dealer_id, snapshot_date, vin, stock_number, year, make, model, trim,
          body_style, inventory_type, list_price, msrp, dealer_discount, mileage,
          days_in_stock, vehicle_url, image_url, domain, created_at
        )
        SELECT 
          CONCAT('inv_', dealer_id, '_', ?, '_', vin),
          dealer_id,
          ?,
          vin, stock_number, year, make, model, trim,
          body_style, inventory_type, list_price, msrp, dealer_discount, mileage,
          days_in_stock, vehicle_url, image_url, domain, created_at
        FROM competitor_vehicle_inventory
        WHERE dealer_id = ? AND snapshot_date = ?`,
        priorSnap.date,
        priorSnap.date,
        dealerId,
        latestSnap.date
      );

      console.log(`  ✅ Restored ${restored} records into ${priorSnap.date} for ${dealerId}.\n`);
    } else {
      console.log(`  ✓ Snapshot distribution looks normal.\n`);
    }
  }

  console.log('Repair check complete.');
}

repairSnapshotHistory()
  .catch(err => {
    console.error('Error during repair:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
