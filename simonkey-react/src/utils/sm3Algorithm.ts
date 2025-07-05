import { LearningData } from '../types/interfaces';

/**
 * Implementación del algoritmo SM-3 (SuperMemo 3)
 * Más moderno y eficiente que SM-2
 */

export interface SM3Params {
  quality: number;        // Calidad de la respuesta (0-5)
  repetitions: number;    // Número de repeticiones exitosas consecutivas
  easeFactor: number;     // Factor de facilidad actual
  interval: number;       // Intervalo actual en días
}

export interface SM3Result {
  newInterval: number;    // Nuevo intervalo en días
  newEaseFactor: number;  // Nuevo factor de facilidad
  nextReviewDate: Date;   // Próxima fecha de repaso
  repetitions: number;    // Nuevo número de repeticiones
}

/**
 * Calcular el nuevo intervalo usando SM-3
 */
export const calculateSM3Interval = (params: SM3Params): SM3Result => {
  const { quality, repetitions, easeFactor, interval } = params;
  
  console.log('🧮🧮🧮 ALGORITMO SM-3 INICIADO 🧮🧮🧮');
  console.log('Quality recibido:', quality);
  console.log('Repetitions actuales:', repetitions);
  console.log('EaseFactor actual:', easeFactor);
  console.log('Interval actual:', interval);
  
  let newInterval: number;
  let newEaseFactor: number;
  let newRepetitions: number;

  // Calcular nuevo factor de facilidad
  newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Asegurar que el factor de facilidad no sea menor que 1.3
  newEaseFactor = Math.max(1.3, newEaseFactor);

  // Calcular nuevo intervalo basado en la calidad
  if (quality < 3) {
    // Respuesta incorrecta o difícil
    newRepetitions = 0;
    newInterval = 1; // Repasar mañana
  } else {
    // Respuesta correcta
    newRepetitions = repetitions + 1;
    
    if (newRepetitions === 1) {
      newInterval = 1; // Primera repetición: mañana
    } else if (newRepetitions === 2) {
      newInterval = 6; // Segunda repetición: en 6 días
    } else {
      // Tercera repetición en adelante
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  // Calcular próxima fecha de repaso
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  const result = {
    newInterval,
    newEaseFactor,
    nextReviewDate,
    repetitions: newRepetitions
  };
  
  console.log('🧮🧮🧮 RESULTADO SM-3 🧮🧮🧮');
  console.log('Nuevo intervalo:', newInterval, 'días');
  console.log('Nuevo EaseFactor:', newEaseFactor);
  console.log('Nuevas repeticiones:', newRepetitions);
  console.log('Próxima fecha de repaso:', nextReviewDate.toLocaleDateString());
  console.log('🧮🧮🧮 FIN ALGORITMO SM-3 🧮🧮🧮');

  return result;
};

/**
 * Actualizar datos de aprendizaje con SM-3
 */
export const updateLearningData = (
  currentData: LearningData,
  quality: number
): LearningData => {
  const sm3Result = calculateSM3Interval({
    quality,
    repetitions: currentData.repetitions,
    easeFactor: currentData.easeFactor,
    interval: currentData.interval
  });

  return {
    ...currentData,
    easeFactor: sm3Result.newEaseFactor,
    interval: sm3Result.newInterval,
    repetitions: sm3Result.repetitions,
    nextReviewDate: sm3Result.nextReviewDate,
    lastReviewDate: new Date(),
    quality
  };
};

/**
 * Crear datos de aprendizaje iniciales para un nuevo concepto
 */
export const createInitialLearningData = (conceptId: string): LearningData => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Establecer a inicio del día para que coincida con la lógica de comparación
  
  return {
    conceptId,
    easeFactor: 2.5,        // Factor de facilidad inicial
    interval: 1,            // Intervalo inicial: 1 día
    repetitions: 0,         // Sin repeticiones aún
    nextReviewDate: today,  // HOY - disponible inmediatamente para estudio inteligente
    lastReviewDate: new Date(),
    quality: 0,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0
  };
};

/**
 * Verificar si un concepto está listo para repaso
 */
export const isConceptReadyForReview = (learningData: LearningData): boolean => {
  const now = new Date();
  return now >= learningData.nextReviewDate;
};

/**
 * Obtener conceptos listos para repaso hoy
 */
export const getConceptsReadyForReview = (
  learningDataArray: LearningData[]
): LearningData[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log('🔍 DEBUG getConceptsReadyForReview:', {
    totalConcepts: learningDataArray.length,
    today: today.toISOString(),
    learningData: learningDataArray.map(data => ({
      conceptId: data.conceptId,
      nextReviewDate: data.nextReviewDate.toISOString(),
      reviewDateNormalized: new Date(data.nextReviewDate).setHours(0, 0, 0, 0),
      todayNormalized: today.getTime(),
      isReady: new Date(data.nextReviewDate).setHours(0, 0, 0, 0) <= today.getTime()
    }))
  });
  
  const readyConcepts = learningDataArray.filter(data => {
    const reviewDate = new Date(data.nextReviewDate);
    reviewDate.setHours(0, 0, 0, 0);
    return reviewDate <= today;
  });
  
  console.log('✅ Conceptos listos para repaso:', readyConcepts.length);
  
  return readyConcepts;
};

/**
 * Calcular estadísticas de aprendizaje
 */
export const calculateLearningStats = (
  learningDataArray: LearningData[]
): {
  totalConcepts: number;
  readyForReview: number;
  dueToday: number;
  dueTomorrow: number;
  averageEaseFactor: number;
  averageInterval: number;
} => {
  const totalConcepts = learningDataArray.length;
  const readyForReview = getConceptsReadyForReview(learningDataArray).length;
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dueToday = learningDataArray.filter(data => {
    const reviewDate = new Date(data.nextReviewDate);
    reviewDate.setHours(0, 0, 0, 0);
    return reviewDate.getTime() === today.getTime();
  }).length;
  
  const dueTomorrow = learningDataArray.filter(data => {
    const reviewDate = new Date(data.nextReviewDate);
    reviewDate.setHours(0, 0, 0, 0);
    return reviewDate.getTime() === tomorrow.getTime();
  }).length;
  
  const averageEaseFactor = learningDataArray.length > 0 
    ? learningDataArray.reduce((sum, data) => sum + data.easeFactor, 0) / learningDataArray.length
    : 2.5;
  
  const averageInterval = learningDataArray.length > 0
    ? learningDataArray.reduce((sum, data) => sum + data.interval, 0) / learningDataArray.length
    : 1;

  return {
    totalConcepts,
    readyForReview,
    dueToday,
    dueTomorrow,
    averageEaseFactor,
    averageInterval
  };
};

/**
 * Calcular la próxima fecha de estudio inteligente
 */
export const getNextSmartStudyDate = (
  learningDataArray: LearningData[]
): Date | null => {
  console.log('🔍 getNextSmartStudyDate llamado con:', learningDataArray.length, 'conceptos');
  
  if (learningDataArray.length === 0) {
    console.log('❌ No hay conceptos, retornando null');
    return null;
  }
  
  const readyForReview = getConceptsReadyForReview(learningDataArray);
  console.log('🔍 Conceptos listos para repaso hoy:', readyForReview.length);
  
  if (readyForReview.length > 0) {
    console.log('✅ Hay conceptos listos para hoy, retornando fecha actual');
    return new Date(); // Hay conceptos listos para hoy
  }
  
  // Encontrar la próxima fecha más cercana
  const now = new Date();
  const futureDates = learningDataArray
    .map(data => new Date(data.nextReviewDate))
    .filter(date => date > now)
    .sort((a, b) => a.getTime() - b.getTime());
  
  console.log('🔍 Fechas futuras encontradas:', futureDates.length);
  console.log('🔍 Detalle de fechas futuras:', futureDates.map(date => ({
    date: date.toISOString(),
    daysFromNow: Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  })));
  
  if (futureDates.length > 0) {
    const nextDate = futureDates[0]; // La primera es la más cercana porque está ordenada
    const daysFromNow = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    console.log('📅 Próxima fecha de estudio inteligente:', {
      date: nextDate.toISOString(),
      daysFromNow: daysFromNow,
      formatted: `${daysFromNow} días desde hoy`
    });
    return nextDate;
  } else {
    console.log('❌ No hay fechas futuras, retornando null');
    return null;
  }
};

/**
 * Calcular la próxima fecha de quiz (máximo 1 por semana - GLOBAL)
 */
export const getNextQuizDate = (lastQuizDate?: Date): Date => {
  const now = new Date();
  
  if (!lastQuizDate) {
    // Si nunca ha hecho quiz, puede hacerlo hoy
    return now;
  }
  
  // CORRECCIÓN: Calcular la próxima semana desde el último quiz (7 días exactos)
  const nextQuizDate = new Date(lastQuizDate);
  nextQuizDate.setDate(nextQuizDate.getDate() + 7);
  
  // Si ya pasó una semana, puede hacer quiz hoy
  if (nextQuizDate <= now) {
    return now;
  }
  
  return nextQuizDate;
};

/**
 * Verificar si el quiz está disponible (máximo 1 cada 7 días - GLOBAL)
 */
export const isQuizAvailable = (lastQuizDate?: Date): boolean => {
  console.log('🔍 isQuizAvailable llamado con:', lastQuizDate);
  
  if (!lastQuizDate) {
    console.log('✅ No hay lastQuizDate, quiz disponible');
    return true;
  }
  
  const today = new Date();
  const lastQuiz = new Date(lastQuizDate);
  
  // Calcular diferencia en días
  const diffTime = today.getTime() - lastQuiz.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const isAvailable = diffDays >= 7;
  
  console.log('🔍 Cálculo de disponibilidad de quiz:', {
    today: today.toISOString(),
    lastQuiz: lastQuiz.toISOString(),
    diffDays: diffDays,
    isAvailable: isAvailable,
    requirement: 'Debe pasar al menos 7 días'
  });
  
  return isAvailable;
};

/**
 * Verificar si el estudio libre está disponible hoy
 */
export const isFreeStudyAvailable = (lastFreeStudyDate?: Date): boolean => {
  console.log('🔍 isFreeStudyAvailable llamado con:', lastFreeStudyDate);
  
  if (!lastFreeStudyDate) {
    console.log('✅ No hay lastFreeStudyDate, estudio libre disponible');
    return true;
  }
  
  const today = new Date();
  const lastStudy = new Date(lastFreeStudyDate);
  
  today.setHours(0, 0, 0, 0);
  lastStudy.setHours(0, 0, 0, 0);
  
  const isAvailable = today.getTime() !== lastStudy.getTime();
  
  console.log('🔍 Cálculo de disponibilidad:', {
    today: today.toISOString(),
    lastStudy: lastStudy.toISOString(),
    todayTime: today.getTime(),
    lastStudyTime: lastStudy.getTime(),
    isAvailable: isAvailable
  });
  
  return isAvailable;
}; 