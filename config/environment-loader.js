'use strict';

require('dotenv').config();

/**
 * ===============================================================
 * ENVIRONMENT LOADER v6.2
 * ===============================================================
 *
 * FIXES:
 * 1. GEMINI_COMPUTER_USE_MODEL defaults to 'gemini-2.0-flash'
 *    (not the Python-only preview model)
 * 2. useBrowserbase correctly reads === 'true'
 * 3. All timeouts and limits properly initialized
 */

class EnvironmentLoader {
  constructor() {
    this.config = {
      // ── Gemini API ───────────────────────────────────────────
      geminiApiKey: process.env.GEMINI_API_KEY,
      geminiVisionModel:
        process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',
      geminiComputerUseModel:
        process.env.GEMINI_COMPUTER_USE_MODEL || 'gemini-2.0-flash',

      // ── Browserbase ──────────────────────────────────────────
      useBrowserbase: process.env.USE_BROWSERBASE === 'true',
      browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
      browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
      browserbaseSessionId: process.env.BROWSERBASE_SESSION_ID || null,

      // ── Browser ──────────────────────────────────────────────
      headlessMode: process.env.HEADLESS_MODE !== 'false',
      antiBotEnabled: process.env.ANTI_BOT_ENABLED === 'true',
      stealthMode: process.env.ENABLE_STEALTH_MODE === 'true',
      fingerprintRandomization:
        process.env.ENABLE_FINGERPRINT_RANDOMIZATION === 'true',

      // ── Timeouts ─────────────────────────────────────────────
      navigationTimeout: parseInt(
        process.env.NAVIGATION_TIMEOUT || '30000'
      ),
      elementTimeout: parseInt(process.env.ELEMENT_TIMEOUT || '10000'),
      actionTimeout: parseInt(process.env.ACTION_TIMEOUT || '5000'),
      verificationTimeout: parseInt(
        process.env.VERIFICATION_TIMEOUT || '8000'
      ),

      // ── Feature Flags ────────────────────────────────────────
      saveScreenshots: process.env.SAVE_SCREENSHOTS === 'true',
      saveHtml: process.env.SAVE_HTML === 'true',
      cloudflare: process.env.CLOUDFLARE_SOLVING === 'true',
      preferComputerUse: process.env.PREFER_COMPUTER_USE === 'true',
      preferComputerUseForComplex:
        process.env.PREFER_COMPUTERUSE_FOR_COMPLEX_TASKS === 'true',

      // ── Logging ──────────────────────────────────────────────
      logLevel: process.env.LOG_LEVEL || 'info',
      logFormat: process.env.LOG_FORMAT || 'json',
      logToFile: process.env.LOG_TO_FILE === 'true',
      logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '30'),

      // ── Task ─────────────────────────────────────────────────
      targetUrl: process.env.TARGET_URL,
      taskDescription: process.env.TASK_DESCRIPTION,
      maxSteps: parseInt(process.env.MAX_STEPS || '10'),
      maxConsecutiveErrors: parseInt(
        process.env.MAX_CONSECUTIVE_ERRORS || '3'
      ),

      // ── Strategy ─────────────────────────────────────────────
      demoqaMode: process.env.DEMOQA_MODE === 'true',
      complexThreshold: parseInt(
        process.env.COMPLEX_TASK_THRESHOLD || '5'
      ),
    };
  }

  validate() {
    const issues = [];

    if (!this.config.geminiApiKey) {
      issues.push('❌ GEMINI_API_KEY is not set in .env');
    }

    if (this.config.useBrowserbase) {
      if (!this.config.browserbaseApiKey) {
        issues.push(
          '❌ USE_BROWSERBASE=true but BROWSERBASE_API_KEY is missing'
        );
      }
      if (!this.config.browserbaseProjectId) {
        issues.push(
          '❌ USE_BROWSERBASE=true but BROWSERBASE_PROJECT_ID is missing'
        );
      }
    }

    if (issues.length === 0) {
      const mode = this.config.useBrowserbase
        ? '☁️  Browserbase'
        : '🖥️  Local Puppeteer';
      const session = this.config.browserbaseSessionId
        ? ` (reusing session: ${this.config.browserbaseSessionId})`
        : '';
      console.log(
        `✅ Configuration valid – Browser mode: ${mode}${session}`
      );
    }

    return { valid: issues.length === 0, issues };
  }

  getConfig() {
    return this.config;
  }

  get(key) {
    return this.config[key];
  }
}

module.exports = new EnvironmentLoader();