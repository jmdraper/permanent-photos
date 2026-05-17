import { getFolder } from '@permanentorg/sdk';

const CLIENT = { bearerToken: process.env.PERMANENT_TOKEN, stelaBaseUrl: 'https://api.permanent.org/api/v2' };
const FOLDER_ID = parseInt(process.env.PERMANENT_FOLDER_ID);

const folder = await getFolder(CLIENT, { folderId: FOLDER_ID });
console.log(`Root folder has ${folder.archiveRecords.length} direct photos`);
console.log(`Sub-folders (${folder.folders.length}):`);
for (const f of folder.folders) {
  const sub = await getFolder(CLIENT, { folderId: f.id });
  console.log(`  "${f.name}" (id: ${f.id}) — ${sub.archiveRecords.length} photos, ${sub.folders.length} sub-folders`);
}
