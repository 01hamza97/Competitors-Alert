import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

export interface UploadResult {
  storageType: 'r2' | 'local';
  location: string;
  key?: string;
}

export class R2StorageService {
  private static s3Client: S3Client | null = null;
  private static bucketName = process.env.R2_BUCKET_NAME || '';

  /**
   * Returns true if Cloudflare R2 credentials are fully configured in the environment
   */
  static isR2Configured(): boolean {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
    const endpoint = process.env.R2_ENDPOINT?.trim();
    const bucket = process.env.R2_BUCKET_NAME?.trim();

    return Boolean(accessKeyId && secretAccessKey && endpoint && bucket);
  }

  private static getClient(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      });
    }
    return this.s3Client;
  }

  /**
   * Uploads text/HTML/JSON content. If R2 keys are not configured, saves to local disk.
   */
  static async uploadContent(
    content: string,
    keyPath: string,
    contentType = 'text/html'
  ): Promise<UploadResult> {
    if (this.isR2Configured()) {
      try {
        const client = this.getClient();
        await client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: keyPath,
            Body: content,
            ContentType: contentType,
          })
        );
        const r2Url = `${process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT}/${this.bucketName}/${keyPath}`;
        console.log(`[R2 Storage] Uploaded to Cloudflare R2: ${r2Url}`);
        return { storageType: 'r2', location: r2Url, key: keyPath };
      } catch (err: any) {
        console.warn(`[R2 Storage] Upload failed (${err.message}). Falling back to local disk.`);
      }
    } else {
      console.log(`[Storage] Cloudflare R2 not configured. Saving snapshot to local filesystem.`);
    }

    // Local filesystem fallback
    const localFullPath = path.join(process.cwd(), keyPath);
    const dir = path.dirname(localFullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localFullPath, content, 'utf-8');
    return { storageType: 'local', location: localFullPath, key: keyPath };
  }

  /**
   * Uploads a local file to R2 if configured, or leaves it on disk
   */
  static async uploadFile(
    localFilePath: string,
    r2KeyPath: string,
    contentType = 'text/html'
  ): Promise<UploadResult> {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File not found: ${localFilePath}`);
    }

    const content = fs.readFileSync(localFilePath, 'utf-8');
    return this.uploadContent(content, r2KeyPath, contentType);
  }
}
