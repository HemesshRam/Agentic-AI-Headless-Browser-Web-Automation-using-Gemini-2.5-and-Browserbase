import React, { useState, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, ChevronLeft, ChevronRight, Monitor, Layers } from 'lucide-react';
import './ScreenshotViewer.css';

const ScreenshotViewer = ({ tasks = [], isAutomating = false }) => {
  const [selectedStep, setSelectedStep] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const filmstripRef = useRef(null);

  // Screenshots available from tasks
  const screenshots = tasks
    .filter(t => t.screenshot)
    .map((t, i) => ({
      step: t.step || i + 1,
      data: t.screenshot,
      text: t.text || `Step ${t.step || i + 1}`,
      status: t.status
    }));

  // Auto-follow latest screenshot during automation
  useEffect(() => {
    if (autoFollow && screenshots.length > 0) {
      setSelectedStep(screenshots.length - 1);
      // Auto scroll filmstrip to end
      if (filmstripRef.current) {
        filmstripRef.current.scrollLeft = filmstripRef.current.scrollWidth;
      }
    }
  }, [screenshots.length, autoFollow]);

  const current = selectedStep !== null ? screenshots[selectedStep] : screenshots[screenshots.length - 1];

  const goToPrev = () => {
    setAutoFollow(false);
    setSelectedStep(prev => Math.max(0, (prev ?? screenshots.length - 1) - 1));
  };

  const goToNext = () => {
    const next = Math.min(screenshots.length - 1, (selectedStep ?? screenshots.length - 1) + 1);
    setSelectedStep(next);
    if (next === screenshots.length - 1) setAutoFollow(true);
  };

  const handleThumbClick = (index) => {
    setAutoFollow(index === screenshots.length - 1);
    setSelectedStep(index);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedStep, screenshots.length, isFullscreen]);

  if (screenshots.length === 0) {
    return (
      <div className="screenshot-viewer-empty">
        <Monitor size={48} className="empty-icon" />
        <p className="empty-title">Live Screenshot View</p>
        <p className="empty-sub">
          {isAutomating
            ? 'Waiting for first screenshot...'
            : 'Run an automation to see real-time browser screenshots here.'}
        </p>
        <div className="empty-pulse-ring" />
      </div>
    );
  }

  const viewerContent = (
    <div className={`screenshot-viewer ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Header bar */}
      <div className="sv-header">
        <div className="sv-header-left">
          <Monitor size={16} className="text-cyan" />
          <span className="sv-title">
            Step {current?.step || '—'}
            <span className="sv-step-count"> / {screenshots.length}</span>
          </span>
          {isAutomating && autoFollow && (
            <span className="sv-live-badge">
              <span className="sv-live-dot" />
              LIVE
            </span>
          )}
        </div>
        <div className="sv-header-right">
          {!autoFollow && isAutomating && (
            <button className="sv-btn sv-follow-btn" onClick={() => setAutoFollow(true)}>
              Resume Live
            </button>
          )}
          <button className="sv-btn" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main viewport */}
      <div className="sv-viewport">
        <button className="sv-nav sv-nav-left" onClick={goToPrev} disabled={selectedStep === 0 || screenshots.length <= 1}>
          <ChevronLeft size={20} />
        </button>

        <div className="sv-image-container">
          {current && (
            <img
              src={`data:image/png;base64,${current.data}`}
              alt={`Step ${current.step} screenshot`}
              className="sv-main-image"
              draggable={false}
            />
          )}
          {/* Step reasoning overlay */}
          <div className="sv-reasoning-overlay">
            <span className="sv-reasoning-text">{current?.text || ''}</span>
          </div>
        </div>

        <button className="sv-nav sv-nav-right" onClick={goToNext} disabled={(selectedStep ?? screenshots.length - 1) >= screenshots.length - 1}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Filmstrip */}
      {screenshots.length > 1 && (
        <div className="sv-filmstrip-wrapper">
          <div className="sv-filmstrip" ref={filmstripRef}>
            {screenshots.map((ss, idx) => (
              <div
                key={idx}
                className={`sv-thumb ${idx === (selectedStep ?? screenshots.length - 1) ? 'active' : ''} ${ss.status === 'running' ? 'running' : ''}`}
                onClick={() => handleThumbClick(idx)}
              >
                <img
                  src={`data:image/png;base64,${ss.data}`}
                  alt={`Step ${ss.step}`}
                  draggable={false}
                />
                <span className="sv-thumb-label">{ss.step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Fullscreen overlay wrapper
  if (isFullscreen) {
    return (
      <div className="sv-fullscreen-overlay" onClick={() => setIsFullscreen(false)}>
        <div onClick={(e) => e.stopPropagation()}>
          {viewerContent}
        </div>
      </div>
    );
  }

  return viewerContent;
};

export default ScreenshotViewer;
