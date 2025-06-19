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
          const canStudy = await checkFreeStudyLimit(userId, notebookId);
          if (!canStudy) {
            throw new Error('Ya has usado tu sesión de estudio libre hoy');
          }
        } else if (mode === StudyMode.SMART) {
          const canStudy = await checkSmartStudyLimit(userId, notebookId);
          if (!canStudy) {
            throw new Error('Ya has usado tu sesión de estudio inteligente hoy para este cuaderno');
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
   * Verificar límite de estudio libre (1 por día)
   */
  const checkFreeStudyLimit = useCallback(
    async (userId: string, notebookId?: string): Promise<boolean> => {
      try {
        console.log('🔍 checkFreeStudyLimit llamado para usuario:', userId, 'cuaderno:', notebookId);
        
        const limitsRef = doc(db, 'users', userId, 'limits', 'study');
        const limitsDoc = await getDoc(limitsRef);
        
        console.log('🔍 Documento de límites existe:', limitsDoc.exists());
        
        if (!limitsDoc.exists()) {
          console.log('✅ No hay límites previos, estudio libre disponible');
          return true; // Primera vez, puede estudiar
        }
        
        const limits = limitsDoc.data() as StudyLimits;
        console.log('🔍 Límites encontrados:', limits);
        
        const lastFreeStudyDate = limits.lastFreeStudyDate instanceof Timestamp 
          ? limits.lastFreeStudyDate.toDate() 
          : limits.lastFreeStudyDate;
        
        console.log('🔍 lastFreeStudyDate procesado:', lastFreeStudyDate);
        console.log('🔍 Tipo de lastFreeStudyDate:', typeof lastFreeStudyDate);
        
        const isAvailable = isFreeStudyAvailable(lastFreeStudyDate);
        console.log('🔍 Resultado de isFreeStudyAvailable:', isAvailable);
        
        return isAvailable;
      } catch (err) {
        console.error('Error checking free study limit:', err);
        return true; // En caso de error, permitir estudio
      }
    },
    []
  );
  
  /**
   * Verificar límite de estudio inteligente (1 por día por cuaderno)
   */
  const checkSmartStudyLimit = useCallback(
    async (userId: string, notebookId: string): Promise<boolean> => {
      try {
        console.log('🔍 checkSmartStudyLimit llamado para usuario:', userId, 'cuaderno:', notebookId);
        
        const notebookLimitsRef = doc(db, 'users', userId, 'notebooks', notebookId, 'limits');
        const notebookLimitsDoc = await getDoc(notebookLimitsRef);
        
        console.log('🔍 Documento de límites del cuaderno existe:', notebookLimitsDoc.exists());
        
        if (!notebookLimitsDoc.exists()) {
          console.log('✅ No hay límites previos para este cuaderno, estudio inteligente disponible');
          return true; // Primera vez, puede estudiar
        }
        
        const limits = notebookLimitsDoc.data();
        console.log('🔍 Límites del cuaderno encontrados:', limits);
        
        const lastSmartStudyDate = limits.lastSmartStudyDate instanceof Timestamp 
          ? limits.lastSmartStudyDate.toDate() 
          : limits.lastSmartStudyDate;
        
        console.log('🔍 lastSmartStudyDate procesado:', lastSmartStudyDate);
        
        if (!lastSmartStudyDate) {
          console.log('✅ No hay fecha de último estudio inteligente, disponible');
          return true;
        }
        
        // Verificar si ya se usó hoy
        const today = new Date();
        const lastStudy = new Date(lastSmartStudyDate);
        
        today.setHours(0, 0, 0, 0);
        lastStudy.setHours(0, 0, 0, 0);
        
        const isAvailable = today.getTime() !== lastStudy.getTime();
        
        console.log('🔍 Cálculo de disponibilidad de estudio inteligente:', {
          today: today.toISOString(),
          lastStudy: lastStudy.toISOString(),
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
   * Actualizar uso de estudio libre
   */
  const updateFreeStudyUsage = useCallback(
    async (userId: string): Promise<void> => {
      try {
        console.log('🔄 Actualizando límites de estudio libre para usuario:', userId);
        const limitsRef = doc(db, 'users', userId, 'limits', 'study');
        await setDoc(limitsRef, {
          userId,
          lastFreeStudyDate: new Date(),
          freeStudyCountToday: 1,
          weekStartDate: getWeekStartDate(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('✅ Límites de estudio libre actualizados');
      } catch (err) {
        console.error('Error updating free study usage:', err);
      }
    },
    []
  );
  
  /**
   * Actualizar uso de estudio inteligente (límite de frecuencia)
   */
  const updateSmartStudyUsage = useCallback(
    async (userId: string, notebookId: string): Promise<void> => {
      try {
        console.log('🔄 Actualizando límites de estudio inteligente para cuaderno:', notebookId);
        const notebookLimitsRef = doc(db, 'users', userId, 'notebooks', notebookId, 'limits');
        await setDoc(notebookLimitsRef, {
          userId,
          notebookId,
          lastSmartStudyDate: new Date(),
          smartStudyCountToday: 1,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('✅ Límites de estudio inteligente actualizados');
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
        const limitsRef = doc(db, 'users', userId, 'notebooks', notebookId, 'limits');
        
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
        console.log('🔍 getReviewableConcepts llamado para:', { userId, notebookId });
        
        const learningData = await getLearningDataForNotebook(userId, notebookId);
        console.log('📊 Datos de aprendizaje encontrados:', learningData.length);
        
        const readyForReview = getConceptsReadyForReview(learningData);
        console.log('✅ Conceptos listos para repaso:', readyForReview.length);
        console.log('🎯 IDs de conceptos listos:', readyForReview.map(data => data.conceptId));
        
        if (readyForReview.length === 0) {
          console.log('❌ No hay conceptos listos para repaso');
          return [];
        }
        
        // Obtener los conceptos correspondientes
        const conceptIds = readyForReview.map(data => data.conceptId);
        console.log('🔍 Buscando conceptos con IDs:', conceptIds);
        
        const concepts = await getConceptsByIds(conceptIds, userId, notebookId);
        console.log('✅ Conceptos encontrados para estudio:', concepts.length);
        console.log('🎯 Conceptos para estudio:', concepts.map(c => ({ id: c.id, término: c.término })));
        
        // Filtrar conceptos que realmente existen en el cuaderno
        const validConcepts = concepts.filter(concept => concept.id && concept.término);
        console.log('✅ Conceptos válidos para estudio:', validConcepts.length);
        
        if (validConcepts.length === 0) {
          console.log('⚠️ No se encontraron conceptos válidos. Limpiando datos de aprendizaje obsoletos...');
          
          // Limpiar datos de aprendizaje para conceptos que ya no existen
          const allNotebookConcepts = await getAllConceptsFromNotebook(userId, notebookId);
          const validConceptIds = new Set(allNotebookConcepts.map(c => c.id));
          
          // Eliminar datos de aprendizaje para conceptos que ya no existen
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
        
        return validConcepts;
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
    async (conceptIds: string[], userId: string, notebookId: string): Promise<Concept[]> => {
      try {
        console.log('🔍 Buscando conceptos con IDs:', conceptIds);
        console.log('📚 Buscando en cuaderno:', notebookId);
        
        // Buscar todos los documentos de conceptos del cuaderno
        const conceptsQuery = query(
          collection(db, 'conceptos'),
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
        
        const learningData = await getLearningDataForNotebook(userId, notebookId);
        console.log('📊 Datos de aprendizaje encontrados:', learningData.length);
        console.log('📋 Datos de aprendizaje:', learningData.map(data => ({
          conceptId: data.conceptId,
          nextReviewDate: data.nextReviewDate?.toISOString()
        })));
        
        const readyForReview = getConceptsReadyForReview(learningData);
        console.log('✅ Conceptos listos para repaso:', readyForReview.length);
        console.log('🎯 IDs de conceptos listos:', readyForReview.map(data => data.conceptId));
        
        // Verificar que los conceptos realmente existen en el cuaderno
        if (readyForReview.length > 0) {
          const conceptIds = readyForReview.map(data => data.conceptId);
          const validConcepts = await getConceptsByIds(conceptIds, userId, notebookId);
          const actualValidConcepts = validConcepts.filter(concept => concept.id && concept.término);
          
          console.log('✅ Conceptos válidos para repaso:', actualValidConcepts.length);
          return actualValidConcepts.length;
        }
        
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
    resetQuizLimit
  };
};