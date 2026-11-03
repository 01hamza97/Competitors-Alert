#!/usr/bin/env node

/**
 * CLI Database Backup Script
 * Usage: node scripts/backup-db.js [--note "My backup note"]
 */

import { createDatabaseBackup } from '../src/lib/backupService.js';

async function run() {
  const noteArgIdx = process.argv.indexOf('--note');
  const note = noteArgIdx !== -1 && process.argv[noteArgIdx + 1] ? process.argv[noteArgIdx + 1] : 'CLI Manual Backup';

  console.log('----------------------------------------------------');
  console.log('📦 DealerData Database Backup Tool');
  console.log('----------------------------------------------------');
  console.log(`Starting backup with note: "${note}"...`);

  const startTime = Date.now();
  try {
    const meta = await createDatabaseBackup({ note });
    console.log('✅ Backup created successfully!');
    console.log(`   File:      ${meta.fileName}`);
    console.log(`   Path:      ${meta.filePath}`);
    console.log(`   Database:  ${meta.database}`);
    console.log(`   Size:      ${meta.sizeFormatted}`);
    console.log(`   Tables:    ${meta.tableCount}`);
    console.log(`   Duration:  ${meta.durationFormatted}`);
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

run();
