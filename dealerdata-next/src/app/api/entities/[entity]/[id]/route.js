import { NextResponse } from 'next/server';
import { getEntity, updateEntity, deleteEntity } from '@/lib/entityStore';
import { getSessionUser } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const { entity, id } = await params;
    const token =
      request.cookies.get('dealerdata_session')?.value ||
      request.cookies.get('session_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');
    const user = await getSessionUser(token);

    if (['User', 'Role', 'PendingUser'].includes(entity)) {
      if (entity === 'User' && user && user.id === id) {
        // Permitted: User viewing own account profile
      } else if (!user || (user.role !== 'admin' && !user.permissions?.includes('team_management'))) {
        return NextResponse.json({ error: 'Access denied: Insufficient permissions' }, { status: 403 });
      }
    }

    const item = await getEntity(entity, id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { entity, id } = await params;
    const token =
      request.cookies.get('dealerdata_session')?.value ||
      request.cookies.get('session_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');
    const user = await getSessionUser(token);

    if (['User', 'Role', 'PendingUser'].includes(entity)) {
      if (entity === 'User' && user && user.id === id) {
        // Permitted: User updating their own profile
      } else if (!user || (user.role !== 'admin' && !user.permissions?.includes('team_management'))) {
        return NextResponse.json({ error: 'Access denied: Insufficient permissions to modify staff or roles' }, { status: 403 });
      }
    }

    const body = await request.json();
    const updated = await updateEntity(entity, id, body);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { entity, id } = await params;
    const token =
      request.cookies.get('dealerdata_session')?.value ||
      request.cookies.get('session_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');
    const user = await getSessionUser(token);

    if (['User', 'Role', 'PendingUser'].includes(entity)) {
      if (!user || (user.role !== 'admin' && !user.permissions?.includes('team_management'))) {
        return NextResponse.json({ error: 'Access denied: Insufficient permissions to delete staff or roles' }, { status: 403 });
      }
    }

    const result = await deleteEntity(entity, id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
