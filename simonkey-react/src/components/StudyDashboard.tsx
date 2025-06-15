import React, { useState, useEffect } from 'react';
import { StudyDashboardData, Notebook, StudyMode } from '../types/interfaces';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
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
      const quizStatsRef = doc(db, 'users', userId, 'quizStats', notebookId);
      const quizStatsDoc = await getDoc(quizStatsRef);
      
      if (quizStatsDoc.exists()) {
        const stats = quizStatsDoc.data();
        maxQuizScore = stats.maxScore || 0;
        console.log('✅ Estadísticas de quiz encontradas:', stats);
      } else {
        console.log('⚠️ No se encontraron estadísticas de quiz');
      }
    } catch (error) {
      console.error('❌ Error consultando estadísticas de quiz:', error);
    }

    // 3. CONSULTA REAL: Obtener límites de quiz
    let nextQuizDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Por defecto mañana
    let isQuizAvailable = false;
    try {
      console.log('Consultando límites de quiz reales...');
      const limitsRef = doc(db, 'users', userId, 'limits', 'study');
      const limitsDoc = await getDoc(limitsRef);
      
      if (limitsDoc.exists()) {
        const limits = limitsDoc.data();
        const lastQuizDate = limits.lastQuizDate?.toDate();
        console.log('✅ Límites encontrados:', limits);
        
        if (lastQuizDate) {
          const now = new Date();
          const daysSinceLastQuiz = Math.floor((now.getTime() - lastQuizDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLastQuiz < 7) {
            const nextQuiz = new Date(lastQuizDate);
            nextQuiz.setDate(nextQuiz.getDate() + 7);
            nextQuizDate = nextQuiz;
            isQuizAvailable = false;
            console.log(`Quiz no disponible, próximo en ${7 - daysSinceLastQuiz} días`);
          } else {
            isQuizAvailable = true;
            console.log('Quiz disponible');
          }
        } else {
          isQuizAvailable = true;
          console.log('Primer quiz, disponible');
        }
      } else {
        isQuizAvailable = true;
        console.log('⚠️ No se encontraron límites de quiz, asumiendo disponible');
      }
    } catch (error) {
      console.error('❌ Error consultando límites:', error);
      isQuizAvailable = true; // En caso de error, asumir disponible
    }

    // 4. CALCULAR DATOS REALES
    const generalScore = totalConcepts > 0 
      ? Math.round((masteredConcepts / totalConcepts) * 1000) + (smartStudiesCount * 10)
      : 0;

    const nextSmartStudyDate = totalConcepts > 0 
      ? new Date(Date.now() + 24 * 60 * 60 * 1000) // Mañana si hay conceptos
      : new Date(); // Hoy si no hay conceptos

    const isFreeStudyAvailable = totalConcepts > 0;
    const isSmartStudyAvailable = totalConcepts > 0; // Por ahora siempre disponible si hay conceptos
    const isQuizAvailableAndHasConcepts = totalConcepts > 0 && isQuizAvailable;
    const lastFreeStudyDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    console.log('📊 DATOS REALES FINALES:', {
      notebookId,
      totalConcepts,
      masteredConcepts,
      smartStudiesCount,
      maxQuizScore,
      generalScore,
      masteryPercentage: totalConcepts > 0 ? Math.round((masteredConcepts / totalConcepts) * 100) + '%' : '0%',
      isFreeStudyAvailable,
      isSmartStudyAvailable,
      isQuizAvailable,
      isQuizAvailableAndHasConcepts
    });

    return {
      generalScore,
      nextSmartStudyDate,
      nextQuizDate,
      smartStudiesCount,
      maxQuizScore,
      isFreeStudyAvailable,
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
    if (score >= 1000) {
      return `${(score / 1000).toFixed(1)}k`;
    }
    return score.toString();
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
      <div className="dashboard-grid">
        {/* Score General */}
        <div className="dashboard-card score-card">
          <div className="card-header">
            <h4>Score General</h4>
            <div className="card-icon">🏆</div>
          </div>
          <div className="card-content">
            <div 
              className="score-value"
              style={{ color: getScoreColor(dashboardData.generalScore) }}
            >
              {formatScore(dashboardData.generalScore)}
            </div>
            <div className="score-description">
              {dashboardData.smartStudiesCount > 0 
                ? `${dashboardData.smartStudiesCount} estudios × ${dashboardData.maxQuizScore} pts`
                : 'No hay conceptos'
              }
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
          </div>
          <div className="card-content">
            <div className={`date-value ${dashboardData.isSmartStudyAvailable ? 'available-text' : ''}`}>
              {dashboardData.isSmartStudyAvailable 
                ? 'Disponible'
                : 'No hay conceptos'
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
          </div>
          <div className="card-content">
            <div className={`date-value ${dashboardData.isQuizAvailable ? 'available-text' : ''}`}>
              {dashboardData.isQuizAvailable 
                ? 'Disponible'
                : dashboardData.isFreeStudyAvailable 
                  ? formatDate(dashboardData.nextQuizDate)
                  : 'No hay conceptos'
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
          </div>
          <div className="card-content">
            <div 
              className={`availability-status ${dashboardData.isFreeStudyAvailable ? 'available-text' : ''}`}
              style={{ color: dashboardData.isFreeStudyAvailable ? undefined : getAvailabilityColor(dashboardData.isFreeStudyAvailable) }}
            >
              {dashboardData.isFreeStudyAvailable ? 'Disponible' : 'No hay conceptos'}
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