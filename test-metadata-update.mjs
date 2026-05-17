/**
 * test-metadata-update.mjs
 *
 * Tests updating metadata on a single photo in Permanent.org.
 * Run this first to confirm the API works before applying to all photos.
 *
 * USAGE:
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node test-metadata-update.mjs
 */

import { getFolder } from '@permanentorg/sdk';

const TOKEN     = process.env.PERMANENT_TOKEN;
const FOLDER_ID = parseInt(process.env.PERMANENT_FOLDER_ID || '', 10);

if (!TOKEN)     { console.error('Error: PERMANENT_TOKEN not set'); process.exit(1); }
if (!FOLDER_ID) { console.error('Error: PERMANENT_FOLDER_ID not set'); process.exit(1); }

const CLIENT = {
  bearerToken:  TOKEN,
  stelaBaseUrl: 'https://api.permanent.org/api/v2',
  baseUrl:      'https://app.permanent.org/api',
};

// Get the first photo from the first subfolder
console.log('Fetching folder structure...');
const root = await getFolder(CLIENT, { folderId: FOLDER_ID });
const firstSubfolder = root.folders[0];
console.log(`Using subfolder: "${firstSubfolder.name}" (id: ${firstSubfolder.id})`);

const subfolder = await getFolder(CLIENT, { folderId: firstSubfolder.id });
const testRecord = subfolder.archiveRecords[0];
if (!testRecord) { console.error('No photos found in first subfolder'); process.exit(1); }

console.log(`Test photo: "${testRecord.displayName}" (id: ${testRecord.id})`);
console.log(`Current displayName: ${testRecord.displayName}`);

const archiveId = 27787;
const recordId  = testRecord.id;

// Try 3 worked — RequestVO without Request-Version header
console.log('\nUpdating with working format...');
const res = await fetch('https://app.permanent.org/api/record/update', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    RequestVO: {
      data: [{
        RecordVO: {
          recordId,
          archiveId,
          description: 'Test description from API — if you can see this it worked!',
          displayName: 'TEST UPDATED NAME',
        }
      }]
    }
  }),
});

const data = await res.json();
console.log(`Status: ${res.status}`);
console.log(`isSuccessful: ${data.isSuccessful}`);
const record = data?.Results?.[0]?.data?.[0]?.RecordVO;
if (record) {
  console.log(`displayName: ${record.displayName}`);
  console.log(`description: ${record.description}`);
  console.log('\nCheck the photo in Permanent.org UI to confirm it updated!');
} else {
  console.log('Full response:', JSON.stringify(data).slice(0, 500));
}
