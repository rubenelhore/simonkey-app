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
  
  // Reset flipped state when concept changes
  useEffect(() => {
    setFlipped(false);
    setIsLocked(false);
    setCanEvaluate(false);
    setLockTimer(5);
  }, [concept.id]);
  
  // Manejar candado de 5 segundos para estudio inteligente
  useEffect(() => {
    if (reviewMode && flipped && !isLocked && !canEvaluate) {
      setIsLocked(true);
      setLockTimer(5);
      
      const timer = setInterval(() => {
        setLockTimer(prev => {
          if (prev <= 1) {
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
      
      return () => clearInterval(timer);
    }
  }, [flipped, reviewMode, isLocked, canEvaluate, onLockComplete]);
  
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
    if (reviewMode && !canEvaluate) {
      return;
    }
    
    if (direction === 'left' || direction === 'right') {
      setExitDirection(direction);
      setIsExiting(true);
      
      setTimeout(() => {
        if (direction === 'right') {
          onResponse(ResponseQuality.MASTERED);
        } else {
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
  
  const renderLockOverlay = () => {
    if (!reviewMode || !isLocked) return null;
    
    return (
      <div className="lock-overlay">
        <div className="lock-content">
          <div className="lock-icon">
            <i className="fas fa-lock"></i>
          </div>
          <div className="lock-timer">
            <span className="timer-number">{lockTimer}</span>
            <span className="timer-text">segundos</span>
          </div>
          <div className="lock-message">
            Estudiando concepto...
          </div>
        </div>
      </div>
    );
  };
  
  const renderEvaluationButtons = () => {
    if (!reviewMode || !canEvaluate) return null;
    
    return (
      <div className="evaluation-buttons">
        <button 
          className="eval-button review-later"
          onClick={() => onResponse(ResponseQuality.REVIEW_LATER)}
        >
          <i className="fas fa-redo"></i>
          <span>Revisar después</span>
        </button>
        <button 
          className="eval-button mastered"
          onClick={() => onResponse(ResponseQuality.MASTERED)}
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
        className={`swipeable-card ${flipped ? 'flipped' : ''} ${isLocked ? 'locked' : ''}`}
        style={getCardStyle()}
        {...handlers}
      >
        <div className="card-inner">
          <div className="card-front">
            <div className="term">{concept.término}</div>
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
            
            {reviewMode && canEvaluate && (
              <div className="evaluation-ready">
                <i className="fas fa-unlock"></i>
                <span>¡Listo para evaluar!</span>
              </div>
            )}
          </div>
        </div>
        
        {renderLockOverlay()}
      </div>
      
      {renderEvaluationButtons()}
    </div>
  );
};

export default SwipeableStudyCard;