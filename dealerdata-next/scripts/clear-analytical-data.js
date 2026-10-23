import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearData() {
  console.log('🧹 Starting cleanup of analytical and operational data...');

  const deletedLeads = await prisma.dailyLeadPerformance.deleteMany({});
  console.log(`✅ Cleared daily_lead_performance: ${deletedLeads.count} rows removed`);

  const deletedAppts = await prisma.appointmentSnapshot.deleteMany({});
  console.log(`✅ Cleared appointment_snapshots: ${deletedAppts.count} rows removed`);

  const deletedActivity = await prisma.dailySalespersonActivity.deleteMany({});
  console.log(`✅ Cleared daily_salesperson_activity: ${deletedActivity.count} rows removed`);

  const deletedPricing = await prisma.competitorInventoryPricing.deleteMany({});
  console.log(`✅ Cleared competitor_inventory_pricing: ${deletedPricing.count} rows removed`);

  const deletedInventory = await prisma.competitorVehicleInventory.deleteMany({});
  console.log(`✅ Cleared competitor_vehicle_inventory: ${deletedInventory.count} rows removed`);

  const deletedVehicleSpecials = await prisma.competitorVehicleSpecial.deleteMany({});
  console.log(`✅ Cleared competitor_vehicle_specials: ${deletedVehicleSpecials.count} rows removed`);

  const deletedServiceSpecials = await prisma.competitorServiceSpecial.deleteMany({});
  console.log(`✅ Cleared competitor_service_specials: ${deletedServiceSpecials.count} rows removed`);

  const deletedStaging = await prisma.specialsStaging.deleteMany({});
  console.log(`✅ Cleared specials_staging: ${deletedStaging.count} rows removed`);

  const deletedNotifications = await prisma.notification.deleteMany({});
  console.log(`✅ Cleared notifications: ${deletedNotifications.count} rows removed`);

  console.log('\n✨ Database is now fresh and clean for incoming N8N workflows & scrapers!');
  console.log('📌 Preserved: Users, Sessions, Roles, Dealer Groups, Stores, Competitors, and Lead Groupings.');

  await prisma.$disconnect();
}

clearData().catch((e) => {
  console.error('Error clearing data:', e);
  process.exit(1);
});
