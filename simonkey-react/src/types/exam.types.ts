import { Timestamp } from 'firebase/firestore';

// Documento del examen
export interface SchoolExam {
  id: string;
  title: string;
  description?: string;
  idMateria: string;
  idProfesor: string;
  idEscuela: string;
  notebookIds: string[]; // Cuadernos seleccionados
  percentageQuestions: number; // 0-100
  timePerConcept: number; // segundos
  totalConcepts: number; // Total de conceptos en los cuadernos
  questionsPerStudent: number; // Calculado: totalConcepts * (percentage/100)
  createdAt: Timestamp;
  scheduledFor?: Timestamp; // Programar para fecha específica
  deadline?: Timestamp; // Fecha límite
  isActive: boolean; // Si el examen está activo para los estudiantes
  settings: {
    shuffleQuestions: boolean;
    showResultsImmediately: boolean;
    preventTabSwitch: boolean;
    allowPause: boolean;
  };
}

// Intento de examen por estudiante
export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  assignedConcepts: ConceptSelection[]; // Conceptos asignados aleatoriamente
  startedAt: Timestamp;
  completedAt?: Timestamp;
  currentQuestionIndex: number;
  answers: ExamAnswer[];
  score: number;
  timeRemaining: number; // segundos
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  tabSwitches?: number; // Detectar si cambian de pestaña
}

export interface ConceptSelection {
  conceptId: string;
  notebookId: string;
  término: string;
  definición: string;
  order: number; // Orden en que se presentará
}

export interface ExamAnswer {
  conceptId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number; // segundos en esta pregunta
  answeredAt: Timestamp;
}

// Para mostrar en la lista
export interface ExamWithStats extends SchoolExam {
  attemptedCount: number;
  completedCount: number;
  averageScore: number;
}