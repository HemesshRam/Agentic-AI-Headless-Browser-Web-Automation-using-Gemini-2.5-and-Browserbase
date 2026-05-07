'use strict';

const Groq = require('groq-sdk');
const axios = require('axios');
const logger = require('./logger');

class IntentRouter {
  constructor() {
    this.groq = null;
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    this.tavilyKey = process.env.TAVILY_API_KEY;
  }

  async parse(prompt) {
    if (!this.groq) {
      logger.warn('GROQ_API_KEY not set — using simple parsing');
      return this._simpleParse(prompt);
    }

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are the automation intent router. Parse user prompts into automation tasks.
            Return JSON only: { 
              "intent": "search" | "navigate" | "analyze" | "other",
              "url": "full url if mentioned, else null",
              "task": "refined instruction for the automation agent",
              "search_query": "query for Tavily if no URL found",
              "confidence": 0-1
            }`
          },
          { role: 'user', content: prompt }
        ],
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      logger.info(`🧠 Intent parsed by Groq: ${result.intent} (conf: ${result.confidence})`);

      // If no URL, try Tavily
      if (!result.url && result.search_query && this.tavilyKey) {
        logger.info(`🔍 No URL found in prompt. Searching Tavily for: ${result.search_query}`);
        result.url = await this._searchTavily(result.search_query);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to parse intent with Groq: ${error.message}`);
      return this._simpleParse(prompt);
    }
  }

  async _searchTavily(query) {
    try {
      const response = await axios.post('https://api.tavily.com/search', {
        api_key: this.tavilyKey,
        query: query,
        search_depth: 'basic',
        max_results: 1
      });

      if (response.data.results && response.data.results.length > 0) {
        const topResult = response.data.results[0].url;
        logger.info(`✅ Tavily found URL: ${topResult}`);
        return topResult;
      }
    } catch (error) {
      logger.error(`Tavily search failed: ${error.message}`);
    }
    return null;
  }

  _simpleParse(prompt) {
    // Basic fallback logic
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/);
    return {
      intent: 'general',
      url: urlMatch ? urlMatch[0] : null,
      task: prompt,
      search_query: prompt,
      confidence: 0.5
    };
  }
}

module.exports = new IntentRouter();
