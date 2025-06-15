import { Timestamp } from 'firebase/firestore';

/**
 * Representa un concepto de estudio
 */
export interface Concept {
  id: string;
  término: string;
  definición: string;
  fuente: string;
  usuarioId?: string;
  docId?: string;
  index?: number;
  notasPersonales?: string;
  reviewId?: string;
  dominado?: boolean;
  // Otros campos que puedas necesitar
}

/**
 * Calidad de respuesta para algoritmo de repetición espaciada
 * Simplificado a solo dos opciones para mejor UX
 */
export enum ResponseQuality {
  REVIEW_LATER = 0,  // Revisar después (swipe izquierda)
  MASTERED = 1       // Dominado (swipe derecha)
}

/**
 * Modos de estudio disponibles
 */
export enum StudyMode {
  SMART = 'smart',
  FREE = 'free',
  QUIZ = 'quiz'
}

/**
 * Datos de aprendizaje para algoritmo SM-3
 */
export interface LearningData {
  conceptId: string;
  easeFactor: number;        // Factor de facilidad (2.5 por defecto)
  interval: number;          // Intervalo en días
  repetitions: number;       // Número de repasos exitosos consecutivos
  nextReviewDate: Date;      // Próxima fecha de repaso
  lastReviewDate: Date;      // Última fecha de repaso
  quality: number;           // Calidad de la respuesta (0-5)
  consecutiveCorrect: number; // Respuestas correctas consecutivas
  consecutiveIncorrect: number; // Respuestas incorrectas consecutivas
}

/**
 * Estado del candado de estudio inteligente
 */
export interface StudyLockState {
  conceptId: string;
  isLocked: boolean;
  lockStartTime: Date;
  timeRemaining: number;     // Tiempo restante en segundos
  canEvaluate: boolean;      // Si ya puede evaluar el concepto
}

/**
 * Datos del mini dashboard de estudio
 */
export interface StudyDashboardData {
  generalScore: number;      // Score general (estudios inteligentes × puntuación máxima quiz)
  nextSmartStudyDate: Date;  // Próximo estudio inteligente disponible
  nextQuizDate: Date;        // Próximo quiz disponible
  nextFreeStudyDate?: Date;  // Próximo estudio libre disponible
  smartStudiesCount: number; // Número de estudios inteligentes completados
  maxQuizScore: number;      // Puntuación máxima del quiz para este cuaderno
  totalConcepts: number;     // Número total de conceptos en el cuaderno
  completedSmartSessions: number; // Número de sesiones de estudio inteligente completadas
  completedFreeSessions: number;  // Número de sesiones de estudio libre completadas
  isFreeStudyAvailable: boolean; // Si el estudio libre está disponible hoy
  isSmartStudyAvailable: boolean; // Si el estudio inteligente está disponible
  isQuizAvailable: boolean;  // Si el quiz está disponible (considerando límites y conceptos)
  lastFreeStudyDate?: Date;  // Última fecha de estudio libre
}

/**
 * Representa una pregunta de quiz
 */
export interface QuizQuestion {
  id: string;
  definition: string;           // La definición que se muestra
  correctAnswer: Concept;       // El concepto correcto
  options: QuizOption[];        // Las 4 opciones (1 correcta + 3 distractores)
  source: string;               // Fuente de la definición
}

/**
 * Representa una opción de respuesta en el quiz
 */
export interface QuizOption {
  id: string;
  term: string;                 // El término que se muestra en el botón
  isCorrect: boolean;           // Si es la respuesta correcta
  conceptId: string;            // ID del concepto
}

/**
 * Resultado de una respuesta de quiz
 */
export interface QuizResponse {
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  timeSpent: number;            // Tiempo en segundos para responder
  timestamp: Date;
}

/**
 * Sesión de quiz completa con timer
 */
export interface QuizSession {
  id: string;
  userId: string;
  notebookId: string;
  notebookTitle: string;
  questions: QuizQuestion[];
  responses: QuizResponse[];
  startTime: Date;
  endTime?: Date;
  totalTime?: number;           // Tiempo total en segundos
  timeRemaining?: number;       // Tiempo restante al finalizar (para puntuación)
  score: number;                // Puntaje final
  maxScore: number;             // Puntaje máximo posible
  accuracy: number;             // Porcentaje de acierto
  timeBonus: number;            // Bonus por tiempo restante
  finalScore: number;           // Puntaje final con bonus de tiempo
}

/**
 * Estadísticas de quiz
 */
export interface QuizStats {
  totalQuizzes: number;
  averageScore: number;
  bestScore: number;
  averageTime: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  maxScoreByNotebook: { [notebookId: string]: number }; // Puntuación máxima por cuaderno
}

/**
 * Representa un cuaderno de estudio
 */
export interface Notebook {
  id: string;
  title: string;
  color: string;
  userId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  conceptCount?: number;
}

/**
 * Actividad en el dashboard
 */
export interface Activity {
  id: string;
  type: string;
  title: string;
  timestamp: Timestamp;
  userId?: string;
  notebookId?: string;
  notebookTitle?: string;
  conceptId?: string;
  conceptTitle?: string;
}

/**
 * Estadísticas para el dashboard
 */
export interface Stats {
  totalConcepts: number;
  totalNotebooks: number;
  studyTimeMinutes: number;
  masteredConcepts: number;
}

/**
 * Métricas de sesiones de estudio
 */
export interface StudySessionMetrics {
  totalConcepts: number;
  conceptsReviewed: number;
  mastered: number;
  reviewing: number;
  timeSpent: number;
  startTime: Date;
  endTime?: Date;
}

/**
 * Límites de estudio por usuario
 */
export interface StudyLimits {
  userId: string;
  lastFreeStudyDate?: Date;     // Última fecha de estudio libre
  lastQuizDate?: Date;          // Última fecha de quiz
  freeStudyCountToday: number;  // Número de estudios libres hoy
  quizCountThisWeek: number;    // Número de quizzes esta semana
  weekStartDate: Date;          // Fecha de inicio de la semana actual
}

/**
 * Configuración del timer de quiz
 */
export interface QuizTimerConfig {
  totalTime: number;            // Tiempo total en segundos (600)
  warningThreshold: number;     // Umbral de advertencia (60 segundos)
  criticalThreshold: number;    // Umbral crítico (30 segundos)
  autoSubmit: boolean;          // Si debe enviar automáticamente al agotarse el tiempo
}

/**
 * Estado del timer de quiz
 */
export interface QuizTimerState {
  timeRemaining: number;
  isRunning: boolean;
  isPaused: boolean;
  isWarning: boolean;
  isCritical: boolean;
  startTime: Date;
  endTime?: Date;
}