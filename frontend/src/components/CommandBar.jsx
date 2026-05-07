import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, XCircle } from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import './CommandBar.css';

const CommandBar = ({ onCommand, orbState, setOrbState }) => {
  const [input, setInput] = useState('');
  const { isListening, transcript, toggleListening, isSupported } = useVoiceRecognition();

  // Sync transcript to input while listening
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  // Update orb state based on listening
  useEffect(() => {
    if (isListening) {
      setOrbState('listening');
    } else if (orbState === 'listening') {
      setOrbState('idle');
    }
  }, [isListening, setOrbState, orbState]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    if (orbState === 'automating') {
      setOrbState('idle');
      return;
    }
    
    onCommand(input);
    setInput('');
  };

  return (
    <div className="command-bar-wrapper">
      {!isSupported && <div className="voice-warning">Voice not supported in this browser</div>}
      
      <form className={`command-bar glass-panel ${isListening ? 'listening-active' : ''}`} onSubmit={handleSubmit}>
        <button 
          type="button" 
          className={`mic-btn ${isListening ? 'recording' : ''}`}
          onClick={toggleListening}
          disabled={!isSupported}
          title={isSupported ? 'Toggle Voice Input' : 'Voice not supported'}
        >
          {isListening ? <Mic className="icon pulse-red" /> : <MicOff className="icon" />}
        </button>
        
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening..." : "Tell automation what to do..."}
          disabled={orbState === 'automating'}
        />
        
        <button type="submit" className="submit-btn" disabled={!input.trim()}>
          {orbState === 'automating' ? <XCircle className="icon cancel" /> : <Send className="icon" />}
        </button>
      </form>
    </div>
  );
};

export default CommandBar;
