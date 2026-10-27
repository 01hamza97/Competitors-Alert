import { BrowserContext, Page } from 'playwright';
export interface BrowserOptions {
    proxyUrl?: string;
    headless?: boolean;
}
export declare class BrowserManager {
    private browser;
    private context;
    private isUsingProxy;
    private currentOptions?;
    static parseProxy(proxyUrl?: string): {
        server: string;
        username?: string;
        password?: string;
    } | undefined;
    init(options?: BrowserOptions): Promise<BrowserContext>;
    getContext(options?: BrowserOptions): Promise<BrowserContext>;
    /**
     * Loads a target URL, evades anti-bot challenges, scrolls to hydrate cards, and returns the page and HTML.
     */
    fetchPage(url: string, timeoutMs?: number): Promise<{
        page: Page;
        html: string;
        status: number;
    }>;
    close(): Promise<void>;
}
