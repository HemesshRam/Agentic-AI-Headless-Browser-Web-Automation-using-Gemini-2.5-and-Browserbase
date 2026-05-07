'use strict';

const logger = require('./logger');

/**
 * ===============================================================
 * SCROLL MANAGER v6.3
 * ===============================================================
 *
 * UPGRADES from v6.1:
 * 1. freezeScroll() / unfreezeScroll() — lock page scroll entirely
 * 2. getScrollPosition() / restoreScrollPosition() — explicit save/restore
 * 3. scrollIntoView uses { block: 'nearest' } for minimal displacement
 * 4. All scroll amounts capped to prevent massive viewport jumps
 */

class ScrollManager {
  constructor(page) {
    this.page = page;
    this._frozen = false;
  }

  // ─────────────────────────────────────────────
  // SCROLL FREEZE / UNFREEZE
  // ─────────────────────────────────────────────

  /**
   * Completely lock the page from scrolling (CSS overflow: hidden on <html>).
   * Useful during date picker interactions, modal dialogs, etc.
   */
  async freezeScroll() {
    if (this._frozen) return;
    await this.page.evaluate(() => {
      document.documentElement.style.setProperty('overflow', 'hidden', 'important');
      document.body.style.setProperty('overflow', 'hidden', 'important');
    });
    this._frozen = true;
    logger.debug('🧊 Scroll frozen');
  }

  /**
   * Unlock the page scroll (restore original overflow values).
   */
  async unfreezeScroll() {
    if (!this._frozen) return;
    await this.page.evaluate(() => {
      document.documentElement.style.removeProperty('overflow');
      document.body.style.removeProperty('overflow');
    });
    this._frozen = false;
    logger.debug('🔓 Scroll unfrozen');
  }

  // ─────────────────────────────────────────────
  // EXPLICIT SAVE / RESTORE
  // ─────────────────────────────────────────────

  /**
   * Get current scroll position
   * @returns {{ x: number, y: number }}
   */
  async getScrollPosition() {
    return this.page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));
  }

  /**
   * Restore a previously saved scroll position
   * @param {{ x: number, y: number }} pos
   */
  async restoreScrollPosition(pos) {
    await this.page.evaluate((x, y) => window.scrollTo(x, y), pos.x, pos.y);
    await this._sleep(100);
  }

  // ─────────────────────────────────────────────
  // CONTROLLED SCROLLING
  // ─────────────────────────────────────────────

  /** Scroll down by pixels (capped at 600px) */
  async scrollDown(pixels = 300) {
    const capped = Math.min(pixels, 600);
    if (this.page.mouse && this.page.mouse.wheel) {
      await this.page.mouse.wheel({ deltaY: capped });
    } else {
      await this.page.evaluate((px) => window.scrollBy(0, px), capped);
    }
    await this._sleep(200);
  }

  /** Scroll up by pixels (capped at 600px) */
  async scrollUp(pixels = 300) {
    const capped = Math.min(pixels, 600);
    if (this.page.mouse && this.page.mouse.wheel) {
      await this.page.mouse.wheel({ deltaY: -capped });
    } else {
      await this.page.evaluate((px) => window.scrollBy(0, -px), capped);
    }
    await this._sleep(200);
  }

  /** Scroll to page bottom (incremental to avoid massive jumps) */
  async scrollToBottom() {
    const maxScroll = await this.page.evaluate(() => document.body.scrollHeight - window.scrollY);
    const steps = Math.ceil(maxScroll / 500);
    for (let i = 0; i < steps; i++) {
      await this.scrollDown(500);
      await this._sleep(100);
    }
    await this._sleep(300);
  }

  /** Scroll to page top (incremental) */
  async scrollToTop() {
    const currentScroll = await this.page.evaluate(() => window.scrollY);
    const steps = Math.ceil(currentScroll / 500);
    for (let i = 0; i < steps; i++) {
      await this.scrollUp(500);
      await this._sleep(100);
    }
    await this._sleep(200);
  }

  /**
   * Scroll until element is in view — using { block: 'nearest' }
   * for MINIMAL viewport displacement (not 'center' which causes large jumps).
   */
  async scrollIntoView(selector) {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });

      // Save position before scroll
      const posBefore = await this.getScrollPosition();

      // Check if element is already visible
      const isVisible = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return (
          rect.top >= 0 &&
          rect.bottom <= window.innerHeight
        );
      }, selector);

      if (isVisible) {
        logger.debug(`Element ${selector} already in viewport — no scroll needed`);
        return true;
      }

      // Minimal scrollIntoView — 'nearest' causes the least displacement
      await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }
      }, selector);

      await this._sleep(300);

      const posAfter = await this.getScrollPosition();
      const drift = Math.abs(posAfter.y - posBefore.y);
      if (drift > 0) {
        logger.debug(`📐 Scrolled ${drift}px to bring ${selector} into view`);
      }

      return true;
    } catch (err) {
      logger.warn(`Failed to scroll into view for ${selector}: ${err.message}`);
      return false;
    }
  }

  /** Human-like incremental scroll */
  async humanScroll(totalPixels = 800, steps = 5) {
    const chunk = Math.floor(totalPixels / steps);
    for (let i = 0; i < steps; i++) {
      const randomize = Math.floor(Math.random() * 40 - 20); // +/- 20px
      await this.scrollDown(chunk + randomize);
      await this._sleep(100 + Math.random() * 150); // 100-250ms sleep
    }
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = ScrollManager;