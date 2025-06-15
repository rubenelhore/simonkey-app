import { QuizTimerState, QuizTimerConfig } from '../types/interfaces';

/**
 * Configuración por defecto del timer de quiz
 */
export const DEFAULT_QUIZ_TIMER_CONFIG: QuizTimerConfig = {
  totalTime: 600,           // 10 minutos en segundos
  warningThreshold: 60,     // Advertencia a 1 minuto
  criticalThreshold: 30,    // Crítico a 30 segundos
  autoSubmit: true          // Enviar automáticamente al agotarse el tiempo
};

/**
 * Crear estado inicial del timer
 */
export const createInitialTimerState = (
  config: QuizTimerConfig = DEFAULT_QUIZ_TIMER_CONFIG
): QuizTimerState => {
  return {
    timeRemaining: config.totalTime,
    isRunning: false,
    isPaused: false,
    isWarning: false,
    isCritical: false,
    startTime: new Date(),
    endTime: undefined
  };
};

/**
 * Actualizar estado del timer
 */
export const updateTimerState = (
  currentState: QuizTimerState,
  config: QuizTimerConfig = DEFAULT_QUIZ_TIMER_CONFIG
): QuizTimerState => {
  const now = new Date();
  const elapsed = currentState.isRunning && !currentState.isPaused
    ? Math.floor((now.getTime() - currentState.startTime.getTime()) / 1000)
    : 0;
  
  const newTimeRemaining = Math.max(0, config.totalTime - elapsed);
  
  return {
    ...currentState,
    timeRemaining: newTimeRemaining,
    isWarning: newTimeRemaining <= config.warningThreshold && newTimeRemaining > config.criticalThreshold,
    isCritical: newTimeRemaining <= config.criticalThreshold,
    endTime: newTimeRemaining === 0 ? now : currentState.endTime
  };
};

/**
 * Iniciar el timer
 */
export const startTimer = (currentState: QuizTimerState): QuizTimerState => {
  return {
    ...currentState,
    isRunning: true,
    isPaused: false,
    startTime: new Date()
  };
};

/**
 * Pausar el timer
 */
export const pauseTimer = (currentState: QuizTimerState): QuizTimerState => {
  return {
    ...currentState,
    isPaused: true
  };
};

/**
 * Reanudar el timer
 */
export const resumeTimer = (currentState: QuizTimerState): QuizTimerState => {
  return {
    ...currentState,
    isRunning: true,
    isPaused: false,
    startTime: new Date(Date.now() - (DEFAULT_QUIZ_TIMER_CONFIG.totalTime - currentState.timeRemaining) * 1000)
  };
};

/**
 * Detener el timer
 */
export const stopTimer = (currentState: QuizTimerState): QuizTimerState => {
  return {
    ...currentState,
    isRunning: false,
    isPaused: false,
    endTime: new Date()
  };
};

/**
 * Resetear el timer
 */
export const resetTimer = (
  config: QuizTimerConfig = DEFAULT_QUIZ_TIMER_CONFIG
): QuizTimerState => {
  return createInitialTimerState(config);
};

/**
 * Formatear tiempo en formato MM:SS
 */
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Formatear tiempo con unidades
 */
export const formatTimeWithUnits = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
};

/**
 * Calcular puntuación basada en tiempo restante
 */
export const calculateTimeBonus = (
  baseScore: number,
  timeRemaining: number,
  totalTime: number = 600
): number => {
  // La puntuación es el score base multiplicado por el tiempo restante
  return baseScore * timeRemaining;
};

/**
 * Calcular puntuación final del quiz
 */
export const calculateFinalQuizScore = (
  correctAnswers: number,
  totalQuestions: number,
  timeRemaining: number,
  totalTime: number = 600
): {
  baseScore: number;
  timeBonus: number;
  finalScore: number;
} => {
  const baseScore = correctAnswers;
  const timeBonus = calculateTimeBonus(baseScore, timeRemaining, totalTime);
  const finalScore = Math.max(baseScore, timeBonus);
  
  return {
    baseScore,
    timeBonus,
    finalScore
  };
};

/**
 * Verificar si el timer debe mostrar advertencia
 */
export const shouldShowWarning = (
  timeRemaining: number,
  config: QuizTimerConfig = DEFAULT_QUIZ_TIMER_CONFIG
): boolean => {
  return timeRemaining <= config.warningThreshold && timeRemaining > config.criticalThreshold;
};

/**
 * Verificar si el timer debe mostrar estado crítico
 */
export const shouldShowCritical = (
  timeRemaining: number,
  config: QuizTimerConfig = DEFAULT_QUIZ_TIMER_CONFIG
): boolean => {
  return timeRemaining <= config.criticalThreshold;
};

/**
 * Verificar si el tiempo se ha agotado
 */
export const isTimeUp = (timeRemaining: number): boolean => {
  return timeRemaining <= 0;
};

/**
 * Obtener clase CSS para el estado del timer
 */
export const getTimerStateClass = (timerState: QuizTimerState): string => {
  if (timerState.isCritical) return 'timer-critical';
  if (timerState.isWarning) return 'timer-warning';
  if (timerState.isPaused) return 'timer-paused';
  return 'timer-normal';
};

/**
 * Obtener color para el timer basado en el estado
 */
export const getTimerColor = (timerState: QuizTimerState): string => {
  if (timerState.isCritical) return '#EF4444'; // Rojo
  if (timerState.isWarning) return '#F59E0B';  // Amarillo
  if (timerState.isPaused) return '#6B7280';   // Gris
  return '#10B981'; // Verde
};

/**
 * Calcular progreso del timer (0-100)
 */
export const calculateTimerProgress = (
  timeRemaining: number,
  totalTime: number = 600
): number => {
  return ((totalTime - timeRemaining) / totalTime) * 100;
};

/**
 * Hook personalizado para el timer (para usar en componentes)
 */
export const useQuizTimer = (
  config: QuizTimerConfig = DEFAULT_QUIZ_TIMER_CONFIG,
  onTimeUp?: () => void
) => {
  let intervalId: NodeJS.Timeout | null = null;
  
  const start = (initialState: QuizTimerState) => {
    if (intervalId) clearInterval(intervalId);
    
    const startState = startTimer(initialState);
    
    intervalId = setInterval(() => {
      const updatedState = updateTimerState(startState, config);
      
      if (isTimeUp(updatedState.timeRemaining)) {
        if (config.autoSubmit && onTimeUp) {
          onTimeUp();
        }
        if (intervalId) clearInterval(intervalId);
      }
    }, 1000);
    
    return startState;
  };
  
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
  
  return {
    start,
    stop,
    updateTimerState: (state: QuizTimerState) => updateTimerState(state, config),
    formatTime,
    getTimerStateClass,
    getTimerColor,
    calculateTimerProgress
  };
}; 