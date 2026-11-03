#!/usr/bin/env node

/**
 * CLI Database Restore Script
 * Usage: node scripts/restore-db.js [filename]
 * If no filename is provided, restores the most recent backup.
 */

import { listDatabaseBackups, restoreDatabaseBackup } from '../src/lib/backupService.js';

async function run() {
  console.log('----------------------------------------------------');
  console.log('🔄 DealerData Database Restore Tool');
  console.log('----------------------------------------------------');

  const backups = listDatabaseBackups();
  if (backups.length === 0) {
    console.error('❌ No backup files found in backups directory.');
    console.log('   Run "npm run db:backup" first to create a backup.');
    process.exit(1);
  }

  let targetFile = process.argv[2];
  if (!targetFile) {
    targetFile = backups[0].fileName;
    console.log(`ℹ️  No backup specified. Using most recent backup: ${targetFile}`);
  }

  console.log(`Starting restoration of: "${targetFile}"...`);

  try {
    const result = await restoreDatabaseBackup(targetFile);
    console.log('✅ Restoration complete!');
    console.log(`   ${result.message}`);
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('❌ Restoration failed:', error.message);
    process.exit(1);
  }
}

run();
