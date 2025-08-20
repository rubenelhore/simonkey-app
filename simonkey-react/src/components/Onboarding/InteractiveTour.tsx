import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import './InteractiveTour.css';

interface InteractiveTourProps {
  onComplete: () => void;
  demoMode?: boolean; // Para modo demostración
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  action?: 'navigate' | 'highlight' | 'none';
  actionTarget?: string;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a Simonkey! 🐒',
    description: 'Tu asistente de estudio inteligente que te ayudará a aprender de manera más eficiente.',
    position: 'center',
    action: 'none'
  },
  {
    id: 'sidebar-intro',
    title: 'Menú de navegación',
    description: 'Este es tu menú principal. Vamos a recorrer cada módulo paso a paso para que conozcas todas las funciones.',
    targetSelector: '.sidebar-nav',  
    position: 'right',
    action: 'highlight'
  },
  
  // MÓDULO 1: INICIO
  {
    id: 'inicio-icon',
    title: 'Página Principal 🏠',
    description: 'Este es el módulo de inicio. Aquí verás un resumen de tu progreso y acceso rápido a tus materias.',
    targetSelector: 'button[title="Inicio"]',
    position: 'right',
    action: 'highlight'
  },
  {
    id: 'inicio-content',
    title: 'Tu Dashboard Personal',
    description: 'Esta es tu página de inicio donde puedes ver estadísticas, materias recientes y tu progreso general de estudio.',
    targetSelector: 'body',
    position: 'center',
    action: 'highlight'
  },
  
  // MÓDULO 2: MATERIAS
  {
    id: 'materias-icon',
    title: 'Mis Materias 📚',
    description: 'Este módulo te permite organizar tu estudio por materias como "Matemáticas", "Historia", etc.',
    targetSelector: 'button[title="Mis materias"]',
    position: 'right',
    action: 'navigate',
    actionTarget: '/materias'
  },
  {
    id: 'materias-content',
    title: 'Gestión de Materias',
    description: 'Aquí puedes crear materias, agregar cuadernos y organizar todo tu material de estudio de forma estructurada.',
    targetSelector: '.main-content, .content-wrapper, main, body',
    position: 'center',
    action: 'highlight'
  },
  
  // MÓDULO 3: ESTUDIAR
  {
    id: 'study-icon',
    title: 'Modo Estudio 🧠',
    description: 'El corazón de Simonkey: herramientas inteligentes de estudio, repasos automáticos y generación de preguntas.',
    targetSelector: 'button[title="Estudiar"]',
    position: 'right',
    action: 'navigate',
    actionTarget: '/study'
  },
  {
    id: 'study-content',
    title: 'Herramientas Inteligentes',
    description: 'Aquí encontrarás modos de repaso inteligente, generación automática de preguntas y análisis de tu progreso de aprendizaje.',
    targetSelector: 'body',
    position: 'center',
    action: 'highlight'
  },
  
  // MÓDULO 4: PROGRESO
  {
    id: 'progress-icon',
    title: 'Mi Progreso 📊',
    description: 'Visualiza tu progreso de aprendizaje con estadísticas detalladas y gráficos de rendimiento.',
    targetSelector: 'button[title="Mi progreso"]',
    position: 'right',
    action: 'navigate',
    actionTarget: '/progress'
  },
  {
    id: 'progress-content',
    title: 'Análisis de Rendimiento',
    description: 'Gráficos detallados de tu progreso, estadísticas de estudio y recomendaciones personalizadas para mejorar.',
    targetSelector: 'body',
    position: 'center',
    action: 'highlight'
  },
  
  // MÓDULO 5: CALENDARIO
  {
    id: 'calendar-icon',
    title: 'Calendario 📅',
    description: 'Organiza tus sesiones de estudio, eventos importantes y planifica tu tiempo de aprendizaje.',
    targetSelector: 'button[title="Calendario"]',
    position: 'right',
    action: 'navigate',
    actionTarget: '/calendar'
  },
  {
    id: 'calendar-content',
    title: 'Planificación de Estudios',
    description: 'Programa tus sesiones de estudio, establece recordatorios y mantén un horario organizado de aprendizaje.',
    targetSelector: 'body',
    position: 'center',
    action: 'highlight'
  },
  
  // FINALIZACIÓN
  {
    id: 'ready',
    title: '¡Tour Completado! 🎉',
    description: 'Ya conoces todos los módulos de Simonkey. Puedes comenzar creando tu primera materia y subiendo contenido para estudiar.',
    position: 'center',
    action: 'navigate',
    actionTarget: '/materias'
  }
];

const InteractiveTour: React.FC<InteractiveTourProps> = ({ onComplete, demoMode = false }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    if (demoMode) {
      // En modo demo, limpiar cualquier estado anterior y empezar desde el paso 1
      localStorage.removeItem('tourDemoStep');
      console.log(`🎯 Tour modo demo - iniciando en paso: 1`);
      return 0;
    } else {
      // Solo en modo real, recuperar el paso guardado
      const savedStep = localStorage.getItem('tourStep');
      const stepIndex = savedStep ? parseInt(savedStep, 10) : 0;
      console.log(`🎯 Tour real iniciando en paso: ${stepIndex + 1}`);
      return stepIndex;
    }
  });
  const [isVisible, setIsVisible] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [tourClosed, setTourClosed] = useState(false);
  const navigate = useNavigate();

  const currentStep = tourSteps[currentStepIndex];

  // Guardar estado del tour en localStorage (solo en modo real)
  useEffect(() => {
    if (!demoMode) {
      localStorage.setItem('tourStep', currentStepIndex.toString());
      console.log(`🎯 Guardando paso del tour: ${currentStepIndex + 1}`);
    } else {
      console.log(`🎯 Modo demo - paso actual: ${currentStepIndex + 1} (no guardado)`);
    }
    
    // Resetear hasNavigated cuando cambia el paso
    setHasNavigated(false);
  }, [currentStepIndex, demoMode]);

  useEffect(() => {
    if (demoMode) {
      // En modo demo, siempre empezar en la página de inicio
      if (window.location.pathname !== '/inicio') {
        console.log(`🎯 Modo demo - navegando a página de inicio`);
        navigate('/inicio');
      }
    } else {
      // En modo real, determinar qué página necesitamos según el paso actual
      const currentStepRequiredPage = (() => {
        // Para los pasos de contenido de materias, debería estar en /materias
        if (currentStep.id === 'materias-content') {
          return '/materias';
        }
        // Para los pasos de contenido de estudio, debería estar en /study
        if (currentStep.id === 'study-content') {
          return '/study';
        }
        // Para los pasos de contenido de progreso, debería estar en /progress
        if (currentStep.id === 'progress-content') {
          return '/progress';
        }
        // Para los pasos de contenido de calendario, debería estar en /calendar
        if (currentStep.id === 'calendar-content') {
          return '/calendar';
        }
        
        // Si el paso actual requiere navegación específica, usar esa página
        if (currentStep.actionTarget) {
          return currentStep.actionTarget;
        }
        
        return '/inicio'; // Por defecto
      })();

      // Navegar a la página correcta si no estamos ahí
      if (window.location.pathname !== currentStepRequiredPage) {
        console.log(`🎯 Navegando a página requerida: ${currentStepRequiredPage}`);
        navigate(currentStepRequiredPage);
      }
    }

    // Esperar a que los elementos del DOM estén disponibles
    const checkElementsReady = () => {
      const sidebarNav = document.querySelector('.sidebar-nav');
      if (sidebarNav) {
        console.log('🎯 Elementos del DOM listos para el tour');
      } else {
        console.log('⏳ Esperando elementos del DOM...');
        setTimeout(checkElementsReady, 100);
      }
    };

    setTimeout(checkElementsReady, 500);

    // Función para reiniciar el tour (modo demo)
    if (demoMode) {
      (window as any).restartTour = () => {
        console.log('🔄 Reiniciando tour modo demo...');
        localStorage.removeItem('tourDemoStep');
        setCurrentStepIndex(0);
        setIsVisible(true);
        setIsNavigating(false);
        setHasNavigated(false);
        setTourClosed(false); // Resetear el estado de cierre
        navigate('/inicio');
      };

      // Función para probar navegación automática
      (window as any).testTourNavigation = async () => {
        console.log('🧪 Iniciando test completo de navegación del tour...');
        
        const testPages = ['/inicio', '/materias', '/study', '/progress', '/calendar'];
        
        for (let i = 0; i < testPages.length; i++) {
          const page = testPages[i];
          console.log(`🧪 Probando navegación a: ${page}`);
          
          navigate(page);
          
          // Esperar navegación
          let attempts = 0;
          while (window.location.pathname !== page && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          if (window.location.pathname === page) {
            console.log(`✅ Navegación exitosa a: ${page}`);
          } else {
            console.log(`❌ Fallo navegación a: ${page}`);
          }
          
          // Esperar antes del siguiente test
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('🧪 Test de navegación completado');
        navigate('/inicio');
      };
      
      console.log('🎮 Tour en modo demo. Comandos disponibles:');
      console.log('   window.restartTour() - Reiniciar tour');
      console.log('   window.testTourNavigation() - Probar navegación');
    }
  }, [navigate, demoMode]);

  // Efecto para manejar cambios de ubicación
  useEffect(() => {
    // Si el tour fue cerrado, no hacer nada más
    if (tourClosed) {
      console.log(`🎯 Tour cerrado - ignorando efectos de ubicación`);
      return;
    }
    
    const currentPath = window.location.pathname;
    console.log(`🎯 Tour - Ubicación actual: ${currentPath}, Paso: ${currentStepIndex + 1}`);
    
    // Verificar si el paso actual requiere una página específica
    if (currentStep.actionTarget && currentPath !== currentStep.actionTarget) {
      const expectedPath = currentStep.actionTarget;
      console.log(`🎯 Tour - Esperando navegación a: ${expectedPath}`);
    }
    
    // Asegurar que el tour permanezca visible después de cambios de ubicación
    if (!isVisible) {
      console.log(`🎯 Tour invisible detectado - forzando visibilidad`);
      setIsVisible(true);
    }
    
    // Forzar visibilidad específicamente en página de materias
    if (currentPath === '/materias' && currentStepIndex >= 4) {
      setTimeout(() => {
        setIsVisible(true);
        console.log(`🎯 Tour forzado a visible en página de materias`);
      }, 200);
    }
  }, [currentStepIndex, currentStep, isVisible, tourClosed]);

  const handleNext = async () => {
    console.log(`🎯 [CLIC] Botón presionado en paso ${currentStepIndex + 1}: ${currentStep.title}`);
    console.log(`🎯 Estado - isNavigating: ${isNavigating}, hasNavigated: ${hasNavigated}`);
    
    // Prevenir clics múltiples durante navegación
    if (isNavigating) {
      console.log('🚫 Navegación en progreso, ignorando clic');
      return;
    }

    // Verificar si hay más pasos
    if (currentStepIndex >= tourSteps.length - 1) {
      console.log(`🏁 Tour completado`);
      completeTour();
      return;
    }
    
    // Si el paso actual requiere navegación Y no hemos navegado aún
    if (currentStep.action === 'navigate' && currentStep.actionTarget && !hasNavigated) {
      setIsNavigating(true);
      console.log(`🔄 PRIMER CLIC - NAVEGANDO A: ${currentStep.actionTarget}`);
      
      try {
        // Navegar inmediatamente
        navigate(currentStep.actionTarget);
        
        // Esperar a que la navegación complete
        let attempts = 0;
        while (window.location.pathname !== currentStep.actionTarget && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        console.log(`✅ Navegación completada a ${currentStep.actionTarget}`);
        
        // Esperar que el DOM se estabilice
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Marcar que hemos navegado
        setHasNavigated(true);
        
        // Asegurar que el tour permanezca visible después de la navegación
        setTimeout(() => {
          setIsVisible(true);
          console.log(`🎯 Tour forzadamente visible después de navegación`);
        }, 100);
        
      } catch (error) {
        console.error(`❌ Error navegando:`, error);
      }
      
      setIsNavigating(false);
      
      // Avanzar automáticamente al siguiente paso después de navegar
      const nextStepIndex = currentStepIndex + 1;
      if (nextStepIndex < tourSteps.length) {
        console.log(`🎯 Auto-avanzando al paso ${nextStepIndex + 1}: ${tourSteps[nextStepIndex].title}`);
        setTimeout(() => {
          setCurrentStepIndex(nextStepIndex);
          setHasNavigated(false); // Resetear para el próximo paso con navegación
        }, 800); // Dar tiempo para que se estabilice la navegación
      }
      
      return;
    }
    
    // Segundo clic o paso sin navegación - avanzar al siguiente paso
    console.log(`🎯 SEGUNDO CLIC - AVANZANDO AL SIGUIENTE PASO`);
    const nextStepIndex = currentStepIndex + 1;
    setCurrentStepIndex(nextStepIndex);
    setHasNavigated(false); // Resetear para el próximo paso con navegación
    
    console.log(`✅ Avanzado a paso ${nextStepIndex + 1}: ${tourSteps[nextStepIndex].title}`);
  };

  const handlePrevious = async () => {
    if (currentStepIndex > 0) {
      const previousStepIndex = currentStepIndex - 1;
      const previousStep = tourSteps[previousStepIndex];
      
      // Determinar qué página necesita el paso anterior
      const requiredPage = (() => {
        // Para pasos de contenido específicos
        if (previousStep.id === 'materias-content') return '/materias';
        if (previousStep.id === 'study-content') return '/study';
        if (previousStep.id === 'progress-content') return '/progress';
        if (previousStep.id === 'calendar-content') return '/calendar';
        
        // Si el paso anterior tenía navegación, usar esa página
        if (previousStep.actionTarget) return previousStep.actionTarget;
        
        // Por defecto, inicio
        return '/inicio';
      })();
      
      // Navegar a la página requerida si no estamos ahí
      if (window.location.pathname !== requiredPage) {
        console.log(`🎯 [ANTERIOR] Navegando a página requerida: ${requiredPage}`);
        navigate(requiredPage);
        
        // Esperar a que la navegación complete
        let attempts = 0;
        while (window.location.pathname !== requiredPage && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        console.log(`✅ [ANTERIOR] Navegación completada a ${requiredPage}`);
      }
      
      // Cambiar al paso anterior
      setCurrentStepIndex(previousStepIndex);
      setHasNavigated(false); // Resetear estado de navegación
      
      console.log(`⬅️ Retrocedido a paso ${previousStepIndex + 1}: ${previousStep.title}`);
    }
  };

  const handleSkip = async () => {
    try {
      console.log('🔄 Usuario saltó el tour - marcando como completado');
      setTourClosed(true);
      setIsVisible(false);
      
      if (demoMode) {
        console.log('🔄 Tour demo saltado - cerrando tour');
        onComplete();
        return;
      }

      // Marcar como completado permanentemente en localStorage y Firebase
      localStorage.removeItem('tourStep');
      console.log('🎯 Tour saltado - marcando como completado permanentemente');

      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { hasCompletedOnboarding: true }, { merge: true });
        console.log('✅ Estado de onboarding actualizado en Firebase');
      }
      
      onComplete();
      navigate('/inicio');
    } catch (error) {
      console.error('Error al saltar el tour:', error);
      // Aún así marcar como completado localmente
      setTourClosed(true);
      setIsVisible(false);
      onComplete();
    }
  };

  const completeTour = async () => {
    try {
      console.log('🎯 Cerrando tour permanentemente');
      setTourClosed(true); // Marcar que el tour fue cerrado intencionalmente
      setIsVisible(false);
      
      if (demoMode) {
        console.log('🎯 Tour demo completado - cerrando tour');
        onComplete();
        return;
      }

      // Solo en modo real, limpiar estado y completar
      localStorage.removeItem('tourStep');
      console.log('🎯 Tour real completado - estado limpio');

      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { hasCompletedOnboarding: true }, { merge: true });
      }
      onComplete();
      navigate('/inicio');
    } catch (error) {
      console.error('Error al completar el tour:', error);
      setTourClosed(true);
      setIsVisible(false);
      onComplete();
    }
  };

  const getClipPathForSpotlight = (): string => {
    if (!currentStep.targetSelector) return '';

    const element = document.querySelector(currentStep.targetSelector);
    if (!element) return '';

    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Crear un clip-path que excluya el área del spotlight
    const left = Math.max(0, rect.left - 6);
    const top = Math.max(0, rect.top - 6);
    const right = Math.min(viewportWidth, rect.right + 6);
    const bottom = Math.min(viewportHeight, rect.bottom + 6);

    // Crear un polygon que cubra toda la pantalla excepto el área del spotlight
    return `polygon(
      0% 0%, 
      0% 100%, 
      ${left}px 100%, 
      ${left}px ${top}px, 
      ${right}px ${top}px, 
      ${right}px ${bottom}px, 
      ${left}px ${bottom}px, 
      ${left}px 100%, 
      100% 100%, 
      100% 0%
    )`;
  };

  const getSpotlightPosition = (): React.CSSProperties => {
    if (!currentStep.targetSelector) return {};

    const element = document.querySelector(currentStep.targetSelector);
    if (!element) return {};

    const rect = element.getBoundingClientRect();
    return {
      top: rect.top - 6,
      left: rect.left - 6,
      width: rect.width + 12,
      height: rect.height + 12,
      background: 'transparent',
      backgroundColor: 'transparent',
    };
  };

  const getTooltipPosition = (): React.CSSProperties => {
    if (!currentStep.targetSelector) {
      // Centrado para pasos sin target
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // Para páginas completas (body o selectores múltiples), posicionar de forma segura
    if (currentStep.targetSelector === 'body' || currentStep.targetSelector?.includes('body')) {
      return {
        top: '30%', // Más arriba para evitar corte
        left: '50%',
        transform: 'translate(-50%, 0)', // Sin centrado vertical
        maxHeight: '70vh', // Limitar altura máxima
        overflowY: 'auto', // Scroll si es necesario
      };
    }

    // Intentar encontrar el elemento con selectores múltiples
    const selectors = currentStep.targetSelector?.split(', ') || [currentStep.targetSelector || ''];
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
        // Ajuste especial para paso 3 que se corta arriba
        const adjustedTop = currentStep.id === 'inicio-icon' ? 
          Math.max(rect.top + rect.height / 2, 200) : // Mínimo 200px desde arriba
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

  if (!isVisible || tourClosed) return null;

  console.log(`🎯 Tour - Paso actual: ${currentStepIndex + 1}/${tourSteps.length} - ${currentStep.title}`);

  return (
    <div 
      className="interactive-tour-overlay"
      onClick={(e) => {
        // Prevenir clics fuera del tooltip
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Fondo oscuro con recorte para el spotlight */}
      <div 
        className="tour-backdrop"
        style={currentStep.targetSelector ? {
          clipPath: getClipPathForSpotlight()
        } : {}}
      />
      
      {/* Spotlight que "recorta" el overlay oscuro */}
      <div 
        className={`tour-spotlight ${
          !currentStep.targetSelector ? 'tour-spotlight-center' : 
          (currentStep.targetSelector === 'body' || currentStep.targetSelector?.includes('body')) ? 'tour-spotlight-fullpage' : ''
        }`}
        style={currentStep.targetSelector && currentStep.targetSelector !== 'body' && !currentStep.targetSelector?.includes('body') ? getSpotlightPosition() : {}}
      />

      {/* Tooltip con contenido */}
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
          {demoMode && (
            <div className="demo-badge">MODO DEMO</div>
          )}
          <h3 className="tour-title">{currentStep.title}</h3>
          <p className="tour-description">{currentStep.description}</p>

          {/* Acciones */}
          <div className="tour-actions">
            <button 
              onClick={handleSkip}
              className="tour-skip-btn"
            >
              Saltar tour
            </button>
            
            <div className="tour-navigation">
              {currentStepIndex > 0 && (
                <button 
                  onClick={handlePrevious}
                  className="tour-prev-btn"
                >
                  Anterior
                </button>
              )}
              
              <button 
                onClick={handleNext}
                className="tour-next-btn"
                disabled={isNavigating}
              >
                {isNavigating ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Navegando...
                  </>
                ) : (
                  (() => {
                    if (currentStepIndex === tourSteps.length - 1) return 'Comenzar';
                    if (currentStep.action === 'navigate' && !hasNavigated) {
                      return `Ir a ${currentStep.actionTarget}`;
                    }
                    return 'Siguiente';
                  })()
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Flecha del tooltip */}
        <div className={`tour-arrow ${currentStep.position} ${currentStep.id === 'inicio-icon' ? 'inicio-icon-arrow' : ''}`} />
      </div>
    </div>
  );
};

export default InteractiveTour;