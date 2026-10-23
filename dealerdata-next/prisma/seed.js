import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), 'data');

function readJson(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (e) {
    console.error(`Failed to read ${filename}:`, e.message);
    return [];
  }
}

// Generate date strings YYYY-MM-DD
function getDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('🌱 Starting comprehensive database seed into MySQL...');

  // 1. DealerGroups
  const dealerGroups = readJson('DealerGroup.json');
  console.log(`Importing ${dealerGroups.length} Dealer Groups...`);
  for (const group of dealerGroups) {
    await prisma.dealerGroup.upsert({
      where: { id: group.id },
      update: {
        name: group.name,
        slug: group.slug,
        principalName: group.principal_name,
        principalEmails: group.principal_emails,
        isSingleStore: Boolean(group.is_single_store),
      },
      create: {
        id: group.id,
        name: group.name,
        slug: group.slug,
        principalName: group.principal_name,
        principalEmails: group.principal_emails,
        isSingleStore: Boolean(group.is_single_store),
      },
    });
  }

  // 2. Stores
  const stores = readJson('Store.json');
  console.log(`Importing ${stores.length} Stores...`);
  for (const store of stores) {
    await prisma.store.upsert({
      where: { id: store.id },
      update: {
        groupId: store.group_id,
        name: store.name,
        dealershipKey: store.dealership_key,
        scraperStoreId: store.scraper_store_id,
        timezone: store.timezone || 'America/Los_Angeles',
        newInventoryUrl: store.new_inventory_url,
        usedInventoryUrl: store.used_inventory_url,
        scraperPlatform: store.scraper_platform,
        scraperDefaultMake: store.scraper_default_make,
        scraperActive: store.scraper_active !== false,
        active: store.active !== false,
      },
      create: {
        id: store.id,
        groupId: store.group_id,
        name: store.name,
        dealershipKey: store.dealership_key,
        scraperStoreId: store.scraper_store_id,
        timezone: store.timezone || 'America/Los_Angeles',
        newInventoryUrl: store.new_inventory_url,
        usedInventoryUrl: store.used_inventory_url,
        scraperPlatform: store.scraper_platform,
        scraperDefaultMake: store.scraper_default_make,
        scraperActive: store.scraper_active !== false,
        active: store.active !== false,
      },
    });
  }

  // 3. StoreCompetitors
  const competitors = readJson('StoreCompetitor.json');
  console.log(`Importing ${competitors.length} Store Competitors...`);
  for (const comp of competitors) {
    const id = comp.id || `comp_${comp.store_id}_${comp.competitor_id || comp.competitor_key}`;
    const compName = comp.name || comp.competitor_name || id;
    const compKey = comp.competitor_id || comp.competitor_key || id;
    await prisma.storeCompetitor.upsert({
      where: { id },
      update: {
        storeId: comp.store_id,
        competitorName: compName,
        competitorKey: compKey,
        newInventoryUrl: comp.new_inventory_url,
        usedInventoryUrl: comp.used_inventory_url,
        scraperPlatform: comp.scraper_platform,
        active: comp.active !== false,
      },
      create: {
        id,
        storeId: comp.store_id,
        competitorName: compName,
        competitorKey: compKey,
        newInventoryUrl: comp.new_inventory_url,
        usedInventoryUrl: comp.used_inventory_url,
        scraperPlatform: comp.scraper_platform,
        active: comp.active !== false,
      },
    });
  }

  // 4. Users
  const users = readJson('User.json');
  console.log(`Importing ${users.length} Users...`);
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        password: user.password,
        fullName: user.full_name,
        role: user.role || 'user',
        company: user.company,
        plan: user.plan || 'Starter',
        dealerGroupIds: user.dealer_group_ids,
        storeIds: user.store_ids,
      },
      create: {
        id: user.id || undefined,
        email: user.email,
        password: user.password,
        fullName: user.full_name,
        role: user.role || 'user',
        company: user.company,
        plan: user.plan || 'Starter',
        dealerGroupIds: user.dealer_group_ids,
        storeIds: user.store_ids,
      },
    });
  }

  // 5. InternetLeadGroups
  const leadGroups = readJson('InternetLeadGroup.json');
  console.log(`Importing ${leadGroups.length} Internet Lead Groups...`);
  for (const lg of leadGroups) {
    const id = lg.id || `leadgrp_${Date.now()}`;
    const name = lg.group_name || lg.name || id;
    const sources = Array.isArray(lg.sources) ? lg.sources.join(',') : String(lg.raw_sources || lg.sources || '');
    await prisma.internetLeadGroup.upsert({
      where: { id },
      update: {
        groupId: lg.group_id,
        storeId: lg.store_id,
        dealershipKey: lg.dealership_key,
        groupName: name,
        rawSources: sources,
        partyType: lg.party_type || '3rd Party',
        sortOrder: lg.sort_order || 0,
      },
      create: {
        id,
        groupId: lg.group_id,
        storeId: lg.store_id,
        dealershipKey: lg.dealership_key,
        groupName: name,
        rawSources: sources,
        partyType: lg.party_type || '3rd Party',
        sortOrder: lg.sort_order || 0,
      },
    });
  }

  // 6. Operational Data: DailyLeadPerformance (Past 45 days)
  console.log('Generating dynamic DailyLeadPerformance records in MySQL...');
  await prisma.dailyLeadPerformance.deleteMany({});
  const storeKeys = [
    'aaron_ford_escondido',
    'aaron_ford_lake_elsinore',
    'aaron_cdjr',
    'aaron_chevrolet',
    'aaron_kia',
    'geaux_chevrolet',
    'norm_reeves_ford'
  ];

  const sourcesList = [
    { name: 'Dealer.com Website', type: 'Internet', party: '1st Party' },
    { name: 'AutoTrader', type: 'Internet', party: '3rd Party' },
    { name: 'CarGurus', type: 'Internet', party: '3rd Party' },
    { name: 'TrueCar', type: 'Internet', party: '3rd Party' },
    { name: 'Cars.com', type: 'Internet', party: '3rd Party' },
    { name: 'Walk-In', type: 'Walk-In', party: '1st Party' },
    { name: 'Phone Inbound', type: 'Phone', party: '1st Party' },
  ];

  const leadRows = [];
  for (let dayOffset = -45; dayOffset <= 0; dayOffset++) {
    const reportDate = getDateStr(dayOffset);
    for (const dealerId of storeKeys) {
      for (const src of sourcesList) {
        for (const inv of ['New', 'Used']) {
          // Semi-random deterministic volume
          const seed = (dealerId.length + dayOffset + src.name.length) % 7;
          const goodLeads = src.type === 'Internet' ? (seed * 2 + 3) : (seed + 1);
          const apptsSet = Math.max(0, Math.round(goodLeads * 0.45));
          const sold = Math.max(0, Math.round(apptsSet * 0.4));
          const gross = sold * (inv === 'New' ? 3200 : 2400) + (sold > 0 ? 500 : 0);

          leadRows.push({
            dealerId,
            reportDate,
            leadSource: src.name,
            leadType: src.type,
            inventoryType: inv,
            partyType: src.party,
            goodLeads,
            apptsSet,
            sold,
            gross,
          });
        }
      }
    }
  }

  // Chunk insert lead rows
  const chunkSize = 200;
  for (let i = 0; i < leadRows.length; i += chunkSize) {
    await prisma.dailyLeadPerformance.createMany({
      data: leadRows.slice(i, i + chunkSize),
    });
  }
  console.log(`Inserted ${leadRows.length} DailyLeadPerformance rows.`);

  // 7. AppointmentSnapshots
  console.log('Generating dynamic AppointmentSnapshot records in MySQL...');
  await prisma.appointmentSnapshot.deleteMany({});
  const apptCustomers = [
    { name: 'David Miller', sales: 'Marcus Vance', vehicle: 'Ford F-150 Lariat', source: 'Dealer.com Website' },
    { name: 'Jennifer Lopez', sales: 'Elena Rostova', vehicle: 'Ford Explorer XLT', source: 'AutoTrader' },
    { name: 'Robert Chen', sales: 'Marcus Vance', vehicle: 'Ford Bronco Wildtrak', source: 'CarGurus' },
    { name: 'Sarah Williams', sales: 'Tony Stark', vehicle: 'Chevy Silverado 1500', source: 'Dealer.com Website' },
    { name: 'Michael Garcia', sales: 'Elena Rostova', vehicle: 'Jeep Grand Cherokee L', source: 'TrueCar' },
    { name: 'Emily Davis', sales: 'Marcus Vance', vehicle: 'Ford Mustang Mach-E', source: 'Cars.com' },
    { name: 'James Wilson', sales: 'Bruce Wayne', vehicle: 'Kia Telluride SX', source: 'Walk-In' },
    { name: 'Jessica Taylor', sales: 'Tony Stark', vehicle: 'Ford Escape Platinum', source: 'Phone Inbound' },
  ];

  const apptRows = [];
  const snapshotToday = getDateStr(0);
  for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
    const apptDate = getDateStr(dayOffset);
    for (const dealerId of ['aaron_ford_escondido', 'aaron_ford_lake_elsinore', 'aaron_cdjr']) {
      apptCustomers.forEach((cust, idx) => {
        apptRows.push({
          dealerId,
          snapshotDate: snapshotToday,
          appointmentDate: apptDate,
          appointmentTime: `${9 + (idx % 8)}:00`,
          customerName: cust.name,
          salespersonName: cust.sales,
          status: idx % 3 === 0 ? 'Confirmed' : 'Scheduled',
          leadSource: cust.source,
          inventoryType: idx % 2 === 0 ? 'New' : 'Used',
          vehicleInterest: cust.vehicle,
        });
      });
    }
  }
  await prisma.appointmentSnapshot.createMany({ data: apptRows });
  console.log(`Inserted ${apptRows.length} AppointmentSnapshot rows.`);

  // 8. DailySalespersonActivity
  console.log('Generating dynamic DailySalespersonActivity records in MySQL...');
  await prisma.dailySalespersonActivity.deleteMany({});
  const salesReps = [
    'Marcus Vance',
    'Elena Rostova',
    'Tony Stark',
    'Bruce Wayne',
    'Steve Rogers',
    'Natasha Romanoff'
  ];

  const activityRows = [];
  for (let dayOffset = -30; dayOffset <= 0; dayOffset++) {
    const reportDate = getDateStr(dayOffset);
    for (const dealerId of ['aaron_ford_escondido', 'aaron_ford_lake_elsinore', 'aaron_cdjr']) {
      salesReps.forEach((rep, idx) => {
        const calls = 20 + ((idx * 3 + dayOffset) % 15);
        const texts = 15 + ((idx * 2 + dayOffset) % 10);
        const emails = 10 + ((idx + dayOffset) % 8);
        const appts = 2 + (idx % 3);
        const shown = Math.max(1, appts - 1);
        const sold = Math.max(0, idx % 2 === 0 ? 1 : 0);
        activityRows.push({
          dealerId,
          reportDate,
          salespersonName: rep,
          outboundCalls: calls,
          inboundCalls: Math.round(calls * 0.4),
          textMessages: texts,
          emailsSent: emails,
          appointmentsSet: appts,
          appointmentsShown: shown,
          unitsSold: sold,
          totalGross: sold * 2850,
        });
      });
    }
  }
  for (let i = 0; i < activityRows.length; i += chunkSize) {
    await prisma.dailySalespersonActivity.createMany({
      data: activityRows.slice(i, i + chunkSize),
    });
  }
  console.log(`Inserted ${activityRows.length} DailySalespersonActivity rows.`);

  // 9. CompetitorVehicleSpecial
  console.log('Generating dynamic CompetitorVehicleSpecial records in MySQL...');
  await prisma.competitorVehicleSpecial.deleteMany({});
  const specials = [
    {
      dealerId: 'aaron_ford_escondido',
      offerDealerName: 'Encinitas Ford',
      year: 2026,
      make: 'Ford',
      model: 'F-150',
      trim: 'SuperCrew XLT 4x4',
      specialType: 'lease',
      monthlyPayment: 429,
      termMonths: 36,
      downPayment: 3999,
      msrp: 54990,
      title: '2026 Ford F-150 SuperCrew Lease Special',
      disclaimer: '$3,999 due at signing. 10,500 miles/yr. On approved credit.',
      expirationDate: getDateStr(30),
      snapshotDate: snapshotToday,
    },
    {
      dealerId: 'aaron_ford_escondido',
      offerDealerName: 'Ken Grody Ford Carlsbad',
      year: 2026,
      make: 'Ford',
      model: 'Explorer',
      trim: 'Active 4WD',
      specialType: 'lease',
      monthlyPayment: 389,
      termMonths: 36,
      downPayment: 3499,
      msrp: 46250,
      title: '2026 Ford Explorer Active Lease Event',
      disclaimer: '$3,499 due at signing. 36 month lease. Excludes tax and license.',
      expirationDate: getDateStr(30),
      snapshotDate: snapshotToday,
    },
    {
      dealerId: 'aaron_ford_escondido',
      offerDealerName: 'Aaron Ford Escondido',
      year: 2026,
      make: 'Ford',
      model: 'Mustang Mach-E',
      trim: 'Premium AWD',
      specialType: 'finance',
      apr: 1.9,
      termMonths: 60,
      msrp: 48995,
      title: '1.9% APR for 60 Months on Mustang Mach-E',
      disclaimer: 'Ford Credit tier 1 financing. Available on in-stock units.',
      expirationDate: getDateStr(30),
      snapshotDate: snapshotToday,
    },
    {
      dealerId: 'aaron_cdjr',
      offerDealerName: 'Ontario CDJR',
      year: 2026,
      make: 'Jeep',
      model: 'Grand Cherokee',
      trim: 'Laredo 4x4',
      specialType: 'lease',
      monthlyPayment: 459,
      termMonths: 39,
      downPayment: 3999,
      msrp: 43990,
      title: '2026 Jeep Grand Cherokee Lease Special',
      disclaimer: '39 month lease through CCAP. Tier 1 credit.',
      expirationDate: getDateStr(30),
      snapshotDate: snapshotToday,
    },
  ];
  await prisma.competitorVehicleSpecial.createMany({ data: specials });
  console.log(`Inserted ${specials.length} CompetitorVehicleSpecial rows.`);

  // 10. CompetitorServiceSpecial
  console.log('Generating dynamic CompetitorServiceSpecial records in MySQL...');
  await prisma.competitorServiceSpecial.deleteMany({});
  const serviceSpecials = [
    {
      dealerId: 'aaron_ford_escondido',
      offerDealerName: 'Encinitas Ford',
      snapshotDate: snapshotToday,
      title: 'The Works Fuel Saver Package',
      description: 'Synthetic blend oil change, tire rotation, pressure check, brake inspection, multi-point inspection.',
      category: 'Oil Change',
      regularPrice: 89.95,
      specialPrice: 69.95,
      discountAmount: 20.00,
      couponCode: 'WORKS69',
      expirationDate: getDateStr(30),
    },
    {
      dealerId: 'aaron_ford_escondido',
      offerDealerName: 'Ken Grody Ford Carlsbad',
      snapshotDate: snapshotToday,
      title: 'Motorcraft Complete Brake Service',
      description: 'Brake pad replacement and rotor machining per axle.',
      category: 'Brakes',
      regularPrice: 249.95,
      specialPrice: 199.95,
      discountAmount: 50.00,
      couponCode: 'BRAKE50',
      expirationDate: getDateStr(30),
    },
    {
      dealerId: 'aaron_ford_escondido',
      offerDealerName: 'Aaron Ford Escondido',
      snapshotDate: snapshotToday,
      title: 'Computerized 4-Wheel Alignment',
      description: 'Precision laser alignment to factory specifications.',
      category: 'Tires',
      regularPrice: 139.95,
      specialPrice: 99.95,
      discountAmount: 40.00,
      couponCode: 'ALIGN99',
      expirationDate: getDateStr(30),
    },
  ];
  await prisma.competitorServiceSpecial.createMany({ data: serviceSpecials });
  console.log(`Inserted ${serviceSpecials.length} CompetitorServiceSpecial rows.`);

  // 11. CompetitorInventoryPricing
  console.log('Generating dynamic CompetitorInventoryPricing records in MySQL...');
  await prisma.competitorInventoryPricing.deleteMany({});
  const pricingModels = [
    { model: 'F-150', avg: 53400, min: 38900, max: 76500, count: 68 },
    { model: 'Explorer', avg: 45200, min: 36800, max: 59900, count: 42 },
    { model: 'Bronco', avg: 48900, min: 39500, max: 74200, count: 28 },
    { model: 'Escape', avg: 32400, min: 27900, max: 41200, count: 35 },
    { model: 'Super Duty F-250', avg: 66800, min: 49500, max: 92400, count: 31 },
    { model: 'Mustang Mach-E', avg: 47800, min: 39995, max: 62500, count: 19 },
  ];
  const pricingRows = [];
  for (const dealerId of storeKeys) {
    pricingModels.forEach(m => {
      pricingRows.push({
        dealerId,
        competitorId: dealerId,
        snapshotDate: snapshotToday,
        model: m.model,
        trim: 'All Trims',
        inventoryType: 'New',
        avgPrice: m.avg,
        minPrice: m.min,
        maxPrice: m.max,
        count: m.count,
      });
      pricingRows.push({
        dealerId,
        competitorId: dealerId,
        snapshotDate: snapshotToday,
        model: m.model,
        trim: 'Pre-Owned',
        inventoryType: 'Used',
        avgPrice: Math.round(m.avg * 0.72),
        minPrice: Math.round(m.min * 0.65),
        maxPrice: Math.round(m.max * 0.78),
        count: Math.round(m.count * 0.6),
      });
    });
  }
  await prisma.competitorInventoryPricing.createMany({ data: pricingRows });
  console.log(`Inserted ${pricingRows.length} CompetitorInventoryPricing rows.`);

  // 12. SpecialsStaging
  console.log('Generating dynamic SpecialsStaging records in MySQL...');
  await prisma.specialsStaging.deleteMany({});
  const stagingSpecials = [
    {
      dealerId: 'aaron_ford_escondido',
      offerDealerName: 'Encinitas Ford',
      clientDealerName: 'Aaron Ford Escondido',
      snapshotDate: snapshotToday,
      specialType: 'vehicle',
      title: 'Scraped: 2026 Ford Bronco Sport Outer Banks Special',
      details: '$339/mo for 36 mos, $3,299 down. MSRP $37,915.',
      status: 'pending',
      rawText: 'LEASE FOR $339/MO FOR 36 MOS WITH $3,299 DUE AT SIGNING. VIN 3FMCR9C63RRE88219.',
    },
    {
      dealerId: 'aaron_ford_escondido',
      offerDealerName: 'Ken Grody Ford Carlsbad',
      clientDealerName: 'Aaron Ford Escondido',
      snapshotDate: snapshotToday,
      specialType: 'service',
      title: 'Scraped: Cabin Air Filter & Sanitation Package',
      details: '$49.95 Installed with multi-point inspection.',
      status: 'pending',
      rawText: 'Save on clean air for your family: cabin filter replacement $49.95 coupon.',
    },
  ];
  await prisma.specialsStaging.createMany({ data: stagingSpecials });
  console.log(`Inserted ${stagingSpecials.length} SpecialsStaging rows.`);

  // 13. Notifications
  console.log('Generating dynamic Notifications in MySQL...');
  await prisma.notification.deleteMany({});
  const notifications = [
    {
      title: 'Nightly Scrape Completed',
      description: 'Inventory updated for Aaron Ford Escondido (142 new, 89 used).',
      category: 'activity',
      read: false,
      link: '/admin/clients',
    },
    {
      title: 'Daily Performance Email Sent',
      description: 'Morning summary delivered to 12 dealership general managers.',
      category: 'email',
      read: false,
      link: '/email-preview',
    },
    {
      title: 'Lead Source Spurt Detected',
      description: 'AutoTrader lead conversion rose +4.2% over the prior 7 days.',
      category: 'spurt',
      read: true,
      link: '/vendor-performance',
    },
    {
      title: 'Competitor Price Adjustment Alert',
      description: 'Encinitas Ford adjusted lease factor on 2026 F-150 XLT models.',
      category: 'alert',
      read: true,
      link: '/competitor-analysis',
    },
  ];
  await prisma.notification.createMany({ data: notifications });
  console.log(`Inserted ${notifications.length} Notification rows.`);

  console.log('✅ All MySQL operational tables populated successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
