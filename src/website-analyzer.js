/**
 * ===============================================================
 * WEBSITE ANALYZER v7.0 — Universal Site Intelligence
 * ===============================================================
 *
 * Analyzes ANY website URL and returns a profile with:
 * - Site name, type, and category
 * - Recommended model and strategy
 * - Known quirks and overlay patterns
 * - Suggested complexity for the task
 */

'use strict';

const logger = require('./logger');

// ── Known website profiles ────────────────────────────────────
// These provide pre-configured strategies for popular sites.
// Unknown sites get a smart generic profile based on URL analysis.

const PROFILES = {
  // E-commerce
  'amazon.com': { name: 'Amazon', type: 'ecommerce', complexity: 7, quirks: ['location-popup', 'signin-tooltip', 'dynamic-pricing'] },
  'amazon.in': { name: 'Amazon India', type: 'ecommerce', complexity: 7, quirks: ['location-popup', 'signin-tooltip'] },
  'amazon.co.uk': { name: 'Amazon UK', type: 'ecommerce', complexity: 7, quirks: ['location-popup', 'cookie-banner'] },
  'ebay.com': { name: 'eBay', type: 'ecommerce', complexity: 6, quirks: ['cookie-banner'] },
  'flipkart.com': { name: 'Flipkart', type: 'ecommerce', complexity: 6, quirks: ['login-popup'] },
  'walmart.com': { name: 'Walmart', type: 'ecommerce', complexity: 6, quirks: ['location-popup'] },
  'etsy.com': { name: 'Etsy', type: 'ecommerce', complexity: 5, quirks: ['cookie-banner'] },

  // Streaming / Media
  'youtube.com': { name: 'YouTube', type: 'streaming', complexity: 6, quirks: ['consent-dialog', 'ad-overlay', 'dynamic-content'] },
  'netflix.com': { name: 'Netflix', type: 'streaming', complexity: 7, quirks: ['login-required', 'heavy-js'] },
  'spotify.com': { name: 'Spotify', type: 'streaming', complexity: 6, quirks: ['cookie-banner', 'login-required'] },

  // Search / Portals
  'google.com': { name: 'Google', type: 'search', complexity: 4, quirks: ['consent-dialog', 'dynamic-results'] },
  'bing.com': { name: 'Bing', type: 'search', complexity: 4, quirks: ['cookie-banner'] },
  'duckduckgo.com': { name: 'DuckDuckGo', type: 'search', complexity: 3, quirks: [] },

  // Finance
  'finance.yahoo.com': { name: 'YahooFinance', type: 'finance', complexity: 6, quirks: ['cookie-banner', 'consent-dialog', 'dynamic-data'] },
  'tradingview.com': { name: 'TradingView', type: 'finance', complexity: 7, quirks: ['login-popup', 'heavy-js'] },

  // Social
  'twitter.com': { name: 'Twitter/X', type: 'social', complexity: 7, quirks: ['login-wall', 'dynamic-content', 'infinite-scroll'] },
  'x.com': { name: 'X', type: 'social', complexity: 7, quirks: ['login-wall', 'dynamic-content', 'infinite-scroll'] },
  'reddit.com': { name: 'Reddit', type: 'social', complexity: 6, quirks: ['cookie-banner', 'app-prompt', 'infinite-scroll'] },
  'linkedin.com': { name: 'LinkedIn', type: 'social', complexity: 7, quirks: ['login-required', 'cookie-banner'] },
  'facebook.com': { name: 'Facebook', type: 'social', complexity: 8, quirks: ['login-required', 'cookie-banner'] },
  'instagram.com': { name: 'Instagram', type: 'social', complexity: 8, quirks: ['login-required', 'app-prompt'] },

  // Travel
  'booking.com': { name: 'Booking.com', type: 'travel', complexity: 7, quirks: ['cookie-banner', 'date-picker', 'dynamic-pricing'] },
  'airbnb.com': { name: 'Airbnb', type: 'travel', complexity: 7, quirks: ['cookie-banner', 'map-widget'] },
  'expedia.com': { name: 'Expedia', type: 'travel', complexity: 7, quirks: ['cookie-banner', 'date-picker'] },

  // News
  'bbc.com': { name: 'BBC', type: 'news', complexity: 4, quirks: ['cookie-banner'] },
  'cnn.com': { name: 'CNN', type: 'news', complexity: 5, quirks: ['cookie-banner', 'newsletter-popup', 'ad-overlay'] },
  'nytimes.com': { name: 'NYTimes', type: 'news', complexity: 6, quirks: ['paywall', 'cookie-banner'] },

  // Developer / Tech
  'github.com': { name: 'GitHub', type: 'developer', complexity: 5, quirks: ['cookie-banner'] },
  'stackoverflow.com': { name: 'StackOverflow', type: 'developer', complexity: 5, quirks: ['cookie-banner'] },
  'npmjs.com': { name: 'npm', type: 'developer', complexity: 4, quirks: [] },

  // Test sites
  'demoqa.com': { name: 'DemoQA', type: 'test-site', complexity: 5, quirks: ['ad-banner-fixedban', 'sidebar-scroll-jump'] },
  'the-internet.herokuapp.com': { name: 'The Internet', type: 'test-site', complexity: 4, quirks: [] },
  'saucedemo.com': { name: 'SauceDemo', type: 'test-site', complexity: 4, quirks: [] },
  'automationexercise.com': { name: 'AutomationExercise', type: 'test-site', complexity: 5, quirks: ['ad-overlay'] },

  // Food / Delivery
  'zomato.com': { name: 'Zomato', type: 'food', complexity: 6, quirks: ['location-popup', 'cookie-banner'] },
  'swiggy.com': { name: 'Swiggy', type: 'food', complexity: 6, quirks: ['location-popup'] },
  'ubereats.com': { name: 'UberEats', type: 'food', complexity: 6, quirks: ['location-popup', 'cookie-banner'] },
};

// ── Site type heuristics for unknown URLs ─────────────────────
const TYPE_PATTERNS = [
  { pattern: /shop|store|buy|cart|product|price|deal/i, type: 'ecommerce' },
  { pattern: /news|article|blog|press|media|journal/i, type: 'news' },
  { pattern: /video|stream|watch|play|movie|tv/i, type: 'streaming' },
  { pattern: /bank|finance|invest|trade|stock|crypto/i, type: 'finance' },
  { pattern: /travel|flight|hotel|book|trip|tour/i, type: 'travel' },
  { pattern: /social|community|forum|discuss/i, type: 'social' },
  { pattern: /dev|code|api|docs|github|git/i, type: 'developer' },
  { pattern: /test|demo|practice|exercise|sample|example/i, type: 'test-site' },
  { pattern: /food|restaurant|delivery|order|menu/i, type: 'food' },
  { pattern: /search|find|query|lookup/i, type: 'search' },
  { pattern: /login|signin|auth|account|register/i, type: 'auth' },
  { pattern: /mail|email|inbox|compose/i, type: 'email' },
  { pattern: /map|location|direction|places/i, type: 'maps' },
];

class WebsiteAnalyzer {
  /**
   * Analyze a URL and return a comprehensive site profile
   * @param {string} url - The target URL
   * @returns {{ url, name, type, hostname, complexity, quirks, matched, model }}
   */
  analyze(url) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace('www.', '');

      // ── Check known profiles ─────────────────────
      const knownProfile = this._findProfile(hostname);

      if (knownProfile) {
        const profile = {
          url,
          hostname,
          ...knownProfile,
          matched: true,
          model: this._selectModel(knownProfile),
        };
        logger.info(`🔍 Website: ${profile.name} (${profile.type}) — known profile`);
        if (profile.quirks.length > 0) {
          logger.debug(`   ⚠️  Known quirks: ${profile.quirks.join(', ')}`);
        }
        return profile;
      }

      // ── Unknown site — analyze dynamically ───────
      const type = this._inferType(hostname, parsed.pathname);
      const complexity = this._estimateSiteComplexity(type, hostname);

      const profile = {
        url,
        hostname,
        name: this._humanizeDomain(hostname),
        type,
        complexity,
        quirks: this._guessQuirks(type),
        matched: false,
        model: 'gemini-2.5-flash',
      };

      logger.info(`🔍 Website: ${profile.name} (${profile.type}) — dynamic analysis`);
      return profile;

    } catch (err) {
      logger.warn(`URL analysis failed for "${url}": ${err.message}`);
      return {
        url,
        hostname: 'unknown',
        name: 'Unknown',
        type: 'generic',
        complexity: 5,
        quirks: ['cookie-banner'],
        matched: false,
        model: 'gemini-2.5-flash',
      };
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  /**
   * Find a known profile, trying exact match then partial match
   */
  _findProfile(hostname) {
    // Exact match
    if (PROFILES[hostname]) return PROFILES[hostname];

    // Partial match (e.g., "smile.amazon.com" → "amazon.com")
    for (const [domain, profile] of Object.entries(PROFILES)) {
      if (hostname.endsWith(domain) || hostname.includes(domain.split('.')[0])) {
        return profile;
      }
    }

    return null;
  }

  /**
   * Infer site type from hostname and path patterns
   */
  _inferType(hostname, pathname) {
    const combined = `${hostname} ${pathname}`;
    for (const { pattern, type } of TYPE_PATTERNS) {
      if (pattern.test(combined)) return type;
    }
    return 'generic';
  }

  /**
   * Estimate site complexity based on type
   */
  _estimateSiteComplexity(type, hostname) {
    const complexityMap = {
      'ecommerce': 7,
      'finance': 7,
      'social': 7,
      'streaming': 6,
      'travel': 7,
      'auth': 5,
      'email': 6,
      'maps': 6,
      'news': 4,
      'developer': 5,
      'search': 3,
      'test-site': 4,
      'food': 6,
      'generic': 5,
    };
    return complexityMap[type] || 5;
  }

  /**
   * Guess common quirks based on site type
   */
  _guessQuirks(type) {
    const quirkMap = {
      'ecommerce': ['cookie-banner', 'location-popup', 'dynamic-pricing'],
      'social': ['login-required', 'cookie-banner', 'infinite-scroll'],
      'news': ['cookie-banner', 'newsletter-popup', 'ad-overlay'],
      'streaming': ['consent-dialog', 'ad-overlay'],
      'finance': ['cookie-banner', 'dynamic-data'],
      'travel': ['cookie-banner', 'date-picker'],
      'food': ['location-popup', 'cookie-banner'],
      'generic': ['cookie-banner'],
    };
    return quirkMap[type] || ['cookie-banner'];
  }

  /**
   * Create a human-readable name from a domain
   * e.g., "cool-shop.co.uk" → "Cool Shop"
   */
  _humanizeDomain(hostname) {
    const parts = hostname.split('.');
    // Remove TLD and common subdomains
    const name = parts.length > 2 ? parts.slice(0, -2).join('.') : parts[0];
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Select the best model based on site complexity
   */
  _selectModel(profile) {
    if (profile.complexity >= 7) return process.env.GEMINI_COMPUTER_USE_MODEL || 'gemini-2.0-flash';
    return process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
  }
}

module.exports = WebsiteAnalyzer;