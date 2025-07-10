import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import MemoryGame from '../components/Games/MemoryGame';
import PuzzleGame from '../components/Games/PuzzleGame';
import RaceGame from '../components/Games/RaceGame';
import QuizBattle from '../components/Games/QuizBattle';
import '../styles/GamesPage.css';

const GamesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notebookId, notebookTitle } = location.state || {};
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  if (selectedGame === 'memory' && notebookId) {
    return <MemoryGame notebookId={notebookId} notebookTitle={notebookTitle} onBack={() => setSelectedGame(null)} />;
  }

  if (selectedGame === 'puzzle' && notebookId) {
    return <PuzzleGame notebookId={notebookId} notebookTitle={notebookTitle} onBack={() => setSelectedGame(null)} />;
  }

  if (selectedGame === 'race' && notebookId) {
    return <RaceGame notebookId={notebookId} notebookTitle={notebookTitle} onBack={() => setSelectedGame(null)} />;
  }

  if (selectedGame === 'quiz' && notebookId) {
    return <QuizBattle notebookId={notebookId} notebookTitle={notebookTitle} onBack={() => setSelectedGame(null)} />;
  }

  return (
    <div className="games-page">
      <HeaderWithHamburger title="Juegos" />
      
      <div className="games-container">
        <button 
          className="back-button" 
          onClick={() => navigate(-1)}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Volver</span>
        </button>

        <div className="games-header">
          <FontAwesomeIcon icon={faGamepad} className="games-icon" />
          <h1>Juegos</h1>
          <p className="games-subtitle">
            {notebookTitle ? `Cuaderno: ${notebookTitle}` : 'Aprende jugando con tus conceptos'}
          </p>
        </div>

        {!notebookId && (
          <div className="no-notebook-warning">
            <p>⚠️ Debes seleccionar un cuaderno desde la página de estudio para jugar</p>
            <button onClick={() => navigate('/notebooks')} className="select-notebook-btn">
              Seleccionar Cuaderno
            </button>
          </div>
        )}

        <div className="games-grid">
          <div 
            className={`game-card ${notebookId ? '' : 'disabled'}`}
            onClick={() => notebookId && setSelectedGame('memory')}
          >
            <div className="game-icon">🎯</div>
            <h3>Memorama</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
          </div>

          <div 
            className={`game-card ${notebookId ? '' : 'disabled'}`}
            onClick={() => notebookId && setSelectedGame('race')}
          >
            <div className="game-icon">🏃‍♂️</div>
            <h3>Carrera de Conceptos</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
          </div>

          <div 
            className={`game-card ${notebookId ? '' : 'disabled'}`}
            onClick={() => notebookId && setSelectedGame('puzzle')}
          >
            <div className="game-icon">🧩</div>
            <h3>Puzzle de Definiciones</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
          </div>

          <div 
            className={`game-card ${notebookId ? '' : 'disabled'}`}
            onClick={() => notebookId && setSelectedGame('quiz')}
          >
            <div className="game-icon">⚔️</div>
            <h3>Quiz Battle</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default GamesPage;