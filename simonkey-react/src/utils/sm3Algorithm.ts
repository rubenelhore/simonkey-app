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
  today.setHours(23, 59, 59, 999); // Incluir todo el día de hoy
  
  const readyConcepts = learningDataArray.filter(data => {
    // Convertir nextReviewDate a Date si es necesario
    let reviewDate: Date;
    
    if (data.nextReviewDate instanceof Date) {
      reviewDate = data.nextReviewDate;
    } else if (data.nextReviewDate && typeof data.nextReviewDate === 'object' && 'toDate' in data.nextReviewDate) {
      // Es un Timestamp de Firebase
      reviewDate = (data.nextReviewDate as any).toDate();
    } else if (typeof data.nextReviewDate === 'string') {
      reviewDate = new Date(data.nextReviewDate);
    } else {
      // Si no hay fecha válida, considerar disponible
      console.warn('⚠️ Concepto sin nextReviewDate válido:', data.conceptId);
      return true;
    }
    
    // Comparar las fechas
    const isReady = reviewDate <= today;
    
    if (!isReady) {
      // Calcular días hasta próximo repaso
      const daysUntilReview = Math.ceil((reviewDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      console.log(`📅 Concepto ${data.conceptId} disponible en ${daysUntilReview} días`);
    }
    
    return isReady;
  });
  
  console.log(`✅ ${readyConcepts.length} conceptos listos para repaso hoy de ${learningDataArray.length} totales con datos`);
  
  return readyConcepts;
};

/**
 * Obtener conceptos disponibles para estudio (incluye próximos si no hay suficientes)
 */
export const getAvailableConceptsForStudy = (
  learningDataArray: LearningData[],
  minConcepts: number = 5
): LearningData[] => {
  // Primero obtener los que están listos hoy
  const readyToday = getConceptsReadyForReview(learningDataArray);
  
  if (readyToday.length >= minConcepts) {
    return readyToday;
  }
  
  // Si no hay suficientes, incluir los próximos a vencer
  const now = new Date();
  const conceptsWithDates = learningDataArray.map(data => {
    let reviewDate: Date;
    
    if (data.nextReviewDate instanceof Date) {
      reviewDate = data.nextReviewDate;
    } else if (data.nextReviewDate && typeof data.nextReviewDate === 'object' && 'toDate' in data.nextReviewDate) {
      reviewDate = (data.nextReviewDate as any).toDate();
    } else if (typeof data.nextReviewDate === 'string') {
      reviewDate = new Date(data.nextReviewDate);
    } else {
      reviewDate = now; // Si no hay fecha, considerar disponible ahora
    }
    
    return {
      ...data,
      reviewDateObj: reviewDate,
      daysUntilReview: Math.max(0, Math.ceil((reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    };
  });
  
  // Ordenar por proximidad de fecha de repaso
  conceptsWithDates.sort((a, b) => a.daysUntilReview - b.daysUntilReview);
  
  // Tomar al menos minConcepts o todos los disponibles
  const availableConcepts = conceptsWithDates.slice(0, Math.max(minConcepts, readyToday.length));
  
  console.log(`📚 Conceptos disponibles para estudio: ${availableConcepts.length}`);
  console.log(`   - Listos hoy: ${readyToday.length}`);
  console.log(`   - Próximos incluidos: ${availableConcepts.length - readyToday.length}`);
  
  return availableConcepts;
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
  if (learningDataArray.length === 0) {
    return null;
  }
  
  const readyForReview = getConceptsReadyForReview(learningDataArray);
  
  if (readyForReview.length > 0) {
    return new Date(); // Hay conceptos listos para hoy
  }
  
  // Encontrar la próxima fecha más cercana
  const now = new Date();
  const futureDates = learningDataArray
    .map(data => new Date(data.nextReviewDate))
    .filter(date => date > now)
    .sort((a, b) => a.getTime() - b.getTime());
  
  if (futureDates.length > 0) {
    return futureDates[0]; // La primera es la más cercana porque está ordenada
  } else {
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
  if (!lastQuizDate) {
    return true;
  }
  
  const today = new Date();
  const lastQuiz = new Date(lastQuizDate);
  
  // Calcular diferencia en días
  const diffTime = today.getTime() - lastQuiz.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 7;
};

/**
 * Verificar si el estudio libre está disponible hoy
 */
export const isFreeStudyAvailable = (lastFreeStudyDate?: Date): boolean => {
  if (!lastFreeStudyDate) {
    return true;
  }
  
  const today = new Date();
  const lastStudy = new Date(lastFreeStudyDate);
  
  today.setHours(0, 0, 0, 0);
  lastStudy.setHours(0, 0, 0, 0);
  
  return today.getTime() !== lastStudy.getTime();
}; 