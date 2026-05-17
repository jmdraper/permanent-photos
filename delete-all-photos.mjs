/**
 * delete-all-photos.mjs
 *
 * Deletes all photos in a Permanent.org folder, looping until empty.
 * Handles pagination inconsistency by repeatedly fetching and deleting
 * until getFolder returns zero records.
 *
 * USAGE:
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node delete-all-photos.mjs --dry-run
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node delete-all-photos.mjs --execute
 */

import { getFolder, deleteArchiveRecord } from '@permanentorg/sdk';

const TOKEN     = process.env.PERMANENT_TOKEN;
const FOLDER_ID = parseInt(process.env.PERMANENT_FOLDER_ID || '', 10);
const DRY_RUN   = process.argv.includes('--dry-run');
const EXECUTE   = process.argv.includes('--execute');

if (!TOKEN)     { console.error('Error: PERMANENT_TOKEN not set'); process.exit(1); }
if (!FOLDER_ID) { console.error('Error: PERMANENT_FOLDER_ID not set'); process.exit(1); }
if (!DRY_RUN && !EXECUTE) {
  console.error('Usage: node delete-all-photos.mjs --dry-run | --execute');
  process.exit(1);
}

const CLIENT = { bearerToken: TOKEN, stelaBaseUrl: 'https://api.permanent.org/api/v2' };

console.log(`Checking folder ${FOLDER_ID}…`);
const folder = await getFolder(CLIENT, { folderId: FOLDER_ID });
console.log(`Found ${folder.archiveRecords.length} photos (this run)`);

if (DRY_RUN) {
  console.log('\nSample of what would be deleted:');
  folder.archiveRecords.slice(0, 5).forEach(r => console.log(`  ${r.id} — ${r.displayName}`));
  if (folder.archiveRecords.length > 5) console.log(`  … and ${folder.archiveRecords.length - 5} more`);
  console.log('\nNote: due to API pagination, actual total may be higher.');
  console.log('Run with --execute to delete all in repeated passes until folder is empty.');
  process.exit(0);
}

// Delete in passes until folder is empty
let totalDeleted = 0;
let pass = 1;

while (true) {
  console.log(`\nPass ${pass}: fetching records…`);
  const f = await getFolder(CLIENT, { folderId: FOLDER_ID });
  const records = f.archiveRecords;

  if (records.length === 0) {
    console.log('Folder is empty — done!');
    break;
  }

  console.log(`  ${records.length} records found, deleting…`);
  let deleted = 0, failed = 0;

  for (const record of records) {
    try {
      await deleteArchiveRecord(CLIENT, { archiveRecordId: record.id });
      deleted++;
      process.stdout.write(`  ✓ ${record.displayName}\n`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${record.id}: ${err.message}`);
    }
  }

  totalDeleted += deleted;
  console.log(`  Pass ${pass} done: ${deleted} deleted, ${failed} failed`);
  pass++;

  // Safety valve — shouldn't need more than 20 passes for 733 photos
  if (pass > 20) {
    console.error('Too many passes — stopping. Check Permanent.org UI.');
    break;
  }
}

console.log(`\nTotal deleted: ${totalDeleted}`);
