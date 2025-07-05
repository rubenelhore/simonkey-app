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
  increment,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  Concept, 
  StudyMode, 
  LearningData, 
  StudyLimits,
  StudyDashboardData,
  ResponseQuality,
  UserSubscriptionType
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
import { getEffectiveUserId } from '../utils/getEffectiveUserId';

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
export const useStudyService = (userSubscription?: UserSubscriptionType | string) => {
  const [error, setError] = useState<string | null>(null);
  
  // Normalizar la comparación para manejar strings y enums
  const normalizedSubscription = typeof userSubscription === 'string' 
    ? userSubscription.toLowerCase() 
    : userSubscription;
  
  const isSchoolStudent = normalizedSubscription === UserSubscriptionType.SCHOOL || 
                         normalizedSubscription === 'school';
  
  console.log('🔍 useStudyService - userSubscription:', userSubscription);
  console.log('🔍 useStudyService - isSchoolStudent:', isSchoolStudent);
  
  /**
   * Obtiene el ID efectivo del usuario, asegurándose de usar el ID correcto para usuarios escolares
   */
  const getEffectiveUserIdForService = useCallback(
    async (providedUserId: string): Promise<string> => {
      // Si es un estudiante escolar, verificar si el ID proporcionado es el correcto
      if (isSchoolStudent) {
        const effectiveUserData = await getEffectiveUserId();
        if (effectiveUserData && effectiveUserData.isSchoolUser) {
          console.log('🎓 Using school user ID:', effectiveUserData.id, 'instead of:', providedUserId);
          return effectiveUserData.id;
        }
      }
      return providedUserId;
    },
    [isSchoolStudent]
  );
  
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
        // Obtener el ID efectivo del usuario
        const effectiveUserId = await getEffectiveUserIdForService(userId);
        console.log('📝 createStudySession - using effectiveUserId:', effectiveUserId);
        
        // Verificar límites según el modo
        if (mode === StudyMode.FREE) {
          const canStudy = await checkFreeStudyLimit(effectiveUserId, notebookId);
          if (!canStudy) {
            throw new Error('Ya has usado tu sesión de estudio libre hoy');
          }
        } else if (mode === StudyMode.SMART) {
          const canStudy = await checkSmartStudyLimit(effectiveUserId, notebookId);
          if (!canStudy) {
            throw new Error('Ya has usado tu sesión de estudio inteligente hoy para este cuaderno');
          }
        }
        
        const sessionData = {
          userId: effectiveUserId,
          notebookId,
          mode,
          conceptsStudied: [],
          startTime: new Date(),
          createdAt: serverTimestamp()
        };
        
        const sessionRef = await addDoc(collection(db, 'studySessions'), sessionData);
        
        // Actualizar estadísticas del usuario
        await updateUserStats(effectiveUserId, {
          totalSessionsStarted: increment(1),
          lastSessionDate: serverTimestamp()
        });
        
        // NOTA: Los límites se actualizan al COMPLETAR la sesión, no al iniciarla
        // Esto evita que se marque como "usado" si el usuario no completa la sesión
        
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
   * Verificar límite de estudio libre (1 por día por cuaderno) - POR CUADERNO
   */
  const checkFreeStudyLimit = useCallback(
    async (userId: string, notebookId: string): Promise<boolean> => {
      try {
        // Obtener el ID efectivo del usuario
        const effectiveUserId = await getEffectiveUserIdForService(userId);
        console.log('🔍 checkFreeStudyLimit llamado para usuario:', effectiveUserId, 'cuaderno:', notebookId);
        
        // CORRECCIÓN: Usar un solo documento con campos separados
        const limitsRef = doc(db, 'users', effectiveUserId, 'notebookLimits', notebookId);
        const limitsDoc = await getDoc(limitsRef);
        
        console.log('🔍 Documento de límites del cuaderno existe:', limitsDoc.exists());
        
        if (!limitsDoc.exists()) {
          console.log('✅ No hay límites previos para este cuaderno, disponible');
          return true; // Primera vez, puede estudiar
        }
        
        const limits = limitsDoc.data();
        console.log('🔍 Límites del cuaderno encontrados:', limits);
        
        const lastFreeStudyDate = limits.lastFreeStudyDate instanceof Timestamp 
          ? limits.lastFreeStudyDate.toDate() 
          : limits.lastFreeStudyDate;
        
        console.log('🔍 lastFreeStudyDate procesado (por cuaderno):', lastFreeStudyDate);
        console.log('🔍 Tipo de lastFreeStudyDate:', typeof lastFreeStudyDate);
        
        const isAvailable = isFreeStudyAvailable(lastFreeStudyDate);
        console.log('🔍 Resultado de isFreeStudyAvailable (por cuaderno):', isAvailable);
        
        return isAvailable;
      } catch (err) {
        console.error('Error checking free study limit:', err);
        return true; // En caso de error, permitir estudio
      }
    },
    []
  );
  
  /**
   * Verificar límite de estudio inteligente (1 por día por cuaderno) - POR CUADERNO
   */
  const checkSmartStudyLimit = useCallback(
    async (userId: string, notebookId: string): Promise<boolean> => {
      try {
        // Obtener el ID efectivo del usuario
        const effectiveUserId = await getEffectiveUserIdForService(userId);
        console.log('🔍 checkSmartStudyLimit llamado para usuario:', effectiveUserId, 'cuaderno:', notebookId);
        
        // CORRECCIÓN: Usar un solo documento con campos separados
        const notebookLimitsRef = doc(db, 'users', effectiveUserId, 'notebookLimits', notebookId);
        const notebookLimitsDoc = await getDoc(notebookLimitsRef);
        
        console.log('🔍 Documento de límites del cuaderno existe:', notebookLimitsDoc.exists());
        
        if (!notebookLimitsDoc.exists()) {
          console.log('✅ No hay límites previos para este cuaderno, disponible');
          return true; // Primera vez, puede estudiar
        }
        
        const limits = notebookLimitsDoc.data();
        console.log('🔍 Límites del cuaderno encontrados:', limits);
        
        const lastSmartStudyDate = limits.lastSmartStudyDate instanceof Timestamp 
          ? limits.lastSmartStudyDate.toDate() 
          : limits.lastSmartStudyDate;
        
        const lastQuizPassed = limits.lastQuizPassed !== undefined ? limits.lastQuizPassed : true;
        
        console.log('🔍 lastSmartStudyDate procesado (por cuaderno):', lastSmartStudyDate);
        console.log('🔍 lastQuizPassed:', lastQuizPassed);
        
        if (!lastSmartStudyDate) {
          console.log('✅ No hay fecha de último estudio inteligente para este cuaderno, disponible');
          return true;
        }
        
        // Verificar si ya se usó hoy
        const today = new Date();
        const lastStudy = new Date(lastSmartStudyDate);
        
        today.setHours(0, 0, 0, 0);
        lastStudy.setHours(0, 0, 0, 0);
        
        // Si el último quiz falló, bloquear hasta el día siguiente
        const isNewDay = today.getTime() !== lastStudy.getTime();
        
        if (!lastQuizPassed) {
          // Si el quiz falló, solo permitir si es un nuevo día
          console.log('❌ Último quiz fallido. Solo disponible en un nuevo día:', isNewDay);
          return isNewDay;
        }
        
        // Si el quiz pasó, usar la lógica normal
        const isAvailable = isNewDay;
        
        console.log('🔍 Cálculo de disponibilidad de estudio inteligente (por cuaderno):', {
          today: today.toISOString(),
          lastStudy: lastStudy.toISOString(),
          lastQuizPassed: lastQuizPassed,
          isAvailable: isAvailable
        });
        
        return isAvailable;
      } catch (err) {
        console.error('Error checking smart study limit:', err);
        return true; // En caso de error, permitir estudio
      }
    },
    []
  );
  
  /**
   * Actualizar uso de estudio libre - POR CUADERNO
   */
  const updateFreeStudyUsage = useCallback(
    async (userId: string, notebookId: string): Promise<void> => {
      try {
        console.log('🔄 Actualizando límites de estudio libre por cuaderno para usuario:', userId, 'cuaderno:', notebookId);
        // CORRECCIÓN: Usar un solo documento con campos separados
        const limitsRef = doc(db, 'users', userId, 'notebookLimits', notebookId);
        await setDoc(limitsRef, {
          userId,
          notebookId,
          lastFreeStudyDate: new Date(),
          freeStudyCountToday: 1,
          weekStartDate: getWeekStartDate(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('✅ Límites de estudio libre por cuaderno actualizados');
      } catch (err) {
        console.error('Error updating free study usage:', err);
      }
    },
    []
  );
  
  /**
   * Actualizar uso de estudio inteligente (límite de frecuencia) - POR CUADERNO
   */
  const updateSmartStudyUsage = useCallback(
    async (userId: string, notebookId: string, quizPassed: boolean = true): Promise<void> => {
      try {
        // Obtener el ID efectivo del usuario
        const effectiveUserId = await getEffectiveUserIdForService(userId);
        console.log('🔄 Actualizando límites de estudio inteligente por cuaderno para cuaderno:', notebookId, 'Quiz pasado:', quizPassed);
        // CORRECCIÓN: Usar un solo documento con campos separados
        const notebookLimitsRef = doc(db, 'users', effectiveUserId, 'notebookLimits', notebookId);
        await setDoc(notebookLimitsRef, {
          userId: effectiveUserId,
          notebookId,
          lastSmartStudyDate: new Date(),
          smartStudyCountToday: 1,
          lastQuizPassed: quizPassed, // Guardar si el quiz fue aprobado o no
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('✅ Límites de estudio inteligente por cuaderno actualizados');
      } catch (err) {
        console.error('Error updating smart study usage:', err);
      }
    },
    []
  );
  
  /**
   * Reset free study limit (for testing purposes)
   */
  const resetFreeStudyLimit = useCallback(
    async (userId: string): Promise<void> => {
      try {
        const limitsRef = doc(db, 'users', userId, 'limits', 'study');
        await setDoc(limitsRef, {
          userId,
          lastFreeStudyDate: null,
          freeStudyCountToday: 0,
          weekStartDate: getWeekStartDate(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('Free study limit reset successfully');
      } catch (err) {
        console.error('Error resetting free study limit:', err);
      }
    },
    []
  );
  
  /**
   * Reset quiz limit (for testing purposes) - POR CUADERNO
   */
  const resetQuizLimit = useCallback(
    async (userId: string, notebookId?: string): Promise<void> => {
      try {
        if (!notebookId) {
          console.log('⚠️ No se proporcionó notebookId para reset de límites de quiz');
          return;
        }
        
        console.log('🔄 Iniciando reset de límite de quiz para cuaderno:', notebookId);
        
        // Resetear límites específicos del cuaderno
        const limitsRef = doc(db, 'users', userId, 'notebookLimits', notebookId);
        
        // Primero, obtener los límites actuales
        const currentLimits = await getDoc(limitsRef);
        console.log('📊 Límites del cuaderno actuales antes del reset:', currentLimits.exists() ? currentLimits.data() : 'No existen');
        
        await setDoc(limitsRef, {
          userId,
          notebookId,
          lastQuizDate: null,
          quizCountThisWeek: 0,
          weekStartDate: getWeekStartDate(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Quiz limit del cuaderno reset successfully');
        console.log('📋 Datos reseteados:', {
          notebookId,
          lastQuizDate: null,
          quizCountThisWeek: 0,
          weekStartDate: getWeekStartDate()
        });
      } catch (err) {
        console.error('❌ Error resetting quiz limit del cuaderno:', err);
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
        
        // Verificar disponibilidad de quiz
        const isQuizAvailable = isFreeStudyAvailable(
          limits.lastFreeStudyDate instanceof Timestamp 
            ? limits.lastFreeStudyDate.toDate() 
            : limits.lastFreeStudyDate
        );
        
        return {
          generalScore,
          nextSmartStudyDate,
          nextQuizDate,
          smartStudiesCount,
          maxQuizScore,
          totalConcepts: smartStudiesCount,
          completedSmartSessions: 0,
          completedFreeSessions: 0,
          isFreeStudyAvailable: isFreeStudyAvailable(
            limits.lastFreeStudyDate instanceof Timestamp 
              ? limits.lastFreeStudyDate.toDate() 
              : limits.lastFreeStudyDate
          ),
          isSmartStudyAvailable: smartStudiesCount > 0,
          isQuizAvailable: smartStudiesCount > 0 && isQuizAvailable,
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
        // Obtener el ID efectivo del usuario
        const effectiveUserId = await getEffectiveUserIdForService(userId);
        
        const learningRef = collection(db, 'users', effectiveUserId, 'learningData');
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
        // Obtener el ID efectivo del usuario
        const effectiveUserId = await getEffectiveUserIdForService(userId);
        console.log('📝 updateConceptResponse - using effectiveUserId:', effectiveUserId);
        
        // Convertir ResponseQuality a calidad SM-3 (0-5)
        // MODIFICACIÓN: Usar calidad 2 para intervalos más cortos y repasos más frecuentes
        const sm3Quality = quality === ResponseQuality.MASTERED ? 2 : 2; // Cambiado de 4 a 2
        
        console.log('🔍 updateConceptResponse:', {
          conceptId,
          originalQuality: quality,
          sm3Quality: sm3Quality,
          reason: 'Usando calidad 2 para intervalos más cortos y repasos más frecuentes'
        });
        
        // Obtener datos de aprendizaje actuales
        const learningRef = doc(db, 'users', effectiveUserId, 'learningData', conceptId);
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
          `Concepto ${conceptId} marcado como ${quality === ResponseQuality.MASTERED ? 'dominado' : 'revisar después'} (calidad SM-3: ${sm3Quality})`
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
        // Obtener el ID efectivo del usuario
        const effectiveUserId = await getEffectiveUserIdForService(userId);
        console.log('📝 getReviewableConcepts - using effectiveUserId:', effectiveUserId);
        
        console.log('🔍 getReviewableConcepts llamado para:', { effectiveUserId, notebookId });
        
        // 1. Obtener TODOS los conceptos del cuaderno primero
        const allNotebookConcepts = await getAllConceptsFromNotebook(effectiveUserId, notebookId);
        console.log('📚 Total de conceptos en el cuaderno:', allNotebookConcepts.length);
        
        // 2. Obtener datos de aprendizaje existentes
        const learningData = await getLearningDataForNotebook(effectiveUserId, notebookId);
        console.log('📊 Datos de aprendizaje encontrados:', learningData.length);
        
        // 3. Crear un Set con los IDs de conceptos que ya tienen datos de aprendizaje
        const conceptsWithLearningData = new Set(learningData.map(data => data.conceptId));
        
        // 4. Identificar conceptos nuevos (sin datos de aprendizaje)
        const newConcepts = allNotebookConcepts.filter(concept => 
          !conceptsWithLearningData.has(concept.id)
        );
        console.log('🆕 Conceptos nuevos sin datos de aprendizaje:', newConcepts.length);
        
        // 5. Obtener conceptos con datos de aprendizaje listos para repaso
        const readyForReview = getConceptsReadyForReview(learningData);
        console.log('✅ Conceptos con datos de aprendizaje listos para repaso:', readyForReview.length);
        
        // 6. Si hay conceptos listos para repaso, obtenerlos
        let conceptsForReview: Concept[] = [];
        if (readyForReview.length > 0) {
          const conceptIds = readyForReview.map(data => data.conceptId);
          conceptsForReview = await getConceptsByIds(conceptIds, userId, notebookId);
          conceptsForReview = conceptsForReview.filter(concept => concept.id && concept.término);
        }
        
        // 7. Combinar conceptos nuevos + conceptos listos para repaso
        const allReviewableConcepts = [...newConcepts, ...conceptsForReview];
        
        console.log('🎯 Total de conceptos disponibles para estudio inteligente:', allReviewableConcepts.length);
        console.log('📋 Desglose:', {
          conceptosNuevos: newConcepts.length,
          conceptosParaRepaso: conceptsForReview.length,
          total: allReviewableConcepts.length
        });
        
        // Limpiar datos de aprendizaje obsoletos si es necesario
        if (readyForReview.length > 0 && conceptsForReview.length === 0) {
          console.log('⚠️ Limpiando datos de aprendizaje obsoletos...');
          const validConceptIds = new Set(allNotebookConcepts.map(c => c.id));
          
          for (const learningItem of readyForReview) {
            if (!validConceptIds.has(learningItem.conceptId)) {
              console.log('🗑️ Eliminando datos de aprendizaje para concepto obsoleto:', learningItem.conceptId);
              try {
                const learningRef = doc(db, 'users', userId, 'learningData', learningItem.conceptId);
                await deleteDoc(learningRef);
              } catch (err) {
                console.error('Error eliminando datos de aprendizaje obsoleto:', err);
              }
            }
          }
        }
        
        return allReviewableConcepts;
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
    async (conceptIds: string[], userId: string, notebookId: string, userSubscription?: UserSubscriptionType): Promise<Concept[]> => {
      try {
        console.log('🔍 Buscando conceptos con IDs:', conceptIds);
        console.log('📚 Buscando en cuaderno:', notebookId);
        
        // Use the isSchoolStudent from hook initialization or the passed parameter
        const normalizedUserSub = typeof userSubscription === 'string' 
          ? userSubscription.toLowerCase() 
          : userSubscription;
        const isStudent = userSubscription 
          ? (normalizedUserSub === UserSubscriptionType.SCHOOL || normalizedUserSub === 'school')
          : isSchoolStudent;
        const collectionName = isStudent ? 'schoolConcepts' : 'conceptos';
        
        // Buscar todos los documentos de conceptos del cuaderno
        const conceptsQuery = query(
          collection(db, collectionName),
          where('cuadernoId', '==', notebookId)
        );
        
        const conceptDocs = await getDocs(conceptsQuery);
        const allConcepts: Concept[] = [];
        
        // Extraer todos los conceptos de todos los documentos
        for (const doc of conceptDocs.docs) {
          const conceptosData = doc.data().conceptos || [];
          conceptosData.forEach((concepto: any, index: number) => {
            // Usar el ID que se generó al crear el concepto (UUID)
            const conceptId = concepto.id || `${doc.id}-${index}`;
            allConcepts.push({
              id: conceptId,
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
        
        console.log('📋 Todos los conceptos encontrados:', allConcepts.map(c => ({ id: c.id, término: c.término })));
        console.log('🔍 IDs de conceptos en el cuaderno:', allConcepts.map(c => c.id));
        console.log('🎯 IDs buscados:', conceptIds);
        
        // Filtrar solo los conceptos que están en la lista de IDs buscados
        const filteredConcepts = allConcepts.filter(concept => {
          // Verificar si el ID del concepto coincide directamente
          if (conceptIds.includes(concept.id)) {
            return true;
          }
          
          // Verificar si coincide con el ID generado usando docId-index
          const generatedId = `${concept.docId}-${concept.index}`;
          if (conceptIds.includes(generatedId)) {
            return true;
          }
          
          return false;
        });
        
        console.log('✅ Conceptos encontrados:', filteredConcepts.length, 'de', conceptIds.length);
        console.log('🎯 Conceptos filtrados:', filteredConcepts.map(c => ({ id: c.id, término: c.término })));
        
        return filteredConcepts;
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
        console.log('🔍 getReviewableConceptsCount llamado para:', { userId, notebookId });
        
        // 1. Obtener TODOS los conceptos del cuaderno usando la misma función que getReviewableConcepts
        const allNotebookConcepts = await getAllConceptsFromNotebook(userId, notebookId);
        console.log('📚 Total de conceptos en el cuaderno:', allNotebookConcepts.length);
        
        // 2. Obtener datos de aprendizaje existentes
        const learningData = await getLearningDataForNotebook(userId, notebookId);
        console.log('📊 Datos de aprendizaje encontrados:', learningData.length);
        
        // 3. Crear un Set con los IDs de conceptos que ya tienen datos de aprendizaje
        const conceptsWithLearningData = new Set(learningData.map(data => data.conceptId));
        
        // 4. Identificar conceptos nuevos (sin datos de aprendizaje)
        const newConceptIds = allNotebookConcepts
          .filter(concept => !conceptsWithLearningData.has(concept.id))
          .map(concept => concept.id);
        
        console.log('🆕 Conceptos nuevos sin datos de aprendizaje:', newConceptIds.length);
        
        // 5. Obtener conceptos con datos de aprendizaje listos para repaso
        const readyForReview = getConceptsReadyForReview(learningData);
        console.log('✅ Conceptos con datos de aprendizaje listos para repaso:', readyForReview.length);
        
        // 6. El total de conceptos disponibles para estudio inteligente es:
        // - Conceptos nuevos (disponibles inmediatamente)
        // - Conceptos con nextReviewDate <= hoy
        const totalReviewable = newConceptIds.length + readyForReview.length;
        
        console.log('🎯 Total de conceptos disponibles para estudio inteligente:', totalReviewable);
        console.log('📋 Desglose:', {
          conceptosNuevos: newConceptIds.length,
          conceptosParaRepaso: readyForReview.length,
          total: totalReviewable
        });
        
        return totalReviewable;
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
        // Obtener el ID efectivo del usuario
        const effectiveUserId = await getEffectiveUserIdForService(userId);
        const userStatsRef = doc(db, 'users', effectiveUserId, 'stats', 'study');
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
        // Use the isSchoolStudent from hook initialization
        const collectionName = isSchoolStudent ? 'schoolConcepts' : 'conceptos';
        
        console.log('🔍 getAllConceptsFromNotebook - isSchoolStudent:', isSchoolStudent);
        console.log('🔍 getAllConceptsFromNotebook - collectionName:', collectionName);
        console.log('🔍 getAllConceptsFromNotebook - notebookId:', notebookId);
        
        const conceptsQuery = query(
          collection(db, collectionName),
          where('cuadernoId', '==', notebookId)
        );
        
        const conceptDocs = await getDocs(conceptsQuery);
        const allConcepts: Concept[] = [];
        
        for (const doc of conceptDocs.docs) {
          const conceptosData = doc.data().conceptos || [];
          conceptosData.forEach((concepto: any, index: number) => {
            // Usar el ID que se generó al crear el concepto (UUID) o generar uno como fallback
            const conceptId = concepto.id || `${doc.id}-${index}`;
            allConcepts.push({
              id: conceptId,
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

  /**
   * Marcar una sesión de estudio como validada o no validada
   */
  const markStudySessionAsValidated = useCallback(
    async (sessionId: string, validated: boolean = true): Promise<void> => {
      try {
        console.log('🔄 Marcando sesión como validada:', { sessionId, validated });
        const sessionRef = doc(db, 'studySessions', sessionId);
        
        await updateDoc(sessionRef, {
          validated,
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Sesión marcada como validada:', validated);
      } catch (err) {
        console.error('Error marking study session as validated:', err);
        throw err;
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
    checkSmartStudyLimit,
    getAllConceptsFromNotebook,
    logStudyActivity,
    updateFreeStudyUsage,
    updateSmartStudyUsage,
    resetFreeStudyLimit,
    resetQuizLimit,
    markStudySessionAsValidated
  };
};