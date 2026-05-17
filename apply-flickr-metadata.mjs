/**
 * apply-flickr-metadata.mjs
 *
 * Applies Flickr metadata (description, tags, date) to photos in Permanent.org.
 * Matches by displayName (= photo.name from Flickr JSON) within each album folder.
 *
 * USAGE:
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node apply-flickr-metadata.mjs --dry-run
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node apply-flickr-metadata.mjs --execute
 */

import { getFolder } from '@permanentorg/sdk';
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TOKEN      = process.env.PERMANENT_TOKEN;
const FOLDER_ID  = parseInt(process.env.PERMANENT_FOLDER_ID || '', 10);
const FLICKR_DIR = process.env.FLICKR_DATA_DIR || join(homedir(), 'flickr_data');
const ARCHIVE_ID = 27787;
const PROGRESS   = './metadata-progress.json';
const DRY_RUN    = process.argv.includes('--dry-run');
const EXECUTE    = process.argv.includes('--execute');

if (!TOKEN)     { console.error('Error: PERMANENT_TOKEN not set'); process.exit(1); }
if (!FOLDER_ID) { console.error('Error: PERMANENT_FOLDER_ID not set'); process.exit(1); }
if (!DRY_RUN && !EXECUTE) {
  console.error('Usage: node apply-flickr-metadata.mjs --dry-run | --execute');
  process.exit(1);
}

const CLIENT = {
  bearerToken:  TOKEN,
  stelaBaseUrl: 'https://api.permanent.org/api/v2',
  baseUrl:      'https://app.permanent.org/api',
};

// ── Load Flickr data ──────────────────────────────────────────────────────────

console.log(`Loading Flickr data from ${FLICKR_DIR}…`);

// albums: albumTitle → Set of photoIds
const { albums } = JSON.parse(readFileSync(join(FLICKR_DIR, 'albums.json'), 'utf8'));

// photoMap: photoId → { name, description, tags, dateTaken }
const photoMap = {};
for (const f of readdirSync(FLICKR_DIR).filter(f => f.match(/^photo_\d+\.json$/))) {
  const p = JSON.parse(readFileSync(join(FLICKR_DIR, f), 'utf8'));
  photoMap[p.id] = {
    name:        p.name || '',
    description: p.description?.trim() || '',
    tags:        (p.tags || []).map(t => t.tag),
    dateTaken:   p.date_taken || null,
  };
}

// Build albumTitle → [photoMeta] lookup (with names for matching)
const albumPhotosByTitle = {};
for (const album of albums) {
  albumPhotosByTitle[album.title] = album.photos
    .map(id => photoMap[id])
    .filter(Boolean);
}

console.log(`  ${albums.length} albums, ${Object.keys(photoMap).length} photos loaded`);

// ── Load Permanent.org folders and records ────────────────────────────────────

console.log('\nLoading Permanent.org folders…');
const root = await getFolder(CLIENT, { folderId: FOLDER_ID });

// Build matches: [ { record, meta, ambiguous } ]
const toUpdate = [];
let totalAmbiguous = 0;
let totalNoMatch   = 0;

for (const subfolder of root.folders) {
  const folder       = await getFolder(CLIENT, { folderId: subfolder.id });
  const flickrPhotos = albumPhotosByTitle[subfolder.name] || [];

  // Build name → [photo] lookup for this album
  const byName = {};
  for (const photo of flickrPhotos) {
    if (!byName[photo.name]) byName[photo.name] = [];
    byName[photo.name].push(photo);
  }

  for (const record of folder.archiveRecords) {
    const candidates = byName[record.displayName] || [];

    if (candidates.length === 0) {
      totalNoMatch++;
      continue;
    }

    if (candidates.length === 1) {
      // Unique match — apply all metadata including date
      toUpdate.push({ record, meta: candidates[0], ambiguous: false });
    } else {
      // Multiple photos share this name — apply description/tags but not date
      const merged = {
        name:        candidates[0].name,
        description: candidates[0].description,
        tags:        candidates[0].tags,
        dateTaken:   null, // skip — can't tell which date belongs to which copy
      };
      toUpdate.push({ record, meta: merged, ambiguous: true });
      totalAmbiguous++;
    }
  }
}

const withDesc  = toUpdate.filter(x => x.meta.description).length;
const withDate  = toUpdate.filter(x => x.meta.dateTaken && !x.ambiguous).length;

console.log(`  ${toUpdate.length} records matched`);
console.log(`  ${withDesc} have descriptions`);
console.log(`  ${withDate} have unique dates (will be applied)`);
console.log(`  ${totalAmbiguous} ambiguous (date skipped, description/tags applied)`);
console.log(`  ${totalNoMatch} no match`);

if (DRY_RUN) {
  console.log('\nSample:');
  toUpdate.filter(x => x.meta.description).slice(0, 5).forEach(({ record, meta, ambiguous }) => {
    console.log(`  "${record.displayName}"${ambiguous ? ' [ambiguous]' : ''}`);
    console.log(`    desc: "${meta.description.slice(0, 60)}"`);
    if (meta.dateTaken) console.log(`    date: ${meta.dateTaken}`);
  });
  console.log('\nRun with --execute to apply.');
  process.exit(0);
}

// ── Execute ───────────────────────────────────────────────────────────────────

function loadProgress() {
  if (!existsSync(PROGRESS)) return { done: [], failed: [] };
  try { return JSON.parse(readFileSync(PROGRESS, 'utf8')); }
  catch { return { done: [], failed: [] }; }
}
function saveProgress(p) { writeFileSync(PROGRESS, JSON.stringify(p, null, 2)); }

const progress = loadProgress();
const doneSet  = new Set(progress.done);

console.log('\n── Applying metadata ──');
let updated = 0, skipped = 0, failed = 0;

for (const { record, meta } of toUpdate) {
  const key = `${record.id}`;
  if (doneSet.has(key)) { skipped++; continue; }

  // Only update fields that have values
  const RecordVO = { recordId: record.id, archiveId: ARCHIVE_ID };
  if (meta.description) RecordVO.description = meta.description;
  if (meta.dateTaken)   RecordVO.displayDT   = meta.dateTaken;

  // Skip if nothing to update
  if (!meta.description && !meta.dateTaken) { skipped++; continue; }

  try {
    const res  = await fetch('https://app.permanent.org/api/record/update', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ RequestVO: { data: [{ RecordVO }] } }),
    });
    const data = await res.json();
    if (!data.isSuccessful) throw new Error(data.Results?.[0]?.message?.join(', ') || 'failed');

    doneSet.add(key);
    progress.done.push(key);
    updated++;
    process.stdout.write(`  ✓ "${record.displayName}"\n`);
  } catch (err) {
    failed++;
    console.error(`  ✗ "${record.displayName}": ${err.message}`);
    if (!progress.failed.includes(key)) progress.failed.push(key);
  }

  if ((updated + failed) % 20 === 0) saveProgress(progress);
}

saveProgress(progress);
console.log(`\n── Done ──`);
console.log(`Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
