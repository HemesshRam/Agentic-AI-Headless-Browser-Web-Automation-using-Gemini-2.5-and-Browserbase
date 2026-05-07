'use strict';

const logger = require('./logger');

class ViewportGuard {
  constructor(page) {
    this.page = page;
    this._overlaysSuppressed = false;
  }

  // ─────────────────────────────────────────────
  // VIEWPORT STATE MANAGEMENT
  // ─────────────────────────────────────────────

  /**
   * Capture the current viewport scroll state
   * @returns {{ scrollX: number, scrollY: number, viewportWidth: number, viewportHeight: number }}
   */
  async captureViewportState() {
    try {
      return await this.page.evaluate(() => ({
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }));
    } catch (err) {
      logger.warn(`Failed to capture viewport state: ${err.message}`);
      return { scrollX: 0, scrollY: 0, viewportWidth: 1280, viewportHeight: 800 };
    }
  }

  /**
   * Restore viewport to a previously captured scroll position
   * @param {{ scrollX: number, scrollY: number }} state
   */
  async restoreViewportState(state) {
    try {
      await this.page.evaluate(
        (x, y) => window.scrollTo(x, y),
        state.scrollX,
        state.scrollY
      );
      await this._sleep(100);
    } catch (err) {
      logger.warn(`Failed to restore viewport state: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // ELEMENT VISIBILITY CHECKS
  // ─────────────────────────────────────────────

  /**
   * Check if an element is fully within the current visible viewport
   * @param {string} selector - CSS selector
   * @returns {boolean}
   */
  async isElementInViewport(selector) {
    try {
      return await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.right <= window.innerWidth
        );
      }, selector);
    } catch {
      return false;
    }
  }

  /**
   * Check if an element is at least partially visible in the viewport
   * @param {string} selector - CSS selector
   * @returns {boolean}
   */
  async isElementPartiallyVisible(selector) {
    try {
      return await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return (
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth
        );
      }, selector);
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // VIEWPORT-LOCKED CLICK (no auto-scroll)
  // ─────────────────────────────────────────────

  /**
   * Click an element without triggering Puppeteer's auto-scroll.
   *
   * Strategy:
   * 1. Check if element is in viewport → click at bounding box center
   * 2. If not visible → use minimal scrollIntoView({ block: 'nearest' })
   * 3. Never use page.click(selector) which always auto-scrolls
   *
   * @param {string} selector - CSS selector to click
   * @returns {{ success: boolean, coordinate?: {x,y}, scrolled: boolean }}
   */
  async clickWithoutScroll(selector) {
    const scrollBefore = await this.captureViewportState();

    try {
      await this.page.waitForSelector(selector, { timeout: 8000 });

      const el = await this.page.$(selector);
      if (!el) {
        return { success: false, reason: `Element not found: ${selector}` };
      }

      let box = await el.boundingBox();
      let scrolled = false;

      if (box && this._isBoxInViewport(box, scrollBefore)) {
        // Element is already in viewport — click directly
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        logger.debug(`🎯 Viewport-locked click at (${Math.round(x)}, ${Math.round(y)})`);
        await this.page.mouse.click(x, y);
      } else {
        // Element is off-screen — minimal scroll to bring it into view
        scrolled = true;
        logger.debug(`📐 Element off-screen, minimal scrollIntoView: ${selector}`);

        await this.page.evaluate((sel) => {
          const target = document.querySelector(sel);
          if (target) {
            target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          }
        }, selector);

        await this._sleep(200);

        // Re-query bounding box after scroll
        box = await el.boundingBox();
        if (box) {
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          logger.debug(`🎯 Click after scroll at (${Math.round(x)}, ${Math.round(y)})`);
          await this.page.mouse.click(x, y);
        } else {
          return { success: false, reason: 'Element has no bounding box after scroll' };
        }
      }

      await this._sleep(300);
      return {
        success: true,
        action: 'click',
        selector,
        coordinate: box ? { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) } : null,
        scrolled,
      };
    } catch (err) {
      await this.restoreViewportState(scrollBefore).catch(() => { });
      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // VIEWPORT-LOCKED TYPE (no auto-scroll)
  // ─────────────────────────────────────────────

  /**
   * Type into an element without triggering Puppeteer's auto-scroll.
   *
   * @param {string} selector - CSS selector of the input
   * @param {string} text - Text to type
   * @param {{ clearFirst?: boolean, delay?: number }} options
   * @returns {{ success: boolean, scrolled: boolean }}
   */
  async typeWithoutScroll(selector, text, options = {}) {
    const { clearFirst = true, delay = 40 } = options;

    const clickResult = await this.clickWithoutScroll(selector);
    if (!clickResult.success) {
      return { success: false, reason: clickResult.reason };
    }

    if (clearFirst) {
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('a');
      await this.page.keyboard.up('Control');
      await this._sleep(50);
    }

    await this.page.keyboard.type(String(text), { delay });

    return {
      success: true,
      action: 'type',
      selector,
      value: text,
      scrolled: clickResult.scrolled,
    };
  }

  // ─────────────────────────────────────────────
  // UNIVERSAL OVERLAY SUPPRESSION
  // ─────────────────────────────────────────────

  /**
   * Suppress common overlays across ALL websites.
   * Handles cookie banners, ad popups, chat widgets, newsletter modals, etc.
   * Also includes DemoQA-specific overlays.
   *
   * This should be called after every navigation.
   */
  async suppressOverlays() {
    if (this._overlaysSuppressed) return;

    try {
      const hostname = await this.page.evaluate(() => window.location.hostname).catch(() => '');

      // ── Phase 1: Click common dismiss buttons ──────────────
      await this._dismissClickableOverlays();

      // ── Phase 2: Inject CSS to hide persistent overlays ────
      await this._injectOverlaySuppression(hostname);

      // ── Phase 3: Site-specific fixes ───────────────────────
      await this._applySiteSpecificFixes(hostname);

      this._overlaysSuppressed = true;
      logger.info('🛡️  Overlay suppression applied');
    } catch (err) {
      logger.warn(`Overlay suppression partial failure: ${err.message}`);
    }
  }

  /**
   * Reset overlay suppression flag (call after navigation to new page)
   */
  resetOverlaySuppression() {
    this._overlaysSuppressed = false;
  }

  /**
   * Try clicking common cookie/popup dismiss buttons
   */
  async _dismissClickableOverlays() {
    const dismissSelectors = [
      // Cookie consent buttons
      '[id*="cookie"] button[class*="accept"]',
      '[id*="cookie"] button[class*="agree"]',
      '[id*="cookie"] button[class*="close"]',
      '[class*="cookie"] button[class*="accept"]',
      '[class*="cookie"] button[class*="close"]',
      'button[id*="accept-cookie"]',
      'button[id*="acceptCookie"]',
      '#onetrust-accept-btn-handler',
      '.cc-btn.cc-dismiss',
      '[data-testid="cookie-policy-dialog-accept-button"]',
      '[aria-label="Accept cookies"]',
      '[aria-label="Accept all cookies"]',
      // GDPR consent
      '.gdpr-accept',
      '#gdpr-consent-accept',
      '.consent-accept',
      'button[class*="consent"][class*="accept"]',
      // Generic close / dismiss
      '[class*="popup"] [class*="close"]',
      '[class*="modal"] [class*="close"]',
      '[class*="banner"] [class*="close"]',
      '[class*="overlay"] [class*="close"]',
      '[aria-label="Close"]',
      '[aria-label="Dismiss"]',
      'button[class*="dismiss"]',
      // Notification prompts
      '[class*="notification"] [class*="close"]',
      '[class*="notification"] [class*="dismiss"]',
    ];

    for (const sel of dismissSelectors) {
      try {
        const btn = await this.page.$(sel);
        if (btn) {
          const box = await btn.boundingBox();
          if (box) {
            await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            logger.debug(`🚫 Dismissed overlay via: ${sel}`);
            await this._sleep(300);
          }
        }
      } catch {
        // Ignore — button may not exist or be clickable
      }
    }
  }

  /**
   * Inject CSS to hide all known overlay/popup patterns
   */
  async _injectOverlaySuppression(hostname) {
    await this.page.evaluate((host) => {
      const existing = document.getElementById('viewport-guard-overlays');
      if (existing) existing.remove();

      const style = document.createElement('style');
      style.id = 'viewport-guard-overlays';
      style.textContent = `
        /* ── Cookie Consent Banners ── */
        [id*="cookie-banner"],
        [id*="cookieBanner"],
        [id*="cookie-consent"],
        [id*="cookieConsent"],
        [class*="cookie-banner"],
        [class*="cookieBanner"],
        [class*="cookie-consent"],
        [class*="cookie-notice"],
        .cc-window,
        #onetrust-banner-sdk,
        #CybotCookiebotDialog,
        .evidon-consent-button,
        [class*="gdpr"],
        [id*="gdpr"],
        [class*="consent-banner"],

        /* ── Newsletter / Signup Popups ── */
        [class*="newsletter-popup"],
        [class*="newsletter-modal"],
        [class*="signup-popup"],
        [class*="subscribe-popup"],
        [id*="newsletter-popup"],
        [id*="email-popup"],

        /* ── Chat Widgets ── */
        #intercom-container,
        .intercom-lightweight-app,
        iframe[title*="chat"],
        iframe[title*="Chat"],
        iframe[name*="intercom"],
        [class*="drift-"],
        #drift-widget,
        #hubspot-messages-iframe-container,
        [class*="zopim"],
        [class*="zendesk"],
        #launcher,
        .crisp-client,
        #tidio-chat,
        [class*="tawk-"],

        /* ── Ad Overlays ── */
        [id*="google_ads"],
        [class*="Google-Ad"],
        iframe[id*="aswift"],
        [class*="ad-overlay"],
        [class*="ad-popup"],
        [id*="ad-container"],

        /* ── App Install Prompts ── */
        [class*="app-banner"],
        [class*="smart-banner"],
        [id*="smartbanner"],
        [class*="app-install"],

        /* ── Notification Bars ── */
        [class*="notification-bar"],
        [class*="announcement-bar"],
        [class*="promo-bar"],
        [class*="top-bar"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          max-height: 0 !important;
          overflow: hidden !important;
        }

        /* ── DemoQA-specific ── */
        ${host.includes('demoqa.com') ? `
          #fixedban,
          #close-fixedban,
          #RightSide_Advertisement,
          iframe[id*="google_ads"],
          iframe[id*="aswift"],
          footer {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            max-height: 0 !important;
            pointer-events: none !important;
          }
        ` : ''}

        /* ── Amazon-specific ── */
        ${host.includes('amazon.') ? `
          #nav-main .nav-signin-tooltip,
          #attach-sidesheet-checkout-modal,
          [class*="a-popover"],
          #sp-cc {
            display: none !important;
          }
        ` : ''}

        /* ── YouTube-specific ── */
        ${host.includes('youtube.com') ? `
          ytd-popup-container,
          tp-yt-paper-dialog,
          [class*="consent-bump"],
          ytd-enforcement-message-view-model {
            display: none !important;
          }
        ` : ''}
      `;

      document.head.appendChild(style);
    }, hostname);
  }

  /**
   * Apply site-specific and universal JavaScript fixes to dismiss overlays.
   * Universal patterns are tried FIRST so this works on ANY website.
   */
  async _applySiteSpecificFixes(hostname) {
    // ── Universal consent/cookie/popup dismissal (ANY website) ──
    await this.page.evaluate(() => {
      // Universal accept/agree/consent button patterns
      const universalSelectors = [
        // Generic consent/accept
        'button[class*="accept"]',
        'button[class*="Accept"]',
        'button[class*="agree"]',
        'button[class*="Agree"]',
        'button[class*="consent"]',
        'a[class*="accept"]',
        '[data-testid*="accept"]',
        '[data-testid*="consent"]',
        // "I agree", "Accept All", "Got it" patterns  
        'button:not([disabled])',
      ];

      // Try to find and click a consent/accept button
      for (const sel of universalSelectors.slice(0, -1)) {
        try {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetHeight > 0 && btn.offsetWidth > 0) {
            const text = btn.textContent.toLowerCase().trim();
            if (text.includes('accept') || text.includes('agree') || text.includes('got it') ||
              text.includes('ok') || text.includes('allow') || text.includes('consent') ||
              text.includes('continue') || text.includes('dismiss')) {
              btn.click();
              return; // Only click one
            }
          }
        } catch { /* ignore */ }
      }
    }).catch(() => { });

    // ── Amazon: dismiss location/sign-in tooltips ──
    if (hostname.includes('amazon.')) {
      await this.page.evaluate(() => {
        const tooltip = document.querySelector('#nav-main .nav-signin-tooltip .nav-action-button');
        if (tooltip) tooltip.click();
        const locationDismiss = document.querySelector('#GLUXConfirmClose, #glow-toaster-body .a-button-text');
        if (locationDismiss) locationDismiss.click();
      }).catch(() => { });
    }

    // ── YouTube: accept consent ──
    if (hostname.includes('youtube.com')) {
      await this.page.evaluate(() => {
        const consentBtn = document.querySelector(
          'button[aria-label*="Accept"], ' +
          'button[aria-label*="accept"], ' +
          'tp-yt-paper-dialog #button'
        );
        if (consentBtn) consentBtn.click();
      }).catch(() => { });
    }

    // ── Google: accept cookies ──
    if (hostname.includes('google.')) {
      await this.page.evaluate(() => {
        const acceptBtn = document.querySelector(
          '#L2AGLb, ' +
          'button[id*="accept"], ' +
          '[aria-label="Accept all"]'
        );
        if (acceptBtn) acceptBtn.click();
      }).catch(() => { });
    }

    // ── Yahoo: dismiss consent/cookie dialogs ──
    if (hostname.includes('yahoo.com')) {
      await this.page.evaluate(() => {
        const consentBtn = document.querySelector(
          '[name="agree"], ' +
          'button[value="agree"], ' +
          '.consent-form button.accept-all, ' +
          '[data-testid="consent-accept-btn"]'
        );
        if (consentBtn) consentBtn.click();
      }).catch(() => { });
    }
  }

  // ─────────────────────────────────────────────
  // SCROLL POSITION GUARD
  // ─────────────────────────────────────────────

  /**
   * Execute an async action while guarding the scroll position.
   * If the action causes unexpected scrolling, restore the original position.
   *
   * @param {Function} actionFn - Async function to execute
   * @param {{ tolerance?: number, allowScroll?: boolean }} options
   */
  async guardScrollPosition(actionFn, options = {}) {
    const { tolerance = 5, allowScroll = false } = options;

    if (allowScroll) {
      return actionFn();
    }

    const before = await this.captureViewportState();
    const result = await actionFn();
    const after = await this.captureViewportState();

    const driftY = Math.abs(after.scrollY - before.scrollY);
    const driftX = Math.abs(after.scrollX - before.scrollX);

    if (driftY > tolerance || driftX > tolerance) {
      logger.warn(
        `⚠️  Scroll drift detected: ΔX=${driftX}px, ΔY=${driftY}px — restoring`
      );
      await this.restoreViewportState(before);
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  _isBoxInViewport(box, viewport) {
    return (
      box.y >= 0 &&
      box.x >= 0 &&
      box.y + box.height <= viewport.viewportHeight &&
      box.x + box.width <= viewport.viewportWidth
    );
  }

  _sleep(ms) {
    // Slightly reduce static delays for faster execution (30% reduction)
    const reducedMs = Math.max(50, Math.floor(ms * 0.7));
    return new Promise((r) => setTimeout(r, reducedMs));
  }
}

module.exports = ViewportGuard;
