import fs from 'fs';
import { NextResponse } from 'next/server';
import { getBackupDownloadPath } from '@/lib/backupService';
import { getAuthUser } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing backup filename' }, { status: 400 });
    }

    const { filePath, fileName, size } = getBackupDownloadPath(id);
    const fileStream = fs.createReadStream(filePath);

    // Convert node read stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    const isGz = fileName.endsWith('.gz');

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': isGz ? 'application/gzip' : 'application/sql',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(size),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/backups/[id]/download error:', error);
    return NextResponse.json({ error: error.message || 'Failed to download backup' }, { status: 500 });
  }
}
