import { Timestamp } from 'firebase/firestore';

/**
 * Representa un material de estudio (archivo subido)
 */
export interface Material {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Timestamp;
  notebookId: string;
  userId: string;
}

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
  materialId?: string; // Referencia al material del que se extrajo
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
 * Intensity levels for intelligent study
 */
export enum StudyIntensity {
  WARM_UP = 'warm_up',    // 5 concepts - 1 session
  PROGRESS = 'progress',   // 10 concepts - 1.5 sessions
  ROCKET = 'rocket'        // 20 concepts - 2 sessions
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
  hasBeenReviewed?: boolean; // Si el concepto ha sido repasado alguna vez (nuevo campo)
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
 * Sesión de mini quiz (5 preguntas, 20 segundos, calificación base 10)
 */
export interface MiniQuizSession {
  id: string;
  userId: string;
  notebookId: string;
  notebookTitle: string;
  questions: QuizQuestion[];
  responses: QuizResponse[];
  startTime: Date;
  endTime: Date;
  score: number;                // Número de respuestas correctas
  maxScore: number;             // Número total de preguntas (5)
  accuracy: number;             // Porcentaje de acierto
  finalScore: number;           // Calificación base 10
  passed: boolean;              // Si aprobó (≥8/10)
  timeRemaining?: number;       // Tiempo restante al finalizar
  totalTime?: number;           // Tiempo total usado en segundos
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
  type: 'personal' | 'school'; // Tipo de cuaderno
  category?: string; // Nueva categoría para agrupar cuadernos
  
  // Campos comunes
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  conceptCount?: number;
  isFrozen?: boolean; // Si el cuaderno está congelado
  frozenScore?: number; // Puntaje al momento de congelar
  frozenAt?: Timestamp; // Fecha de congelación
  
  // Campos para congelación programada
  scheduledFreezeAt?: Timestamp; // Fecha programada para congelar
  scheduledUnfreezeAt?: Timestamp; // Fecha programada para descongelar
  
  // Campos para notebooks personales
  userId?: string; // ID del usuario propietario
  shareId?: string; // ID para compartir públicamente
  
  // Campos para notebooks escolares
  idMateria?: string; // ID de la materia para notebooks escolares
  idEscuela?: string; // ID de la escuela
  idProfesor?: string; // ID del profesor que lo creó
  idAdmin?: string; // ID del admin de la escuela
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

/**
 * Tipos de suscripción de usuario
 */
export enum UserSubscriptionType {
  SUPER_ADMIN = 'super_admin',
  FREE = 'free',
  PRO = 'pro',
  SCHOOL = 'school',
  UNIVERSITY = 'university'
}

/**
 * @deprecated Este enum ya no se usa. Usar isTeacher en UserProfile en su lugar.
 * Mantenido temporalmente para compatibilidad con código legacy.
 */
export enum SchoolRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
  TUTOR = 'tutor'
}

/**
 * Información del usuario en Firestore
 */
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  nombre: string;
  displayName: string;
  birthdate: string;
  password?: string; // Campo opcional para almacenar contraseña
  requiresPasswordChange?: boolean; // Indica si el usuario debe cambiar su contraseña por defecto
  createdAt: Timestamp;
  subscription: UserSubscriptionType;
  notebookCount: number;
  
  // Campo para el nuevo sistema de profesores
  isTeacher?: boolean;
  
  // Campo para indicar si el usuario está inscrito en alguna materia
  isEnrolled?: boolean;
  
  // DEPRECATED: Campos del sistema escolar antiguo - NO USAR
  // TODO: Eliminar después de completar la migración
  /** @deprecated */
  schoolRole?: SchoolRole;
  /** @deprecated */
  schoolName?: string;
  /** @deprecated */
  idNotebook?: string;
  /** @deprecated */
  schoolData?: {
    idEscuela?: string;
    nombreEscuela?: string;
  };
  /** @deprecated */
  subjectIds?: string[];
  /** @deprecated */
  idCuadernos?: string[];
  /** @deprecated */
  idInstitucion?: string;
  /** @deprecated */
  idEscuela?: string;
  /** @deprecated */
  idAdmin?: string;
  // Límites específicos por tipo de suscripción
  maxNotebooks?: number;
  maxConceptsPerNotebook?: number;
  notebooksCreatedThisWeek?: number;
  conceptsCreatedThisWeek?: number;
  weekStartDate?: any; // Cambiar a any para compatibilidad con serverTimestamp
  // Campos para autenticación con Google
  googleAuthUid?: string;
  googleAuthEmail?: string;
  googleAuthDisplayName?: string;
  googleAuthPhotoURL?: string;
  linkedSchoolUserId?: string;
  linkedAt?: Timestamp;
  updatedAt?: Timestamp;
  // Campos adicionales para ProfilePage
  bio?: string;
  interests?: string[];
  learningGoal?: string;
  conceptCount?: number;
  studyStreak?: number;
  totalStudyTime?: number;
  photoURL?: string;
  hasCompletedOnboarding?: boolean;
  location?: string;
  preferences?: {
    studyMode?: string;
    difficulty?: string;
    timePerSession?: string;
  };
  weeklyGoal?: number;
  achievementsCount?: number;
  averageSessionTime?: number;
  // Campos para el nuevo sistema de profesores independientes (definido arriba en línea 342)
  // isTeacher?: boolean; // Ya definido arriba
  teacherRequestedAt?: Timestamp;
  teacherApprovedAt?: Timestamp;
}

/**
 * Usuario de Google Auth
 */
export interface GoogleUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Resultado de verificación de usuario existente
 */
export interface ExistingUserCheck {
  exists: boolean;
  userId?: string;
  userData?: UserProfile;
  userType?: string;
}

/**
 * Límites de uso por tipo de suscripción
 */
export interface SubscriptionLimits {
  maxNotebooks: number;
  maxConceptsPerNotebook: number;
  maxNotebooksPerWeek?: number;
  maxConceptsPerWeek?: number;
  canDeleteAndRecreate: boolean;
  permissions: {
    canViewAllData: boolean;
    canEditAllData: boolean;
    canUseStudySection: boolean;
    canManageUsers: boolean;
  };
}

/**
 * Interfaces para el sistema escolar
 */

/**
 * Institución escolar
 */
export interface SchoolInstitution {
  id: string;
  nombre: string;
  createdAt: Timestamp;
}

/**
 * Administrador escolar
 */
export interface SchoolAdmin {
  id: string;
  nombre: string;
  email: string;
  password: string; // Siempre "1234" temporal
  subscription: UserSubscriptionType.SCHOOL;
  idInstitucion: string;
  createdAt: Timestamp;
}

/**
 * Profesor escolar
 */
export interface SchoolTeacher {
  id: string;
  nombre: string; // Igual a displayName y username
  email: string;
  password: string; // Siempre "1234" temporal
  subscription: UserSubscriptionType.SCHOOL;
  idAdmin: string;
  createdAt: Timestamp;
}

/**
 * Materia escolar
 */
export interface SchoolSubject {
  id: string;
  nombre: string;
  idProfesor: string;
  idMateria?: string; // Campo opcional que debe coincidir con el ID del documento
  color?: string;
  createdAt: Timestamp;
  category?: string;
  updatedAt?: Timestamp;
}


/**
 * Alumno escolar
 */
export interface SchoolStudent {
  id: string;
  nombre: string; // Igual a displayName y username
  email: string;
  password: string; // Siempre "1234" temporal
  subscription: UserSubscriptionType.SCHOOL;
  idCuadernos: string[]; // Array de IDs de cuadernos (uno o más)
  subjectIds?: string[]; // Array de IDs de materias asignadas
  institutionId?: string; // ID de la institución educativa
  createdAt: Timestamp;
}

/**
 * Tutor escolar
 */
export interface SchoolTutor {
  id: string;
  nombre: string;
  email: string;
  password: string; // Siempre "1234" temporal
  subscription: UserSubscriptionType.SCHOOL;
  schoolRole: SchoolRole.TUTOR;
  idAlumnos: string[]; // Array de IDs de alumnos (uno o más)
  createdAt: Timestamp;
}

/**
 * Categorías escolares para dropdowns
 */
export enum SchoolCategory {
  INSTITUCIONES = 'instituciones',
  USUARIOS = 'usuarios',
  ADMINS = 'admins',
  ADMINS_II = 'admins_ii',
  PROFESORES = 'profesores',
  MATERIAS = 'materias',
  ALUMNOS = 'alumnos',
  TUTORES = 'tutores'
}

/**
 * Relaciones entre categorías escolares
 */
export interface SchoolRelationship {
  parentCategory: SchoolCategory;
  childCategory: SchoolCategory;
  parentId: string;
  childId: string;
}

/**
 * Datos para vinculación escolar
 */
export interface SchoolLinkingData {
  categoria: SchoolCategory | '';
  especifico: string;
  vincular: string;
  resumen: {
    categoria: string;
    especificoNombre: string;
    vincularNombre: string;
  };
}

/**
 * Datos para creación escolar
 */
export interface SchoolCreationData {
  categoria: SchoolCategory | '';
  informacionBasica: { [key: string]: string };
  selectedEntity: string;
}

/**
 * Sesión de estudio
 */
export interface StudySession {
  id: string;
  userId: string;
  notebookId: string;
  mode: StudyMode;
  conceptsStudied: string[];
  startTime: Date;
  endTime?: Date;
  validated?: boolean; // Si el estudio inteligente fue validado por el Mini Quiz
  metrics?: {
    totalConcepts: number;
    conceptsReviewed: number;
    mastered: number;
    reviewing: number;
    timeSpent: number;
  }
}

/**
 * Estado de inscripción (enrollment) de estudiante en materia
 */
export enum EnrollmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  COMPLETED = 'completed'
}

/**
 * Inscripción de estudiante en materia de profesor
 */
export interface Enrollment {
  id: string;
  studentId: string;
  studentEmail?: string;
  studentName?: string;
  teacherId: string;
  teacherEmail?: string;
  teacherName?: string;
  materiaId: string;
  materiaName?: string;
  enrolledAt: Timestamp;
  status: EnrollmentStatus;
  lastAccessedAt?: Timestamp;
  completedAt?: Timestamp;
  inviteCode?: string;
  metadata?: {
    source: 'invite_link' | 'direct_add' | 'migration' | 'school_import';
    schoolId?: string;
    schoolName?: string;
  };
}

/**
 * Perfil extendido para profesores independientes
 */
export interface TeacherProfile {
  userId: string;
  isActive: boolean;
  bio?: string;
  specialties?: string[];
  institution?: string;
  verifiedTeacher?: boolean;
  approvedAt?: Timestamp;
  approvedBy?: string;
  maxStudents?: number;
  currentStudents?: number;
  maxMaterias?: number;
  currentMaterias?: number;
  inviteCodePrefix?: string;
  settings?: {
    allowPublicEnrollment?: boolean;
    requireApproval?: boolean;
    sendNotifications?: boolean;
    showInDirectory?: boolean;
  };
  stats?: {
    totalStudentsAllTime?: number;
    totalMateriasCreated?: number;
    totalExamsCreated?: number;
    averageStudentScore?: number;
    lastActiveAt?: Timestamp;
  };
}

/**
 * Código de invitación para materias
 */
export interface InviteCode {
  id: string;
  code: string;
  teacherId: string;
  materiaId: string;
  materiaName: string;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
  metadata?: {
    description?: string;
    welcomeMessage?: string;
  };
}