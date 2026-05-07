'use strict';
require('dotenv').config();
const puppeteer = require('puppeteer');
const axios = require('axios');
const logger = require('./logger');
const BB_API = 'https://www.browserbase.com/v1';
class BrowserbaseManager {
  constructor() {
    this.apiKey = process.env.BROWSERBASE_API_KEY;
    this.projectId = process.env.BROWSERBASE_PROJECT_ID;
    this.existingSessionId = process.env.BROWSERBASE_SESSION_ID || null;
    this.browser = null;
    this.page = null;
    this.sessionId = null;
    this.connected = false;
  }
  _headers() {
    return {
      'X-BB-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }
  _validate() {
    if (!this.apiKey) throw new Error('BROWSERBASE_API_KEY is missing from .env');
    if (!this.projectId) throw new Error('BROWSERBASE_PROJECT_ID is missing from .env');
  }
  async createSession(options = {}) {
    this._validate();
    logger.info('🌐 Creating new Browserbase session...');
    const payload = {
      projectId: this.projectId,
      browserSettings: {
        viewport: { width: 1280, height: 800 },
        ...options.browserSettings,
      },
      keepAlive: true,
      timeout: options.timeout || 300,
    };
    try {
      const response = await axios.post(`${BB_API}/sessions`, payload, {
        headers: this._headers(),
      });
      const session = response.data;
      this.sessionId = session.id;
      
      // Fetch the debug URL (unauthenticated live view — no login required)
      const debugUrl = await this._fetchDebugUrl(this.sessionId);
      session.liveViewUrl = debugUrl || `https://www.browserbase.com/sessions/${this.sessionId}`;
      
      logger.info(`✅ Browserbase session created: ${this.sessionId}`);
      logger.info(`🔗 Live View: ${session.liveViewUrl}`);
      return session;
    } catch (error) {
      logger.error(
        `Failed to create Browserbase session: ${error.response?.status} ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Fetch the unauthenticated debug/live-view URL for a session.
   * This URL can be embedded in iframes without requiring Browserbase login.
   */
  async _fetchDebugUrl(sessionId) {
    try {
      const response = await axios.get(
        `${BB_API}/sessions/${sessionId}/debug`,
        { headers: this._headers() }
      );
      const data = response.data;
      const url = data.debuggerFullscreenUrl || data.debuggerUrl || null;
      if (url) {
        logger.info(`🔗 Debug URL fetched (unauthenticated live view)`);
      }
      return url;
    } catch (error) {
      logger.warn(`Could not fetch debug URL: ${error.message} — falling back to dashboard URL`);
      return null;
    }
  }
  async getSession(sessionId) {
    this._validate();
    const sid = sessionId || this.existingSessionId;
    if (!sid) throw new Error('No session ID provided or found in BROWSERBASE_SESSION_ID');
    logger.info(`🔍 Fetching Browserbase session: ${sid}`);
    try {
      const response = await axios.get(`${BB_API}/sessions/${sid}`, {
        headers: this._headers(),
      });
      return response.data;
    } catch (error) {
      logger.error(
        `Failed to fetch session ${sid}: ${error.response?.status} ${error.message}`
      );
      throw error;
    }
  }
  async listSessions(status = 'RUNNING') {
    this._validate();
    try {
      const response = await axios.get(`${BB_API}/sessions`, {
        headers: this._headers(),
        params: { projectId: this.projectId, status },
      });
      return response.data.sessions || [];
    } catch (error) {
      logger.warn(`Failed to list sessions: ${error.message}`);
      return [];
    }
  }
  async endSession(sessionId) {
    const sid = sessionId || this.sessionId;
    if (!sid) return;
    try {
      await axios.post(
        `${BB_API}/sessions/${sid}/stop`,
        {},
        { headers: this._headers() }
      );
      logger.info(`🛑 Browserbase session stopped: ${sid}`);
    } catch (error) {
      if (error.response?.status !== 404) {
        logger.warn(`Could not stop session ${sid}: ${error.message}`);
      }
    }
  }
  async connect(options = {}) {
    this._validate();
    try {
      let session;
      if (this.existingSessionId) {
        logger.info(`♻️  Reusing session from .env: ${this.existingSessionId}`);
        session = await this.getSession(this.existingSessionId);
        this.sessionId = session.id;
      } else {
        session = await this.createSession(options);
      }
      const wsEndpoint =
        session.wsUrl ||
        `wss://connect.browserbase.com?apiKey=${this.apiKey}&sessionId=${this.sessionId}`;
      logger.info(
        `🔌 Connecting via CDP to: ${wsEndpoint.replace(this.apiKey, '***')}`
      );
      this.browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: { width: 1280, height: 800 },
      });
      const pages = await this.browser.pages();
      this.page = pages[0] || (await this.browser.newPage());
      this.page.sessionId = this.sessionId;
      this.page.liveViewUrl = session.liveViewUrl;
      this.connected = true;
      logger.info(`✅ Puppeteer connected to Browserbase session: ${this.sessionId}`);
      if (session.liveViewUrl) {
        logger.info(`👁️  Live view: ${session.liveViewUrl}`);
      }
      return { browser: this.browser, page: this.page, session };
    } catch (error) {
      logger.error(`❌ Browserbase connect failed: ${error.message}`);
      throw error;
    }
  }
  async disconnect() {
    if (this.browser) {
      try {
        await this.browser.disconnect();
        logger.info('🔌 Puppeteer disconnected from Browserbase');
      } catch (err) {
        logger.warn(`Disconnect warning: ${err.message}`);
      } finally {
        this.browser = null;
        this.page = null;
        this.connected = false;
      }
    }
  }
  async cleanup() {
    await this.disconnect();
    if (this.sessionId && !this.existingSessionId) {
      await this.endSession(this.sessionId);
    }
  }
  async navigate(url, retries = 2) {
    if (!this.page) throw new Error('Not connected – call connect() first');
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.info(`🌍 Navigating to: ${url} (attempt ${attempt})`);
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: parseInt(process.env.NAVIGATION_TIMEOUT || '15000'),
        });
        // Allow JS to render after DOM is ready
        await this._sleep(2000);
        logger.info(`✅ Navigation complete: ${url}`);
        return true;
      } catch (error) {
        // Timeout is NOT fatal if page has content (heavy SPAs like YouTube, Yahoo Finance)
        if (error.message && error.message.includes('timeout')) {
          const hasContent = await this.page.evaluate(() => document.body && document.body.innerHTML.length > 100).catch(() => false);
          if (hasContent) {
            logger.warn(`⏱️  Navigation timeout but page has content — proceeding`);
            await this._sleep(1000);
            return true;
          }
        }
        logger.warn(`Navigation attempt ${attempt} failed: ${error.message}`);
        if (attempt === retries) throw error;
        await this._sleep(2000 * attempt);
      }
    }
  }
  async screenshot(path = null) {
    if (!this.page) throw new Error('Not connected');
    const opts = { encoding: 'base64', fullPage: false };
    if (path) {
      opts.path = path;
      delete opts.encoding;
      await this.page.screenshot(opts);
      logger.debug(`📸 Screenshot saved: ${path}`);
      return path;
    }
    const data = await this.page.screenshot(opts);
    logger.debug('📸 Screenshot captured (base64)');
    return data;
  }
  async getContent() {
    if (!this.page) throw new Error('Not connected');
    return this.page.content();
  }
  async evaluate(fn, ...args) {
    if (!this.page) throw new Error('Not connected');
    return this.page.evaluate(fn, ...args);
  }
  getStatus() {
    return {
      connected: this.connected,
      sessionId: this.sessionId,
      reusingExistingSession: !!this.existingSessionId,
      projectId: this.projectId,
      apiKeySet: !!this.apiKey,
    };
  }
  isConfigured() {
    return !!(this.apiKey && this.projectId);
  }
  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
module.exports = new BrowserbaseManager();