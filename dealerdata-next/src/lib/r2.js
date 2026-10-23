import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

export function isR2Configured() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.R2_ENDPOINT?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();

  return Boolean(accessKeyId && secretAccessKey && endpoint && bucket);
}

export function getR2Client() {
  if (!isR2Configured()) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function readCrawlManifest(dealerId, dateString) {
  // If R2 is configured, try fetching from R2
  if (isR2Configured()) {
    try {
      const client = getR2Client();
      const key = `crawled_html/${dealerId}/${dateString}/manifest.json`;
      const res = await client.send(
        new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
        })
      );
      const str = await res.Body.transformToString();
      return JSON.parse(str);
    } catch {
      // Fallback to local
    }
  }

  // Fallback to local file in scraper directory
  const localPath = path.join(process.cwd(), '..', 'dealerdata-scraper', 'crawled_html', dealerId, dateString, 'manifest.json');
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, 'utf-8'));
  }

  return null;
}
