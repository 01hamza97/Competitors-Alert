import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';
import { prisma } from './prisma.js';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

export function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return BACKUP_DIR;
}

// Find mysqldump and mysql binaries
function getBinaryPath(name) {
  const commonPaths = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
    `/usr/local/mysql/bin/${name}`,
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }
  return name; // fallback to PATH
}

// Parse DATABASE_URL into individual MySQL credentials
export function getDbConfig() {
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    // Try reading .env.local or .env
    const envPaths = [
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env'),
    ];
    for (const ep of envPaths) {
      if (fs.existsSync(ep)) {
        const text = fs.readFileSync(ep, 'utf8');
        const m = text.match(/DATABASE_URL=["']?([^"'\r\n]+)/);
        if (m && m[1]) {
          dbUrl = m[1].trim();
          break;
        }
      }
    }
  }

  if (!dbUrl) {
    throw new Error('DATABASE_URL is not defined in environment or .env files.');
  }

  const parsed = new URL(dbUrl);
  return {
    user: decodeURIComponent(parsed.username || 'root'),
    password: decodeURIComponent(parsed.password || ''),
    host: parsed.hostname || 'localhost',
    port: parsed.port || '3306',
    database: parsed.pathname.replace(/^\//, ''),
    fullUrl: dbUrl,
  };
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Creates a gzipped MySQL backup of the entire database.
 * @param {Object} options
 * @param {string} [options.note] - Optional label or note for this backup
 * @returns {Promise<Object>} Backup metadata
 */
export async function createDatabaseBackup({ note = '' } = {}) {
  const dir = ensureBackupDir();
  const config = getDbConfig();
  const mysqldumpBin = getBinaryPath('mysqldump');

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const fileName = `backup_${config.database}_${timestamp}.sql.gz`;
  const filePath = path.join(dir, fileName);

  const args = [
    `-h`, config.host,
    `-P`, config.port,
    `-u`, config.user,
    `--single-transaction`,
    `--quick`,
    `--routines`,
    `--triggers`,
    `--set-gtid-purged=OFF`,
    config.database,
  ];

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const env = { ...process.env };
    if (config.password) {
      env.MYSQL_PWD = config.password;
    }

    const dumpProcess = spawn(mysqldumpBin, args, { env });
    const gzipProcess = zlib.createGzip({ level: 9 });
    const writeStream = fs.createWriteStream(filePath);

    let errorOutput = '';
    dumpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    dumpProcess.stdout.pipe(gzipProcess).pipe(writeStream);

    dumpProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn mysqldump: ${err.message}`));
    });

    writeStream.on('finish', async () => {
      const durationMs = Date.now() - startTime;
      const stats = fs.statSync(filePath);

      // Check if backup is empty
      if (stats.size === 0) {
        fs.unlinkSync(filePath);
        return reject(new Error(`Backup failed: Generated file is empty. ${errorOutput}`));
      }

      // Query database table counts for manifest
      let tableCount = 0;
      try {
        const tables = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ?`,
          config.database
        );
        tableCount = Number(tables?.[0]?.cnt || 0);
      } catch (tableErr) {
        console.warn('Could not query table count:', tableErr.message);
      }

      const meta = {
        id: fileName,
        fileName,
        filePath,
        database: config.database,
        sizeBytes: stats.size,
        sizeFormatted: formatBytes(stats.size),
        tableCount,
        note: note || 'Manual Backup',
        createdAt: now.toISOString(),
        durationMs,
        durationFormatted: `${(durationMs / 1000).toFixed(1)}s`,
      };

      // Save companion .json metadata
      const metaPath = path.join(dir, `${fileName}.meta.json`);
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

      resolve(meta);
    });

    writeStream.on('error', (err) => {
      reject(new Error(`Failed to write backup file: ${err.message}`));
    });
  });
}

/**
 * Lists all existing database backups in order from newest to oldest.
 * @returns {Array<Object>} List of backup metadata objects
 */
export function listDatabaseBackups() {
  const dir = ensureBackupDir();
  const files = fs.readdirSync(dir);

  const backups = [];

  for (const f of files) {
    if (f.endsWith('.sql.gz') || (f.endsWith('.sql') && !f.endsWith('.meta.json'))) {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      const metaPath = path.join(dir, `${f}.meta.json`);

      let meta = null;
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch {}
      }

      backups.push({
        id: f,
        fileName: f,
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size),
        createdAt: meta?.createdAt || stat.mtime.toISOString(),
        database: meta?.database || 'dealerdata-3',
        tableCount: meta?.tableCount ?? null,
        note: meta?.note || '',
        durationFormatted: meta?.durationFormatted || null,
      });
    }
  }

  // Sort newest first
  backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return backups;
}

/**
 * Restores the database from a specified backup file.
 * @param {string} fileName - The filename of the backup (e.g. backup_dealerdata3_...sql.gz)
 * @returns {Promise<Object>} Restore result
 */
export async function restoreDatabaseBackup(fileName) {
  // Sanitize filename to prevent directory traversal
  const safeName = path.basename(fileName);
  const dir = ensureBackupDir();
  const filePath = path.join(dir, safeName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file "${safeName}" does not exist in backups directory.`);
  }

  const config = getDbConfig();
  const mysqlBin = getBinaryPath('mysql');

  const args = [
    `-h`, config.host,
    `-P`, config.port,
    `-u`, config.user,
    config.database,
  ];

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const env = { ...process.env };
    if (config.password) {
      env.MYSQL_PWD = config.password;
    }

    const mysqlProcess = spawn(mysqlBin, args, { env });
    let errorOutput = '';

    mysqlProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Absorb EPIPE error if mysql exits early or encounters syntax errors
    mysqlProcess.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') {
        console.warn('mysqlProcess.stdin warning:', err.message);
      }
    });

    const isGzipped = safeName.endsWith('.gz');
    const readStream = fs.createReadStream(filePath);

    if (isGzipped) {
      const gunzip = zlib.createGunzip();
      readStream.pipe(gunzip).pipe(mysqlProcess.stdin);
      gunzip.on('error', (err) => {
        reject(new Error(`Failed decompressing backup: ${err.message}`));
      });
    } else {
      readStream.pipe(mysqlProcess.stdin);
    }

    readStream.on('error', (err) => {
      reject(new Error(`Failed to read backup file: ${err.message}`));
    });

    mysqlProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn mysql: ${err.message}`));
    });

    mysqlProcess.on('close', async (code) => {
      const durationMs = Date.now() - startTime;
      if (code !== 0) {
        return reject(new Error(`mysql restore exited with code ${code}. ${errorOutput}`));
      }

      // Verify table count after restoration
      let tableCount = 0;
      try {
        const tables = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ?`,
          config.database
        );
        tableCount = Number(tables?.[0]?.cnt || 0);
      } catch (e) {
        console.warn('Post-restore verification warning:', e.message);
      }

      resolve({
        success: true,
        fileName: safeName,
        database: config.database,
        tableCount,
        durationMs,
        durationFormatted: `${(durationMs / 1000).toFixed(1)}s`,
        message: `Database "${config.database}" successfully restored from ${safeName} (${tableCount} tables verified in ${(durationMs / 1000).toFixed(1)}s).`,
      });
    });
  });
}

/**
 * Deletes a backup file and its metadata.
 * @param {string} fileName
 */
export function deleteDatabaseBackup(fileName) {
  const safeName = path.basename(fileName);
  const dir = ensureBackupDir();
  const filePath = path.join(dir, safeName);
  const metaPath = path.join(dir, `${safeName}.meta.json`);

  let deleted = false;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    deleted = true;
  }
  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
  }

  if (!deleted) {
    throw new Error(`Backup file "${safeName}" not found.`);
  }

  return { success: true, fileName: safeName };
}

/**
 * Get path to backup file for download.
 * @param {string} fileName
 */
export function getBackupDownloadPath(fileName) {
  const safeName = path.basename(fileName);
  const dir = ensureBackupDir();
  const filePath = path.join(dir, safeName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file "${safeName}" not found.`);
  }

  return { filePath, fileName: safeName, size: fs.statSync(filePath).size };
}
