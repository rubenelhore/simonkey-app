import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRunning, faArrowLeft, faTrophy, faClock, faHeart } from '@fortawesome/free-solid-svg-icons';
import { useGamePoints } from '../../hooks/useGamePoints';
import { useStudyService } from '../../hooks/useStudyService';
import { useUserType } from '../../hooks/useUserType';
import { getEffectiveUserId } from '../../utils/getEffectiveUserId';
import HeaderWithHamburger from '../HeaderWithHamburger';
import '../../styles/RaceGame.css';

interface Concept {
  id: string;
  term: string;
  definition: string;
}

interface Hurdle {
  id: string;
  term: string;
  lane: number; // 0, 1, 2
  position: number; // Position from left to right
  isCorrect: boolean;
  groupId: string; // To group hurdles that appear together
}

interface RaceGameProps {
  notebookId: string;
  notebookTitle: string;
  onBack: () => void;
  cachedConcepts?: any[];
  cachedLearningData?: any[];
}

const RaceGame: React.FC<RaceGameProps> = ({ notebookId, notebookTitle, onBack, cachedConcepts, cachedLearningData }) => {
  const gameLoopRef = useRef<number | undefined>(undefined);
  const conceptsRef = useRef<Concept[]>([]);
  
  // Game state
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [currentDefinition, setCurrentDefinition] = useState<string>('');
  const [correctConcept, setCorrectConcept] = useState<Concept | null>(null);
  const [hurdles, setHurdles] = useState<Hurdle[]>([]);
  const [runnerLane, setRunnerLane] = useState(1); // 0, 1, 2 (three lanes)
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [noReviewedConcepts, setNoReviewedConcepts] = useState(false);
  const [processedGroups, setProcessedGroups] = useState<Set<string>>(new Set());
  const [showIntro, setShowIntro] = useState(true);
  const { addPoints } = useGamePoints(notebookId);
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService(isSchoolStudent ? 'school' : 'premium');
  
  // Animation state
  const [runnerFrame, setRunnerFrame] = useState(0);
  const [backgroundOffset, setBackgroundOffset] = useState(0);
  
  // Detect mobile device
  const isMobile = window.innerWidth <= 768;
  
  // Calculate actual screen width for mobile collision zone
  const screenWidth = window.innerWidth;
  const runnerPositionFromRight = isMobile ? 20 : 80; // Runner is 20px from right on mobile
  
  const HURDLE_SPEED = isMobile ? 0.5 : 1.5; // Much slower speed on mobile for full track visibility
  const COLLISION_ZONE = isMobile ? (screenWidth - runnerPositionFromRight - 40) : 750; // Dynamic collision based on screen width
  const SPAWN_POSITION = -150; // Starting position for hurdles (off screen left)
  const SPAWN_FREQUENCY = isMobile ? 7000 : 4500; // Much more time between spawns on mobile
  const MAX_QUESTIONS = 8; // Total questions per game

  // Conceptos se cargan directamente desde el botón "Comenzar Carrera"
  
  // Monitor cambios en concepts
  useEffect(() => {
    console.log('📊 Estado de concepts cambió:', concepts.length);
  }, [concepts]);

  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, hurdles]);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !gameOver) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameOver, startTime]);

  // Spawn new concepts periodically
  useEffect(() => {
    let spawnInterval: NodeJS.Timeout;
    if (gameStarted && !gameOver && (concepts.length > 0 || conceptsRef.current.length > 0)) {
      spawnInterval = setInterval(() => {
        spawnNewQuestion();
      }, SPAWN_FREQUENCY);
    }
    return () => clearInterval(spawnInterval);
  }, [gameStarted, gameOver, concepts, conceptsRef.current]);

  const loadConcepts = async () => {
    console.log('⏳ Iniciando carga de conceptos mock para race game...');
    setLoading(true);
    
    // Usar conceptos mock para testing rápido
    const mockConcepts: Concept[] = [
      { id: '1', term: 'React', definition: 'Una biblioteca de JavaScript para construir interfaces de usuario' },
      { id: '2', term: 'Estado', definition: 'Datos que pueden cambiar a lo largo del tiempo en un componente' },
      { id: '3', term: 'Props', definition: 'Propiedades que se pasan de un componente padre a un componente hijo' },
      { id: '4', term: 'JSX', definition: 'Una extensión de sintaxis para JavaScript que permite escribir HTML en React' },
      { id: '5', term: 'Hook', definition: 'Funciones especiales que te permiten usar estado y otras características de React' },
      { id: '6', term: 'Componente', definition: 'Una función o clase que devuelve elementos de React' },
      { id: '7', term: 'Virtual DOM', definition: 'Una representación en memoria del DOM real mantenida por React' },
      { id: '8', term: 'useEffect', definition: 'Un Hook que te permite realizar efectos secundarios en componentes funcionales' },
      { id: '9', term: 'useState', definition: 'Un Hook que te permite añadir estado a componentes funcionales' },
      { id: '10', term: 'Renderizado', definition: 'El proceso de convertir componentes de React en elementos del DOM' }
    ];

    console.log('🚀 Usando conceptos mock para race game:', mockConcepts.length);
    
    // Guardar en ref para persistencia
    conceptsRef.current = mockConcepts;
    setConcepts(mockConcepts);
    
    // Verificar que los conceptos se guardaron correctamente
    setTimeout(() => {
      console.log('🔍 Verificando conceptos después de setConcepts:');
      console.log('  - State concepts.length:', concepts.length);
      console.log('  - Ref conceptsRef.current.length:', conceptsRef.current.length);
    }, 100);
    
    console.log('✅ Conceptos cargados, finalizando loading');
    setLoading(false);
  };

  const spawnNewQuestion = () => {
    const currentConcepts = concepts.length > 0 ? concepts : conceptsRef.current;
    console.log('🎯 spawnNewQuestion llamado:');
    console.log('  - concepts.length:', concepts.length);
    console.log('  - conceptsRef.current.length:', conceptsRef.current.length);
    console.log('  - usando:', currentConcepts.length);
    
    if (currentConcepts.length < 3) {
      console.log('❌ No hay suficientes conceptos (mínimo 3)');
      return;
    }
    if (questionsAnswered >= MAX_QUESTIONS) {
      console.log('❌ Máximo de preguntas alcanzado');
      return;
    }
    
    // Select a random concept for the correct answer
    const correctIndex = Math.floor(Math.random() * currentConcepts.length);
    const correct = currentConcepts[correctIndex];
    
    // Get two wrong answers
    const wrongConcepts = currentConcepts.filter((_, index) => index !== correctIndex);
    const shuffled = [...wrongConcepts].sort(() => Math.random() - 0.5);
    const wrong = shuffled.slice(0, 2);
    
    // Set the current definition
    setCurrentDefinition(correct.definition);
    setCorrectConcept(correct);
    
    // Create hurdles for all three lanes
    const groupId = Math.random().toString();
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const newHurdles: Hurdle[] = [
      {
        id: Math.random().toString(),
        term: correct.term,
        lane: lanes[0],
        position: SPAWN_POSITION,
        isCorrect: true,
        groupId
      },
      {
        id: Math.random().toString(),
        term: wrong[0].term,
        lane: lanes[1],
        position: SPAWN_POSITION,
        isCorrect: false,
        groupId
      },
      {
        id: Math.random().toString(),
        term: wrong[1].term,
        lane: lanes[2],
        position: SPAWN_POSITION,
        isCorrect: false,
        groupId
      }
    ];
    
    console.log('✅ Pregunta generada:', correct.definition, 'Opciones:', newHurdles.map(h => h.term));
    setHurdles(prev => [...prev, ...newHurdles]);
  };

  const gameLoop = () => {
    // Update animations
    setRunnerFrame(prev => (prev + 1) % 8);
    // Background no longer moves
    // setBackgroundOffset(prev => (prev + HURDLE_SPEED) % 800);
    
    // Update hurdles
    setHurdles(prev => {
      const updated = prev.map(hurdle => ({
        ...hurdle,
        position: hurdle.position + HURDLE_SPEED
      }));
      
      // Check for collisions - adjust detection range based on speed
      const detectionRange = isMobile ? 20 : 40; // Even smaller range for mobile for precise detection
      const hurdlesInCollisionZone = updated.filter(hurdle => 
        hurdle.position >= COLLISION_ZONE - detectionRange && 
        hurdle.position <= COLLISION_ZONE + detectionRange &&
        hurdle.lane === runnerLane
      );
      
      if (hurdlesInCollisionZone.length > 0) {
        const hurdle = hurdlesInCollisionZone[0];
        
        // Check if this group has already been processed
        if (!processedGroups.has(hurdle.groupId)) {
          console.log('🔥 Procesando colisión para grupo:', hurdle.groupId);
          handleCollision(hurdle);
          setProcessedGroups(prev => new Set(prev).add(hurdle.groupId));
        } else {
          console.log('⚠️ Grupo ya procesado, ignorando:', hurdle.groupId);
        }
        
        // Remove all hurdles from the same group after collision
        return updated.filter(h => h.groupId !== hurdle.groupId);
      }
      
      // Remove hurdles that have passed off screen
      return updated.filter(hurdle => hurdle.position < 1000);
    });
  };

  const handleCollision = (hurdle: Hurdle) => {
    console.log('💥 Colisión detectada:', hurdle.isCorrect ? 'CORRECTA' : 'INCORRECTA', 'groupId:', hurdle.groupId);
    
    if (hurdle.isCorrect) {
      // Correct hurdle - NO jump, just score points
      console.log('✅ Respuesta correcta');
      setScore(prev => prev + 5 + combo);
      setCombo(prev => prev + 1);
      if (combo + 1 > maxCombo) {
        setMaxCombo(combo + 1);
      }
      setShowResult('correct');
      setQuestionsAnswered(prev => {
        const newCount = prev + 1;
        if (newCount >= MAX_QUESTIONS) {
          setTimeout(() => endGame(true), 2000); // End game after last question
        }
        return newCount;
      });
      
    } else {
      // Wrong hurdle - crash
      console.log('❌ Respuesta incorrecta, restando 1 vida. Vidas antes:', lives);
      setLives(prev => {
        const newLives = prev - 1;
        console.log('💔 Nuevas vidas:', newLives);
        // Check game over with the new lives value, not the old one
        if (newLives <= 0) {
          console.log('☠️ Game Over con nuevas vidas:', newLives);
          setTimeout(() => endGame(false), 100);
        }
        return newLives;
      });
      setCombo(0);
      setShowResult('wrong');
    }
    
    // Clear result after animation
    setTimeout(() => {
      setShowResult(null);
    }, 500);
  };

  const handleLaneChange = (e: KeyboardEvent) => {
    console.log('🎮 Tecla presionada:', e.key, 'gameStarted:', gameStarted, 'gameOver:', gameOver);
    
    // Start game if not started
    if (!gameStarted && !gameOver && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      console.log('🚀 Iniciando juego...');
      startGame();
    }
    
    // Only change lanes if game is started
    if (gameStarted && !gameOver) {
      if (e.key === 'ArrowUp' && runnerLane > 0) {
        console.log('⬆️ Moviendo hacia arriba');
        setRunnerLane(runnerLane - 1);
      } else if (e.key === 'ArrowDown' && runnerLane < 2) {
        console.log('⬇️ Moviendo hacia abajo');
        setRunnerLane(runnerLane + 1);
      }
    }
  };

  // Touch handlers for mobile
  const handleMobileLaneUp = () => {
    // Start game if not started
    if (!gameStarted && !gameOver) {
      startGame();
    }
    
    // Only change lanes if game is started
    if (runnerLane > 0 && gameStarted && !gameOver) {
      setRunnerLane(runnerLane - 1);
    }
  };

  const handleMobileLaneDown = () => {
    // Start game if not started
    if (!gameStarted && !gameOver) {
      startGame();
    }
    
    // Only change lanes if game is started
    if (runnerLane < 2 && gameStarted && !gameOver) {
      setRunnerLane(runnerLane + 1);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleLaneChange);
    return () => window.removeEventListener('keydown', handleLaneChange);
  }, [gameStarted, gameOver, runnerLane]);

  const startGame = () => {
    console.log('🚀 Iniciando juego, concepts.length:', concepts.length);
    setGameStarted(true);
    setScore(0);
    setLives(3);
    setCombo(0);
    setMaxCombo(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    setQuestionsAnswered(0);
    setHurdles([]);
    setCurrentDefinition('');
    setCorrectConcept(null);
    setIsJumping(false);
    setPointsAwarded(false);
    setGameOver(false);
    setProcessedGroups(new Set());
    
    // Spawn first question when game starts, but wait a bit longer for concepts to load
    setTimeout(() => spawnNewQuestion(), 1000);
  };

  const endGame = async (completed: boolean) => {
    setGameOver(true);
    if (completed && !pointsAwarded) {
      await awardGamePoints();
    }
  };

  const awardGamePoints = async () => {
    if (!pointsAwarded) {
      setPointsAwarded(true);
      
      // Determinar bonus basado en el rendimiento
      let bonusType: 'perfect' | 'speed' | 'streak' | undefined;
      
      if (lives === 3) {
        bonusType = 'perfect'; // No perdió vidas
      } else if (maxCombo >= 5) {
        bonusType = 'streak'; // Buen combo
      } else if (elapsedTime < 90) {
        bonusType = 'speed'; // Completado rápidamente (menos de 90 segundos)
      }
      
      const gameId = notebookId ? `race_${notebookId}` : 'race';
      const result = await addPoints(gameId, 'Carrera de Conceptos', score, bonusType);
      
      if (result?.newAchievements && result.newAchievements.length > 0) {
        console.log('¡Nuevos logros desbloqueados!', result.newAchievements);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderIntroModal = () => (
    <div className="race-intro-overlay">
      <div className="race-intro-modal">
        <div className="intro-header">
          <FontAwesomeIcon icon={faRunning} className="intro-icon" />
          <h2>Carrera de Conceptos</h2>
        </div>
        
        <div className="intro-content">
          <div className="intro-section">
            <h3>¿Cómo jugar?</h3>
            <ul>
              <li><i className="fas fa-arrow-up"></i> Usa ↑↓ para cambiar de carril</li>
              <li><i className="fas fa-clock"></i> Lee la definición y posiciónate correctamente</li>
              <li><i className="fas fa-running"></i> Alinéate con el concepto correcto</li>
              <li><i className="fas fa-heart"></i> Evita chocar con conceptos incorrectos</li>
            </ul>
          </div>
          
          <div className="intro-section">
            <h3>Sistema de puntuación</h3>
            <div className="scoring-info">
              <div className="score-item">
                <span className="score-points">+5</span>
                <span>Por respuesta correcta</span>
              </div>
              <div className="score-item">
                <span className="score-points">+Combo</span>
                <span>Bonus por racha</span>
              </div>
              <div className="score-item">
                <span className="score-points">3 ❤️</span>
                <span>Vidas disponibles</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="intro-actions">
          <button className="action-button secondary" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowLeft} />
            Cancelar
          </button>
          <button 
            className="action-button primary" 
            onClick={async () => {
              setShowIntro(false);
              setLoading(true);
              // Cargar conceptos inmediatamente
              await loadConcepts();
            }}
          >
            <FontAwesomeIcon icon={faRunning} />
            Comenzar Carrera
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        <HeaderWithHamburger 
          title="Carrera de Conceptos"
          subtitle={notebookTitle}
        />
        <div className="race-game-container with-header-sidebar">
          <div className="loading-container">
            <div className="loading-circle"></div>
            <p className="loading-text">Cargando</p>
          </div>
        </div>
      </>
    );
  }

  if (noReviewedConcepts) {
    return (
      <>
        <HeaderWithHamburger 
          title="Carrera de Conceptos"
          subtitle={notebookTitle}
        />
        <div className="race-game-container with-header-sidebar">
          <div className="no-concepts-message">
            <button className="back-button" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div className="empty-state">
              <i className="fas fa-graduation-cap"></i>
              <h2>¡Primero necesitas estudiar!</h2>
              <p>Para jugar, necesitas haber repasado al menos 3 conceptos en el estudio inteligente.</p>
              <p>Los juegos usan solo conceptos que ya has estudiado para reforzar tu aprendizaje.</p>
              <button className="primary-button" onClick={onBack}>
                Volver
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (showIntro) {
    return (
      <>
        <HeaderWithHamburger 
          title="Carrera de Conceptos"
          subtitle={notebookTitle}
        />
        <div className="race-game-container with-header-sidebar">
          {renderIntroModal()}
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderWithHamburger 
        title="Carrera de Conceptos"
        subtitle={notebookTitle}
      />
      <div className="race-game-container with-header-sidebar">
        <div className="race-header">
        <button className="back-button" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        
        <div className="race-stats">
          <div className="stat">
            <FontAwesomeIcon icon={faHeart} />
            <span>{lives}</span>
          </div>
          <div className="stat">
            <FontAwesomeIcon icon={faTrophy} />
            <span>{score}</span>
          </div>
          <div className="stat">
            <FontAwesomeIcon icon={faClock} />
            <span>{formatTime(elapsedTime)}</span>
          </div>
          <div className="stat">
            <span>Combo x{combo}</span>
          </div>
          <div className="stat">
            <span>Pregunta {questionsAnswered}/{MAX_QUESTIONS}</span>
          </div>
        </div>
      </div>

      {/* Definition Display */}
      {currentDefinition && (
        <div className="definition-display">
          <h2>{currentDefinition}</h2>
        </div>
      )}

      {/* Instructions Message - only show if no current definition */}
      {!currentDefinition && (
        <div className="race-instructions">
          <p>¡Mueve al corredor a la respuesta correcta!</p>
        </div>
      )}

      <div className="race-track">
        <div className="track-background">
          <div className="parallax-layer clouds"></div>
          <div className="parallax-layer trees"></div>
        </div>

        {/* Start Message */}
        {!gameStarted && (
          <div className="race-start-message">
            <p>Haz click en las flechas ↑↓ para iniciar el juego</p>
          </div>
        )}

        <div className="race-lanes">
          {[0, 1, 2].map(lane => (
            <div 
              key={lane} 
              className={`lane lane-${lane} ${runnerLane === lane ? 'active' : ''}`}
            >
              {/* Hurdles */}
              {hurdles
                .filter(hurdle => hurdle.lane === lane)
                .map(hurdle => (
                  <div
                    key={hurdle.id}
                    className="hurdle neutral"
                    style={{ left: `${hurdle.position}px` }}
                  >
                    <div className="hurdle-bar"></div>
                    <span className="hurdle-text">{hurdle.term}</span>
                  </div>
                ))}
            </div>
          ))}
          
          {/* Runner - positioned at the right */}
          <div className={`runner ${showResult || ''} ${isJumping ? 'jumping' : ''}`}
               style={{ top: `${20 + runnerLane * 130}px` }}>
            <div className={`runner-sprite frame-${runnerFrame}`} style={{ transform: 'scaleX(-1) !important', display: 'inline-block' }}>
              <span>🏃‍♂️</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Controls */}
      {gameStarted && !gameOver && (
        <div className="mobile-controls">
          <button 
            className={`lane-control-btn up ${runnerLane === 0 ? 'disabled' : ''}`}
            onClick={handleMobileLaneUp}
            disabled={runnerLane === 0}
          >
            <i className="fas fa-chevron-up"></i>
          </button>
          <div className="lane-indicator">
            <span className={`lane-dot ${runnerLane === 0 ? 'active' : ''}`}></span>
            <span className={`lane-dot ${runnerLane === 1 ? 'active' : ''}`}></span>
            <span className={`lane-dot ${runnerLane === 2 ? 'active' : ''}`}></span>
          </div>
          <button 
            className={`lane-control-btn down ${runnerLane === 2 ? 'disabled' : ''}`}
            onClick={handleMobileLaneDown}
            disabled={runnerLane === 2}
          >
            <i className="fas fa-chevron-down"></i>
          </button>
        </div>
      )}


      {gameOver && (
        <div className="game-over-modal">
          <FontAwesomeIcon icon={faTrophy} className="trophy-icon" />
          <h2>{lives > 0 ? '¡Juego Completado!' : 'Fin del Juego'}</h2>
          <div className="final-stats">
            <div className="final-stat">
              <span className="label">Puntuación Final:</span>
              <span className="value">{score}</span>
            </div>
            <div className="final-stat">
              <span className="label">Tiempo:</span>
              <span className="value">{formatTime(elapsedTime)}</span>
            </div>
            <div className="final-stat">
              <span className="label">Conceptos:</span>
              <span className="value">{questionsAnswered}</span>
            </div>
            <div className="final-stat">
              <span className="label">Mejor Combo:</span>
              <span className="value">x{maxCombo}</span>
            </div>
          </div>
          <button className="back-button" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Volver a Juegos</span>
          </button>
        </div>
      )}
      </div>
    </>
  );
};

export default RaceGame;