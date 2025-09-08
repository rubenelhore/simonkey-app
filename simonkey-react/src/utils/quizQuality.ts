import { ResponseQuality } from '../types/interfaces';

/**
 * Sistema de cálculo de calidad para Quiz Mode
 * Convierte métricas de rendimiento del quiz en calidad SM-3 (0-5)
 */

export interface QuizMetrics {
  correctAnswers: number;        // Número de respuestas correctas
  totalQuestions: number;        // Total de preguntas del quiz
  timeSpent: number;            // Tiempo total usado en segundos
  totalTime: number;            // Tiempo total disponible (600s)
  accuracy: number;             // Porcentaje de aciertos
  finalScore: number;           // Score final incluyendo bonus temporal
}

/**
 * Calcular la calidad SM-3 basada en métricas de Quiz
 */
export const calculateQuizQuality = (metrics: QuizMetrics): number => {
  let quality = 0;
  
  // Factor principal: Precisión (0-4 puntos)
  // 100% = 4, 80% = 3.2, 60% = 2.4, 40% = 1.6, 20% = 0.8, 0% = 0
  const accuracyScore = (metrics.accuracy / 100) * 4;
  quality += accuracyScore;
  
  // Factor secundario: Eficiencia temporal (0-1 punto)
  // Bonus por terminar rápido, pero sin penalizar mucho por ser lento
  const timeEfficiency = Math.max(0, (metrics.totalTime - metrics.timeSpent) / metrics.totalTime);
  const timeBonus = timeEfficiency * 1; // Máximo 1 punto por eficiencia
  quality += timeBonus;
  
  // Ajustes por rendimiento absoluto
  if (metrics.accuracy >= 90) {
    quality += 0.5; // Bonus por excelencia
  } else if (metrics.accuracy < 50) {
    quality = Math.max(quality - 0.5, 0.5); // Penalización, pero mínimo 0.5
  }
  
  // Asegurar que esté en el rango 0-5
  return Math.max(0, Math.min(5, quality));
};

/**
 * Convertir calidad SM-3 a ResponseQuality enum
 */
export const quizQualityToResponseQuality = (quality: number): ResponseQuality => {
  if (quality >= 3.5) {
    return ResponseQuality.MASTERED;
  } else {
    return ResponseQuality.REVIEW_LATER;
  }
};

/**
 * Obtener descripción del nivel de calidad para Quiz
 */
export const getQuizQualityDescription = (quality: number): string => {
  if (quality >= 4.5) return 'Excelente conocimiento';
  if (quality >= 3.5) return 'Buen dominio';
  if (quality >= 2.5) return 'Conocimiento parcial';
  if (quality >= 1.5) return 'Necesita refuerzo';
  return 'Requiere estudio adicional';
};

/**
 * Calcular calidad individual por concepto en base a la respuesta
 */
export interface ConceptQuizMetrics {
  conceptId: string;
  isCorrect: boolean;
  timeSpent: number;            // Tiempo en esta pregunta específica
  questionTimeLimit: number;    // Tiempo asignado por pregunta (ej: 60s)
  questionNumber: number;       // Número de pregunta (1-10)
  totalQuestions: number;       // Total de preguntas
}

export const calculateConceptQuizQuality = (metrics: ConceptQuizMetrics): number => {
  let quality = 0;
  
  // Factor principal: Correcta o incorrecta (0-3 puntos)
  if (metrics.isCorrect) {
    quality = 3.5; // Base para respuesta correcta
  } else {
    quality = 1.5; // Base para respuesta incorrecta
  }
  
  // Factor temporal solo para respuestas correctas
  if (metrics.isCorrect && metrics.timeSpent > 0) {
    // Bonus por rapidez (máximo 1.5 puntos adicionales)
    const timeEfficiency = Math.max(0, (metrics.questionTimeLimit - metrics.timeSpent) / metrics.questionTimeLimit);
    const timeBonus = timeEfficiency * 1.5;
    quality += timeBonus;
  }
  
  // Penalización leve por respuestas incorrectas tardías
  if (!metrics.isCorrect && metrics.timeSpent > metrics.questionTimeLimit * 0.8) {
    quality = Math.max(quality - 0.3, 0.5);
  }
  
  // Asegurar que esté en el rango 0-5
  return Math.max(0, Math.min(5, quality));
};

/**
 * Determinar qué conceptos actualizar con SM-3 basado en el quiz
 */
export interface QuizConceptUpdate {
  conceptId: string;
  quality: number;
  shouldUpdate: boolean;
  reason: string;
}

export const getConceptsToUpdate = (
  questionResults: ConceptQuizMetrics[],
  overallQuizMetrics: QuizMetrics
): QuizConceptUpdate[] => {
  const conceptUpdates: QuizConceptUpdate[] = [];
  
  // Calcular calidad general del quiz
  const overallQuality = calculateQuizQuality(overallQuizMetrics);
  
  questionResults.forEach(questionMetric => {
    const conceptQuality = calculateConceptQuizQuality(questionMetric);
    
    // Estrategia: Actualizar conceptos según su rendimiento individual
    // pero con influencia de la calidad general del quiz
    
    let finalQuality = conceptQuality;
    
    // Si el quiz general fue muy bueno, dar un pequeño boost a conceptos correctos
    if (overallQuizMetrics.accuracy >= 80 && questionMetric.isCorrect) {
      finalQuality = Math.min(5, finalQuality + 0.3);
    }
    
    // Si el quiz general fue malo, ser más conservador con conceptos incorrectos
    if (overallQuizMetrics.accuracy < 60 && !questionMetric.isCorrect) {
      finalQuality = Math.max(0.5, finalQuality - 0.2);
    }
    
    conceptUpdates.push({
      conceptId: questionMetric.conceptId,
      quality: finalQuality,
      shouldUpdate: true, // Siempre actualizar conceptos que aparecieron en quiz
      reason: questionMetric.isCorrect 
        ? `Respuesta correcta (calidad: ${finalQuality.toFixed(1)})`
        : `Respuesta incorrecta (calidad: ${finalQuality.toFixed(1)})`
    });
  });
  
  return conceptUpdates;
};