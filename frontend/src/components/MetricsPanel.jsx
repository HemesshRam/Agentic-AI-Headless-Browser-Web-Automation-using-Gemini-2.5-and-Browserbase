import React from 'react';
import { Activity, Clock, ShieldCheck, Cloud } from 'lucide-react';
import './MetricsPanel.css';

const MetricsPanel = ({ metrics }) => {
  return (
    <div className="metrics-panel glass-panel">
      <div className="metric">
        <Activity size={16} className={metrics.status === 'CONNECTED' ? 'text-cyan' : 'text-red'} />
        <span>Status: <strong className={metrics.status === 'CONNECTED' ? 'text-cyan' : 'text-red'}>{metrics.status}</strong></span>
      </div>
      
      <div className="divider" />
      
      <div className="metric">
        <span>Step <strong>{metrics.step}</strong></span>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${metrics.progress}%` }} />
        </div>
      </div>
      
      <div className="divider" />
      
      <div className="metric">
        <Clock size={16} />
        <span className="font-mono">{metrics.time}</span>
      </div>
      
      <div className="divider" />
      
      <div className="metric">
        <ShieldCheck size={16} className="text-green" />
        <span>Avg <strong>{metrics.confidence}</strong></span>
      </div>
      
      <div className="divider" />
      
      <div className="metric">
        <Cloud size={16} className="text-blue" />
        <span>{metrics.mode}</span>
      </div>
    </div>
  );
};

export default MetricsPanel;
