/**
 * find-missing.mjs
 *
 * Identifies the 70 unmatched Flickr photos and copies them to ~/flickr_missing/
 * ready for upload to Permanent.org via the web UI.
 *
 * USAGE:
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node find-missing.mjs
 */

import { getFolder } from '@permanentorg/sdk';
import { readFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join, extname } from 'path';
import { homedir } from 'os';

const TOKEN         = process.env.PERMANENT_TOKEN;
const FOLDER_ID     = parseInt(process.env.PERMANENT_FOLDER_ID || '', 10);
const FLICKR_DIR    = process.env.FLICKR_DATA_DIR    || join(homedir(), 'flickr_data');
const PHOTOS_DIR    = process.env.FLICKR_PHOTOS_DIR  || join(homedir(), 'flickr_photos');
const OUTPUT_DIR    = join(homedir(), 'flickr_missing');

if (!TOKEN)     { console.error('Error: PERMANENT_TOKEN not set'); process.exit(1); }
if (!FOLDER_ID) { console.error('Error: PERMANENT_FOLDER_ID not set'); process.exit(1); }

const CLIENT = { bearerToken: TOKEN, stelaBaseUrl: 'https://api.permanent.org/api/v2' };

// Load all Flickr photo IDs from JSON files
console.log(`Loading Flickr photo IDs from ${FLICKR_DIR}…`);
const flickrIds = readdirSync(FLICKR_DIR)
  .filter(f => f.match(/^photo_\d+\.json$/))
  .map(f => f.replace('photo_', '').replace('.json', ''));
console.log(`  ${flickrIds.length} Flickr photos in JSON data`);

// Load Permanent.org photos
console.log(`\nLoading Permanent.org photos from folder ${FOLDER_ID}…`);
const folder = await getFolder(CLIENT, { folderId: FOLDER_ID });
const permanentNames = new Set(
  folder.archiveRecords.map(r => r.displayName || r.fileSystemCompatibleName || '')
);
console.log(`  ${folder.archiveRecords.length} photos in Permanent.org`);

// Find unmatched IDs
const unmatched = flickrIds.filter(id => {
  return ![...permanentNames].some(name => name.includes(id));
});
console.log(`\n  ${unmatched.length} unmatched photo IDs`);

if (!unmatched.length) {
  console.log('Nothing missing — all photos are already in Permanent.org!');
  process.exit(0);
}

// Find the actual files in the flickr_photos folder
console.log(`\nSearching for files in ${PHOTOS_DIR}…`);
const allPhotoFiles = readdirSync(PHOTOS_DIR, { recursive: true });

const found = [];
const notFound = [];

for (const id of unmatched) {
  // Flickr filenames start with the photo ID: e.g. 50843946533_abc123_o.jpg
  const match = allPhotoFiles.find(f => {
    const filename = typeof f === 'string' ? f : f.toString();
    return filename.includes(id);
  });

  if (match) {
    found.push({ id, file: match });
  } else {
    notFound.push(id);
  }
}

console.log(`  Found files for: ${found.length}`);
console.log(`  No file found for: ${notFound.length}`);

if (notFound.length) {
  console.log(`\n  IDs with no file (may never have been in the download):`);
  notFound.forEach(id => console.log(`    ${id}`));
}

// Copy found files to output folder
if (found.length) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\nCopying ${found.length} files to ${OUTPUT_DIR}…`);

  for (const { id, file } of found) {
    const filename = typeof file === 'string' ? file.split('/').pop() : file.toString().split('/').pop();
    const src  = join(PHOTOS_DIR, file);
    const dest = join(OUTPUT_DIR, filename);
    copyFileSync(src, dest);
    console.log(`  ✓ ${filename}`);
  }

  console.log(`\nDone. Upload the files in ${OUTPUT_DIR} to Permanent.org via the web UI.`);
  console.log('Then re-run the dry run to confirm all photos are matched before executing.');
}
