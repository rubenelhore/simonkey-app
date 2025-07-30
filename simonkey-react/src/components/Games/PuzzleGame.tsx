import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPuzzlePiece, faArrowLeft, faClock, faTrophy, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { useGamePoints } from '../../hooks/useGamePoints';
import { useStudyService } from '../../hooks/useStudyService';
import { useUserType } from '../../hooks/useUserType';
import { getEffectiveUserId } from '../../utils/getEffectiveUserId';
import '../../styles/PuzzleGame.css';

interface Concept {
  id: string;
  term: string;
  definition: string;
}

interface Fragment {
  id: string;
  conceptId: string;
  text: string;
  order: number;
  currentPosition: number;
  correctStartPosition?: number;
}

interface PuzzleGameProps {
  notebookId: string;
  notebookTitle: string;
  onBack: () => void;
}

const PuzzleGame: React.FC<PuzzleGameProps> = ({ notebookId, notebookTitle, onBack }) => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [currentConcepts, setCurrentConcepts] = useState<Concept[]>([]);
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draggedFragment, setDraggedFragment] = useState<Fragment | null>(null);
  const [correctPuzzles, setCorrectPuzzles] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [noReviewedConcepts, setNoReviewedConcepts] = useState(false);
  const { addPoints } = useGamePoints(notebookId);
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService(isSchoolStudent ? 'school' : 'premium');

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !gameCompleted) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameCompleted, startTime]);

  // Load concepts
  useEffect(() => {
    loadConcepts();
  }, [notebookId]);

  // Check if all puzzles are solved
  useEffect(() => {
    if (currentConcepts.length > 0 && correctPuzzles.length === currentConcepts.length) {
      setTimeout(() => {
        nextLevel();
      }, 1500);
    }
  }, [correctPuzzles, currentConcepts]);

  const loadConcepts = async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      // Obtener el ID efectivo del usuario
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      // Obtener TODOS los conceptos del cuaderno primero
      let allConcepts: any[] = await studyService.getAllConceptsFromNotebook(userId, notebookId);
      console.log('🧩 Total de conceptos en el cuaderno:', allConcepts.length);
      
      // Obtener datos de aprendizaje para filtrar solo conceptos repasados
      const learningData = await studyService.getLearningDataForNotebook(userId, notebookId);
      console.log('📚 Datos de aprendizaje encontrados:', learningData.length);
      
      // Crear un Set con los IDs de conceptos que tienen datos de aprendizaje (han sido repasados)
      const reviewedConceptIds = new Set(learningData.map(data => data.conceptId));
      
      // Filtrar solo los conceptos que han sido repasados
      const reviewedConcepts = allConcepts.filter(concept => 
        reviewedConceptIds.has(concept.id)
      );
      
      console.log('🎯 Conceptos repasados disponibles para el juego:', reviewedConcepts.length);
      
      if (reviewedConcepts.length < 3) {
        console.log('⚠️ No hay suficientes conceptos repasados para el juego (mínimo 3)');
        setNoReviewedConcepts(true);
        setLoading(false);
        return;
      }
      
      // Convertir al formato que espera el juego
      const conceptsList: Concept[] = reviewedConcepts.map(concept => ({
        id: concept.id,
        term: concept.término || '',
        definition: concept.definición || ''
      }));

      console.log('🎯 Total de conceptos repasados para el juego:', conceptsList.length);
      setConcepts(conceptsList);
      
      // Start with 3 random concepts
      if (conceptsList.length >= 3) {
        startNewRound(conceptsList);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading concepts:', error);
      setLoading(false);
    }
  };

  const fragmentDefinition = (definition: string, conceptId: string): Fragment[] => {
    const words = definition.split(' ').filter(word => word.trim() !== '');
    const wordCount = words.length;
    
    // Determinar número óptimo de fragmentos basado en la longitud
    let fragmentCount: number;
    if (wordCount <= 4) {
      fragmentCount = 2; // Definiciones muy cortas: 2 fragmentos
    } else if (wordCount <= 8) {
      fragmentCount = 3; // Definiciones cortas-medianas: 3 fragmentos
    } else if (wordCount <= 15) {
      fragmentCount = 4; // Definiciones medianas: 4 fragmentos
    } else {
      fragmentCount = 5; // Definiciones largas: 5 fragmentos
    }
    
    const parts: Fragment[] = [];
    const minWordsPerFragment = Math.floor(wordCount / fragmentCount);
    const extraWords = wordCount % fragmentCount;
    
    let currentIndex = 0;
    
    for (let i = 0; i < fragmentCount; i++) {
      // Algunos fragmentos tendrán una palabra extra para distribuir el resto
      const wordsInThisFragment = minWordsPerFragment + (i < extraWords ? 1 : 0);
      const fragmentWords = words.slice(currentIndex, currentIndex + wordsInThisFragment);
      const text = fragmentWords.join(' ');
      
      if (text.trim()) {
        parts.push({
          id: `${conceptId}_${i}`,
          conceptId,
          text,
          order: i,
          currentPosition: -1
        });
      }
      
      currentIndex += wordsInThisFragment;
    }

    return parts;
  };

  const startNewRound = (allConcepts?: Concept[]) => {
    const conceptsPool = allConcepts || concepts;
    const shuffled = [...conceptsPool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);
    
    setCurrentConcepts(selected);
    setCorrectPuzzles([]);
    
    // Create fragments for all 3 concepts with proper positioning
    const allFragments: Fragment[] = [];
    let currentPosition = 0;
    
    selected.forEach((concept, conceptIndex) => {
      const frags = fragmentDefinition(concept.definition, concept.id);
      const conceptStartPosition = currentPosition;
      
      // Asignar posiciones correctas para cada fragmento del concepto
      frags.forEach((frag, fragIndex) => {
        allFragments.push({
          ...frag,
          currentPosition: -1, // Inicialmente sin posición
          correctStartPosition: conceptStartPosition // Todos los fragmentos del concepto comparten la misma posición de inicio
        });
      });
      
      currentPosition += frags.length; // Incrementar por el número real de fragmentos
    });

    // Shuffle all fragments para las posiciones iniciales
    const shuffledFragments = allFragments.sort(() => Math.random() - 0.5);
    shuffledFragments.forEach((frag, index) => {
      frag.currentPosition = index;
    });

    setFragments(shuffledFragments);
    
    if (!gameStarted) {
      setGameStarted(true);
      setStartTime(Date.now());
    }
  };

  const nextLevel = () => {
    setIsAnimating(true);
    
    // Calculate bonus
    const timeBonus = Math.max(0, 60 - elapsedTime) / 10; // Max 6 puntos si terminas en menos de 60 segundos
    const comboBonus = combo * 2; // 2 puntos por cada combo
    const levelBonus = level * 5; // 5 puntos por nivel
    
    setScore(score + 10 + Math.floor(timeBonus + comboBonus + levelBonus));
    
    if (level >= 3) {
      // Game completed!
      setGameCompleted(true);
      setTimeout(() => {
        celebrateGameComplete();
        awardGamePoints();
      }, 500);
    } else {
      setLevel(level + 1);
      setTimeout(() => {
        startNewRound();
        setIsAnimating(false);
      }, 500);
    }
  };

  const handleDragStart = (fragment: Fragment) => {
    setDraggedFragment(fragment);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetPosition: number) => {
    e.preventDefault();
    
    if (!draggedFragment) return;

    const targetFragment = fragments.find(f => f.currentPosition === targetPosition);
    if (!targetFragment) return;

    // Swap positions
    const newFragments = fragments.map(f => {
      if (f.id === draggedFragment.id) {
        return { ...f, currentPosition: targetPosition };
      } else if (f.id === targetFragment.id) {
        return { ...f, currentPosition: draggedFragment.currentPosition };
      }
      return f;
    });

    setFragments(newFragments);
    setDraggedFragment(null);

    // Check if any puzzle is complete
    checkPuzzleCompletion(newFragments);
  };

  const checkPuzzleCompletion = (currentFragments: Fragment[]) => {
    const newCorrectPuzzles: string[] = [];

    currentConcepts.forEach((concept, conceptIndex) => {
      if (correctPuzzles.includes(concept.id)) return; // Ya está completo
      
      const conceptFragments = currentFragments
        .filter(f => f.conceptId === concept.id)
        .sort((a, b) => a.order - b.order); // Ordenar por orden original, no posición actual

      // Verificar si todos los fragmentos están en posiciones consecutivas y correctas
      const firstFragment = conceptFragments[0];
      if (!firstFragment || firstFragment.correctStartPosition === undefined) return;
      
      const expectedStartPosition = firstFragment.correctStartPosition;
      const isCorrect = conceptFragments.every((frag, index) => {
        return frag.currentPosition === expectedStartPosition + index && frag.order === index;
      });

      if (isCorrect) {
        newCorrectPuzzles.push(concept.id);
        setCombo(combo + 1);
        if (combo + 1 > maxCombo) {
          setMaxCombo(combo + 1);
        }
        
        // Celebration effect
        celebratePuzzle(conceptIndex);
      }
    });

    if (newCorrectPuzzles.length > 0) {
      setCorrectPuzzles([...correctPuzzles, ...newCorrectPuzzles]);
    } else if (correctPuzzles.length === 0) {
      setCombo(0);
    }
  };

  const celebratePuzzle = (rowIndex: number) => {
    const puzzleRow = document.querySelector(`.puzzle-row:nth-child(${rowIndex + 1})`);
    if (puzzleRow) {
      puzzleRow.classList.add('correct-animation');
      setTimeout(() => {
        puzzleRow.classList.remove('correct-animation');
      }, 1000);
    }
  };

  const celebrateGameComplete = () => {
    // Create confetti effect
    const container = document.querySelector('.puzzle-game-container');
    if (!container) return;

    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-particle';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)];
        confetti.style.animationDelay = Math.random() * 3 + 's';
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3000);
      }, i * 30);
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const awardGamePoints = async () => {
    if (!pointsAwarded) {
      setPointsAwarded(true);
      
      // Determinar tipo de bonus
      let bonusType: 'perfect' | 'speed' | 'streak' | undefined = undefined;
      if (maxCombo >= 10) {
        bonusType = 'streak'; // Gran combo
      } else if (elapsedTime < 60) {
        bonusType = 'speed'; // Completado en menos de 1 minuto
      } else if (score >= 300) {
        bonusType = 'perfect'; // Puntuación alta
      }
      
      const gameId = notebookId ? `puzzle_${notebookId}` : 'puzzle';
      const result = await addPoints(gameId, 'Puzzle de Definiciones', score, bonusType);
      
      if (result?.newAchievements && result.newAchievements.length > 0) {
        console.log('Nuevos logros:', result.newAchievements);
      }
    }
  };

  if (loading) {
    return (
      <div className="puzzle-game-container">
        <div className="loading-container">
          <div className="loading-circle"></div>
          <p className="loading-text">Cargando</p>
        </div>
      </div>
    );
  }

  if (noReviewedConcepts) {
    return (
      <div className="puzzle-game-container">
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
    );
  }

  return (
    <div className="puzzle-game-container">
      <div className="puzzle-header">
        <button className="back-button" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        
        <div className="game-title">
          <h1><FontAwesomeIcon icon={faPuzzlePiece} /> Puzzle de Definiciones</h1>
          <p>{notebookTitle} - Nivel {level} de 3</p>
        </div>

      </div>

      <div className="game-stats">
        <div className="stat">
          <FontAwesomeIcon icon={faClock} />
          <span>{formatTime(elapsedTime)}</span>
        </div>
        <div className="stat">
          <FontAwesomeIcon icon={faTrophy} />
          <span>Puntos: {score}</span>
        </div>
        <div className="stat">
          <span>Combo: x{combo}</span>
        </div>
      </div>

      <div className={`puzzle-board ${isAnimating ? 'animating' : ''}`}>
        {currentConcepts.map((concept, rowIndex) => {
          // Calcular cuántos fragmentos tiene este concepto
          const conceptFragments = fragments.filter(f => f.conceptId === concept.id);
          const fragmentCount = conceptFragments.length;
          
          // Calcular la posición inicial para este concepto
          let startPosition = 0;
          for (let i = 0; i < rowIndex; i++) {
            const prevConceptFragments = fragments.filter(f => f.conceptId === currentConcepts[i].id);
            startPosition += prevConceptFragments.length;
          }
          
          return (
            <div 
              key={concept.id} 
              className={`puzzle-row ${correctPuzzles.includes(concept.id) ? 'completed' : ''}`}
            >
              <div className="concept-term">
                <h3>{concept.term}</h3>
                {correctPuzzles.includes(concept.id) && (
                  <FontAwesomeIcon icon={faCheckCircle} className="check-icon" />
                )}
              </div>
              
              <div className="fragments-container" style={{ gridTemplateColumns: `repeat(${fragmentCount}, 1fr)` }}>
                {Array.from({ length: fragmentCount }).map((_, position) => {
                  const absolutePosition = startPosition + position;
                  const fragment = fragments.find(f => f.currentPosition === absolutePosition);
                  
                  return (
                    <div
                      key={`slot-${absolutePosition}`}
                      className="fragment-slot"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, absolutePosition)}
                    >
                      {fragment && (
                        <div
                          className={`fragment ${fragment.conceptId === concept.id ? 'correct-concept' : 'wrong-concept'}`}
                          draggable={!correctPuzzles.includes(fragment.conceptId)}
                          onDragStart={() => handleDragStart(fragment)}
                        >
                          <span>{fragment.text}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {correctPuzzles.length === currentConcepts.length && currentConcepts.length > 0 && !gameCompleted && (
        <div className="level-complete">
          <h2>¡Nivel {level} Completado!</h2>
          <p>Preparando siguiente nivel...</p>
        </div>
      )}

      {gameCompleted && (
        <div className="game-completed-modal">
          <div className="modal-content">
            <FontAwesomeIcon icon={faTrophy} className="trophy-icon" />
            <h2>¡Juego Completado!</h2>
            <p>Has completado los 3 niveles</p>
            
            <div className="final-stats">
              <div className="final-stat">
                <span className="label">Tiempo total:</span>
                <span className="value">{formatTime(elapsedTime)}</span>
              </div>
              <div className="final-stat">
                <span className="label">Mejor combo:</span>
                <span className="value">x{maxCombo}</span>
              </div>
              <div className="final-stat highlight">
                <span className="label">Puntuación final:</span>
                <span className="value">{score}</span>
              </div>
            </div>

            <button className="back-to-games-btn" onClick={onBack}>
              Volver a juegos
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PuzzleGame;