import { getFolder } from '@permanentorg/sdk';
import { writeFileSync } from 'fs';

const TOKEN     = process.env.PERMANENT_TOKEN;
const FOLDER_ID = parseInt(process.env.PERMANENT_FOLDER_ID || '', 10);
const OUTPUT    = './photos.json';

if (!TOKEN) { console.error('Error: PERMANENT_TOKEN not set'); process.exit(1); }
if (!FOLDER_ID || isNaN(FOLDER_ID)) { console.error('Error: PERMANENT_FOLDER_ID not set'); process.exit(1); }

const CLIENT = { bearerToken: TOKEN, stelaBaseUrl: 'https://api.permanent.org/api/v2' };
const IMAGE_TYPE = 'type.record.image';

async function run() {
  console.log(`Fetching folder ${FOLDER_ID}…`);
  const photos = [];
  await collectPhotos(FOLDER_ID, [], photos, 0);
  const manifest = { generatedAt: new Date().toISOString(), totalPhotos: photos.length, photos };
  writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2));
  console.log(`\n✓ Wrote ${photos.length} photos to ${OUTPUT}`);
}

async function collectPhotos(folderId, pathSoFar, photos, depth) {
  const indent = '  '.repeat(depth);
  const displayPath = pathSoFar.length ? pathSoFar.join(' / ') : '(root)';
  console.log(`${indent}Scanning: ${displayPath}`);

  let folder;
  try {
    folder = await getFolder(CLIENT, { folderId });
  } catch (err) {
    // Exit code 2 = token expired or auth failure — triggers the notification webhook
    if (err.statusCode === 401 || err.statusCode === 403) {
      console.error('AUTH_EXPIRED: Bearer token is no longer valid. Please refresh PERMANENT_TOKEN in GitHub secrets.');
      process.exit(2);
    }
    console.error(`${indent}  Could not load folder ${folderId}: ${err.message}`);
    return;
  }

  for (const record of folder.archiveRecords) {
    if (record.type !== IMAGE_TYPE) continue;
    const original  = record.files.find(f => f.derivativeType === 'file.format.original');
    const converted = record.files.find(f => f.derivativeType === 'file.format.converted');
    const fallback  = record.files[0];
    const fullUrl  = (original || fallback)?.fileUrl;
    const thumbUrl = (converted || original || fallback)?.fileUrl;
    if (!fullUrl) continue;
    photos.push({
      id:       record.id,
      title:    record.displayName || record.fileSystemCompatibleName || 'Untitled',
      date:     record.displayDate?.toISOString() ?? record.createdAt?.toISOString() ?? null,
      thumbUrl,
      fullUrl,
      folderPath: [...pathSoFar],
    });
  }

  const imageCount = folder.archiveRecords.filter(r => r.type === IMAGE_TYPE).length;
  console.log(`${indent}  ${imageCount} image(s)`);

  for (const sub of folder.folders) {
    await collectPhotos(sub.id, [...pathSoFar, sub.name], photos, depth + 1);
  }
}

run().catch(err => {
  if (err.statusCode === 401 || err.statusCode === 403) {
    console.error('AUTH_EXPIRED: Bearer token is no longer valid. Please refresh PERMANENT_TOKEN in GitHub secrets.');
    process.exit(2);
  }
  console.error('Error:', err.message || err);
  process.exit(1);
});
