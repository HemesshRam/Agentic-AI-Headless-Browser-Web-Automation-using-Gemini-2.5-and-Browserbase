import React from 'react';
import './AiOrb.css';

const AiOrb = ({ state = 'idle', audioLevel = 1 }) => {
  return (
    <div className={`orb-container ${state}`}>
      <div 
        className="orb-core" 
        style={{ transform: `scale(${state === 'listening' ? 1 + audioLevel * 0.2 : 1})` }}
      />
      <div className="orb-ring ring-1" />
      <div className="orb-ring ring-2" />
      <div className="orb-ring ring-3" />
      
      {state === 'automating' && (
        <svg className="progress-ring" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" className="progress-ring-circle" />
        </svg>
      )}
    </div>
  );
};

export default AiOrb;
