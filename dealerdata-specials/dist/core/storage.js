"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
class StorageManager {
    baseDir;
    constructor(baseDir = 'crawled_specials') {
        this.baseDir = path_1.default.resolve(process.cwd(), baseDir);
    }
    getDealerDir(dealerId, dateStr) {
        const today = dateStr || new Date().toISOString().split('T')[0];
        const dir = path_1.default.join(this.baseDir, dealerId, today);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        const imgDir = path_1.default.join(dir, 'images');
        if (!fs_1.default.existsSync(imgDir)) {
            fs_1.default.mkdirSync(imgDir, { recursive: true });
        }
        return dir;
    }
    /**
     * Computes sha256 hash of a buffer or URL
     */
    static hashString(val) {
        return crypto_1.default.createHash('sha256').update(val).digest('hex');
    }
    /**
     * Downloads an image from URL and saves to disk, returning its hash and local path
     */
    async downloadImage(imageUrl, dealerId, pageUrl) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const dir = this.getDealerDir(dealerId, today);
            const imgDir = path_1.default.join(dir, 'images');
            const response = await axios_1.default.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    Referer: pageUrl || imageUrl
                }
            });
            const buffer = Buffer.from(response.data);
            if (buffer.length < 5000) {
                // Skip tiny icons/placeholders (<5KB)
                return null;
            }
            const imageHash = crypto_1.default.createHash('sha256').update(buffer).digest('hex');
            let ext = path_1.default.extname(imageUrl.split('?')[0]).toLowerCase();
            if (!ext || ext.length > 5 || !['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext)) {
                ext = '.jpg';
            }
            const fileName = `${imageHash.slice(0, 16)}${ext}`;
            const localPath = path_1.default.join(imgDir, fileName);
            fs_1.default.writeFileSync(localPath, buffer);
            return { imageHash, localPath, fileName };
        }
        catch (err) {
            console.warn(`[Storage] Failed to download flyer image ${imageUrl}: ${err.message}`);
            return null;
        }
    }
    /**
     * Generates local N8N / Vision AI manifest.json
     */
    generateManifest(dealerId, dealerName, targetUrl, visualSpecials) {
        const today = new Date().toISOString().split('T')[0];
        const dir = this.getDealerDir(dealerId, today);
        const manifestPath = path_1.default.join(dir, 'manifest.json');
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
        fs_1.default.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf-8');
        console.log(`[Storage] Generated N8N Vision AI manifest at: ${manifestPath}`);
        return manifestPath;
    }
}
exports.StorageManager = StorageManager;
