// backend/src/services/geminiService.js
// Modern Google GenAI client and model interaction service

import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { getAvailableToolsDeclarations } from '../tools/toolRegistry.js';

let genAIClient = null;

export function getGeminiClient() {
  if (!genAIClient) {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured in environment.');
    }
    genAIClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return genAIClient;
}

export const geminiService = {
  getAvailableModel() {
    return env.GEMINI_MODEL || 'gemini-3.5-flash';
  },

  async generateAgentTurn({ contents, systemInstruction, enableTools = true }) {
    const client = getGeminiClient();
    const model = this.getAvailableModel();

    const config = {
      systemInstruction,
    };

    if (enableTools) {
      const toolDeclarations = getAvailableToolsDeclarations();
      config.tools = [{ functionDeclarations: toolDeclarations }];
    }

    // Comprehensive fallback models in order
    const fallbackModels = [
      model,
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      'gemini-3-flash-preview',
    ];

    const tried = new Set();
    let lastError = null;

    for (const m of fallbackModels) {
      if (tried.has(m)) continue;
      tried.add(m);

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await client.models.generateContent({
            model: m,
            contents,
            config,
          });
          return response;
        } catch (err) {
          lastError = err;
          const isRateLimit = err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
          const isUnavailable = err.status === 503 || err.message?.includes('503') || err.message?.includes('UNAVAILABLE');

          if ((isRateLimit || isUnavailable) && attempt === 0) {
            let waitMs = 4000;
            // Parse retryDelay like "8s" or "23s" from error message or details
            const match = err.message?.match(/retry in ([0-9.]+)s/i) || err.message?.match(/"retryDelay":"([0-9]+)s"/i);
            if (match && match[1]) {
              waitMs = Math.ceil(parseFloat(match[1]) + 1) * 1000;
            }
            console.warn(`[Gemini API] ${m} hit rate limit / capacity. Backing off for ${waitMs}ms before retry...`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }

          console.warn(`[Gemini API] Model ${m} failed: ${err.message}. Trying next fallback model...`);
          break;
        }
      }
    }

    throw lastError || new Error('All Gemini model fallbacks failed.');
  },
};
