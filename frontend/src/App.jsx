import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

import AiOrb from './components/AiOrb';
import CommandBar from './components/CommandBar';
import LiveTerminal from './components/LiveTerminal';
import TaskTimeline from './components/TaskTimeline';
import MetricsPanel from './components/MetricsPanel';
import Dashboard from './components/Dashboard';
import Subtitles from './components/Subtitles';
import WelcomeSplash from './components/WelcomeSplash';
import ScreenshotViewer from './components/ScreenshotViewer';
import Settings from './components/Settings';
import voiceEngine from './services/VoiceEngine';

const API_BASE = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

function App() {
  const [orbState, setOrbState] = useState('idle');
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const currentTask = useRef('');
  const [metrics, setMetrics] = useState({
    status: 'DISCONNECTED',
    step: '0/0',
    progress: 0,
    time: '00:00.0',
    confidence: '0.00',
    mode: 'Local'
  });

  // AUTOMATE assistant voice state
  const [subtitleText, setSubtitleText] = useState('');
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [activated, setActivated] = useState(false);
  
  const ws = useRef(null);

  // ── Wire up VoiceEngine subtitle callback ──────────
  useEffect(() => {
    voiceEngine.onSubtitle((text) => {
      setSubtitleText(text);
      if (text) {
        setOrbState(prev => prev === 'automating' ? prev : 'speaking');
      } else {
        setOrbState(prev => prev === 'speaking' ? 'idle' : prev);
      }
    });
  }, []);

  // ── Splash screen activation (unlocks Chrome audio) ──
  const handleActivate = useCallback(() => {
    setActivated(true);
    // This runs inside a user click handler — Chrome allows audio now
    const greeting = voiceEngine.getGreeting();
    voiceEngine.speak(`${greeting} How can I help you today?`, true);
  }, []);

  // ── Mute toggle ────────────────────────────────────
  const toggleMute = useCallback(() => {
    const newMuted = !voiceMuted;
    setVoiceMuted(newMuted);
    voiceEngine.setMuted(newMuted);
  }, [voiceMuted]);

  // ── WebSocket ──────────────────────────────────────
  useEffect(() => {
    connectWS();
    return () => ws.current?.close();
  }, []);

  const connectWS = () => {
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      setMetrics(prev => ({ ...prev, status: 'CONNECTED' }));
      addLog('info', '📡 Connected to Automation Server');
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWsEvent(data);
    };

    ws.current.onclose = () => {
      setMetrics(prev => ({ ...prev, status: 'DISCONNECTED' }));
      addLog('warn', '📡 Disconnected from server. Retrying...');
      setTimeout(connectWS, 3000);
    };
  };

  const handleWsEvent = (data) => {
    switch (data.type) {
      case 'log_message':
        addLog(data.level, data.message, data.timestamp);
        break;
      
      case 'intent_parsed':
        setOrbState('thinking');
        addLog('info', `🧠 Intent: ${data.intent} | Target: ${data.url}`);
        voiceEngine.speak('Processing your request, Sir.');
        break;

      case 'automation_started':
        setOrbState('automating');
        currentTask.current = data.task || '';
        setMetrics(prev => ({ 
          ...prev, 
          mode: data.liveViewUrl ? 'Browserbase' : 'Local',
          liveViewUrl: data.liveViewUrl || null
        }));
        break;

      case 'step_update':
        setOrbState('automating');
        setTasks(prev => {
          const newTasks = [...prev];
          const existingIdx = newTasks.findIndex(t => t.step === data.step);
          const stepData = {
            id: data.step,
            step: data.step,
            text: data.reasoning || data.action,
            status: 'running',
            screenshot: data.screenshot_b64
          };
          
          if (existingIdx >= 0) {
            newTasks[existingIdx] = stepData;
          } else {
            // Mark previous as completed
            if (newTasks.length > 0) newTasks[newTasks.length - 1].status = 'completed';
            newTasks.push(stepData);
          }
          return newTasks;
        });
        setMetrics(prev => ({
          ...prev,
          step: `${data.step}/${data.maxSteps}`,
          progress: (data.step / data.maxSteps) * 100,
          confidence: (data.confidence ?? 0).toFixed(2)
        }));

        // AUTOMATE assistant narrates each step
        voiceEngine.narrateStep(
          data.step, data.maxSteps,
          data.action, data.value || '', data.reasoning || ''
        );
        break;

      case 'task_complete':
        setOrbState('success');
        setTasks(prev => prev.map(t => ({ ...t, status: 'completed' })));
        addLog('info', '🎉 Task completed successfully');

        // AUTOMATE assistant narrates the completion summary
        if (data.report) {
          voiceEngine.narrateCompletion(data.report);
        }

        if (data.report) {
          const r = data.report;
          const durationSec = (r.totalDurationMs / 1000).toFixed(1);
          const extractedKeys = Object.keys(r.extractedData || {});
          const hasData = extractedKeys.length > 0;

          // Build a clear, readable AI summary
          let summary = `✅ Automation completed successfully in ${r.stepsExecuted} steps (${durationSec}s).\n\n`;
          
          if (hasData) {
            summary += `📦 Extracted Data:\n`;
            for (const [key, val] of Object.entries(r.extractedData)) {
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              summary += `• ${label}: ${val}\n`;
            }
          } else {
            summary += `No structured data was extracted from the page.`;
          }

          // Build a formatted result report
          const resultReport = hasData
            ? JSON.stringify(r.extractedData, null, 2)
            : "No data extracted from the target page.";

          // Collect screenshots from the step tasks
          setTasks(currentTasks => {
            const screenshotList = currentTasks
              .filter(t => t.screenshot)
              .map((t, i) => ({ step: t.step || i + 1, data: t.screenshot }));

            setSessions(prev => [{
              id: `sess_${Date.now()}`,
              task: r.taskPrompt,
              status: 'Success',
              duration: `${durationSec}s`,
              date: new Date(r.timestamp).toLocaleString(),
              details: {
                resultReport,
                aiSummary: summary,
                browserbaseSession: r.finalUrl || "N/A",
                screenshots: screenshotList.length,
                screenshotImages: screenshotList
              }
            }, ...prev]);

            return currentTasks;
          });
        }
        break;

      case 'task_error':
        setOrbState('error');
        addLog('error', `❌ Task failed: ${data.error}`);
        
        // AUTOMATE assistant narrates the error
        voiceEngine.narrateError(data.error, data.step);

        setSessions(prev => [{
          id: `sess_${Date.now()}`,
          task: currentTask.current || 'Failed Automation Task',
          status: 'Failure',
          duration: '-',
          date: new Date().toLocaleString(),
          details: {
            resultReport: `Error: ${data.error}`,
            aiSummary: `Task failed at step ${data.step || 'unknown'}`,
            browserbaseSession: "N/A",
            screenshots: 0
          }
        }, ...prev]);
        break;
        
      default:
        console.log('Unknown event type:', data.type);
    }
  };

  const addLog = (level, message, timestamp = new Date().toISOString()) => {
    setLogs(prev => [...prev, { level, message, timestamp }]);
  };

  const handleCommand = async (command) => {
    try {
      const lowerCmd = command.toLowerCase();
      
      // ── Local UI Navigation Intents ──────────────────────
      const isNavIntent = true;
      if (lowerCmd.includes('screenshot') || lowerCmd.includes('photos')) {
        setView('automation');
        setCenterView('screenshots');
        voiceEngine.speak('Displaying the recent automation screenshots, Sir.');
        return;
      } else if (lowerCmd.includes('setting') || lowerCmd.includes('preferences') || lowerCmd.includes('config')) {
        setView('settings');
        voiceEngine.speak('Opening the system configuration panel, Sir.');
        return;
      } else if (lowerCmd.includes('dashboard') || lowerCmd.includes('analytics') || lowerCmd.includes('sessions')) {
        setView('dashboard');
        voiceEngine.speak('Switching to the analytics dashboard, Sir.');
        return;
      } else if (lowerCmd.includes('browser') || lowerCmd.includes('live view')) {
        setView('automation');
        setCenterView('browser');
        voiceEngine.speak('Showing the live browser view.');
        return;
      } else if (lowerCmd.includes('orb') || lowerCmd.includes('ai view')) {
        setView('automation');
        setCenterView('orb');
        voiceEngine.speak('Switching back to the primary AI interface.');
        return;
      }

      // ── Remote Automation Intent ─────────────────────────
      setOrbState('thinking');
      setTasks([]);
      voiceEngine.stopSpeaking(); // Stop any current speech
      
      const response = await fetch(`${API_BASE}/api/automate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: command })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start automation');
      }

    } catch (err) {
      setOrbState('error');
      addLog('error', `Request failed: ${err.message}`);
      voiceEngine.speak(`I'm sorry, Sir. The request failed: ${err.message}`);
    }
  };

  const [view, setView] = useState('automation');
  const [centerView, setCenterView] = useState('orb'); // 'orb' or 'browser'

  // ── Show splash if not activated ────────────────
  if (!activated) {
    return <WelcomeSplash onActivate={handleActivate} />;
  }

  return (
    <div className="app-container">
      <div className="top-nav" style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px', gap: '10px', backgroundColor: '#0f172a' }}>
        <button 
          onClick={toggleMute}
          style={{ padding: '8px 16px', backgroundColor: voiceMuted ? 'rgba(255,77,77,0.2)' : 'rgba(0,255,204,0.1)', color: voiceMuted ? '#ff4d4d' : '#00ffcc', border: `1px solid ${voiceMuted ? '#ff4d4d' : '#00ffcc'}`, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginRight: 'auto', fontSize: '0.85rem' }}
        >
          {voiceMuted ? '🔇 Voice Off' : '🔊 Voice On'}
        </button>
        <button 
          onClick={() => setView('automation')}
          style={{ padding: '8px 16px', backgroundColor: view === 'automation' ? '#00ffcc' : 'transparent', color: view === 'automation' ? '#000' : '#00ffcc', border: '1px solid #00ffcc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Automation
        </button>
        <button 
          onClick={() => setView('dashboard')}
          style={{ padding: '8px 16px', backgroundColor: view === 'dashboard' ? '#00ffcc' : 'transparent', color: view === 'dashboard' ? '#000' : '#00ffcc', border: '1px solid #00ffcc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Dashboard
        </button>
        <button 
          onClick={() => setView('settings')}
          style={{ padding: '8px 16px', backgroundColor: view === 'settings' ? '#00ffcc' : 'transparent', color: view === 'settings' ? '#000' : '#00ffcc', border: '1px solid #00ffcc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ⚙ Settings
        </button>
      </div>

      {view === 'automation' ? (
        <>
          <MetricsPanel metrics={metrics} />
          <div className="main-content">
            <div className="left-panel">
              <TaskTimeline tasks={tasks} />
            </div>
            
            <div className="center-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div className="center-nav" style={{ display: 'flex', gap: '10px', marginBottom: '20px', zIndex: 10 }}>
                <button 
                  onClick={() => setCenterView('orb')}
                  style={{ padding: '6px 12px', background: centerView === 'orb' ? 'rgba(0,255,204,0.2)' : 'transparent', border: '1px solid #00ffcc', color: '#00ffcc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  AI Orb
                </button>
                <button 
                  onClick={() => setCenterView('screenshots')}
                  style={{ padding: '6px 12px', background: centerView === 'screenshots' ? 'rgba(0,255,204,0.2)' : 'transparent', border: '1px solid #00ffcc', color: '#00ffcc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  📸 Screenshots
                </button>
                <button 
                  onClick={() => setCenterView('browser')}
                  style={{ padding: '6px 12px', background: centerView === 'browser' ? 'rgba(0,255,204,0.2)' : 'transparent', border: '1px solid #00ffcc', color: '#00ffcc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Live Browser
                </button>
              </div>

              {centerView === 'orb' ? (
                <>
                  <AiOrb state={orbState} />
                  <Subtitles text={subtitleText} />
                </>
              ) : centerView === 'screenshots' ? (
                <ScreenshotViewer tasks={tasks} isAutomating={orbState === 'automating'} />
              ) : (
                <div style={{ width: '100%', height: '100%', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000' }}>
                  {metrics.liveViewUrl ? (
                    <iframe 
                      src={metrics.liveViewUrl} 
                      title="Browserbase Live View" 
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      allow="clipboard-read; clipboard-write"
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                      No active Browserbase session or Live View URL is missing.
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="right-panel">
              <LiveTerminal logs={logs} />
            </div>
          </div>
          <CommandBar onCommand={handleCommand} orbState={orbState} setOrbState={setOrbState} />
        </>
      ) : view === 'dashboard' ? (
        <Dashboard sessions={sessions} />
      ) : (
        <Settings />
      )}
    </div>
  );
}

export default App;
