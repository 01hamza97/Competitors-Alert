"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2StorageService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_s3_1 = require("@aws-sdk/client-s3");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class R2StorageService {
    static s3Client = null;
    static bucketName = process.env.R2_BUCKET_NAME || '';
    /**
     * Returns true if Cloudflare R2 credentials are fully configured in the environment
     */
    static isR2Configured() {
        const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
        const endpoint = process.env.R2_ENDPOINT?.trim();
        const bucket = process.env.R2_BUCKET_NAME?.trim();
        return Boolean(accessKeyId && secretAccessKey && endpoint && bucket);
    }
    static getClient() {
        if (!this.s3Client) {
            this.s3Client = new client_s3_1.S3Client({
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
    static async uploadContent(content, keyPath, contentType = 'text/html') {
        if (this.isR2Configured()) {
            try {
                const client = this.getClient();
                await client.send(new client_s3_1.PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: keyPath,
                    Body: content,
                    ContentType: contentType,
                }));
                const r2Url = `${process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT}/${this.bucketName}/${keyPath}`;
                console.log(`[R2 Storage] Uploaded to Cloudflare R2: ${r2Url}`);
                return { storageType: 'r2', location: r2Url, key: keyPath };
            }
            catch (err) {
                console.warn(`[R2 Storage] Upload failed (${err.message}). Falling back to local disk.`);
            }
        }
        else {
            console.log(`[Storage] Cloudflare R2 not configured. Saving snapshot to local filesystem.`);
        }
        // Local filesystem fallback
        const localFullPath = path_1.default.join(process.cwd(), keyPath);
        const dir = path_1.default.dirname(localFullPath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(localFullPath, content, 'utf-8');
        return { storageType: 'local', location: localFullPath, key: keyPath };
    }
    /**
     * Uploads a local file to R2 if configured, or leaves it on disk
     */
    static async uploadFile(localFilePath, r2KeyPath, contentType = 'text/html') {
        if (!fs_1.default.existsSync(localFilePath)) {
            throw new Error(`File not found: ${localFilePath}`);
        }
        const content = fs_1.default.readFileSync(localFilePath, 'utf-8');
        return this.uploadContent(content, r2KeyPath, contentType);
    }
}
exports.R2StorageService = R2StorageService;
