import React, { useEffect, useState } from 'react';
import { useTour } from '../../contexts/TourContext';
import './InteractiveTour.css';

const TourOverlay: React.FC = () => {
  const { 
    currentStepIndex, 
    isActive, 
    isNavigating, 
    tourSteps, 
    nextStep, 
    prevStep, 
    skipTour 
  } = useTour();

  const [elementFound, setElementFound] = useState(false);

  const currentStep = tourSteps[currentStepIndex];

  // Verificar si el elemento objetivo existe
  useEffect(() => {
    // NO ejecutar si el tour está inactivo
    if (!isActive) {
      return;
    }
    
    console.log(`🔍 Verificando elemento para paso ${currentStepIndex + 1}: ${currentStep.id}`);
    
    if (!currentStep.targetSelector) {
      console.log(`ℹ️ Sin targetSelector, elemento considerado encontrado`);
      setElementFound(true);
      return;
    }

    const checkElement = () => {
      const element = document.querySelector(currentStep.targetSelector!);
      if (element) {
        setElementFound(true);
        console.log(`✅ Elemento encontrado: ${currentStep.targetSelector}`);
      } else {
        console.log(`⏳ Esperando elemento: ${currentStep.targetSelector}`);
        
        setTimeout(checkElement, 500);
      }
    };

    setElementFound(false);
    setTimeout(checkElement, 100);
  }, [currentStep, currentStepIndex, isActive]);

  const getSpotlightPosition = (): React.CSSProperties => {
    if (!currentStep.targetSelector) return {};

    // Intentar encontrar el elemento con selectores múltiples
    const selectors = currentStep.targetSelector.split(', ');
    let element = null;
    
    for (const selector of selectors) {
      element = document.querySelector(selector.trim());
      if (element) break;
    }
    
    
    if (!element) return {};

    const rect = element.getBoundingClientRect();
    return {
      top: rect.top - 6,
      left: rect.left - 6,
      width: rect.width + 12,
      height: rect.height + 12,
    };
  };

  const getTooltipPosition = (): React.CSSProperties => {
    if (!currentStep.targetSelector) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // Para páginas completas (body o selectores múltiples), posicionar de forma segura
    if (currentStep.targetSelector === 'body' || currentStep.targetSelector?.includes('body')) {
      return {
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, 0)',
        maxHeight: '70vh',
        overflowY: 'auto',
      };
    }

    // Intentar encontrar el elemento con selectores múltiples
    const selectors = currentStep.targetSelector.split(', ');
    let element = null;
    
    for (const selector of selectors) {
      element = document.querySelector(selector.trim());
      if (element) break;
    }
    
    if (!element) {
      return {
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, 0)',
      };
    }

    const rect = element.getBoundingClientRect();
    const tooltipOffset = 20;

    switch (currentStep.position) {
      case 'right':
        const adjustedTop = currentStep.id === 'inicio-icon' ? 
          Math.max(rect.top + rect.height / 2, 120) : 
          rect.top + rect.height / 2;
        
        return {
          top: adjustedTop,
          left: rect.right + tooltipOffset,
          transform: 'translateY(-50%)',
        };
      case 'left':
        return {
          top: rect.top + rect.height / 2,
          right: window.innerWidth - rect.left + tooltipOffset,
          transform: 'translateY(-50%)',
        };
      case 'top':
        return {
          bottom: window.innerHeight - rect.top + tooltipOffset,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          top: rect.bottom + tooltipOffset,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
        };
      default:
        return {
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, 0)',
        };
    }
  };

  if (!isActive) return null;

  console.log(`🎯 Tour - Paso actual: ${currentStepIndex + 1}/${tourSteps.length} - ${currentStep.title}`);
  console.log(`🎯 Element found: ${elementFound}, Target: ${currentStep.targetSelector}`);

  return (
    <div 
      className="interactive-tour-overlay"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Spotlight que "recorta" el overlay oscuro */}
      <div 
        className={`tour-spotlight ${
          !currentStep.targetSelector ? 'tour-spotlight-center' : 
          (currentStep.targetSelector === 'body' || currentStep.targetSelector?.includes('body')) ? 'tour-spotlight-fullpage' : ''
        }`}
        style={currentStep.targetSelector && currentStep.targetSelector !== 'body' && !currentStep.targetSelector?.includes('body') ? getSpotlightPosition() : {}}
      />

      {/* Tooltip con contenido - siempre mostrar para debugging */}
      <div 
        className={`tour-tooltip ${currentStep.position}`}
        style={getTooltipPosition()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Contador de pasos en esquina superior derecha del tooltip */}
        <div className="tour-step-counter-tooltip">
          {currentStepIndex + 1} / {tourSteps.length}
        </div>

        <div className="tour-content">
          <div className="demo-badge">MODO DEMO</div>
          <h3 className="tour-title">{currentStep.title}</h3>
          <p className="tour-description">{currentStep.description}</p>

          {/* Acciones */}
          <div className="tour-actions">
            <button 
              onClick={skipTour}
              className="tour-skip-btn"
            >
              Saltar tour
            </button>
            
            <div className="tour-navigation">
              {currentStepIndex > 0 && (
                <button 
                  onClick={prevStep}
                  className="tour-prev-btn"
                >
                  Anterior
                </button>
              )}
              
              <button 
                onClick={nextStep}
                className="tour-next-btn"
                disabled={isNavigating}
              >
                {isNavigating ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Navegando...
                  </>
                ) : (
                  currentStepIndex === tourSteps.length - 1 ? 'Comenzar' : 'Siguiente'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Flecha del tooltip */}
        <div className={`tour-arrow ${currentStep.position}`} />
      </div>
    </div>
  );
};

export default TourOverlay;