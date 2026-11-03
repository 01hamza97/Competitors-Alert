import { NextResponse } from 'next/server';
import { deleteDatabaseBackup } from '@/lib/backupService';
import { getAuthUser } from '@/lib/auth';

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing backup filename' }, { status: 400 });
    }

    const result = deleteDatabaseBackup(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('DELETE /api/admin/backups/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete backup' }, { status: 500 });
  }
}
