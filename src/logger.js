'use strict';

require('dotenv').config();
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const WsBroadcaster = require('./ws-broadcaster');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, json } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${message}${metaStr}`;
  })
);

const fileFormat = combine(timestamp(), json());

// Initialize WebSocket broadcaster
const wsBroadcaster = new WsBroadcaster();

const transports = [
  new winston.transports.Console({ format: consoleFormat }),
  wsBroadcaster
];

if (process.env.LOG_TO_FILE === 'true') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'automation.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports,
});

// Helper to inject clients into the broadcaster
logger.setWsClients = (clients) => {
  wsBroadcaster.setWsClients(clients);
};

module.exports = logger;