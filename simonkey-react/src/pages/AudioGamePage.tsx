import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { useStudyService } from '../hooks/useStudyService';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { UnifiedNotebookService } from '../services/unifiedNotebookService';
import { gamePointsService } from '../services/gamePointsService';
import { Concept, Notebook, StudyIntensity } from '../types/interfaces';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/AudioGamePage.css';

interface GameConcept {
  id: string;
  término: string;
  definición: string;
}

interface GameRound {
  concepts: GameConcept[];
  correctOrder: number[];
  selectedOrder: number[];
  isCompleted: boolean;
  isCorrect: boolean;
  options: GameConcept[];
}

const AudioGamePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService(isSchoolStudent ? 'school' : 'premium');
  
  // Estados para la selección de cuaderno
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loadingNotebooks, setLoadingNotebooks] = useState(true);
  const [studyIntensity, setStudyIntensity] = useState<StudyIntensity>(StudyIntensity.WARM_UP);
  const [availableConcepts, setAvailableConcepts] = useState<number>(0);
  const [loadingConceptsData, setLoadingConceptsData] = useState<boolean>(true);
  const [showConceptSelector, setShowConceptSelector] = useState(false);
  
  // Estados del juego
  const [concepts, setConcepts] = useState<GameConcept[]>([]);
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  
  // Estados del audio
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCompleted, setAudioCompleted] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  
  // Referencias
  const speechSynthesis = useRef<SpeechSynthesis | null>(null);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);

  // Función helper para obtener el número de rondas según la intensidad
  const getRoundCountFromIntensity = (intensity: StudyIntensity): number => {
    switch (intensity) {
      case StudyIntensity.WARM_UP:
        return 1;
      case StudyIntensity.PROGRESS:
        return 2;
      case StudyIntensity.ROCKET:
        return 3;
      default:
        return 1;
    }
  };

  // Función para contar conceptos disponibles en un cuaderno
  const countAvailableConcepts = async (notebookId: string, userId: string) => {
    try {
      setLoadingConceptsData(true);
      const notebookConcepts = await studyService.getAllConceptsFromNotebook(userId, notebookId);
      
      // Filtrar conceptos válidos para Audio Game (definiciones largas)
      const validConcepts = notebookConcepts.filter(concept => 
        concept.definición && concept.definición.trim().length > 10
      );
      
      setAvailableConcepts(validConcepts.length);
    } catch (error) {
      console.error('Error counting concepts:', error);
      setAvailableConcepts(0);
    } finally {
      setLoadingConceptsData(false);
    }
  };

  // Cargar cuadernos del usuario
  useEffect(() => {
    const loadNotebooks = async () => {
      if (!auth.currentUser) return;
      
      setLoadingNotebooks(true);
      try {
        const effectiveUserData = await getEffectiveUserId();
        const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        
        const userNotebooks = await UnifiedNotebookService.getUserNotebooks(userId);
        
        const notebooksWithCount = userNotebooks.map(notebook => ({
          ...notebook,
          conceptCount: 0
        }));
        
        setNotebooks(notebooksWithCount);
        
        // Si viene desde /study con un cuaderno preseleccionado
        const state = location.state as { notebookId?: string; notebookTitle?: string } | null;
        if (state?.notebookId) {
          const preselectedNotebook = notebooksWithCount.find(nb => nb.id === state.notebookId);
          if (preselectedNotebook) {
            setSelectedNotebook(preselectedNotebook);
            setShowConceptSelector(true);
            await countAvailableConcepts(preselectedNotebook.id, userId);
          }
        }
      } catch (error) {
        console.error('Error loading notebooks:', error);
      }
      setLoadingNotebooks(false);
    };
    
    loadNotebooks();
  }, [location.state]);

  // Inicializar Speech Synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.current = window.speechSynthesis;
    }
    
    return () => {
      if (speechSynthesis.current) {
        speechSynthesis.current.cancel();
      }
    };
  }, []);

  // Cargar conceptos y preparar juego
  const loadConcepts = async () => {
    if (!selectedNotebook || !auth.currentUser) return;
    
    setLoading(true);
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      const notebookConcepts = await studyService.getAllConceptsFromNotebook(userId, selectedNotebook.id);
      
      // Convertir y filtrar conceptos válidos
      const gameConcepts: GameConcept[] = notebookConcepts
        .map(concept => ({
          id: concept.id,
          término: concept.término,
          definición: concept.definición
        }))
        .filter(concept => concept.definición && concept.definición.trim().length > 10);
      
      console.log('🎮 Audio Game: Total concepts loaded:', notebookConcepts.length);
      console.log('🎮 Audio Game: Valid concepts after filtering:', gameConcepts.length);
      console.log('🎮 Audio Game: Filtered concepts:', gameConcepts.map(c => ({ término: c.término, defLength: c.definición?.length })));
      
      // Determinar cuántos conceptos necesitamos según la intensidad
      const conceptsNeeded = studyIntensity === StudyIntensity.WARM_UP ? 4 : 
                             studyIntensity === StudyIntensity.PROGRESS ? 8 : 12;
      
      // Mezclar conceptos aleatoriamente
      const shuffled = gameConcepts.sort(() => Math.random() - 0.5);
      
      // Tomar exactamente los conceptos que necesitamos para esta intensidad
      const selectedConcepts = shuffled.slice(0, conceptsNeeded);
      
      const roundCount = getRoundCountFromIntensity(studyIntensity);
      
      if (selectedConcepts.length < conceptsNeeded) {
        // No hay suficientes conceptos para esta intensidad
        setConcepts([]);
        setTotalRounds(0);
      } else {
        setConcepts(selectedConcepts);
        setTotalRounds(roundCount);
        startNewRound(selectedConcepts, 0);
      }
    } catch (error) {
      console.error('Error loading concepts:', error);
      setConcepts([]);
      setTotalRounds(0);
    }
    setLoading(false);
  };

  // Crear nueva ronda
  const startNewRound = (allConcepts: GameConcept[], roundIndex: number) => {
    // Mezclar conceptos para cada ronda para evitar patrones predecibles
    const shuffledConcepts = [...allConcepts].sort(() => Math.random() - 0.5);
    
    // Seleccionar 3 conceptos para esta ronda
    const roundConcepts = shuffledConcepts.slice(0, 3);
    
    // Crear opciones: 3 correctas + 1 incorrecta
    const incorrectConcept = shuffledConcepts.find(c => 
      !roundConcepts.some(rc => rc.id === c.id)
    );
    
    if (!incorrectConcept || roundConcepts.length < 3) {
      setGameOver(true);
      return;
    }
    
    const options = [...roundConcepts, incorrectConcept].sort(() => Math.random() - 0.5);
    
    setCurrentRound({
      concepts: roundConcepts,
      correctOrder: [0, 1, 2], // El orden correcto siempre es 0, 1, 2 (según el audio)
      selectedOrder: [],
      isCompleted: false,
      isCorrect: false,
      options
    });
    
    setAudioCompleted(false);
    setCurrentAudioIndex(0);
  };

  // Reproducir audio de las definiciones
  const playAudio = () => {
    if (!currentRound || !speechSynthesis.current) return;
    
    setIsPlayingAudio(true);
    setCurrentAudioIndex(0);
    
    const playNextDefinition = (index: number) => {
      if (index >= currentRound.concepts.length) {
        setIsPlayingAudio(false);
        setAudioCompleted(true);
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(currentRound.concepts[index].definición);
      utterance.lang = 'es-ES';
      utterance.rate = 0.9;
      
      utterance.onend = () => {
        setCurrentAudioIndex(index + 1);
        // Pausa de 2 segundos entre definiciones
        setTimeout(() => {
          playNextDefinition(index + 1);
        }, 2000);
      };
      
      utterance.onerror = () => {
        console.error('Error en texto a voz');
        setIsPlayingAudio(false);
        setAudioCompleted(true);
      };
      
      currentUtterance.current = utterance;
      speechSynthesis.current!.speak(utterance);
    };
    
    playNextDefinition(0);
  };

  // Manejar selección de opción
  const handleOptionSelect = (selectedConcept: GameConcept) => {
    if (!currentRound || !audioCompleted || currentRound.isCompleted) return;
    
    // Encontrar el índice del concepto seleccionado en las opciones
    const optionIndex = currentRound.options.findIndex(opt => opt.id === selectedConcept.id);
    if (optionIndex === -1) return;
    
    const newSelectedOrder = [...currentRound.selectedOrder, optionIndex];
    
    setCurrentRound({
      ...currentRound,
      selectedOrder: newSelectedOrder
    });
    
    // Si ya seleccionó 3 conceptos, evaluar respuesta
    if (newSelectedOrder.length === 3) {
      evaluateAnswer(newSelectedOrder);
    }
  };

  // Evaluar respuesta
  const evaluateAnswer = (selectedOrder: number[]) => {
    if (!currentRound) return;
    
    // Verificar que los 3 conceptos seleccionados correspondan a los del audio
    // y que estén en el orden correcto
    const isCorrect = selectedOrder.length === 3 &&
      selectedOrder.every((optionIdx, position) => {
        const selectedConcept = currentRound.options[optionIdx];
        return selectedConcept.id === currentRound.concepts[position].id;
      });
    
    setCurrentRound({
      ...currentRound,
      selectedOrder,
      isCompleted: true,
      isCorrect
    });
    
    if (isCorrect) {
      setScore(score + 100); // 100 puntos por respuesta correcta
    }
    
    // Avanzar a la siguiente ronda después de 3 segundos
    setTimeout(() => {
      if (currentRoundIndex + 1 >= totalRounds) {
        finishGame();
      } else {
        setCurrentRoundIndex(currentRoundIndex + 1);
        startNewRound(concepts, currentRoundIndex + 1);
      }
    }, 3000);
  };

  // Finalizar juego
  const finishGame = async () => {
    setGameOver(true);
    await saveGameScore(score);
  };

  // Guardar puntos del juego
  const saveGameScore = async (finalScore: number) => {
    if (!selectedNotebook || !auth.currentUser || finalScore === 0) return;
    
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      const gameId = `audio_game_${selectedNotebook.id}_${Date.now()}`;
      
      let bonusType: 'perfect' | 'speed' | 'streak' | 'first_try' | undefined;
      const maxPossibleScore = totalRounds * 100;
      const percentage = (finalScore / maxPossibleScore) * 100;
      
      if (percentage >= 100) {
        bonusType = 'perfect';
      } else if (percentage >= 80) {
        bonusType = 'streak';
      }
      
      const result = await gamePointsService.addGamePoints(
        userId,
        selectedNotebook.id,
        gameId,
        'Audio Game',
        finalScore,
        bonusType
      );
      
      console.log('Puntos guardados:', result);
    } catch (error) {
      console.error('Error guardando puntos:', error);
    }
  };

  const handleSelectNotebook = async (notebook: Notebook) => {
    setSelectedNotebook(notebook);
    setShowConceptSelector(true);
    
    if (auth.currentUser) {
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      await countAvailableConcepts(notebook.id, userId);
    }
  };

  const handleStartGame = async () => {
    setCurrentRoundIndex(0);
    setScore(0);
    setGameOver(false);
    setShowConceptSelector(false);
    await loadConcepts();
  };

  const handlePlayAgain = () => {
    setCurrentRoundIndex(0);
    setScore(0);
    setGameOver(false);
    handleStartGame();
  };

  const handleBackToNotebooks = () => {
    setSelectedNotebook(null);
    setConcepts([]);
    setCurrentRound(null);
    setCurrentRoundIndex(0);
    setScore(0);
    setGameOver(false);
    setShowConceptSelector(false);
  };

  // Pantalla de selección de cuaderno
  if (!selectedNotebook) {
    return (
      <div className="audio-game-container">
        <HeaderWithHamburger title="Audio Game" />
        
        <div className="notebook-selection">
          <div className="selection-header">
            <h1>Selecciona un Cuaderno</h1>
            <p>Elige el cuaderno para escuchar definiciones y adivinar conceptos</p>
          </div>
          
          {loadingNotebooks ? (
            <div className="loading-state">
              <div className="loader"></div>
              <p>Cargando cuadernos...</p>
            </div>
          ) : notebooks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📚</span>
              <h2>No hay cuadernos disponibles</h2>
              <p>Necesitas tener cuadernos con al menos 12 conceptos para jugar.</p>
              <button onClick={() => navigate('/notebooks')} className="btn-primary">
                Ir a Biblioteca
              </button>
            </div>
          ) : (
            <div className="notebooks-grid">
              {notebooks.map((notebook) => (
                <div
                  key={notebook.id}
                  className="notebook-card"
                  onClick={() => handleSelectNotebook(notebook)}
                >
                  <div className="notebook-icon">🎧</div>
                  <h3>{notebook.title || 'Sin título'}</h3>
                  {notebook.category && (
                    <p className="notebook-subject">{notebook.category}</p>
                  )}
                  <div className="notebook-stats">
                    <span>🎯 Audio disponible</span>
                  </div>
                  <button className="btn-select">Seleccionar</button>
                </div>
              ))}
            </div>
          )}
          
          <button onClick={() => navigate('/development')} className="btn-back">
            Volver a Development
          </button>
        </div>
      </div>
    );
  }

  // Pantalla de selección de intensidad
  if (selectedNotebook && showConceptSelector) {
    return (
      <div className="audio-game-container">
        <HeaderWithHamburger title="Audio Game" />
        
        <div className="concept-selector smart-study-modal">
          <div className="selection-header">
            <h1>Selecciona la intensidad de audio</h1>
            <p>Cuaderno: <strong>{selectedNotebook.title}</strong></p>
            {loadingConceptsData && <p className="loading-concepts">Contando conceptos disponibles...</p>}
          </div>
          
          <div className="intensity-options-horizontal" style={{ opacity: loadingConceptsData ? 0.6 : 1 }}>
            <div 
              className={`intensity-item-horizontal ${studyIntensity === StudyIntensity.WARM_UP ? 'selected' : ''} ${!loadingConceptsData && availableConcepts < 4 ? 'disabled' : ''}`}
              onClick={() => !loadingConceptsData && availableConcepts >= 4 && setStudyIntensity(StudyIntensity.WARM_UP)}
              title={!loadingConceptsData && availableConcepts < 4 ? `Requiere 4 conceptos (tienes ${availableConcepts} disponibles)` : ''}
            >
              <i className="fas fa-headphones"></i>
              <div className="intensity-content">
                <h3>Escucha Fácil</h3>
                <span className="intensity-count">1 ronda • 4 conceptos</span>
                <p>Audio relajado</p>
              </div>
              {studyIntensity === StudyIntensity.WARM_UP && <i className="fas fa-check-circle check-icon"></i>}
            </div>
            
            <div 
              className={`intensity-item-horizontal ${studyIntensity === StudyIntensity.PROGRESS ? 'selected' : ''} ${!loadingConceptsData && availableConcepts < 8 ? 'disabled' : ''}`}
              onClick={() => !loadingConceptsData && availableConcepts >= 8 && setStudyIntensity(StudyIntensity.PROGRESS)}
              title={!loadingConceptsData && availableConcepts < 8 ? `Requiere 8 conceptos (tienes ${availableConcepts} disponibles)` : ''}
            >
              <i className="fas fa-volume-up"></i>
              <div className="intensity-content">
                <h3>Audio Normal</h3>
                <span className="intensity-count">2 rondas • 8 conceptos</span>
                <p>Desafío balanceado</p>
              </div>
              {studyIntensity === StudyIntensity.PROGRESS && <i className="fas fa-check-circle check-icon"></i>}
            </div>
            
            <div 
              className={`intensity-item-horizontal ${studyIntensity === StudyIntensity.ROCKET ? 'selected' : ''} ${!loadingConceptsData && availableConcepts < 12 ? 'disabled' : ''}`}
              onClick={() => !loadingConceptsData && availableConcepts >= 12 && setStudyIntensity(StudyIntensity.ROCKET)}
              title={!loadingConceptsData && availableConcepts < 12 ? `Requiere 12 conceptos (tienes ${availableConcepts} disponibles)` : ''}
            >
              <i className="fas fa-rocket"></i>
              <div className="intensity-content">
                <h3>Audio Intenso</h3>
                <span className="intensity-count">3 rondas • 12 conceptos</span>
                <p>Máximo desafío</p>
              </div>
              {studyIntensity === StudyIntensity.ROCKET && <i className="fas fa-check-circle check-icon"></i>}
            </div>
          </div>
          
          <div className="selector-actions">
            <button 
              onClick={handleStartGame} 
              className="btn-start"
              disabled={loadingConceptsData || availableConcepts < (studyIntensity === StudyIntensity.WARM_UP ? 4 : studyIntensity === StudyIntensity.PROGRESS ? 8 : 12)}
            >
              {loadingConceptsData ? 'Cargando...' : 'Comenzar Audio Game'}
            </button>
            <button onClick={() => setSelectedNotebook(null)} className="btn-back">
              Cambiar Cuaderno
            </button>
          </div>
          
          {!loadingConceptsData && (
            <div className="concepts-info">
              <p>Conceptos disponibles en este cuaderno: <strong>{availableConcepts}</strong></p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="audio-game-container">
        <HeaderWithHamburger title={`Audio Game - ${selectedNotebook?.title || ''}`} />
        <div className="loading-state">
          <div className="loader"></div>
          <p>Preparando audio de {selectedNotebook.title}...</p>
        </div>
      </div>
    );
  }

  if (concepts.length === 0 && selectedNotebook) {
    return (
      <div className="audio-game-container">
        <HeaderWithHamburger title={`Audio Game - ${selectedNotebook?.title || ''}`} />
        <div className="empty-state">
          <span className="empty-icon">🎧</span>
          <h2>No hay suficientes conceptos</h2>
          <p>Este cuaderno necesita al menos 12 conceptos con definiciones para el juego de audio.</p>
          <button onClick={handleBackToNotebooks} className="btn-primary">
            Elegir otro cuaderno
          </button>
        </div>
      </div>
    );
  }

  if (gameOver) {
    const maxPossibleScore = totalRounds * 100;
    const percentage = Math.round((score / maxPossibleScore) * 100);
    
    return (
      <div className="audio-game-container">
        <HeaderWithHamburger title={`Audio Game - ${selectedNotebook?.title || ''}`} />
        <div className="game-over-screen">
          <h1>¡Audio Game Completado! 🎧</h1>
          
          <div className="final-stats">
            <div className="stat-card">
              <span className="stat-icon">🏆</span>
              <span className="stat-value">{score}</span>
              <span className="stat-label">Puntos Totales</span>
            </div>
            
            <div className="stat-card">
              <span className="stat-icon">📊</span>
              <span className="stat-value">{percentage}%</span>
              <span className="stat-label">Precisión de Audio</span>
            </div>
            
            <div className="stat-card">
              <span className="stat-icon">🎵</span>
              <span className="stat-value">{totalRounds}</span>
              <span className="stat-label">Rondas Completadas</span>
            </div>
          </div>
          
          <div className="game-over-actions">
            <button onClick={handlePlayAgain} className="btn-play-again">
              Jugar de Nuevo
            </button>
            <button onClick={handleBackToNotebooks} className="btn-secondary">
              Cambiar Cuaderno
            </button>
            <button onClick={() => navigate('/development')} className="btn-back">
              Volver a Development
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-game-container">
      <HeaderWithHamburger title={`Audio Game - ${selectedNotebook?.title || ''}`} />
      
      <div className="game-header">
        <div className="game-stats">
          <div className="stat">
            <span className="stat-label">Ronda</span>
            <span className="stat-value">{currentRoundIndex + 1}/{totalRounds}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Puntos</span>
            <span className="stat-value">{score}</span>
          </div>
        </div>
      </div>
      
      {currentRound && (
        <div className="game-content">
          <div className="audio-section">
            <div className="audio-controls">
              {!audioCompleted ? (
                <button 
                  className={`audio-button ${isPlayingAudio ? 'playing' : ''}`}
                  onClick={playAudio}
                  disabled={isPlayingAudio}
                >
                  {isPlayingAudio ? (
                    <>
                      <i className="fas fa-volume-up"></i>
                      Reproduciendo... ({currentAudioIndex + 1}/3)
                    </>
                  ) : (
                    <>
                      <i className="fas fa-play"></i>
                      Escuchar Definiciones
                    </>
                  )}
                </button>
              ) : (
                <div className="audio-completed">
                  <i className="fas fa-check-circle"></i>
                  Audio completado - ¡Selecciona los conceptos en orden!
                </div>
              )}
            </div>
            
            <div className="instructions">
              {!audioCompleted ? (
                <p>Escucha las 3 definiciones y memoriza el orden en que aparecen.</p>
              ) : (
                <p>Selecciona los 3 conceptos en el <strong>mismo orden</strong> que escuchaste.</p>
              )}
            </div>
          </div>
          
          <div className="selection-section">
            <div className="selected-order">
              <h3>Tu selección:</h3>
              <div className="order-display">
                {[1, 2, 3].map(position => (
                  <div key={position} className="order-slot">
                    <div className="order-number">{position}</div>
                    <div className="order-concept">
                      {currentRound.selectedOrder[position - 1] !== undefined ? 
                        currentRound.options[currentRound.selectedOrder[position - 1]].término :
                        '?'
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="options-grid">
              {currentRound.options.map((concept, index) => {
                const isSelected = currentRound.selectedOrder.includes(index);
                const isCorrect = currentRound.isCompleted && currentRound.concepts.some(c => c.id === concept.id);
                const isIncorrect = currentRound.isCompleted && isSelected && !isCorrect;
                
                return (
                  <button
                    key={concept.id}
                    className={`concept-option 
                      ${isSelected ? 'selected' : ''} 
                      ${currentRound.isCompleted && isCorrect ? 'correct' : ''}
                      ${isIncorrect ? 'incorrect' : ''}
                    `}
                    onClick={() => handleOptionSelect(concept)}
                    disabled={!audioCompleted || currentRound.isCompleted || isSelected}
                  >
                    {concept.término}
                    {currentRound.isCompleted && isCorrect && <i className="fas fa-check"></i>}
                    {isIncorrect && <i className="fas fa-times"></i>}
                  </button>
                );
              })}
            </div>
            
            {currentRound.isCompleted && (
              <div className={`result-feedback ${currentRound.isCorrect ? 'correct' : 'incorrect'}`}>
                {currentRound.isCorrect ? (
                  <div className="feedback-correct">
                    <i className="fas fa-check-circle"></i>
                    ¡Perfecto! Orden correcto - +100 puntos
                  </div>
                ) : (
                  <div className="feedback-incorrect">
                    <i className="fas fa-times-circle"></i>
                    Orden incorrecto. El orden era:
                    <div className="correct-order-display">
                      {currentRound.concepts.map((concept, idx) => (
                        <span key={concept.id} className="correct-item">
                          {idx + 1}. {concept.término}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioGamePage;