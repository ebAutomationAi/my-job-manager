import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../../config/search-config.json');

export class BaseScraper {
  constructor(keyword) {
    this.keyword = keyword;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configData = readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn(`Config file not found at ${CONFIG_PATH}, using defaults`);
      return {
        timeout: 30000,
        headless: true,
        retryAttempts: 2,
        retryDelay: 5000,
      };
    }
  }

  async initialize() {
    this.browser = await chromium.launch({
      headless: this.config.headless !== false,
    });

    this.context = await this.browser.newContext({
      userAgent: this.getUserAgent(),
    });

    this.page = await this.context.newPage();

    await this.applyBotEvasion();
  }

  getUserAgent() {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ,
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }

  async applyBotEvasion() {
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      window.chrome = {
        runtime: {},
      };

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['es-ES', 'es', 'en-US', 'en'],
      });
    });
  }

  async acceptCookies() {
    const selectors = [
      'button[id*="accept"]',
      'button[id*="cookie"]',
      'button[class*="accept"]',
      'button[class*="cookie"]',
      'a[id*="accept"]',
      '#onetrust-accept-btn-handler',
      '.css-accept',
      '[data-testid="cookie-accept"]',
      'button:has-text("Aceptar")',
      'button:has-text("Aceptar todo")',
      'button:has-text("Accept")',
      'button:has-text("Acepto")',
      'button:has-text("OK")',
    ];

    for (const selector of selectors) {
      try {
        const el = await this.page.$(selector);
        if (el) {
          await el.click();
          await this.page.waitForTimeout(800);
          return;
        }
      } catch {
        continue;
      }
    }
  }



  async close() {
    if (this.page) {
      await this.page.close();
    }
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}

export default BaseScraper;
