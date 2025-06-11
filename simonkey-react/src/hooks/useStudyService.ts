// src/hooks/useStudyService.ts
import { useState, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  Timestamp, 
  addDoc,
  increment 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Concept } from '../types/interfaces';

// Constantes y tipos
enum ResponseQuality {
  REVIEW_LATER = 0,  // Revisar después (swipe izquierda)
  MASTERED = 1       // Dominado (swipe derecha)
}

enum StudyMode {
  STUDY = 'study',
  REVIEW = 'review',
  QUIZ = 'quiz'
}

interface LearningData {
  conceptId: string;
  easeFactor: number;  // Factor de facilidad (2.5 por defecto)
  interval: number;    // Intervalo en días
  repetitions: number; // Número de repasos exitosos consecutivos
  nextReviewDate: Date;// Próxima fecha de repaso
  lastReviewDate: Date;// Última fecha de repaso
}

interface StudySession {
  id: string;
  userId: string;
  notebookId: string;
  mode: StudyMode;
  conceptsStudied: string[];
  startTime: Date;
  endTime?: Date;
  metrics?: {
    totalConcepts: number;
    conceptsReviewed: number;
    mastered: number;
    reviewing: number;
    timeSpent: number;
  }
}

interface StudyStats {
  totalConcepts: number;
  masteredConcepts: number;
  learningConcepts: number;
  reviewingConcepts: number;
  dueToday: number;
  dueNextWeek: number;
  longestStreak: number;
  currentStreak: number;
}

/**
 * Hook personalizado que implementa la lógica del Spaced Repetition System
 * basado en el algoritmo SM-2 (SuperMemo 2) para optimizar el aprendizaje
 */
export const useStudyService = () => {
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Registra actividad de estudio del usuario
   */
  const logStudyActivity = useCallback(
    async (userId: string, type: string, description: string): Promise<void> => {
      try {
        const activityData = {
          userId,
          type,
          description,
          timestamp: serverTimestamp()
        };
        
        await addDoc(collection(db, 'userActivities'), activityData);
      } catch (err) {
        console.error('Error logging study activity:', err);
        // No interrumpir la experiencia por errores en registro
      }
    },
    []
  );
  
  /**
   * Crea una nueva sesión de estudio en Firestore
   */
  const createStudySession = useCallback(
    async (userId: string, notebookId: string, mode: StudyMode): Promise<StudySession> => {
      try {
        const sessionData = {
          userId,
          notebookId,
          mode,
          conceptsStudied: [],
          startTime: new Date(),
          createdAt: serverTimestamp()
        };
        
        const sessionRef = await addDoc(collection(db, 'studySessions'), sessionData);
        
        // Actualizar estadísticas del usuario
        await updateUserStats(userId, {
          totalSessionsStarted: increment(1),
          lastSessionDate: serverTimestamp()
        });
        
        return {
          id: sessionRef.id,
          ...sessionData
        };
      } catch (err) {
        console.error('Error creating study session:', err);
        setError('No se pudo crear la sesión de estudio');
        throw err;
      }
    },
    []
  );
  
  /**
   * Finaliza una sesión de estudio y guarda métricas
   */
  const completeStudySession = useCallback(
    async (sessionId: string, metrics: any): Promise<void> => {
      try {
        const sessionRef = doc(db, 'studySessions', sessionId);
        
        await updateDoc(sessionRef, {
          endTime: new Date(),
          metrics,
          completedAt: serverTimestamp()
        });
        
        // Obtener datos de la sesión
        const sessionDoc = await getDoc(sessionRef);
        if (!sessionDoc.exists()) throw new Error('Session not found');
        
        const sessionData = sessionDoc.data();
        
        // Actualizar estadísticas del usuario
        await updateUserStats(sessionData.userId, {
          totalSessionsCompleted: increment(1),
          totalTimeStudied: increment(metrics.timeSpent),
          totalConceptsReviewed: increment(metrics.conceptsReviewed)
        });
        
        // Si se completaron suficientes conceptos, actualizar streak
        if (metrics.conceptsReviewed >= 5) {
          await updateStreak(sessionData.userId);
        }
      } catch (err) {
        console.error('Error completing study session:', err);
        setError('No se pudo finalizar la sesión de estudio');
        throw err;
      }
    },
    []
  );
  
  /**
   * Actualiza el streak de estudio del usuario
   * Un streak se mantiene si el usuario estudia al menos una vez al día
   */
  const updateStreak = useCallback(
    async (userId: string): Promise<void> => {
      try {
        const userStatsRef = doc(db, 'users', userId, 'stats', 'study');
        const userStatsDoc = await getDoc(userStatsRef);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (userStatsDoc.exists()) {
          const stats = userStatsDoc.data();
          const lastStudyDate = stats.lastStudyDate?.toDate() || new Date(0);
          lastStudyDate.setHours(0, 0, 0, 0);
          
          const diffDays = Math.floor((today.getTime() - lastStudyDate.getTime()) / (1000 * 60 * 60 * 24));
          
          let currentStreak = stats.currentStreak || 0;
          
          // Si estudió hoy, no cambiar el streak
          if (diffDays === 0) {
            // Ya se actualizó hoy, no hacer nada
            return;
          } 
          // Si estudió ayer, incrementar el streak
          else if (diffDays === 1) {
            currentStreak += 1;
          } 
          // Si pasó más de un día, reiniciar el streak
          else {
            currentStreak = 1;
          }
          
          // Actualizar streak más largo si es necesario
          const longestStreak = Math.max(currentStreak, stats.longestStreak || 0);
          
          await updateDoc(userStatsRef, {
            currentStreak,
            longestStreak,
            lastStudyDate: today
          });
        } else {
          // Primer estudio del usuario
          await setDoc(userStatsRef, {
            currentStreak: 1,
            longestStreak: 1,
            lastStudyDate: today
          });
        }
      } catch (err) {
        console.error('Error updating streak:', err);
        // No lanzamos error para no interrumpir la experiencia
      }
    },
    []
  );
  
  /**
   * Actualiza estadísticas generales del usuario
   */
  const updateUserStats = useCallback(
    async (userId: string, statsUpdate: any): Promise<void> => {
      try {
        const userStatsRef = doc(db, 'users', userId, 'stats', 'study');
        
        // Primero intentamos actualizar
        try {
          await updateDoc(userStatsRef, statsUpdate);
        } catch (err) {
          // Si el documento no existe, lo creamos
          await setDoc(userStatsRef, {
            ...statsUpdate,
            createdAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.error('Error updating user stats:', err);
        // No interrumpir la experiencia por errores en estadísticas
      }
    },
    []
  );
  
  /**
   * Procesa la respuesta del usuario a un concepto según el algoritmo SM-2
   * y actualiza los datos de aprendizaje en Firestore
   */
  const processConceptResponse = useCallback(
    async (userId: string, conceptId: string, quality: ResponseQuality, sessionId: string): Promise<LearningData> => {
      try {
        // Obtener los datos de aprendizaje actuales o inicializar nuevos
        const learningDataRef = doc(db, 'users', userId, 'learningData', conceptId);
        const learningDataDoc = await getDoc(learningDataRef);
        
        let learningData: LearningData;
        
        if (learningDataDoc.exists()) {
          learningData = learningDataDoc.data() as LearningData;
        } else {
          // Inicializar nuevos datos de aprendizaje para este concepto
          learningData = {
            conceptId,
            easeFactor: 2.5,  // Factor de facilidad inicial
            interval: 0,      // Intervalo inicial
            repetitions: 0,   // Sin repeticiones previas
            nextReviewDate: new Date(),
            lastReviewDate: new Date()
          };
        }
        
        // Implementación del algoritmo SM-2 simplificado
        if (quality === ResponseQuality.MASTERED) {
          // Respuesta correcta - concepto dominado
          if (learningData.repetitions === 0) {
            learningData.interval = 1; // 1 día
          } else if (learningData.repetitions === 1) {
            learningData.interval = 6; // 6 días
          } else {
            // Aplicar fórmula de SM-2
            learningData.interval = Math.round(learningData.interval * learningData.easeFactor);
          }
          
          learningData.repetitions++;
          
          // Aumentar ligeramente el factor de facilidad
          learningData.easeFactor = Math.min(
            2.5, // Máximo factor de facilidad
            learningData.easeFactor + 0.1
          );
        } else {
          // Respuesta incorrecta - revisar después
          learningData.repetitions = 0;
          learningData.interval = 1; // Repasar al día siguiente
          
          // Reducir el factor de facilidad
          learningData.easeFactor = Math.max(
            1.3, // Mínimo factor de facilidad
            learningData.easeFactor - 0.2
          );
        }
        
        // Calcular próxima fecha de repaso
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + learningData.interval);
        learningData.nextReviewDate = nextDate;
        learningData.lastReviewDate = new Date();
        
        // Guardar en Firestore
        await setDoc(learningDataRef, {
          ...learningData,
          nextReviewDate: Timestamp.fromDate(learningData.nextReviewDate),
          lastReviewDate: Timestamp.fromDate(learningData.lastReviewDate),
          updatedAt: serverTimestamp()
        });
        
        // Actualizar la sesión con este concepto estudiado
        if (sessionId) {
          const sessionRef = doc(db, 'studySessions', sessionId);
          await updateDoc(sessionRef, {
            conceptsStudied: increment(1),
            [`conceptResponses.${conceptId}`]: quality
          });
        }
        
        return learningData;
      } catch (err) {
        console.error('Error processing concept response:', err);
        setError('No se pudo guardar tu progreso');
        throw err;
      }
    },
    []
  );
  
  /**
   * Procesa respuestas de quiz sin afectar al algoritmo SRS
   * Solo registra estadísticas de acierto/fallo
   */
  const processQuizResponse = useCallback(
    async (userId: string, conceptId: string, wasCorrect: boolean, sessionId: string): Promise<void> => {
      try {
        // 1. Actualizar solo estadísticas de quiz sin modificar el algoritmo SRS
        const quizStatsRef = doc(db, 'users', userId, 'quizStats', conceptId);
        
        // Obtener estadísticas previas si existen
        const quizStatsDoc = await getDoc(quizStatsRef);
        
        if (quizStatsDoc.exists()) {
          // Actualizar estadísticas existentes
          await updateDoc(quizStatsRef, {
            totalAttempts: increment(1),
            correctAnswers: wasCorrect ? increment(1) : increment(0),
            lastAttempted: serverTimestamp(),
            [`history.${new Date().toISOString()}`]: wasCorrect
          });
        } else {
          // Crear nuevas estadísticas
          await setDoc(quizStatsRef, {
            conceptId,
            totalAttempts: 1,
            correctAnswers: wasCorrect ? 1 : 0,
            lastAttempted: serverTimestamp(),
            history: {
              [new Date().toISOString()]: wasCorrect
            },
            createdAt: serverTimestamp()
          });
        }
        
        // 2. Actualizar la sesión con este concepto contestado
        if (sessionId) {
          const sessionRef = doc(db, 'studySessions', sessionId);
          await updateDoc(sessionRef, {
            conceptsStudied: increment(1),
            [`quizResponses.${conceptId}`]: wasCorrect
          });
        }
        
        // 3. Actualizar estadísticas generales del usuario
        await updateUserStats(userId, {
          totalQuizAnswers: increment(1),
          totalQuizCorrect: wasCorrect ? increment(1) : increment(0)
        });
        
        // 4. Registrar actividad para análisis
        await logStudyActivity(
          userId,
          'quiz_response',
          `Quiz response for concept ${conceptId}: ${wasCorrect ? 'correct' : 'incorrect'}`
        );
      } catch (err) {
        console.error('Error processing quiz response:', err);
        setError('No se pudo guardar la respuesta del quiz');
      }
    },
    [updateUserStats, logStudyActivity]
  );
  
  /**
   * Obtiene conceptos que están listos para repasar hoy
   */
  const getDueConceptsForReview = useCallback(
    async (userId: string, notebookId: string): Promise<Concept[]> => {
      try {
        // 1. Primero obtenemos todos los conceptos del cuaderno
        const conceptDocs = await getConceptsFromNotebook(notebookId);
        
        if (conceptDocs.length === 0) return [];
        
        // 2. Luego obtenemos los datos de aprendizaje del usuario
        const learningDataQuery = query(
          collection(db, 'users', userId, 'learningData'),
          where('nextReviewDate', '<=', new Date())
        );
        
        const learningDataSnapshot = await getDocs(learningDataQuery);
        
        // Crear un mapa de conceptos que necesitan repaso
        const dueConceptIds = new Map();
        
        learningDataSnapshot.forEach(doc => {
          const data = doc.data();
          dueConceptIds.set(data.conceptId, {
            nextReviewDate: data.nextReviewDate.toDate(),
            interval: data.interval
          });
        });
        
        // 3. Filtrar los conceptos que están listos para repasar
        const dueConceptsFlat: Concept[] = [];
        
        for (const doc of conceptDocs) {
          const conceptosData = doc.data().conceptos || [];
          conceptosData.forEach((concepto: any, index: number) => {
            const conceptId = `${doc.id}-${index}`;
            
            if (dueConceptIds.has(conceptId)) {
              dueConceptsFlat.push({
                ...concepto,
                docId: doc.id,
                index,
                id: conceptId
              });
            }
          });
        }
        
        // 4. Ordenar por prioridad (primero los que tienen mayor intervalo)
        return dueConceptsFlat.sort((a, b) => {
          const aData = dueConceptIds.get(a.id);
          const bData = dueConceptIds.get(b.id);
          
          // Ordenar por intervalo (descendente) - priorizar los conceptos más "valiosos"
          return (bData?.interval || 0) - (aData?.interval || 0);
        });
      } catch (err) {
        console.error('Error getting due concepts:', err);
        setError('No se pudieron cargar los conceptos para repaso');
        return [];
      }
    },
    []
  );
  
  /**
   * Obtiene conceptos nuevos para estudio (no aprendidos aún)
   */
  const getNewConceptsForStudy = useCallback(
    async (userId: string, notebookId: string, limit: number = 20): Promise<Concept[]> => {
      try {
        // 1. Obtener todos los conceptos del cuaderno
        const conceptDocs = await getConceptsFromNotebook(notebookId);
        
        if (conceptDocs.length === 0) return [];
        
        // Crear una lista plana de todos los conceptos
        const allConcepts: Concept[] = [];
        
        for (const doc of conceptDocs) {
          const conceptosData = doc.data().conceptos || [];
          conceptosData.forEach((concepto: any, index: number) => {
            allConcepts.push({
              ...concepto,
              docId: doc.id,
              index,
              id: `${doc.id}-${index}`
            });
          });
        }
        
        if (allConcepts.length === 0) return [];
        
        // 2. Obtener los conceptos que ya se han estudiado
        const learningDataQuery = query(
          collection(db, 'users', userId, 'learningData')
        );
        
        const learningDataSnapshot = await getDocs(learningDataQuery);
        
        // Crear un conjunto de IDs de conceptos ya estudiados
        const studiedConceptIds = new Set();
        
        learningDataSnapshot.forEach(doc => {
          studiedConceptIds.add(doc.data().conceptId);
        });
        
        // 3. Filtrar solo los conceptos no estudiados aún
        const unstudiedConcepts = allConcepts.filter(concept => 
          !studiedConceptIds.has(concept.id)
        );
        
        // Si hay conceptos no estudiados, devolver esos (hasta el límite)
        if (unstudiedConcepts.length > 0) {
          // Ordenar aleatoriamente para variedad
          const shuffled = unstudiedConcepts.sort(() => 0.5 - Math.random());
          return shuffled.slice(0, Math.min(limit, shuffled.length));
        }
        
        // Si todos han sido estudiados, devolver todos los conceptos
        // (también ordenados aleatoriamente y limitados)
        const shuffledAll = allConcepts.sort(() => 0.5 - Math.random());
        return shuffledAll.slice(0, Math.min(limit, shuffledAll.length));
      } catch (err) {
        console.error('Error getting new concepts:', err);
        setError('No se pudieron cargar los conceptos para estudio');
        return [];
      }
    },
    []
  );
  
  /**
   * Obtiene conceptos para modo quiz (mezcla aleatoria de conceptos)
   */
  const getConceptsForQuiz = useCallback(
    async (userId: string, notebookId: string, limit: number = 10): Promise<Concept[]> => {
      try {
        // 1. Obtener todos los conceptos del cuaderno
        const conceptDocs = await getConceptsFromNotebook(notebookId);
        
        if (conceptDocs.length === 0) return [];
        
        // Crear una lista plana de todos los conceptos
        const allConcepts: Concept[] = [];
        
        for (const doc of conceptDocs) {
          const conceptosData = doc.data().conceptos || [];
          conceptosData.forEach((concepto: any, index: number) => {
            allConcepts.push({
              ...concepto,
              docId: doc.id,
              index,
              id: `${doc.id}-${index}`
            });
          });
        }
        
        // Seleccionar hasta el límite de conceptos aleatoriamente para el quiz
        const shuffled = allConcepts.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(limit, shuffled.length));
      } catch (err) {
        console.error('Error getting quiz concepts:', err);
        setError('No se pudieron cargar los conceptos para evaluación');
        return [];
      }
    },
    []
  );
  
  /**
   * Optimiza el orden de los conceptos para una mejor retención
   * Implementa estrategias de interleaving y espaciado
   */
  const optimizeConceptOrder = useCallback(
    (concepts: Concept[]): Concept[] => {
      // Implementar estrategias como:
      // 1. Interleaving: Mezclar conceptos similares
      // 2. Espaciado: Distribuir conceptos relacionados
      // 3. Ordenar por dificultad incremental
      
      // Por ahora, simplemente mezclar los conceptos aleatoriamente
      return [...concepts].sort(() => 0.5 - Math.random());
    },
    []
  );
  
  /**
   * Obtiene la cantidad de conceptos pendientes de repaso
   */
  const getReviewableConceptsCount = useCallback(
    async (userId: string, notebookId: string): Promise<number> => {
      try {
        // Primero obtenemos la cantidad de conceptos estudiados en este cuaderno
        const allConcepts = await getConceptIdsFromNotebook(notebookId);
        
        if (allConcepts.length === 0) return 0;
        
        // Luego filtramos los que están listos para repaso
        const today = new Date();
        
        // Consultar los conceptos listos para repaso
        const learningDataQuery = query(
          collection(db, 'users', userId, 'learningData'),
          where('nextReviewDate', '<=', today)
        );
        
        const learningDataSnapshot = await getDocs(learningDataQuery);
        
        // Contar solo los conceptos que pertenecen a este cuaderno
        let count = 0;
        learningDataSnapshot.forEach(doc => {
          const data = doc.data();
          if (allConcepts.includes(data.conceptId)) {
            count++;
          }
        });
        
        return count;
      } catch (err) {
        console.error('Error getting reviewable concepts count:', err);
        return 0;
      }
    },
    []
  );
  
  /**
   * Obtiene estadísticas de conceptos por estado (nuevo, aprendiendo, dominado)
   */
  const getConceptStats = useCallback(
    async (userId: string, notebookId: string): Promise<StudyStats> => {
      try {
        // Inicializar estadísticas
        const stats: StudyStats = {
          totalConcepts: 0,
          masteredConcepts: 0,
          learningConcepts: 0,
          reviewingConcepts: 0,
          dueToday: 0,
          dueNextWeek: 0,
          longestStreak: 0,
          currentStreak: 0
        };
        
        // 1. Obtener todos los conceptos del cuaderno
        const conceptIds = await getConceptIdsFromNotebook(notebookId);
        stats.totalConcepts = conceptIds.length;
        
        if (conceptIds.length === 0) return stats;
        
        // 2. Obtener datos de aprendizaje del usuario
        const learningDataQuery = query(
          collection(db, 'users', userId, 'learningData')
        );
        
        const learningDataSnapshot = await getDocs(learningDataQuery);
        
        // Establecer fechas de referencia
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        
        // Analizar cada concepto estudiado
        learningDataSnapshot.forEach(doc => {
          const data = doc.data();
          
          // Verificar si el concepto pertenece a este cuaderno
          if (conceptIds.includes(data.conceptId)) {
            const nextReviewDate = data.nextReviewDate.toDate();
            
            // Categorizar por nivel de dominio
            if (data.repetitions >= 3 && data.easeFactor > 2.0) {
              stats.masteredConcepts++;
            } else if (data.repetitions > 0) {
              stats.learningConcepts++;
            } else {
              stats.reviewingConcepts++;
            }
            
            // Pendientes hoy
            if (nextReviewDate <= today) {
              stats.dueToday++;
            }
            
            // Pendientes esta semana
            if (nextReviewDate > today && nextReviewDate <= nextWeek) {
              stats.dueNextWeek++;
            }
          }
        });
        
        // 3. Obtener datos de streak
        const userStatsRef = doc(db, 'users', userId, 'stats', 'study');
        const userStatsDoc = await getDoc(userStatsRef);
        
        if (userStatsDoc.exists()) {
          const userStats = userStatsDoc.data();
          stats.currentStreak = userStats.currentStreak || 0;
          stats.longestStreak = userStats.longestStreak || 0;
        }
        
        return stats;
      } catch (err) {
        console.error('Error getting concept stats:', err);
        return {
          totalConcepts: 0,
          masteredConcepts: 0,
          learningConcepts: 0,
          reviewingConcepts: 0,
          dueToday: 0,
          dueNextWeek: 0,
          longestStreak: 0,
          currentStreak: 0
        };
      }
    },
    []
  );
  
  /**
   * Calcula la próxima fecha recomendada para repasar
   */
  const getNextRecommendedReviewDate = useCallback(
    async (userId: string, notebookId: string): Promise<Date | null> => {
      try {
        // Obtener conceptos pendientes
        const dueConceptsCount = await getReviewableConceptsCount(userId, notebookId);
        
        // Si hay conceptos pendientes, recomendar hoy
        if (dueConceptsCount > 0) {
          return new Date();
        }
        
        // Obtener el concepto con la fecha de repaso más próxima
        const conceptIds = await getConceptIdsFromNotebook(notebookId);
        
        if (conceptIds.length === 0) return null;
        
        const learningDataQuery = query(
          collection(db, 'users', userId, 'learningData'),
          where('nextReviewDate', '>', new Date()),
          orderBy('nextReviewDate', 'asc'),
          limit(1)
        );
        
        const learningDataSnapshot = await getDocs(learningDataQuery);
        
        if (learningDataSnapshot.empty) {
          // No hay conceptos programados, recomendar mañana
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return tomorrow;
        }
        
        // Devolver la fecha del concepto más próximo
        const nextConcept = learningDataSnapshot.docs[0].data();
        return nextConcept.nextReviewDate.toDate();
      } catch (err) {
        console.error('Error getting next recommended date:', err);
        return null;
      }
    },
    []
  );
  
  /**
   * Función auxiliar para obtener todos los conceptos de un cuaderno
   */
  const getConceptsFromNotebook = useCallback(
    async (notebookId: string) => {
      const conceptsQuery = query(
        collection(db, 'conceptos'),
        where('cuadernoId', '==', notebookId)
      );
      
      return (await getDocs(conceptsQuery)).docs;
    },
    []
  );

  /**
   * Función auxiliar para obtener solo los IDs de conceptos de un cuaderno
   */
  const getConceptIdsFromNotebook = useCallback(
    async (notebookId: string): Promise<string[]> => {
      try {
        const conceptDocs = await getConceptsFromNotebook(notebookId);
        
        // Crear una lista plana de todos los IDs de conceptos
        const conceptIds: string[] = [];
        
        for (const doc of conceptDocs) {
          const conceptosData = doc.data().conceptos || [];
          conceptosData.forEach((_: any, index: number) => {
            conceptIds.push(`${doc.id}-${index}`);
          });
        }
        
        return conceptIds;
      } catch (err) {
        console.error('Error getting concept IDs:', err);
        return [];
      }
    },
    [getConceptsFromNotebook]
  );
  
  /**
   * Devuelve todos los conceptos de un cuaderno (sin filtrar por SRS)
   */
  const getAllConceptsFromNotebook = async (
    userId: string,
    notebookId: string
  ): Promise<Concept[]> => {
    try {
      const conceptDocs = await getConceptsFromNotebook(notebookId);
      if (conceptDocs.length === 0) return [];
      const allConcepts: Concept[] = [];
      for (const doc of conceptDocs) {
        const conceptosData = doc.data().conceptos || [];
        conceptosData.forEach((concepto: any, index: number) => {
          allConcepts.push({
            ...concepto,
            docId: doc.id,
            index,
            id: `${doc.id}-${index}`
          });
        });
      }
      return allConcepts;
    } catch (err) {
      console.error('Error getting all concepts from notebook:', err);
      return [];
    }
  };
  
  return {
    error,
    createStudySession,
    completeStudySession,
    processConceptResponse,
    processQuizResponse,
    getDueConceptsForReview,
    getNewConceptsForStudy,
    getConceptsForQuiz,
    optimizeConceptOrder,
    getReviewableConceptsCount,
    getConceptStats,
    getNextRecommendedReviewDate,
    logStudyActivity,
    getAllConceptsFromNotebook
  };
};