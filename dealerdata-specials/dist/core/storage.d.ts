import { StagedVisualSpecial } from '../types';
export declare class StorageManager {
    private baseDir;
    constructor(baseDir?: string);
    getDealerDir(dealerId: string, dateStr?: string): string;
    /**
     * Computes sha256 hash of a buffer or URL
     */
    static hashString(val: string): string;
    /**
     * Downloads an image from URL and saves to disk, returning its hash and local path
     */
    downloadImage(imageUrl: string, dealerId: string, pageUrl?: string): Promise<{
        imageHash: string;
        localPath: string;
        fileName: string;
    } | null>;
    /**
     * Generates local N8N / Vision AI manifest.json
     */
    generateManifest(dealerId: string, dealerName: string, targetUrl: string, visualSpecials: StagedVisualSpecial[]): string;
}
