import { ResponseQuality } from '../types/interfaces';

/**
 * Sistema de cálculo de calidad para Quiz Mode
 * Convierte métricas de rendimiento del quiz en calidad SM-3 (0-5)
 * 
 * AJUSTE IMPORTANTE: Los quizzes ya no otorgan dominio automático
 * - El dominio requiere múltiples repasos exitosos (al menos 2)
 * - Los quizzes contribuyen al aprendizaje pero no marcan conceptos como dominados
 * - Se requiere estudio inteligente adicional para alcanzar el dominio real
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
 * AJUSTE: Los quizzes ya no marcan conceptos como dominados automáticamente
 * Se requieren múltiples repasos exitosos para dominio real
 */
export const quizQualityToResponseQuality = (quality: number): ResponseQuality => {
  // Los quizzes solo pueden mejorar el aprendizaje, pero no marcar como dominado
  // El dominio real se logra a través de múltiples sesiones de estudio inteligente
  return ResponseQuality.REVIEW_LATER;
};

/**
 * Obtener descripción del nivel de calidad para Quiz
 * AJUSTADO: Rangos actualizados para reflejar el nuevo sistema de calificación
 */
export const getQuizQualityDescription = (quality: number): string => {
  if (quality >= 3.0) return 'Muy buen rendimiento (necesita repaso adicional para dominio)';
  if (quality >= 2.5) return 'Buen rendimiento';
  if (quality >= 2.0) return 'Conocimiento parcial';
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
  
  // Factor principal: Correcta o incorrecta (valores más conservadores)
  if (metrics.isCorrect) {
    quality = 2.5; // Base más baja para respuesta correcta (era 3.5)
  } else {
    quality = 1.0; // Base más baja para respuesta incorrecta (era 1.5)
  }
  
  // Factor temporal solo para respuestas correctas
  if (metrics.isCorrect && metrics.timeSpent > 0) {
    // Bonus por rapidez muy reducido (máximo 0.8 puntos adicionales, era 1.5)
    const timeEfficiency = Math.max(0, (metrics.questionTimeLimit - metrics.timeSpent) / metrics.questionTimeLimit);
    const timeBonus = timeEfficiency * 0.8;
    quality += timeBonus;
  }
  
  // Penalización mayor por respuestas incorrectas tardías
  if (!metrics.isCorrect && metrics.timeSpent > metrics.questionTimeLimit * 0.8) {
    quality = Math.max(quality - 0.5, 0.3);
  }
  
  // Asegurar que esté en el rango 0-5
  // Los quizzes ahora tienen un máximo efectivo de 3.3 (2.5 + 0.8)
  // lo cual está por debajo del umbral de dominio (≥3.5)
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
    
    // NUEVA ESTRATEGIA: Los quizzes contribuyen al aprendizaje pero no otorgan dominio inmediato
    // El dominio se logra con múltiples repasos exitosos en estudio inteligente
    
    let finalQuality = conceptQuality;
    
    // Reducir bonificaciones para evitar dominio automático
    if (overallQuizMetrics.accuracy >= 90 && questionMetric.isCorrect) {
      finalQuality = Math.min(3.2, finalQuality + 0.2); // Máximo 3.2 (< umbral 3.5)
    } else if (overallQuizMetrics.accuracy >= 80 && questionMetric.isCorrect) {
      finalQuality = Math.min(3.1, finalQuality + 0.1); // Máximo 3.1 (< umbral 3.5)
    }
    
    // Penalizar más fuertemente conceptos incorrectos
    if (overallQuizMetrics.accuracy < 60 && !questionMetric.isCorrect) {
      finalQuality = Math.max(0.3, finalQuality - 0.3);
    }
    
    // Asegurar que nunca se alcance el umbral de dominio (3.5)
    finalQuality = Math.min(3.4, finalQuality);
    
    conceptUpdates.push({
      conceptId: questionMetric.conceptId,
      quality: finalQuality,
      shouldUpdate: true, // Siempre actualizar conceptos que aparecieron en quiz
      reason: questionMetric.isCorrect 
        ? `Respuesta correcta en quiz (calidad: ${finalQuality.toFixed(1)} - requiere más repasos para dominio)`
        : `Respuesta incorrecta en quiz (calidad: ${finalQuality.toFixed(1)})`
    });
  });
  
  return conceptUpdates;
};