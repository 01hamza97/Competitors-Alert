import { NextResponse } from 'next/server';
import { restoreDatabaseBackup } from '@/lib/backupService';
import { getAuthUser } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing backup filename' }, { status: 400 });
    }

    const result = await restoreDatabaseBackup(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/admin/backups/[id]/restore error:', error);
    return NextResponse.json({ error: error.message || 'Failed to restore backup' }, { status: 500 });
  }
}
