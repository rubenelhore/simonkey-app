import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad, faRoute } from '@fortawesome/free-solid-svg-icons';
import './StudyModeToggle.css';

interface StudyModeToggleProps {
  mode: 'games' | 'path';
  onModeChange: (mode: 'games' | 'path') => void;
}

const StudyModeToggle: React.FC<StudyModeToggleProps> = ({ mode, onModeChange }) => {
  return (
    <div className="study-mode-toggle-container">
      <div className="study-mode-toggle">
        <button 
          className={`toggle-option ${mode === 'games' ? 'active' : ''}`}
          onClick={() => onModeChange('games')}
        >
          <span className="toggle-icon">
            <FontAwesomeIcon icon={faGamepad} />
          </span>
          <span className="toggle-label">Juegos</span>
        </button>
        <div className="toggle-slider" data-position={mode}></div>
        <button 
          className={`toggle-option ${mode === 'path' ? 'active' : ''}`}
          onClick={() => onModeChange('path')}
        >
          <span className="toggle-icon">
            <FontAwesomeIcon icon={faRoute} />
          </span>
          <span className="toggle-label">Ruta</span>
        </button>
      </div>
    </div>
  );
};

export default StudyModeToggle;