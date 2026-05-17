/**
 * flickr-upload.mjs
 *
 * Reads Flickr JSON export, creates album folders in Permanent.org,
 * and uploads photos directly into the correct folders with display names set.
 *
 * USAGE:
 *   # Dry run first — shows what would happen
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node flickr-upload.mjs --dry-run
 *
 *   # Execute
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node flickr-upload.mjs --execute
 *
 * ENV VARS:
 *   PERMANENT_TOKEN       Bearer token from Permanent.org localStorage
 *   PERMANENT_FOLDER_ID   Root Public folder ID (232580 for YMS)
 *   FLICKR_DATA_DIR       Path to Flickr JSON files (default: ~/flickr_data)
 *   FLICKR_PHOTOS_DIR     Path to Flickr photo files (default: ~/flickr_photos)
 */

import { uploadFile, createArchiveRecord, createFolder, getFolder } from '@permanentorg/sdk';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, extname, basename } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
const TOKEN       = process.env.PERMANENT_TOKEN;
const FOLDER_ID   = parseInt(process.env.PERMANENT_FOLDER_ID || '', 10);
const FLICKR_DIR  = process.env.FLICKR_DATA_DIR   || join(homedir(), 'flickr_data');
const PHOTOS_DIR  = process.env.FLICKR_PHOTOS_DIR || join(homedir(), 'flickr_photos');
const PROGRESS    = './upload-progress.json';
const DRY_RUN     = process.argv.includes('--dry-run');
const EXECUTE     = process.argv.includes('--execute');
// ─────────────────────────────────────────────────────────────────────────────

if (!TOKEN)     { console.error('Error: PERMANENT_TOKEN not set'); process.exit(1); }
if (!FOLDER_ID) { console.error('Error: PERMANENT_FOLDER_ID not set'); process.exit(1); }
if (!DRY_RUN && !EXECUTE) {
  console.error('Usage: node flickr-upload.mjs --dry-run | --execute');
  process.exit(1);
}

const CLIENT = {
  bearerToken:  TOKEN,
  stelaBaseUrl: 'https://api.permanent.org/api/v2',
  baseUrl:      'https://app.permanent.org/api',
};

const PARENT_FOLDER = { id: FOLDER_ID };

const MIME = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.tif':  'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp':  'image/bmp',
};

// ── Progress tracking ─────────────────────────────────────────────────────────

function loadProgress() {
  if (!existsSync(PROGRESS)) return { uploaded: [], failed: [] };
  try { return JSON.parse(readFileSync(PROGRESS, 'utf8')); }
  catch { return { uploaded: [], failed: [] }; }
}

function saveProgress(p) {
  writeFileSync(PROGRESS, JSON.stringify(p, null, 2));
}

// ── Load Flickr data ──────────────────────────────────────────────────────────

function loadFlickrData() {
  const albumsPath = join(FLICKR_DIR, 'albums.json');
  if (!existsSync(albumsPath)) {
    console.error(`albums.json not found at ${albumsPath}`);
    process.exit(1);
  }
  const { albums } = JSON.parse(readFileSync(albumsPath, 'utf8'));

  // Load all photo JSONs into a map by ID
  const photoMap = {};
  const jsonFiles = readdirSync(FLICKR_DIR).filter(f => f.match(/^photo_\d+\.json$/));
  for (const f of jsonFiles) {
    const photo = JSON.parse(readFileSync(join(FLICKR_DIR, f), 'utf8'));
    photoMap[photo.id] = {
      id:          photo.id,
      displayName: photo.name || photo.id,
      description: photo.description || '',
      dateTaken:   photo.date_taken || null,
      tags:        (photo.tags || []).map(t => t.tag),
    };
  }

  return { albums, photoMap };
}

// ── Find photo file on disk ───────────────────────────────────────────────────

// Build a lookup map from Flickr ID → file path (search all subdirs once)
function buildFileIndex(dir) {
  const index = {};
  function scan(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) { scan(full); continue; }
      const ext = extname(entry.name).toLowerCase();
      if (!MIME[ext]) continue;
      // Extract Flickr ID from filename: anything_FLICKRID_o.jpg
      const match = entry.name.match(/_(\d{10,})_o\./);
      if (match) index[match[1]] = full;
    }
  }
  scan(dir);
  return index;
}

// ── Upload one photo ──────────────────────────────────────────────────────────

async function uploadPhoto(filePath, displayName, folderId) {
  const ext         = extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'image/jpeg';
  const fileName    = basename(filePath);
  const stat        = statSync(filePath);
  const fileData    = readFileSync(filePath);

  const file = { contentType, size: stat.size };
  const item = { displayName, fileSystemCompatibleName: fileName };
  const folder = { id: folderId };

  const s3Url = await uploadFile(CLIENT, { fileData, file, item, parentFolder: folder });
  await createArchiveRecord(CLIENT, { s3Url, file, item, parentFolder: folder, failOnDuplicateName: false });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '── DRY RUN ──\n' : '── EXECUTE ──\n');

  const { albums, photoMap } = loadFlickrData();
  console.log(`Loaded ${albums.length} albums, ${Object.keys(photoMap).length} photo metadata files`);

  console.log(`\nIndexing files in ${PHOTOS_DIR}…`);
  const fileIndex = buildFileIndex(PHOTOS_DIR);
  console.log(`  ${Object.keys(fileIndex).length} image files found`);

  // Deduplicate: each photo uploaded to first album only
  const uploadedIds = new Set();

  // Stats
  let totalAlbums = 0, totalPhotos = 0, totalMissing = 0, totalDupes = 0;

  console.log('\n── Albums ──');
  for (const album of albums) {
    const matchable = album.photos.filter(id => {
      if (!fileIndex[id]) { totalMissing++; return false; }
      if (uploadedIds.has(id)) { totalDupes++; return false; }
      return true;
    });
    console.log(`  "${album.title}" — ${matchable.length} photos to upload`);
    totalAlbums++;
    totalPhotos += matchable.length;
  }

  console.log(`\nTotal: ${totalAlbums} albums, ${totalPhotos} photos to upload`);
  console.log(`       ${totalMissing} missing files, ${totalDupes} cross-album duplicates (will be skipped)`);

  if (DRY_RUN) {
    console.log('\nRun with --execute to proceed.');
    return;
  }

  // ── Execute ──────────────────────────────────────────────────────────────────

  const progress = loadProgress();
  const doneSet  = new Set(progress.uploaded);

  console.log('\n── Uploading ──');

  for (const album of albums) {
    console.log(`\nAlbum: "${album.title}"`);

    // Create folder
    let folder;
    try {
      folder = await createFolder(CLIENT, {
        folder:       { name: album.title, description: '' },
        parentFolder: PARENT_FOLDER,
      });
      console.log(`  ✓ Folder created (id: ${folder.id})`);
    } catch (err) {
      console.error(`  ✗ Failed to create folder: ${err.message}`);
      continue;
    }

    let uploaded = 0, skipped = 0, failed = 0;

    for (const photoId of album.photos) {
      const filePath = fileIndex[photoId];
      const meta     = photoMap[photoId];

      // Skip if file not found
      if (!filePath) {
        console.log(`    – ${photoId}: no file found, skipping`);
        skipped++;
        continue;
      }

      // Skip cross-album duplicates
      if (uploadedIds.has(photoId)) {
        console.log(`    – ${photoId}: already uploaded to another album, skipping`);
        skipped++;
        continue;
      }

      // Skip if already done in a previous run
      if (doneSet.has(photoId)) {
        console.log(`    – ${photoId}: already uploaded (resuming), skipping`);
        uploadedIds.add(photoId);
        skipped++;
        continue;
      }

      // Upload
      try {
        const displayName = meta?.displayName || photoId;
        await uploadPhoto(filePath, displayName, folder.id);
        uploadedIds.add(photoId);
        doneSet.add(photoId);
        progress.uploaded.push(photoId);
        uploaded++;
        process.stdout.write(`    ✓ ${photoId} "${displayName}"\n`);
      } catch (err) {
        failed++;
        const msg = err.statusCode === 401 ? 'AUTH_EXPIRED' : (err.message || String(err));
        console.error(`    ✗ ${photoId}: ${msg}`);
        if (err.statusCode === 401) {
          console.error('\nToken expired — refresh PERMANENT_TOKEN and re-run.');
          saveProgress(progress);
          process.exit(2);
        }
        if (!progress.failed.includes(photoId)) progress.failed.push(photoId);
      }

      // Save progress every 10 uploads
      if ((uploaded + failed) % 10 === 0) saveProgress(progress);
    }

    saveProgress(progress);
    console.log(`  Done: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
  }

  console.log('\n── All done ──');
  console.log(`Progress saved to ${PROGRESS}`);
}

run().catch(err => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
