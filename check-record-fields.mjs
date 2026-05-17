import { getFolder } from '@permanentorg/sdk';

const TOKEN     = process.env.PERMANENT_TOKEN;
const FOLDER_ID = parseInt(process.env.PERMANENT_FOLDER_ID || '', 10);

const CLIENT = {
  bearerToken:  TOKEN,
  stelaBaseUrl: 'https://api.permanent.org/api/v2',
  baseUrl:      'https://app.permanent.org/api',
};

const root = await getFolder(CLIENT, { folderId: FOLDER_ID });
const first = await getFolder(CLIENT, { folderId: root.folders[0].id });
const records = first.archiveRecords.slice(0, 3);

for (const r of records) {
  console.log('--- record ---');
  console.log('id:                     ', r.id);
  console.log('fileSystemId:           ', r.fileSystemId);
  console.log('displayName:            ', r.displayName);
  console.log('fileSystemCompatibleName:', r.fileSystemCompatibleName);
  console.log('files[0].fileUrl:       ', r.files?.[0]?.fileUrl?.slice(0, 80));
}
