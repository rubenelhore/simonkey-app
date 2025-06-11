// src/pages/StudyModePage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import SwipeableStudyCard from '../components/Mobile/SwipeableStudyCard';
import FeedbackMessage from '../components/FeedbackMessage';
import { useStudyService } from '../hooks/useStudyService';
import { Concept, ResponseQuality, StudyMode, Notebook, StudySessionMetrics } from '../types/interfaces';
import '../styles/StudyModePage.css';

const StudyModePage = () => {
  const navigate = useNavigate();
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
  const startStudySession = async () => {
    if (!selectedNotebook || !auth.currentUser) {
      showFeedback('warning', 'Debes seleccionar un cuaderno primero');
      return;
    }
    
    setLoading(true);
    
    try {
      // Crear nueva sesión en Firestore
      const session = await studyService.createStudySession(
        auth.currentUser.uid, 
        selectedNotebook.id,
        studyMode
      );
      
      setSessionId(session.id);
      
      // Cargar conceptos según el modo seleccionado
      let concepts: Concept[];
      
      if (studyMode === StudyMode.SMART) {
        // Repaso inteligente: solo conceptos vencidos
        concepts = await studyService.getDueConceptsForReview(
          auth.currentUser.uid,
          selectedNotebook.id
        );
        if (concepts.length === 0) {
          showFeedback('info', '¡No tienes conceptos pendientes hoy! Prueba el Estudio Libre para reforzar.');
          setLoading(false);
          return;
        }
      } else if (studyMode === StudyMode.FREE) {
        // Estudio libre: todos los conceptos del cuaderno, en orden fijo
        concepts = await studyService.getAllConceptsFromNotebook(
          auth.currentUser.uid,
          selectedNotebook.id
        );
        if (concepts.length === 0) {
          showFeedback('info', 'No hay conceptos en este cuaderno.');
          setLoading(false);
          return;
        }
        // Orden fijo (alfabético por término, por ejemplo)
        concepts = concepts.sort((a, b) => a.término.localeCompare(b.término));
        setFreeModeReviewQueue([]); // Limpiar la cola de fallados
        setReviewQueue([]);
        setSessionReviewQueue([]);
        setUniqueConceptIds(new Set());
        setUniqueConceptsCount(0);
      } else if (studyMode === StudyMode.QUIZ) {
        concepts = await studyService.getConceptsForQuiz(
          auth.currentUser.uid,
          selectedNotebook.id
        );
      } else {
        // Fallback: todos los conceptos
        concepts = await studyService.getAllConceptsFromNotebook(
          auth.currentUser.uid,
          selectedNotebook.id
        );
      }
      
      // Optimizar mezclando adecuadamente para mejor retención
      const optimizedConcepts = studyService.optimizeConceptOrder(concepts);
      
      // SOLUCIÓN RADICAL: Total fijo e inmutable
      const totalConcepts = Object.freeze(optimizedConcepts.length);
      
      setAllConcepts(optimizedConcepts);
      setCurrentConcepts(optimizedConcepts);
      
      // Inicializar métricas para esta sesión con el total FIJO e INMUTABLE
      setMetrics(Object.freeze({
        totalConcepts: totalConcepts, // Este número NUNCA cambiará durante la sesión
        conceptsReviewed: 0,
        mastered: 0,
        reviewing: 0,
        timeSpent: 0,
        startTime: new Date()
      }));
      
      // Iniciar tracking de tiempo
      const timer = window.setInterval(() => {
        setMetrics(prev => ({
          ...prev,
          timeSpent: prev.timeSpent + 1
        }));
      }, 1000);
      
      setSessionTimer(timer);
      setSessionActive(true);
      setLoading(false);
      
      // Registro de actividad
      await studyService.logStudyActivity(
        auth.currentUser.uid,
        'session_started',
        `Sesión de ${studyMode === StudyMode.SMART ? 'repaso inteligente' : studyMode === StudyMode.FREE ? 'estudio libre' : studyMode === StudyMode.QUIZ ? 'evaluación' : 'estudio'} iniciada`
      );
      
      // When you start a new session, initialize the set with the initial concepts
      setUniqueConceptIds(new Set(optimizedConcepts.map(c => c.id)));
      setUniqueConceptsCount(optimizedConcepts.length);
      
      setReviewedConceptIds(new Set());
      setMasteredConceptIds(new Set());
      setReviewingConceptIds(new Set());
      
    } catch (error) {
      console.error("Error al iniciar sesión de estudio:", error);
      showFeedback('warning', 'Error al iniciar la sesión de estudio');
      setLoading(false);
    }
  };
  
  // Manejar respuesta a concepto (usando el algoritmo SRS simplificado)
  const handleConceptResponse = async (conceptId: string, quality: ResponseQuality) => {
    if (!auth.currentUser || !sessionId) return;
    
    try {
      // Procesar la respuesta con el algoritmo SRS
      await studyService.processConceptResponse(
        auth.currentUser.uid,
        conceptId,
        quality,
        sessionId
      );
      
      // Encontrar el concepto en nuestros datos actuales
      const conceptIndex = currentConcepts.findIndex(c => c.id === conceptId);
      if (conceptIndex === -1) return;
      
      // PROTECCIÓN RADICAL: Solo actualizar contadores, NUNCA el total
      setMetrics(prev => ({
        ...prev,
        conceptsReviewed: prev.conceptsReviewed + 1,
        mastered: quality === ResponseQuality.MASTERED ? prev.mastered + 1 : prev.mastered,
        reviewing: quality === ResponseQuality.REVIEW_LATER ? prev.reviewing + 1 : prev.reviewing,
        // totalConcepts se mantiene INMUTABLE
      }));
      
      // Mostrar feedback apropiado según la calidad de respuesta
      if (quality === ResponseQuality.MASTERED) {
        showFeedback('success', '¡Dominado! 🎉');
      } else {
        showFeedback('info', 'Revisaremos este concepto más tarde');
      }
      
      // Eliminar concepto de la lista actual (siempre)
      const updatedConcepts = [...currentConcepts];
      updatedConcepts.splice(conceptIndex, 1);
      setCurrentConcepts(updatedConcepts);
      
      // Si es estudio libre, guardar fallados para repaso posterior (sin repetir en la sesión)
      if (studyMode === StudyMode.FREE && quality === ResponseQuality.REVIEW_LATER) {
        setFreeModeReviewQueue(prev => prev.some(c => c.id === conceptId) ? prev : [...prev, currentConcepts[conceptIndex]]);
      }
      
      // Si es repaso inteligente, puedes agregar a la cola de repaso SOLO si no está ya
      if (studyMode === StudyMode.SMART && quality === ResponseQuality.REVIEW_LATER) {
        setReviewQueue(prev => prev.some(c => c.id === conceptId) ? prev : [...prev, currentConcepts[conceptIndex]]);
        setSessionReviewQueue(prev => prev.some(c => c.id === conceptId) ? prev : [...prev, currentConcepts[conceptIndex]]);
      }
      
      // Si termina la sesión, finalizarla y guardar los fallados para repaso posterior
      if (updatedConcepts.length === 0) {
        if (studyMode === StudyMode.FREE) {
          setSessionReviewQueue([...freeModeReviewQueue]); // Guardar los fallados para repaso inmediato
          setFreeModeReviewQueue([]);
        }
        completeStudySession();
      }
      
      // Actualizar el set de conceptos únicos estudiados
      if (!uniqueConceptIds.has(conceptId)) {
        setUniqueConceptIds(prev => {
          const newSet = new Set(prev);
          newSet.add(conceptId);
          setUniqueConceptsCount(newSet.size);
          return newSet;
        });
      }

      // Trackear IDs únicos de la sesión
      setReviewedConceptIds(prev => new Set(prev).add(conceptId));
      if (quality === ResponseQuality.MASTERED) {
        setMasteredConceptIds(prev => new Set(prev).add(conceptId));
      }
      if (quality === ResponseQuality.REVIEW_LATER) {
        setReviewingConceptIds(prev => new Set(prev).add(conceptId));
      }
    } catch (error) {
      console.error("Error al procesar respuesta:", error);
      showFeedback('warning', 'Error al guardar tu progreso');
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
    if (!auth.currentUser || !selectedNotebook) return null;
    
    try {
      return await studyService.getNextRecommendedReviewDate(
        auth.currentUser.uid,
        selectedNotebook.id
      );
    } catch (error) {
      console.error("Error al calcular próxima sesión:", error);
      return null;
    }
  };

  useEffect(() => {
    if (sessionComplete) {
      getNextRecommendedSession().then(date => {
        setNextSession(date);
      });
    }
  }, [sessionComplete]);
  
  // Iniciar nueva sesión con mismo cuaderno
  const startNewSession = () => {
    // Reiniciar estados para nueva sesión
    setSessionComplete(false);
    setSessionActive(false);
    setAllConcepts([]);
    setCurrentConcepts([]);
    setReviewQueue([]);
    setSessionId(null);
    
    // Mantener el notebook seleccionado pero reiniciar todo lo demás
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
    if (!selectedNotebook || !auth.currentUser) {
      showFeedback('warning', 'Debes seleccionar un cuaderno primero');
      return;
    }
    
    setLoading(true);
    
    try {
      // Cambiar al modo repaso
      setStudyMode(StudyMode.SMART);
      
      // Crear nueva sesión en Firestore
      const session = await studyService.createStudySession(
        auth.currentUser.uid, 
        selectedNotebook.id,
        StudyMode.SMART
      );
      
      setSessionId(session.id);
      
      // Cargar solo conceptos que están listos para repasar hoy
      const concepts = await studyService.getDueConceptsForReview(
        auth.currentUser.uid,
        selectedNotebook.id
      );
      
      if (concepts.length === 0) {
        showFeedback('info', 'No hay conceptos pendientes para repasar');
        setLoading(false);
        return;
      }
      
      // Optimizar orden de conceptos
      const optimizedConcepts = studyService.optimizeConceptOrder(concepts);
      
      setAllConcepts(optimizedConcepts);
      setCurrentConcepts(optimizedConcepts);
      
      // Inicializar métricas para esta sesión
      setMetrics({
        totalConcepts: optimizedConcepts.length,
        conceptsReviewed: 0,
        mastered: 0,
        reviewing: 0,
        timeSpent: 0,
        startTime: new Date()
      });
      
      // Iniciar tracking de tiempo
      const timer = window.setInterval(() => {
        setMetrics(prev => ({
          ...prev,
          timeSpent: prev.timeSpent + 1
        }));
      }, 1000);
      
      setSessionTimer(timer);
      setSessionActive(true);
      setLoading(false);
      
      // Registro de actividad
      await studyService.logStudyActivity(
        auth.currentUser.uid,
        'session_started',
        `Sesión de repaso iniciada con ${optimizedConcepts.length} conceptos pendientes`
      );
      
    } catch (error) {
      console.error("Error al iniciar sesión de repaso:", error);
      showFeedback('warning', 'Error al iniciar la sesión de repaso');
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
  
  // Renderizado condicional de pantallas
  
  // 1. Renderizar selección de cuaderno
  const renderNotebookSelection = () => {
    return (
      <div className="study-notebook-selection">
        <h2>Selecciona un cuaderno para estudiar</h2>
        
        {notebooks.length === 0 ? (
          <div className="empty-notebooks">
            <p>No tienes cuadernos creados todavía.</p>
            <button
              className="create-notebook-button"
              onClick={() => navigate('/notebooks')}
            >
              <i className="fas fa-plus"></i> Crear mi primer cuaderno
            </button>
          </div>
        ) : (
          <div className="notebooks-list">
            {notebooks.map(notebook => (
              <div
                key={notebook.id}
                className={`notebook-item ${selectedNotebook?.id === notebook.id ? 'selected' : ''}`}
                onClick={() => handleSelectNotebook(notebook)}
                style={{ borderColor: notebook.color }}
              >
                <div className="notebook-color" style={{ backgroundColor: notebook.color }}></div>
                <div className="notebook-title">{notebook.title}</div>
                {selectedNotebook?.id === notebook.id && <i className="fas fa-check"></i>}
              </div>
            ))}
          </div>
        )}
        
        {selectedNotebook && (
          <div className="study-options">
            <div className="study-mode-selector">
              <h3>¿Cómo quieres estudiar hoy?</h3>
              <div className="mode-buttons">
                <button
                  className={`mode-button ${studyMode === StudyMode.SMART ? 'active' : ''}`}
                  onClick={() => setStudyMode(StudyMode.SMART)}
                >
                  <i className="fas fa-brain"></i>
                  <span>Repaso inteligente</span>
                  <p className="mode-description">
                    Solo los conceptos que tu memoria necesita repasar hoy (¡máxima eficiencia!)
                  </p>
                </button>
                <button
                  className={`mode-button ${studyMode === StudyMode.FREE ? 'active' : ''}`}
                  onClick={() => setStudyMode(StudyMode.FREE)}
                >
                  <i className="fas fa-infinity"></i>
                  <span>Estudio libre</span>
                  <p className="mode-description">
                    Repasa cualquier concepto, tantas veces como quieras (¡suma puntos extra!)
                  </p>
                </button>
                <button
                  className={`mode-button ${studyMode === StudyMode.QUIZ ? 'active' : ''}`}
                  onClick={() => setStudyMode(StudyMode.QUIZ)}
                >
                  <i className="fas fa-check-circle"></i>
                  <span>Evaluación</span>
                  <p className="mode-description">Pon a prueba tu memoria</p>
                </button>
              </div>
            </div>
            
            <button
              className="start-session-button"
              onClick={startStudySession}
              disabled={loading}
            >
              {loading ? (
                <><i className="fas fa-spinner fa-spin"></i> Preparando...</>
              ) : (
                <><i className="fas fa-play"></i> Comenzar sesión</>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };
  
  // 2. Renderizar sesión de estudio activa
  const renderActiveSession = () => {
    // SOLUCIÓN RADICAL: Usar directamente el índice del array, no las métricas
    const currentIndex = allConcepts.length - currentConcepts.length + 1;
    const totalConcepts = allConcepts.length; // Total fijo, nunca cambia
    
    const currentConcept = currentConcepts[0];

    // PROTECCIÓN EXTRA: Si no hay concepto actual, no renderizar tarjeta
    if (!currentConcept) {
      return (
        <div className="study-session-container">
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
        </div>
      );
    }

    return (
      <div className="study-session-container">
        {/* Nueva cabecera minimalista centrada */}
        <div className="study-session-header-minimal">
          <div className="card-counter">
            <span className="card-number">{currentIndex}</span>
            <span className="card-divider">/</span>
            <span className="card-total">{totalConcepts}</span>
          </div>
          <div className="concepts-total">
            <span>Conceptos diferentes a repasar: <b>{uniqueConceptsCount}</b></span>
          </div>
        </div>
        {/* Layout principal con tarjeta y botones laterales */}
        <div className="study-session-layout">
          {/* Botón de respuesta izquierdo - Revisar después */}
          <div className="response-buttons">
            <button 
              className="response-button review-later"
              onClick={() => handleConceptResponse(currentConcept.id, ResponseQuality.REVIEW_LATER)}
              title="Revisar después - Este concepto necesita más práctica"
            >
              <i className="fas fa-redo"></i>
              <span>Revisar<br/>después</span>
            </button>
          </div>
          {/* Tarjeta de estudio swipeable */}
          <div className="study-card-container">
            <SwipeableStudyCard
              concept={currentConcept}
              onResponse={(quality) => handleConceptResponse(currentConcept.id, quality)}
              reviewMode={studyMode === StudyMode.SMART}
              quizMode={studyMode === StudyMode.QUIZ}
            />
          </div>
          {/* Botón de respuesta derecho - Dominado */}
          <div className="response-buttons">
            <button 
              className="response-button mastered"
              onClick={() => handleConceptResponse(currentConcept.id, ResponseQuality.MASTERED)}
              title="Dominado - ¡Lo tienes claro!"
            >
              <i className="fas fa-check-double"></i>
              <span>Dominado</span>
            </button>
          </div>
        </div>
        {/* Botón para finalizar sesión */}
        <button
          className="session-action-button"
          onClick={completeStudySession}
        >
          Finalizar sesión
        </button>
      </div>
    );
  };
  
  // 3. Renderizar resumen de sesión completada
  const renderSessionSummary = () => {
    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('es', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      }).format(date);
    };
    
    return (
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
              <i className="fas fa-calendar"></i> {formatDate(nextSession)}
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
        
        {studyMode === StudyMode.FREE && sessionReviewQueue.length > 0 && (
          <button
            className="action-button review-pending"
            onClick={() => {
              setCurrentConcepts([...sessionReviewQueue]);
              setSessionReviewQueue([]);
              setSessionActive(true);
              setSessionComplete(false);
            }}
          >
            <i className="fas fa-redo"></i> Repasar los que no dominaste ({sessionReviewQueue.length})
          </button>
        )}
      </div>
    );
  };
  
  // Renderizado condicional de la página principal
  return (
    <div className={`study-mode-container ${studyMode}`}>
      <header className="study-mode-header">
        <div className="header-content">
          <button
            className="back-button"
            onClick={() => {
              if (sessionActive) {
                // Mostrar confirmación antes de salir de sesión activa
                if (window.confirm("¿Seguro que quieres salir? Tu progreso será guardado.")) {
                  // Si hay una sesión activa, completarla antes de salir
                  if (sessionId) {
                    completeStudySession();
                  }
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
            {selectedNotebook ? selectedNotebook.title : 'Estudio'}
            {sessionActive && (
              <span className={`mode-badge ${studyMode}`}>
                {studyMode === StudyMode.SMART ? 'Repaso inteligente' : studyMode === StudyMode.FREE ? 'Estudio libre' : studyMode === StudyMode.QUIZ ? 'Evaluación' : 'Estudio'}
              </span>
            )}
          </h1>
          
          <div className="header-spacer"></div>
        </div>
      </header>
      
      <main className="study-mode-main">
        {/* Mensaje de feedback flotante */}
        {feedback.visible && (
          <FeedbackMessage 
            type={feedback.type} 
            message={feedback.message} 
          />
        )}
        
        {/* Renderizado condicional de pantallas */}
        {!sessionActive && !sessionComplete && renderNotebookSelection()}
        {sessionActive && renderActiveSession()}
        {sessionComplete && renderSessionSummary()}
      </main>
    </div>
  );
};

export default StudyModePage;