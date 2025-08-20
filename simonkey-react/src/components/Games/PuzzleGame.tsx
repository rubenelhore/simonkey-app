import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPuzzlePiece, faArrowLeft, faClock, faTrophy, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { useGamePoints } from '../../hooks/useGamePoints';
import { useStudyService } from '../../hooks/useStudyService';
import { useUserType } from '../../hooks/useUserType';
import { getEffectiveUserId } from '../../utils/getEffectiveUserId';
import HeaderWithHamburger from '../HeaderWithHamburger';
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
  cachedConcepts?: any[];
  cachedLearningData?: any[];
}

const PuzzleGame: React.FC<PuzzleGameProps> = ({ notebookId, notebookTitle, onBack, cachedConcepts, cachedLearningData }) => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [currentConcepts, setCurrentConcepts] = useState<Concept[]>([]);
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draggedFragment, setDraggedFragment] = useState<Fragment | null>(null);
  const [correctPuzzles, setCorrectPuzzles] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [touchStartFragment, setTouchStartFragment] = useState<Fragment | null>(null);
  const [touchTargetPosition, setTouchTargetPosition] = useState<number | null>(null);
  const [noReviewedConcepts, setNoReviewedConcepts] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [conceptsLoaded, setConceptsLoaded] = useState(false);
  const { addPoints } = useGamePoints(notebookId);
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService(isSchoolStudent ? 'school' : 'premium');

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  // Load concepts only when intro is closed and game starts
  useEffect(() => {
    if (notebookId && !conceptsLoaded && !loading && !showIntro) {
      loadConcepts();
    }
  }, [notebookId, showIntro]);

  // Check if all puzzles are solved
  useEffect(() => {
    if (currentConcepts.length > 0 && correctPuzzles.length === currentConcepts.length) {
      setTimeout(() => {
        nextLevel();
      }, 1500);
    }
  }, [correctPuzzles, currentConcepts]);

  const loadConcepts = async () => {
    console.log('🎯 loadConcepts llamado, conceptsLoaded:', conceptsLoaded);
    if (conceptsLoaded) return;

    console.log('⏳ Iniciando carga de conceptos del cuaderno:', notebookId);
    setLoading(true);
    setConceptsLoaded(true);
    
    try {
      if (!auth.currentUser) {
        console.error('No hay usuario autenticado');
        setNoReviewedConcepts(true);
        setLoading(false);
        return;
      }

      // Si ya tenemos conceptos cacheados, usarlos
      if (cachedConcepts && cachedConcepts.length > 0) {
        console.log('📚 Usando conceptos cacheados:', cachedConcepts.length);
        console.log('📚 Primer concepto cacheado:', cachedConcepts[0]);
        const gameConcepts = cachedConcepts.map(c => ({
          id: c.id,
          term: c.término || c.termino || c.term || '',
          definition: c.definición || c.definicion || c.definition || ''
        }));
        console.log('🎮 Conceptos mapeados para el juego:', gameConcepts);
        
        setConcepts(gameConcepts);
        
        // Start with 3 random concepts
        if (gameConcepts.length >= 3) {
          console.log('🎲 Iniciando nueva ronda con conceptos del cuaderno');
          startNewRound(gameConcepts);
        } else {
          console.log('❌ No hay suficientes conceptos (mínimo 3)');
          setNoReviewedConcepts(true);
        }
        
        setLoading(false);
        return;
      }

      // Determinar la colección según el tipo de usuario
      const conceptsCollection = isSchoolStudent ? 'schoolConcepts' : 'conceptos';
      const notebookField = isSchoolStudent ? 'idCuaderno' : 'cuadernoId';
      
      console.log('🔍 Buscando conceptos en:', conceptsCollection, 'para cuaderno:', notebookId);
      console.log('🔍 Usando campo:', notebookField);
      
      // Cargar conceptos del cuaderno
      let conceptsQuery = query(
        collection(db, conceptsCollection),
        where(notebookField, '==', notebookId)
      );
      
      let conceptsSnapshot = await getDocs(conceptsQuery);
      
      // Si no encuentra conceptos y es estudiante escolar, intentar con cuadernoId como fallback
      if (conceptsSnapshot.empty && isSchoolStudent) {
        console.log('⚠️ No se encontraron conceptos con idCuaderno, intentando con cuadernoId...');
        conceptsQuery = query(
          collection(db, conceptsCollection),
          where('cuadernoId', '==', notebookId)
        );
        conceptsSnapshot = await getDocs(conceptsQuery);
      }
      
      if (conceptsSnapshot.empty) {
        console.log('❌ No se encontraron conceptos para el cuaderno');
        setNoReviewedConcepts(true);
        setLoading(false);
        return;
      }
      
      const loadedConcepts: Concept[] = [];
      conceptsSnapshot.forEach(doc => {
        const data = doc.data();
        // Manejar tanto el formato de conceptos regulares como escolares
        if (data.conceptos && Array.isArray(data.conceptos)) {
          // Formato de documento con array de conceptos
          data.conceptos.forEach((concept: any) => {
            loadedConcepts.push({
              id: concept.id || doc.id + '_' + loadedConcepts.length,
              term: concept.término || concept.termino || concept.term || '',
              definition: concept.definición || concept.definicion || concept.definition || ''
            });
          });
        } else {
          // Formato de concepto individual
          loadedConcepts.push({
            id: doc.id,
            term: data.término || data.termino || data.term || '',
            definition: data.definición || data.definicion || data.definition || ''
          });
        }
      });
      
      if (loadedConcepts.length === 0) {
        console.log('❌ No hay conceptos válidos en el cuaderno');
        setNoReviewedConcepts(true);
        setLoading(false);
        return;
      }
      
      console.log('✅ Conceptos cargados del cuaderno:', loadedConcepts.length);
      setConcepts(loadedConcepts);
      
      // Start with 3 random concepts
      if (loadedConcepts.length >= 3) {
        console.log('🎲 Iniciando nueva ronda con conceptos del cuaderno');
        startNewRound(loadedConcepts);
      } else {
        console.log('❌ No hay suficientes conceptos para el juego (mínimo 3)');
        setNoReviewedConcepts(true);
      }
      
    } catch (error) {
      console.error('❌ Error cargando conceptos:', error);
      setNoReviewedConcepts(true);
    } finally {
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

  // Touch event handlers for mobile
  const handleTouchStart = (fragment: Fragment, e: React.TouchEvent) => {
    setTouchStartFragment(fragment);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && element.classList.contains('fragment-slot')) {
      const position = element.getAttribute('data-position');
      if (position) {
        setTouchTargetPosition(parseInt(position));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    
    if (!touchStartFragment || touchTargetPosition === null) {
      setTouchStartFragment(null);
      setTouchTargetPosition(null);
      return;
    }

    const targetFragment = fragments.find(f => f.currentPosition === touchTargetPosition);
    if (!targetFragment) {
      setTouchStartFragment(null);
      setTouchTargetPosition(null);
      return;
    }

    // Swap positions
    const newFragments = fragments.map(f => {
      if (f.id === touchStartFragment.id) {
        return { ...f, currentPosition: touchTargetPosition };
      } else if (f.id === targetFragment.id) {
        return { ...f, currentPosition: touchStartFragment.currentPosition };
      }
      return f;
    });

    setFragments(newFragments);
    setTouchStartFragment(null);
    setTouchTargetPosition(null);

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
      const updatedCorrectPuzzles = [...correctPuzzles, ...newCorrectPuzzles];
      setCorrectPuzzles(updatedCorrectPuzzles);
      console.log('✅ Puzzles correctos actualizados:', updatedCorrectPuzzles.length, '/', currentConcepts.length);
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
      <>
        <HeaderWithHamburger 
          title="Puzzle de Definiciones"
          subtitle={notebookTitle}
        />
        <div className="puzzle-game-container with-header-sidebar">
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
          title="Puzzle de Definiciones"
          subtitle={notebookTitle}
        />
        <div className="puzzle-game-container with-header-sidebar">
          <div className="no-concepts-message">
            <button className="back-button" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div className="empty-state">
              <i className="fas fa-book-open"></i>
              <h2>¡No hay suficientes conceptos!</h2>
              <p>Este cuaderno necesita al menos 3 conceptos para poder jugar.</p>
              <p>Asegúrate de que el cuaderno tenga conceptos agregados antes de jugar.</p>
              <button className="primary-button" onClick={onBack}>
                Volver
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const renderIntroModal = () => (
    <div className="puzzle-intro-overlay">
      <div className="puzzle-intro-modal">
        <div className="intro-header">
          <FontAwesomeIcon icon={faPuzzlePiece} className="intro-icon" />
          <h2>Puzzle de Definiciones</h2>
        </div>
        
        <div className="intro-content">
          <div className="intro-section">
            <h3>¿Cómo jugar?</h3>
            <ul>
              <li><i className="fas fa-puzzle-piece"></i> Arrastra los fragmentos para formar las definiciones correctas</li>
              <li><i className="fas fa-clock"></i> Completa cada puzzle lo más rápido posible</li>
              <li><i className="fas fa-fire"></i> Mantén un combo para obtener más puntos</li>
              <li><i className="fas fa-trophy"></i> Supera los 3 niveles para completar el juego</li>
            </ul>
          </div>
          
          <div className="intro-section">
            <h3>Sistema de puntuación</h3>
            <div className="scoring-info">
              <div className="score-item">
                <span className="score-points">+100</span>
                <span>Por puzzle correcto</span>
              </div>
              <div className="score-item">
                <span className="score-points">+50</span>
                <span>Bonus de velocidad</span>
              </div>
              <div className="score-item">
                <span className="score-points">x2</span>
                <span>Multiplicador de combo</span>
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
            onClick={() => {
              console.log('🎮 Botón "Comenzar Juego" presionado');
              console.log('📊 Estado actual - conceptsLoaded:', conceptsLoaded, 'loading:', loading);
              setShowIntro(false);
              if (!conceptsLoaded) {
                console.log('🔄 Llamando loadConcepts...');
                loadConcepts();
              } else {
                console.log('✅ Conceptos ya cargados, no se llama loadConcepts');
              }
            }}
          >
            <FontAwesomeIcon icon={faPuzzlePiece} />
            Comenzar Juego
          </button>
        </div>
      </div>
    </div>
  );

  if (showIntro) {
    return (
      <>
        <HeaderWithHamburger 
          title="Puzzle de Definiciones"
          subtitle={notebookTitle}
        />
        <div className="puzzle-game-container with-header-sidebar">
          {renderIntroModal()}
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderWithHamburger 
        title="Puzzle de Definiciones"
        subtitle={`${notebookTitle} - Nivel ${level} de 3`}
      />
      <div className="puzzle-game-container with-header-sidebar">
        <div className="puzzle-header">
          <button className="back-button" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
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
          <span>En posición: {(() => {
            // Contar fragmentos que están en la fila correcta (verdes)
            let correctFragments = 0;
            currentConcepts.forEach((concept, conceptIndex) => {
              // Calcular el rango de posiciones para este concepto
              let startPosition = 0;
              for (let i = 0; i < conceptIndex; i++) {
                const prevConceptFragments = fragments.filter(f => f.conceptId === currentConcepts[i].id);
                startPosition += prevConceptFragments.length;
              }
              const conceptFragments = fragments.filter(f => f.conceptId === concept.id);
              const endPosition = startPosition + conceptFragments.length;
              
              // Contar fragmentos de este concepto que están en su fila (verde)
              fragments.forEach(fragment => {
                if (fragment.conceptId === concept.id && 
                    fragment.currentPosition >= startPosition && 
                    fragment.currentPosition < endPosition) {
                  correctFragments++;
                }
              });
            });
            const totalFragments = fragments.length;
            return totalFragments > 0 ? Math.round((correctFragments / totalFragments) * 100) : 0;
          })()}%</span>
        </div>
        <div className="stat">
          <span>Nivel: {level}/3</span>
        </div>
        <button className="exit-button" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Salir</span>
        </button>
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
                {rowIndex === 0 && <div className="section-label">Concepto</div>}
                <h3>{concept.term}</h3>
                {correctPuzzles.includes(concept.id) && (
                  <FontAwesomeIcon icon={faCheckCircle} className="check-icon" />
                )}
              </div>
              
              <div className="fragments-section">
                {rowIndex === 0 && <div className="section-label">Definición</div>}
                <div className="fragments-container" style={{ gridTemplateColumns: `repeat(${fragmentCount}, 1fr)` }}>
                  {Array.from({ length: fragmentCount }).map((_, position) => {
                    const absolutePosition = startPosition + position;
                    const fragment = fragments.find(f => f.currentPosition === absolutePosition);
                    
                    return (
                      <div
                        key={`slot-${absolutePosition}`}
                        className="fragment-slot"
                        data-position={absolutePosition}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, absolutePosition)}
                      >
                        {fragment && (
                          <div
                            className={`fragment ${fragment.conceptId === concept.id ? 'correct-concept' : 'wrong-concept'}`}
                            draggable={!correctPuzzles.includes(fragment.conceptId)}
                            onDragStart={() => handleDragStart(fragment)}
                            onTouchStart={(e) => !correctPuzzles.includes(fragment.conceptId) && handleTouchStart(fragment, e)}
                            onTouchMove={(e) => !correctPuzzles.includes(fragment.conceptId) && handleTouchMove(e)}
                            onTouchEnd={(e) => !correctPuzzles.includes(fragment.conceptId) && handleTouchEnd(e)}
                          >
                            <span>{fragment.text}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {correctPuzzles.length === currentConcepts.length && currentConcepts.length > 0 && !gameCompleted && level < 3 && (
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
    </>
  );
};

export default PuzzleGame;