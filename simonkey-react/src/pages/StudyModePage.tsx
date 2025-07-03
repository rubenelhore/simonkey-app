// src/pages/StudyModePage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import SwipeableStudyCard from '../components/Mobile/SwipeableStudyCard';
import FeedbackMessage from '../components/FeedbackMessage';
import StudyDashboard from '../components/StudyDashboard';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import MiniQuiz from '../components/MiniQuiz';
import { useStudyService } from '../hooks/useStudyService';
import { Concept, ResponseQuality, StudyMode, Notebook, StudySessionMetrics } from '../types/interfaces';
import '../styles/StudyModePage.css';
import Confetti from 'react-confetti';
import { useUserType } from '../hooks/useUserType';
import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';

const StudyModePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSchoolStudent, subscription } = useUserType();
  const { schoolNotebooks } = useSchoolStudentData();
  
  const [materias, setMaterias] = useState<any[]>([]);
  const [selectedMateria, setSelectedMateria] = useState<any | null>(null);
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
  
  // Estado para el Mini Quiz
  const [showMiniQuiz, setShowMiniQuiz] = useState<boolean>(false);
  const [miniQuizPassed, setMiniQuizPassed] = useState<boolean>(false);
  const [miniQuizScore, setMiniQuizScore] = useState<number>(0);
  const [studySessionValidated, setStudySessionValidated] = useState<boolean>(false);
  
  // Estados para pantallas de introducción
  const [showSmartStudyIntro, setShowSmartStudyIntro] = useState<boolean>(false);
  const [showQuizIntro, setShowQuizIntro] = useState<boolean>(false);
  const [showFreeStudyIntro, setShowFreeStudyIntro] = useState<boolean>(false);
  const [pendingStudyMode, setPendingStudyMode] = useState<StudyMode | null>(null);
  
  // Debug: Monitor quiz intro state changes
  useEffect(() => {
    console.log('[DEBUG] showQuizIntro state changed to:', showQuizIntro);
  }, [showQuizIntro]);
  
  // Usar nuestro hook de servicio personalizado con el tipo de suscripción
  const studyService = useStudyService(subscription);
  
  // Timer para tracking de tiempo de estudio
  const [sessionTimer, setSessionTimer] = useState<number | null>(null);
  
  // Add this state at the top level
  const [sessionReviewQueue, setSessionReviewQueue] = useState<Concept[]>([]);
  
  // Debug effect to monitor quiz intro state
  useEffect(() => {
    console.log('[QUIZ DEBUG] State changed:', {
      showQuizIntro,
      pendingStudyMode,
      selectedNotebook: selectedNotebook?.title || 'none'
    });
  }, [showQuizIntro, pendingStudyMode, selectedNotebook]);
  
  // Add this state at the top level
  const [uniqueConceptIds, setUniqueConceptIds] = useState<Set<string>>(new Set());
  const [uniqueConceptsCount, setUniqueConceptsCount] = useState<number>(0);
  
  // Estado para conceptos fallados en estudio libre
  const [freeModeReviewQueue, setFreeModeReviewQueue] = useState<Concept[]>([]);
  
  // Al inicio del componente:
  const [reviewedConceptIds, setReviewedConceptIds] = useState<Set<string>>(new Set());
  const [masteredConceptIds, setMasteredConceptIds] = useState<Set<string>>(new Set());
  const [reviewingConceptIds, setReviewingConceptIds] = useState<Set<string>>(new Set());
  
  // Estado para el ID efectivo del usuario (para usuarios escolares)
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);

  // Cargar el ID efectivo del usuario al montar el componente
  useEffect(() => {
    const loadEffectiveUserId = async () => {
      if (auth.currentUser) {
        const effectiveUserData = await getEffectiveUserId();
        setEffectiveUserId(effectiveUserData ? effectiveUserData.id : auth.currentUser.uid);
      }
    };
    loadEffectiveUserId();
  }, [auth.currentUser]);

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
  
  // Cargar materias del usuario
  useEffect(() => {
    const fetchMaterias = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }
      
      try {
        setLoading(true);
        
        // Cargar materias del usuario
        const materiasQuery = query(
          collection(db, 'materias'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const materiasSnapshot = await getDocs(materiasQuery);
        const materiasData = materiasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setMaterias(materiasData);
        
        // Restaurar última materia usada
        const lastMateriaId = localStorage.getItem('lastStudyMateriaId');
        if (lastMateriaId && materiasData.length > 0) {
          const lastMateria = materiasData.find(m => m.id === lastMateriaId);
          if (lastMateria) {
            setSelectedMateria(lastMateria);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error al cargar materias:", error);
        showFeedback('warning', 'Error al cargar tus materias');
        setLoading(false);
      }
    };
    
    fetchMaterias();
  }, [navigate]);
  
  // Cargar notebooks cuando se selecciona una materia
  useEffect(() => {
    const fetchNotebooksForMateria = async () => {
      if (!selectedMateria || !auth.currentUser) {
        setNotebooks([]);
        return;
      }
      
      try {
        let notebooksData: Notebook[] = [];
        
        if (isSchoolStudent && schoolNotebooks) {
          // Filtrar notebooks escolares por materia
          notebooksData = schoolNotebooks
            .filter(notebook => notebook.idMateria === selectedMateria.id)
            .map(notebook => ({
              id: notebook.id,
              title: notebook.title,
              color: notebook.color || '#6147FF',
              materiaId: notebook.idMateria
            }));
        } else {
          // Regular notebooks filtrados por materia
          const notebooksQuery = query(
            collection(db, 'notebooks'),
            where('userId', '==', auth.currentUser.uid),
            where('materiaId', '==', selectedMateria.id)
          );
          
          const notebooksSnapshot = await getDocs(notebooksQuery);
          notebooksData = notebooksSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            color: doc.data().color || '#6147FF',
            materiaId: doc.data().materiaId
          }));
        }
        
        setNotebooks(notebooksData);
        
        // Si solo hay un cuaderno en la materia, seleccionarlo automáticamente
        if (notebooksData.length === 1) {
          setSelectedNotebook(notebooksData[0]);
        } else {
          setSelectedNotebook(null);
        }
      } catch (error) {
        console.error("Error al cargar cuadernos de la materia:", error);
        showFeedback('warning', 'Error al cargar los cuadernos');
      }
    };
    
    fetchNotebooksForMateria();
  }, [selectedMateria, isSchoolStudent, schoolNotebooks]);
  
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
      const lastNotebookKey = isSchoolStudent ? 
        `student_${auth.currentUser?.uid}_lastStudyNotebookId` : 
        'lastStudyNotebookId';
      localStorage.setItem(lastNotebookKey, selectedNotebook.id);
    }
  }, [selectedNotebook]);
  
  // Actualizar tiempo de estudio mientras la sesión está activa
  useEffect(() => {
    if (!sessionActive || !sessionTimer) return;
    
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - sessionTimer) / 1000);
      setMetrics(prev => ({
        ...prev,
        timeSpent: elapsedSeconds
      }));
    }, 1000); // Actualizar cada segundo
    
    return () => clearInterval(interval);
  }, [sessionActive, sessionTimer]);
  
  // Efecto para detectar cuando el usuario regresa de completar un quiz
  useEffect(() => {
    const handleFocus = () => {
      // Cuando el usuario regresa a la página (por ejemplo, después de completar un quiz)
      if (selectedNotebook && auth.currentUser) {
        console.log('🔄 Usuario regresó a la página, recargando datos del dashboard...');
        // Forzar recarga de datos del dashboard cambiando temporalmente el cuaderno seleccionado
        const currentNotebook = selectedNotebook;
        setSelectedNotebook(null);
        setTimeout(() => {
          setSelectedNotebook(currentNotebook);
        }, 100);
      }
    };

    // Escuchar cuando la ventana vuelve a tener foco
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedNotebook, auth.currentUser]);
  
  // Función para refrescar datos del dashboard
  const refreshDashboardData = useCallback(async () => {
    if (!selectedNotebook || !auth.currentUser) return;
    
    try {
      console.log('🔄 Refrescando datos del dashboard para cuaderno:', selectedNotebook.title);
      
      // Los datos del StudyDashboard se recargarán automáticamente por el useEffect
      // que depende de selectedNotebook.id cuando se cambie el cuaderno
      console.log('✅ Datos del dashboard refrescados');
    } catch (error) {
      console.error('❌ Error refreshing dashboard data:', error);
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
    console.log('[START SESSION] startStudySession called', {
      mode: mode,
      selectedNotebook: selectedNotebook?.id,
      selectedNotebookTitle: selectedNotebook?.title,
      authUser: auth.currentUser?.uid,
      currentShowQuizIntro: showQuizIntro
    });
    
    if (!auth.currentUser || !selectedNotebook) {
      console.log('[START SESSION] Missing auth or notebook');
      showFeedback('warning', 'Por favor selecciona un cuaderno para estudiar');
      return;
    }
    
    const sessionMode = mode || studyMode;
    console.log('[START SESSION] Using session mode:', sessionMode);
    
    // Mostrar pantalla de introducción según el modo
    if (sessionMode === StudyMode.SMART) {
      console.log('[START SESSION] Setting up SMART study intro');
      setShowSmartStudyIntro(true);
      setPendingStudyMode(sessionMode);
      return;
    } else if (sessionMode === StudyMode.QUIZ) {
      console.log('[START SESSION] Setting up QUIZ intro screen');
      console.log('[START SESSION] Current showQuizIntro state before:', showQuizIntro);
      setShowQuizIntro(true);
      setPendingStudyMode(sessionMode);
      console.log('[START SESSION] Called setShowQuizIntro(true) and setPendingStudyMode:', sessionMode);
      
      // Debug: Check if state update is working
      setTimeout(() => {
        console.log('[START SESSION] After timeout - checking state update');
      }, 100);
      setTimeout(() => {
        console.log('[START SESSION] After timeout - showQuizIntro should be true');
      }, 100);
      return;
    } else if (sessionMode === StudyMode.FREE) {
      console.log('[START SESSION] Setting up FREE study intro');
      setShowFreeStudyIntro(true);
      setPendingStudyMode(sessionMode);
      return;
    }
  };

  // Función para iniciar la sesión después de la introducción
  const beginStudySession = async () => {
    if (!pendingStudyMode) return;
    
    // Ocultar todas las pantallas de introducción
    setShowSmartStudyIntro(false);
    setShowQuizIntro(false);
    setShowFreeStudyIntro(false);
    
    const sessionMode = pendingStudyMode;
    setPendingStudyMode(null);
    
    // Actualizar el modo de estudio para que se muestre correctamente en el header
    setStudyMode(sessionMode);
    
    // Si el modo seleccionado es QUIZ, redirigir al QuizModePage
    if (sessionMode === StudyMode.QUIZ) {
      // Verificar que selectedNotebook existe antes de navegar
      if (!selectedNotebook) {
        console.error('No hay cuaderno seleccionado para el quiz');
        showFeedback('warning', 'Por favor selecciona un cuaderno para hacer el quiz');
        return;
      }
      
      console.log('Navegando a quiz con cuaderno:', selectedNotebook.id, selectedNotebook.title);
      navigate('/quiz', { 
        state: { 
          notebookId: selectedNotebook.id,
          notebookTitle: selectedNotebook.title,
          skipIntro: true // Indicar que ya se mostró la introducción
        } 
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Use appropriate user key for school students
      const effectiveUserData = await getEffectiveUserId();
      const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser!.uid;
      
      // Crear nueva sesión en Firestore
      const session = await studyService.createStudySession(
        userKey, 
        selectedNotebook!.id,
        sessionMode
      );
      
      setSessionId(session.id);
      
      // Cargar conceptos según el modo seleccionado
      let concepts: Concept[];
      
      if (sessionMode === StudyMode.SMART) {
        // CORRECCIÓN: Obtener SOLO conceptos listos para repaso inteligente según SM-3
        concepts = await studyService.getReviewableConcepts(
          userKey, 
          selectedNotebook!.id
        );
        
        console.log('🎯 ESTUDIO INTELIGENTE - Conceptos listos para repaso:', concepts.length);
        
        if (concepts.length === 0) {
          showFeedback('info', 'No tienes conceptos listos para repaso hoy según el algoritmo de repaso espaciado. ¡Excelente trabajo!');
          setLoading(false);
          return;
        }
      } else {
        // ESTUDIO LIBRE: obtener TODOS los conceptos del cuaderno
        concepts = await studyService.getAllConceptsFromNotebook(
          userKey, 
          selectedNotebook!.id
        );
        
        console.log('📚 ESTUDIO LIBRE - Todos los conceptos del cuaderno:', concepts.length);
        
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
      
      // Inicializar contadores para repaso inmediato
      setUniqueConceptsCount(concepts.length);
      setUniqueConceptIds(new Set(concepts.map(c => c.id)));
      setSessionReviewQueue([]);
      setReviewedConceptIds(new Set());
      setMasteredConceptIds(new Set());
      setReviewingConceptIds(new Set());
      
      // Iniciar timer de sesión
      setSessionTimer(Date.now());
      
      const modeText = sessionMode === StudyMode.SMART ? 'inteligente' : 'libre';
      showFeedback('success', `Sesión de estudio ${modeText} iniciada con ${concepts.length} conceptos`);
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
    console.log('🚨🚨🚨 handleConceptResponse LLAMADO 🚨🚨🚨', { conceptId, quality });
    
    if (!auth.currentUser || !sessionId) return;
    
    console.log('🔍 handleConceptResponse iniciado:', { conceptId, quality });
    console.log('📊 Estado actual:', {
      currentConcepts: currentConcepts.length,
      sessionReviewQueue: sessionReviewQueue.length,
      allConcepts: allConcepts.length
    });
    
    try {
      // Use appropriate user key for school students
      const effectiveUserData = await getEffectiveUserId();
      const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      // Actualizar respuesta usando SM-3
      await studyService.updateConceptResponse(
        userKey,
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
      
      // Obtener el concepto actual
      const currentConcept = currentConcepts.find(c => c.id === conceptId);
      console.log('🎯 Concepto actual encontrado:', currentConcept?.término);
      
      // CORRECCIÓN CRÍTICA: Calcular conceptos restantes ANTES de remover el actual
      const remainingConceptsAfterRemoval = currentConcepts.filter(c => c.id !== conceptId);
      console.log('📊 Conceptos restantes después de remover actual:', remainingConceptsAfterRemoval.length);
      
      // Remover concepto de la cola actual
      setCurrentConcepts(remainingConceptsAfterRemoval);
      
      // LÓGICA DE REPASO INMEDIATO CORREGIDA
      let newReviewQueue = [...sessionReviewQueue];
      console.log('📋 Cola de repaso antes de procesar:', newReviewQueue.length);
      
      if (quality === ResponseQuality.REVIEW_LATER && currentConcept) {
        // CORRECCIÓN: Si no aprendió correctamente, agregar a la cola de repaso inmediato
        newReviewQueue = [...sessionReviewQueue, currentConcept];
        console.log('🔄 Concepto agregado a cola de repaso inmediato:', currentConcept.término);
        console.log('📋 Nueva cola de repaso:', newReviewQueue.length);
        showFeedback('info', `"${currentConcept.término}" se agregó a tu cola de repaso. Te lo preguntaremos de nuevo.`);
      } else if (quality === ResponseQuality.MASTERED && currentConcept) {
        // Si dominó el concepto, verificar si estaba en la cola de repaso y eliminarlo
        const wasInReviewQueue = sessionReviewQueue.some(c => c.id === conceptId);
        if (wasInReviewQueue) {
          newReviewQueue = sessionReviewQueue.filter(c => c.id !== conceptId);
          console.log('✅ Concepto eliminado de cola de repaso (dominado):', currentConcept.término);
          showFeedback('success', `¡Excelente! Dominaste "${currentConcept.término}" y lo eliminamos de tu cola de repaso.`);
        }
      }
      
      // Actualizar la cola de repaso
      setSessionReviewQueue(newReviewQueue);
      
      // CORRECCIÓN CRÍTICA: Verificar si es el último concepto INCLUYENDO el que acabamos de procesar
      console.log('🔍 Verificación de finalización:', {
        remainingConceptsAfterRemoval: remainingConceptsAfterRemoval.length,
        newReviewQueueLength: newReviewQueue.length,
        isLastConcept: remainingConceptsAfterRemoval.length === 0
      });
      
      if (remainingConceptsAfterRemoval.length === 0) {
        // Ya no quedan conceptos en la ronda principal
        console.log('🔍 No quedan conceptos en la ronda principal');
        
        if (newReviewQueue.length > 0) {
          console.log('🔄 Continuando con conceptos de repaso inmediato...');
          // CORRECCIÓN: Usar la nueva cola calculada
          continueWithImmediateReview(newReviewQueue);
        } else {
          console.log('✅ No hay conceptos en cola de repaso, completando sesión...');
          await completeStudySession();
        }
      } else {
        console.log('⏭️ Aún quedan conceptos en la ronda actual, continuando...');
      }
      
    } catch (error) {
      console.error("Error al procesar respuesta:", error);
      showFeedback('warning', 'Error al guardar tu respuesta');
    }
  };
  
  // Continuar con conceptos de repaso inmediato - CORREGIDO
  const continueWithImmediateReview = async (queue: Concept[]) => {
    console.log('🔄 continueWithImmediateReview iniciado');
    console.log('📋 Cola de repaso recibida:', queue.length);
    console.log('📋 Conceptos en cola:', queue.map(c => c.término));
    
    if (queue.length === 0) {
      console.log('❌ No hay conceptos en cola de repaso, completando sesión...');
      await completeStudySession();
      return;
    }
    
    // CORRECCIÓN: Tomar el primer concepto y actualizar ambos estados al mismo tiempo
    const nextConcept = queue[0];
    const remainingQueue = queue.slice(1);
    
    console.log('🎯 Siguiente concepto a mostrar:', nextConcept.término);
    console.log('📋 Conceptos restantes en cola después:', remainingQueue.length);
    
    // Actualizar ambos estados de manera sincronizada
    setSessionReviewQueue(remainingQueue);
    setCurrentConcepts([nextConcept]);
    
    console.log('🔄 Mostrando concepto de repaso inmediato:', nextConcept.término);
    showFeedback('info', `Repasando: "${nextConcept.término}"`);
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
      
      // IMPORTANTE: Actualizar límites de estudio libre al COMPLETAR la sesión
      if (studyMode === StudyMode.FREE && selectedNotebook) {
        console.log('🔄 Actualizando límites de estudio libre al completar sesión...');
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        await studyService.updateFreeStudyUsage(userKey, selectedNotebook.id);
      }
      
      // IMPORTANTE: Para estudio inteligente, NO actualizar límites aquí
      // Los límites se actualizarán después del Mini Quiz
      if (studyMode === StudyMode.SMART && selectedNotebook) {
        console.log('🔄 Estudio inteligente completado. Esperando resultado del Mini Quiz...');
        // Mostrar Mini Quiz para validar el estudio inteligente
        setShowMiniQuiz(true);
        setSessionActive(false);
        return; // No completar la sesión aún
      }
      
      // Para estudio libre, completar normalmente
      if (studyMode === StudyMode.FREE) {
        // Registrar actividad
        await studyService.logStudyActivity(
          auth.currentUser.uid,
          'session_completed',
          `Sesión de estudio libre completada: ${metrics.conceptsReviewed} conceptos revisados, ${metrics.mastered} dominados`
        );
        
        setSessionComplete(true);
        setSessionActive(false);
        
        // Mostrar mensaje especial si hubo repasos inmediatos
        const totalRepetitions = reviewedConceptIds.size - uniqueConceptsCount;
        if (totalRepetitions > 0) {
          showFeedback('success', `¡Excelente perseverancia! Repasaste ${totalRepetitions} conceptos hasta dominarlos.`);
        }
      }
      
    } catch (error) {
      console.error("Error al completar sesión:", error);
      showFeedback('warning', 'Error al guardar estadísticas de la sesión');
      
      // Aún así mostramos el resumen
      setSessionComplete(true);
      setSessionActive(false);
    }
  };
  
  // Manejar resultado del Mini Quiz
  const handleMiniQuizComplete = async (passed: boolean, score: number) => {
    console.log('[MINI QUIZ] Resultado recibido:', { passed, score });
    
    setMiniQuizPassed(passed);
    setMiniQuizScore(score);
    setShowMiniQuiz(false);
    
    if (!auth.currentUser || !selectedNotebook || !sessionId) return;
    
    try {
      if (passed) {
        // Si pasó el Mini Quiz, validar el estudio inteligente
        console.log('✅ Mini Quiz aprobado. Validando estudio inteligente...');
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        await studyService.updateSmartStudyUsage(userKey, selectedNotebook.id);
        setStudySessionValidated(true);
        
        // Marcar la sesión como validada en Firestore
        await studyService.markStudySessionAsValidated(sessionId);
        
        // Registrar actividad exitosa
        await studyService.logStudyActivity(
          userKey,
          'smart_study_validated',
          `Estudio inteligente validado con Mini Quiz: ${score}/10. ${metrics.conceptsReviewed} conceptos revisados, ${metrics.mastered} dominados`
        );
        
        showFeedback('success', `¡Excelente! Has aprobado el Mini Quiz con ${score}/10. Tu estudio inteligente ha sido validado.`);
      } else {
        // Si no pasó el Mini Quiz, NO validar el estudio inteligente
        console.log('❌ Mini Quiz fallido. Estudio inteligente NO validado.');
        setStudySessionValidated(false);
        
        // Marcar la sesión como NO validada en Firestore
        await studyService.markStudySessionAsValidated(sessionId, false);
        
        // Registrar actividad fallida
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        await studyService.logStudyActivity(
          userKey,
          'smart_study_failed_validation',
          `Estudio inteligente falló validación con Mini Quiz: ${score}/10. ${metrics.conceptsReviewed} conceptos revisados, ${metrics.mastered} dominados`
        );
        
        showFeedback('warning', `Tu calificación fue de ${score}/10. Necesitas al menos 8/10 para validar el estudio inteligente.`);
      }
      
      // Completar la sesión (con o sin validación)
      setSessionComplete(true);
      setSessionActive(false);
      
      // Mostrar mensaje especial si hubo repasos inmediatos
      const totalRepetitions = reviewedConceptIds.size - uniqueConceptsCount;
      if (totalRepetitions > 0) {
        showFeedback('success', `¡Excelente perseverancia! Repasaste ${totalRepetitions} conceptos hasta dominarlos.`);
      }
      
      // Esperar un momento para asegurar que los datos se propaguen en Firestore
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refrescar datos del dashboard para mostrar el progreso actualizado
      await refreshDashboardData();
      
    } catch (error) {
      console.error("Error al procesar resultado del Mini Quiz:", error);
      showFeedback('warning', 'Error al procesar el resultado del Mini Quiz');
      
      // Aún así completar la sesión
      setSessionComplete(true);
      setSessionActive(false);
      
      // Intentar refrescar el dashboard aunque haya error
      try {
        await refreshDashboardData();
      } catch (refreshError) {
        console.error("Error al refrescar dashboard:", refreshError);
      }
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
    setSessionReviewQueue([]);
    setUniqueConceptIds(new Set());
    setUniqueConceptsCount(0);
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
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
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
  
  // Obtener tamaño de ventana para el confeti
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Renderizar introducción al Estudio Inteligente
  const renderSmartStudyIntro = () => {
    return (
      <div className="study-intro-overlay">
        <div className="study-intro-modal">
          <div className="intro-header">
            <i className="fas fa-brain"></i>
            <h2>Estudio Inteligente</h2>
          </div>
          
          <div className="intro-content">
            <div className="intro-section">
              <h3>¿Qué es el Estudio Inteligente?</h3>
              <p>
                El estudio inteligente utiliza el algoritmo de repaso espaciado SM-3 para 
                mostrarte <strong>solo los conceptos que necesitas repasar hoy</strong>.
              </p>
            </div>
            
            <div className="intro-section">
              <h3>¿Cómo funciona?</h3>
              <ul>
                <li><i className="fas fa-calendar-alt"></i> Se basa en tu historial de aprendizaje</li>
                <li><i className="fas fa-clock"></i> Te muestra conceptos en el momento óptimo</li>
                <li><i className="fas fa-redo"></i> Los conceptos difíciles aparecen más seguido</li>
                <li><i className="fas fa-star"></i> Los dominados aparecen menos frecuentemente</li>
              </ul>
            </div>
            
            <div className="intro-section">
              <h3>¿Qué pasa después?</h3>
              <p>
                Al completar el estudio inteligente, deberás hacer un <strong>Mini Quiz</strong> 
                de 5 preguntas. Necesitas al menos <strong>8/10</strong> para que cuente como 
                sesión validada.
              </p>
            </div>
          </div>
          
          <div className="intro-actions">
            <button
              className="action-button secondary"
              onClick={() => setShowSmartStudyIntro(false)}
            >
              <i className="fas fa-times"></i>
              Cancelar
            </button>
            <button
              className="action-button primary"
              onClick={beginStudySession}
            >
              <i className="fas fa-play"></i>
              Iniciar Estudio Inteligente
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar introducción al Quiz
  const renderQuizIntro = () => {
    console.log('[QUIZ] renderQuizIntro called, returning modal');
    console.log('[QUIZ] Current state - showQuizIntro:', showQuizIntro);
    console.log('[QUIZ] Current state - pendingStudyMode:', pendingStudyMode);
    console.log('[QUIZ] Current state - selectedNotebook:', selectedNotebook?.id);
    
    if (!showQuizIntro) {
      console.log('[QUIZ] showQuizIntro is false, not rendering modal');
      return null;
    }
    
    return (
      <div className="study-intro-overlay">
        <div className="study-intro-modal">
          <div className="intro-header">
            <i className="fas fa-question-circle"></i>
            <h2>Quiz de Evaluación</h2>
          </div>
          
          <div className="intro-content">
            <div className="intro-section">
              <h3>¿Qué es el Quiz?</h3>
              <p>
                El quiz es una evaluación de <strong>10 conceptos aleatorios</strong> 
                de tu cuaderno para medir tu dominio general.
              </p>
            </div>
            
            <div className="intro-section">
              <h3>¿Cómo funciona?</h3>
              <ul>
                <li><i className="fas fa-clock"></i> Tiempo limitado: <strong>10 minutos para completar el quiz</strong></li>
                <li><i className="fas fa-star"></i> Puntuación máxima basada en <strong>velocidad y exactitud</strong></li>
                <li><i className="fas fa-calendar"></i> Disponible una vez por semana</li>
              </ul>
            </div>
            
            <div className="intro-section">
              <h3>¿Por qué hacer el Quiz?</h3>
              <p>
                Ayuda a identificar la <strong>constancia y eficacia de estudio</strong>. 
                Es un componente importante del <strong>Score General</strong>.
              </p>
            </div>
            
            <div className="intro-section">
              <h3>¿Estás listo?</h3>
              <p>
                El quiz comenzará cuando hagas clic en "Iniciar Quiz". 
                ¡Buena suerte!
              </p>
            </div>
          </div>
          
          <div className="intro-actions">
            <button
              className="action-button secondary"
              onClick={() => {
                console.log('[QUIZ] Cancel button clicked, hiding quiz intro');
                setShowQuizIntro(false);
                setPendingStudyMode(null);
              }}
            >
              <i className="fas fa-times"></i>
              Cancelar
            </button>
            <button
              className="action-button primary"
              onClick={beginStudySession}
            >
              <i className="fas fa-play"></i>
              Iniciar Quiz
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar introducción al Estudio Libre
  const renderFreeStudyIntro = () => {
    return (
      <div className="study-intro-overlay">
        <div className="study-intro-modal">
          <div className="intro-header">
            <i className="fas fa-book-open"></i>
            <h2>Estudio Libre</h2>
          </div>
          
          <div className="intro-content">
            <div className="intro-section">
              <h3>¿Qué es el Estudio Libre?</h3>
              <p>
                El estudio libre te permite revisar <strong>todos los conceptos</strong> 
                de tu cuaderno sin restricciones del algoritmo de repaso espaciado.
              </p>
            </div>
            
            <div className="intro-section">
              <h3>¿Cómo funciona?</h3>
              <ul>
                <li><i className="fas fa-list"></i> Acceso a todos los conceptos del cuaderno</li>
                <li><i className="fas fa-random"></i> Orden aleatorio para variedad</li>
                <li><i className="fas fa-redo"></i> Conceptos difíciles se repiten inmediatamente</li>
                <li><i className="fas fa-calendar"></i> Disponible una vez al día</li>
              </ul>
            </div>
            
            <div className="intro-section">
              <h3>¿Cuándo usar Estudio Libre?</h3>
              <p>
                Úsalo cuando quieras repasar todo el material, prepararte para un examen, 
                o cuando el estudio inteligente no tenga conceptos disponibles.
              </p>
            </div>
          </div>
          
          <div className="intro-actions">
            <button
              className="action-button secondary"
              onClick={() => setShowFreeStudyIntro(false)}
            >
              <i className="fas fa-times"></i>
              Cancelar
            </button>
            <button
              className="action-button primary"
              onClick={beginStudySession}
            >
              <i className="fas fa-play"></i>
              Iniciar Estudio Libre
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar el componente principal
  return (
    <>
      {/* Mini Quiz - se muestra como overlay completo */}
      {showMiniQuiz && selectedNotebook && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: '#f8f9fa'
        }}>
          <MiniQuiz
            notebookId={selectedNotebook.id}
            notebookTitle={selectedNotebook.title}
            onComplete={handleMiniQuizComplete}
            onClose={() => setShowMiniQuiz(false)}
          />
        </div>
      )}
      
      {/* Pantallas de introducción */}
      {showSmartStudyIntro && renderSmartStudyIntro()}
      {showQuizIntro && (
        <>
          {console.log('[QUIZ] About to render quiz intro screen, showQuizIntro=', showQuizIntro)}
          {console.log('[QUIZ] pendingStudyMode=', pendingStudyMode)}
          {console.log('[QUIZ] selectedNotebook=', selectedNotebook?.id)}
          {renderQuizIntro()}
        </>
      )}
      {showFreeStudyIntro && renderFreeStudyIntro()}
      
      {/* Contenido principal */}
      <div className="study-mode-container">
        <HeaderWithHamburger
          title=""
          subtitle=""
          showBackButton={sessionActive || sessionComplete}
          onBackClick={() => {
            if (sessionActive) {
              if (window.confirm('¿Estás seguro de que quieres salir de la sesión de estudio? Tu progreso se guardará.')) {
                startNewSession();
              }
            } else if (sessionComplete) {
              startNewSession();
            }
          }}
        />
        
        <main className="study-mode-main">
          {/* Mensaje de feedback */}
          {feedback.visible && (
            <FeedbackMessage
              type={feedback.type}
              message={feedback.message}
            />
          )}
          
          {/* Mostrar selección de cuadernos cuando no hay sesión activa */}
          {!sessionActive && !sessionComplete && (
            <div className="study-notebook-selection">
              {loading ? (
                <div className="empty-notebooks">
                  <div className="empty-icon">
                    <i className="fas fa-spinner fa-spin"></i>
                  </div>
                  <h3>Cargando materias...</h3>
                </div>
              ) : materias.length === 0 ? (
                <div className="empty-notebooks">
                  <div className="empty-icon">
                    <i className="fas fa-folder-open"></i>
                  </div>
                  <h3>No tienes materias creadas</h3>
                  <p>Crea tu primera materia para comenzar a estudiar</p>
                </div>
              ) : (
                <>
                  {/* Selector de materia */}
                  <div className="materia-selector-container">
                    <label htmlFor="materia-select" className="materia-selector-label">
                      Selecciona una materia:
                    </label>
                    <select
                      id="materia-select"
                      className="materia-selector"
                      value={selectedMateria?.id || ''}
                      onChange={(e) => {
                        const materia = materias.find(m => m.id === e.target.value);
                        if (materia) {
                          setSelectedMateria(materia);
                          localStorage.setItem('lastStudyMateriaId', materia.id);
                        }
                      }}
                      style={{
                        borderColor: selectedMateria?.color || '#6147FF'
                      }}
                    >
                      <option value="">-- Selecciona una materia --</option>
                      {materias.map(materia => (
                        <option key={materia.id} value={materia.id}>
                          {materia.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Mostrar cuadernos solo si hay una materia seleccionada */}
                  {selectedMateria && (
                    <>
                      {notebooks.length === 0 ? (
                        <div className="empty-notebooks">
                          <div className="empty-icon">
                            <i className="fas fa-book"></i>
                          </div>
                          <h3>No hay cuadernos en esta materia</h3>
                          <p>Crea cuadernos en {selectedMateria.title} para comenzar a estudiar</p>
                        </div>
                      ) : (
                        <>
                          {/* Lista de cuadernos */}
                          <div className="notebooks-section">
                            <div className="notebooks-list">
                              {(notebooks as Notebook[]).map((notebook, index) => (
                                <div
                                  key={notebook.id || index}
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
                                userId={effectiveUserId || auth.currentUser?.uid || ''}
                                userSubscription={subscription}
                                onRefresh={refreshDashboardData}
                                onStartSession={startStudySession}
                              />
                            </>
                          )}
                        </>
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

                // Si no hay concepto actual pero la sesión está activa, probablemente estamos en transición
                // No mostrar nada hasta que se complete la transición
                if (!currentConcept && sessionActive) {
                  return (
                    <div className="loading-transition">
                      <div className="loading-spinner"></div>
                      <p>Procesando...</p>
                    </div>
                  );
                }

                // Solo mostrar el mensaje de "no concepts" si realmente no hay conceptos y la sesión no está activa
                if (!currentConcept && !sessionActive) {
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
                      
                      {/* Mostrar información de repaso inmediato */}
                      {sessionReviewQueue.length > 0 && (
                        <div className="immediate-review-indicator">
                          <i className="fas fa-clock"></i>
                          <span>Repaso inmediato: {sessionReviewQueue.length} conceptos</span>
                        </div>
                      )}
                    </div>

                    <SwipeableStudyCard
                      concept={currentConcept}
                      reviewMode={studyMode === StudyMode.SMART}
                      quizMode={studyMode === StudyMode.QUIZ}
                      onResponse={(quality) => handleConceptResponse(currentConcept.id, quality)}
                      onLockComplete={handleLockComplete}
                    />
                  </>
                );
              })()}
            </div>
          )}
          
          {sessionComplete && (
            <div className="study-mode-container smart session-complete-bg">
              <Confetti width={windowSize.width} height={windowSize.height} numberOfPieces={180} recycle={false} />
              <div className="session-complete-card">
                <div className="session-complete-trophy">
                  <i className="fas fa-trophy"></i>
                </div>
                <div className="session-complete-title">
                  {studyMode === StudyMode.SMART && miniQuizPassed 
                    ? '¡Estudio Inteligente Validado!' 
                    : studyMode === StudyMode.SMART && !miniQuizPassed
                    ? 'Estudio Inteligente Completado'
                    : '¡Sesión completada!'
                  }
                </div>
                <div className="session-complete-subtitle">
                  {studyMode === StudyMode.SMART && miniQuizPassed 
                    ? `¡Excelente! Has aprobado el Mini Quiz con ${miniQuizScore}/10. Tu estudio inteligente ha sido validado.`
                    : studyMode === StudyMode.SMART && !miniQuizPassed
                    ? `Tu calificación fue de ${miniQuizScore}/10. Necesitas al menos 8/10 para validar el estudio inteligente.`
                    : '¡Buen trabajo! Sigue así para dominar todos tus conceptos.'
                  }
                </div>
                <div className="session-complete-stats">
                  <div className="session-complete-stat-card concepts">
                    <div className="session-complete-stat-icon"><i className="fas fa-book"></i></div>
                    <div className="session-complete-stat-value">{metrics.conceptsReviewed}</div>
                    <div className="session-complete-stat-label">Conceptos revisados</div>
                  </div>
                  <div className="session-complete-stat-card mastered">
                    <div className="session-complete-stat-icon"><i className="fas fa-star"></i></div>
                    <div className="session-complete-stat-value">{metrics.mastered}</div>
                    <div className="session-complete-stat-label">Dominados</div>
                  </div>
                  <div className="session-complete-stat-card time">
                    <div className="session-complete-stat-icon"><i className="fas fa-clock"></i></div>
                    <div className="session-complete-stat-value">{formatStudyTime(metrics.timeSpent)}</div>
                    <div className="session-complete-stat-label">Tiempo de estudio</div>
                  </div>
                  {/* Mostrar resultado del Mini Quiz si es estudio inteligente */}
                  {studyMode === StudyMode.SMART && (
                    <div className="session-complete-stat-card mini-quiz">
                      <div className="session-complete-stat-icon">
                        <i className={`fas ${miniQuizPassed ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                      </div>
                      <div className="session-complete-stat-value">{miniQuizScore}/10</div>
                      <div className="session-complete-stat-label">
                        {miniQuizPassed ? 'Mini Quiz Aprobado' : 'Mini Quiz Fallido'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default StudyModePage;