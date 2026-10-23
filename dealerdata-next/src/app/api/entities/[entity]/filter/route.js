import { NextResponse } from 'next/server';
import { filterEntities } from '@/lib/entityStore';

export async function POST(request, { params }) {
  try {
    const { entity } = await params;
    const body = await request.json().catch(() => ({}));
    const { query = {}, sort = 'created_at', limit = 200 } = body;
    const items = await filterEntities(entity, query, sort, limit);
    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
