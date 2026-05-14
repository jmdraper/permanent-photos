/**
 * generate-flickr-galleries.mjs
 *
 * Reads flickr-galleries-config.json, fetches cover photo data from Flickr's
 * oEmbed API for each gallery, and writes flickr-galleries.json.
 *
 * Run as part of the GitHub Actions workflow alongside generate-manifest.mjs,
 * or locally:
 *   node generate-flickr-galleries.mjs
 *
 * No API key required — uses Flickr's public oEmbed endpoint.
 */

import { readFileSync, writeFileSync } from 'fs';

const CONFIG_FILE = './flickr-galleries-config.json';
const OUTPUT_FILE = './flickr-galleries.json';

const OEMBED_URL = 'https://www.flickr.com/services/oembed/';

// ── Author display name overrides ────────────────────────────────────────────
// Map Flickr usernames to display names for the widget credit line.
// Add more entries here if you use photos from other photographers.
const AUTHOR_NAMES = {
  'alh1': 'Allan Harris',
};

function displayName(flickrUsername) {
  return AUTHOR_NAMES[flickrUsername] || flickrUsername;
}

async function fetchOEmbed(photoUrl) {
  const url = `${OEMBED_URL}?url=${encodeURIComponent(photoUrl)}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`oEmbed fetch failed: ${res.status} for ${photoUrl}`);
  return res.json();
}

async function run() {
  console.log(`Reading config from ${CONFIG_FILE}…`);
  const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  console.log(`  ${config.length} galleries configured`);

  const galleries = [];

  for (const entry of config) {
    console.log(`\nProcessing: "${entry.title}"`);
    console.log(`  Gallery URL:   ${entry.flickrUrl}`);
    console.log(`  Cover photo:   ${entry.coverPhotoUrl}`);

    let cover;
    try {
      const oembed = await fetchOEmbed(entry.coverPhotoUrl);
      cover = {
        imageUrl:    oembed.url,
        thumbUrl:    oembed.thumbnail_url,
        title:       oembed.title,
        authorName:  displayName(oembed.author_name),
        authorUrl:   oembed.author_url,
        license:     oembed.license,
        licenseUrl:  oembed.license_url,
      };
      console.log(`  ✓ Cover: "${cover.title}" by ${cover.authorName}`);
    } catch (err) {
      console.error(`  ✗ Could not fetch cover: ${err.message}`);
      cover = null;
    }

    galleries.push({
      title:       entry.title,
      flickrUrl:   entry.flickrUrl,
      cover,
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    totalGalleries: galleries.length,
    galleries,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✓ Wrote ${galleries.length} galleries to ${OUTPUT_FILE}`);
}

run().catch(err => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
