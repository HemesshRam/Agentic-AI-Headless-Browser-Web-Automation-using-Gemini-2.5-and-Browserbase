import React, { useRef, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import './LiveTerminal.css';

const LiveTerminal = ({ logs = [] }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (level) => {
    switch (level) {
      case 'info': return 'text-cyan';
      case 'warn': return 'text-amber';
      case 'error': return 'text-red';
      case 'debug': return 'text-gray';
      default: return 'text-white';
    }
  };

  return (
    <div className="live-terminal glass-panel">
      <div className="terminal-header">
        <Terminal size={16} className="text-cyan" />
        <span>LIVE TERMINAL</span>
      </div>
      <div className="terminal-content" ref={scrollRef}>
        <div className="scan-line" />
        {logs.map((log, idx) => (
          <div key={idx} className="log-line">
            <span className="log-time">
              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`log-level ${getLogColor(log.level)}`}>[{log.level}]</span>
            <span className="log-msg">{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="log-line text-gray">Waiting for telemetry...</div>
        )}
      </div>
    </div>
  );
};

export default LiveTerminal;
