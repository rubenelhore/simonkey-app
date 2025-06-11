// src/components/Mobile/SwipeableStudyCard.jsx
import React, { useState, useEffect } from 'react';
import { useSwipe } from '../../hooks/useSwipe';
import './SwipeableStudyCard.css';
import TextToSpeech from '../TextToSpeech';
import { Concept, ResponseQuality } from '../../types/interfaces';

interface SwipeableStudyCardProps {
  concept: Concept;
  reviewMode: boolean;
  quizMode: boolean;
  onResponse: (quality: ResponseQuality) => Promise<void>;
}

const SwipeableStudyCard: React.FC<SwipeableStudyCardProps> = ({ 
  concept, 
  reviewMode, 
  quizMode,
  onResponse 
}) => {
  const [flipped, setFlipped] = useState(false);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [exitDirection, setExitDirection] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  
  // Reset flipped state when concept changes
  useEffect(() => {
    setFlipped(false);
  }, [concept.id]);
  
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
  
  return (
    <div
      className={`swipeable-card ${flipped ? 'flipped' : ''}`}
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
          
          <div className="swipe-hints">
            {/*
            <div className="swipe-hint left">
              <div className="arrow-indicator">
                <i className="fas fa-arrow-left"></i>
              </div>
              <span>Revisar después</span>
            </div>
            <div className="swipe-hint right">
              <span>Dominado</span>
              <div className="arrow-indicator">
                <i className="fas fa-arrow-right"></i>
              </div>
            </div>
            */}
          </div>
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
  );
};

export default SwipeableStudyCard;