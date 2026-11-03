import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { ensureBackupDir } from '@/lib/backupService';
import { getAuthUser } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const originalName = file.name || 'uploaded_backup.sql.gz';
    if (!originalName.endsWith('.sql') && !originalName.endsWith('.sql.gz')) {
      return NextResponse.json({ error: 'Only .sql or .sql.gz backup files are allowed.' }, { status: 400 });
    }

    const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const dir = ensureBackupDir();
    const targetPath = path.join(dir, safeName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(targetPath, buffer);

    const meta = {
      id: safeName,
      fileName: safeName,
      filePath: targetPath,
      sizeBytes: buffer.length,
      note: 'Uploaded Backup',
      createdAt: new Date().toISOString(),
    };

    const metaPath = path.join(dir, `${safeName}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    return NextResponse.json({
      success: true,
      fileName: safeName,
      sizeBytes: buffer.length,
      message: `Backup "${safeName}" uploaded successfully.`,
    });
  } catch (error) {
    console.error('POST /api/admin/backups/upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload backup' }, { status: 500 });
  }
}
