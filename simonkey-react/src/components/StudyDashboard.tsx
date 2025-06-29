import React, { useState, useEffect } from 'react';
import { StudyDashboardData, Notebook, StudyMode, LearningData, UserSubscriptionType } from '../types/interfaces';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useStudyService } from '../hooks/useStudyService';
import { getNextSmartStudyDate } from '../utils/sm3Algorithm';
import '../styles/StudyDashboard.css';

// Función auxiliar para obtener datos de aprendizaje
const getLearningDataForNotebook = async (userId: string, notebookId: string): Promise<LearningData[]> => {
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
};

interface StudyDashboardProps {
  notebook: Notebook | null;
  userId: string;
  userSubscription?: UserSubscriptionType;
  onRefresh?: () => void;
  onStartSession?: (mode: StudyMode) => void;
}

const StudyDashboard: React.FC<StudyDashboardProps> = ({ 
  notebook, 
  userId, 
  userSubscription,
  onRefresh,
  onStartSession
}) => {
  const [dashboardData, setDashboardData] = useState<StudyDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [studyLimits, setStudyLimits] = useState<any>(null);

  const studyService = useStudyService(userSubscription);

  // Debug prop validation
  useEffect(() => {
    console.log('[STUDY DASHBOARD] Component rendered with props:', {
      hasNotebook: !!notebook,
      notebookTitle: notebook?.title,
      hasOnStartSession: !!onStartSession,
      onStartSessionType: typeof onStartSession,
      userId: userId
    });
  }, [notebook, onStartSession]);

  // Efecto para cargar datos cuando cambie el cuaderno o usuario
  useEffect(() => {
    if (notebook && userId) {
      console.log('StudyDashboard: Cargando datos para cuaderno:', notebook.title);
      loadDashboardData();
    } else {
      setDashboardData(null);
      setLoading(false);
    }
  }, [notebook?.id, userId]); // Usar notebook.id para que se actualice cuando cambie el cuaderno

  // Efecto para actualizar la disponibilidad de estudio libre cuando cambien los límites
  useEffect(() => {
    if (dashboardData && studyLimits) {
      console.log('🔄 Actualizando disponibilidad de estudio libre basada en límites actuales');
      loadDashboardData(); // Recargar datos para reflejar cambios en límites
    }
  }, [studyLimits?.lastFreeStudyDate]);

  const loadDashboardData = async () => {
    if (!notebook || !userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await loadNotebookSpecificData(notebook.id, userId);
      setDashboardData(data);
      
      // Guardar los límites en el estado para el useEffect
      // if (data.lastFreeStudyDate !== undefined) {
      //   setStudyLimits({ lastFreeStudyDate: data.lastFreeStudyDate });
      // }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadNotebookSpecificData = async (notebookId: string, userId: string): Promise<StudyDashboardData> => {
    console.log('Cargando datos REALES para cuaderno:', notebookId);
    
    let totalConcepts = 0;
    let masteredConcepts = 0;
    let smartStudiesCount = 0;
    let maxQuizScore = 0;
    let completedSmartSessions = 0;
    let completedFreeSessions = 0;
    
    try {
      // 1. CONSULTA REAL: Obtener conceptos del cuaderno
      console.log('Consultando conceptos reales...');
      
      // Intentar diferentes estructuras de datos de Firebase
      const conceptsQueries = [
        // Estructura 1: notebooks/{notebookId}/concepts
        query(collection(db, 'notebooks', notebookId, 'concepts')),
        // Estructura 2: users/{userId}/notebooks/{notebookId}/concepts  
        query(collection(db, 'users', userId, 'notebooks', notebookId, 'concepts')),
        // Estructura 3: conceptos con filtros
        query(collection(db, 'conceptos'), where('cuadernoId', '==', notebookId)),
        // Estructura 4: conceptos con filtros de usuario
        query(collection(db, 'conceptos'), where('cuadernoId', '==', notebookId), where('usuarioId', '==', userId)),
        // Estructura 5: conceptos escolares (para usuarios escolares)
        query(collection(db, 'schoolConcepts'), where('cuadernoId', '==', notebookId))
      ];
      
      let conceptDocs = null;
      let queryIndex = 0;
      
      // Intentar cada consulta hasta que una funcione
      for (const conceptQuery of conceptsQueries) {
        try {
          console.log(`Intentando consulta ${queryIndex + 1}...`);
          conceptDocs = await getDocs(conceptQuery);
          if (!conceptDocs.empty) {
            console.log(`✅ Consulta ${queryIndex + 1} exitosa, encontrados ${conceptDocs.size} documentos`);
            break;
          } else {
            console.log(`⚠️ Consulta ${queryIndex + 1} vacía`);
          }
        } catch (error) {
          console.log(`❌ Consulta ${queryIndex + 1} falló:`, error);
        }
        queryIndex++;
      }
      
      // Procesar conceptos encontrados
      if (conceptDocs && !conceptDocs.empty) {
        conceptDocs.forEach((doc) => {
          const data = doc.data();
          console.log('Documento de concepto:', data);
          
          // Manejar diferentes estructuras de datos
          if (data.conceptos && Array.isArray(data.conceptos)) {
            // Estructura con array de conceptos
            totalConcepts += data.conceptos.length;
            data.conceptos.forEach((concepto: any) => {
              if (concepto.dominado) {
                masteredConcepts++;
              }
              if (concepto.reviewId) {
                smartStudiesCount++;
              }
            });
          } else if (data.término && data.definición) {
            // Estructura con concepto individual
            totalConcepts++;
            if (data.dominado) {
              masteredConcepts++;
            }
            if (data.reviewId) {
              smartStudiesCount++;
            }
          } else if (data.term && data.definition) {
            // Estructura alternativa en inglés
            totalConcepts++;
            if (data.mastered) {
              masteredConcepts++;
            }
            if (data.reviewId) {
              smartStudiesCount++;
            }
          }
        });
      } else {
        console.log('❌ No se encontraron conceptos en ninguna estructura');
      }

    } catch (error) {
      console.error('Error consultando conceptos:', error);
    }

    try {
      // 2. CONSULTA REAL: Obtener estadísticas de quiz
      console.log('Consultando estadísticas de quiz reales...');
      console.log('🔍 Ruta de consulta:', `users/${userId}/quizStats/${notebookId}`);
      const quizStatsRef = doc(db, 'users', userId, 'quizStats', notebookId);
      const quizStatsDoc = await getDoc(quizStatsRef);
      
      console.log('📄 Documento existe:', quizStatsDoc.exists());
      if (quizStatsDoc.exists()) {
        const stats = quizStatsDoc.data();
        console.log('📊 Datos completos del documento:', stats);
        maxQuizScore = stats.maxScore || 0;
        console.log('🏆 MaxScore extraído:', maxQuizScore);
        console.log('✅ Estadísticas de quiz encontradas:', stats);
      } else {
        console.log('⚠️ No se encontraron estadísticas de quiz');
        console.log('🔍 Intentando buscar en otras ubicaciones...');
        
        // Intentar buscar en una ubicación alternativa
        try {
          const altQuizStatsRef = doc(db, 'quizStats', notebookId);
          const altQuizStatsDoc = await getDoc(altQuizStatsRef);
          console.log('📄 Documento alternativo existe:', altQuizStatsDoc.exists());
          if (altQuizStatsDoc.exists()) {
            const altStats = altQuizStatsDoc.data();
            console.log('📊 Datos del documento alternativo:', altStats);
            maxQuizScore = altStats.maxScore || 0;
            console.log('🏆 MaxScore del documento alternativo:', maxQuizScore);
          }
        } catch (altError) {
          console.log('❌ Error consultando ubicación alternativa:', altError);
        }
      }
    } catch (error) {
      console.error('❌ Error consultando estadísticas de quiz:', error);
    }

    // 3. CONSULTA REAL: Contar sesiones completadas
    try {
      console.log('Consultando sesiones completadas...');
      const sessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        where('notebookId', '==', notebookId)
      );
      
      const sessionsDocs = await getDocs(sessionsQuery);
      
      sessionsDocs.forEach((doc) => {
        const sessionData = doc.data();
        // Filtrar sesiones completadas en el cliente
        if (sessionData.endTime) {
          if (sessionData.mode === StudyMode.SMART) {
            // Para estudio inteligente, solo contar si fue validado por el Mini Quiz
            if (sessionData.validated === true) {
              completedSmartSessions++;
              console.log('✅ Sesión de estudio inteligente validada contada:', doc.id);
            } else {
              console.log('❌ Sesión de estudio inteligente NO validada (ignorada):', doc.id);
            }
          } else if (sessionData.mode === StudyMode.FREE) {
            completedFreeSessions++;
          }
        }
      });
      
      console.log('✅ Sesiones completadas encontradas:', {
        smart: completedSmartSessions,
        free: completedFreeSessions
      });
    } catch (error) {
      console.error('❌ Error consultando sesiones:', error);
    }

    // 4. CONSULTA REAL: Obtener límites de quiz
    let nextQuizDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Por defecto mañana
    let isQuizAvailable = false;
    let quizLimits = null;
    let freeStudyLimits = null;
    let smartStudyLimits = null;
    
    try {
      console.log('🔍 ===== VERIFICACIÓN DE LÍMITES DE QUIZ =====');
      console.log('🔍 Usuario:', userId);
      console.log('🔍 Cuaderno:', notebookId);
      console.log('🔍 Ruta de consulta:', `users/${userId}/notebookLimits/${notebookId}`);
      
      // CORRECCIÓN: Usar un solo documento con campos separados
      const notebookLimitsRef = doc(db, 'users', userId, 'notebookLimits', notebookId);
      const notebookLimitsDoc = await getDoc(notebookLimitsRef);
      
      console.log('🔍 Documento existe:', notebookLimitsDoc.exists());
      
      if (notebookLimitsDoc.exists()) {
        const limits = notebookLimitsDoc.data();
        console.log('✅ Límites del cuaderno encontrados:', limits);
        
        // Extraer límites de quiz del documento principal
        const lastQuizDate = limits.lastQuizDate?.toDate();
        quizLimits = {
          lastQuizDate: limits.lastQuizDate,
          quizCountThisWeek: limits.quizCountThisWeek,
          weekStartDate: limits.weekStartDate
        };
        
        console.log('🔍 Análisis detallado de límites de quiz:', {
          lastQuizDate: lastQuizDate,
          lastQuizDateExists: !!lastQuizDate,
          quizCountThisWeek: limits.quizCountThisWeek,
          weekStartDate: limits.weekStartDate?.toDate()
        });
        
        if (lastQuizDate) {
          // Si ya se ha usado el quiz, aplicar límites normales
          const now = new Date();
          const daysSinceLastQuiz = Math.floor((now.getTime() - lastQuizDate.getTime()) / (1000 * 60 * 60 * 24));
          console.log('📅 Cálculo de días desde último quiz:', {
            now: now.toISOString(),
            lastQuizDate: lastQuizDate.toISOString(),
            daysSinceLastQuiz: daysSinceLastQuiz,
            shouldBeAvailable: daysSinceLastQuiz >= 7
          });
          
          if (daysSinceLastQuiz < 7) {
            const nextQuiz = new Date(lastQuizDate);
            nextQuiz.setDate(nextQuiz.getDate() + 7);
            nextQuizDate = nextQuiz;
            isQuizAvailable = false;
            console.log(`❌ Quiz no disponible, próximo en ${7 - daysSinceLastQuiz} días (${formatDate(nextQuizDate)})`);
          } else {
            isQuizAvailable = true;
            console.log('✅ Quiz disponible (pasó más de 7 días)');
          }
        } else {
          // No hay lastQuizDate, permitir quiz (primer uso)
          isQuizAvailable = true;
          console.log('✅ Quiz disponible (primer uso)');
        }
        
        // Extraer límites de estudio libre
        freeStudyLimits = {
          lastFreeStudyDate: limits.lastFreeStudyDate,
          freeStudyCountToday: limits.freeStudyCountToday
        };
        
        // Extraer límites de estudio inteligente
        smartStudyLimits = {
          lastSmartStudyDate: limits.lastSmartStudyDate,
          smartStudyCountToday: limits.smartStudyCountToday
        };
        
      } else {
        // No hay límites previos, permitir quiz (primer uso)
        isQuizAvailable = true;
        console.log('⚠️ No se encontraron límites de quiz, asumiendo disponible');
        console.log('🔍 Esto significa que nunca se ha completado un quiz en este cuaderno');
      }
      
      console.log('🔍 ===== RESULTADO FINAL DE QUIZ =====');
      console.log('🔍 isQuizAvailable:', isQuizAvailable);
      console.log('🔍 totalConcepts:', totalConcepts);
      console.log('🔍 isQuizAvailableAndHasConcepts:', totalConcepts > 0 && isQuizAvailable);
      
    } catch (error) {
      console.error('❌ Error consultando límites de quiz:', error);
      isQuizAvailable = true; // En caso de error, asumir disponible
    }

    // 4.1 CONSULTA REAL: Obtener límites de estudio libre por cuaderno
    try {
      console.log('🔍 Consultando límites de estudio libre por cuaderno...');
      // Los límites ya se extrajeron arriba del documento principal
      if (freeStudyLimits) {
        console.log('✅ Límites de estudio libre del cuaderno encontrados:', freeStudyLimits);
      } else {
        console.log('⚠️ No se encontraron límites de estudio libre para este cuaderno (primer uso)');
        freeStudyLimits = null;
      }
    } catch (error) {
      console.error('❌ Error consultando límites de estudio libre por cuaderno:', error);
      freeStudyLimits = null;
    }

    // 4.2 CONSULTA REAL: Obtener límites de estudio inteligente por cuaderno
    try {
      console.log('🔍 Consultando límites de estudio inteligente por cuaderno...');
      // Los límites ya se extrajeron arriba del documento principal
      if (smartStudyLimits) {
        console.log('✅ Límites de estudio inteligente del cuaderno encontrados:', smartStudyLimits);
      } else {
        console.log('⚠️ No se encontraron límites de estudio inteligente para este cuaderno (primer uso)');
        smartStudyLimits = null;
      }
    } catch (error) {
      console.error('❌ Error consultando límites de estudio inteligente por cuaderno:', error);
      smartStudyLimits = null;
    }

    // 5. CALCULAR DATOS REALES
    const generalScore = completedSmartSessions * maxQuizScore;
    
    console.log('🔍 CÁLCULO DEL SCORE GENERAL:', {
      completedSmartSessions,
      maxQuizScore,
      generalScore,
      formula: `${completedSmartSessions} × ${maxQuizScore} = ${generalScore}`
    });

    // Verificar disponibilidad del estudio inteligente según SM-3
    let isSmartStudyAvailable = false;
    let smartStudyReason = '';
    let nextSmartStudyDate = new Date();
    let reviewableCount = 0;
    
    if (totalConcepts > 0) {
      try {
        console.log('🔍 Verificando disponibilidad de estudio inteligente según SM-3...');
        
        // 1. Verificar límites de frecuencia (1 por día por cuaderno)
        const canStudySmart = await studyService.checkSmartStudyLimit(userId, notebookId);
        if (!canStudySmart) {
          isSmartStudyAvailable = false;
          smartStudyReason = 'Ya usado hoy';
          console.log('❌ Estudio inteligente ya usado hoy para este cuaderno');
        } else {
          // 2. Verificar si hay conceptos listos para repaso según SM-3
          reviewableCount = await studyService.getReviewableConceptsCount(userId, notebookId);
          
          if (reviewableCount > 0) {
            isSmartStudyAvailable = true;
            smartStudyReason = `${reviewableCount} conceptos listos para repaso`;
            console.log(`✅ Estudio inteligente disponible: ${reviewableCount} conceptos listos para repaso`);
          } else {
            isSmartStudyAvailable = false;
            smartStudyReason = 'No hay conceptos listos para repaso';
            console.log('❌ Estudio inteligente no disponible: No hay conceptos listos para repaso según SM-3');
          }
        }
        
        // 3. Obtener la próxima fecha de estudio inteligente
        const learningData = await getLearningDataForNotebook(userId, notebookId);
        const nextDate = getNextSmartStudyDate(learningData);
        
        if (nextDate) {
          nextSmartStudyDate = nextDate;
          console.log('📅 Próxima fecha de estudio inteligente según SM-3:', nextSmartStudyDate.toISOString());
        } else {
          // No hay conceptos listos ni fechas futuras programadas
          const futureDates = learningData
            .map(data => new Date(data.nextReviewDate))
            .filter(date => date > new Date())
            .sort((a, b) => a.getTime() - b.getTime());
          
          if (futureDates.length > 0) {
            nextSmartStudyDate = futureDates[0];
            console.log('📅 Próxima fecha de estudio inteligente (futura):', nextSmartStudyDate.toISOString());
          } else {
            // No hay fechas futuras, usar mañana como fallback
            nextSmartStudyDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            console.log('📅 No hay fechas futuras, usando fallback (mañana)');
          }
        }
        
        console.log('🎯 Resumen de estudio inteligente:', {
          isAvailable: isSmartStudyAvailable,
          reason: smartStudyReason,
          nextDate: nextSmartStudyDate.toISOString(),
          reviewableCount: reviewableCount
        });
        
      } catch (error) {
        console.log('Error checking smart study availability, using fallback:', error);
        // En caso de error, asumir que NO está disponible (más seguro)
        isSmartStudyAvailable = false;
        smartStudyReason = 'Error al verificar disponibilidad';
      }
    } else {
      isSmartStudyAvailable = false;
      smartStudyReason = 'No hay conceptos en el cuaderno';
      console.log('❌ Estudio inteligente no disponible: No hay conceptos en el cuaderno');
    }

    // Usar los datos reales de límites para determinar disponibilidad
    const isFreeStudyAvailable = totalConcepts > 0;
    
    const isQuizAvailableAndHasConcepts = totalConcepts > 0 && isQuizAvailable;
    
    // Usar la fecha real del último estudio libre si existe
    let lastFreeStudyDate = freeStudyLimits?.lastFreeStudyDate 
      ? (() => {
          try {
            // Manejar Timestamps de Firestore correctamente
            const date = freeStudyLimits.lastFreeStudyDate instanceof Timestamp 
              ? freeStudyLimits.lastFreeStudyDate.toDate() 
              : new Date(freeStudyLimits.lastFreeStudyDate);
            return isNaN(date.getTime()) ? undefined : date;
          } catch (error) {
            console.warn('Fecha inválida en lastFreeStudyDate:', freeStudyLimits.lastFreeStudyDate);
            return undefined;
          }
        })()
      : undefined;

    // Calcular próxima fecha de estudio libre
    let nextFreeStudyDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Por defecto mañana
    
    // Verificar disponibilidad real de estudio libre usando los límites del cuaderno
    let actualFreeStudyAvailable = isFreeStudyAvailable;
    if (totalConcepts > 0) {
      console.log('🔍 Verificando límites de estudio libre por cuaderno...');
      console.log('🔍 Límites de estudio libre del cuaderno actuales:', freeStudyLimits);
      console.log('🔍 lastFreeStudyDate (por cuaderno):', lastFreeStudyDate ? lastFreeStudyDate.toISOString() : 'undefined');
      
      // Verificación SÍNCRONA de límites de estudio libre usando límites del cuaderno
      if (lastFreeStudyDate) {
        const today = new Date();
        const lastStudy = new Date(lastFreeStudyDate);
        
        today.setHours(0, 0, 0, 0);
        lastStudy.setHours(0, 0, 0, 0);
        
        if (today.getTime() === lastStudy.getTime()) {
          actualFreeStudyAvailable = false;
          console.log('❌ Estudio libre ya usado hoy para este cuaderno');
        } else {
          actualFreeStudyAvailable = true;
          console.log('✅ Estudio libre disponible (no usado hoy para este cuaderno)');
        }
      } else {
        // Si no se ha usado el estudio libre, permitir (primer uso del día)
        actualFreeStudyAvailable = true;
        console.log('✅ Estudio libre disponible (primer uso del día para este cuaderno)');
      }
      
      console.log('🔍 Resultado final de estudio libre (por cuaderno):', actualFreeStudyAvailable);
    } else {
      console.log('🔍 No hay conceptos, usando fallback para estudio libre:', isFreeStudyAvailable);
    }
    
    // Si el estudio libre NO está disponible hoy, la próxima fecha es mañana
    if (!actualFreeStudyAvailable) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Inicio del día
      nextFreeStudyDate = tomorrow;
      console.log('📅 Estudio libre no disponible hoy, próximo disponible mañana:', nextFreeStudyDate.toISOString());
    } else {
      console.log('✅ Estudio libre disponible hoy');
    }

    console.log('📊 DATOS REALES FINALES:', {
      notebookId,
      totalConcepts,
      masteredConcepts,
      smartStudiesCount,
      maxQuizScore,
      completedSmartSessions,
      completedFreeSessions,
      generalScore,
      masteryPercentage: totalConcepts > 0 ? Math.round((masteredConcepts / totalConcepts) * 100) + '%' : '0%',
      isFreeStudyAvailable: actualFreeStudyAvailable,
      isSmartStudyAvailable,
      isQuizAvailable,
      isQuizAvailableAndHasConcepts,
      lastFreeStudyDate
    });

    console.log('🎯 VALORES PARA DISPLAY:', {
      'Quiz disponible': isQuizAvailable,
      'Quiz con conceptos': isQuizAvailableAndHasConcepts,
      'Estudio libre disponible': actualFreeStudyAvailable,
      'Próximo quiz': formatDate(nextQuizDate),
      'Estudio libre debería mostrar': actualFreeStudyAvailable ? 'Disponible' : 'No disponible'
    });

    return {
      generalScore,
      nextSmartStudyDate,
      nextQuizDate,
      nextFreeStudyDate,
      smartStudiesCount,
      maxQuizScore,
      totalConcepts,
      completedSmartSessions,
      completedFreeSessions,
      isFreeStudyAvailable: actualFreeStudyAvailable,
      isSmartStudyAvailable,
      isQuizAvailable: isQuizAvailableAndHasConcepts,
      lastFreeStudyDate
    };
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Si es mañana
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Mañana';
    }
    
    // Si es la próxima semana
    if (date.toDateString() === nextWeek.toDateString()) {
      return 'Próximo ' + date.toLocaleDateString('es-ES', { weekday: 'long' });
    }

    // Si es hoy
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    }

    // Si es en más de 7 días, mostrar la fecha completa
    const daysDiff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7) {
      return date.toLocaleDateString('es-ES', { 
        month: 'short',
        day: 'numeric'
      });
    }

    // Formato normal para fechas cercanas
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatScore = (score: number): string => {
    // Format the number with commas for thousands separators
    return score.toLocaleString('es-ES');
  };

  const getScoreColor = (score: number): string => {
    if (score >= 1000) return '#10B981'; // Verde
    if (score >= 500) return '#F59E0B';  // Amarillo
    return '#EF4444'; // Rojo
  };

  const getAvailabilityColor = (isAvailable: boolean): string => {
    return isAvailable ? '#10B981' : '#6B7280';
  };

  if (loading) {
    return (
      <div className="study-dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="study-dashboard">
        <div className="dashboard-error">
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <div className="study-dashboard" onClick={(e) => {
      console.log('[STUDY DASHBOARD] Dashboard container clicked', e.target);
    }}>
      {/* Botón de refresh para desarrollo */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          marginBottom: '10px', 
          textAlign: 'center' 
        }}>
          <button
            onClick={loadDashboardData}
            style={{
              padding: '4px 8px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              marginRight: '8px'
            }}
          >
            🔄 Refresh Dashboard
          </button>
          
          <button
            onClick={() => {
              console.log('[TEST] Test quiz button clicked');
              if (onStartSession) {
                console.log('[TEST] Calling onStartSession(QUIZ)');
                onStartSession(StudyMode.QUIZ);
              } else {
                console.log('[TEST] onStartSession is not defined!');
              }
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              marginRight: '8px'
            }}
          >
            🧪 Test Quiz
          </button>
          
          <button
            onClick={async () => {
              if (!notebook) return;
              console.log('🔍 DEBUG: Verificando datos de aprendizaje...');
              
              try {
                // Verificar datos de aprendizaje
                const learningData = await getLearningDataForNotebook(userId, notebook.id);
                console.log('📊 Datos de aprendizaje encontrados:', learningData.length);
                
                // Verificar conceptos del cuaderno
                const conceptsQuery = query(
                  collection(db, 'conceptos'),
                  where('cuadernoId', '==', notebook.id)
                );
                const conceptDocs = await getDocs(conceptsQuery);
                const allConcepts: any[] = [];
                
                conceptDocs.forEach(doc => {
                  const conceptosData = doc.data().conceptos || [];
                  conceptosData.forEach((concepto: any, index: number) => {
                    allConcepts.push({
                      id: concepto.id || `${doc.id}-${index}`,
                      término: concepto.término
                    });
                  });
                });
                
                console.log('📋 Conceptos del cuaderno:', allConcepts.length);
                console.log('🎯 Conceptos:', allConcepts);
                
                // Verificar conceptos listos para repaso
                const reviewableCount = await studyService.getReviewableConceptsCount(userId, notebook.id);
                console.log('✅ Conceptos listos para repaso:', reviewableCount);
                
                // Verificar si hay coincidencias
                const learningIds = learningData.map(data => data.conceptId);
                const conceptIds = allConcepts.map(c => c.id);
                
                console.log('🔍 COMPARACIÓN DE IDs:');
                console.log('📊 IDs en datos de aprendizaje:', learningIds);
                console.log('📋 IDs en conceptos del cuaderno:', conceptIds);
                
                const matches = learningIds.filter(id => conceptIds.includes(id));
                console.log('✅ IDs que coinciden:', matches.length, 'de', learningIds.length);
                console.log('🎯 IDs coincidentes:', matches);
                
              } catch (error) {
                console.error('❌ Error en debug:', error);
              }
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            🔍 Debug Data
          </button>
        </div>
      )}
      
      <div className="dashboard-grid">
        {/* Score General */}
        <div className="dashboard-card score-card">
          <div className="card-header">
            <h4>Score General</h4>
          </div>
          <div className="card-content">
            <div 
              className="score-value"
              style={{ color: getScoreColor(dashboardData.generalScore) }}
            >
              {formatScore(dashboardData.generalScore)}
            </div>
          </div>
        </div>

        {/* Próximo Estudio Inteligente */}
        <div 
          className="dashboard-card study-card"
          onClick={() => onStartSession && dashboardData.isSmartStudyAvailable && onStartSession(StudyMode.SMART)}
          style={{ 
            cursor: onStartSession && dashboardData.isSmartStudyAvailable ? 'pointer' : 'default',
            opacity: dashboardData.isSmartStudyAvailable ? 1 : 0.6
          }}
        >
          <div className="card-header">
            <h4>Estudio Inteligente</h4>
            <span className="session-count">#{dashboardData.completedSmartSessions}</span>
          </div>
          <div className="card-content">
            <div className={`date-value ${dashboardData.isSmartStudyAvailable ? 'available-text' : ''}`}>
              {dashboardData.isSmartStudyAvailable 
                ? 'Disponible'
                : formatDate(dashboardData.nextSmartStudyDate)
              }
            </div>
            <div className="mini-quiz-info">
              <i className="fas fa-question-circle"></i>
              <span>Incluye Mini Quiz (≥8/10)</span>
            </div>
          </div>
        </div>

        {/* Próximo Quiz */}
        <div 
          className="dashboard-card quiz-card"
          onClick={(e) => {
            console.log('[QUIZ CLICK] Quiz card clicked! Event:', e);
            console.log('[QUIZ CLICK] Current target:', e.currentTarget);
            console.log('[QUIZ CLICK] Target:', e.target);
            e.preventDefault();
            e.stopPropagation();
            
            if (!onStartSession) {
              console.log('[QUIZ CLICK] ERROR: onStartSession is null/undefined!');
              return;
            }
            
            if (!dashboardData.isQuizAvailable) {
              console.log('[QUIZ CLICK] Quiz not available until:', dashboardData.nextQuizDate);
              return;
            }
            
            console.log('[QUIZ CLICK] All checks passed, calling onStartSession(QUIZ)');
            try {
              onStartSession(StudyMode.QUIZ);
              console.log('[QUIZ CLICK] onStartSession called successfully');
            } catch (error) {
              console.error('[QUIZ CLICK] Error calling onStartSession:', error);
            }
          }}
          style={{ 
            cursor: dashboardData.isQuizAvailable ? 'pointer' : 'not-allowed',
            opacity: dashboardData.isQuizAvailable ? 1 : 0.6,
            position: 'relative',
            zIndex: 10
          }}
        >
          <div className="card-header" onClick={() => console.log('[QUIZ CLICK] Header clicked!')}>
            <h4 onClick={() => console.log('[QUIZ CLICK] H4 clicked!')}>Quiz</h4>
            <span className="max-score">Max: {dashboardData.maxQuizScore}pts</span>
          </div>
          <div className="card-content">
            <div className={`date-value ${dashboardData.isQuizAvailable ? 'available-text' : ''}`}>
              {dashboardData.isQuizAvailable 
                ? 'Disponible'
                : formatDate(dashboardData.nextQuizDate)
              }
            </div>
            {dashboardData.isQuizAvailable && (
              <>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  <i className="fas fa-mouse-pointer"></i> Haz clic para iniciar
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('[QUIZ BUTTON] Native button clicked!');
                    if (onStartSession) {
                      onStartSession(StudyMode.QUIZ);
                    }
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '8px 16px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Iniciar Quiz
                </button>
              </>
            )}
          </div>
        </div>

        {/* Estado Estudio Libre */}
        <div 
          className="dashboard-card free-study-card"
          onClick={() => onStartSession && dashboardData.isFreeStudyAvailable && onStartSession(StudyMode.FREE)}
          style={{ 
            cursor: onStartSession && dashboardData.isFreeStudyAvailable ? 'pointer' : 'default',
            opacity: dashboardData.isFreeStudyAvailable ? 1 : 0.6
          }}
        >
          <div className="card-header">
            <h4>Estudio Libre</h4>
            <span className="session-count">#{dashboardData.completedFreeSessions}</span>
          </div>
          <div className="card-content">
            <div 
              className={`availability-status ${dashboardData.isFreeStudyAvailable ? 'available-text' : ''}`}
              style={{ color: dashboardData.isFreeStudyAvailable ? undefined : getAvailabilityColor(dashboardData.isFreeStudyAvailable) }}
            >
              {dashboardData.isFreeStudyAvailable 
                ? 'Disponible' 
                : (dashboardData.nextFreeStudyDate ? formatDate(dashboardData.nextFreeStudyDate) : '')
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyDashboard; 