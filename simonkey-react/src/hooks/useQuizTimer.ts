import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  QuizTimerState, 
  QuizTimerConfig 
} from '../types/interfaces';
import { 
  DEFAULT_QUIZ_TIMER_CONFIG,
  createInitialTimerState,
  updateTimerState,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  resetTimer,
  formatTime,
  getTimerStateClass,
  getTimerColor,
  calculateTimerProgress,
  isTimeUp
} from '../utils/quizTimer';

interface UseQuizTimerOptions {
  config?: QuizTimerConfig;
  onTimeUp?: () => void;
  onWarning?: () => void;
  onCritical?: () => void;
  autoStart?: boolean;
}

export const useQuizTimer = (options: UseQuizTimerOptions = {}) => {
  const {
    config = DEFAULT_QUIZ_TIMER_CONFIG,
    onTimeUp,
    onWarning,
    onCritical,
    autoStart = false
  } = options;

  const [timerState, setTimerState] = useState<QuizTimerState>(() => 
    createInitialTimerState(config)
  );
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastWarningRef = useRef<boolean>(false);
  const lastCriticalRef = useRef<boolean>(false);

  // Función para actualizar el estado del timer
  const updateState = useCallback(() => {
    setTimerState(prevState => {
      const newState = updateTimerState(prevState, config);
      
      // Verificar si se debe llamar a los callbacks
      if (newState.isWarning && !lastWarningRef.current && onWarning) {
        onWarning();
      }
      
      if (newState.isCritical && !lastCriticalRef.current && onCritical) {
        onCritical();
      }
      
      if (isTimeUp(newState.timeRemaining) && onTimeUp) {
        onTimeUp();
      }
      
      lastWarningRef.current = newState.isWarning;
      lastCriticalRef.current = newState.isCritical;
      
      return newState;
    });
  }, [config, onTimeUp, onWarning, onCritical]);

  // Iniciar el timer
  const start = useCallback(() => {
    setTimerState(prevState => {
      const newState = startTimer(prevState);
      
      // Limpiar intervalo anterior si existe
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Iniciar nuevo intervalo
      intervalRef.current = setInterval(updateState, 1000);
      
      return newState;
    });
  }, [updateState]);

  // Pausar el timer
  const pause = useCallback(() => {
    setTimerState(prevState => pauseTimer(prevState));
  }, []);

  // Reanudar el timer
  const resume = useCallback(() => {
    setTimerState(prevState => resumeTimer(prevState));
  }, []);

  // Detener el timer
  const stop = useCallback(() => {
    setTimerState(prevState => stopTimer(prevState));
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Resetear el timer
  const reset = useCallback(() => {
    setTimerState(createInitialTimerState(config));
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    lastWarningRef.current = false;
    lastCriticalRef.current = false;
  }, [config]);

  // Limpiar intervalo al desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Auto-iniciar si está configurado
  useEffect(() => {
    if (autoStart) {
      start();
    }
  }, [autoStart, start]);

  // Formatear tiempo actual
  const formattedTime = formatTime(timerState.timeRemaining);
  
  // Clase CSS para el estado
  const timerClass = getTimerStateClass(timerState);
  
  // Color del timer
  const timerColor = getTimerColor(timerState);
  
  // Progreso del timer
  const progress = calculateTimerProgress(timerState.timeRemaining, config.totalTime);

  return {
    // Estado
    timerState,
    timeRemaining: timerState.timeRemaining,
    isRunning: timerState.isRunning,
    isPaused: timerState.isPaused,
    isWarning: timerState.isWarning,
    isCritical: timerState.isCritical,
    isTimeUp: isTimeUp(timerState.timeRemaining),
    
    // Acciones
    start,
    pause,
    resume,
    stop,
    reset,
    
    // Utilidades
    formattedTime,
    timerClass,
    timerColor,
    progress,
    
    // Configuración
    config
  };
}; 