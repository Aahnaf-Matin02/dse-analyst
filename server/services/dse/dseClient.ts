import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

export interface DseClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  minIntervalMs?: number;
}

export class DseClient {
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private minIntervalMs: number;
  private lastRequestTime: number = 0;

  constructor(options: DseClientOptions = {}) {
    let base = (options.baseUrl || process.env.DSE_BASE_URL || "https://www.dse.com.bd").replace(/\/+$/, "");
    if (base === "https://dse.com.bd" || base === "http://dse.com.bd" || base === "http://www.dse.com.bd") {
      base = "https://www.dse.com.bd";
    }
    this.baseUrl = base;
    this.timeoutMs = options.timeoutMs || 25000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 1500;
    this.minIntervalMs = options.minIntervalMs || 500; // minimum interval between outbound calls
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Throttles outbound requests to respect DSE infrastructure.
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise(resolve => setTimeout(resolve, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Performs an HTTP request with retries and exponential backoff.
   */
  async get(pathOrUrl: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string; url: string }> {
    await this.throttle();

    const targetUrl = pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
      ? pathOrUrl
      : `${this.baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.executeRequest(targetUrl, headers);
        if (result.status >= 200 && result.status < 400) {
          return result;
        }
        if (result.status === 404) {
          return result; // Don't retry 404
        }
        throw new Error(`DSE server returned HTTP ${result.status} for ${targetUrl}`);
      } catch (err: any) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(1.5, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to request ${targetUrl} after ${this.maxRetries} attempts`);
  }

  private executeRequest(targetUrl: string, customHeaders: Record<string, string>): Promise<{ status: number; body: string; url: string }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const client = isHttps ? https : http;

      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
        "Cache-Control": "no-cache",
        "Referer": this.baseUrl,
        ...customHeaders
      };

      const req = client.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: "GET",
          headers,
          timeout: this.timeoutMs
        },
        (res) => {
          // Handle HTTP redirects (301, 302, 307, 308)
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            res.resume(); // consume stream
            this.executeRequest(redirectUrl, customHeaders).then(resolve).catch(reject);
            return;
          }

          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({
              status: res.statusCode || 200,
              body: data,
              url: targetUrl
            });
          });
        }
      );

      req.on("timeout", () => {
        req.destroy(new Error(`Timeout after ${this.timeoutMs}ms while connecting to ${targetUrl}`));
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.end();
    });
  }

  // Convenience methods
  async fetchCompaniesHtml(): Promise<{ status: number; body: string; url: string }> {
    return this.get("/companies");
  }

  async fetchCompanyHtml(symbol: string): Promise<{ status: number; body: string; url: string }> {
    const sym = encodeURIComponent(symbol.toUpperCase().trim());
    return this.get(`/company/${sym}`);
  }

  async fetchAtAGlanceHtml(): Promise<{ status: number; body: string; url: string }> {
    return this.get("/markets/at-a-glance");
  }

  async fetchHomepageHtml(): Promise<{ status: number; body: string; url: string }> {
    return this.get("/");
  }
}

export const defaultDseClient = new DseClient();
