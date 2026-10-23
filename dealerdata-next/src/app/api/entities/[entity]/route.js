import { NextResponse } from 'next/server';
import { listEntities, createEntity } from '@/lib/entityStore';

export async function GET(request, { params }) {
  try {
    const { entity } = await params;
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'created_at';
    const limit = parseInt(searchParams.get('limit') || '200', 10);
    const items = await listEntities(entity, sort, limit);
    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { entity } = await params;
    const body = await request.json();
    const created = await createEntity(entity, body);
    return NextResponse.json(created);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
