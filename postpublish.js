const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

const storage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.KEY_FILENAME,
});

const bucketName = process.env.BUCKET_NAME;
const filePath = './lib/cjs-min/index.min.js';
const destination = 'sdk.js';

async function uploadFile() {
  await storage.bucket(bucketName).upload(filePath, {
    destination,
  });
  console.log(`${filePath} uploaded to ${bucketName} as ${destination}`);
}

uploadFile().catch(console.error);
