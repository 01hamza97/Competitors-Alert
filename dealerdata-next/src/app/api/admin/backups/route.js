import { NextResponse } from 'next/server';
import {
  listDatabaseBackups,
  createDatabaseBackup,
  getDbConfig,
} from '@/lib/backupService';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const backups = listDatabaseBackups();
    let dbInfo = { database: 'unknown', host: 'localhost' };
    try {
      const cfg = getDbConfig();
      dbInfo = { database: cfg.database, host: cfg.host, port: cfg.port, user: cfg.user };
    } catch {}

    const totalSizeBytes = backups.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);

    return NextResponse.json({
      backups,
      count: backups.length,
      totalSizeBytes,
      database: dbInfo,
    });
  } catch (error) {
    console.error('GET /api/admin/backups error:', error);
    return NextResponse.json({ error: error.message || 'Failed to list backups' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const note = body.note || '';

    const backupMeta = await createDatabaseBackup({ note });
    return NextResponse.json({
      success: true,
      backup: backupMeta,
      message: `Database backup created successfully: ${backupMeta.fileName} (${backupMeta.sizeFormatted})`,
    });
  } catch (error) {
    console.error('POST /api/admin/backups error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create backup' }, { status: 500 });
  }
}
