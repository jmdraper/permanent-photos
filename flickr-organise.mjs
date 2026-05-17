/**
 * flickr-organise.mjs
 *
 * Reads Flickr JSON export data and uses it to:
 *   1. Create album folders in Permanent.org matching Flickr albums
 *   2. Move photos into the correct folders (matched by Flickr photo ID in filename)
 *   3. Update photo metadata (display name, description, date taken, tags)
 *
 * USAGE:
 *   # First: dry run — shows what would happen, makes no changes
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=123456 node flickr-organise.mjs --dry-run
 *
 *   # Then: execute for real
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=123456 node flickr-organise.mjs --execute
 *
 * PERMANENT_FOLDER_ID: root Public folder ID from Permanent.org
 *   → Safari → app.permanent.org → DevTools → Storage → Local Storage → "root" key → folderId
 *
 * FLICKR_DATA_DIR: path to your Flickr JSON export folder (default: ~/flickr_data)
 */

import { getFolder, createFolder } from '@permanentorg/sdk';
import { readFileSync, existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
const TOKEN          = process.env.PERMANENT_TOKEN;
const FOLDER_ID      = parseInt(process.env.PERMANENT_FOLDER_ID || '', 10);
const FLICKR_DIR     = process.env.FLICKR_DATA_DIR || join(homedir(), 'flickr_data');
const DRY_RUN        = process.argv.includes('--dry-run');
const EXECUTE        = process.argv.includes('--execute');
const BASE_URL       = 'https://app.permanent.org/api';
// ─────────────────────────────────────────────────────────────────────────────

if (!TOKEN)     { console.error('Error: PERMANENT_TOKEN not set'); process.exit(1); }
if (!FOLDER_ID) { console.error('Error: PERMANENT_FOLDER_ID not set'); process.exit(1); }
if (!DRY_RUN && !EXECUTE) {
  console.error('Usage: node flickr-organise.mjs --dry-run | --execute');
  process.exit(1);
}

const CLIENT = {
  bearerToken:  TOKEN,
  stelaBaseUrl: 'https://api.permanent.org/api/v2',
  baseUrl:      BASE_URL,
};

// ── Legacy API helpers ────────────────────────────────────────────────────────

async function legacyPost(endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization':   `Bearer ${TOKEN}`,
      'Request-Version': '2',
      'Content-Type':    'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${endpoint} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function stelaPost(path, body) {
  const res = await fetch(`https://api.permanent.org/api/v2${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stela ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function createFolderAndGetIds(name, description) {
  // Create via SDK (Stela), then fetch parent to get full folder details
  const folder = await createFolder(CLIENT, {
    folder:       { name, description: description || '' },
    parentFolder: { id: FOLDER_ID },
  });

  // Fetch parent folder to find the new subfolder with all its IDs
  const parent = await getFolder(CLIENT, { folderId: FOLDER_ID });
  const match  = parent.folders.find(f => f.name === name);
  if (!match) throw new Error(`Could not find newly created folder "${name}" in parent`);

  return { stelaId: match.id, fileSystemId: match.fileSystemId, name };
}

async function moveRecord(recordFileSystemId, targetFolderFileSystemId) {
  // Use the Stela API with folderLinkId (fileSystemId) for both record and folder
  const res = await stelaPost(`/record/${recordFileSystemId}/move`, {
    parentFolderLinkId: targetFolderFileSystemId,
  });
  return res;
}

async function getArchiveId() {
  // Try getting archiveId from the legacy record/search or archive/getAllArchives endpoint
  const res = await legacyPost('/archive/getAllArchives', {
    RequestVO: { data: [{}] },
  });
  try {
    const archives = res.Results[0].data;
    if (!archives || !archives.length) throw new Error('No archives returned');
    // Return the first archive's archiveId
    return archives[0].ArchiveVO.archiveId;
  } catch (err) {
    throw new Error(`Could not determine archiveId: ${err.message}`);
  }
}

async function updateRecordMetadata(recordId, archiveId, { displayName, description, displayDate }) {
  const RecordVO = { recordId, archiveId };
  if (displayName) RecordVO.displayName = displayName;
  if (description) RecordVO.description = description;
  if (displayDate) RecordVO.displayDT   = displayDate;
  return legacyPost('/record/update', {
    RequestVO: { data: [{ RecordVO }] },
  });
}

// ── Load Flickr data ──────────────────────────────────────────────────────────

function loadFlickrData() {
  console.log(`Loading Flickr data from ${FLICKR_DIR}…`);

  // Load albums
  const albumsPath = join(FLICKR_DIR, 'albums.json');
  if (!existsSync(albumsPath)) {
    console.error(`albums.json not found at ${albumsPath}`);
    process.exit(1);
  }
  const { albums } = JSON.parse(readFileSync(albumsPath, 'utf8'));
  console.log(`  ${albums.length} albums found`);

  // Load all photo JSONs
  const photoMap = {}; // id → metadata
  const files = require('fs').readdirSync(FLICKR_DIR).filter(f => f.match(/^photo_\d+\.json$/));
  for (const file of files) {
    const photo = JSON.parse(readFileSync(join(FLICKR_DIR, file), 'utf8'));
    photoMap[photo.id] = {
      id:          photo.id,
      name:        photo.name,          // original camera filename (no extension)
      title:       photo.name,          // use name as title (no separate title field)
      description: photo.description || '',
      dateTaken:   photo.date_taken || null,
      tags:        (photo.tags || []).map(t => t.tag),
    };
  }
  console.log(`  ${files.length} photo metadata files found`);

  return { albums, photoMap };
}

// ── Load Permanent.org photos ─────────────────────────────────────────────────

async function loadPermanentPhotos() {
  console.log(`\nLoading photos from Permanent.org folder ${FOLDER_ID}…`);
  const folder = await getFolder(CLIENT, { folderId: FOLDER_ID });
  const photos = folder.archiveRecords;
  console.log(`  ${photos.length} record(s) found in root`);
  return photos; // each has: id, displayName, fileSystemCompatibleName, files[], etc.
}

// ── Match photos ──────────────────────────────────────────────────────────────

// Flickr filenames contain the photo ID: e.g. "50843900293_a9430e1ca6_o.jpg"
// Permanent records have fileSystemCompatibleName from upload
function matchByFlickrId(permanentPhotos, flickrId) {
  return permanentPhotos.find(p => {
    const name = p.displayName || p.fileSystemCompatibleName || '';
    return name.includes(flickrId);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '── DRY RUN (no changes will be made) ──\n' : '── EXECUTE ──\n');

  const { albums, photoMap } = loadFlickrData();
  const permanentPhotos      = await loadPermanentPhotos();

  // Build match report
  let totalMatched   = 0;
  let totalUnmatched = 0;
  const unmatchedIds = [];

  console.log('\n── Matching photos ──');
  for (const [id] of Object.entries(photoMap)) {
    const match = matchByFlickrId(permanentPhotos, id);
    if (match) { totalMatched++; }
    else        { totalUnmatched++; unmatchedIds.push(id); }
  }

  console.log(`  Matched:   ${totalMatched}`);
  console.log(`  Unmatched: ${totalUnmatched}`);
  if (unmatchedIds.length) {
    console.log(`  Unmatched IDs: ${unmatchedIds.slice(0, 10).join(', ')}${unmatchedIds.length > 10 ? '…' : ''}`);
  }

  console.log('\n── Albums to create ──');
  for (const album of albums) {
    const matchedCount = album.photos.filter(id => matchByFlickrId(permanentPhotos, id)).length;
    console.log(`  "${album.title}" — ${album.photos.length} photos, ${matchedCount} matched`);
  }

  if (DRY_RUN) {
    console.log('\nDry run complete. Run with --execute to apply changes.');
    return;
  }

  // ── Execute ──────────────────────────────────────────────────────────────────

  console.log('\n── Creating folders and moving photos ──');

  // Build a set of all photo IDs still in root
  const stillInRoot = new Set(permanentPhotos.map(p => p.fileSystemId));

  for (const album of albums) {
    console.log(`\nAlbum: "${album.title}"`);

    // Create folder and get both its Stela ID and fileSystemId
    let folder;
    try {
      folder = await createFolderAndGetIds(album.title, album.description);
      console.log(`  ✓ Created folder (stelaId: ${folder.stelaId}, fileSystemId: ${folder.fileSystemId})`);
    } catch (err) {
      console.error(`  ✗ Failed to create folder: ${err.message}`);
      continue;
    }

    let moved = 0, skipped = 0, failed = 0;
    for (const photoId of album.photos) {
      const permanent = matchByFlickrId(permanentPhotos, photoId);

      if (!permanent) {
        console.log(`    – Photo ${photoId}: not found in Permanent, skipping`);
        skipped++;
        continue;
      }

      if (!stillInRoot.has(permanent.fileSystemId)) {
        console.log(`    – Photo ${photoId}: already moved, skipping`);
        skipped++;
        continue;
      }

      try {
        await moveRecord(permanent.fileSystemId, folder.fileSystemId);
        stillInRoot.delete(permanent.fileSystemId);
        moved++;
        process.stdout.write(`    ✓ ${photoId} → moved\n`);
      } catch (err) {
        console.error(`    ✗ Move failed for ${photoId}: ${err.message}`);
        failed++;
      }
    }

    console.log(`  Done: ${moved} moved, ${skipped} skipped, ${failed} failed`);
  }

  console.log('\n── All done ──');
}

// Node 18 doesn't have top-level require in ESM — use createRequire
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

run().catch(err => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
