import { ResponseQuality } from '../types/interfaces';

/**
 * Sistema de cálculo de calidad para Estudio Activo
 * Convierte métricas de rendimiento en calidad SM-3 (0-5)
 */

export interface ActiveStudyMetrics {
  attempts: number;           // Número de intentos para responder correctamente
  timeSpent: number;         // Tiempo en segundos para responder
  hintsUsed: number;        // Número de pistas usadas
  correctOnFirstTry: boolean; // Si acertó en el primer intento
  partialCorrect?: boolean;  // Si la respuesta fue parcialmente correcta
}

/**
 * Calcular la calidad SM-3 basada en métricas de Estudio Activo
 */
export const calculateActiveStudyQuality = (metrics: ActiveStudyMetrics): number => {
  let quality = 5; // Empezar con calidad perfecta
  
  // Penalización por intentos múltiples
  if (metrics.attempts > 1) {
    quality -= Math.min((metrics.attempts - 1) * 0.5, 2); // -0.5 por intento extra, máximo -2
  }
  
  // Penalización por tiempo excesivo (más de 30 segundos)
  if (metrics.timeSpent > 30) {
    const extraTime = metrics.timeSpent - 30;
    quality -= Math.min(extraTime / 30 * 0.5, 1); // -0.5 por cada 30s extra, máximo -1
  }
  
  // Penalización por usar pistas
  if (metrics.hintsUsed > 0) {
    quality -= Math.min(metrics.hintsUsed * 0.3, 1.5); // -0.3 por pista, máximo -1.5
  }
  
  // Bonus por respuesta rápida (menos de 5 segundos)
  if (metrics.timeSpent < 5 && metrics.correctOnFirstTry) {
    quality = Math.min(quality + 0.5, 5); // Bonus +0.5, no exceder 5
  }
  
  // Si fue parcialmente correcta, establecer un mínimo de 2
  if (metrics.partialCorrect && quality < 2) {
    quality = 2;
  }
  
  // Si no acertó en el primer intento y tomó muchos intentos, mínimo 1
  if (!metrics.correctOnFirstTry && metrics.attempts > 3) {
    quality = Math.max(quality, 1);
  }
  
  // Asegurar que esté en el rango 0-5
  return Math.max(0, Math.min(5, quality));
};

/**
 * Convertir calidad SM-3 a ResponseQuality enum
 */
export const qualityToResponseQuality = (quality: number): ResponseQuality => {
  if (quality >= 4) {
    return ResponseQuality.MASTERED;
  } else {
    return ResponseQuality.REVIEW_LATER;
  }
};

/**
 * Obtener descripción del nivel de calidad
 */
export const getQualityDescription = (quality: number): string => {
  if (quality >= 4.5) return 'Excelente';
  if (quality >= 3.5) return 'Muy bien';
  if (quality >= 2.5) return 'Bien';
  if (quality >= 1.5) return 'Regular';
  return 'Necesita práctica';
};

/**
 * Calcular métricas agregadas para una sesión
 */
export interface SessionQualityMetrics {
  averageQuality: number;
  totalConcepts: number;
  masteredCount: number;
  reviewLaterCount: number;
  averageAttempts: number;
  averageTime: number;
}

export const calculateSessionMetrics = (
  conceptMetrics: Map<string, ActiveStudyMetrics>
): SessionQualityMetrics => {
  const qualities: number[] = [];
  let totalAttempts = 0;
  let totalTime = 0;
  let masteredCount = 0;
  let reviewLaterCount = 0;
  
  conceptMetrics.forEach(metrics => {
    const quality = calculateActiveStudyQuality(metrics);
    qualities.push(quality);
    totalAttempts += metrics.attempts;
    totalTime += metrics.timeSpent;
    
    if (quality >= 4) {
      masteredCount++;
    } else {
      reviewLaterCount++;
    }
  });
  
  const totalConcepts = qualities.length;
  
  return {
    averageQuality: totalConcepts > 0 
      ? qualities.reduce((sum, q) => sum + q, 0) / totalConcepts 
      : 0,
    totalConcepts,
    masteredCount,
    reviewLaterCount,
    averageAttempts: totalConcepts > 0 ? totalAttempts / totalConcepts : 0,
    averageTime: totalConcepts > 0 ? totalTime / totalConcepts : 0
  };
};