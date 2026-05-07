'use strict';

require('dotenv').config();
const { GoogleGenAI, Environment } = require('@google/genai');
const logger = require('./logger');
const PromptBuilder = require('./prompt-builder');


class ComputerUseAgent {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in .env');
    }

    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Use gemini-2.5-flash as primary model (reliable vision analysis)
    // Computer Use tool (gemini-2.5-computer-use-preview) has SDK compatibility issues
    this.computerUseModel = process.env.GEMINI_COMPUTER_USE_MODEL || 'gemini-2.5-flash';
    this.visionModel = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';

    this.consecutiveErrors = 0;
    // 🔄 Computer Use tool has SDK issues - using Vision + Function Analysis instead
    this.supportsComputerUse = false; // Disable computer use, rely on vision analysis
  }

  /**
   * Execute one automation step using Gemini.
   * Now uses Vision analysis (Computer Use tool has SDK issues).
   */
  async execute(base64Image, taskPrompt, context = {}) {
    try {
      logger.info(`🤖 Agent step ${context.stepNumber || 1} | URL: ${(context.url || 'unknown').substring(0, 60)}`);

      // Skip computer use (SDK has compatibility issues) - go straight to vision
      logger.debug('Using Vision Analysis for reliable automation');
      return await this._visionAnalyze(base64Image, taskPrompt, context);

    } catch (error) {
      this.consecutiveErrors += 1;
      logger.error(`Agent error: ${error.message}`);
      return {
        action: 'error',
        selector: '',
        value: '',
        scrollDirection: 'down',
        scrollAmount: 300,
        reasoning: error.message,
        confidence: 0,
        taskComplete: false,
        extractedData: {},
        _consecutiveErrors: this.consecutiveErrors,
      };
    }
  }

  reset() {
    this.consecutiveErrors = 0;
    logger.debug('ComputerUseAgent reset()');
  }

  // ─────────────────────────────────────────────────────────────
  // COMPUTER-USE ATTEMPT (may fail on first call)
  // ─────────────────────────────────────────────────────────────

  async _tryComputerUse(base64Image, taskPrompt, context) {
    const userMessage = PromptBuilder.buildComputerUseMessage(taskPrompt, context, base64Image);

    let result;
    try {
      // Configure Computer Use tool according to Google GenAI SDK documentation
      result = await this.ai.models.generateContent({
        model: this.computerUseModel,
        contents: [userMessage],
        tools: [
          {
            computerUse: {
              environment: Environment.ENVIRONMENT_BROWSER,
            },
          },
        ],
      });
    } catch (apiError) {
      if (apiError.status === 400 || apiError.message?.includes('INVALID_ARGUMENT')) {
        logger.warn(`⚠️  computerUse tool not available or misconfigured (400 error): ${apiError.message}`);
        throw new Error(`Computer-use tool unavailable: ${apiError.message}`);
      }
      throw apiError;
    }

    if (!result) {
      throw new Error('generateContent returned null/undefined');
    }

    let parsed = null;
    let hasFunctionCall = false;
    
    if (result.functionCalls && Array.isArray(result.functionCalls) && result.functionCalls.length > 0) {
      const call = result.functionCalls[0];
      logger.debug(`✅ Native computerUse call: ${call.name}`);
      parsed = this._mapNativeCall(call);
      hasFunctionCall = true;
    } else if (result.candidates && result.candidates[0]) {
      const candidate = result.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.functionCall) {
            logger.debug(`✅ Native computerUse call (candidates path): ${part.functionCall.name}`);
            parsed = this._mapNativeCall(part.functionCall);
            hasFunctionCall = true;
            break;
          }
        }
      }
    }

    if (!hasFunctionCall) {
      const text = result.text;
      if (text) {
        parsed = this._parseResponse(text);
      } else {
        throw new Error('No function calls or text in response');
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      logger.warn('Parsed action is invalid — using wait fallback');
      parsed = { action: 'wait', reasoning: 'Could not parse model response' };
    }

    this.consecutiveErrors = 0;
    return this._normalize(parsed);
  }

  // ─────────────────────────────────────────────────────────────
  // VISION FALLBACK (always reliable)
  // ─────────────────────────────────────────────────────────────

  async _visionAnalyze(base64Image, taskPrompt, context = {}) {
    // Use the unified prompt builder
    const systemPrompt = PromptBuilder.buildVisionPrompt(taskPrompt, context);

    const result = await this.ai.models.generateContent({
      model: this.visionModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Image,
              },
            },
          ],
        },
      ],
    });

    const responseText = result.text;
    if (!responseText) {
      throw new Error('Vision model returned no text response');
    }

    let parsed = this._parseResponse(responseText);
    if (!parsed || typeof parsed !== 'object') {
      logger.warn('Vision response invalid — using wait fallback');
      parsed = { action: 'wait', reasoning: 'Could not parse vision response' };
    }

    this.consecutiveErrors = 0;
    return this._normalize(parsed);
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────

  _mapNativeCall(call) {
    const args = call.args || {};
    const nativeAction = (args.action || '').toLowerCase();

    const actionMap = {
      screenshot: 'screenshot',
      click: 'click',
      double_click: 'click',
      left_click: 'click',
      right_click: 'click',
      type: 'type',
      key: 'type',
      scroll: 'scroll',
    };

    const action = actionMap[nativeAction] || nativeAction || 'wait';
    const coordinate = args.coordinate || args.start_coordinate || [];
    const x = coordinate[0];
    const y = coordinate[1];

    return {
      action,
      selector: args.selector || '',
      value: args.text || args.key || '',
      coordinate: (x !== undefined && y !== undefined) ? { x, y } : null,
      scrollDirection: args.direction === 'up' ? 'up' : 'down',
      scrollAmount: Math.abs(args.delta_y || 300),
      reasoning: `Native computer-use: ${call.name}`,
      confidence: 0.95,
      taskComplete: false,
      extractedData: {},
    };
  }

  _parseResponse(text) {
    try {
      // Strip markdown fences and any text before/after JSON
      let cleaned = (text || '').replace(/```json|```/g, '').trim();
      // Try to extract JSON object if there's surrounding text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      if (!cleaned) {
        return { action: 'error', reasoning: 'Empty text response from model', confidence: 0 };
      }
      return JSON.parse(cleaned);
    } catch {
      return {
        action: 'error',
        reasoning: 'Non-JSON response: ' + (text ? text.substring(0, 120) : '(empty)'),
        confidence: 0,
      };
    }
  }

  _normalize(parsed) {
    const rawAction = parsed.action;
    const action = typeof rawAction === 'string' ? rawAction.toLowerCase() : 'wait';

    // Cap scroll amount to prevent massive viewport jumps
    let scrollAmount = typeof parsed.scrollAmount === 'number' ? parsed.scrollAmount : 300;
    if (scrollAmount > 600) {
      logger.warn(`⚠️  Agent requested ${scrollAmount}px scroll — capping to 600px`);
      scrollAmount = 600;
    }

    return {
      action,
      selector: parsed.selector || parsed.target || '',
      value: parsed.value || parsed.text || '',
      coordinate: parsed.coordinate || null,
      scrollDirection: parsed.scrollDirection || 'down',
      scrollAmount,
      reasoning: parsed.reasoning || 'Processed by agent',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      taskComplete: !!parsed.taskComplete,
      extractedData: parsed.extractedData && typeof parsed.extractedData === 'object'
        ? parsed.extractedData
        : {},
    };
  }
}

module.exports = ComputerUseAgent;