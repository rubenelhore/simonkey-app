import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRunning, faArrowLeft, faTrophy, faClock, faHeart } from '@fortawesome/free-solid-svg-icons';
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
}

const RaceGame: React.FC<RaceGameProps> = ({ notebookId, notebookTitle, onBack }) => {
  const gameLoopRef = useRef<number | undefined>(undefined);
  
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
  const [loading, setLoading] = useState(true);
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  
  // Animation state
  const [runnerFrame, setRunnerFrame] = useState(0);
  const [backgroundOffset, setBackgroundOffset] = useState(0);
  
  const HURDLE_SPEED = 1.5; // Speed of hurdles moving left to right (reduced by half again)
  const COLLISION_ZONE = 750; // X position where collision occurs (near runner)
  const SPAWN_POSITION = -150; // Starting position for hurdles (off screen left)
  const SPAWN_FREQUENCY = 4500; // Milliseconds between spawns
  const MAX_QUESTIONS = 10; // Total questions per game

  useEffect(() => {
    loadConcepts();
  }, [notebookId]);

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
    if (gameStarted && !gameOver && concepts.length > 0) {
      spawnInterval = setInterval(() => {
        spawnNewQuestion();
      }, SPAWN_FREQUENCY);
    }
    return () => clearInterval(spawnInterval);
  }, [gameStarted, gameOver, concepts, currentDefinition]);

  const loadConcepts = async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      let conceptsList: Concept[] = [];

      const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));

      if (notebookDoc.exists()) {
        const conceptsQuery = query(
          collection(db, 'schoolConcepts'),
          where('notebookId', '==', notebookId)
        );
        
        const conceptsSnapshot = await getDocs(conceptsQuery);
        conceptsSnapshot.forEach((doc) => {
          const data = doc.data();
          conceptsList.push({
            id: doc.id,
            term: data.termino || data.term || '',
            definition: data.definicion || data.definition || ''
          });
        });
      } else {
        const conceptsQuery = query(
          collection(db, 'conceptos'),
          where('cuadernoId', '==', notebookId),
          where('usuarioId', '==', userId)
        );
        
        const conceptsSnapshot = await getDocs(conceptsQuery);
        conceptsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.conceptos && Array.isArray(data.conceptos)) {
            data.conceptos.forEach((concepto: any, index: number) => {
              conceptsList.push({
                id: `${doc.id}_${index}`,
                term: concepto.término || concepto.term || '',
                definition: concepto.definición || concepto.definition || ''
              });
            });
          }
        });
      }

      setConcepts(conceptsList);
      setLoading(false);
    } catch (error) {
      console.error('Error loading concepts:', error);
      setLoading(false);
    }
  };

  const spawnNewQuestion = () => {
    if (concepts.length < 3) return;
    if (questionsAnswered >= MAX_QUESTIONS) return; // Stop spawning after 10 questions
    
    // Select a random concept for the correct answer
    const correctIndex = Math.floor(Math.random() * concepts.length);
    const correct = concepts[correctIndex];
    
    // Get two wrong answers
    const wrongConcepts = concepts.filter((_, index) => index !== correctIndex);
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
      
      // Check for collisions
      const hurdlesInCollisionZone = updated.filter(hurdle => 
        hurdle.position >= COLLISION_ZONE - 40 && 
        hurdle.position <= COLLISION_ZONE + 40 &&
        hurdle.lane === runnerLane
      );
      
      if (hurdlesInCollisionZone.length > 0) {
        const hurdle = hurdlesInCollisionZone[0];
        handleCollision(hurdle);
        
        // Remove all hurdles from the same group after collision
        return updated.filter(h => h.groupId !== hurdle.groupId);
      }
      
      // Remove hurdles that have passed off screen
      return updated.filter(hurdle => hurdle.position < 1000);
    });
  };

  const handleCollision = (hurdle: Hurdle) => {
    if (hurdle.isCorrect) {
      // Correct hurdle - jump over it
      setIsJumping(true);
      setScore(prev => prev + 10 + combo * 2);
      setCombo(prev => prev + 1);
      if (combo + 1 > maxCombo) {
        setMaxCombo(combo + 1);
      }
      setShowResult('correct');
      setQuestionsAnswered(prev => {
        const newCount = prev + 1;
        if (newCount >= MAX_QUESTIONS) {
          setTimeout(() => endGame(), 2000); // End game after last question
        }
        return newCount;
      });
      
      setTimeout(() => {
        setIsJumping(false);
      }, 600);
    } else {
      // Wrong hurdle - crash
      setLives(prev => prev - 1);
      setCombo(0);
      setShowResult('wrong');
      
      if (lives <= 1) {
        endGame();
      }
    }
    
    // Clear result after animation
    setTimeout(() => {
      setShowResult(null);
    }, 500);
  };

  const handleLaneChange = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' && runnerLane > 0) {
      setRunnerLane(runnerLane - 1);
    } else if (e.key === 'ArrowDown' && runnerLane < 2) {
      setRunnerLane(runnerLane + 1);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleLaneChange);
    return () => window.removeEventListener('keydown', handleLaneChange);
  }, [runnerLane]);

  const startGame = () => {
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
    
    // Spawn first question immediately
    setTimeout(() => spawnNewQuestion(), 500);
  };

  const endGame = () => {
    setGameOver(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="race-game-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Cargando pista...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="race-game-container">
      <div className="race-header">
        <button className="back-button" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Volver</span>
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

      <div className="race-track">
        <div className="track-background">
          <div className="parallax-layer clouds"></div>
          <div className="parallax-layer trees"></div>
        </div>

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

      {!gameStarted && !gameOver && (
        <div className="game-start-modal">
          <h2>¡Carrera de Conceptos!</h2>
          <p>Lee la definición y alinéate con el concepto correcto</p>
          <ul>
            <li>↑↓ Cambiar de carril</li>
            <li>Los conceptos se acercan hacia ti</li>
            <li>Colócate en el carril del concepto correcto</li>
            <li>Evita chocar con conceptos incorrectos</li>
          </ul>
          <button className="start-button" onClick={startGame}>
            <FontAwesomeIcon icon={faRunning} /> ¡Empezar Carrera!
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
            Volver a Juegos
          </button>
        </div>
      )}
    </div>
  );
};

export default RaceGame;