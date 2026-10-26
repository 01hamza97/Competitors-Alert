import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { StagedVisualSpecial, SpecialOfferImage } from '../types';

export class StorageManager {
  private baseDir: string;

  constructor(baseDir = 'crawled_specials') {
    this.baseDir = path.resolve(process.cwd(), baseDir);
  }

  getDealerDir(dealerId: string, dateStr?: string): string {
    const today = dateStr || new Date().toISOString().split('T')[0];
    const dir = path.join(this.baseDir, dealerId, today);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const imgDir = path.join(dir, 'images');
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir, { recursive: true });
    }
    return dir;
  }

  /**
   * Computes sha256 hash of a buffer or URL
   */
  static hashString(val: string): string {
    return crypto.createHash('sha256').update(val).digest('hex');
  }

  /**
   * Downloads an image from URL and saves to disk, returning its hash and local path
   */
  async downloadImage(
    imageUrl: string,
    dealerId: string,
    pageUrl?: string
  ): Promise<{ imageHash: string; localPath: string; fileName: string } | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dir = this.getDealerDir(dealerId, today);
      const imgDir = path.join(dir, 'images');

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Referer: pageUrl || imageUrl
        }
      });

      const buffer = Buffer.from(response.data);
      if (buffer.length < 5000) {
        // Skip tiny icons/placeholders (<5KB)
        return null;
      }

      const imageHash = crypto.createHash('sha256').update(buffer).digest('hex');
      let ext = path.extname(imageUrl.split('?')[0]).toLowerCase();
      if (!ext || ext.length > 5 || !['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext)) {
        ext = '.jpg';
      }

      const fileName = `${imageHash.slice(0, 16)}${ext}`;
      const localPath = path.join(imgDir, fileName);

      fs.writeFileSync(localPath, buffer);
      return { imageHash, localPath, fileName };
    } catch (err: any) {
      console.warn(`[Storage] Failed to download flyer image ${imageUrl}: ${err.message}`);
      return null;
    }
  }

  /**
   * Generates local N8N / Vision AI manifest.json
   */
  generateManifest(
    dealerId: string,
    dealerName: string,
    targetUrl: string,
    visualSpecials: StagedVisualSpecial[]
  ): string {
    const today = new Date().toISOString().split('T')[0];
    const dir = this.getDealerDir(dealerId, today);
    const manifestPath = path.join(dir, 'manifest.json');

    const manifestData = {
      dealerId,
      dealerName,
      targetUrl,
      generatedAt: new Date().toISOString(),
      snapshotDate: today,
      totalVisualSpecials: visualSpecials.length,
      specials: visualSpecials.map((s) => ({
        id: s.id,
        title: s.title,
        specialType: s.specialType,
        imageUrl: s.imageUrl,
        imageHash: s.imageHash,
        localImagePath: s.localImagePath,
        pageUrl: s.pageUrl,
        status: s.status,
        discoveredAt: s.snapshotDate
      }))
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf-8');
    console.log(`[Storage] Generated N8N Vision AI manifest at: ${manifestPath}`);
    return manifestPath;
  }
}
