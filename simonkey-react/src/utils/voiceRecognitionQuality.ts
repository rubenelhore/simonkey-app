/**
 * Calcula la calidad SM-3 basada en los resultados de Voice Recognition (Estudio Activo)
 */

export interface VoiceRecognitionMetrics {
  isCorrect: boolean;
  score: number; // 0-100 score from voice recognition accuracy
  attempts?: number; // Si tienen múltiples intentos por concepto
}

/**
 * Convierte las métricas de Voice Recognition a calidad SM-3 (0-5)
 * 
 * @param metrics - Métricas del Voice Recognition
 * @returns Calidad SM-3 entre 0 y 5
 */
export function calculateVoiceRecognitionQuality(metrics: VoiceRecognitionMetrics): number {
  const { isCorrect, score, attempts = 1 } = metrics;
  
  // Si es incorrecto, la calidad es baja independientemente del score
  if (!isCorrect) {
    // Score alto pero incorrecto = intento de calidad media-baja
    if (score >= 70) {
      return 2; // Estaba cerca pero falló
    } else if (score >= 50) {
      return 1; // Moderadamente cerca
    } else {
      return 0; // Muy alejado de la respuesta correcta
    }
  }
  
  // Si es correcto, calidad basada en score y intentos
  if (isCorrect) {
    let baseQuality = 4; // Calidad base ALTA para respuesta correcta (no penalizar tanto)
    
    // Ajustar según precisión del score
    if (score >= 90) {
      baseQuality = 5; // Excelente pronunciación/reconocimiento
    } else if (score >= 80) {
      baseQuality = 5; // Buena pronunciación (más generoso)
    } else if (score >= 60) {
      baseQuality = 4; // Pronunciación aceptable (más generoso)
    } else if (score >= 40) {
      baseQuality = 4; // Pronunciación mejorable pero correcta (más generoso)
    } else {
      baseQuality = 3; // Score muy bajo pero aún correcto
    }
    
    // Penalizar múltiples intentos (si aplica)
    if (attempts > 1) {
      baseQuality = Math.max(1, baseQuality - (attempts - 1) * 0.5);
    }
    
    return Math.min(5, Math.max(0, Math.round(baseQuality)));
  }
  
  return 2; // Fallback
}

/**
 * Convierte calidad SM-3 a ResponseQuality para compatibilidad
 */
export function voiceQualityToResponseQuality(sm3Quality: number): 'mastered' | 'review' | 'again' {
  if (sm3Quality >= 4) return 'mastered';
  if (sm3Quality >= 2) return 'review';
  return 'again';
}