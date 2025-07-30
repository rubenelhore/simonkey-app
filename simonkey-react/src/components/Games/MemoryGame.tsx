import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrophy, faArrowLeft, faRedo, faClock, faFire } from '@fortawesome/free-solid-svg-icons';
import { useGamePoints } from '../../hooks/useGamePoints';
import { useStudyService } from '../../hooks/useStudyService';
import { useUserType } from '../../hooks/useUserType';
import { getEffectiveUserId } from '../../utils/getEffectiveUserId';
import '../../styles/MemoryGame.css';

interface Concept {
  id: string;
  term: string;
  definition: string;
}

interface Card {
  id: string;
  content: string;
  type: 'term' | 'definition';
  conceptId: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface MemoryGameProps {
  notebookId: string;
  notebookTitle: string;
  onBack: () => void;
}

const MemoryGame: React.FC<MemoryGameProps> = ({ notebookId, notebookTitle, onBack }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [noReviewedConcepts, setNoReviewedConcepts] = useState(false);
  const { addPoints } = useGamePoints(notebookId);
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService(isSchoolStudent ? 'school' : 'premium');

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !gameCompleted) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameCompleted, startTime]);

  // Load concepts from notebook
  useEffect(() => {
    loadConcepts();
  }, [notebookId]);

  const loadConcepts = async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      // Obtener el ID efectivo del usuario
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      // Obtener TODOS los conceptos del cuaderno primero
      let allConcepts: any[] = await studyService.getAllConceptsFromNotebook(userId, notebookId);
      console.log('🎮 Total de conceptos en el cuaderno:', allConcepts.length);
      
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
      
      if (reviewedConcepts.length === 0) {
        console.log('⚠️ No hay conceptos repasados disponibles para el juego');
        setNoReviewedConcepts(true);
        setLoading(false);
        return;
      }
      
      // Convertir al formato que espera el juego
      const concepts: Concept[] = reviewedConcepts.map(concept => ({
        id: concept.id,
        term: concept.término || '',
        definition: concept.definición || ''
      }));

      console.log('🎯 Total de conceptos repasados para el juego:', concepts.length);
      
      // Shuffle and take max 5 concepts
      const shuffled = concepts.sort(() => Math.random() - 0.5).slice(0, 5);
      
      // Create cards (each concept creates 2 cards: term and definition)
      const gameCards: Card[] = [];
      shuffled.forEach((concept) => {
        gameCards.push({
          id: `${concept.id}_term`,
          content: concept.term,
          type: 'term',
          conceptId: concept.id,
          isFlipped: false,
          isMatched: false
        });
        gameCards.push({
          id: `${concept.id}_def`,
          content: concept.definition,
          type: 'definition',
          conceptId: concept.id,
          isFlipped: false,
          isMatched: false
        });
      });

      // Shuffle cards
      const shuffledCards = gameCards.sort(() => Math.random() - 0.5);
      setCards(shuffledCards);
      setLoading(false);
    } catch (error) {
      console.error('Error loading concepts:', error);
      setLoading(false);
    }
  };

  const handleCardClick = (clickedCard: Card) => {
    if (!gameStarted) {
      setGameStarted(true);
      setStartTime(Date.now());
    }

    // Prevent clicking if checking, card is already matched, or card is already selected
    if (isChecking || clickedCard.isMatched || selectedCards.some(card => card.id === clickedCard.id)) return;

    // Flip the card
    const newCards = cards.map(card => 
      card.id === clickedCard.id ? { ...card, isFlipped: true } : card
    );
    setCards(newCards);

    const newSelectedCards = [...selectedCards, clickedCard];
    setSelectedCards(newSelectedCards);

    // Check for match when 2 cards are selected
    if (newSelectedCards.length === 2) {
      setIsChecking(true);
      setMoves(moves + 1);

      const [first, second] = newSelectedCards;
      
      // Check if they match (same conceptId but different type)
      if (first.conceptId === second.conceptId && first.type !== second.type) {
        // Match found!
        setTimeout(() => {
          const matchedCards = cards.map(card => 
            card.conceptId === first.conceptId ? { ...card, isMatched: true, isFlipped: true } : card
          );
          setCards(matchedCards);
          setMatchedPairs(matchedPairs + 1);
          setSelectedCards([]);
          setIsChecking(false);
          setStreak(streak + 1);
          if (streak + 1 > bestStreak) {
            setBestStreak(streak + 1);
          }

          // Check if game is completed
          if (matchedPairs + 1 === Math.floor(matchedCards.length / 2)) {
            setGameCompleted(true);
            celebrateWin();
            awardGamePoints();
          }
        }, 600);
      } else {
        // No match - flip cards back
        setTimeout(() => {
          const resetCards = cards.map(card => 
            (card.id === first.id || card.id === second.id) && !card.isMatched
              ? { ...card, isFlipped: false }
              : card
          );
          setCards(resetCards);
          setSelectedCards([]);
          setIsChecking(false);
          setStreak(0);
        }, 1000);
      }
    }
  };

  const celebrateWin = () => {
    // Create custom confetti effect
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Create confetti particles
      createConfetti(particleCount);
    }, 250);
  };

  const createConfetti = (count: number) => {
    const container = document.querySelector('.memory-game-container');
    if (!container) return;

    for (let i = 0; i < count; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-particle';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.backgroundColor = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'][Math.floor(Math.random() * 5)];
      confetti.style.animationDelay = Math.random() * 3 + 's';
      container.appendChild(confetti);

      // Remove particle after animation
      setTimeout(() => confetti.remove(), 3000);
    }
  };

  const resetGame = () => {
    setCards(cards.map(card => ({ ...card, isFlipped: false, isMatched: false })));
    setSelectedCards([]);
    setMoves(0);
    setMatchedPairs(0);
    setGameStarted(false);
    setGameCompleted(false);
    setElapsedTime(0);
    setStreak(0);
    setBestStreak(0);
    setPointsAwarded(false);
    loadConcepts();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScore = () => {
    const baseScore = matchedPairs * 10;
    const timeBonus = Math.max(0, 60 - elapsedTime);
    const movesPenalty = moves * 2;
    const streakBonus = bestStreak * 5;
    return Math.max(0, baseScore + timeBonus - movesPenalty + streakBonus);
  };

  const awardGamePoints = async () => {
    if (!pointsAwarded) {
      setPointsAwarded(true);
      const finalScore = getScore();
      console.log('[MemoryGame] Otorgando puntos:', finalScore);
      
      // Determinar tipo de bonus
      let bonusType: 'perfect' | 'speed' | 'streak' | undefined = undefined;
      if (moves === matchedPairs * 2) {
        bonusType = 'perfect'; // Juego perfecto sin errores
      } else if (elapsedTime < 30) {
        bonusType = 'speed'; // Completado en menos de 30 segundos
      } else if (bestStreak >= 5) {
        bonusType = 'streak'; // Racha de 5 o más
      }
      
      try {
        const gameId = notebookId ? `memory_${notebookId}` : 'memory';
        const result = await addPoints(gameId, 'Memorama', finalScore, bonusType);
        console.log('[MemoryGame] Resultado de puntos:', result);
        
        if (result?.newAchievements && result.newAchievements.length > 0) {
          // Mostrar logros desbloqueados si los hay
          console.log('Nuevos logros:', result.newAchievements);
        }
      } catch (error) {
        console.error('[MemoryGame] Error al otorgar puntos:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="memory-game-container">
        <div className="loading-container">
          <div className="loading-circle"></div>
          <p className="loading-text">Cargando</p>
        </div>
      </div>
    );
  }

  if (noReviewedConcepts) {
    return (
      <div className="memory-game-container">
        <div className="no-concepts-message">
          <button className="back-button" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div className="empty-state">
            <i className="fas fa-graduation-cap"></i>
            <h2>¡Primero necesitas estudiar!</h2>
            <p>Para jugar, necesitas haber repasado algunos conceptos en el estudio inteligente.</p>
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
    <div className="memory-game-container">
      <div className="memory-game-header">
        <button className="back-button" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        
        <div className="game-title">
          <h1>Memorama</h1>
          <p>{notebookTitle}</p>
        </div>

        <button className="reset-button" onClick={resetGame}>
          <FontAwesomeIcon icon={faRedo} />
          <span>Reiniciar</span>
        </button>
      </div>

      <div className="game-stats">
        <div className="stat">
          <FontAwesomeIcon icon={faClock} />
          <span>{formatTime(elapsedTime)}</span>
        </div>
        <div className="stat">
          <span>Movimientos: {moves}</span>
        </div>
        <div className="stat">
          <span>Parejas: {matchedPairs}/{Math.floor(cards.length / 2)}</span>
        </div>
        {streak > 0 && (
          <div className="stat streak">
            <FontAwesomeIcon icon={faFire} />
            <span>Racha: {streak}</span>
          </div>
        )}
      </div>

      <div className="memory-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`memory-card ${card.isFlipped ? 'flipped' : ''} ${card.isMatched ? 'matched' : ''} card-${card.type}`}
            onClick={() => handleCardClick(card)}
          >
            <div className="card-inner">
              <div className="card-front">
                <span className="card-type-icon">
                  {card.type === 'term' ? '📝' : '💡'}
                </span>
              </div>
              <div className="card-back">
                <p>{card.content}</p>
                <span className="card-type-label">
                  {card.type === 'term' ? 'Término' : 'Definición'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {gameCompleted && (
        <div className="game-completed-modal">
          <div className="modal-content">
            <FontAwesomeIcon icon={faTrophy} className="trophy-icon" />
            <h2>¡Felicidades!</h2>
            <p>Has completado el memorama</p>
            
            <div className="final-stats">
              <div className="final-stat">
                <span className="label">Tiempo:</span>
                <span className="value">{formatTime(elapsedTime)}</span>
              </div>
              <div className="final-stat">
                <span className="label">Movimientos:</span>
                <span className="value">{moves}</span>
              </div>
              <div className="final-stat">
                <span className="label">Mejor racha:</span>
                <span className="value">{bestStreak}</span>
              </div>
              <div className="final-stat highlight">
                <span className="label">Puntuación:</span>
                <span className="value">{getScore()}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="play-again-btn" onClick={resetGame}>
                Jugar de nuevo
              </button>
              <button className="back-to-games-btn" onClick={onBack}>
                Volver a juegos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryGame;