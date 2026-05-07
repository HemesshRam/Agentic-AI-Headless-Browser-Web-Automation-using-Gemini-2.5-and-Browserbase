'use strict';

/**
 * ===============================================================
 * PROMPT BUILDER v2.0 — Single Source of Truth
 * ===============================================================
 *
 * Key changes from v1.0:
 * - RICH action history: shows exactly what was typed, clicked, where
 * - SIMPLIFIED rules: no conflicting autocomplete guidance
 * - The orchestrator handles post-type decisions (Enter vs autocomplete)
 *   so the model only needs to decide the NEXT unique action
 * - Universal — works on ANY website
 */

class PromptBuilder {
  /**
   * Build the vision analysis prompt.
   * @param {string} taskPrompt - The user's task description
   * @param {object} context - { url, stepNumber, scrollY, pageTitle, history, extractedData, typedValues, searchSubmitted }
   * @returns {string} Complete prompt text
   */
  static buildVisionPrompt(taskPrompt, context = {}) {
    const url = context.url || 'unknown';
    const stepNumber = context.stepNumber || 1;
    const scrollY = context.scrollY || 0;
    const pageTitle = context.pageTitle || 'unknown';
    const history = (context.history || []).slice(-8);
    const extractedData = context.extractedData || {};
    const typedValues = context.typedValues || [];
    const searchSubmitted = context.searchSubmitted || false;

    // ── Detect page state from URL ────────────────────────
    const pageState = PromptBuilder._detectPageState(url, taskPrompt);

    // ── Build RICH history string ─────────────────────────
    const historyStr = history.length > 0
      ? history.map(h => {
          let detail = `  Step ${h.step}: ${h.action}`;
          if (h.value) detail += ` "${h.value}"`;
          if (h.selector) detail += ` on ${h.selector}`;
          if (h.coordinate) detail += ` at (${h.coordinate})`;
          detail += h.success ? ' ✅' : ' ❌';
          if (h.error) detail += ` (${h.error})`;
          return detail;
        }).join('\n')
      : '  (none yet)';

    // ── What has already been typed ───────────────────────
    const alreadyTyped = typedValues.length > 0
      ? `\n⚠️ ALREADY TYPED: ${typedValues.map(v => `"${v}"`).join(', ')} — DO NOT type these again.`
      : '';

    const searchStatus = searchSubmitted
      ? '\n✅ SEARCH ALREADY SUBMITTED — You should now interact with the results, NOT retype or research.'
      : '';

    // ── Build dynamic task guidance ───────────────────────
    let taskGuidance = '';
    if (pageState.guidance) {
      taskGuidance = `\n${pageState.guidance}`;
    }

    // ── Detect task type for additional context ───────────
    const taskLower = taskPrompt.toLowerCase();
    const isExtractTask = /summar|extract|describe|analyz|review|price|detail|spec|info|data/i.test(taskLower);

    if (isExtractTask) {
      const dataCount = Object.keys(extractedData).length;
      if (dataCount > 0) {
        taskGuidance += `
⚠️ YOU ALREADY HAVE ${dataCount} DATA FIELDS EXTRACTED.
- Check: does the extracted data already answer the task?
- If YES → set taskComplete=true and return the data NOW. Do NOT keep scrolling.
- If NO → scroll once more to find the missing data, then complete.`;
      } else {
        taskGuidance += `
DATA EXTRACTION TASK:
- Look at the current viewport and extract relevant data into extractedData
- Scroll down ONCE to check for additional data, then complete
- Focus on what the task specifically asks for — don't try to extract everything
- Set taskComplete=true as soon as you have the data the task requests`;
      }
    }

    return `You are a browser automation agent. Analyze the screenshot and decide the single best NEXT action.

TASK: ${taskPrompt}
URL: ${url}
PAGE TITLE: ${pageTitle}
STEP: ${stepNumber} / ${context.maxSteps || 15}
PAGE STATE: ${pageState.state}
SCROLL: ${scrollY}px from top
${alreadyTyped}${searchStatus}

ACTION HISTORY:
${historyStr}

EXTRACTED DATA SO FAR: ${Object.keys(extractedData).length > 0 ? JSON.stringify(extractedData) : '(none)'}
${taskGuidance}

═══════════════════════════════════════════
RULES:
═══════════════════════════════════════════

1. USE COORDINATES for dynamic elements (dropdowns, menus, suggestions, modals).
   Use CSS selectors ONLY for simple static elements (search inputs, standard buttons).

2. NEVER REPEAT — check the ACTION HISTORY above. If you already typed something,
   DO NOT type it again. If you already clicked something, try a different action.
   If stuck, try: scrolling, pressing Escape, or clicking a different element.

3. OVERLAYS — If a cookie banner, popup, or modal is blocking content, dismiss it FIRST
   by clicking "Accept", "Close", or the X button.

4. AUTH WALLS — If you see a login page with no credentials provided, return action="error".

5. SEARCH SUBMISSION — After you type a search query, the system will automatically
   handle submission (pressing Enter or clicking suggestions). You do NOT need to
   press Enter or click autocomplete yourself after typing. Just type the query and
   the system handles the rest. On the NEXT step, you'll see the results.

6. RESULTS PAGES — If the URL shows search parameters (q=, k=, search=) or you see
   search results, do NOT retype. Interact with the results directly.

7. EXTRACTION — Put collected data in extractedData. Set taskComplete=true as soon as
   you have the specific data the task asks for. Do NOT over-scroll.

Return ONLY valid JSON (no markdown, no explanation):
{
  "action": "click|type|key|scroll|navigate|wait|done|error",
  "selector": "CSS selector (only for simple static elements)",
  "value": "text to type, URL to navigate, or key to press",
  "coordinate": { "x": 640, "y": 400 },
  "scrollDirection": "down",
  "scrollAmount": 400,
  "reasoning": "brief explanation of what you see and why this action",
  "confidence": 0.95,
  "taskComplete": false,
  "extractedData": {}
}`;
  }

  /**
   * Build the computer-use agent message content.
   */
  static buildComputerUseMessage(taskPrompt, context, base64Image) {
    const prompt = PromptBuilder.buildVisionPrompt(taskPrompt, context);
    return {
      role: 'user',
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image,
          },
        },
      ],
    };
  }

  // ─────────────────────────────────────────────────────────
  // PAGE STATE DETECTION (universal, URL-pattern based)
  // ─────────────────────────────────────────────────────────

  /**
   * Detect the current page state from the URL.
   * This is GENERIC — it uses URL patterns, not hardcoded domains.
   */
  static _detectPageState(url, taskPrompt) {
    const taskLower = taskPrompt.toLowerCase();

    // ── Extract search terms / identifiers from task ──────
    const quotedTerms = taskPrompt.match(/"([^"]+)"|'([^']+)'/g)?.map(t => t.replace(/['"]/g, '')) || [];
    const tickerMatch = taskPrompt.match(/\b([A-Z]{1,5})\b/);
    const searchTerm = quotedTerms[0] || (tickerMatch ? tickerMatch[1] : null);

    // ── Finance sites (Yahoo Finance, Google Finance, etc.) ──
    if (/finance\.|\/(finance|quote)\//i.test(url)) {
      const quoteMatch = url.match(/\/quote\/([A-Z0-9.-]+)/i);
      const currentTicker = quoteMatch ? quoteMatch[1].toUpperCase() : null;
      const requestedTicker = tickerMatch ? tickerMatch[1] : null;

      if (currentTicker && requestedTicker && currentTicker !== requestedTicker) {
        return {
          state: `WRONG_PAGE (on ${currentTicker}, need ${requestedTicker})`,
          guidance: `⚠️ WRONG PAGE: You are on ${currentTicker} but need ${requestedTicker}.
Use the search bar to search for "${requestedTicker}".`
        };
      }

      if (currentTicker) {
        return {
          state: `QUOTE_PAGE (${currentTicker})`,
          guidance: `You are on the quote page for ${currentTicker}.
- Extract: name, price, change %, volume, market cap, and any other visible metrics
- Scroll down for more data (company info, news, analyst ratings)
- Collect ALL data into extractedData before setting taskComplete=true`
        };
      }

      return {
        state: 'FINANCE_HOME',
        guidance: searchTerm ? `Type "${searchTerm}" in the search bar. The system will handle search submission automatically.` : ''
      };
    }

    // ── E-commerce product pages ──────────────────────────
    if (/\/product|\/dp\/|\/item\/|\/p\/|\/shop\//i.test(url)) {
      return {
        state: 'PRODUCT_PAGE',
        guidance: 'You are on a product page. Extract product name, price, ratings, and key details into extractedData.'
      };
    }

    // ── Search results pages ──────────────────────────────
    if (/[?&](q|query|search_query|search|k)=/i.test(url) || /\/search|\/results/i.test(url)) {
      return {
        state: 'SEARCH_RESULTS',
        guidance: `You are on a SEARCH RESULTS page.
- DO NOT retype the search query — results are already showing.
- Click the result that best matches the task.
- Use coordinate-based clicks on result titles/links.`
      };
    }

    // ── Video pages ───────────────────────────────────────
    if (/\/watch|\/video|\/play/i.test(url)) {
      return {
        state: 'VIDEO_PAGE',
        guidance: 'You are on a video page. Extract title, channel, description, and views.'
      };
    }

    // ── Generic home/landing page ─────────────────────────
    return {
      state: 'LANDING_PAGE',
      guidance: ''
    };
  }
}

module.exports = PromptBuilder;
