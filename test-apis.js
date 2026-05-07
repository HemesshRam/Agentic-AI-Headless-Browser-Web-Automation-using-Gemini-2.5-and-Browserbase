require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const Groq = require('groq-sdk');


async function testAPIs() {
  console.log('Testing APIs...');

  // 1. Test Gemini
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Say "hello"',
    });
    console.log('✅ Gemini API is working');
  } catch (err) {
    console.error('❌ Gemini API Error:', err.message);
  }

  // 2. Test Groq
  try {
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Say "hello"' }],
      model: 'llama-3.3-70b-versatile',
    });
    console.log('✅ Groq API is working');
  } catch (err) {
    console.error('❌ Groq API Error:', err.message);
  }

  const axios = require('axios');

  // 3. Test Tavily
  try {
    if (!process.env.TAVILY_API_KEY) throw new Error('TAVILY_API_KEY is not set');
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: 'hello',
      search_depth: 'basic',
      max_results: 1
    });
    if (response.data && response.data.results) {
      console.log('✅ Tavily API is working');
    } else {
      throw new Error('Invalid response from Tavily');
    }
  } catch (err) {
    console.error('❌ Tavily API Error:', err.message);
  }

  // 4. Test Browserbase
  try {
    if (!process.env.BROWSERBASE_API_KEY) throw new Error('BROWSERBASE_API_KEY is not set');
    if (!process.env.BROWSERBASE_PROJECT_ID) throw new Error('BROWSERBASE_PROJECT_ID is not set');
    
    const response = await axios.get('https://www.browserbase.com/v1/sessions', {
      headers: {
        'X-BB-API-Key': process.env.BROWSERBASE_API_KEY,
        'Content-Type': 'application/json',
      },
      params: {
        projectId: process.env.BROWSERBASE_PROJECT_ID,
      }
    });
    
    if (response.data) {
      console.log('✅ Browserbase API is working');
    } else {
      throw new Error('Invalid response from Browserbase');
    }
  } catch (err) {
    console.error('❌ Browserbase API Error:', err.message);
  }
}

testAPIs();
