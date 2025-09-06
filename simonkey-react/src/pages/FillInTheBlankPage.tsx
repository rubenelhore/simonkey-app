import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { useStudyService } from '../hooks/useStudyService';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { UnifiedNotebookService } from '../services/unifiedNotebookService';
import { getNotebooks } from '../services/notebookService';
import { Concept, Notebook } from '../types/interfaces';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/FillInTheBlankPage.css';

interface GameConcept {
  id: string;
  concepto: string;
  definicion: string;
  término: string;
  definición: string;
}

interface BlankWord {
  word: string;
  position: number;
  isCorrect: boolean;
}

interface GameRound {
  concept: GameConcept;
  definition: string;
  blanks: BlankWord[];
  options: string[];
  selectedOptions: string[];
  isCompleted: boolean;
  isCorrect: boolean;
  timeLeft: number;
}

const FillInTheBlankPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService(isSchoolStudent ? 'school' : 'premium');
  
  // Estados para la selección de cuaderno
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loadingNotebooks, setLoadingNotebooks] = useState(true);
  const [conceptCount, setConceptCount] = useState<number>(10);
  const [showConceptSelector, setShowConceptSelector] = useState(false);
  
  // Estados del juego
  const [concepts, setConcepts] = useState<GameConcept[]>([]);
  const [currentRound, setCurrentRound] = useState<GameRound | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar cuadernos del usuario (solo la lista, sin conceptos)
  useEffect(() => {
    const loadNotebooks = async () => {
      if (!auth.currentUser) return;
      
      setLoadingNotebooks(true);
      try {
        const effectiveUserData = await getEffectiveUserId();
        const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        
        // Cargar cuadernos usando el servicio unificado
        const userNotebooks = await UnifiedNotebookService.getUserNotebooks(userId);
        
        // Solo mostrar cuadernos, sin validar conceptos aún
        const notebooksWithCount = userNotebooks.map(notebook => ({
          ...notebook,
          conceptCount: 0 // Valor temporal, se actualiza al seleccionar
        }));
        
        setNotebooks(notebooksWithCount);
      } catch (error) {
        console.error('Error loading notebooks:', error);
      }
      setLoadingNotebooks(false);
    };
    
    loadNotebooks();
  }, []);

  // Cargar conceptos solo cuando se hace click en "Comenzar Juego"
  const loadConcepts = async () => {
    if (!selectedNotebook || !auth.currentUser) return;
    
    setLoading(true);
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      // Cargar conceptos del cuaderno seleccionado
      const notebookConcepts = await studyService.getAllConceptsFromNotebook(userId, selectedNotebook.id);
      
      // Convertir conceptos al formato del juego y filtrar válidos
      const gameConcepts: GameConcept[] = notebookConcepts
        .map(concept => ({
          id: concept.id,
          concepto: concept.término,
          definicion: concept.definición,
          término: concept.término,
          definición: concept.definición
        }))
        .filter(concept => concept.definicion && concept.definicion.trim().length > 20);
      
      // Mezclar los conceptos aleatoriamente
      const shuffled = gameConcepts.sort(() => Math.random() - 0.5);
      const finalConcepts = shuffled.slice(0, conceptCount); // Tomar la cantidad seleccionada
      
      if (finalConcepts.length === 0) {
        setConcepts([]);
        setTotalRounds(0);
      } else {
        setConcepts(finalConcepts);
        setTotalRounds(finalConcepts.length);
      }
    } catch (error) {
      console.error('Error loading concepts:', error);
      setConcepts([]);
      setTotalRounds(0);
    }
    setLoading(false);
  };

  // Iniciar nueva ronda
  useEffect(() => {
    if (concepts.length > 0 && currentIndex < concepts.length && !gameOver) {
      startNewRound();
    } else if (currentIndex >= concepts.length && concepts.length > 0) {
      setGameOver(true);
    }
  }, [concepts, currentIndex]);

  // Timer para cada ronda
  useEffect(() => {
    if (currentRound && currentRound.timeLeft > 0 && !currentRound.isCompleted) {
      timerRef.current = setTimeout(() => {
        setCurrentRound(prev => prev ? { ...prev, timeLeft: prev.timeLeft - 1 } : null);
      }, 1000);
    } else if (currentRound && currentRound.timeLeft === 0 && !currentRound.isCompleted) {
      // Se acabó el tiempo
      handleTimeOut();
    }
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentRound?.timeLeft, currentRound?.isCompleted]);

  const startNewRound = () => {
    const concept = concepts[currentIndex];
    
    // Validar que el concepto tenga definición
    if (!concept.definicion || concept.definicion.trim() === '') {
      // Si no hay definición, saltar al siguiente concepto
      setCurrentIndex(currentIndex + 1);
      return;
    }
    
    const definition = concept.definicion;
    
    // Palabras importantes a quitar (1-4 palabras)
    const words = definition.split(' ');
    const numBlanks = Math.min(Math.floor(Math.random() * 3) + 2, Math.floor(words.length * 0.3)); // 2-4 blancos
    
    // Seleccionar palabras para hacer blancos (evitar artículos y preposiciones)
    const importantWords = words.filter((word, index) => {
      const cleaned = word.replace(/[.,;:!?]/g, '').toLowerCase();
      const skipWords = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'en', 'por', 'para', 'con', 'y', 'o', 'que', 'es', 'son'];
      return cleaned.length > 3 && !skipWords.includes(cleaned);
    });
    
    // Validar que haya palabras importantes suficientes
    if (importantWords.length < 2) {
      // Si no hay suficientes palabras importantes, saltar al siguiente concepto
      setCurrentIndex(currentIndex + 1);
      return;
    }
    
    // Seleccionar palabras aleatorias para blancos
    const blanks: BlankWord[] = [];
    const selectedIndices = new Set<number>();
    
    const actualNumBlanks = Math.min(numBlanks, importantWords.length);
    
    for (let i = 0; i < actualNumBlanks; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * importantWords.length);
      } while (selectedIndices.has(randomIndex));
      
      selectedIndices.add(randomIndex);
      const word = importantWords[randomIndex];
      const position = words.indexOf(word);
      
      blanks.push({
        word: word.replace(/[.,;:!?]/g, ''),
        position,
        isCorrect: true
      });
    }
    
    // Crear definición con blancos
    let definitionWithBlanks = definition;
    blanks.sort((a, b) => b.position - a.position); // Ordenar de mayor a menor para reemplazar correctamente
    blanks.forEach(blank => {
      const wordInText = words[blank.position];
      definitionWithBlanks = definitionWithBlanks.replace(wordInText, '_____');
    });
    
    // Generar opciones incorrectas
    const correctWords = blanks.map(b => b.word);
    const incorrectWords = generateIncorrectOptions(correctWords, definition);
    const allOptions = [...correctWords, ...incorrectWords].sort(() => Math.random() - 0.5);
    
    setCurrentRound({
      concept,
      definition: definitionWithBlanks,
      blanks,
      options: allOptions,
      selectedOptions: [],
      isCompleted: false,
      isCorrect: false,
      timeLeft: 10
    });
  };

  const generateIncorrectOptions = (correctWords: string[], definition: string): string[] => {
    // Lista de palabras distractoras comunes
    const distractors = [
      'proceso', 'sistema', 'método', 'función', 'elemento', 'componente', 
      'resultado', 'objetivo', 'principio', 'concepto', 'estructura', 'mecanismo',
      'desarrollo', 'evolución', 'transformación', 'análisis', 'síntesis', 'evaluación',
      'característica', 'propiedad', 'atributo', 'cualidad', 'aspecto', 'factor'
    ];
    
    // Filtrar distractores que no estén ya en la definición o en las palabras correctas
    const availableDistractors = distractors.filter(word => 
      !definition.toLowerCase().includes(word.toLowerCase()) &&
      !correctWords.some(correct => correct.toLowerCase() === word.toLowerCase())
    );
    
    // Seleccionar 2-4 distractores
    const numDistractors = Math.min(Math.floor(Math.random() * 3) + 2, availableDistractors.length);
    const selected: string[] = [];
    
    for (let i = 0; i < numDistractors; i++) {
      const randomIndex = Math.floor(Math.random() * availableDistractors.length);
      const word = availableDistractors.splice(randomIndex, 1)[0];
      selected.push(word);
    }
    
    return selected;
  };

  const handleOptionClick = (option: string) => {
    if (!currentRound || currentRound.isCompleted) return;
    
    const newSelectedOptions = currentRound.selectedOptions.includes(option)
      ? currentRound.selectedOptions.filter(o => o !== option)
      : [...currentRound.selectedOptions, option];
    
    setCurrentRound({ ...currentRound, selectedOptions: newSelectedOptions });
    
    // Verificar si ha seleccionado todas las opciones necesarias
    if (newSelectedOptions.length === currentRound.blanks.length) {
      checkAnswer(newSelectedOptions);
    }
  };

  const checkAnswer = (selectedOptions: string[]) => {
    if (!currentRound) return;
    
    const correctWords = currentRound.blanks.map(b => b.word);
    const isCorrect = selectedOptions.length === correctWords.length &&
      selectedOptions.every(option => correctWords.includes(option));
    
    setCurrentRound({ 
      ...currentRound, 
      isCompleted: true, 
      isCorrect 
    });
    
    if (isCorrect) {
      setScore(score + 10 + Math.floor(currentRound.timeLeft / 2)); // Bonus por tiempo restante
      setStreak(streak + 1);
      if (streak + 1 > maxStreak) setMaxStreak(streak + 1);
    } else {
      setStreak(0);
    }
    
    // Avanzar después de 2 segundos
    setTimeout(() => {
      setCurrentIndex(currentIndex + 1);
    }, 2000);
  };

  const handleTimeOut = () => {
    if (!currentRound) return;
    
    setCurrentRound({ 
      ...currentRound, 
      isCompleted: true, 
      isCorrect: false 
    });
    
    setStreak(0);
    
    // Avanzar después de 2 segundos
    setTimeout(() => {
      setCurrentIndex(currentIndex + 1);
    }, 2000);
  };

  const handlePlayAgain = () => {
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setGameOver(false);
    const shuffled = concepts.sort(() => Math.random() - 0.5);
    setConcepts(shuffled);
  };

  const handleSelectNotebook = (notebook: Notebook) => {
    setSelectedNotebook(notebook);
    setShowConceptSelector(true);
  };

  const handleStartGame = async () => {
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setGameOver(false);
    setShowConceptSelector(false);
    
    // Cargar conceptos ahora
    await loadConcepts();
  };

  const handleBackToNotebooks = () => {
    setSelectedNotebook(null);
    setConcepts([]);
    setCurrentRound(null);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setGameOver(false);
    setShowConceptSelector(false);
  };

  // Pantalla de selección de cuaderno
  if (!selectedNotebook) {
    return (
      <div className="fill-blank-container">
        <HeaderWithHamburger title="Fill in the Blank" />
        
        <div className="notebook-selection">
          <div className="selection-header">
            <h1>Selecciona un Cuaderno</h1>
            <p>Elige el cuaderno con el que quieres practicar</p>
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
              <p>Necesitas tener cuadernos con al menos 5 conceptos para jugar.</p>
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
                  <div className="notebook-icon">📓</div>
                  <h3>{notebook.title || 'Sin título'}</h3>
                  {notebook.category && (
                    <p className="notebook-subject">{notebook.category}</p>
                  )}
                  <div className="notebook-stats">
                    <span>📚 Cuaderno disponible</span>
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

  // Pantalla de selección de cantidad de conceptos
  if (selectedNotebook && showConceptSelector) {
    return (
      <div className="fill-blank-container">
        <HeaderWithHamburger title="Fill in the Blank" />
        
        <div className="concept-selector">
          <div className="selection-header">
            <h1>¿Cuántos conceptos quieres estudiar?</h1>
            <p>Cuaderno: <strong>{selectedNotebook.title}</strong></p>
          </div>
          
          <div className="concept-count-options">
            {[5, 10, 15, 20].map(count => (
              <button
                key={count}
                className={`count-option ${conceptCount === count ? 'selected' : ''}`}
                onClick={() => setConceptCount(count)}
              >
                <span className="count-number">{count}</span>
                <span className="count-label">conceptos</span>
              </button>
            ))}
          </div>
          
          <div className="selector-actions">
            <button onClick={handleStartGame} className="btn-start">
              Comenzar Juego
            </button>
            <button onClick={() => setSelectedNotebook(null)} className="btn-back">
              Cambiar Cuaderno
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fill-blank-container">
        <HeaderWithHamburger title={`Fill in the Blank - ${selectedNotebook?.title || ''}`} />
        <div className="loading-state">
          <div className="loader"></div>
          <p>Cargando conceptos de {selectedNotebook.title}...</p>
        </div>
      </div>
    );
  }

  if (concepts.length === 0 && selectedNotebook) {
    return (
      <div className="fill-blank-container">
        <HeaderWithHamburger title={`Fill in the Blank - ${selectedNotebook?.title || ''}`} />
        <div className="empty-state">
          <span className="empty-icon">📝</span>
          <h2>No hay conceptos válidos</h2>
          <p>Este cuaderno no tiene conceptos con definiciones suficientemente largas para el juego.</p>
          <button onClick={handleBackToNotebooks} className="btn-primary">
            Elegir otro cuaderno
          </button>
        </div>
      </div>
    );
  }

  if (gameOver) {
    const percentage = Math.round((score / (totalRounds * 15)) * 100); // Max 15 puntos por ronda
    
    return (
      <div className="fill-blank-container">
        <HeaderWithHamburger title={`Fill in the Blank - ${selectedNotebook?.title || ''}`} />
        <div className="game-over-screen">
          <h1>¡Juego Terminado!</h1>
          
          <div className="final-stats">
            <div className="stat-card">
              <span className="stat-icon">🏆</span>
              <span className="stat-value">{score}</span>
              <span className="stat-label">Puntos Totales</span>
            </div>
            
            <div className="stat-card">
              <span className="stat-icon">📊</span>
              <span className="stat-value">{percentage}%</span>
              <span className="stat-label">Precisión</span>
            </div>
            
            <div className="stat-card">
              <span className="stat-icon">🔥</span>
              <span className="stat-value">{maxStreak}</span>
              <span className="stat-label">Mejor Racha</span>
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
    <div className="fill-blank-container">
      <HeaderWithHamburger title={`Fill in the Blank - ${selectedNotebook?.title || ''}`} />
      
      <div className="game-header">
        <div className="game-stats">
          <div className="stat">
            <span className="stat-label">Ronda</span>
            <span className="stat-value">{currentIndex + 1}/{totalRounds}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Puntos</span>
            <span className="stat-value">{score}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Racha</span>
            <span className="stat-value">{streak} 🔥</span>
          </div>
        </div>
        
        {currentRound && (
          <div className={`timer ${currentRound.timeLeft <= 3 ? 'timer-warning' : ''}`}>
            <span className="timer-icon">⏱️</span>
            <span className="timer-value">{currentRound.timeLeft}s</span>
          </div>
        )}
      </div>
      
      {currentRound && (
        <div className="game-content">
          <div className="concept-card">
            <h2 className="concept-title">{currentRound.concept.concepto}</h2>
            
            <div className={`definition-box ${currentRound.isCompleted ? (currentRound.isCorrect ? 'correct' : 'incorrect') : ''}`}>
              <p className="definition-text">{currentRound.definition}</p>
              
              {currentRound.isCompleted && (
                <div className="feedback">
                  {currentRound.isCorrect ? (
                    <>
                      <span className="feedback-icon">✅</span>
                      <span className="feedback-text">¡Correcto! +{10 + Math.floor(currentRound.timeLeft / 2)} puntos</span>
                    </>
                  ) : (
                    <>
                      <span className="feedback-icon">❌</span>
                      <span className="feedback-text">
                        Respuestas correctas: {currentRound.blanks.map(b => b.word).join(', ')}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            <div className="instructions">
              <p>Selecciona las {currentRound.blanks.length} palabras que completan la definición:</p>
            </div>
            
            <div className="options-grid">
              {currentRound.options.map((option, index) => {
                const isSelected = currentRound.selectedOptions.includes(option);
                const isCorrect = currentRound.blanks.some(b => b.word === option);
                const showResult = currentRound.isCompleted;
                
                return (
                  <button
                    key={index}
                    className={`option-button 
                      ${isSelected ? 'selected' : ''} 
                      ${showResult && isCorrect ? 'correct' : ''}
                      ${showResult && isSelected && !isCorrect ? 'incorrect' : ''}
                    `}
                    onClick={() => handleOptionClick(option)}
                    disabled={currentRound.isCompleted}
                  >
                    {option}
                    {showResult && isCorrect && <span className="option-icon">✓</span>}
                    {showResult && isSelected && !isCorrect && <span className="option-icon">✗</span>}
                  </button>
                );
              })}
            </div>
            
            <div className="selected-count">
              {currentRound.selectedOptions.length}/{currentRound.blanks.length} palabras seleccionadas
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FillInTheBlankPage;