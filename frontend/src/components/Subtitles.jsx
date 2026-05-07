import React from 'react';
import './Subtitles.css';

const Subtitles = ({ text, isListening, interimText }) => {
  const displayText = isListening ? (interimText || 'Listening...') : text;
  
  if (!displayText) return null;

  return (
    <div className={`subtitles-container ${isListening ? 'listening' : 'speaking'}`}>
      <div className="subtitle-text">
        {isListening && <span className="mic-indicator">🎤 </span>}
        {displayText}
      </div>
    </div>
  );
};

export default Subtitles;
