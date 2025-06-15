// src/pages/StudyModePage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import SwipeableStudyCard from '../components/Mobile/SwipeableStudyCard';
import FeedbackMessage from '../components/FeedbackMessage';
import StudyDashboard from '../components/StudyDashboard';
import { useStudyService } from '../hooks/useStudyService';
import { Concept, ResponseQuality, StudyMode, Notebook, StudySessionMetrics } from '../types/interfaces';
import '../styles/StudyModePage.css';

const StudyModePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>(StudyMode.SMART);
  
  // Estado para los conceptos y la sesión de estudio
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allConcepts, setAllConcepts] = useState<Concept[]>([]);
  const [currentConcepts, setCurrentConcepts] = useState<Concept[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Concept[]>([]);
  
  // Add this state at the top level
  const [nextSession, setNextSession] = useState<Date | null>(null);
  
  // Estado para métricas y progreso
  const [metrics, setMetrics] = useState<StudySessionMetrics>({
    totalConcepts: 0,
    conceptsReviewed: 0,
    mastered: 0,
    reviewing: 0,
    timeSpent: 0,
    startTime: new Date()
  });
  
  // Estado de UI 
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [sessionComplete, setSessionComplete] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  
  // Usar nuestro hook de servicio personalizado
  const studyService = useStudyService();
  
  // Timer para tracking de tiempo de estudio
  const [sessionTimer, setSessionTimer] = useState<number | null>(null);
  
  // Add this state at the top level
  const [sessionReviewQueue, setSessionReviewQueue] = useState<Concept[]>([]);
  
  // Add this state at the top level
  const [uniqueConceptIds, setUniqueConceptIds] = useState<Set<string>>(new Set());
  const [uniqueConceptsCount, setUniqueConceptsCount] = useState<number>(0);
  
  // Estado para conceptos fallados en estudio libre
  const [freeModeReviewQueue, setFreeModeReviewQueue] = useState<Concept[]>([]);
  
  // Al inicio del componente:
  const [reviewedConceptIds, setReviewedConceptIds] = useState<Set<string>>(new Set());
  const [masteredConceptIds, setMasteredConceptIds] = useState<Set<string>>(new Set());
  const [reviewingConceptIds, setReviewingConceptIds] = useState<Set<string>>(new Set());

  // Verificar si viene de otra página con datos
  useEffect(() => {
    if (location.state && location.state.notebookId) {
      const notebook = notebooks.find(n => n.id === location.state.notebookId);
      if (notebook) {
        setSelectedNotebook(notebook);
        
        // Si viene con refreshDashboard, mostrar mensaje de éxito
        if (location.state.refreshDashboard) {
          showFeedback('success', '¡Quiz completado! Tu progreso se ha actualizado');
          // Limpiar el estado para evitar mostrar el mensaje repetidamente
          window.history.replaceState({}, document.title);
        }
      }
    }
  }, [location.state, notebooks]);
  
  // Cargar cuadernos del usuario
  useEffect(() => {
    const fetchNotebooks = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }
      
      try {
        setLoading(true);
        
        // Obtener cuadernos del usuario
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const notebooksSnapshot = await getDocs(notebooksQuery);
        const notebooksData = notebooksSnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title,
          color: doc.data().color || '#6147FF'
        }));
        
        setNotebooks(notebooksData);
        
        // Restaurar último cuaderno usado
        const lastNotebookId = localStorage.getItem('lastStudyNotebookId');
        if (lastNotebookId && notebooksData.length > 0) {
          const lastNotebook = notebooksData.find(n => n.id === lastNotebookId);
          if (lastNotebook) {
            setSelectedNotebook(lastNotebook);
          }
        } else if (notebooksData.length === 1) {
          // Si solo hay un cuaderno, seleccionarlo automáticamente
          setSelectedNotebook(notebooksData[0]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error al cargar cuadernos:", error);
        showFeedback('warning', 'Error al cargar tus cuadernos');
        setLoading(false);
      }
    };
    
    fetchNotebooks();
  }, [navigate]);
  
  // Cuando se selecciona un cuaderno, cargar estadísticas de estudio
  useEffect(() => {
    const loadNotebookStats = async () => {
      if (!selectedNotebook || !auth.currentUser) return;
      
      try {
        // Verificar si hay conceptos pendientes de repaso
        const reviewableCount = await studyService.getReviewableConceptsCount(
          auth.currentUser.uid, 
          selectedNotebook.id
        );
        
        // Obtener conteos de conceptos por estado
        const conceptStats = await studyService.getConceptStats(
          auth.currentUser.uid, 
          selectedNotebook.id
        );
        
        // Basado en las estadísticas, mostrar recomendaciones
        if (reviewableCount > 0) {
          showFeedback('info', `Tienes ${reviewableCount} conceptos listos para repasar hoy`);
        }
      } catch (error) {
        console.error("Error al cargar estadísticas:", error);
      }
    };
    
    if (selectedNotebook) {
      loadNotebookStats();
      localStorage.setItem('lastStudyNotebookId', selectedNotebook.id);
    }
  }, [selectedNotebook]);
  
  // Función para refrescar datos del dashboard
  const refreshDashboardData = useCallback(async () => {
    if (!selectedNotebook || !auth.currentUser) return;
    
    try {
      // Los datos se cargarán automáticamente en el componente StudyDashboard
      console.log('Dashboard data refreshed');
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    }
  }, [selectedNotebook, auth.currentUser]);
  
  // Manejar candado completado
  const handleLockComplete = useCallback(() => {
    console.log('Candado completado, concepto listo para evaluar');
    // Refrescar datos del dashboard después de completar un candado
    refreshDashboardData();
  }, [refreshDashboardData]);
  
  // Mostrar mensajes de feedback
  const showFeedback = (type: 'success' | 'info' | 'warning', message: string) => {
    setFeedback({
      visible: true,
      type,
      message
    });
    
    // Ocultarlo automáticamente después de 2 segundos
    setTimeout(() => {
      setFeedback(prev => ({ ...prev, visible: false }));
    }, 2000);
  };
  
  // Iniciar nueva sesión de estudio
  const startStudySession = async (mode?: StudyMode) => {
    if (!auth.currentUser || !selectedNotebook) {
      showFeedback('warning', 'Por favor selecciona un cuaderno para estudiar');
      return;
    }
    
    const sessionMode = mode || studyMode;
    
    // Si el modo seleccionado es QUIZ, redirigir al QuizModePage
    if (sessionMode === StudyMode.QUIZ) {
      navigate('/quiz', { 
        state: { 
          notebookId: selectedNotebook.id,
          notebookTitle: selectedNotebook.title 
        } 
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Crear nueva sesión en Firestore
      const session = await studyService.createStudySession(
        auth.currentUser.uid, 
        selectedNotebook.id,
        sessionMode
      );
      
      setSessionId(session.id);
      
      // Cargar conceptos según el modo seleccionado
      let concepts: Concept[];
      
      if (sessionMode === StudyMode.SMART) {
        // Obtener conceptos listos para repaso inteligente
        concepts = await studyService.getReviewableConcepts(
          auth.currentUser.uid, 
          selectedNotebook.id
        );
        
        if (concepts.length === 0) {
          showFeedback('info', 'No tienes conceptos listos para repaso hoy. ¡Excelente trabajo!');
          setLoading(false);
          return;
        }
      } else {
        // Modo libre: obtener todos los conceptos
        concepts = await studyService.getAllConceptsFromNotebook(
          auth.currentUser.uid, 
          selectedNotebook.id
        );
        
        if (concepts.length === 0) {
          showFeedback('warning', 'No hay conceptos en este cuaderno');
          setLoading(false);
          return;
        }
      }
      
      // Mezclar conceptos aleatoriamente para variedad
      concepts = concepts.sort(() => 0.5 - Math.random());
      
      setAllConcepts(concepts);
      setCurrentConcepts([...concepts]);
      setSessionActive(true);
      setLoading(false);
      
      // Iniciar timer de sesión
      setSessionTimer(Date.now());
      
      showFeedback('success', `Sesión iniciada con ${concepts.length} conceptos`);
    } catch (error: any) {
      console.error("Error al iniciar sesión:", error);
      
      // Manejar específicamente el error de límite de estudio libre
      if (error.message === 'Ya has usado tu sesión de estudio libre hoy') {
        showFeedback('warning', 'Ya has usado tu sesión de estudio libre hoy. El estudio libre está disponible una vez al día. Puedes usar el estudio inteligente para repasar conceptos específicos.');
        
        // No cambiar automáticamente el modo, dejar que el usuario decida
        setLoading(false);
        return;
      } else {
        showFeedback('warning', 'Error al iniciar la sesión de estudio. Por favor, intenta de nuevo.');
      }
      
      setLoading(false);
    }
  };
  
  // Manejar respuesta del usuario a un concepto
  const handleConceptResponse = async (conceptId: string, quality: ResponseQuality) => {
    if (!auth.currentUser || !sessionId) return;
    
    try {
      // Actualizar respuesta usando SM-3
      await studyService.updateConceptResponse(
        auth.currentUser.uid,
        conceptId,
        quality
      );
      
      // Actualizar métricas locales
      setMetrics(prev => ({
        ...prev,
        conceptsReviewed: prev.conceptsReviewed + 1,
        mastered: quality === ResponseQuality.MASTERED ? prev.mastered + 1 : prev.mastered,
        reviewing: quality === ResponseQuality.REVIEW_LATER ? prev.reviewing + 1 : prev.reviewing
      }));
      
      // Marcar concepto como revisado
      setReviewedConceptIds(prev => new Set(Array.from(prev).concat([conceptId])));
      
      if (quality === ResponseQuality.MASTERED) {
        setMasteredConceptIds(prev => new Set(Array.from(prev).concat([conceptId])));
      } else {
        setReviewingConceptIds(prev => new Set(Array.from(prev).concat([conceptId])));
      }
      
      // Remover concepto de la cola actual
      setCurrentConcepts(prev => prev.filter(c => c.id !== conceptId));
      
      // Verificar si la sesión está completa
      if (currentConcepts.length <= 1) {
        await completeStudySession();
      }
      
    } catch (error) {
      console.error("Error al procesar respuesta:", error);
      showFeedback('warning', 'Error al guardar tu respuesta');
    }
  };
  
  // Completar la sesión de estudio
  const completeStudySession = async () => {
    if (!sessionId || !auth.currentUser) {
      // Si es una sesión de repaso inmediato, solo mostrar feedback y volver al resumen
      if (allConcepts.length > 0 && sessionReviewQueue.length === 0 && !sessionActive) {
        showFeedback('success', '¡Repaso inmediato completado! ¡Ahora sí, lo tienes mucho más claro!');
        setSessionComplete(true);
        setSessionActive(false);
        return;
      }
      return;
    }
    
    // Detener el timer
    if (sessionTimer) {
      clearInterval(sessionTimer);
      setSessionTimer(null);
    }
    
    // Marcar hora de finalización
    const endTime = new Date();
    setMetrics(prev => ({
      ...prev,
      endTime
    }));
    
    try {
      // Guardar estadísticas en Firestore
      await studyService.completeStudySession(
        sessionId,
        {
          ...metrics,
          endTime
        }
      );
      
      // Registrar actividad
      await studyService.logStudyActivity(
        auth.currentUser.uid,
        'session_completed',
        `Sesión completada: ${metrics.conceptsReviewed} conceptos revisados, ${metrics.mastered} dominados`
      );
      
      setSessionComplete(true);
      setSessionActive(false);
      
    } catch (error) {
      console.error("Error al completar sesión:", error);
      showFeedback('warning', 'Error al guardar estadísticas de la sesión');
      
      // Aún así mostramos el resumen
      setSessionComplete(true);
      setSessionActive(false);
    }
  };
  
  // Calcular próxima sesión recomendada basada en algoritmo SRS
  const getNextRecommendedSession = async () => {
    if (!selectedNotebook || !auth.currentUser) return;
    
    try {
      // Obtener estadísticas del cuaderno
      const stats = await studyService.getConceptStats(
        auth.currentUser.uid, 
        selectedNotebook.id
      );
      
      if (stats.readyForReview > 0) {
        showFeedback('info', `Tienes ${stats.readyForReview} conceptos listos para repasar`);
      } else {
        showFeedback('info', 'No tienes conceptos pendientes. ¡Excelente trabajo!');
      }
    } catch (error) {
      console.error("Error al obtener recomendaciones:", error);
    }
  };

  useEffect(() => {
    if (sessionComplete) {
      getNextRecommendedSession();
    }
  }, [sessionComplete]);
  
  // Iniciar nueva sesión con mismo cuaderno
  const startNewSession = () => {
    setSessionActive(false);
    setSessionComplete(false);
    setCurrentConcepts([]);
    setAllConcepts([]);
    setReviewedConceptIds(new Set());
    setMasteredConceptIds(new Set());
    setReviewingConceptIds(new Set());
    setSessionId(null);
    setSessionTimer(null);
    setMetrics({
      totalConcepts: 0,
      conceptsReviewed: 0,
      mastered: 0,
      reviewing: 0,
      timeSpent: 0,
      startTime: new Date()
    });
  };
  
  // Formatear el tiempo de estudio
  const formatStudyTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Memoizar el cálculo de conceptos de repaso pendientes
  const pendingReviewCount = useMemo(() => {
    if (!selectedNotebook || studyMode !== StudyMode.SMART) return 0;
    return reviewQueue.length;
  }, [selectedNotebook, reviewQueue, studyMode]);
  
  // Cálculo de progreso de la sesión
  const sessionProgress = useMemo(() => {
    if (metrics.totalConcepts === 0) return 0;
    return (metrics.conceptsReviewed / metrics.totalConcepts) * 100;
  }, [metrics.conceptsReviewed, metrics.totalConcepts]);
  
  // Funciones para cambiar el modo de estudio
  const handleModeChange = (mode: StudyMode) => {
    setStudyMode(mode);
  };
  
  // Seleccionar un cuaderno
  const handleSelectNotebook = (notebook: Notebook) => {
    setSelectedNotebook(notebook);
    localStorage.setItem('lastStudyNotebookId', notebook.id);
  };
  
  // Iniciar sesión de repaso solo para conceptos pendientes
  const startReviewSession = async () => {
    if (!selectedNotebook || !auth.currentUser) return;
    
    try {
      setLoading(true);
      
      // Obtener conceptos listos para repaso
      const reviewableConcepts = await studyService.getReviewableConcepts(
        auth.currentUser.uid, 
        selectedNotebook.id
      );
      
      if (reviewableConcepts.length === 0) {
        showFeedback('info', 'No tienes conceptos listos para repasar hoy');
        setLoading(false);
        return;
      }
      
      // Mezclar conceptos aleatoriamente
      const shuffledConcepts = reviewableConcepts.sort(() => 0.5 - Math.random());
      
      setAllConcepts(shuffledConcepts);
      setCurrentConcepts([...shuffledConcepts]);
      setSessionActive(true);
      setLoading(false);
      
      showFeedback('success', `Repaso iniciado con ${shuffledConcepts.length} conceptos`);
    } catch (error) {
      console.error("Error al iniciar repaso:", error);
      showFeedback('warning', 'Error al iniciar el repaso');
      setLoading(false);
    }
  };
  
  // Nueva función para repaso inmediato:
  const startImmediateReviewSession = () => {
    if (sessionReviewQueue.length === 0) {
      showFeedback('info', 'No hay conceptos pendientes para repasar');
      return;
    }
    setAllConcepts(sessionReviewQueue);
    setCurrentConcepts(sessionReviewQueue);
    setMetrics({
      totalConcepts: sessionReviewQueue.length,
      conceptsReviewed: 0,
      mastered: 0,
      reviewing: 0,
      timeSpent: 0,
      startTime: new Date()
    });
    setSessionActive(true);
    setSessionComplete(false);
    setSessionReviewQueue([]); // Limpiar la cola para evitar repeticiones
  };
  
  // Renderizar el componente principal
  return (
    <div className={`study-mode-container ${studyMode.toLowerCase()}`}>
      <header className="study-mode-header">
        <div className="header-content">
          <button
            className="back-button"
            onClick={() => {
              if (sessionActive) {
                if (window.confirm("¿Seguro que quieres salir? Tu progreso se perderá.")) {
                  navigate('/notebooks');
                }
              } else {
                navigate('/notebooks');
              }
            }}
          >
            {sessionActive ? <i className="fas fa-times"></i> : <i className="fas fa-arrow-left"></i>}
          </button>
          
          <h1>
            {selectedNotebook ? selectedNotebook.title : 'Centro de Estudio'}
            {sessionActive && (
              <span className="mode-badge">
                {studyMode === StudyMode.SMART ? 'Repaso Inteligente' : 
                 studyMode === StudyMode.FREE ? 'Estudio Libre' : 'Quiz'}
              </span>
            )}
          </h1>
          
          <div className="header-spacer"></div>
        </div>
      </header>
      
      <main className="study-mode-main">
        {/* Mensaje de feedback */}
        {feedback.visible && (
          <FeedbackMessage
            type={feedback.type}
            message={feedback.message}
          />
        )}
        
        {/* Renderizado condicional */}
        {!sessionActive && !sessionComplete && (
          <div className="study-notebook-selection">
            <div className="study-header">
              <h2>Centro de Estudio</h2>
              <p className="study-subtitle">Elige un cuaderno y comienza tu sesión de aprendizaje</p>
            </div>
            
            {notebooks.length === 0 ? (
              <div className="empty-notebooks">
                <div className="empty-icon">
                  <i className="fas fa-book-open"></i>
                </div>
                <h3>No tienes cuadernos creados</h3>
                <p>Crea tu primer cuaderno para comenzar a estudiar</p>
                <button
                  className="create-notebook-button"
                  onClick={() => navigate('/notebooks')}
                >
                  <i className="fas fa-plus"></i> Crear mi primer cuaderno
                </button>
              </div>
            ) : (
              <>
                {/* Lista de cuadernos */}
                <div className="notebooks-section">
                  <div className="notebooks-list">
                    {notebooks.map(notebook => (
                      <div
                        key={notebook.id}
                        className={`notebook-item ${selectedNotebook?.id === notebook.id ? 'selected' : ''}`}
                        onClick={() => handleSelectNotebook(notebook)}
                        style={{ borderColor: notebook.color }}
                      >
                        <div className="notebook-color" style={{ backgroundColor: notebook.color }}>
                          {selectedNotebook?.id === notebook.id && (
                            <div className="selected-indicator">
                              <i className="fas fa-check"></i>
                            </div>
                          )}
                        </div>
                        <div className="notebook-info">
                          <div className="notebook-title">{notebook.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {selectedNotebook && (
                  <>
                    {/* Dashboard de estudio */}
                    <StudyDashboard
                      notebook={selectedNotebook}
                      userId={auth.currentUser?.uid || ''}
                      onRefresh={refreshDashboardData}
                      onStartSession={startStudySession}
                    />
                    
                    {/* Temporary reset button for development */}
                    {process.env.NODE_ENV === 'development' && (
                      <div style={{ 
                        marginTop: '20px', 
                        padding: '10px', 
                        backgroundColor: '#f0f0f0', 
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={async () => {
                              if (auth.currentUser) {
                                await studyService.resetFreeStudyLimit(auth.currentUser.uid);
                                showFeedback('success', 'Límite de estudio libre reseteado para pruebas');
                              }
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#ff6b6b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            🔄 Reset Free Study Limit (Dev Only)
                          </button>
                          
                          <button
                            onClick={async () => {
                              if (auth.currentUser) {
                                await studyService.resetQuizLimit(auth.currentUser.uid);
                                showFeedback('success', 'Límite de quiz reseteado para pruebas');
                              }
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#4ecdc4',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            🎯 Reset Quiz Limit (Dev Only)
                          </button>
                        </div>
                        <p style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>
                          Solo para desarrollo - resetea los límites de estudio
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
        
        {sessionActive && (
          <div className="study-session-container">
            {(() => {
              const currentIndex = allConcepts.length - currentConcepts.length + 1;
              const totalConcepts = allConcepts.length;
              const currentConcept = currentConcepts[0];

              if (!currentConcept) {
                return (
                  <div className="no-concepts-message">
                    <i className="fas fa-check-circle"></i>
                    <h3>¡Sesión completada!</h3>
                    <p>Has revisado todos los conceptos disponibles.</p>
                    <button
                      className="session-action-button"
                      onClick={completeStudySession}
                    >
                      Finalizar sesión
                    </button>
                  </div>
                );
              }

              return (
                <>
                  <div className="study-session-header-minimal">
                    <div className="card-counter">
                      <span className="card-number">{currentIndex}</span>
                      <span className="card-divider">/</span>
                      <span className="card-total">{totalConcepts}</span>
                    </div>
                  </div>
                  
                  <div className="study-session-layout">
                    <div className="study-card-container">
                      <SwipeableStudyCard
                        concept={currentConcept}
                        onResponse={(quality) => handleConceptResponse(currentConcept.id, quality)}
                        reviewMode={studyMode === StudyMode.SMART}
                        quizMode={studyMode === StudyMode.QUIZ}
                        onLockComplete={handleLockComplete}
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
        
        {sessionComplete && (
          <div className="session-summary">
            <div className="summary-header">
              <i className="fas fa-trophy"></i>
              <h2>¡Sesión completada!</h2>
            </div>
            
            <div className="summary-stats">
              <div className="stat-item">
                <div className="stat-icon">
                  <i className="fas fa-book"></i>
                </div>
                <div className="stat-value">{reviewedConceptIds.size}</div>
                <div className="stat-label">Conceptos estudiados</div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">
                  <i className="fas fa-check-circle"></i>
                </div>
                <div className="stat-value">{masteredConceptIds.size}</div>
                <div className="stat-label">Dominados</div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">
                  <i className="fas fa-sync-alt"></i>
                </div>
                <div className="stat-value">{reviewingConceptIds.size}</div>
                <div className="stat-label">Para repasar</div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">
                  <i className="fas fa-clock"></i>
                </div>
                <div className="stat-value">{formatStudyTime(metrics.timeSpent)}</div>
                <div className="stat-label">Tiempo de estudio</div>
              </div>
            </div>
            
            {nextSession && (
              <div className="next-session-recommendation">
                <h3>Próxima sesión recomendada</h3>
                <p>
                  <i className="fas fa-calendar"></i> {new Intl.DateTimeFormat('es', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  }).format(nextSession)}
                </p>
                <p className="recommendation-text">
                  Estudiar regularmente mejora significativamente la retención a largo plazo.
                </p>
              </div>
            )}
            
            <div className="summary-actions">
              {sessionReviewQueue.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 10 }}>
                  <button
                    className="action-button review-pending"
                    onClick={startImmediateReviewSession}
                    style={{ marginBottom: 4 }}
                  >
                    <i className="fas fa-redo"></i> ¡Refuerza lo que más te costó! ({sessionReviewQueue.length})
                  </button>
                  <span style={{ fontSize: 13, color: '#FF6B6B', opacity: 0.85, textAlign: 'center', maxWidth: 320 }}>
                    Repasa inmediatamente los conceptos que marcaste como "Revisar después". Esto no afecta tu progreso futuro, pero te ayuda a reforzar lo aprendido hoy.
                  </span>
                </div>
              )}
              
              <button
                className="action-button secondary"
                onClick={startNewSession}
              >
                <i className="fas fa-redo"></i> Nueva sesión
              </button>
              
              <button
                className="action-button primary"
                onClick={() => navigate('/notebooks')}
              >
                <i className="fas fa-home"></i> Volver a inicio
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudyModePage;