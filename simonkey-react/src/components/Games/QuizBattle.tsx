import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFistRaised, faArrowLeft, faClock, faHeart, faBolt, faShield } from '@fortawesome/free-solid-svg-icons';
import { useGamePoints } from '../../hooks/useGamePoints';
import { useStudyService } from '../../hooks/useStudyService';
import { useUserType } from '../../hooks/useUserType';
import { getEffectiveUserId } from '../../utils/getEffectiveUserId';
import '../../styles/QuizBattle.css';

interface Concept {
  id: string;
  term: string;
  definition: string;
}

interface Question {
  id: string;
  definition: string;
  correctAnswer: string;
  options: string[];
}

interface Power {
  type: 'critical' | 'shield' | 'heal';
  icon: any;
  name: string;
  active: boolean;
}

interface QuizBattleProps {
  notebookId: string;
  notebookTitle: string;
  onBack: () => void;
}

const QuizBattle: React.FC<QuizBattleProps> = ({ notebookId, notebookTitle, onBack }) => {
  // Game state
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [playerHP, setPlayerHP] = useState(60); // Reduced HP for shorter battles
  const [enemyHP, setEnemyHP] = useState(60);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(10);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null);
  const [enemyThinking, setEnemyThinking] = useState(false);
  const [playerPower, setPlayerPower] = useState<Power | null>(null);
  const [enemyShield, setEnemyShield] = useState(false);
  const [playerShield, setPlayerShield] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [noReviewedConcepts, setNoReviewedConcepts] = useState(false);
  const { addPoints } = useGamePoints(notebookId);
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService(isSchoolStudent ? 'school' : 'premium');
  
  // Animation states
  const [playerAttacking, setPlayerAttacking] = useState(false);
  const [enemyAttacking, setEnemyAttacking] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Enemy configurations for each round
  const enemies = [
    { name: 'Estudiante Novato', accuracy: 0.6, thinkTime: 3000, avatar: '🧑‍🎓' },
    { name: 'Profesor Experto', accuracy: 0.75, thinkTime: 2000, avatar: '👨‍🏫' },
    { name: 'Maestro Sabio', accuracy: 0.9, thinkTime: 1000, avatar: '🧙‍♂️' }
  ];

  useEffect(() => {
    loadConcepts();
  }, [notebookId]);

  // Timer effect - only for player turns
  useEffect(() => {
    if (gameStarted && !gameOver && isPlayerTurn && timeLeft > 0 && !selectedAnswer) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0 && isPlayerTurn && !selectedAnswer) {
      // Time's up - automatic wrong answer
      handleAnswer(-1);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, gameStarted, gameOver, isPlayerTurn, selectedAnswer]);

  const loadConcepts = async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      // Obtener el ID efectivo del usuario
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      // Obtener TODOS los conceptos del cuaderno primero
      let allConcepts: any[] = await studyService.getAllConceptsFromNotebook(userId, notebookId);
      console.log('⚔️ Total de conceptos en el cuaderno:', allConcepts.length);
      
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
      
      if (reviewedConcepts.length < 4) {
        console.log('⚠️ No hay suficientes conceptos repasados para el juego (mínimo 4)');
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
      setLoading(false);
    } catch (error) {
      console.error('Error loading concepts:', error);
      setLoading(false);
    }
  };

  const generateQuestion = (): Question => {
    const concept = concepts[Math.floor(Math.random() * concepts.length)];
    const otherConcepts = concepts.filter(c => c.id !== concept.id);
    const wrongAnswers = otherConcepts
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(c => c.term);
    
    const options = [concept.term, ...wrongAnswers].sort(() => Math.random() - 0.5);
    
    return {
      id: Math.random().toString(),
      definition: concept.definition,
      correctAnswer: concept.term,
      options
    };
  };

  const startGame = () => {
    setGameStarted(true);
    setPlayerHP(60);
    setEnemyHP(60);
    setRound(1);
    setScore(0);
    setCombo(0);
    setIsPlayerTurn(true);
    setEnemyThinking(false);
    setPointsAwarded(false);
    setGameOver(false);
    setTimeout(() => nextTurn(true), 500); // Start with player turn
  };

  const nextTurn = (forPlayer: boolean = isPlayerTurn) => {
    console.log('Next turn - forPlayer:', forPlayer); // Debug
    
    const question = generateQuestion();
    setCurrentQuestion(question);
    setTimeLeft(10);
    setSelectedAnswer(null);
    setShowResult(null);
    
    // If it's enemy turn, trigger enemy answer
    if (!forPlayer && gameStarted && !gameOver) {
      console.log('Setting up enemy turn...'); // Debug
      setEnemyThinking(true);
      const enemy = enemies[round - 1];
      setTimeout(() => {
        console.log('Calling enemyAnswer...'); // Debug
        enemyAnswer();
      }, enemy.thinkTime);
    }
  };

  const calculateDamage = (isCorrect: boolean, comboCount: number): number => {
    if (!isCorrect) return 0;
    
    const baseDamage = 15;
    const comboDamage = Math.min(comboCount * 2, 10); // Max 10 combo damage
    const totalDamage = baseDamage + comboDamage;
    
    // Check for critical hit power
    if (playerPower?.type === 'critical' && isPlayerTurn) {
      setPlayerPower(null);
      return totalDamage * 2;
    }
    
    return totalDamage;
  };

  const handleAnswer = (answerIndex: number) => {
    if (!currentQuestion || selectedAnswer !== null) return;
    
    setSelectedAnswer(answerIndex);
    const isCorrect = answerIndex >= 0 && currentQuestion.options[answerIndex] === currentQuestion.correctAnswer;
    
    if (isPlayerTurn) {
      if (isCorrect) {
        setCombo(combo + 1);
        const damage = calculateDamage(true, combo);
        
        // Check for shield
        if (!enemyShield) {
          setPlayerAttacking(true);
          setTimeout(() => {
            setEnemyHit(true);
            setEnemyHP(prev => Math.max(0, prev - damage));
          }, 300);
          setTimeout(() => {
            setPlayerAttacking(false);
            setEnemyHit(false);
          }, 600);
        } else {
          setEnemyShield(false);
        }
        
        setScore(score + 5 + combo);
        
        // Check for power activation (every 3 correct answers)
        if ((combo + 1) % 3 === 0) {
          activateRandomPower();
        }
      } else {
        setCombo(0);
      }
    }
    
    setShowResult(isCorrect ? 'correct' : 'wrong');
    
    setTimeout(() => {
      // Check if someone died
      if (isPlayerTurn && isCorrect && !enemyShield) {
        const damage = calculateDamage(true, combo);
        if (enemyHP - damage <= 0) {
          // Round won
          if (round < 3) {
            nextRound();
          } else {
            endGame(true);
          }
          return;
        }
      }
      
      // Switch turns and continue
      if (isPlayerTurn) {
        setIsPlayerTurn(false);
        setTimeout(() => nextTurn(false), 500); // Pass false for enemy turn
      }
    }, 1500);
  };

  const enemyAnswer = () => {
    if (!currentQuestion || gameOver || selectedAnswer !== null) return;
    
    console.log('Enemy answering...'); // Debug
    
    const enemy = enemies[round - 1];
    const shouldAnswerCorrect = Math.random() < enemy.accuracy;
    
    let answerIndex: number;
    if (shouldAnswerCorrect) {
      answerIndex = currentQuestion.options.findIndex(opt => opt === currentQuestion.correctAnswer);
    } else {
      // Pick a wrong answer
      const wrongIndices = currentQuestion.options
        .map((_, idx) => idx)
        .filter(idx => currentQuestion.options[idx] !== currentQuestion.correctAnswer);
      answerIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    }
    
    setEnemyThinking(false);
    setSelectedAnswer(answerIndex);
    
    let playerDied = false;
    
    if (shouldAnswerCorrect) {
      const damage = 15 + Math.floor(Math.random() * 5); // Enemy damage varies
      
      if (!playerShield) {
        setEnemyAttacking(true);
        setTimeout(() => {
          setPlayerHit(true);
          setPlayerHP(prev => {
            const newHP = Math.max(0, prev - damage);
            if (newHP <= 0) {
              playerDied = true;
            }
            return newHP;
          });
        }, 300);
        setTimeout(() => {
          setEnemyAttacking(false);
          setPlayerHit(false);
        }, 600);
      } else {
        setPlayerShield(false);
      }
    }
    
    setShowResult(shouldAnswerCorrect ? 'correct' : 'wrong');
    
    // Always switch back to player turn after enemy answers
    setTimeout(async () => {
      if (playerDied) {
        await endGame(false);
      } else if (!gameOver) {
        setIsPlayerTurn(true);
        setTimeout(() => nextTurn(true), 500); // Pass true for player turn
      }
    }, 2000);
  };

  const activateRandomPower = () => {
    const powers: Power[] = [
      { type: 'critical', icon: faBolt, name: 'Golpe Crítico', active: true },
      { type: 'shield', icon: faShield, name: 'Escudo', active: true },
      { type: 'heal', icon: faHeart, name: 'Curación', active: true }
    ];
    
    const power = powers[Math.floor(Math.random() * powers.length)];
    
    if (power.type === 'heal') {
      setPlayerHP(prev => Math.min(60, prev + 15));
    } else if (power.type === 'shield') {
      setPlayerShield(true);
    } else {
      setPlayerPower(power);
    }
  };

  const nextRound = () => {
    setRound(prev => prev + 1);
    setEnemyHP(60);
    setPlayerHP(60); // Full heal between rounds
    setIsPlayerTurn(true);
    setEnemyThinking(false);
    setSelectedAnswer(null);
    setShowResult(null);
    setTimeout(() => nextTurn(true), 1000); // Player starts new round
  };

  const endGame = async (won: boolean) => {
    setGameOver(true);
    let finalScore = score;
    if (won) {
      finalScore = score + 50; // Victory bonus
      setScore(finalScore);
    }
    if (won && !pointsAwarded) {
      await awardGamePoints(finalScore);
    }
  };

  const awardGamePoints = async (finalScore: number) => {
    if (!pointsAwarded) {
      setPointsAwarded(true);
      
      // Determinar bonus basado en el rendimiento
      let bonusType: 'perfect' | 'speed' | 'streak' | undefined;
      
      if (playerHP === 60) {
        bonusType = 'perfect'; // Victoria sin recibir daño
      } else if (round === 3) {
        bonusType = 'streak'; // Completó todas las rondas
      }
      
      const gameId = notebookId ? `quiz_${notebookId}` : 'quiz';
      const result = await addPoints(gameId, 'Quiz Battle', finalScore, bonusType);
      
      if (result?.newAchievements && result.newAchievements.length > 0) {
        console.log('¡Nuevos logros desbloqueados!', result.newAchievements);
      }
    }
  };

  if (loading) {
    return (
      <div className="quiz-battle-container">
        <div className="loading-container">
          <div className="loading-circle"></div>
          <p className="loading-text">Cargando</p>
        </div>
      </div>
    );
  }

  if (noReviewedConcepts) {
    return (
      <div className="quiz-battle-container">
        <div className="no-concepts-message">
          <button className="back-button" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div className="empty-state">
            <i className="fas fa-graduation-cap"></i>
            <h2>¡Primero necesitas estudiar!</h2>
            <p>Para jugar, necesitas haber repasado al menos 4 conceptos en el estudio inteligente.</p>
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
    <div className="quiz-battle-container">
      <div className="battle-header">
        <button className="back-button" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        
        <div className="battle-info">
          <h2>Ronda {round}/3</h2>
          <p className="enemy-name">{enemies[round - 1].name}</p>
        </div>
        
        <div className="score-display">
          <span>Puntos: {score}</span>
        </div>
      </div>

      <div className="battle-arena">
        {/* Enemy Side */}
        <div className="fighter-section enemy-section">
          <div className={`fighter enemy ${enemyAttacking ? 'attacking' : ''} ${enemyHit ? 'hit' : ''}`}>
            <span className="fighter-avatar">{enemies[round - 1].avatar}</span>
            {enemyShield && <FontAwesomeIcon icon={faShield} className="shield-icon" />}
          </div>
          <div className="hp-bar">
            <div className="hp-fill enemy-hp" style={{ width: `${(enemyHP / 60) * 100}%` }}></div>
            <span className="hp-text">{enemyHP}/60</span>
          </div>
          {enemyThinking && <p className="thinking-text">Pensando...</p>}
        </div>

        {/* VS Indicator */}
        <div className="vs-indicator">
          <FontAwesomeIcon icon={faFistRaised} />
        </div>

        {/* Player Side */}
        <div className="fighter-section player-section">
          <div className={`fighter player ${playerAttacking ? 'attacking' : ''} ${playerHit ? 'hit' : ''}`}>
            <span className="fighter-avatar">🦸‍♂️</span>
            {playerShield && <FontAwesomeIcon icon={faShield} className="shield-icon" />}
          </div>
          <div className="hp-bar">
            <div className="hp-fill player-hp" style={{ width: `${(playerHP / 60) * 100}%` }}></div>
            <span className="hp-text">{playerHP}/60</span>
          </div>
          {combo > 0 && <p className="combo-text">Combo x{combo}</p>}
        </div>
      </div>

      {/* Question Section */}
      {currentQuestion && (
        <div className="question-section">
          <div className="timer-bar">
            <FontAwesomeIcon icon={faClock} />
            <span>{timeLeft}s</span>
            <div className="timer-fill" style={{ width: `${(timeLeft / 10) * 100}%` }}></div>
          </div>
          
          <h3 className="question-text">{currentQuestion.definition}</h3>
          
          <div className="options-grid">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                className={`option-button ${
                  selectedAnswer === index ? (showResult === 'correct' ? 'correct' : 'wrong') : ''
                } ${!isPlayerTurn || selectedAnswer !== null ? 'disabled' : ''}`}
                onClick={() => isPlayerTurn && handleAnswer(index)}
                disabled={!isPlayerTurn || selectedAnswer !== null}
              >
                {option}
              </button>
            ))}
          </div>

          {!isPlayerTurn && <p className="turn-indicator">Turno del oponente</p>}
        </div>
      )}

      {/* Powers Display */}
      {playerPower && (
        <div className="power-indicator">
          <FontAwesomeIcon icon={playerPower.icon} />
          <span>{playerPower.name} Activo</span>
        </div>
      )}

      {/* Game Start Modal */}
      {!gameStarted && !gameOver && (
        <div className="game-modal">
          <h2>¡Quiz Battle!</h2>
          <p>Derrota a 3 oponentes respondiendo correctamente</p>
          <ul>
            <li>Cada respuesta correcta hace daño</li>
            <li>Los combos aumentan el daño</li>
            <li>Cada 3 aciertos obtienes un poder</li>
            <li>¡Batallas rápidas de 60 HP!</li>
          </ul>
          <button className="start-button" onClick={startGame}>
            ¡Comenzar Batalla!
          </button>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && (
        <div className="game-modal">
          <h2>{playerHP > 0 ? '¡Victoria!' : 'Derrota'}</h2>
          <div className="final-stats">
            <p>Puntuación Final: {score}</p>
            <p>Rondas Completadas: {playerHP > 0 ? 3 : round - 1}/3</p>
          </div>
          <button className="back-button" onClick={onBack}>
            Volver a Juegos
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizBattle;