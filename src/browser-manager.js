'use strict';

require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const logger = require('./logger');
const browserbaseManager = require('./browserbase-manager');

class BrowserManager {
  constructor() {
    this.useBrowserbase = process.env.USE_BROWSERBASE === 'true';
    this.browser = null;
    this.page = null;
    this.initialized = false;
  }

  // ─────────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────────

  async initialize(options = {}) {
    if (this.initialized) {
      logger.warn('BrowserManager already initialized');
      return { browser: this.browser, page: this.page };
    }

    if (this.useBrowserbase) {
      return this._initBrowserbase(options);
    }
    return this._initLocal(options);
  }

  async _initBrowserbase(options) {
    logger.info('☁️  Using Browserbase cloud browser');

    if (!browserbaseManager.isConfigured()) {
      logger.warn('Browserbase not configured – falling back to local browser');
      return this._initLocal(options);
    }

    try {
      const result = await browserbaseManager.connect(options);
      this.browser = result.browser;
      this.page = result.page;
      this.initialized = true;
      return result;
    } catch (err) {
      logger.error(`❌ Browserbase connect failed: ${err.message}`);
      logger.warn('⚡ Falling back to local Puppeteer browser...');
      this.useBrowserbase = false;
      return this._initLocal(options);
    }
  }

  async _initLocal(options) {
    logger.info('🖥️  Launching local Puppeteer browser');

    const launchOptions = {
      headless: process.env.HEADLESS_MODE !== 'false',
      defaultViewport: { width: 1280, height: 800 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,800',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        ...(options.extraArgs || []),
      ],
      ...options.launch,
    };

    this.browser = await puppeteer.launch(launchOptions);
    this.page = await this.browser.newPage();

    this.initialized = true;
    logger.info('✅ Local browser ready');
    return { browser: this.browser, page: this.page };
  }


  // ─────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────

  async navigate(url) {
    this._requireInit();

    if (this.useBrowserbase && browserbaseManager.connected) {
      return browserbaseManager.navigate(url);
    }

    logger.info(`🌍 Navigating to: ${url}`);
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: parseInt(process.env.NAVIGATION_TIMEOUT || '30000'),
    });
    logger.info('✅ Navigation complete');
    return true;
  }

  // ─────────────────────────────────────────────
  // PAGE UTILITIES
  // ─────────────────────────────────────────────

  async screenshot(path = null) {
    this._requireInit();
    if (this.useBrowserbase && browserbaseManager.connected) {
      return browserbaseManager.screenshot(path);
    }
    const opts = { encoding: 'base64' };
    if (path) {
      opts.path = path;
      delete opts.encoding;
      await this.page.screenshot(opts);
      return path;
    }
    return this.page.screenshot(opts);
  }

  async getContent() {
    this._requireInit();
    return this.page.content();
  }

  async evaluate(fn, ...args) {
    this._requireInit();
    return this.page.evaluate(fn, ...args);
  }

  getPage() {
    this._requireInit();
    return this.page;
  }

  getBrowser() {
    this._requireInit();
    return this.browser;
  }

  // ─────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────

  async cleanup() {
    if (!this.initialized) return;

    if (this.useBrowserbase && browserbaseManager.connected) {
      await browserbaseManager.cleanup();
    } else if (this.browser) {
      try {
        await this.browser.close();
        logger.info('🧹 Local browser closed');
      } catch (err) {
        logger.warn(`Browser close warning: ${err.message}`);
      }
    }

    this.browser = null;
    this.page = null;
    this.initialized = false;
  }

  // ─────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────

  getStatus() {
    return {
      initialized: this.initialized,
      mode: this.useBrowserbase ? 'browserbase' : 'local',
      ...(this.useBrowserbase ? browserbaseManager.getStatus() : {}),
    };
  }

  // ─────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────

  _requireInit() {
    if (!this.initialized || !this.page) {
      throw new Error('BrowserManager not initialized – call initialize() first');
    }
  }
}

module.exports = new BrowserManager();