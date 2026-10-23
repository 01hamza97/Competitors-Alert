import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ROLES = [
  {
    id: 'role_admin',
    name: 'Super Administrator',
    slug: 'admin',
    description: 'Full root access to all stores, financial billing, user accounts, and system configuration.',
    isSystem: true,
    permissions: JSON.stringify([
      'view_leads',
      'view_appointments',
      'view_salespeople',
      'view_competitors',
      'manage_specials',
      'manage_team',
      'manage_billing',
      'manage_dealerships',
      'export_reports',
    ]),
  },
  {
    id: 'role_manager',
    name: 'General Manager (GM)',
    slug: 'manager',
    description: 'Executive management across assigned dealership rooftops with store operations and team oversight.',
    isSystem: true,
    permissions: JSON.stringify([
      'view_leads',
      'view_appointments',
      'view_salespeople',
      'view_competitors',
      'manage_specials',
      'manage_team',
      'export_reports',
    ]),
  },
  {
    id: 'role_sales_manager',
    name: 'Sales Manager / GSM',
    slug: 'sales_manager',
    description: 'Front-line sales floor management tracking daily appointments, showroom show rate, and salesperson activity.',
    isSystem: true,
    permissions: JSON.stringify([
      'view_leads',
      'view_appointments',
      'view_salespeople',
      'export_reports',
    ]),
  },
  {
    id: 'role_bdc_director',
    name: 'BDC Director',
    slug: 'bdc_director',
    description: 'Business Development Center leader managing internet leads, phone/text outreach, and automated digests.',
    isSystem: true,
    permissions: JSON.stringify([
      'view_leads',
      'view_appointments',
      'view_salespeople',
      'export_reports',
    ]),
  },
  {
    id: 'role_analyst',
    name: 'Market & Inventory Analyst',
    slug: 'analyst',
    description: 'Specialized intelligence role reviewing competitor market pricing, vehicle specials, and vendor ROI metrics.',
    isSystem: true,
    permissions: JSON.stringify([
      'view_leads',
      'view_competitors',
      'export_reports',
    ]),
  },
  {
    id: 'role_user',
    name: 'Salesperson / Standard User',
    slug: 'user',
    description: 'Standard rooftop team member with view-only access to assigned store leads and daily appointments.',
    isSystem: true,
    permissions: JSON.stringify([
      'view_leads',
      'view_appointments',
    ]),
  },
];

async function seedRoles() {
  console.log('🌱 Seeding default RBAC roles into MySQL...');
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
      },
      create: role,
    });
  }

  // Also ensure our existing users have notification fields populated
  await prisma.user.updateMany({
    data: {
      dailySummaryEnabled: true,
      appointmentsEnabled: true,
    },
  });

  console.log('✅ Seeded 6 comprehensive RBAC roles successfully.');
  await prisma.$disconnect();
}

seedRoles().catch(e => {
  console.error(e);
  process.exit(1);
});
