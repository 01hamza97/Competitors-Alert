import { NextResponse } from 'next/server';
import { listEntities, createEntity } from '@/lib/entityStore';
import { getSessionUser } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const { entity } = await params;
    const token =
      request.cookies.get('dealerdata_session')?.value ||
      request.cookies.get('session_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');
    const user = await getSessionUser(token);

    // RBAC Security Check: Team & Role Management
    if (['User', 'Role', 'PendingUser'].includes(entity)) {
      if (!user || (user.role !== 'admin' && !user.permissions?.includes('team_management'))) {
        return NextResponse.json(
          { error: 'Access denied: Insufficient permissions for user and role management' },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'created_at';
    const limit = parseInt(searchParams.get('limit') || '200', 10);
    let items = await listEntities(entity, sort, limit);

    // Store & Group Scoping: Filter entities for non-admin users
    if (user && user.role !== 'admin') {
      const userStoreIds = (user.store_ids || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const userGroupIds = (user.dealer_group_ids || '').split(',').map(g => g.trim().toLowerCase()).filter(Boolean);

      if (entity === 'Store') {
        items = items.filter(store => {
          const candidates = [
            String(store.id).toLowerCase(),
            String(store.id).toLowerCase().replace(/^store_/, ''),
            `store_${String(store.id).toLowerCase().replace(/^store_/, '')}`,
            store.dealership_key ? String(store.dealership_key).toLowerCase() : null,
            store.scraper_store_id ? String(store.scraper_store_id).toLowerCase() : null,
          ].filter(Boolean);
          const hasStore = userStoreIds.some(id => candidates.includes(id));
          const hasGroup = store.group_id && userGroupIds.some(id =>
            id === String(store.group_id).toLowerCase() || id === `grp_${String(store.group_id).toLowerCase()}`
          );
          return hasStore || hasGroup;
        });
      } else if (entity === 'DealerGroup') {
        const allowedStores = await listEntities('Store', 'name', 500);
        const permittedStoreGroupIds = allowedStores
          .filter(store => {
            const candidates = [
              String(store.id).toLowerCase(),
              String(store.id).toLowerCase().replace(/^store_/, ''),
              `store_${String(store.id).toLowerCase().replace(/^store_/, '')}`,
              store.dealership_key ? String(store.dealership_key).toLowerCase() : null,
              store.scraper_store_id ? String(store.scraper_store_id).toLowerCase() : null,
            ].filter(Boolean);
            return userStoreIds.some(id => candidates.includes(id));
          })
          .map(s => String(s.group_id).toLowerCase());

        items = items.filter(group => {
          const cleanId = String(group.id).toLowerCase();
          return userGroupIds.includes(cleanId) ||
                 userGroupIds.includes(`grp_${cleanId}`) ||
                 permittedStoreGroupIds.includes(cleanId);
        });
      } else if (entity === 'StoreCompetitor') {
        const allowedStoreList = await listEntities('Store', 'name', 500);
        const permittedStoreIds = allowedStoreList
          .filter(store => {
            const candidates = [
              String(store.id).toLowerCase(),
              String(store.id).toLowerCase().replace(/^store_/, ''),
              `store_${String(store.id).toLowerCase().replace(/^store_/, '')}`,
              store.dealership_key ? String(store.dealership_key).toLowerCase() : null,
              store.scraper_store_id ? String(store.scraper_store_id).toLowerCase() : null,
            ].filter(Boolean);
            const hasStore = userStoreIds.some(id => candidates.includes(id));
            const hasGroup = store.group_id && userGroupIds.some(id =>
              id === String(store.group_id).toLowerCase() || id === `grp_${String(store.group_id).toLowerCase()}`
            );
            return hasStore || hasGroup;
          })
          .map(s => String(s.id));

        items = items.filter(comp => permittedStoreIds.includes(String(comp.store_id)));
      }
    }

    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { entity } = await params;
    const token =
      request.cookies.get('dealerdata_session')?.value ||
      request.cookies.get('session_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');
    const user = await getSessionUser(token);

    // RBAC Security Check: Creating users or roles requires team_management or admin
    if (['User', 'Role', 'PendingUser'].includes(entity)) {
      if (!user || (user.role !== 'admin' && !user.permissions?.includes('team_management'))) {
        return NextResponse.json(
          { error: 'Access denied: Insufficient permissions to create users or roles' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const created = await createEntity(entity, body);
    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
