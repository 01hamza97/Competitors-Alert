import { NextResponse } from 'next/server';
import { getEntity, updateEntity, deleteEntity } from '@/lib/entityStore';

export async function GET(request, { params }) {
  try {
    const { entity, id } = await params;
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
    const result = await deleteEntity(entity, id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
