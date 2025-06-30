import { kpiService } from './kpiService';
import type { 
  EventoEstudioInteligente, 
  EventoEstudioLibre, 
  EventoQuiz 
} from '@/types/kpis';

// Integración con sesiones de estudio inteligente
export async function onSmartStudyComplete(
  sessionData: {
    notebookId: string;
    subjectId?: string;
    duration: number; // en minutos
    validated: boolean;
    conceptsStudied: number;
    conceptsMastered: number;
    conceptsReviewing: number;
  }
) {
  const evento: EventoEstudioInteligente = {
    cuadernoId: sessionData.notebookId,
    materiaId: sessionData.subjectId,
    duracion: sessionData.duration,
    exitoso: sessionData.validated,
    conceptosEstudiados: sessionData.conceptsStudied,
    conceptosDominados: sessionData.conceptsMastered,
    conceptosNoDominados: sessionData.conceptsReviewing,
    timestamp: new Date()
  };

  await kpiService.updateAfterSmartStudy(evento);
}

// Integración con sesiones de estudio libre
export async function onFreeStudyComplete(
  sessionData: {
    notebookId: string;
    subjectId?: string;
    duration: number; // en minutos
    conceptsReviewed: number;
  }
) {
  const evento: EventoEstudioLibre = {
    cuadernoId: sessionData.notebookId,
    materiaId: sessionData.subjectId,
    duracion: sessionData.duration,
    conceptosRepasados: sessionData.conceptsReviewed,
    timestamp: new Date()
  };

  await kpiService.updateAfterFreeStudy(evento);
}

// Integración con quizzes
export async function onQuizComplete(
  quizData: {
    notebookId: string;
    subjectId?: string;
    duration: number; // en minutos
    score: number;
    accuracy: number;
  }
) {
  const evento: EventoQuiz = {
    cuadernoId: quizData.notebookId,
    materiaId: quizData.subjectId,
    duracion: quizData.duration,
    score: quizData.score,
    accuracy: quizData.accuracy,
    timestamp: new Date()
  };

  await kpiService.updateAfterQuiz(evento);
}

// Función para inicializar KPIs cuando se crea un nuevo usuario
export async function initializeNewUserKPIs(
  userId: string, 
  userType: 'pro' | 'free' | 'school-student' | 'school-teacher'
) {
  await kpiService.initializeUserKPIs(userId, userType);
}

// Función para actualizar el número de conceptos cuando cambia
export async function updateNotebookConceptCount(
  userId: string,
  notebookId: string,
  newConceptCount: number
) {
  const { updateDoc, doc } = await import('firebase/firestore');
  const { db } = await import('@/firebase');
  
  const kpiRef = doc(db, 'users', userId, 'kpis', 'dashboard');
  
  await updateDoc(kpiRef, {
    [`cuadernos.${notebookId}.numeroConceptos`]: newConceptCount,
    updatedAt: new Date()
  });
}

// Función para actualizar cuando un usuario se asigna a una materia
export async function assignUserToSubject(
  userId: string,
  subjectId: string,
  subjectName: string
) {
  const { updateDoc, doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('@/firebase');
  
  const kpiRef = doc(db, 'users', userId, 'kpis', 'dashboard');
  const kpiDoc = await getDoc(kpiRef);
  
  if (!kpiDoc.exists()) {
    await kpiService.initializeUserKPIs(userId, 'school-student');
  }
  
  await updateDoc(kpiRef, {
    [`materias.${subjectId}`]: {
      materiaId: subjectId,
      materiaNombre: subjectName,
      scoreMateria: 0,
      percentilMateria: 50,
      tiempoEstudioMateria: 0,
      estudiosInteligentesMateria: 0,
      cuadernosIds: [],
      posicionRanking: 0,
      totalAlumnosMateria: 0
    },
    'global.totalMaterias': (kpiDoc.data()?.global?.totalMaterias || 0) + 1,
    updatedAt: new Date()
  });
}

// Función para vincular un cuaderno a una materia
export async function linkNotebookToSubject(
  userId: string,
  notebookId: string,
  subjectId: string
) {
  const { updateDoc, doc, arrayUnion } = await import('firebase/firestore');
  const { db } = await import('@/firebase');
  
  const kpiRef = doc(db, 'users', userId, 'kpis', 'dashboard');
  
  await updateDoc(kpiRef, {
    [`cuadernos.${notebookId}.materiaId`]: subjectId,
    [`materias.${subjectId}.cuadernosIds`]: arrayUnion(notebookId),
    updatedAt: new Date()
  });
}