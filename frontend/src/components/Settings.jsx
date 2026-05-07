import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, Bot, Globe, Clock, Shield, Camera,
  Zap, Volume2, Save, RotateCcw, ChevronRight, AlertTriangle,
  CheckCircle2, Cpu, Database, Sliders
} from 'lucide-react';
import './Settings.css';

const DEFAULT_SETTINGS = {
  // AI & Agent
  visionModel: 'gemini-2.5-flash',
  computerUseModel: 'gemini-2.5-computer-use-preview-10-2025',
  maxSteps: 10,
  maxConsecutiveErrors: 3,
  maxRepeatedActions: 3,
  complexTaskThreshold: 5,
  preferComputerUse: false,
  preferComputerUseComplex: true,

  // Browser
  useBrowserbase: true,
  headlessMode: true,
  antiBotEnabled: true,
  stealthMode: true,
  fingerprintRandomization: true,

  // Timeouts
  navigationTimeout: 60000,
  elementTimeout: 10000,
  actionTimeout: 5000,
  verificationTimeout: 8000,

  // Features
  saveScreenshots: true,
  saveHtml: true,
  cloudflareSolving: true,

  // Voice
  voiceEnabled: true,
  voiceRate: 1.0,
  voicePitch: 1.0,

  // Logging
  logLevel: 'info',
  logToFile: true,
};

const SECTIONS = [
  { id: 'ai', label: 'AI & Agent', icon: Bot },
  { id: 'browser', label: 'Browser', icon: Globe },
  { id: 'timeouts', label: 'Timeouts', icon: Clock },
  { id: 'features', label: 'Features', icon: Zap },
  { id: 'voice', label: 'Voice', icon: Volume2 },
  { id: 'logging', label: 'Logging', icon: Database },
  { id: 'about', label: 'About', icon: Cpu },
];

const Settings = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('ai');
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('friday-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('friday-settings', JSON.stringify(settings));
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('friday-settings');
    setDirty(true);
    setSaved(false);
  };

  // ── Render a toggle row ───────────────────────────
  const Toggle = ({ label, desc, settingKey }) => (
    <div className="setting-row">
      <div className="setting-info">
        <span className="setting-label">{label}</span>
        {desc && <span className="setting-desc">{desc}</span>}
      </div>
      <button
        className={`toggle-switch ${settings[settingKey] ? 'on' : 'off'}`}
        onClick={() => update(settingKey, !settings[settingKey])}
        role="switch"
        aria-checked={settings[settingKey]}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );

  // ── Render a number input ─────────────────────────
  const NumberInput = ({ label, desc, settingKey, min = 1, max = 999999, step = 1, unit = '' }) => (
    <div className="setting-row">
      <div className="setting-info">
        <span className="setting-label">{label}</span>
        {desc && <span className="setting-desc">{desc}</span>}
      </div>
      <div className="number-input-group">
        <input
          type="number"
          value={settings[settingKey]}
          onChange={(e) => update(settingKey, Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="setting-number-input"
        />
        {unit && <span className="number-unit">{unit}</span>}
      </div>
    </div>
  );

  // ── Render a select ───────────────────────────────
  const Select = ({ label, desc, settingKey, options }) => (
    <div className="setting-row">
      <div className="setting-info">
        <span className="setting-label">{label}</span>
        {desc && <span className="setting-desc">{desc}</span>}
      </div>
      <select
        value={settings[settingKey]}
        onChange={(e) => update(settingKey, e.target.value)}
        className="setting-select"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  // ── Render a slider ───────────────────────────────
  const Slider = ({ label, desc, settingKey, min, max, step = 0.1 }) => (
    <div className="setting-row">
      <div className="setting-info">
        <span className="setting-label">{label}</span>
        {desc && <span className="setting-desc">{desc}</span>}
      </div>
      <div className="slider-group">
        <input
          type="range"
          value={settings[settingKey]}
          onChange={(e) => update(settingKey, Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="setting-slider"
        />
        <span className="slider-value">{settings[settingKey].toFixed(1)}</span>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'ai':
        return (
          <div className="settings-section" key="ai">
            <div className="section-header">
              <Bot size={20} className="text-cyan" />
              <div>
                <h3>AI & Agent Configuration</h3>
                <p>Configure Gemini models, task limits, and agent behavior</p>
              </div>
            </div>

            <Select
              label="Vision Model"
              desc="Primary model for screenshot analysis"
              settingKey="visionModel"
              options={[
                { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
                { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
              ]}
            />

            <Select
              label="Computer Use Model"
              desc="Model for native computer-use actions"
              settingKey="computerUseModel"
              options={[
                { value: 'gemini-2.5-computer-use-preview-10-2025', label: 'Gemini 2.5 CU Preview' },
                { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (fallback)' },
              ]}
            />

            <NumberInput
              label="Max Steps"
              desc="Maximum automation steps per task"
              settingKey="maxSteps"
              min={1}
              max={50}
            />

            <NumberInput
              label="Max Consecutive Errors"
              desc="Abort after this many consecutive failures"
              settingKey="maxConsecutiveErrors"
              min={1}
              max={10}
            />

            <NumberInput
              label="Max Repeated Actions"
              desc="Stuck-loop detection — abort after N identical actions on the same page"
              settingKey="maxRepeatedActions"
              min={2}
              max={10}
            />

            <NumberInput
              label="Complex Task Threshold"
              desc="Complexity score to trigger computer-use agent"
              settingKey="complexTaskThreshold"
              min={1}
              max={10}
            />

            <Toggle
              label="Prefer Computer Use"
              desc="Always use computer-use agent instead of vision"
              settingKey="preferComputerUse"
            />

            <Toggle
              label="Computer Use for Complex Tasks"
              desc="Auto-switch to computer-use for high-complexity tasks"
              settingKey="preferComputerUseComplex"
            />
          </div>
        );

      case 'browser':
        return (
          <div className="settings-section" key="browser">
            <div className="section-header">
              <Globe size={20} className="text-cyan" />
              <div>
                <h3>Browser Configuration</h3>
                <p>Browserbase, stealth, and anti-detection settings</p>
              </div>
            </div>

            <Toggle
              label="Use Browserbase"
              desc="Use cloud browser infrastructure for anti-detection"
              settingKey="useBrowserbase"
            />

            <Toggle
              label="Headless Mode"
              desc="Run browser without visible UI"
              settingKey="headlessMode"
            />

            <Toggle
              label="Anti-Bot Protection"
              desc="Enable anti-bot detection countermeasures"
              settingKey="antiBotEnabled"
            />

            <Toggle
              label="Stealth Mode"
              desc="Mask automation fingerprints"
              settingKey="stealthMode"
            />

            <Toggle
              label="Fingerprint Randomization"
              desc="Randomize browser fingerprints per session"
              settingKey="fingerprintRandomization"
            />

            <div className="setting-info-card">
              <Shield size={16} className="text-amber" />
              <span>Anti-detection features require Browserbase to be enabled for full effectiveness.</span>
            </div>
          </div>
        );

      case 'timeouts':
        return (
          <div className="settings-section" key="timeouts">
            <div className="section-header">
              <Clock size={20} className="text-cyan" />
              <div>
                <h3>Timeout Configuration</h3>
                <p>Control how long the agent waits for page elements and actions</p>
              </div>
            </div>

            <NumberInput
              label="Navigation Timeout"
              desc="Max wait time for page navigation"
              settingKey="navigationTimeout"
              min={5000}
              max={120000}
              step={1000}
              unit="ms"
            />

            <NumberInput
              label="Element Timeout"
              desc="Max wait time for element to appear"
              settingKey="elementTimeout"
              min={1000}
              max={60000}
              step={1000}
              unit="ms"
            />

            <NumberInput
              label="Action Timeout"
              desc="Max wait time for action completion"
              settingKey="actionTimeout"
              min={1000}
              max={30000}
              step={1000}
              unit="ms"
            />

            <NumberInput
              label="Verification Timeout"
              desc="Max wait time for post-action verification"
              settingKey="verificationTimeout"
              min={1000}
              max={30000}
              step={1000}
              unit="ms"
            />
          </div>
        );

      case 'features':
        return (
          <div className="settings-section" key="features">
            <div className="section-header">
              <Zap size={20} className="text-cyan" />
              <div>
                <h3>Feature Flags</h3>
                <p>Enable or disable optional capabilities</p>
              </div>
            </div>

            <Toggle
              label="Save Screenshots"
              desc="Capture and store screenshots at each step"
              settingKey="saveScreenshots"
            />

            <Toggle
              label="Save HTML"
              desc="Save page HTML source for debugging"
              settingKey="saveHtml"
            />

            <Toggle
              label="Cloudflare Solving"
              desc="Attempt to bypass Cloudflare challenges"
              settingKey="cloudflareSolving"
            />
          </div>
        );

      case 'voice':
        return (
          <div className="settings-section" key="voice">
            <div className="section-header">
              <Volume2 size={20} className="text-cyan" />
              <div>
                <h3>Voice & Narration</h3>
                <p>Configure AUTOMATE assistant voice output settings</p>
              </div>
            </div>

            <Toggle
              label="Voice Narration"
              desc="Enable spoken narration of automation steps"
              settingKey="voiceEnabled"
            />

            <Slider
              label="Speech Rate"
              desc="Speed of voice narration"
              settingKey="voiceRate"
              min={0.5}
              max={2.0}
              step={0.1}
            />

            <Slider
              label="Speech Pitch"
              desc="Pitch of voice narration"
              settingKey="voicePitch"
              min={0.5}
              max={2.0}
              step={0.1}
            />
          </div>
        );

      case 'logging':
        return (
          <div className="settings-section" key="logging">
            <div className="section-header">
              <Database size={20} className="text-cyan" />
              <div>
                <h3>Logging & Diagnostics</h3>
                <p>Control log verbosity and storage</p>
              </div>
            </div>

            <Select
              label="Log Level"
              desc="Minimum severity level for log output"
              settingKey="logLevel"
              options={[
                { value: 'debug', label: 'Debug (verbose)' },
                { value: 'info', label: 'Info (default)' },
                { value: 'warn', label: 'Warning' },
                { value: 'error', label: 'Error only' },
              ]}
            />

            <Toggle
              label="Log to File"
              desc="Persist logs to disk for later review"
              settingKey="logToFile"
            />
          </div>
        );

      case 'about':
        return (
          <div className="settings-section" key="about">
            <div className="section-header">
              <Cpu size={20} className="text-cyan" />
              <div>
                <h3>About</h3>
                <p>System information and version</p>
              </div>
            </div>

            <div className="about-card">
              <div className="about-logo">
                <span className="about-name">AUTOMATE Assistant</span>
                <span className="about-version">Web Automation Pro v6.1</span>
              </div>
              <div className="about-grid">
                <div className="about-item">
                  <span className="about-key">Engine</span>
                  <span className="about-val">Gemini 2.5 + Computer Use</span>
                </div>
                <div className="about-item">
                  <span className="about-key">Browser</span>
                  <span className="about-val">Puppeteer + Browserbase</span>
                </div>
                <div className="about-item">
                  <span className="about-key">Intent Router</span>
                  <span className="about-val">Groq LLaMA + Tavily</span>
                </div>
                <div className="about-item">
                  <span className="about-key">Frontend</span>
                  <span className="about-val">React 19 + Vite 8</span>
                </div>
                <div className="about-item">
                  <span className="about-key">Voice</span>
                  <span className="about-val">Web Speech API</span>
                </div>
                <div className="about-item">
                  <span className="about-key">Real-time</span>
                  <span className="about-val">WebSocket Events</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-layout">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="sidebar-header">
            <SettingsIcon size={20} className="text-cyan" />
            <h2>Settings</h2>
          </div>
          <nav className="sidebar-nav">
            {SECTIONS.map(section => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  className={`sidebar-item ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon size={16} />
                  <span>{section.label}</span>
                  <ChevronRight size={14} className="sidebar-arrow" />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="settings-content">
          {renderSection()}

          {/* Save/Reset bar */}
          <div className="settings-actions">
            <button className="action-btn reset-btn" onClick={handleReset}>
              <RotateCcw size={14} />
              Reset Defaults
            </button>
            <div className="action-right">
              {saved && (
                <span className="save-indicator">
                  <CheckCircle2 size={14} />
                  Saved
                </span>
              )}
              {dirty && !saved && (
                <span className="unsaved-indicator">
                  <AlertTriangle size={14} />
                  Unsaved changes
                </span>
              )}
              <button className="action-btn save-btn" onClick={handleSave} disabled={!dirty}>
                <Save size={14} />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
