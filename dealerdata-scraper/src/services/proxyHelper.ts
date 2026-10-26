import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

let envLoaded = false;
function loadEnvFilesOnce() {
  if (envLoaded) return;
  envLoaded = true;

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(process.cwd(), '../dealerdata-next/.env.local'),
    path.resolve(process.cwd(), '../dealerdata-next/.env'),
    '/var/www/Competitors-Alert/dealerdata-scraper/.env',
    '/var/www/Competitors-Alert/dealerdata-next/.env.local'
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      dotenv.config({ path: c });
    }
  }
}

/**
 * Returns the effective proxy URL from explicit options or environment variables.
 */
export function getProxyUrl(explicitUrl?: string): string | undefined {
  loadEnvFilesOnce();
  const url = explicitUrl || process.env.SCRAPER_PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return undefined;
  }
  return url.trim();
}

/**
 * Returns axios-compatible configuration for routing through the proxy agent.
 * Returns an empty object if no proxy is configured.
 */
export function getAxiosProxyConfig(explicitUrl?: string): {
  httpsAgent?: InstanceType<typeof HttpsProxyAgent>;
  httpAgent?: InstanceType<typeof HttpsProxyAgent>;
  proxy?: false;
} {
  const proxyUrl = getProxyUrl(explicitUrl);
  if (!proxyUrl) {
    return {};
  }

  const agent = new HttpsProxyAgent(proxyUrl);
  return {
    httpsAgent: agent,
    httpAgent: agent,
    proxy: false
  };
}

/**
 * Returns Playwright launch proxy options if a proxy is configured.
 */
export function getPlaywrightProxy(explicitUrl?: string): {
  server: string;
  username?: string;
  password?: string;
} | undefined {
  const proxyUrl = getProxyUrl(explicitUrl);
  if (!proxyUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(proxyUrl);
    const server = `${parsed.protocol}//${parsed.host}`;
    const result: { server: string; username?: string; password?: string } = { server };

    if (parsed.username) {
      result.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      result.password = decodeURIComponent(parsed.password);
    }

    return result;
  } catch {
    return { server: proxyUrl };
  }
}
