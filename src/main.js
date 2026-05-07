'use strict';

require('dotenv').config();

const logger = require('./logger');
const browserManager = require('./browser-manager');
const TaskOrchestrator = require('./task-orchestrator');
const TaskValidator = require('./task-validator');
const WebsiteAnalyzer = require('./website-analyzer');

/**
 * Main automation entry point
 * @param {Object} options 
 * @param {string} options.url
 * @param {string} options.task
 * @param {number} [options.steps]
 * @param {Function} [options.onEvent]
 */
async function runAutomation({ url, task, steps, onEvent }) {
  logger.info('');
  logger.info('╔══════════════════════════════════════════════╗');
  logger.info('║   Industrial Web Automation Pro  v6.2 ✅     ║');
  logger.info('║         (All Errors Fixed)                  ║');
  logger.info('╚══════════════════════════════════════════════╝');
  logger.info('');

  // ── Validate inputs ──────────────────────────────────────────
  if (!url || !task) {
    throw new Error('Missing required arguments: url and task.');
  }

  const validator = new TaskValidator();
  const validation = validator.validate(task);
  if (!validation.valid) {
    const errorMsg = `Task validation failed: ${validation.issues.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const analyzer = new WebsiteAnalyzer();
  const site = analyzer.analyze(url);
  logger.info(`🌐 Website: ${site.name} (${site.type})`);

  // Override MAX_STEPS if provided
  if (steps) process.env.MAX_STEPS = String(steps);

  // ── Browser init ─────────────────────────────────────────────
  let browserResult;
  try {
    browserResult = await browserManager.initialize();
  } catch (err) {
    logger.error(`Browser initialization failed: ${err.message}`);
    throw err;
  }
  
  const { page } = browserResult;

  const status = browserManager.getStatus();
  logger.info(`🔧 Browser mode: ${status.mode}`);
  if (status.sessionId) logger.info(`   Session ID: ${status.sessionId}`);

  // ── Run task ─────────────────────────────────────────────────
  const orchestrator = new TaskOrchestrator(page, onEvent);
  
  try {
    const report = await orchestrator.run(task, url);

    if (report.taskComplete) {
      logger.info('🎉 Task completed successfully!');
    } else {
      logger.warn('⚠️  Task reached max steps without explicit completion.');
    }

    if (Object.keys(report.extractedData).length > 0) {
      logger.info('📦 Extracted data:');
      logger.info(JSON.stringify(report.extractedData, null, 2));
    }
    
    return report;
  } catch (err) {
    logger.error(`Automation error: ${err.message}`);
    logger.debug(err.stack);
    throw err;
  } finally {
    await browserManager.cleanup().catch(() => {});
    logger.info('🧹 Cleanup complete');
  }
}

// ── CLI Support ───────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { url: null, task: null, mode: 'auto', steps: null };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url': result.url = args[++i]; break;
      case '--task': result.task = args[++i]; break;
      case '--mode': result.mode = args[++i]; break;
      case '--steps': result.steps = parseInt(args[++i]); break;
    }
  }

  // Fallback to .env
  if (!result.url) result.url = process.env.TARGET_URL;
  if (!result.task) result.task = process.env.TASK_DESCRIPTION;

  return result;
}

if (require.main === module) {
  const args = parseArgs();
  runAutomation(args)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
    
  // Global error guards
  process.on('unhandledRejection', async (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
    await browserManager.cleanup().catch(() => { });
    process.exit(2);
  });

  process.on('SIGINT', async () => {
    logger.info('\n⚡ Interrupted – cleaning up…');
    await browserManager.cleanup().catch(() => { });
    process.exit(0);
  });
}

module.exports = { runAutomation };