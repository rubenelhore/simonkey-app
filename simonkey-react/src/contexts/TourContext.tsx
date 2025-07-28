import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  action?: 'navigate' | 'highlight' | 'none';
  actionTarget?: string;
}

interface TourContextType {
  currentStepIndex: number;
  setCurrentStepIndex: (index: number) => void;
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  isNavigating: boolean;
  setIsNavigating: (navigating: boolean) => void;
  tourSteps: TourStep[];
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  restartTour: () => void;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: '¡Bienvenido a Simonkey! 🐒',
    description: 'Tu asistente de estudio inteligente que te ayudará a aprender de manera más eficiente. Te guiaremos paso a paso por cada módulo.',
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
    targetSelector: 'button[title="Pagina principal"]',
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
    description: 'Has explorado todos los módulos de Simonkey: Inicio, Materias, Estudio, Progreso y Calendario. ¡Ahora estás listo para comenzar tu experiencia de aprendizaje personalizada!',
    position: 'center',
    action: 'navigate',
    actionTarget: '/inicio'
  }
];

const TourContext = createContext<TourContextType | undefined>(undefined);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(true); // Tour activo por defecto en demo
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();

  const nextStep = async () => {
    console.log(`🎯 NextStep - Paso actual: ${currentStepIndex + 1}/${tourSteps.length}`);
    
    const currentStep = tourSteps[currentStepIndex];
    
    // Si es el último paso y tiene navegación, navegar y completar tour
    if (currentStepIndex >= tourSteps.length - 1) {
      if (currentStep.action === 'navigate' && currentStep.actionTarget) {
        console.log(`🔄 Último paso - navegando a: ${currentStep.actionTarget} y completando tour`);
        navigate(currentStep.actionTarget);
        
        // Esperar navegación y luego completar tour
        setTimeout(() => {
          console.log(`🎯 Tour completado después de navegación final`);
          setIsActive(false);
        }, 500);
      } else {
        // Completar tour sin navegación
        console.log(`🎯 Tour completado - desactivando`);
        setIsActive(false);
      }
      return;
    }
    
    // Si necesita navegación, navegar primero
    if (currentStep.action === 'navigate' && currentStep.actionTarget) {
      setIsNavigating(true);
      console.log(`🔄 Navegando a: ${currentStep.actionTarget}`);
      
      navigate(currentStep.actionTarget);
      
      // Esperar navegación y luego avanzar
      setTimeout(() => {
        setCurrentStepIndex(currentStepIndex + 1);
        setIsNavigating(false);
        console.log(`✅ Avanzado al paso ${currentStepIndex + 2}`);
      }, 1000);
    } else {
      // Avanzar directamente
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const skipTour = () => {
    console.log('🔄 Usuario saltó el tour');
    setIsActive(false);
  };

  const restartTour = () => {
    console.log('🔄 Reiniciando tour');
    setCurrentStepIndex(0);
    setIsActive(true);
    setIsNavigating(false);
    navigate('/inicio');
  };

  // Función global para reiniciar (disponible en window)
  useEffect(() => {
    (window as any).restartTour = restartTour;
    console.log('🎮 Tour en modo demo. Ejecuta window.restartTour() para reiniciar');
  }, []);

  const value: TourContextType = {
    currentStepIndex,
    setCurrentStepIndex,
    isActive,
    setIsActive,
    isNavigating,
    setIsNavigating,
    tourSteps,
    nextStep,
    prevStep,
    skipTour,
    restartTour
  };

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
};

export const useTour = (): TourContextType => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};