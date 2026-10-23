import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '@/lib/supabase';

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data if files do not exist
const SEED_DATA = {
  DealerGroup: [
    {
      id: 'grp_aaron',
      name: 'Aaron Automotive Group',
      slug: 'aaron_automotive_group',
      principal_name: 'Aaron Automotive Group',
      principal_emails: 'reports@aaronautogroup.com',
      is_single_store: false,
    },
    {
      id: 'grp_geaux',
      name: 'Geaux Chevrolet',
      slug: 'geaux_chevrolet',
      principal_name: 'Geaux Automotive',
      principal_emails: 'gm@geauxchevrolet.com',
      is_single_store: true,
    },
    {
      id: 'grp_norm_reeves',
      name: 'Norm Reeves',
      slug: 'norm_reeves',
      principal_name: 'Norm Reeves Auto',
      principal_emails: 'gm@normreeves.com',
      is_single_store: true,
    }
  ],
  Store: [
    {
      id: 'store_aaron_ford_escondido',
      group_id: 'grp_aaron',
      name: 'Aaron Ford Escondido',
      dealership_key: 'aaron_ford_escondido',
      scraper_store_id: 'aaron_ford_escondido',
      timezone: 'America/Los_Angeles',
      new_inventory_url: 'https://www.aaronfordescondido.com/new-vehicles/new-vehicle-specials/',
      used_inventory_url: 'https://www.aaronfordescondido.com/used-vehicles/',
      scraper_platform: 'dealercom',
      scraper_default_make: 'Ford',
      scraper_active: true,
      active: true,
    },
    {
      id: 'store_aaron_ford_lake_elsinore',
      group_id: 'grp_aaron',
      name: 'Aaron Ford Lake Elsinore',
      dealership_key: 'aaron_ford_lake_elsinore',
      scraper_store_id: 'aaron_ford_lake_elsinore',
      timezone: 'America/Los_Angeles',
      new_inventory_url: 'https://www.aaronfordlakeelsinore.com/new-vehicles/new-vehicle-specials/',
      scraper_platform: 'dealercom',
      scraper_default_make: 'Ford',
      scraper_active: true,
      active: true,
    },
    {
      id: 'store_aaron_cdjr',
      group_id: 'grp_aaron',
      name: 'Aaron CDJR',
      dealership_key: 'aaron_cdjr',
      scraper_store_id: 'aaron_cdjr',
      timezone: 'America/Los_Angeles',
      new_inventory_url: 'https://www.aaronchryslerdodgejeepram.com/new-vehicles/new-vehicle-specials/',
      scraper_platform: 'dealerinspire',
      scraper_default_make: 'Ram',
      scraper_active: true,
      active: true,
    },
    {
      id: 'store_aaron_chevrolet',
      group_id: 'grp_aaron',
      name: 'Aaron Chevrolet',
      dealership_key: 'aaron_chevrolet',
      scraper_store_id: 'aaron_chevrolet',
      timezone: 'America/Los_Angeles',
      new_inventory_url: 'https://www.aaronchevrolet.com/new-vehicles/new-vehicle-specials/',
      scraper_platform: 'dealercom',
      scraper_default_make: 'Chevrolet',
      scraper_active: true,
      active: true,
    },
    {
      id: 'store_aaron_kia',
      group_id: 'grp_aaron',
      name: 'Aaron Kia',
      dealership_key: 'aaron_kia',
      scraper_store_id: 'aaron_kia',
      timezone: 'America/Los_Angeles',
      new_inventory_url: 'https://www.aaronkia.com/specials/',
      scraper_platform: 'dealerinspire',
      scraper_default_make: 'Kia',
      scraper_active: true,
      active: true,
    },
    {
      id: 'store_geaux_chevrolet',
      group_id: 'grp_geaux',
      name: 'Geaux Chevrolet',
      dealership_key: 'geaux_chevrolet',
      scraper_store_id: 'geaux_chevrolet',
      timezone: 'America/Chicago',
      new_inventory_url: 'https://www.geauxchevrolet.com/new-vehicles/new-vehicle-specials/',
      scraper_platform: 'dealercom',
      scraper_default_make: 'Chevrolet',
      scraper_active: true,
      active: true,
    },
    {
      id: 'store_norm_reeves_ford',
      group_id: 'grp_norm_reeves',
      name: 'Norm Reeves Ford',
      dealership_key: 'norm_reeves_ford',
      scraper_store_id: 'norm_reeves_ford',
      timezone: 'America/Los_Angeles',
      new_inventory_url: 'https://www.normreevesford.com/new-vehicles/new-vehicle-specials/',
      scraper_platform: 'dealercom',
      scraper_default_make: 'Ford',
      scraper_active: true,
      active: true,
    }
  ],
  StoreCompetitor: [
    {
      id: 'comp_encinitas_ford',
      store_id: 'store_aaron_ford_escondido',
      name: 'Encinitas Ford',
      competitor_id: 'encinitas_ford',
      new_inventory_url: 'https://www.encinitasford.com/new-vehicles/new-vehicle-specials/',
      scraper_platform: 'dealercom',
      active: true,
      sort_order: 1
    },
    {
      id: 'comp_ken_grody_ford',
      store_id: 'store_aaron_ford_escondido',
      name: 'Ken Grody Ford Carlsbad',
      competitor_id: 'ken_grody_ford_carlsbad',
      new_inventory_url: 'https://www.kengrodyfordsandiego.com/new-vehicles/new-vehicle-specials/',
      scraper_platform: 'dealercom',
      active: true,
      sort_order: 2
    },
    {
      id: 'comp_ontario_cdjr',
      store_id: 'store_aaron_cdjr',
      name: 'Ontario CDJR',
      competitor_id: 'ontario_cdjr',
      new_inventory_url: 'https://www.jeepchryslerdodgeramofontario.com/new-vehicles/new-vehicle-specials/',
      scraper_platform: 'dealerinspire',
      active: true,
      sort_order: 1
    },
    {
      id: 'comp_jstar_cdjr',
      store_id: 'store_aaron_cdjr',
      name: 'J Star CDJR',
      competitor_id: 'j_star_cdjr',
      new_inventory_url: 'https://www.jstarcdjrofanaheimhills.com/specials/',
      scraper_platform: 'dealerinspire',
      active: true,
      sort_order: 2
    },
    {
      id: 'comp_moss_bros_cdjr',
      store_id: 'store_aaron_cdjr',
      name: 'Moss Bros CDJR',
      competitor_id: 'moss_bros_cdjr',
      new_inventory_url: 'https://www.mossbroscdjr.com/specials/',
      scraper_platform: 'dealerinspire',
      active: true,
      sort_order: 3
    }
  ],
  InternetLeadGroup: [
    {
      id: 'ilg_autotrader',
      store_id: 'store_aaron_ford_escondido',
      dealership_key: 'aaron_ford_escondido',
      group_name: 'AutoTrader',
      raw_sources: 'AutoTrader|Auto Trader|Autotrader.com',
      party_type: '3rd Party',
      sort_order: 1
    },
    {
      id: 'ilg_cargurus',
      store_id: 'store_aaron_ford_escondido',
      dealership_key: 'aaron_ford_escondido',
      group_name: 'CarGurus',
      raw_sources: 'CarGurus|Car Gurus',
      party_type: '3rd Party',
      sort_order: 2
    },
    {
      id: 'ilg_dealer_dot_com',
      store_id: 'store_aaron_ford_escondido',
      dealership_key: 'aaron_ford_escondido',
      group_name: 'Dealer.com Website',
      raw_sources: 'Dealer.com|Website|Dealer Website|ePrice',
      party_type: '1st Party',
      sort_order: 3
    },
    {
      id: 'ilg_truecar',
      store_id: 'store_aaron_ford_escondido',
      dealership_key: 'aaron_ford_escondido',
      group_name: 'TrueCar',
      raw_sources: 'TrueCar|True Car',
      party_type: '3rd Party',
      sort_order: 4
    },
    {
      id: 'ilg_cars_com',
      store_id: 'store_aaron_ford_escondido',
      dealership_key: 'aaron_ford_escondido',
      group_name: 'Cars.com',
      raw_sources: 'Cars.com|CarsCom',
      party_type: '3rd Party',
      sort_order: 5
    }
  ],
  VehicleModelGroup: [
    {
      id: 'vmg_1500',
      make: 'Ram',
      canonical_model: '1500',
      raw_variants: 'Ram 1500|Ram Pickup 1500|1500 Classic|All-New 1500',
      sort_order: 1
    },
    {
      id: 'vmg_2500',
      make: 'Ram',
      canonical_model: '2500',
      raw_variants: 'Ram 2500|Ram Pickup 2500|2500 Heavy Duty',
      sort_order: 2
    },
    {
      id: 'vmg_f150',
      make: 'Ford',
      canonical_model: 'F-150',
      raw_variants: 'F-150|Ford F-150|F-150 Lightning',
      sort_order: 3
    },
    {
      id: 'vmg_f250',
      make: 'Ford',
      canonical_model: 'F-250SD',
      raw_variants: 'F-250 Super Duty|Super Duty F-250|F-250SD|F-250 SD',
      sort_order: 4
    }
  ],
  User: [
    {
      id: 'user_admin',
      email: 'admin@dealerdata.com',
      full_name: 'Administrator',
      role: 'admin',
      dealer_group_ids: '',
      store_ids: ''
    }
  ],
  PendingUser: []
};

function getFilePath(entity) {
  return path.join(DATA_DIR, `${entity}.json`);
}

function readLocal(entity) {
  const file = getFilePath(entity);
  if (!fs.existsSync(file)) {
    const initial = SEED_DATA[entity] || [];
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return SEED_DATA[entity] || [];
  }
}

function writeLocal(entity, data) {
  const file = getFilePath(entity);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

const PRISMA_MODELS = {
  DealerGroup: 'dealerGroup',
  Store: 'store',
  StoreCompetitor: 'storeCompetitor',
  InternetLeadGroup: 'internetLeadGroup',
  VehicleModelGroup: 'vehicleModelGroup',
  PendingUser: 'pendingUser',
  User: 'user',
  Role: 'role',
};

function formatPrismaRow(entity, row) {
  if (!row) return null;
  if (entity === 'Role') {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      permissions: row.permissions,
      is_system: Boolean(row.isSystem),
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
  if (entity === 'DealerGroup') {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      principal_name: row.principalName,
      principal_emails: row.principalEmails,
      is_single_store: row.isSingleStore,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
  if (entity === 'Store') {
    return {
      id: row.id,
      group_id: row.groupId,
      name: row.name,
      dealership_key: row.dealershipKey,
      scraper_store_id: row.scraperStoreId,
      timezone: row.timezone,
      new_inventory_url: row.newInventoryUrl,
      used_inventory_url: row.usedInventoryUrl,
      specials_url: row.specialsUrl,
      crawl_specials: Boolean(row.crawlSpecials),
      scraper_platform: row.scraperPlatform,
      scraper_default_make: row.scraperDefaultMake,
      scraper_active: row.scraperActive,
      active: row.active,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
  if (entity === 'StoreCompetitor') {
    return {
      id: row.id,
      store_id: row.storeId,
      name: row.competitorName,
      competitor_name: row.competitorName,
      competitor_key: row.competitorKey,
      competitor_id: row.competitorKey,
      new_inventory_url: row.newInventoryUrl,
      used_inventory_url: row.usedInventoryUrl,
      specials_url: row.specialsUrl,
      crawl_specials: Boolean(row.crawlSpecials),
      scraper_platform: row.scraperPlatform,
      active: row.active,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
  if (entity === 'InternetLeadGroup') {
    return {
      id: row.id,
      group_id: row.groupId,
      store_id: row.storeId,
      name: row.name,
      sources: row.sources ? row.sources.split(',') : [],
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
  if (entity === 'PendingUser') {
    return {
      id: row.id,
      email: row.email,
      full_name: row.fullName || '',
      role: row.role,
      dealer_group_ids: row.dealerGroupIds || '',
      store_ids: row.storeIds || '',
      invited_by: row.invitedBy,
      invited: Boolean(row.invited),
      daily_summary_enabled: row.dailySummaryEnabled ?? true,
      appointments_enabled: row.appointmentsEnabled ?? true,
      competitor_report_enabled: row.competitorReportEnabled ?? false,
      created_at: row.createdAt,
    };
  }
  if (entity === 'User') {
    const { password: _, ...safe } = row;
    return {
      id: safe.id,
      email: safe.email,
      full_name: safe.fullName,
      role: safe.role,
      company: safe.company,
      plan: safe.plan,
      dealer_group_ids: safe.dealerGroupIds,
      store_ids: safe.storeIds,
      daily_summary_enabled: safe.dailySummaryEnabled ?? true,
      appointments_enabled: safe.appointmentsEnabled ?? true,
      competitor_report_enabled: safe.competitorReportEnabled ?? false,
      custom_permissions: safe.customPermissions,
      created_at: safe.createdAt,
      updated_at: safe.updatedAt,
    };
  }
  return row;
}

export async function listEntities(entity, sort = 'created_at', limit = 200) {
  if (process.env.DATABASE_URL && PRISMA_MODELS[entity]) {
    try {
      const prisma = (await import('@/lib/prisma')).default;
      const model = PRISMA_MODELS[entity];
      const rows = await prisma[model].findMany({ take: limit });
      if (rows && rows.length > 0) {
        return rows.map(r => formatPrismaRow(entity, r));
      }
    } catch (e) {
      console.warn(`Prisma listEntities(${entity}) fallback:`, e.message);
    }
  }
  return readLocal(entity);
}

export async function filterEntities(entity, query = {}, sort = 'created_at', limit = 200) {
  const all = await listEntities(entity, sort, limit);
  const filtered = all.filter(item => {
    return Object.entries(query).every(([k, v]) => {
      if (v === undefined || v === null) return true;
      return String(item[k]) === String(v);
    });
  });
  return filtered;
}

export async function getEntity(entity, id) {
  if (process.env.DATABASE_URL && PRISMA_MODELS[entity]) {
    try {
      const prisma = (await import('@/lib/prisma')).default;
      const model = PRISMA_MODELS[entity];
      const row = await prisma[model].findUnique({ where: { id } });
      if (row) return formatPrismaRow(entity, row);
    } catch (e) {
      console.warn(`Prisma getEntity(${entity}) fallback:`, e.message);
    }
  }
  const all = readLocal(entity);
  return all.find(item => item.id === id) || null;
}

export async function createEntity(entity, data) {
  const all = readLocal(entity);
  const newItem = {
    id: data.id || `${entity.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  all.push(newItem);
  writeLocal(entity, all);

  if (process.env.DATABASE_URL && PRISMA_MODELS[entity]) {
    try {
      const prisma = (await import('@/lib/prisma')).default;
      const model = PRISMA_MODELS[entity];
      if (entity === 'DealerGroup') {
        await prisma.dealerGroup.create({
          data: {
            id: newItem.id,
            name: newItem.name,
            slug: newItem.slug || newItem.id,
            principalName: newItem.principal_name,
            principalEmails: newItem.principal_emails,
            isSingleStore: Boolean(newItem.is_single_store),
          },
        });
      } else if (entity === 'Role') {
        await prisma.role.create({
          data: {
            id: newItem.id,
            name: newItem.name,
            slug: newItem.slug || newItem.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            description: newItem.description,
            permissions: typeof newItem.permissions === 'string' ? newItem.permissions : JSON.stringify(newItem.permissions || []),
            isSystem: Boolean(newItem.is_system),
          },
        });
      } else if (entity === 'PendingUser') {
        await prisma.pendingUser.create({
          data: {
            id: newItem.id,
            email: newItem.email,
            fullName: newItem.full_name,
            role: newItem.role || 'user',
            dealerGroupIds: newItem.dealer_group_ids,
            storeIds: newItem.store_ids,
            invitedBy: newItem.invited_by,
            invited: Boolean(newItem.invited),
            dailySummaryEnabled: newItem.daily_summary_enabled !== false,
            appointmentsEnabled: newItem.appointments_enabled !== false,
            competitorReportEnabled: Boolean(newItem.competitor_report_enabled),
          },
        });
      } else if (entity === 'Store') {
        await prisma.store.create({
          data: {
            id: newItem.id,
            groupId: newItem.group_id,
            name: newItem.name,
            dealershipKey: newItem.dealership_key,
            scraperStoreId: newItem.scraper_store_id,
            timezone: newItem.timezone || 'America/Los_Angeles',
            newInventoryUrl: newItem.new_inventory_url,
            usedInventoryUrl: newItem.used_inventory_url,
            specialsUrl: newItem.specials_url || null,
            crawlSpecials: Boolean(newItem.crawl_specials),
            scraperPlatform: newItem.scraper_platform || 'auto',
            scraperDefaultMake: newItem.scraper_default_make,
            scraperActive: newItem.scraper_active !== false,
            active: newItem.active !== false,
          },
        });
      } else if (entity === 'StoreCompetitor') {
        await prisma.storeCompetitor.create({
          data: {
            id: newItem.id,
            storeId: newItem.store_id,
            competitorName: newItem.competitor_name || newItem.name,
            competitorKey: newItem.competitor_key || newItem.competitor_id,
            newInventoryUrl: newItem.new_inventory_url,
            usedInventoryUrl: newItem.used_inventory_url,
            specialsUrl: newItem.specials_url || null,
            crawlSpecials: Boolean(newItem.crawl_specials),
            scraperPlatform: newItem.scraper_platform || 'auto',
            active: newItem.active !== false && newItem.scraper_active !== false,
          },
        });
      }
    } catch (e) {
      console.warn(`Prisma createEntity(${entity}) fallback:`, e.message);
    }
  }

  return newItem;
}

export async function updateEntity(entity, id, data) {
  const all = readLocal(entity);
  const idx = all.findIndex(item => item.id === id);
  let updatedItem;
  if (idx === -1) {
    updatedItem = { id, ...data, updated_at: new Date().toISOString() };
    all.push(updatedItem);
  } else {
    all[idx] = { ...all[idx], ...data, updated_at: new Date().toISOString() };
    updatedItem = all[idx];
  }
  writeLocal(entity, all);

  if (process.env.DATABASE_URL && PRISMA_MODELS[entity]) {
    try {
      const prisma = (await import('@/lib/prisma')).default;
      const model = PRISMA_MODELS[entity];
      if (entity === 'DealerGroup') {
        await prisma.dealerGroup.update({
          where: { id },
          data: {
            name: updatedItem.name,
            slug: updatedItem.slug,
            principalName: updatedItem.principal_name,
            principalEmails: updatedItem.principal_emails,
            isSingleStore: Boolean(updatedItem.is_single_store),
          },
        });
      } else if (entity === 'Role') {
        await prisma.role.update({
          where: { id },
          data: {
            name: updatedItem.name,
            slug: updatedItem.slug,
            description: updatedItem.description,
            permissions: typeof updatedItem.permissions === 'string' ? updatedItem.permissions : JSON.stringify(updatedItem.permissions || []),
          },
        });
      } else if (entity === 'PendingUser') {
        await prisma.pendingUser.update({
          where: { id },
          data: {
            email: updatedItem.email,
            fullName: updatedItem.full_name,
            role: updatedItem.role,
            dealerGroupIds: updatedItem.dealer_group_ids,
            storeIds: updatedItem.store_ids,
            invited: Boolean(updatedItem.invited),
            dailySummaryEnabled: updatedItem.daily_summary_enabled !== false,
            appointmentsEnabled: updatedItem.appointments_enabled !== false,
            competitorReportEnabled: Boolean(updatedItem.competitor_report_enabled),
          },
        });
      } else if (entity === 'User') {
        await prisma.user.update({
          where: { id },
          data: {
            fullName: updatedItem.full_name,
            company: updatedItem.company,
            plan: updatedItem.plan,
            role: updatedItem.role,
            dealerGroupIds: updatedItem.dealer_group_ids,
            storeIds: updatedItem.store_ids,
            dailySummaryEnabled: updatedItem.daily_summary_enabled !== false,
            appointmentsEnabled: updatedItem.appointments_enabled !== false,
            competitorReportEnabled: Boolean(updatedItem.competitor_report_enabled),
            customPermissions: updatedItem.custom_permissions,
          },
        });
      } else if (entity === 'Store') {
        await prisma.store.update({
          where: { id },
          data: {
            name: updatedItem.name,
            dealershipKey: updatedItem.dealership_key,
            scraperStoreId: updatedItem.scraper_store_id,
            timezone: updatedItem.timezone,
            newInventoryUrl: updatedItem.new_inventory_url,
            usedInventoryUrl: updatedItem.used_inventory_url,
            specialsUrl: updatedItem.specials_url || null,
            crawlSpecials: Boolean(updatedItem.crawl_specials),
            scraperPlatform: updatedItem.scraper_platform || 'auto',
            scraperDefaultMake: updatedItem.scraper_default_make,
            scraperActive: Boolean(updatedItem.scraper_active),
            active: Boolean(updatedItem.active),
          },
        });
      } else if (entity === 'StoreCompetitor') {
        await prisma.storeCompetitor.update({
          where: { id },
          data: {
            competitorName: updatedItem.competitor_name || updatedItem.name,
            competitorKey: updatedItem.competitor_key || updatedItem.competitor_id,
            newInventoryUrl: updatedItem.new_inventory_url,
            usedInventoryUrl: updatedItem.used_inventory_url,
            specialsUrl: updatedItem.specials_url || null,
            crawlSpecials: Boolean(updatedItem.crawl_specials),
            scraperPlatform: updatedItem.scraper_platform || 'auto',
            active: updatedItem.active !== false && updatedItem.scraper_active !== false,
          },
        });
      }
    } catch (e) {
      console.warn(`Prisma updateEntity(${entity}) fallback:`, e.message);
    }
  }

  return updatedItem;
}

export async function deleteEntity(entity, id) {
  let cascadeStoreIds = [];
  let cascadeKeysToDelete = [];

  if (entity === 'DealerGroup') {
    // 1. Find all stores belonging to this group in local JSON
    const allStores = readLocal('Store');
    const storesInGroup = allStores.filter(s => String(s.group_id) === String(id));
    cascadeStoreIds = storesInGroup.map(s => s.id);
    cascadeKeysToDelete.push(...storesInGroup.map(s => s.dealership_key || s.scraper_store_id).filter(Boolean));

    // Remove stores from Store.json
    const remainingStores = allStores.filter(s => String(s.group_id) !== String(id));
    writeLocal('Store', remainingStores);

    // 2. Find and remove all competitors belonging to these stores from StoreCompetitor.json
    const allComps = readLocal('StoreCompetitor');
    const compsToDelete = allComps.filter(c => cascadeStoreIds.includes(c.store_id));
    cascadeKeysToDelete.push(...compsToDelete.map(c => c.competitor_key || c.competitor_id).filter(Boolean));
    const remainingComps = allComps.filter(c => !cascadeStoreIds.includes(c.store_id));
    writeLocal('StoreCompetitor', remainingComps);

    // 3. Remove lead groups
    const allLeadGroups = readLocal('InternetLeadGroup');
    const remainingLeadGroups = allLeadGroups.filter(lg => String(lg.group_id) !== String(id) && !cascadeStoreIds.includes(lg.store_id));
    writeLocal('InternetLeadGroup', remainingLeadGroups);
  } else if (entity === 'Store') {
    cascadeStoreIds = [id];
    const allStores = readLocal('Store');
    const storeToDelete = allStores.find(s => s.id === id);
    if (storeToDelete) {
      if (storeToDelete.dealership_key) cascadeKeysToDelete.push(storeToDelete.dealership_key);
      if (storeToDelete.scraper_store_id) cascadeKeysToDelete.push(storeToDelete.scraper_store_id);
    }
    // Remove competitors of this store from StoreCompetitor.json
    const allComps = readLocal('StoreCompetitor');
    const compsToDelete = allComps.filter(c => String(c.store_id) === String(id));
    cascadeKeysToDelete.push(...compsToDelete.map(c => c.competitor_key || c.competitor_id).filter(Boolean));
    const remainingComps = allComps.filter(c => String(c.store_id) !== String(id));
    writeLocal('StoreCompetitor', remainingComps);

    // Remove lead groups
    const allLeadGroups = readLocal('InternetLeadGroup');
    const remainingLeadGroups = allLeadGroups.filter(lg => String(lg.store_id) !== String(id));
    writeLocal('InternetLeadGroup', remainingLeadGroups);
  }

  // Remove the target entity from its local JSON
  const all = readLocal(entity);
  const remaining = all.filter(item => item.id !== id);
  writeLocal(entity, remaining);

  // If Database is connected, execute cascade in MySQL
  if (process.env.DATABASE_URL) {
    try {
      const prisma = (await import('@/lib/prisma')).default;

      if (entity === 'DealerGroup') {
        // Collect DB store IDs and keys if any exist in DB
        const dbStores = await prisma.store.findMany({ where: { groupId: id } });
        const allStoreIds = [...new Set([...cascadeStoreIds, ...dbStores.map(s => s.id)])];
        dbStores.forEach(s => {
          if (s.dealershipKey) cascadeKeysToDelete.push(s.dealershipKey);
          if (s.scraperStoreId) cascadeKeysToDelete.push(s.scraperStoreId);
        });

        if (allStoreIds.length > 0) {
          const dbComps = await prisma.storeCompetitor.findMany({ where: { storeId: { in: allStoreIds } } });
          dbComps.forEach(c => {
            if (c.competitorKey) cascadeKeysToDelete.push(c.competitorKey);
          });
          // Delete DB competitors, lead groups, and stores
          await prisma.storeCompetitor.deleteMany({ where: { storeId: { in: allStoreIds } } }).catch(() => {});
          await prisma.internetLeadGroup.deleteMany({ where: { OR: [{ groupId: id }, { storeId: { in: allStoreIds } }] } }).catch(() => {});
          await prisma.store.deleteMany({ where: { groupId: id } }).catch(() => {});
        } else {
          await prisma.internetLeadGroup.deleteMany({ where: { groupId: id } }).catch(() => {});
        }

        // Delete group
        await prisma.dealerGroup.delete({ where: { id } }).catch(() => {});
      } else if (entity === 'Store') {
        const dbStore = await prisma.store.findUnique({ where: { id } });
        if (dbStore) {
          if (dbStore.dealershipKey) cascadeKeysToDelete.push(dbStore.dealershipKey);
          if (dbStore.scraperStoreId) cascadeKeysToDelete.push(dbStore.scraperStoreId);
        }
        const dbComps = await prisma.storeCompetitor.findMany({ where: { storeId: id } });
        dbComps.forEach(c => {
          if (c.competitorKey) cascadeKeysToDelete.push(c.competitorKey);
        });
        await prisma.storeCompetitor.deleteMany({ where: { storeId: id } }).catch(() => {});
        await prisma.internetLeadGroup.deleteMany({ where: { storeId: id } }).catch(() => {});
        await prisma.store.delete({ where: { id } }).catch(() => {});
      } else if (PRISMA_MODELS[entity]) {
        const model = PRISMA_MODELS[entity];
        await prisma[model].delete({ where: { id } }).catch(() => {});
      }

      // Purge scraped inventory, specials, and pricing data for deleted store/competitor keys
      const uniqueKeys = [...new Set(cascadeKeysToDelete.filter(Boolean))];
      if (uniqueKeys.length > 0) {
        await Promise.allSettled([
          prisma.competitorVehicleInventory?.deleteMany?.({ where: { dealerId: { in: uniqueKeys } } }),
          prisma.competitorVehicleSpecial?.deleteMany?.({ where: { dealerId: { in: uniqueKeys } } }),
          prisma.competitorInventoryPricing?.deleteMany?.({ where: { dealerId: { in: uniqueKeys } } }),
          prisma.competitorServiceSpecial?.deleteMany?.({ where: { dealerId: { in: uniqueKeys } } }),
        ]);
      }
    } catch (e) {
      console.warn(`Prisma deleteEntity(${entity}) fallback:`, e.message);
    }
  }

  return { success: true, id };
}
