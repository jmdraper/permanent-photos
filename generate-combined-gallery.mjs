/**
 * generate-combined-gallery.mjs
 *
 * Fetches photos from Permanent.org and galleries from Flickr,
 * merges them by year, and outputs combined-gallery.json.
 *
 * Permanent albums must be organised in year-named root folders (2026, 2025, etc.)
 * Flickr galleries must have a "year" field in flickr-galleries-config.json
 *
 * USAGE:
 *   PERMANENT_TOKEN="eyJ..." PERMANENT_FOLDER_ID=232580 node generate-combined-gallery.mjs
 */

import { getFolder } from '@permanentorg/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const TOKEN     = process.env.PERMANENT_TOKEN;
const FOLDER_ID = parseInt(process.env.PERMANENT_FOLDER_ID || '', 10);
const FLICKR_CONFIG = './flickr-galleries-config.json';
const OUTPUT    = './combined-gallery.json';
const IMAGE_TYPE = 'type.record.image';

if (!TOKEN)     { console.error('Error: PERMANENT_TOKEN not set'); process.exit(1); }
if (!FOLDER_ID) { console.error('Error: PERMANENT_FOLDER_ID not set'); process.exit(1); }

const CLIENT = {
  bearerToken:  TOKEN,
  stelaBaseUrl: 'https://api.permanent.org/api/v2',
  baseUrl:      'https://app.permanent.org/api',
};

// ── Flickr oEmbed ─────────────────────────────────────────────────────────────

const AUTHOR_NAMES = { 'alh1': 'Allan Harris' };
function displayName(n) { return AUTHOR_NAMES[n] || n; }

async function fetchOEmbed(photoUrl) {
  const url = `https://www.flickr.com/services/oembed/?url=${encodeURIComponent(photoUrl)}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`oEmbed ${res.status} for ${photoUrl}`);
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {

  // ── 1. Load Flickr config ───────────────────────────────────────────────────
  const flickrByYear = {}; // year → [gallery]
  if (existsSync(FLICKR_CONFIG)) {
    const config = JSON.parse(readFileSync(FLICKR_CONFIG, 'utf8'));
    console.log(`Loading ${config.length} Flickr galleries…`);
    for (const entry of config) {
      const year = String(entry.year || 'Unknown');
      if (!flickrByYear[year]) flickrByYear[year] = [];
      let coverUrl = null, photographer = null;
      try {
        const oembed = await fetchOEmbed(entry.coverPhotoUrl);
        coverUrl     = oembed.url;
        photographer = displayName(oembed.author_name);
        console.log(`  ✓ "${entry.title}" (${year})`);
      } catch (err) {
        console.error(`  ✗ "${entry.title}": ${err.message}`);
      }
      flickrByYear[year].push({
        type:         'flickr',
        name:         entry.title,
        photographer: photographer || 'Allan Harris',
        coverUrl,
        flickrUrl:    entry.flickrUrl,
      });
    }
  } else {
    console.log('No flickr-galleries-config.json found, skipping Flickr galleries.');
  }

  // ── 2. Load Permanent.org structure ────────────────────────────────────────
  console.log(`\nLoading Permanent.org folder ${FOLDER_ID}…`);
  const root = await getFolder(CLIENT, { folderId: FOLDER_ID });
  const permanentByYear = {}; // year → [album]

  for (const yearFolder of root.folders) {
    const year = yearFolder.name;
    console.log(`  Year: ${year}`);
    permanentByYear[year] = [];

    const yearContents = await getFolder(CLIENT, { folderId: yearFolder.id });

    // Photos directly in year folder (not in sub-albums)
    const directPhotos = yearContents.archiveRecords
      .filter(r => r.type === IMAGE_TYPE)
      .map(mapPhoto);

    if (directPhotos.length) {
      permanentByYear[year].push({
        type:         'permanent',
        name:         year,
        photographer: yearFolder.description || null,
        coverUrl:     directPhotos[0].thumbUrl,
        photos:       directPhotos,
      });
    }

    // Sub-album folders
    for (const albumFolder of yearContents.folders) {
      const albumContents = await getFolder(CLIENT, { folderId: albumFolder.id });
      const photos = albumContents.archiveRecords
        .filter(r => r.type === IMAGE_TYPE)
        .map(mapPhoto);

      const coverUrl = photos[0]?.thumbUrl || null;
      const photographer = albumFolder.description || null;

      permanentByYear[year].push({
        type:         'permanent',
        name:         albumFolder.name,
        photographer,
        coverUrl,
        photos,
      });

      console.log(`    Album: "${albumFolder.name}" — ${photos.length} photos${photographer ? ` — ${photographer}` : ''}`);
    }
  }

  // ── 3. Merge by year ────────────────────────────────────────────────────────
  const allYears = new Set([
    ...Object.keys(permanentByYear),
    ...Object.keys(flickrByYear),
  ]);

  const years = Array.from(allYears)
    .sort((a, b) => b.localeCompare(a)) // descending
    .filter(year => year.albums.length > 0)
    .map(year => {
      const permanent = permanentByYear[year] || [];
      const flickr    = flickrByYear[year]    || [];

      // Year tile cover: first Flickr cover if available, else first Permanent cover
      const flickrCover    = flickr.find(g => g.coverUrl)?.coverUrl || null;
      const permanentCover = permanent.find(a => a.coverUrl)?.coverUrl || null;
      const coverUrl       = flickrCover || permanentCover;

      // Albums: permanent first, then flickr (within year, preserve order)
      const albums = [...permanent, ...flickr];

      return { year, coverUrl, albums };
    });

  // ── 4. Write output ─────────────────────────────────────────────────────────
  const output = {
    generatedAt:  new Date().toISOString(),
    totalYears:   years.length,
    totalAlbums:  years.reduce((n, y) => n + y.albums.length, 0),
    years,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`\n✓ Wrote ${years.length} years, ${output.totalAlbums} albums to ${OUTPUT}`);
}

function mapPhoto(record) {
  const original  = record.files?.find(f => f.derivativeType === 'file.format.original');
  const converted = record.files?.find(f => f.derivativeType === 'file.format.converted');
  const fallback  = record.files?.[0];
  return {
    id:       record.id,
    title:    record.displayName || 'Untitled',
    date:     record.displayDate?.toISOString() ?? record.createdAt?.toISOString() ?? null,
    thumbUrl: (converted || original || fallback)?.fileUrl || null,
    fullUrl:  (original || fallback)?.fileUrl || null,
  };
}

run().catch(err => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
