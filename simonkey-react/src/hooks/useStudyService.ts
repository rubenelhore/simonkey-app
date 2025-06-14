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
import { 
  Concept, 
  StudyMode, 
  LearningData, 
  StudyLimits,
  StudyDashboardData,
  ResponseQuality
} from '../types/interfaces';
import { 
  updateLearningData, 
  createInitialLearningData,
  getConceptsReadyForReview,
  getNextSmartStudyDate,
  getNextQuizDate,
  isFreeStudyAvailable,
  calculateLearningStats
} from '../utils/sm3Algorithm';

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
 * basado en el algoritmo SM-3 (SuperMemo 3) para optimizar el aprendizaje
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
        // Verificar límites según el modo
        if (mode === StudyMode.FREE) {
          const canStudy = await checkFreeStudyLimit(userId);
          if (!canStudy) {
            throw new Error('Ya has usado tu sesión de estudio libre hoy');
          }
        }
        
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
        
        // Si es estudio libre, marcar como usado
        if (mode === StudyMode.FREE) {
          await updateFreeStudyUsage(userId);
        }
        
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
   * Verificar límite de estudio libre (1 por día)
   */
  const checkFreeStudyLimit = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        const limitsRef = doc(db, 'users', userId, 'limits', 'study');
        const limitsDoc = await getDoc(limitsRef);
        
        if (!limitsDoc.exists()) {
          return true; // Primera vez, puede estudiar
        }
        
        const limits = limitsDoc.data() as StudyLimits;
        const lastFreeStudyDate = limits.lastFreeStudyDate instanceof Timestamp 
          ? limits.lastFreeStudyDate.toDate() 
          : limits.lastFreeStudyDate;
        return isFreeStudyAvailable(lastFreeStudyDate);
      } catch (err) {
        console.error('Error checking free study limit:', err);
        return true; // En caso de error, permitir estudio
      }
    },
    []
  );
  
  /**
   * Actualizar uso de estudio libre
   */
  const updateFreeStudyUsage = useCallback(
    async (userId: string): Promise<void> => {
      try {
        const limitsRef = doc(db, 'users', userId, 'limits', 'study');
        await setDoc(limitsRef, {
          userId,
          lastFreeStudyDate: new Date(),
          freeStudyCountToday: 1,
          weekStartDate: getWeekStartDate(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error('Error updating free study usage:', err);
      }
    },
    []
  );
  
  /**
   * Obtener fecha de inicio de la semana actual
   */
  const getWeekStartDate = (): Date => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };
  
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
          // Si pasó más de un día, resetear el streak
          else {
            currentStreak = 1;
          }
          
          // Actualizar el streak más largo si es necesario
          const longestStreak = Math.max(stats.longestStreak || 0, currentStreak);
          
          await updateDoc(userStatsRef, {
            currentStreak,
            longestStreak,
            lastStudyDate: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          // Primera sesión de estudio
          await setDoc(userStatsRef, {
            currentStreak: 1,
            longestStreak: 1,
            lastStudyDate: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        console.error('Error updating streak:', err);
      }
    },
    []
  );
  
  /**
   * Obtener datos del dashboard de estudio
   */
  const getStudyDashboardData = useCallback(
    async (userId: string, notebookId: string): Promise<StudyDashboardData> => {
      try {
        // Obtener datos de aprendizaje del cuaderno
        const learningData = await getLearningDataForNotebook(userId, notebookId);
        
        // Obtener límites de estudio
        const limits = await getStudyLimits(userId);
        
        // Obtener puntuación máxima del quiz
        const maxQuizScore = await getMaxQuizScore(userId, notebookId);
        
        // Calcular estadísticas
        const stats = calculateLearningStats(learningData);
        
        // Calcular próximas fechas
        const nextSmartStudyDate = getNextSmartStudyDate(learningData) || new Date();
        const nextQuizDate = getNextQuizDate(
          limits.lastQuizDate instanceof Timestamp 
            ? limits.lastQuizDate.toDate() 
            : limits.lastQuizDate
        );
        
        // Calcular score general
        const smartStudiesCount = stats.totalConcepts;
        const generalScore = smartStudiesCount * maxQuizScore;
        
        return {
          generalScore,
          nextSmartStudyDate,
          nextQuizDate,
          smartStudiesCount,
          maxQuizScore,
          isFreeStudyAvailable: isFreeStudyAvailable(
            limits.lastFreeStudyDate instanceof Timestamp 
              ? limits.lastFreeStudyDate.toDate() 
              : limits.lastFreeStudyDate
          ),
          lastFreeStudyDate: limits.lastFreeStudyDate instanceof Timestamp 
            ? limits.lastFreeStudyDate.toDate() 
            : limits.lastFreeStudyDate
        };
      } catch (err) {
        console.error('Error getting dashboard data:', err);
        throw err;
      }
    },
    []
  );
  
  /**
   * Obtener límites de estudio del usuario
   */
  const getStudyLimits = useCallback(
    async (userId: string): Promise<StudyLimits> => {
      try {
        const limitsRef = doc(db, 'users', userId, 'limits', 'study');
        const limitsDoc = await getDoc(limitsRef);
        
        if (!limitsDoc.exists()) {
          return {
            userId,
            freeStudyCountToday: 0,
            quizCountThisWeek: 0,
            weekStartDate: getWeekStartDate()
          };
        }
        
        return limitsDoc.data() as StudyLimits;
      } catch (err) {
        console.error('Error getting study limits:', err);
        return {
          userId,
          freeStudyCountToday: 0,
          quizCountThisWeek: 0,
          weekStartDate: getWeekStartDate()
        };
      }
    },
    []
  );
  
  /**
   * Obtener puntuación máxima del quiz para un cuaderno
   */
  const getMaxQuizScore = useCallback(
    async (userId: string, notebookId: string): Promise<number> => {
      try {
        const quizStatsRef = doc(db, 'users', userId, 'quizStats', notebookId);
        const quizStatsDoc = await getDoc(quizStatsRef);
        
        if (!quizStatsDoc.exists()) {
          return 10; // Puntuación por defecto
        }
        
        const stats = quizStatsDoc.data();
        return stats.maxScore || 10;
      } catch (err) {
        console.error('Error getting max quiz score:', err);
        return 10;
      }
    },
    []
  );
  
  /**
   * Obtener datos de aprendizaje para un cuaderno
   */
  const getLearningDataForNotebook = useCallback(
    async (userId: string, notebookId: string): Promise<LearningData[]> => {
      try {
        const learningRef = collection(db, 'users', userId, 'learningData');
        const learningQuery = query(
          learningRef,
          where('notebookId', '==', notebookId)
        );
        
        const learningSnapshot = await getDocs(learningQuery);
        const learningData: LearningData[] = [];
        
        learningSnapshot.forEach(doc => {
          const data = doc.data();
          learningData.push({
            ...data,
            nextReviewDate: data.nextReviewDate?.toDate() || new Date(),
            lastReviewDate: data.lastReviewDate?.toDate() || new Date()
          } as LearningData);
        });
        
        return learningData;
      } catch (err) {
        console.error('Error getting learning data:', err);
        return [];
      }
    },
    []
  );
  
  /**
   * Actualizar respuesta de concepto usando SM-3
   */
  const updateConceptResponse = useCallback(
    async (userId: string, conceptId: string, quality: ResponseQuality): Promise<void> => {
      try {
        // Convertir ResponseQuality a calidad SM-3 (0-5)
        const sm3Quality = quality === ResponseQuality.MASTERED ? 5 : 2;
        
        // Obtener datos de aprendizaje actuales
        const learningRef = doc(db, 'users', userId, 'learningData', conceptId);
        const learningDoc = await getDoc(learningRef);
        
        let currentData: LearningData;
        
        if (learningDoc.exists()) {
          const data = learningDoc.data();
          currentData = {
            ...data,
            nextReviewDate: data.nextReviewDate?.toDate() || new Date(),
            lastReviewDate: data.lastReviewDate?.toDate() || new Date()
          } as LearningData;
        } else {
          // Crear datos iniciales si no existen
          currentData = createInitialLearningData(conceptId);
        }
        
        // Actualizar usando SM-3
        const updatedData = updateLearningData(currentData, sm3Quality);
        
        // Guardar en Firestore
        await setDoc(learningRef, {
          ...updatedData,
          nextReviewDate: Timestamp.fromDate(updatedData.nextReviewDate),
          lastReviewDate: Timestamp.fromDate(updatedData.lastReviewDate),
          updatedAt: serverTimestamp()
        });
        
        // Registrar actividad
        await logStudyActivity(
          userId, 
          'concept_reviewed', 
          `Concepto ${conceptId} marcado como ${quality === ResponseQuality.MASTERED ? 'dominado' : 'revisar después'}`
        );
      } catch (err) {
        console.error('Error updating concept response:', err);
        throw err;
      }
    },
    [logStudyActivity]
  );
  
  /**
   * Obtener conceptos listos para repaso inteligente
   */
  const getReviewableConcepts = useCallback(
    async (userId: string, notebookId: string): Promise<Concept[]> => {
      try {
        const learningData = await getLearningDataForNotebook(userId, notebookId);
        const readyForReview = getConceptsReadyForReview(learningData);
        
        if (readyForReview.length === 0) {
          return [];
        }
        
        // Obtener los conceptos correspondientes
        const conceptIds = readyForReview.map(data => data.conceptId);
        const concepts = await getConceptsByIds(conceptIds);
        
        return concepts;
      } catch (err) {
        console.error('Error getting reviewable concepts:', err);
        return [];
      }
    },
    []
  );
  
  /**
   * Obtener conceptos por IDs
   */
  const getConceptsByIds = useCallback(
    async (conceptIds: string[]): Promise<Concept[]> => {
      try {
        const concepts: Concept[] = [];
        
        for (const conceptId of conceptIds) {
          const conceptRef = doc(db, 'conceptos', conceptId);
          const conceptDoc = await getDoc(conceptRef);
          
          if (conceptDoc.exists()) {
            const data = conceptDoc.data();
            concepts.push({
              id: conceptDoc.id,
              ...data
            } as Concept);
          }
        }
        
        return concepts;
      } catch (err) {
        console.error('Error getting concepts by IDs:', err);
        return [];
      }
    },
    []
  );
  
  /**
   * Obtener conteo de conceptos listos para repaso
   */
  const getReviewableConceptsCount = useCallback(
    async (userId: string, notebookId: string): Promise<number> => {
      try {
        const learningData = await getLearningDataForNotebook(userId, notebookId);
        const readyForReview = getConceptsReadyForReview(learningData);
        return readyForReview.length;
      } catch (err) {
        console.error('Error getting reviewable concepts count:', err);
        return 0;
      }
    },
    []
  );
  
  /**
   * Obtener estadísticas de conceptos
   */
  const getConceptStats = useCallback(
    async (userId: string, notebookId: string): Promise<any> => {
      try {
        const learningData = await getLearningDataForNotebook(userId, notebookId);
        return calculateLearningStats(learningData);
      } catch (err) {
        console.error('Error getting concept stats:', err);
        return {
          totalConcepts: 0,
          readyForReview: 0,
          dueToday: 0,
          dueTomorrow: 0,
          averageEaseFactor: 2.5,
          averageInterval: 1
        };
      }
    },
    []
  );
  
  /**
   * Actualizar estadísticas del usuario
   */
  const updateUserStats = useCallback(
    async (userId: string, updates: any): Promise<void> => {
      try {
        const userStatsRef = doc(db, 'users', userId, 'stats', 'study');
        await updateDoc(userStatsRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Error updating user stats:', err);
      }
    },
    []
  );
  
  /**
   * Obtener todos los conceptos de un cuaderno
   */
  const getAllConceptsFromNotebook = useCallback(
    async (userId: string, notebookId: string): Promise<Concept[]> => {
      try {
        const conceptsQuery = query(
          collection(db, 'conceptos'),
          where('cuadernoId', '==', notebookId)
        );
        
        const conceptDocs = await getDocs(conceptsQuery);
        const allConcepts: Concept[] = [];
        
        for (const doc of conceptDocs.docs) {
          const conceptosData = doc.data().conceptos || [];
          conceptosData.forEach((concepto: any, index: number) => {
            allConcepts.push({
              id: `${doc.id}-${index}`,
              término: concepto.término,
              definición: concepto.definición,
              fuente: concepto.fuente,
              usuarioId: concepto.usuarioId,
              docId: doc.id,
              index,
              notasPersonales: concepto.notasPersonales,
              reviewId: concepto.reviewId,
              dominado: concepto.dominado
            } as Concept);
          });
        }
        
        return allConcepts;
      } catch (err) {
        console.error('Error getting concepts from notebook:', err);
        return [];
      }
    },
    []
  );

  return {
    error,
    createStudySession,
    completeStudySession,
    updateConceptResponse,
    getReviewableConcepts,
    getReviewableConceptsCount,
    getConceptStats,
    getStudyDashboardData,
    getStudyLimits,
    checkFreeStudyLimit,
    getAllConceptsFromNotebook,
    logStudyActivity
  };
};