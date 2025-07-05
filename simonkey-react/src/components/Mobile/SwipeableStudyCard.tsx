// src/components/Mobile/SwipeableStudyCard.jsx
import React, { useState, useEffect } from 'react';
import { useSwipe } from '../../hooks/useSwipe';
import './SwipeableStudyCard.css';
import TextToSpeech from '../TextToSpeech';
import { Concept, ResponseQuality, StudyLockState } from '../../types/interfaces';

interface SwipeableStudyCardProps {
  concept: Concept;
  reviewMode: boolean;
  quizMode: boolean;
  onResponse: (quality: ResponseQuality) => Promise<void>;
  lockState?: StudyLockState;
  onLockComplete?: () => void;
}

const SwipeableStudyCard: React.FC<SwipeableStudyCardProps> = ({ 
  concept, 
  reviewMode, 
  quizMode,
  onResponse,
  lockState,
  onLockComplete
}) => {
  const [flipped, setFlipped] = useState(false);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [exitDirection, setExitDirection] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [lockTimer, setLockTimer] = useState<number>(5);
  const [isLocked, setIsLocked] = useState(false);
  const [canEvaluate, setCanEvaluate] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  
  // Reset flipped state when concept changes
  useEffect(() => {
    // Start transition to hide content
    setIsTransitioning(true);
    
    // Wait a bit before resetting states to prevent flash of content
    setTimeout(() => {
      setFlipped(false);
      setCanEvaluate(false);
      setLockTimer(5);
      
      // End transition after states are reset
      setTimeout(() => {
        setIsTransitioning(false);
        // Set isLocked after transition completes for reviewMode
        if (reviewMode) {
          setIsLocked(true);
        }
      }, 50);
    }, 100);
  }, [concept.id, reviewMode, responseCount]);
  
  // Manejar candado de 5 segundos para estudio inteligente
  useEffect(() => {
    // Solo activar el candado si estamos en modo inteligente y está bloqueado
    if (reviewMode && isLocked && !isTransitioning) {
      console.log('🔒 Iniciando timer de candado...');
      
      const timer = setInterval(() => {
        setLockTimer(prev => {
          console.log('⏰ Timer tick:', prev);
          if (prev <= 1) {
            console.log('🔓 Desbloqueando candado...');
            setIsLocked(false);
            setCanEvaluate(true);
            if (onLockComplete) {
              onLockComplete();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      console.log('⏰ Timer iniciado con ID:', timer);
      
      return () => {
        console.log('🧹 Limpiando timer con ID:', timer);
        clearInterval(timer);
      };
    }
  }, [reviewMode, isLocked, isTransitioning, concept.id]); // Depender de isLocked e isTransitioning
  
  // Log del estado del candado
  useEffect(() => {
    console.log('🎯 Estado del candado:', { reviewMode, isLocked, canEvaluate, lockTimer });
  }, [reviewMode, isLocked, canEvaluate, lockTimer]);
  
  const { swipeHandlers, swipeDirection, swiping, resetSwipe } = useSwipe({
    threshold: 100,
    timeout: 500
  });
  
  useEffect(() => {
    if (swipeDirection) {
      handleSwipe(swipeDirection);
      resetSwipe();
    }
  }, [swipeDirection, resetSwipe]);
  
  const handleSwipe = (direction: string) => {
    // En modo estudio inteligente, solo permitir swipe después del candado
    // En modo estudio libre, permitir swipe siempre
    if (reviewMode && !canEvaluate) {
      return;
    }
    
    if (direction === 'left' || direction === 'right') {
      setExitDirection(direction);
      setIsExiting(true);
      
      setTimeout(async () => {
        // Ensure card is facing front before transitioning
        if (flipped) {
          setFlipped(false);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        if (direction === 'right') {
          onResponse(ResponseQuality.MASTERED);
        } else {
          // Increment response count to force reset if it's the same concept
          setResponseCount(prev => prev + 1);
          onResponse(ResponseQuality.REVIEW_LATER);
        }
      }, 300);
    }
  };
  
  const handleCardTap = (e: React.MouseEvent) => {
    if (!swiping) {
      setFlipped(!flipped);
    }
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY;
    
    const maxDrag = 100;
    const drag = Math.max(-maxDrag, Math.min(maxDrag, deltaY));
    
    setDragOffsetY(drag);
  };
  
  const handleTouchEnd = (e: React.TouchEvent<Element>) => {
    if (Math.abs(dragOffsetY) > 50) {
      setFlipped(!flipped);
    }
    
    setTouchStartY(null);
    setDragOffsetY(0);
  };
  
  const handlers = {
    ...swipeHandlers,
    onTouchStart: (e: React.TouchEvent) => {
      swipeHandlers.onTouchStart(e);
      handleTouchStart(e);
    },
    onTouchMove: (e: React.TouchEvent) => {
      swipeHandlers.onTouchMove(e);
      handleTouchMove(e);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      swipeHandlers.onTouchEnd(e);
      handleTouchEnd(e);
    },
    onClick: handleCardTap
  };
  
  const getCardStyle = () => {
    let style: React.CSSProperties = {
      transform: `perspective(1000px) rotateX(${dragOffsetY * 0.2}deg)`
    };
    
    if (isExiting) {
      style.transform = `translateX(${exitDirection === 'right' ? 1000 : -1000}px) rotate(${exitDirection === 'right' ? 30 : -30}deg)`;
      style.transition = 'transform 0.3s ease-out';
      style.opacity = 0;
    }
    
    return style;
  };
  
  const renderEvaluationButtons = () => {
    // Show buttons for both smart study (reviewMode) and free study modes
    // For smart study: only when canEvaluate is true (after lock)
    // For free study: always show buttons
    if (reviewMode && !canEvaluate) return null;
    
    // For free study mode, we don't need the lock mechanism
    const shouldShowButtons = reviewMode ? canEvaluate : true;
    
    if (!shouldShowButtons) return null;
    
    return (
      <div className="evaluation-buttons">
        <button 
          className="eval-button review-later"
          onClick={async () => {
            // Ensure card is facing front before transitioning
            if (flipped) {
              setFlipped(false);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            // Increment response count to force reset if it's the same concept
            setResponseCount(prev => prev + 1);
            onResponse(ResponseQuality.REVIEW_LATER);
          }}
        >
          <i className="fas fa-redo"></i>
          <span>Revisar después</span>
        </button>
        <button 
          className="eval-button mastered"
          onClick={async () => {
            // Ensure card is facing front before transitioning
            if (flipped) {
              setFlipped(false);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            onResponse(ResponseQuality.MASTERED);
          }}
        >
          <i className="fas fa-check-double"></i>
          <span>Dominado</span>
        </button>
      </div>
    );
  };
  
  return (
    <div className="swipeable-card-container">
      <div
        className={`swipeable-card ${flipped ? 'flipped' : ''} ${isLocked ? 'locked' : ''} ${isTransitioning ? 'transitioning' : ''}`}
        style={getCardStyle()}
        {...handlers}
      >
        <div className="card-inner">
          <div className="card-front">
            <div className="term">{concept.término}</div>
            
            {reviewMode && isLocked && (
              <div className="lock-display">
                <div className="lock-icon-front">
                  <i className="fas fa-lock"></i>
                </div>
                <div className="lock-timer-front">
                  <span className="timer-number-front">{lockTimer}</span>
                  <span className="timer-text-front">segundos</span>
                </div>
                <div className="lock-message-front">
                  Estudiando concepto...
                </div>
              </div>
            )}
            
            {reviewMode && !isLocked && canEvaluate && (
              <div className="evaluation-ready-front">
                <i className="fas fa-unlock"></i>
                <span>¡Listo para evaluar!</span>
              </div>
            )}
            
            <div className="hint">
              <span>Toca para ver definición</span>
              <div className="hint-icon">
                <i className="fas fa-hand-point-up"></i>
              </div>
            </div>
            
            {reviewMode && (
              <div className="study-mode-indicator">
                <i className="fas fa-brain"></i>
                <span>Modo Inteligente</span>
              </div>
            )}
          </div>
          
          <div className="card-back">
            <div className="definition">
              <h3>Definición:</h3>
              <p>{concept.definición}</p>
              
              <div className="text-to-speech-container" onClick={(e) => e.stopPropagation()}>
                <TextToSpeech text={concept.definición} iconOnly={true} />
              </div>
            </div>
            
            <div className="source">
              <span>Fuente: {concept.fuente}</span>
            </div>
    
            <div className="tap-hint">
              <span>Toca para volver</span>
            </div>
          </div>
        </div>
      </div>
      
      {renderEvaluationButtons()}
    </div>
  );
};

export default SwipeableStudyCard;