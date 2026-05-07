'use strict';

const logger = require('./logger');
const VisionAnalyzer = require('./vision-analyzer');
const ComputerUseAgent = require('./computer-use-agent');

class AgentReasoning {
  constructor() {
    this.vision = new VisionAnalyzer();
    this.computerUse = new ComputerUseAgent();
    this.preferComputerUse = process.env.PREFER_COMPUTER_USE === 'true';
    this.preferForComplex = process.env.PREFER_COMPUTERUSE_FOR_COMPLEX_TASKS === 'true';
    this.complexThreshold = parseInt(process.env.COMPLEX_TASK_THRESHOLD || '5');
  }

  /**
   * Choose agent and return action
   */
  async reason(base64Image, taskPrompt, context = {}) {
    const useComputerUse = this._shouldUseComputerUse(context);

    logger.info(`🧠 Using ${useComputerUse ? 'Computer-Use' : 'Vision'} agent (step ${context.stepNumber || 1})`);

    if (useComputerUse) {
      return this.computerUse.execute(base64Image, taskPrompt, context);
    }
    return this.vision.analyze(base64Image, taskPrompt, context);
  }

  reset() {
    this.computerUse.reset();
  }

  // ─────────────────────────────────────────────

  _shouldUseComputerUse(context) {
    if (this.preferComputerUse) return true;
    if (this.preferForComplex && (context.complexity || 0) >= this.complexThreshold) return true;
    return false;
  }
}

module.exports = AgentReasoning;