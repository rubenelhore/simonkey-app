import React, { useState, useEffect } from 'react';
import { StudyDashboardData, Notebook, StudyMode } from '../types/interfaces';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useStudyService } from '../hooks/useStudyService';
import '../styles/StudyDashboard.css';

interface StudyDashboardProps {
  notebook: Notebook | null;
  userId: string;
  onRefresh?: () => void;
  onStartSession?: (mode: StudyMode) => void;
}

const StudyDashboard: React.FC<StudyDashboardProps> = ({ 
  notebook, 
  userId, 
  onRefresh,
  onStartSession
}) => {
  const [dashboardData, setDashboardData] = useState<StudyDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const studyService = useStudyService();

  // Cargar datos del dashboard cuando cambia el cuaderno
  useEffect(() => {
    if (notebook && userId) {
      console.log('StudyDashboard: Cargando datos para cuaderno:', notebook.title);
      loadDashboardData();
    } else {
      setDashboardData(null);
      setLoading(false);
    }
  }, [notebook?.id, userId]); // Usar notebook.id para que se actualice cuando cambie el cuaderno

  const loadDashboardData = async () => {
    if (!notebook || !userId) return;

    try {
      setLoading(true);
      setError(null);
      console.log('Cargando datos específicos del cuaderno:', notebook.title);

      // Cargar datos reales del cuaderno
      const dashboardData = await loadNotebookSpecificData(notebook.id, userId);
      setDashboardData(dashboardData);
      
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
        query(collection(db, 'conceptos'), where('cuadernoId', '==', notebookId), where('usuarioId', '==', userId))
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
            completedSmartSessions++;
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
    let studyLimits = null;
    try {
      console.log('Consultando límites de quiz reales...');
      const limitsRef = doc(db, 'users', userId, 'limits', 'study');
      const limitsDoc = await getDoc(limitsRef);
      
      if (limitsDoc.exists()) {
        const limits = limitsDoc.data();
        studyLimits = limits;
        const lastQuizDate = limits.lastQuizDate?.toDate();
        console.log('✅ Límites encontrados:', limits);
        console.log('🔍 Análisis detallado de límites:', {
          lastQuizDate: lastQuizDate,
          lastQuizDateExists: !!lastQuizDate,
          quizCountThisWeek: limits.quizCountThisWeek,
          weekStartDate: limits.weekStartDate?.toDate()
        });
        
        if (lastQuizDate) {
          const now = new Date();
          const daysSinceLastQuiz = Math.floor((now.getTime() - lastQuizDate.getTime()) / (1000 * 60 * 60 * 24));
          console.log('📅 Cálculo de días desde último quiz:', {
            now: now.toISOString(),
            lastQuizDate: lastQuizDate.toISOString(),
            daysSinceLastQuiz: daysSinceLastQuiz
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
          isQuizAvailable = true;
          console.log('✅ Primer quiz, disponible (no hay lastQuizDate)');
        }
      } else {
        isQuizAvailable = true;
        console.log('⚠️ No se encontraron límites de quiz, asumiendo disponible');
      }
    } catch (error) {
      console.error('❌ Error consultando límites:', error);
      isQuizAvailable = true; // En caso de error, asumir disponible
    }

    // 5. CALCULAR DATOS REALES
    const generalScore = completedSmartSessions * maxQuizScore;
    
    console.log('🔍 CÁLCULO DEL SCORE GENERAL:', {
      completedSmartSessions,
      maxQuizScore,
      generalScore,
      formula: `${completedSmartSessions} × ${maxQuizScore} = ${generalScore}`
    });

    const nextSmartStudyDate = totalConcepts > 0 
      ? new Date(Date.now() + 24 * 60 * 60 * 1000) // Mañana si hay conceptos
      : new Date(); // Hoy si no hay conceptos

    // Usar los datos reales de límites para determinar disponibilidad
    const isFreeStudyAvailable = totalConcepts > 0 && (studyLimits?.isFreeStudyAvailable !== false);
    
    // Verificar si hay conceptos listos para repaso hoy
    let isSmartStudyAvailable = false;
    if (totalConcepts > 0) {
      try {
        const reviewableCount = await studyService.getReviewableConceptsCount(userId, notebookId);
        isSmartStudyAvailable = reviewableCount > 0;
      } catch (error) {
        console.log('Error checking reviewable concepts, using fallback:', error);
        // En caso de error, usar la lógica anterior
        isSmartStudyAvailable = totalConcepts > 0;
      }
    }
    
    const isQuizAvailableAndHasConcepts = totalConcepts > 0 && isQuizAvailable;
    
    // Usar la fecha real del último estudio libre si existe
    let lastFreeStudyDate = studyLimits?.lastFreeStudyDate 
      ? (() => {
          try {
            const date = new Date(studyLimits.lastFreeStudyDate);
            return isNaN(date.getTime()) ? undefined : date;
          } catch (error) {
            console.warn('Fecha inválida en lastFreeStudyDate:', studyLimits.lastFreeStudyDate);
            return undefined;
          }
        })()
      : undefined;

    // Calcular próxima fecha de estudio libre
    let nextFreeStudyDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Por defecto mañana
    if (lastFreeStudyDate) {
      const now = new Date();
      const daysSinceLastFreeStudy = Math.floor((now.getTime() - lastFreeStudyDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastFreeStudy < 1) {
        const nextFreeStudy = new Date(lastFreeStudyDate);
        nextFreeStudy.setDate(nextFreeStudy.getDate() + 1);
        nextFreeStudyDate = nextFreeStudy;
      }
    }

    // Verificar disponibilidad real de estudio libre usando el servicio
    let actualFreeStudyAvailable = isFreeStudyAvailable;
    if (totalConcepts > 0 && studyLimits) {
      try {
        actualFreeStudyAvailable = await studyService.checkFreeStudyLimit(userId);
      } catch (error) {
        console.log('Error checking free study limit, using fallback:', error);
        // En caso de error, usar la lógica anterior
        actualFreeStudyAvailable = isFreeStudyAvailable;
      }
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
      lastFreeStudyDate: lastFreeStudyDate ? lastFreeStudyDate.toISOString() : 'undefined',
      studyLimits
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

    // Formato normal
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
    <div className="study-dashboard">
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
              fontSize: '11px'
            }}
          >
            🔄 Refresh Dashboard
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
          </div>
        </div>

        {/* Próximo Quiz */}
        <div 
          className="dashboard-card quiz-card"
          onClick={() => onStartSession && dashboardData.isQuizAvailable && onStartSession(StudyMode.QUIZ)}
          style={{ 
            cursor: onStartSession && dashboardData.isQuizAvailable ? 'pointer' : 'default',
            opacity: dashboardData.isQuizAvailable ? 1 : 0.6
          }}
        >
          <div className="card-header">
            <h4>Quiz</h4>
            <span className="max-score">Max: {dashboardData.maxQuizScore}pts</span>
          </div>
          <div className="card-content">
            <div className={`date-value ${dashboardData.isQuizAvailable ? 'available-text' : ''}`}>
              {dashboardData.isQuizAvailable 
                ? 'Disponible'
                : formatDate(dashboardData.nextQuizDate)
              }
            </div>
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

      {/* Información adicional */}
      <div className="dashboard-info">
        {dashboardData.isFreeStudyAvailable ? (
          <>
            <p>
              <strong>Score General:</strong> Estudios inteligentes completados × Puntuación máxima del quiz.
            </p>
            <p>
              <strong>Estudio Inteligente:</strong> Algoritmo de estudio inteligente SM-3. Disponible cada que tu memoria necesita repasar.
            </p>
            <p>
              <strong>Quiz:</strong> 10 conceptos aleatorios a contestar en 10 minutos.
            </p>
            <p>
              <strong>Estudio Libre:</strong> Repasa todos los conceptos. Disponible una vez al día.
            </p>
          </>
        ) : (
          <p>
            <strong>Agrega conceptos a este cuaderno</strong> para comenzar a estudiar. Ve a la sección de cuadernos y agrega algunos conceptos.
          </p>
        )}
      </div>
    </div>
  );
};

export default StudyDashboard; 