'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const logger = require('./src/logger');
const intentRouter = require('./src/intent-router');
const { runAutomation } = require('./src/main');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── WebSocket Logic ──────────────────────────────────────────
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  logger.info(`🔌 New WebSocket connection (${clients.size} total)`);
  
  ws.on('close', () => {
    clients.delete(ws);
    logger.info(`🔌 WebSocket closed (${clients.size} left)`);
  });
});

// Inject clients into logger for broadcasting
logger.setWsClients(clients);

// ── API Endpoints ────────────────────────────────────────────

/**
 * Main automation endpoint
 * POST /api/automate { "prompt": "..." }
 */
app.post('/api/automate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  logger.info(`🚀 New automation request: "${prompt}"`);

  try {
    // 1. Parse Intent (Groq + Tavily)
    const intentData = await intentRouter.parse(prompt);
    
    // Broadcast intent to frontend
    broadcast({ type: 'intent_parsed', ...intentData });

    if (!intentData.url) {
      return res.status(404).json({ 
        error: 'Could not determine a target URL for this request.',
        intent: intentData 
      });
    }

    // 2. Start Automation (Async)
    // We send success immediately and stream progress via WebSocket
    res.json({ message: 'Automation started', intent: intentData });

    runAutomation({
      url: intentData.url,
      task: intentData.task || prompt,
      onEvent: (event) => broadcast(event)
    }).catch(err => {
      logger.error(`Automation thread crashed: ${err.message}`);
      broadcast({ type: 'task_error', error: err.message });
    });

  } catch (error) {
    logger.error(`Request handling failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', connections: clients.size });
});

// ── Helpers ──────────────────────────────────────────────────
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ── Start Server ─────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`🚀 Automation Server running on http://localhost:${PORT}`);
});
