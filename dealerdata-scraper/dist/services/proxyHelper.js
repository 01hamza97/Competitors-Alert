"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProxyUrl = getProxyUrl;
exports.getAxiosProxyConfig = getAxiosProxyConfig;
exports.getPlaywrightProxy = getPlaywrightProxy;
const https_proxy_agent_1 = require("https-proxy-agent");
/**
 * Returns the effective proxy URL from explicit options or environment variables.
 */
function getProxyUrl(explicitUrl) {
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
function getAxiosProxyConfig(explicitUrl) {
    const proxyUrl = getProxyUrl(explicitUrl);
    if (!proxyUrl) {
        return {};
    }
    const agent = new https_proxy_agent_1.HttpsProxyAgent(proxyUrl);
    return {
        httpsAgent: agent,
        httpAgent: agent,
        proxy: false
    };
}
/**
 * Returns Playwright launch proxy options if a proxy is configured.
 */
function getPlaywrightProxy(explicitUrl) {
    const proxyUrl = getProxyUrl(explicitUrl);
    if (!proxyUrl) {
        return undefined;
    }
    try {
        const parsed = new URL(proxyUrl);
        const server = `${parsed.protocol}//${parsed.host}`;
        const result = { server };
        if (parsed.username) {
            result.username = decodeURIComponent(parsed.username);
        }
        if (parsed.password) {
            result.password = decodeURIComponent(parsed.password);
        }
        return result;
    }
    catch {
        return { server: proxyUrl };
    }
}
