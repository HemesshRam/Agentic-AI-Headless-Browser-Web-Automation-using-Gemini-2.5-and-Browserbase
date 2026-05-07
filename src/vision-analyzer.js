'use strict';

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const logger = require('./logger');
const PromptBuilder = require('./prompt-builder');

class VisionAnalyzer {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in .env');
    }
    // ✅ FIX: Use GoogleGenAI from @google/genai (not GoogleGenerativeAI)
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.modelName = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Analyze a base64 screenshot and return next action
   * @param {string} base64Image  – PNG/JPEG as base64
   * @param {string} taskPrompt   – human task description
   * @param {object} context      – optional { url, stepNumber, history }
   * @returns {object} { action, selector, value, reasoning, confidence }
   */
  async analyze(base64Image, taskPrompt, context = {}) {
    try {
      logger.debug(`🔍 Vision analysis – step ${context.stepNumber || '?'}`);

      // Use the unified prompt builder (single source of truth)
      const systemPrompt = PromptBuilder.buildVisionPrompt(taskPrompt, context);

      // ✅ FIX: Call the generateContent method correctly for @google/genai
      const result = await this.ai.models.generateContent({
        model: this.modelName,
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

      // ✅ FIX: result.text is a getter property on GenerateContentResponse
      const responseText = result.text;
      if (!responseText) {
        throw new Error('Vision model returned no text response');
      }

      return this._parseResponse(responseText);
    } catch (error) {
      logger.error(`Vision analysis failed: ${error.message}`);
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
      };
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────

  _parseResponse(text) {
    try {
      // Strip markdown fences if present
      let cleaned = (text || '').replace(/```json|```/g, '').trim();
      // Try to extract JSON object if there's surrounding text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      if (!cleaned) {
        return {
          action: 'error',
          reasoning: 'Empty response from vision model',
          confidence: 0,
        };
      }
      return JSON.parse(cleaned);
    } catch {
      logger.warn('Could not parse vision response as JSON');
      return {
        action: 'error',
        reasoning: 'Model returned non-JSON response: ' + (text ? text.substring(0, 100) : '(empty)'),
        confidence: 0,
      };
    }
  }
}

module.exports = VisionAnalyzer;