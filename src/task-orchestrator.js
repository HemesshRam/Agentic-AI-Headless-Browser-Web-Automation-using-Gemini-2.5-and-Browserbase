'use strict';

const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const AgentReasoning = require('./agent-reasoning');
const ToolExecutor = require('./tool-executor');
const ViewportGuard = require('./viewport-guard');

/**
 * ===============================================================
 * TASK ORCHESTRATOR v9.0 — Universal, Self-Correcting
 * ===============================================================
 *
 * Architecture: The orchestrator is the BRAIN. The vision model
 * only decides WHAT to do next. The orchestrator decides HOW
 * to execute it and handles all post-action intelligence:
 *
 * - Auto-submits search after typing (Enter or click suggestion)
 * - Never lets the same value be typed twice
 * - Tracks rich history so the model has full context
 * - Self-corrects stuck loops
 * - Handles navigation timeouts gracefully
 */

class TaskOrchestrator {
  constructor(page, onEvent = null) {
    this.page = page;
    this.onEvent = onEvent;
    this.agent = new AgentReasoning();
    this.executor = new ToolExecutor(page);
    this.guard = new ViewportGuard(page);
    this.maxSteps = parseInt(process.env.MAX_STEPS || '15');
    this.maxConsecutiveErrors = parseInt(process.env.MAX_CONSECUTIVE_ERRORS || '5');
    this.screenshotDir = path.join(process.cwd(), 'cache', 'screenshots');
    this._ensureDir(this.screenshotDir);

    // Task-level state
    this.typedValues = new Set();      // Track all values we've typed
    this.searchSubmitted = false;       // Whether we've submitted a search
    this.wantsAutocomplete = false;     // Whether task explicitly asks for autocomplete

    // Auth-wall URL patterns
    this.authWallPatterns = [
      /accounts\.google\.com/i,
      /login\.microsoft\.com/i,
      /appleid\.apple\.com/i,
      /\/login(?:\?|$|\/)/i,
      /\/signin(?:\?|$|\/)/i,
      /\/sign-in(?:\?|$|\/)/i,
      /\/auth(?:\?|$|\/)/i,
      /\/oauth(?:\?|$|\/)/i,
      /\/sso(?:\?|$|\/)/i,
    ];
  }

  async run(taskPrompt, startUrl) {
    const startTime = Date.now();

    logger.info('');
    logger.info(`${'═'.repeat(60)}`);
    logger.info(`🎯 Task: ${taskPrompt}`);
    logger.info(`🌐 URL:  ${startUrl}`);
    logger.info(`📊 Max Steps: ${this.maxSteps}`);
    logger.info(`${'═'.repeat(60)}`);

    // ── Pre-analyze the task ────────────────────────────
    const taskLower = taskPrompt.toLowerCase();
    this.wantsAutocomplete = /auto.?complete|suggestion|drop.?down/i.test(taskLower);
    if (this.wantsAutocomplete) {
      logger.info('🔍 Task requests autocomplete interaction — will click suggestions after typing');
    }

    // Emit start event
    this._emit('automation_started', {
      taskId: Date.now().toString(),
      url: startUrl,
      task: taskPrompt,
      maxSteps: this.maxSteps,
      liveViewUrl: this.page.liveViewUrl
    });

    const context = {
      url: startUrl,
      stepNumber: 0,
      maxSteps: this.maxSteps,
      history: [],
      previousActions: [],
      extractedData: {},
      complexity: 5,
      scrollY: 0,
      pageTitle: '',
      typedValues: [],
      searchSubmitted: false,
    };

    // ── Initial Navigation ──────────────────────────────
    try {
      await this.executor.navigate(startUrl);
      context.url = this._safeGetUrl();
      context.pageTitle = await this.page.title().catch(() => '');

      await this.guard.suppressOverlays();
      logger.info(`📄 Page loaded: "${context.pageTitle}" (${context.url})`);
    } catch (navErr) {
      logger.error(`❌ Initial navigation failed: ${navErr.message}`);
      const report = this._buildReport(taskPrompt, startUrl, context, false, null, startTime, navErr.message);
      this._emit('task_error', { error: navErr.message, step: 0 });
      return report;
    }

    let taskComplete = false;
    let lastAction = null;
    let consecutiveErrors = 0;
    let fatalError = null;
    let lastActionSignature = null;
    let repeatedActionCount = 0;

    for (let step = 1; step <= this.maxSteps; step++) {
      const stepStart = Date.now();
      context.stepNumber = step;

      logger.info('');
      logger.info(`── Step ${step}/${this.maxSteps} ${'─'.repeat(40)}`);

      try {
        // ── Capture current state ─────────────────────────
        const urlBefore = this._safeGetUrl();
        const viewportState = await this.guard.captureViewportState();
        context.scrollY = viewportState.scrollY;
        context.url = urlBefore;
        context.pageTitle = await this.page.title().catch(() => '');
        context.typedValues = Array.from(this.typedValues);
        context.searchSubmitted = this.searchSubmitted;

        // ── Screenshot ──────────────────────────────────
        const screenshotPath = path.join(this.screenshotDir, `step-${step}.png`);
        const base64 = await this._screenshot(screenshotPath);

        // ── Agent Reasoning ─────────────────────────────
        const action = await this.agent.reason(base64, taskPrompt, context);
        const confidence = (action.confidence || 0).toFixed(2);

        logger.info(`💡 Action: ${action.action} | Confidence: ${confidence}`);

        // ── Auth-wall URL detection ─────────────────────
        if (this._isAuthWall(context.url)) {
          fatalError = `Auth wall detected: browser redirected to ${context.url}`;
          logger.warn(`🔒 ${fatalError}`);
          this._emit('step_update', {
            step, maxSteps: this.maxSteps,
            action: 'error', reasoning: fatalError,
            confidence: 1.0, screenshot_b64: base64
          });
          break;
        }

        // ── GUARD: Never type the same value twice ──────
        if (action.action === 'type' && action.value && this.typedValues.has(action.value)) {
          logger.warn(`🚫 Blocked duplicate type: "${action.value}" was already typed`);

          // Decide what to do instead
          if (!this.searchSubmitted) {
            // We typed but never submitted — submit now
            logger.info('   ➡️  Auto-submitting the search instead');
            await this._autoSubmitSearch();
            this.searchSubmitted = true;
            context.history.push({
              step, action: 'key', value: 'Enter (auto-submit)',
              success: true, confidence: 1.0, duration: Date.now() - stepStart,
            });
            await this._postActionStabilize(urlBefore, { action: 'key' });
            await this._sleep(300);
            continue;
          } else {
            // Already submitted — skip and let agent try again with fresh screenshot
            logger.info('   ➡️  Search already submitted — skipping, will re-evaluate');
            context.history.push({
              step, action: 'skip', value: `blocked duplicate type "${action.value}"`,
              success: true, confidence: 1.0, duration: Date.now() - stepStart,
            });
            await this._sleep(500);
            continue;
          }
        }

        // ── GUARD: Excessive scrolling with data already collected ──
        const consecutiveScrolls = this._countConsecutiveScrolls(context.history);
        if (action.action === 'scroll' && consecutiveScrolls >= 2 && Object.keys(context.extractedData).length > 0) {
          logger.warn(`📜 ${consecutiveScrolls + 1} consecutive scrolls with ${Object.keys(context.extractedData).length} data fields — forcing completion`);
          taskComplete = true;
          context.history.push({
            step, action: 'done', value: 'auto-completed (enough data collected)',
            success: true, confidence: 1.0, duration: Date.now() - stepStart,
          });
          break;
        }

        // ── Stuck-loop detection ────────────────────────
        const actionParams = action.coordinate
          ? `${action.coordinate.x},${action.coordinate.y}`
          : (action.selector || action.value || '').substring(0, 50);
        const actionSignature = `${action.action}::${actionParams}::${context.url}`;

        if (actionSignature === lastActionSignature) {
          repeatedActionCount++;
          logger.debug(`   🔄 Repeated action count: ${repeatedActionCount}/3`);
          if (repeatedActionCount >= 3) {
            // Try a recovery action instead of aborting
            logger.warn(`🔄 Stuck loop detected — attempting recovery`);

            const recovered = await this._attemptRecovery(context, action, base64);
            if (recovered) {
              context.history.push({
                step, action: 'recovery', value: recovered,
                success: true, confidence: 1.0, duration: Date.now() - stepStart,
              });
              repeatedActionCount = 0;
              lastActionSignature = null;
              await this._postActionStabilize(urlBefore, { action: 'click' });
              await this._sleep(500);
              continue;
            }

            // Recovery failed — abort
            fatalError = `Stuck loop: repeated "${action.action}" 3 times, recovery failed`;
            logger.warn(`🔄 ${fatalError}`);
            this._emit('step_update', {
              step, maxSteps: this.maxSteps,
              action: 'error', reasoning: fatalError,
              confidence: 1.0, screenshot_b64: base64
            });
            break;
          }
        } else {
          lastActionSignature = actionSignature;
          repeatedActionCount = 1;
        }

        // ── Emit step update ────────────────────────────
        this._emit('step_update', {
          step, maxSteps: this.maxSteps,
          action: action.action,
          reasoning: action.reasoning,
          confidence: parseFloat(confidence),
          screenshot_b64: base64
        });

        // ── Check for completion ────────────────────────
        if (action.taskComplete || action.action === 'done') {
          taskComplete = true;
          if (action.extractedData && Object.keys(action.extractedData).length) {
            Object.assign(context.extractedData, action.extractedData);
          }
          const stepDuration = Date.now() - stepStart;
          logger.info(`✅ Task marked complete by agent (step took ${stepDuration}ms)`);

          context.history.push({
            step, action: 'done',
            duration: stepDuration,
            confidence: parseFloat(confidence),
          });
          break;
        }

        // ── Execute action ──────────────────────────────
        const result = await this.executor.execute(action);
        const stepDuration = Date.now() - stepStart;

        if (result.success) {
          consecutiveErrors = 0;
          logger.info(`   ✅ Action succeeded (${stepDuration}ms)`);
        } else {
          consecutiveErrors += 1;
          logger.warn(`   ⚠️  Action returned failure: ${result.reason || result.error || 'unknown'}`);

          if (consecutiveErrors >= this.maxConsecutiveErrors) {
            fatalError = `${consecutiveErrors} consecutive execution failures`;
            break;
          }
        }

        // ── Post-action: detect navigation & stabilize ──
        await this._postActionStabilize(urlBefore, action);

        // ── Post-type intelligence ──────────────────────
        // After successfully typing in a search box, auto-handle submission
        if (action.action === 'type' && action.value && result.success) {
          this.typedValues.add(action.value);

          // Auto-submit search: press Enter or click autocomplete
          const autoHandled = await this._handlePostType(action, urlBefore);
          if (autoHandled) {
            this.searchSubmitted = true;
            // Add a synthetic history entry for the auto-action
            context.history.push({
              step, action: 'auto-submit',
              value: autoHandled,
              success: true, confidence: 1.0, duration: 0,
            });
          }
        }

        // ── Record in history ───────────────────────────
        lastAction = { step, action: action.action, result, duration: stepDuration };
        context.history.push({
          step,
          action: action.action,
          value: action.value || undefined,
          selector: action.selector || undefined,
          coordinate: action.coordinate ? `${action.coordinate.x},${action.coordinate.y}` : undefined,
          success: result.success,
          error: result.success ? undefined : (result.reason || result.error || 'Unknown'),
          confidence: parseFloat(confidence),
          duration: stepDuration,
        });

        if (action.extractedData) Object.assign(context.extractedData, action.extractedData);

      } catch (err) {
        const msg = err.message || '';
        const isSessionCrash = msg.includes('Session closed') ||
          msg.includes('detached Frame') ||
          msg.includes('page has been closed') ||
          msg.includes('Target closed') ||
          msg.includes('Protocol error') ||
          msg.includes('Execution context was destroyed');

        if (isSessionCrash) {
          fatalError = `Browser session disconnected: ${msg.substring(0, 100)}`;
          logger.error(`🔌 ${fatalError}`);
          logger.info(`📦 Preserving ${Object.keys(context.extractedData).length} extracted data fields`);
        } else {
          fatalError = err.message;
          logger.error(`💥 Fatal error: ${err.message}`);
        }
        break;
      }

      // Small pause between steps
      await this._sleep(300);
    }

    // ── Final reporting ──────────────────────────────────
    if (!taskComplete && !fatalError && Object.keys(context.extractedData).length > 0) {
      logger.warn('⚠️  Task reached max steps without explicit completion.');
      logger.info(`📦 But we have ${Object.keys(context.extractedData).length} extracted data fields — reporting partial success`);
    } else if (!taskComplete) {
      logger.warn('⚠️  Task reached max steps without explicit completion.');
    }

    const report = this._buildReport(taskPrompt, startUrl, context, taskComplete, lastAction, startTime, fatalError);

    if (taskComplete) {
      this._emit('task_complete', { success: true, report });
    } else {
      this._emit('task_error', { error: fatalError || 'Max steps reached', step: context.stepNumber });
    }

    return report;
  }

  // ─────────────────────────────────────────────────────────────
  // POST-TYPE INTELLIGENCE
  // ─────────────────────────────────────────────────────────────

  /**
   * After typing in an input, automatically handle search submission.
   * This removes the burden from the vision model, which often decides wrong.
   *
   * @returns {string|null} Description of what was done, or null if nothing
   */
  async _handlePostType(action, urlBefore) {
    try {
      // Check if we typed into a search-like input
      const isSearchInput = await this.page.evaluate(() => {
        const active = document.activeElement;
        if (!active || !active.tagName) return false;
        const tag = active.tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') return false;

        const type = (active.type || '').toLowerCase();
        const name = (active.name || '').toLowerCase();
        const role = (active.role || '').toLowerCase();
        const placeholder = (active.placeholder || '').toLowerCase();
        const ariaLabel = (active.getAttribute('aria-label') || '').toLowerCase();
        const id = (active.id || '').toLowerCase();

        return type === 'search' ||
          role === 'searchbox' || role === 'combobox' ||
          name.includes('search') || name.includes('query') || name === 'q' || name === 'k' ||
          placeholder.includes('search') || placeholder.includes('find') ||
          ariaLabel.includes('search') ||
          id.includes('search') || id.includes('query') ||
          id === 'twotabsearchtextbox';
      }).catch(() => false);

      if (!isSearchInput) {
        logger.debug('   📝 Typed in non-search input — no auto-submit');
        return null;
      }

      logger.info('   🔍 Detected search input — handling auto-submit');

      // Wait for autocomplete to potentially appear
      await this._sleep(1500);

      if (this.wantsAutocomplete) {
        // Task wants autocomplete — try to click the first suggestion
        logger.info('   📋 Task wants autocomplete — clicking first suggestion');

        const clicked = await this.page.evaluate(() => {
          const selectors = [
            '[role="option"]',
            '[role="listbox"] li a',
            '[role="listbox"] li',
            '[class*="suggestion"] a',
            '[class*="suggestion"] li',
            '[class*="autocomplete"] a',
            '[class*="autocomplete"] li',
            '[class*="autosuggest"] a',
            '[class*="autosuggest"] li',
            '[data-testid*="suggest"]',
            '[class*="dropdown"] li a',
            '[class*="typeahead"] li a',
            '[class*="search-result"] a',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetHeight > 0 && el.offsetWidth > 0) {
              el.click();
              return sel;
            }
          }
          return null;
        }).catch(() => null);

        if (clicked) {
          logger.info(`   ✅ Auto-clicked first suggestion via: ${clicked}`);
          await this._sleep(1000);
          return `clicked autocomplete: ${clicked}`;
        }

        // No suggestion found — fall through to Enter
        logger.warn('   ⚠️  No autocomplete suggestion found — pressing Enter instead');
      }

      // Default: press Enter to submit the search
      logger.info('   ⏎  Auto-pressing Enter to submit search');
      await this.page.keyboard.press('Enter');
      await this._sleep(1500);

      // Wait for potential navigation
      const urlAfter = this._safeGetUrl();
      if (urlAfter !== urlBefore) {
        logger.info(`   🔄 Search navigated: ${urlBefore.substring(0, 40)} → ${urlAfter.substring(0, 40)}`);
        this.guard.resetOverlaySuppression();
        await this.guard.suppressOverlays().catch(() => {});
        await this._sleep(1000);
      }

      return 'pressed Enter';
    } catch (err) {
      logger.debug(`Post-type handler error: ${err.message}`);
      return null;
    }
  }

  /**
   * Auto-submit a search by refocusing the input and pressing Enter
   */
  async _autoSubmitSearch() {
    // Refocus the search input
    await this.page.evaluate(() => {
      const inputs = [
        ...document.querySelectorAll('input[type="search"]'),
        ...document.querySelectorAll('input[role="combobox"]'),
        ...document.querySelectorAll('input[role="searchbox"]'),
        ...document.querySelectorAll('input[name*="search"]'),
        ...document.querySelectorAll('input[name="q"]'),
        ...document.querySelectorAll('input[name="k"]'),
        ...document.querySelectorAll('input[type="text"]'),
      ];
      for (const el of inputs) {
        if (el.offsetWidth > 50 && el.value.length > 0) {
          el.focus();
          return;
        }
      }
    }).catch(() => {});

    await this._sleep(300);
    await this.page.keyboard.press('Enter');
    await this._sleep(2000);
    logger.info('   ⏎  Auto-submitted search');
  }

  // ─────────────────────────────────────────────────────────────
  // STUCK LOOP RECOVERY
  // ─────────────────────────────────────────────────────────────

  /**
   * Attempt to recover from a stuck loop.
   * Tries various strategies before giving up.
   */
  async _attemptRecovery(context, stuckAction, base64) {
    logger.info('   🔧 Attempting recovery strategies...');

    // Strategy 1: If we have unsubmitted typed text, submit it
    if (this.typedValues.size > 0 && !this.searchSubmitted) {
      logger.info('   Strategy 1: Submit unsubmitted search');
      await this._autoSubmitSearch();
      this.searchSubmitted = true;
      return 'submitted search';
    }

    // Strategy 2: Press Escape to dismiss any overlay
    logger.info('   Strategy 2: Press Escape');
    await this.page.keyboard.press('Escape');
    await this._sleep(500);

    // Strategy 3: Scroll down to reveal more content
    logger.info('   Strategy 3: Scroll down');
    await this.page.evaluate(() => window.scrollBy(0, 400));
    await this._sleep(500);

    return 'scrolled and dismissed overlays';
  }

  // ─────────────────────────────────────────────────────────────
  // POST-ACTION STABILIZATION
  // ─────────────────────────────────────────────────────────────

  async _postActionStabilize(urlBefore, action) {
    try {
      const navActions = ['click', 'navigate', 'key'];
      if (!navActions.includes(action.action)) return;

      await this._sleep(500);

      const urlAfter = this._safeGetUrl();
      if (urlAfter && urlAfter !== urlBefore) {
        logger.debug(`🔄 Page navigated: ${urlBefore.substring(0, 40)} → ${urlAfter.substring(0, 40)}`);

        try {
          await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
        } catch {
          // Navigation may have already completed
        }
        await this._sleep(1000);

        this.guard.resetOverlaySuppression();
        await this.guard.suppressOverlays().catch(() => {});
      }
    } catch (err) {
      logger.debug(`Post-action stabilize warning: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  _emit(event, data) {
    if (this.onEvent) {
      this.onEvent({ type: event, ...data });
    }
  }

  _safeGetUrl() {
    try {
      return this.page.url();
    } catch {
      return 'unknown';
    }
  }

  async _screenshot(savePath) {
    const buffer = await this.page.screenshot({ fullPage: false });
    if (process.env.SAVE_SCREENSHOTS === 'true') fs.writeFileSync(savePath, buffer);
    return buffer.toString('base64');
  }

  _buildReport(taskPrompt, startUrl, context, taskComplete, lastAction, startTime, fatalError = null) {
    const report = {
      taskPrompt,
      startUrl,
      finalUrl: context.url,
      taskComplete,
      fatalError,
      stepsExecuted: context.stepNumber,
      totalDurationMs: Date.now() - startTime,
      extractedData: context.extractedData,
      actionHistory: context.history,
      timestamp: new Date().toISOString(),
    };
    logger.info(`📊 Automation complete. Status: ${taskComplete ? '✅' : '❌'}`);
    return report;
  }

  /**
   * Count how many consecutive scroll actions are at the end of history
   */
  _countConsecutiveScrolls(history) {
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].action === 'scroll') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  _ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
  _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  _isAuthWall(url) {
    if (!url) return false;
    return this.authWallPatterns.some(pattern => pattern.test(url));
  }
}

module.exports = TaskOrchestrator;