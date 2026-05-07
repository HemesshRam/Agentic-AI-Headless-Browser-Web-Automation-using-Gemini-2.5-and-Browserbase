'use strict';

const logger = require('./logger');
const ViewportGuard = require('./viewport-guard');

/**
 * ===============================================================
 * TOOL EXECUTOR v8.0 — Universal Website Support
 * ===============================================================
 *
 * Key improvements over v7.0:
 * - Universal autocomplete wait after type (any site, not hardcoded domains)
 * - Better selector fallback with DOM-based discovery
 * - Navigation-aware action execution
 * - Reduced artificial delays for faster execution
 * - Proper error bubbling (never silently swallows important errors)
 */

class ToolExecutor {
  constructor(page) {
    this.page = page;
    this.guard = new ViewportGuard(page);
    this.actionTimeout = parseInt(process.env.ACTION_TIMEOUT || '5000');
    this.elementTimeout = parseInt(process.env.ELEMENT_TIMEOUT || '10000');
    this.maxRetries = parseInt(process.env.ACTION_MAX_RETRIES || '2');
  }

  // ─────────────────────────────────────────────
  // MAIN DISPATCHER
  // ─────────────────────────────────────────────

  async execute(action) {
    const {
      action: type,
      selector,
      value,
      scrollDirection,
      scrollAmount,
      coordinate,
    } = action;

    let logStr = `⚙️  Execute: ${type}`;
    if (selector) logStr += ` → ${selector.substring(0, 60)}`;
    if (coordinate) logStr += ` @ (${coordinate.x},${coordinate.y})`;
    if (value) logStr += ` = "${String(value).substring(0, 60)}"`;
    logger.info(logStr);

    try {
      switch (type) {
        case 'click':
          return await this._withRetry(() => this.click(selector, coordinate), 'click');
        case 'double_click':
          return await this._withRetry(() => this.doubleClick(selector, coordinate), 'double_click');
        case 'right_click':
          return await this._withRetry(() => this.rightClick(selector, coordinate), 'right_click');
        case 'hover':
          return await this._withRetry(() => this.hover(selector, coordinate), 'hover');
        case 'type':
          return await this._withRetry(() => this.type(selector, value, coordinate), 'type');
        case 'select':
          return await this._withRetry(() => this.select(selector, value), 'select');
        case 'key':
        case 'keypress':
          return await this.keyPress(value);
        case 'scroll':
          return await this.scroll(scrollDirection, scrollAmount);
        case 'navigate':
          return await this._withRetry(() => this.navigate(value), 'navigate');
        case 'wait':
          return await this.wait(parseInt(value) || 2000);
        case 'extract':
          return await this.extract(selector);
        case 'screenshot':
          return await this.screenshot();
        case 'done':
          logger.info('✅ Agent signalled task completion');
          return { success: true, done: true };
        case 'error':
          logger.error(`🚨 Agent signalled error: ${action.reasoning}`);
          return { success: false, action: 'error', reason: action.reasoning };
        default:
          logger.warn(`❓ Unknown action type: "${type}" — treating as wait`);
          await this._sleep(1000);
          return { success: false, reason: `Unknown action: ${type}` };
      }
    } catch (err) {
      logger.error(`💥 Action "${type}" failed after retries: ${err.message}`);
      return {
        success: false,
        action: type,
        error: err.message,
        recoverable: !this._isSessionError(err),
      };
    }
  }

  // ─────────────────────────────────────────────
  // CLICK ACTIONS
  // ─────────────────────────────────────────────

  async click(selector, coordinate = null) {
    // Strategy 1: Coordinate click (most reliable for dynamic elements)
    if (coordinate) {
      logger.debug(`🖱️  Coordinate click at (${coordinate.x}, ${coordinate.y})`);
      await this.page.mouse.click(coordinate.x, coordinate.y);
      await this._sleep(400);
      return { success: true, action: 'click', coordinate, selector: selector || null };
    }

    // Strategy 2: Viewport-locked selector click
    if (selector) {
      const result = await this.guard.clickWithoutScroll(selector).catch(() => null);
      if (result && result.success) return result;

      // Strategy 3: Standard selector click (may auto-scroll)
      logger.warn(`Viewport-locked click failed — using standard click for: ${selector.substring(0, 50)}`);
      try {
        await this.page.waitForSelector(selector, { timeout: this.elementTimeout });
        await this.page.click(selector);
        await this._sleep(400);
        return { success: true, action: 'click', selector, fallback: true };
      } catch (err) {
        // Strategy 4: Try evaluate-based click
        logger.debug(`Standard click failed, trying evaluate click: ${err.message}`);
        const clicked = await this.page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) { el.click(); return true; }
          return false;
        }, selector).catch(() => false);

        if (clicked) {
          await this._sleep(400);
          return { success: true, action: 'click', selector, fallback: 'evaluate' };
        }
      }
    }

    return { success: false, reason: 'No selector or coordinate provided' };
  }

  async doubleClick(selector, coordinate = null) {
    if (coordinate) {
      await this.page.mouse.click(coordinate.x, coordinate.y, { clickCount: 2 });
      await this._sleep(400);
      return { success: true, action: 'double_click', coordinate };
    }

    if (selector) {
      await this.page.waitForSelector(selector, { timeout: this.elementTimeout });
      const el = await this.page.$(selector);
      const box = await el.boundingBox();
      if (box) {
        await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 2 });
      } else {
        await this.page.click(selector, { clickCount: 2 });
      }
      await this._sleep(400);
      return { success: true, action: 'double_click', selector };
    }

    return { success: false, reason: 'No selector or coordinate for double_click' };
  }

  async rightClick(selector, coordinate = null) {
    if (coordinate) {
      await this.page.mouse.click(coordinate.x, coordinate.y, { button: 'right' });
      await this._sleep(400);
      return { success: true, action: 'right_click', coordinate };
    }

    if (selector) {
      await this.page.waitForSelector(selector, { timeout: this.elementTimeout });
      await this.page.click(selector, { button: 'right' });
      await this._sleep(400);
      return { success: true, action: 'right_click', selector };
    }

    return { success: false, reason: 'No selector or coordinate for right_click' };
  }

  async hover(selector, coordinate = null) {
    if (coordinate) {
      await this.page.mouse.move(coordinate.x, coordinate.y);
      await this._sleep(200);
      return { success: true, action: 'hover', coordinate };
    }

    if (selector) {
      await this.page.waitForSelector(selector, { timeout: this.elementTimeout });
      await this.page.hover(selector);
      await this._sleep(200);
      return { success: true, action: 'hover', selector };
    }

    return { success: false, reason: 'No selector or coordinate for hover' };
  }

  // ─────────────────────────────────────────────
  // TYPE / INPUT ACTIONS
  // ─────────────────────────────────────────────

  async type(selector, text, coordinate = null) {
    const textStr = String(text || '');

    // Strategy 1: Selector-based type (viewport-locked, then standard)
    if (selector) {
      const result = await this.guard.typeWithoutScroll(selector, textStr).catch(() => null);
      if (result && result.success) {
        await this._waitForDynamicContent();
        return result;
      }

      // Standard selector fallback
      const found = await this.page.waitForSelector(selector, { timeout: 3000 }).catch(() => null);
      if (found) {
        await this.page.click(selector);
        await this._clearInput();
        await this.page.keyboard.type(textStr, { delay: 40 });
        await this._waitForDynamicContent();
        return { success: true, action: 'type', selector, value: textStr, fallback: true };
      }

      // Alternative input discovery
      logger.warn(`Selector "${selector.substring(0, 50)}" not found — trying alternatives`);
      const altSelector = await this._findAlternativeInput();
      if (altSelector) {
        logger.info(`   🔄 Found alternative: ${altSelector}`);
        await this.page.click(altSelector);
        await this._clearInput();
        await this.page.keyboard.type(textStr, { delay: 40 });
        await this._waitForDynamicContent();
        return { success: true, action: 'type', selector: altSelector, value: textStr, fallback: true };
      }
    }

    // Strategy 2: Coordinate-based type
    if (coordinate) {
      logger.info(`   📍 Coordinate-based type at (${coordinate.x}, ${coordinate.y})`);
      await this.page.mouse.click(coordinate.x, coordinate.y);
      await this._sleep(300);
      await this._clearInput();
      await this.page.keyboard.type(textStr, { delay: 40 });
      await this._waitForDynamicContent();
      return { success: true, action: 'type', coordinate, value: textStr };
    }

    // Strategy 3: Auto-discover any visible input
    if (selector) {
      logger.warn('   ⚡ Last resort: auto-discovering input element');
      const focusedInput = await this.page.evaluate(() => {
        const candidates = [
          ...document.querySelectorAll('input[type="search"]'),
          ...document.querySelectorAll('input[type="text"]'),
          ...document.querySelectorAll('input[name*="search"]'),
          ...document.querySelectorAll('input[name*="query"]'),
          ...document.querySelectorAll('input[placeholder*="earch"]'),
          ...document.querySelectorAll('input[role="combobox"]'),
          ...document.querySelectorAll('[contenteditable="true"]'),
          ...document.querySelectorAll('textarea'),
        ];
        for (const el of candidates) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 50 && rect.height > 10) {
            el.focus();
            el.click();
            return true;
          }
        }
        return false;
      });

      if (focusedInput) {
        await this._sleep(200);
        await this._clearInput();
        await this.page.keyboard.type(textStr, { delay: 40 });
        await this._waitForDynamicContent();
        return { success: true, action: 'type', value: textStr, fallback: 'auto-discovered' };
      }
    }

    return { success: false, reason: 'No usable input found for type action' };
  }

  /**
   * Wait for dynamic content to appear after typing.
   * This is UNIVERSAL — works on any site with autocomplete/search suggestions.
   * Detects if new elements appeared in the DOM after typing.
   * Leaves autocomplete visible so the agent can see it and decide the next action.
   */
  async _waitForDynamicContent() {
    try {
      // Always wait a baseline amount for any dynamic content
      await new Promise(r => setTimeout(r, 1200));

      // Check if a dropdown/listbox/suggestions container appeared
      const hasSuggestions = await this.page.evaluate(() => {
        const indicators = [
          '[role="listbox"]',
          '[role="option"]',
          '[class*="autocomplete"]',
          '[class*="suggestion"]',
          '[class*="dropdown"]',
          '[class*="typeahead"]',
          '[class*="search-result"]',
          '[class*="autosuggest"]',
          'ul[class*="list"]',
          '[data-testid*="suggest"]',
          '[data-testid*="search"]',
        ];
        for (const sel of indicators) {
          const el = document.querySelector(sel);
          if (el && el.offsetHeight > 0) return true;
        }
        return false;
      }).catch(() => false);

      if (hasSuggestions) {
        logger.debug('📋 Autocomplete/suggestions detected — waiting for stabilization');
        // Wait for suggestions to fully render so the agent gets a clean screenshot
        await new Promise(r => setTimeout(r, 800));
      }
    } catch {
      // Ignore — page may have navigated
    }
  }

  async _clearInput() {
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('a');
    await this.page.keyboard.up('Control');
    await this._sleep(50);
  }

  /**
   * Find an alternative input element using DOM discovery.
   * Universal — not tied to specific websites.
   */
  async _findAlternativeInput() {
    const alternatives = [
      'input[type="search"]',
      'input[role="combobox"]',
      'input[role="searchbox"]',
      '[role="search"] input',
      '[role="searchbox"]',
      'input[placeholder*="earch"]',
      'input[placeholder*="Search"]',
      'input[aria-label*="earch"]',
      'input[aria-label*="Search"]',
      'input[name*="search"]',
      'input[name*="query"]',
      'input[name*="q"]',
      'input[name="search_query"]',
      'input#twotabsearchtextbox',
      'input[name="field-keywords"]',
      'textarea[name="q"]',
      'input[type="text"]',
    ];

    for (const alt of alternatives) {
      try {
        const found = await this.page.waitForSelector(alt, { timeout: 1200 });
        if (found) {
          const box = await found.boundingBox();
          if (box && box.width > 30) return alt;
        }
      } catch {
        // Continue to next
      }
    }
    return null;
  }

  async select(selector, value) {
    if (!selector) return { success: false, reason: 'No selector for select' };

    try {
      await this.page.waitForSelector(selector, { timeout: this.elementTimeout });
      await this.page.select(selector, value);
      await this._sleep(300);
      return { success: true, action: 'select', selector, value };
    } catch (err) {
      logger.debug(`page.select failed, trying click fallback: ${err.message}`);
      try {
        await this.page.click(selector);
        await this._sleep(200);
        await this.page.evaluate((sel, val) => {
          const selectEl = document.querySelector(sel);
          if (selectEl) {
            const options = selectEl.querySelectorAll('option');
            for (const opt of options) {
              if (opt.value === val || opt.textContent.trim().toLowerCase().includes(val.toLowerCase())) {
                opt.selected = true;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                break;
              }
            }
          }
        }, selector, value);
        return { success: true, action: 'select', selector, value, fallback: true };
      } catch (err2) {
        throw err2;
      }
    }
  }

  async keyPress(key) {
    const keyStr = String(key || '');
    logger.debug(`⌨️  Key press: ${keyStr}`);

    const keyMap = {
      'enter': 'Enter',
      'tab': 'Tab',
      'escape': 'Escape',
      'esc': 'Escape',
      'backspace': 'Backspace',
      'delete': 'Delete',
      'space': 'Space',
      'arrowup': 'ArrowUp',
      'arrowdown': 'ArrowDown',
      'arrowleft': 'ArrowLeft',
      'arrowright': 'ArrowRight',
      'pageup': 'PageUp',
      'pagedown': 'PageDown',
      'home': 'Home',
      'end': 'End',
    };

    const resolvedKey = keyMap[keyStr.toLowerCase()] || keyStr;
    await this.page.keyboard.press(resolvedKey);
    await this._sleep(300);
    return { success: true, action: 'keypress', key: resolvedKey };
  }

  // ─────────────────────────────────────────────
  // SCROLL
  // ─────────────────────────────────────────────

  async scroll(direction = 'down', amount = 300) {
    const cappedAmount = Math.min(Math.abs(amount), 600);
    if (Math.abs(amount) > 600) {
      logger.warn(`⚠️  Scroll ${amount}px capped to ${cappedAmount}px`);
    }

    const sign = direction === 'up' || direction === 'left' ? -1 : 1;
    const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';

    await this.page.evaluate(
      (ax, delta) => window.scrollBy(
        ax === 'x' ? delta : 0,
        ax === 'y' ? delta : 0
      ),
      axis,
      sign * cappedAmount
    );

    await this._sleep(300);
    return { success: true, action: 'scroll', direction, amount: cappedAmount };
  }

  // ─────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────

  async navigate(url) {
    // Lowered default from 60s to 15s to prevent hanging on heavy SPAs
    const navTimeout = parseInt(process.env.NAVIGATION_TIMEOUT || '15000');

    logger.info(`🌍 Navigating to: ${url}`);
    
    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: navTimeout,
      });
    } catch (navErr) {
      // Navigation timeout is NOT fatal — heavy SPAs (Yahoo Finance, TradingView, etc.)
      // often stall domcontentloaded but render usable content well before the timeout.
      if (navErr.message && navErr.message.includes('timeout')) {
        logger.warn(`⏱️  Navigation timeout after ${navTimeout}ms — continuing with partial load`);
        // Check if page has any content at all
        const hasContent = await this.page.evaluate(() => document.body && document.body.innerHTML.length > 100).catch(() => false);
        if (!hasContent) {
          // Page is truly blank — this is a real failure
          throw new Error(`Navigation timeout and page is empty: ${url}`);
        }
        logger.info(`   📄 Page has content despite timeout — proceeding`);
      } else {
        // Non-timeout errors (DNS failure, connection refused, etc.) are truly fatal
        throw navErr;
      }
    }

    // Allow JS to render after DOM is ready
    await this._sleep(2000);

    // Reset and re-apply overlay suppression on new page
    this.guard.resetOverlaySuppression();
    await this._sleep(500);
    await this.guard.suppressOverlays();

    logger.info(`✅ Navigation complete: ${await this.page.url()}`);
    return { success: true, action: 'navigate', url };
  }

  // ─────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────

  async wait(ms = 2000) {
    const capped = Math.min(ms, 10000);
    logger.debug(`⏳ Waiting ${capped}ms`);
    await this._sleep(capped);
    return { success: true, action: 'wait', ms: capped };
  }

  async extract(selector) {
    try {
      if (!selector) {
        const text = await this.page.evaluate(() => document.body.innerText.substring(0, 5000));
        return { success: true, action: 'extract', data: [text] };
      }

      const data = await this.page.evaluate((sel) => {
        const els = document.querySelectorAll(sel);
        return Array.from(els).map((el) => ({
          text: el.textContent.trim(),
          href: el.href || null,
          src: el.src || null,
          value: el.value || null,
        }));
      }, selector);

      logger.info(`📦 Extracted ${data.length} element(s) from: ${selector}`);
      return { success: true, action: 'extract', data, count: data.length };
    } catch (err) {
      logger.error(`Extract failed: ${err.message}`);
      return { success: false, action: 'extract', error: err.message };
    }
  }

  async screenshot() {
    try {
      const data = await this.page.screenshot({ encoding: 'base64', fullPage: false });
      return { success: true, action: 'screenshot', data };
    } catch (err) {
      logger.error(`Screenshot failed: ${err.message}`);
      return { success: false, action: 'screenshot', error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // RETRY LOGIC
  // ─────────────────────────────────────────────

  async _withRetry(actionFn, actionName) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await actionFn();
      } catch (err) {
        lastError = err;

        // Don't retry on session errors
        if (this._isSessionError(err)) {
          throw err;
        }

        if (attempt < this.maxRetries) {
          const delay = Math.min(500 * Math.pow(2, attempt), 3000);
          logger.warn(
            `🔄 Retry ${attempt + 1}/${this.maxRetries} for "${actionName}" in ${delay}ms — ${err.message}`
          );
          await this._sleep(delay);

          // Re-suppress overlays in case the page changed
          await this.guard.suppressOverlays().catch(() => { });
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if an error indicates the browser session is dead
   */
  _isSessionError(err) {
    const msg = (err.message || '').toLowerCase();
    return (
      msg.includes('session closed') ||
      msg.includes('browser has been closed') ||
      msg.includes('target closed') ||
      msg.includes('protocol error') ||
      msg.includes('page has been closed') ||
      msg.includes('execution context was destroyed')
    );
  }

  _sleep(ms) {
    // Slightly reduce static delays for faster execution (30% reduction)
    const reducedMs = Math.max(50, Math.floor(ms * 0.7));
    return new Promise((r) => setTimeout(r, reducedMs));
  }
}

module.exports = ToolExecutor;