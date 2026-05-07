import React from 'react';
import './WelcomeSplash.css';

const WelcomeSplash = ({ onActivate }) => {
  return (
    <div className="splash-overlay">
      <div className="splash-content">
        <div className="splash-orb">
          <div className="splash-orb-core" />
          <div className="splash-ring splash-ring-1" />
          <div className="splash-ring splash-ring-2" />
          <div className="splash-ring splash-ring-3" />
        </div>
        
        <h1 className="splash-title">Headless Automation</h1>
        <p className="splash-subtitle">Industrial Web Automation System</p>
        
        <button className="splash-activate-btn" onClick={onActivate}>
          <span className="activate-text">Initialize System</span>
          <span className="activate-glow" />
        </button>
        
        <p className="splash-hint">Click to activate voice assistant</p>
      </div>
    </div>
  );
};

export default WelcomeSplash;
