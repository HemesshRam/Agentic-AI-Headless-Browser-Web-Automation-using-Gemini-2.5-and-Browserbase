class VoiceEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.recognition = null;
    this._speaking = false;
    this._listening = false;
    this._muted = false;
    this._queue = [];
    this._processing = false;
    this._rate = 1.0;
    this._pitch = 0.9;
    this._voice = null;
    this._onSubtitle = null; // callback for subtitle text
    this._onListeningChange = null;

    // Pick a good voice once voices load
    this._pickVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this._pickVoice();
    }

    // Setup Speech Recognition if available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  // ── Greeting ────────────────────────────────────────

  getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning, Sir!';
    if (hour >= 12 && hour < 17) return 'Good Afternoon, Sir!';
    if (hour >= 17 && hour < 21) return 'Good Evening, Sir!';
    return 'Hello, Sir! Working late, I see.';
  }

  // ── Text-to-Speech ──────────────────────────────────

  speak(text, priority = false) {
    if (this._muted || !text) return Promise.resolve();

    if (priority) {
      // Priority messages (like greetings) go to front of queue
      this._queue.unshift(text);
    } else {
      this._queue.push(text);
    }
    return this._processQueue();
  }

  _processQueue() {
    if (this._processing || this._queue.length === 0) return Promise.resolve();
    this._processing = true;

    return new Promise((resolve) => {
      const text = this._queue.shift();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this._rate;
      utterance.pitch = this._pitch;
      if (this._voice) utterance.voice = this._voice;

      this._speaking = true;
      if (this._onSubtitle) this._onSubtitle(text);

      utterance.onend = () => {
        this._speaking = false;
        this._processing = false;
        if (this._onSubtitle) this._onSubtitle('');
        // Process next in queue
        this._processQueue();
        resolve();
      };

      utterance.onerror = () => {
        this._speaking = false;
        this._processing = false;
        if (this._onSubtitle) this._onSubtitle('');
        this._processQueue();
        resolve();
      };

      this.synth.speak(utterance);
    });
  }

  stopSpeaking() {
    this._queue = [];
    this._processing = false;
    this._speaking = false;
    this.synth.cancel();
    if (this._onSubtitle) this._onSubtitle('');
  }

  isSpeaking() {
    return this._speaking;
  }

  // ── Speech-to-Text ──────────────────────────────────

  startListening(onResult, onInterim) {
    if (!this.recognition) {
      console.warn('Speech Recognition not supported in this browser');
      return false;
    }

    // Stop speaking while listening
    this.stopSpeaking();

    this._listening = true;
    if (this._onListeningChange) this._onListeningChange(true);

    let finalTranscript = '';

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      if (onInterim) onInterim(interim || finalTranscript);
    };

    this.recognition.onend = () => {
      this._listening = false;
      if (this._onListeningChange) this._onListeningChange(false);
      if (finalTranscript.trim()) {
        onResult(finalTranscript.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      this._listening = false;
      if (this._onListeningChange) this._onListeningChange(false);
    };

    this.recognition.start();
    return true;
  }

  stopListening() {
    if (this.recognition && this._listening) {
      this.recognition.stop();
      this._listening = false;
      if (this._onListeningChange) this._onListeningChange(false);
    }
  }

  isListening() {
    return this._listening;
  }

  hasRecognition() {
    return !!this.recognition;
  }

  // ── Settings ────────────────────────────────────────

  setMuted(muted) {
    this._muted = muted;
    if (muted) this.stopSpeaking();
  }

  isMuted() {
    return this._muted;
  }

  setRate(rate) {
    this._rate = Math.max(0.5, Math.min(2.0, rate));
  }

  setPitch(pitch) {
    this._pitch = Math.max(0.5, Math.min(1.5, pitch));
  }

  onSubtitle(callback) {
    this._onSubtitle = callback;
  }

  onListeningChange(callback) {
    this._onListeningChange = callback;
  }

  // ── Step Narration Helpers ──────────────────────────

  narrateStep(step, maxSteps, action, value, reasoning) {
    const actionMap = {
      navigate: `Navigating to the target website`,
      type: `Typing ${value ? `"${value}"` : ''} in the search field`,
      click: `Clicking on the target element`,
      scroll: `Scrolling to gather more information`,
      key: `Pressing ${value || 'a key'}`,
      extract: `Extracting data from the page`,
      wait: `Waiting for the page to load`,
      done: `Task is complete, Sir`,
      error: `I've encountered an issue`,
      select: `Selecting an option`,
      hover: `Hovering over an element`,
      double_click: `Double-clicking the element`,
      right_click: `Right-clicking the element`,
    };

    const description = actionMap[action] || reasoning || `Performing ${action}`;
    this.speak(`Step ${step} of ${maxSteps}. ${description}.`);
  }

  narrateCompletion(report) {
    if (!report) return;

    const steps = report.stepsExecuted || 0;
    const durationSec = ((report.totalDurationMs || 0) / 1000).toFixed(0);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const timeStr = minutes > 0 ? `${minutes} minutes and ${seconds} seconds` : `${seconds} seconds`;

    let summary = `Task completed successfully, Sir. `;
    summary += `The automation finished in ${steps} steps, taking ${timeStr}. `;

    const data = report.extractedData || {};
    const keys = Object.keys(data);
    if (keys.length > 0) {
      summary += `Here's what I found: `;
      for (const key of keys.slice(0, 5)) { // Narrate up to 5 fields
        const label = key.replace(/_/g, ' ');
        summary += `${label}: ${data[key]}. `;
      }
    }

    summary += `Zero errors were encountered.`;
    this.speak(summary);
  }

  narrateError(error, step) {
    const msg = `I'm sorry, Sir. The task could not be completed. ` +
      `The automation failed at step ${step || 'unknown'} with the following issue: ${error}. ` +
      `I recommend retrying with a more specific prompt.`;
    this.speak(msg);
  }

  // ── Private ─────────────────────────────────────────

  _pickVoice() {
    const voices = this.synth.getVoices();
    // Prefer these voices for a J.A.R.V.I.S.-like tone
    const preferred = [
      'Google UK English Male',
      'Microsoft David',
      'Microsoft Mark',
      'Daniel',
      'Google US English',
      'Alex',
    ];

    for (const name of preferred) {
      const match = voices.find(v => v.name.includes(name));
      if (match) {
        this._voice = match;
        return;
      }
    }
    // Fallback: pick any English male voice
    const english = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male'));
    if (english) this._voice = english;
  }
}

// Export singleton
const voiceEngine = new VoiceEngine();
export default voiceEngine;
