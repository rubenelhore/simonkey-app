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
import { Concept, ResponseQuality, StudyMode, StudyIntensity, Notebook, StudySessionMetrics } from '../types/interfaces';
import '../styles/StudyModePage.css';
import Confetti from 'react-confetti';
import { useUserType } from '../hooks/useUserType';
import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { kpiService } from '../services/kpiService';
import { rankingUpdateService } from '../services/rankingUpdateService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faSpinner, faSnowflake } from '@fortawesome/free-solid-svg-icons';

const StudyModePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSchoolStudent, subscription } = useUserType();
  const { schoolNotebooks, schoolSubjects } = useSchoolStudentData();
  
  const [materias, setMaterias] = useState<any[]>([]);
  const [selectedMateria, setSelectedMateria] = useState<any | null>(null);
  const [showMateriaDropdown, setShowMateriaDropdown] = useState<boolean>(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>(StudyMode.SMART);
  const [studyIntensity, setStudyIntensity] = useState<StudyIntensity>(StudyIntensity.PROGRESS);
  const [totalNotebookConcepts, setTotalNotebookConcepts] = useState<number>(0);
  
  // Estado para los conceptos y la sesión de estudio
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allConcepts, setAllConcepts] = useState<Concept[]>([]);
  const [currentConcepts, setCurrentConcepts] = useState<Concept[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Concept[]>([]);
  const [sessionReviewedConcepts, setSessionReviewedConcepts] = useState<Concept[]>([]); // Conceptos repasados en la sesión actual
  
  // Add this state at the top level
  const [nextSession, setNextSession] = useState<Date | null>(null);
  const [sessionMultiplier, setSessionMultiplier] = useState<number>(1.5); // Multiplicador de sesión según intensidad
  
  // Estado para métricas y progreso
  const [metrics, setMetrics] = useState<StudySessionMetrics>({
    totalConcepts: 0,
    conceptsReviewed: 0,
    mastered: 0,
    reviewing: 0,
    timeSpent: 0,
    startTime: new Date()
  });
  
  // Estado para tracking de resultados finales de conceptos (evitar múltiples updates SM-3)
  const [conceptFinalResults, setConceptFinalResults] = useState<Map<string, ResponseQuality>>(new Map());
  // Estado para tracking de conceptos ya procesados en primera pasada
  const [conceptsFirstPass, setConceptsFirstPass] = useState<Set<string>>(new Set());
  
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
  
  // Estado para mostrar mensaje de cuaderno congelado
  const [showFrozenMessage, setShowFrozenMessage] = useState<boolean>(false);
  
  // Estado para el Mini Quiz
  const [showMiniQuiz, setShowMiniQuiz] = useState<boolean>(false);
  const [miniQuizPassed, setMiniQuizPassed] = useState<boolean>(false);
  const [miniQuizScore, setMiniQuizScore] = useState<number>(0);
  const [studySessionValidated, setStudySessionValidated] = useState<boolean>(false);
  
  // Log cuando cambia showMiniQuiz
  useEffect(() => {
    console.log('🎯 showMiniQuiz cambió a:', showMiniQuiz);
    if (showMiniQuiz) {
      console.log('📍 selectedNotebook:', selectedNotebook?.title);
    }
  }, [showMiniQuiz]);
  
  // Estados para pantallas de introducción
  const [showSmartStudyIntro, setShowSmartStudyIntro] = useState<boolean>(false);
  const [showQuizIntro, setShowQuizIntro] = useState<boolean>(false);
  const [showFreeStudyIntro, setShowFreeStudyIntro] = useState<boolean>(false);
  const [pendingStudyMode, setPendingStudyMode] = useState<StudyMode | null>(null);
  
  // Debug: Monitor quiz intro state changes
  useEffect(() => {
    console.log('[DEBUG] showQuizIntro state changed to:', showQuizIntro);
  }, [showQuizIntro]);
  
  // Cerrar el dropdown cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.materia-dropdown-container')) {
        setShowMateriaDropdown(false);
      }
    };

    if (showMateriaDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMateriaDropdown]);

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
  const [sm3UpdatedConceptIds, setSm3UpdatedConceptIds] = useState<Set<string>>(new Set());
  
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
        handleSelectNotebook(notebook);
        
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
        
        let materiasData: any[] = [];
        
        if (isSchoolStudent && schoolSubjects) {
          // Para estudiantes escolares, usar las materias escolares
          console.log('📚 StudyMode - Usando materias escolares:', schoolSubjects);
          materiasData = schoolSubjects.map(subject => ({
            id: subject.id,
            title: subject.nombre,
            color: '#6147FF',
            nombre: subject.nombre
          }));
        } else {
          // Para usuarios regulares, cargar materias de la colección regular
          const materiasQuery = query(
            collection(db, 'materias'),
            where('userId', '==', auth.currentUser.uid)
          );
          
          const materiasSnapshot = await getDocs(materiasQuery);
          materiasData = materiasSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        
        setMaterias(materiasData);
        
        // Restaurar última materia usada
        const lastMateriaKey = isSchoolStudent ? 
          `student_${auth.currentUser.uid}_lastStudyMateriaId` : 
          'lastStudyMateriaId';
        const lastMateriaId = localStorage.getItem(lastMateriaKey);
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
  }, [navigate, isSchoolStudent, schoolSubjects]);
  
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
              type: 'school' as const,
              idMateria: notebook.idMateria,
              isFrozen: notebook.isFrozen || false,
              frozenScore: notebook.frozenScore
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
            type: doc.data().type || 'personal' as const,
            materiaId: doc.data().materiaId
          }));
        }
        
        setNotebooks(notebooksData);
        
        // Si solo hay un cuaderno en la materia, seleccionarlo automáticamente
        if (notebooksData.length === 1) {
          handleSelectNotebook(notebooksData[0]);
        } else {
          setSelectedNotebook(null);
          setTotalNotebookConcepts(0);
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
        setTotalNotebookConcepts(0);
        setTimeout(() => {
          if (currentNotebook) {
            handleSelectNotebook(currentNotebook);
          }
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
    
    // Verificar si el cuaderno escolar está congelado
    if (isSchoolStudent) {
      try {
        const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', selectedNotebook.id));
        if (notebookDoc.exists() && notebookDoc.data().isFrozen) {
          showFeedback('warning', 'Este cuaderno está congelado. No puedes realizar actividades de estudio.');
          return;
        }
      } catch (error) {
        console.error('Error al verificar estado del cuaderno:', error);
      }
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
        // Obtener TODOS los conceptos del cuaderno primero
        const allNotebookConcepts = await studyService.getAllConceptsFromNotebook(
          userKey, 
          selectedNotebook!.id
        );
        
        // Obtener datos de aprendizaje para identificar conceptos no repasados
        const learningData = await studyService.getLearningDataForNotebook(
          userKey, 
          selectedNotebook!.id
        );
        
        // Crear un Set con los IDs de conceptos que ya tienen datos de aprendizaje (ya repasados)
        const reviewedConceptIds = new Set(learningData.map(data => data.conceptId));
        
        // Separar conceptos en no repasados y repasados con fecha de repaso vencida
        const neverReviewedConcepts = allNotebookConcepts.filter(concept => 
          !reviewedConceptIds.has(concept.id)
        );
        
        // Obtener conceptos que necesitan repaso según SM-3
        const conceptsDueForReview = await studyService.getReviewableConcepts(
          userKey, 
          selectedNotebook!.id
        );
        
        console.log('🎯 ESTUDIO INTELIGENTE - Conceptos nunca repasados:', neverReviewedConcepts.length);
        console.log('🎯 ESTUDIO INTELIGENTE - Conceptos listos para repaso SM-3:', conceptsDueForReview.length);
        
        // Priorizar conceptos no repasados primero, luego los que necesitan repaso
        concepts = [...neverReviewedConcepts, ...conceptsDueForReview];
        
        if (concepts.length === 0) {
          showFeedback('info', 'No tienes conceptos para repasar. ¡Excelente trabajo!');
          setLoading(false);
          return;
        }
        
        // Aplicar límite según la intensidad seleccionada
        let conceptLimit = 10; // Por defecto Progress
        let multiplier = 1.5;
        
        switch (studyIntensity) {
          case StudyIntensity.WARM_UP:
            conceptLimit = 5;
            multiplier = 1;
            break;
          case StudyIntensity.PROGRESS:
            conceptLimit = 10;
            multiplier = 1.5;
            break;
          case StudyIntensity.ROCKET:
            conceptLimit = 20;
            multiplier = 2;
            break;
        }
        
        // Guardar el multiplicador de sesión
        setSessionMultiplier(multiplier);
        
        // Limitar conceptos según la intensidad
        if (concepts.length > conceptLimit) {
          concepts = concepts.slice(0, conceptLimit);
          console.log(`🎯 Limitando a ${conceptLimit} conceptos según intensidad ${studyIntensity}`);
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
      setConceptFinalResults(new Map());
      setConceptsFirstPass(new Set());
      setSessionReviewedConcepts([]); // Limpiar conceptos repasados de la sesión
      
      // Iniciar timer de sesión
      setSessionTimer(Date.now());
      
      const modeText = sessionMode === StudyMode.SMART ? 'inteligente' : 'libre';
      let message = `Sesión de estudio ${modeText} iniciada con ${concepts.length} conceptos`;
      
      if (sessionMode === StudyMode.SMART) {
        const intensityText = studyIntensity === StudyIntensity.WARM_UP ? 'Warm-Up' :
                            studyIntensity === StudyIntensity.PROGRESS ? 'Progreso' : 'Rocket';
        message += ` (${intensityText} - cuenta como ${sessionMultiplier} ${sessionMultiplier === 1 ? 'sesión' : 'sesiones'})`;
      }
      
      showFeedback('success', message);
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
      
      // IMPORTANTE: NO actualizar SM-3 inmediatamente para evitar múltiples actualizaciones
      // Verificar si es la primera vez que vemos este concepto
      const isFirstPass = !conceptsFirstPass.has(conceptId);
      
      if (isFirstPass) {
        // Marcar como visto en primera pasada
        setConceptsFirstPass(prev => new Set(prev).add(conceptId));
        
        // Solo guardar el resultado si es la primera vez
        setConceptFinalResults(prev => {
          const newMap = new Map(prev);
          newMap.set(conceptId, quality);
          console.log(`📝 Primera pasada - Guardando resultado para concepto ${conceptId}: ${quality}`);
          return newMap;
        });
      } else {
        console.log(`🔄 Repaso inmediato - NO actualizando resultado para concepto ${conceptId}`);
      }
      
      // Actualizar métricas locales
      setMetrics(prev => ({
        ...prev,
        conceptsReviewed: prev.conceptsReviewed + 1,
        mastered: quality === ResponseQuality.MASTERED ? prev.mastered + 1 : prev.mastered,
        reviewing: quality === ResponseQuality.REVIEW_LATER ? prev.reviewing + 1 : prev.reviewing
      }));
      
      // Marcar concepto como revisado
      setReviewedConceptIds(prev => {
        const newSet = new Set(Array.from(prev).concat([conceptId]));
        console.log('📝 Agregando concepto a reviewedConceptIds:', {
          conceptId,
          previousSize: prev.size,
          newSize: newSet.size,
          allIds: Array.from(newSet)
        });
        return newSet;
      });
      
      // Agregar concepto a la lista de conceptos repasados en la sesión (para el mini quiz)
      const currentConcept = currentConcepts.find(c => c.id === conceptId);
      if (currentConcept && isFirstPass) {
        setSessionReviewedConcepts(prev => [...prev, currentConcept]);
        console.log('📝 Concepto agregado a sessionReviewedConcepts para mini quiz');
      }
      
      if (quality === ResponseQuality.MASTERED) {
        setMasteredConceptIds(prev => {
          const newSet = new Set(Array.from(prev).concat([conceptId]));
          console.log(`✅ Concepto ${conceptId} agregado a masteredConceptIds. Total dominados: ${newSet.size}`);
          return newSet;
        });
        // Si el concepto estaba en reviewing, quitarlo porque ahora está dominado
        setReviewingConceptIds(prev => {
          const newSet = new Set(prev);
          const wasInReviewing = newSet.has(conceptId);
          newSet.delete(conceptId);
          if (wasInReviewing) {
            console.log(`🔄 Concepto ${conceptId} removido de reviewingConceptIds porque ahora está dominado`);
          }
          return newSet;
        });
      } else {
        setReviewingConceptIds(prev => {
          const newSet = new Set(Array.from(prev).concat([conceptId]));
          console.log(`📝 Concepto ${conceptId} agregado a reviewingConceptIds. Total en repaso: ${newSet.size}`);
          return newSet;
        });
        // Si el concepto estaba en mastered, quitarlo porque ahora necesita repaso
        setMasteredConceptIds(prev => {
          const newSet = new Set(prev);
          const wasInMastered = newSet.has(conceptId);
          newSet.delete(conceptId);
          if (wasInMastered) {
            console.log(`⚠️ Concepto ${conceptId} removido de masteredConceptIds porque necesita repaso`);
          }
          return newSet;
        });
      }
      
      // Obtener el concepto actual nuevamente para el siguiente procesamiento
      const conceptForReview = currentConcepts.find(c => c.id === conceptId);
      console.log('🎯 Concepto actual encontrado:', conceptForReview?.término);
      
      // CORRECCIÓN CRÍTICA: Calcular conceptos restantes ANTES de remover el actual
      const remainingConceptsAfterRemoval = currentConcepts.filter(c => c.id !== conceptId);
      console.log('📊 Conceptos restantes después de remover actual:', remainingConceptsAfterRemoval.length);
      
      // Remover concepto de la cola actual
      setCurrentConcepts(remainingConceptsAfterRemoval);
      
      // LÓGICA DE REPASO INMEDIATO CORREGIDA
      let newReviewQueue = [...sessionReviewQueue];
      console.log('📋 Cola de repaso antes de procesar:', newReviewQueue.length);
      
      if (quality === ResponseQuality.REVIEW_LATER && conceptForReview) {
        // CORRECCIÓN: Si no aprendió correctamente, agregar a la cola de repaso inmediato
        newReviewQueue = [...sessionReviewQueue, conceptForReview];
        console.log('🔄 Concepto agregado a cola de repaso inmediato:', conceptForReview.término);
        console.log('📋 Nueva cola de repaso:', newReviewQueue.length);
        // Mensaje eliminado por solicitud del usuario
      } else if (quality === ResponseQuality.MASTERED && conceptForReview) {
        // Si dominó el concepto, verificar si estaba en la cola de repaso y eliminarlo
        const wasInReviewQueue = sessionReviewQueue.some(c => c.id === conceptId);
        if (wasInReviewQueue) {
          newReviewQueue = sessionReviewQueue.filter(c => c.id !== conceptId);
          console.log('✅ Concepto eliminado de cola de repaso (dominado):', conceptForReview.término);
          showFeedback('success', `¡Excelente! Dominaste "${conceptForReview.término}" y lo eliminamos de tu cola de repaso.`);
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
          // Pasar los valores actualizados directamente
          await completeStudySession({
            updatedReviewedIds: new Set(Array.from(reviewedConceptIds).concat([conceptId])),
            updatedMasteredIds: quality === ResponseQuality.MASTERED 
              ? new Set(Array.from(masteredConceptIds).concat([conceptId]))
              : masteredConceptIds,
            updatedReviewingIds: quality === ResponseQuality.REVIEW_LATER
              ? new Set(Array.from(reviewingConceptIds).concat([conceptId]))
              : reviewingConceptIds,
            updatedConceptFinalResults: new Map(conceptFinalResults).set(conceptId, quality)
          });
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
    // Mensaje eliminado por solicitud del usuario
  };
  
  // Completar la sesión de estudio
  const completeStudySession = async (updatedStates?: {
    updatedReviewedIds?: Set<string>;
    updatedMasteredIds?: Set<string>;
    updatedReviewingIds?: Set<string>;
    updatedConceptFinalResults?: Map<string, ResponseQuality>;
  }) => {
    // Usar los valores actualizados si se proporcionan, o los del estado actual
    const finalReviewedIds = updatedStates?.updatedReviewedIds || reviewedConceptIds;
    const finalMasteredIds = updatedStates?.updatedMasteredIds || masteredConceptIds;
    const finalReviewingIds = updatedStates?.updatedReviewingIds || reviewingConceptIds;
    const finalConceptResults = updatedStates?.updatedConceptFinalResults || conceptFinalResults;
    
    // Log del estado final de los Sets
    console.log('📊 RESUMEN FINAL DE LA SESIÓN:');
    console.log(`   - Conceptos únicos revisados: ${finalReviewedIds.size}`);
    console.log(`   - Conceptos dominados: ${finalMasteredIds.size}`);
    console.log(`   - Conceptos en repaso: ${finalReviewingIds.size}`);
    console.log(`   - Total conceptos en el cuaderno: ${allConcepts.length}`);
    
    if (!sessionId || !auth.currentUser) {
      // Si es una sesión de repaso inmediato, solo mostrar feedback y volver al resumen
      if (allConcepts.length > 0 && sessionReviewQueue.length === 0 && !sessionActive) {
        // Mensaje eliminado por solicitud del usuario
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
      // DEBUG: Verificar estado de conceptos
      console.log('🔍 [DEBUG] Estado de conceptos al completar sesión:');
      console.log('  - allConcepts.length:', allConcepts.length);
      console.log('  - conceptFinalResults.size:', finalConceptResults.size);
      console.log('  - masteredConceptIds.size:', finalMasteredIds.size);
      console.log('  - reviewedConceptIds.size:', finalReviewedIds.size);
      console.log('  - sessionId:', sessionId);
      
      // Preparar datos detallados de conceptos para KPIs
      const conceptsResults = Array.from(finalConceptResults.entries()).map(([conceptId, quality]) => ({
        conceptId,
        mastered: quality === ResponseQuality.MASTERED,
        quality
      }));
      
      // Contar conceptos dominados y no dominados
      const conceptsDominados = conceptsResults.filter(c => c.mastered).length;
      const conceptosNoDominados = conceptsResults.filter(c => !c.mastered).length;
      
      console.log('📊 [DEBUG] Conteos calculados:');
      console.log('  - conceptsDominados:', conceptsDominados);
      console.log('  - conceptosNoDominados:', conceptosNoDominados);
      console.log('  - conceptsResults.length:', conceptsResults.length);
      
      // Preparar datos para completeStudySession con validación
      const metricsData = {
        ...metrics,
        conceptsReviewed: finalReviewedIds.size,
        mastered: finalMasteredIds.size,
        reviewing: finalReviewingIds.size
      };
      
      const detailedResultsData = {
        concepts: allConcepts || [], // Pasar array completo de conceptos
        conceptsDominados: conceptsDominados || 0,
        conceptosNoDominados: conceptosNoDominados || 0,
        conceptsResults: conceptsResults || [],
        studyMode: studyMode || StudyMode.SMART,
        sessionMultiplier: studyMode === StudyMode.SMART ? sessionMultiplier : 1, // Solo aplicar multiplicador en estudio inteligente
        studyIntensity: studyMode === StudyMode.SMART ? studyIntensity : null // Guardar intensidad solo para estudio inteligente
      };
      
      // Log detallado para debug
      console.log('📋 Datos a enviar a completeStudySession:', {
        sessionId,
        metricsData,
        detailedResultsData,
        // Verificar campos específicos
        metricsKeys: Object.keys(metricsData),
        detailedResultsKeys: Object.keys(detailedResultsData),
        // Verificar valores undefined
        hasUndefinedInMetrics: Object.entries(metricsData).some(([k, v]) => v === undefined),
        hasUndefinedInDetailedResults: Object.entries(detailedResultsData).some(([k, v]) => v === undefined)
      });
      
      // Verificar campos undefined antes de enviar
      for (const [key, value] of Object.entries(metricsData)) {
        if (value === undefined) {
          console.error(`❌ Campo undefined en metrics: ${key}`);
        }
      }
      
      for (const [key, value] of Object.entries(detailedResultsData)) {
        if (value === undefined) {
          console.error(`❌ Campo undefined en detailedResults: ${key}`);
        }
      }
      
      // Verificar el contenido de metrics original
      console.log('📊 metrics original:', metrics);
      console.log('📊 allConcepts:', allConcepts);
      console.log('📊 conceptsResults:', conceptsResults);
      
      // Guardar estadísticas en Firestore con datos detallados
      await studyService.completeStudySession(
        sessionId,
        metricsData,
        detailedResultsData
      );
      
      // IMPORTANTE: Solo actualizar SM-3 si es estudio inteligente
      // Los estudios libres NO deben afectar al algoritmo de espaciamiento
      if (studyMode === StudyMode.SMART) {
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        
        console.log('🎯 Actualizando SM-3 con resultados finales de primera pasada (Estudio Inteligente)...');
        console.log(`📊 Total de conceptos con resultados finales: ${conceptFinalResults.size}`);
        
        // Actualizar cada concepto con su resultado de primera pasada
        for (const [conceptId, quality] of conceptFinalResults) {
          try {
            await studyService.updateConceptResponse(userKey, conceptId, quality);
            console.log(`✅ SM-3 actualizado para concepto ${conceptId} con calidad ${quality}`);
          } catch (error) {
            console.error(`Error actualizando SM-3 para concepto ${conceptId}:`, error);
          }
        }
      } else {
        console.log('📚 Estudio Libre completado - NO se actualiza el algoritmo SM-3');
        console.log('ℹ️ Los estudios libres no afectan al espaciamiento de conceptos');
      }
      
      // Actualizar KPIs del usuario
      try {
        console.log('📊 Actualizando KPIs del usuario después de completar sesión de estudio...');
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        console.log('📊 Usando ID efectivo para KPIs:', userKey);
        await kpiService.updateUserKPIs(userKey);
        
        // Actualizar rankings si es estudio inteligente (afecta scores)
        if (studyMode === StudyMode.SMART) {
          console.log('🏆 Actualizando rankings después de estudio inteligente...');
          await rankingUpdateService.updateRankingsForStudent(userKey);
        }
      } catch (kpiError) {
        console.error('Error actualizando KPIs:', kpiError);
        // No fallar la sesión por error en KPIs
      }
      
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
        console.log('📋 Estado antes de mostrar Mini Quiz:', {
          selectedNotebook: selectedNotebook?.title,
          sessionId,
          showMiniQuiz,
          sessionComplete,
          sessionActive
        });
        
        // Mostrar Mini Quiz para validar el estudio inteligente
        setShowMiniQuiz(true);
        setSessionActive(false);
        // Marcar como completado para mostrar el resumen con el mini quiz
        setSessionComplete(true);
        
        console.log('✅ Mini Quiz activado. showMiniQuiz = true');
        return; // No completar la sesión aún
      }
      
      // Para estudio libre, completar normalmente
      if (studyMode === StudyMode.FREE) {
        // Registrar actividad
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        await studyService.logStudyActivity(
          userKey,
          'session_completed',
          `Sesión de estudio libre completada: ${reviewedConceptIds.size} conceptos revisados, ${masteredConceptIds.size} dominados`
        );
        
        setSessionComplete(true);
        setSessionActive(false);
        
        // Mensaje eliminado por solicitud del usuario
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
      // Obtener userKey al inicio
      const effectiveUserData = await getEffectiveUserId();
      const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      if (passed) {
        // Si pasó el Mini Quiz, validar el estudio inteligente
        console.log('✅ Mini Quiz aprobado. Validando estudio inteligente...');
        await studyService.updateSmartStudyUsage(userKey, selectedNotebook.id, true);
        setStudySessionValidated(true);
        
        // Marcar la sesión como validada en Firestore
        await studyService.markStudySessionAsValidated(sessionId);
        
        // Registrar actividad exitosa
        await studyService.logStudyActivity(
          userKey,
          'smart_study_validated',
          `Estudio inteligente validado con Mini Quiz: ${score}/10. ${reviewedConceptIds.size} conceptos revisados, ${masteredConceptIds.size} dominados`
        );
        
        // Mensaje eliminado por solicitud del usuario
      } else {
        // Si no pasó el Mini Quiz, NO validar el estudio inteligente
        console.log('❌ Mini Quiz fallido. Estudio inteligente NO validado.');
        setStudySessionValidated(false);
        
        // Marcar la sesión como NO validada en Firestore
        await studyService.markStudySessionAsValidated(sessionId, false);
        
        // Registrar actividad fallida
        await studyService.logStudyActivity(
          userKey,
          'smart_study_failed_validation',
          `Estudio inteligente falló validación con Mini Quiz: ${score}/10. ${reviewedConceptIds.size} conceptos revisados, ${masteredConceptIds.size} dominados`
        );
        
        // Guardar que el quiz falló para bloquear hasta mañana
        await studyService.updateSmartStudyUsage(userKey, selectedNotebook.id, false);
        
        // Mensaje eliminado por solicitud del usuario
      }
      
      // Completar la sesión (con o sin validación)
      setSessionComplete(true);
      setSessionActive(false);
      
      // Mostrar mensaje especial si hubo repasos inmediatos
      const totalRepetitions = reviewedConceptIds.size - uniqueConceptsCount;
      if (totalRepetitions > 0) {
        // Mensaje eliminado por solicitud del usuario
      }
      
      // IMPORTANTE: Actualizar SM-3 con los resultados finales después del Mini Quiz
      console.log('🎯 Actualizando SM-3 después del Mini Quiz...');
      console.log(`📊 Total de conceptos con resultados finales: ${conceptFinalResults.size}`);
      
      // Actualizar cada concepto con su resultado de primera pasada
      for (const [conceptId, quality] of conceptFinalResults) {
        try {
          await studyService.updateConceptResponse(userKey, conceptId, quality);
          console.log(`✅ SM-3 actualizado para concepto ${conceptId} con calidad ${quality}`);
        } catch (error) {
          console.error(`Error actualizando SM-3 para concepto ${conceptId}:`, error);
        }
      }
      
      // Actualizar KPIs del usuario después del Mini Quiz
      try {
        console.log('📊 Actualizando KPIs del usuario después del Mini Quiz...');
        console.log('📊 Usando userKey para KPIs:', userKey);
        await kpiService.updateUserKPIs(userKey);
      } catch (kpiError) {
        console.error('Error actualizando KPIs:', kpiError);
        // No fallar por error en KPIs
      }
      
      // Esperar más tiempo para asegurar que los datos se propaguen completamente en Firestore
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Refrescar datos del dashboard para mostrar el progreso actualizado
      await refreshDashboardData();
      
      // Forzar una segunda actualización para garantizar sincronización
      await new Promise(resolve => setTimeout(resolve, 500));
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
    setSessionReviewedConcepts([]); // Limpiar conceptos repasados de la sesión
    setUniqueConceptIds(new Set());
    setUniqueConceptsCount(0);
    setSessionId(null);
    setSessionTimer(null);
    setConceptFinalResults(new Map());
    setConceptsFirstPass(new Set());
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
    return (reviewedConceptIds.size / metrics.totalConcepts) * 100;
  }, [reviewedConceptIds.size, metrics.totalConcepts]);
  
  // Funciones para cambiar el modo de estudio
  const handleModeChange = (mode: StudyMode) => {
    setStudyMode(mode);
  };
  
  // Seleccionar un cuaderno
  const handleSelectNotebook = async (notebook: Notebook) => {
    // Si es un cuaderno escolar, verificar si está congelado
    if (isSchoolStudent) {
      try {
        const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebook.id));
        if (notebookDoc.exists() && notebookDoc.data().isFrozen) {
          showFeedback('warning', 'Este cuaderno está congelado. No puedes realizar actividades de estudio.');
          return;
        }
      } catch (error) {
        console.error('Error al verificar estado del cuaderno:', error);
      }
    }
    
    setSelectedNotebook(notebook);
    localStorage.setItem('lastStudyNotebookId', notebook.id);
    
    // Contar total de conceptos en el cuaderno
    try {
      const userKey = effectiveUserId || auth.currentUser?.uid;
      if (userKey) {
        const allConcepts = await studyService.getAllConceptsFromNotebook(userKey, notebook.id);
        setTotalNotebookConcepts(allConcepts.length);
        console.log('📚 Total de conceptos en el cuaderno:', allConcepts.length);
        
        // Ajustar automáticamente la intensidad según el número de conceptos
        if (allConcepts.length < 5) {
          // No hay suficientes conceptos para ninguna intensidad
          console.warn('No hay suficientes conceptos para iniciar estudio (mínimo 5)');
        } else if (allConcepts.length < 10 && studyIntensity !== StudyIntensity.WARM_UP) {
          setStudyIntensity(StudyIntensity.WARM_UP);
          console.log('Ajustando intensidad a Warm-Up (solo hay', allConcepts.length, 'conceptos)');
        } else if (allConcepts.length < 20 && studyIntensity === StudyIntensity.ROCKET) {
          setStudyIntensity(StudyIntensity.PROGRESS);
          console.log('Ajustando intensidad a Progreso (solo hay', allConcepts.length, 'conceptos)');
        }
      }
    } catch (error) {
      console.error('Error al contar conceptos:', error);
      setTotalNotebookConcepts(0);
    }
  };
  
  // Iniciar sesión de repaso solo para conceptos pendientes
  const startReviewSession = async () => {
    if (!selectedNotebook || !auth.currentUser) return;
    
    // Verificar si el cuaderno escolar está congelado
    if (isSchoolStudent) {
      try {
        const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', selectedNotebook.id));
        if (notebookDoc.exists() && notebookDoc.data().isFrozen) {
          showFeedback('warning', 'Este cuaderno está congelado. No puedes realizar actividades de estudio.');
          return;
        }
      } catch (error) {
        console.error('Error al verificar estado del cuaderno:', error);
      }
    }
    
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
              <h3>Elige tu intensidad de estudio:</h3>
              {totalNotebookConcepts > 0 && (
                <p className="total-concepts-info">
                  El cuaderno tiene <strong>{totalNotebookConcepts} conceptos</strong> en total
                </p>
              )}
              <div className="intensity-options">
                <div 
                  className={`intensity-option ${studyIntensity === StudyIntensity.WARM_UP ? 'selected' : ''} ${totalNotebookConcepts < 5 ? 'disabled' : ''}`}
                  onClick={() => totalNotebookConcepts >= 5 && setStudyIntensity(StudyIntensity.WARM_UP)}
                >
                  <div className="intensity-icon">
                    <i className="fas fa-coffee"></i>
                  </div>
                  <h4>Warm-Up</h4>
                  <p>5 conceptos</p>
                  <p className="intensity-description">Perfecto para un repaso rápido</p>
                  <p className="session-value">Cuenta como: <strong>1 sesión</strong></p>
                  {totalNotebookConcepts < 5 && (
                    <p className="intensity-disabled-reason">Requiere al menos 5 conceptos</p>
                  )}
                </div>
                
                <div 
                  className={`intensity-option ${studyIntensity === StudyIntensity.PROGRESS ? 'selected' : ''} ${totalNotebookConcepts < 10 ? 'disabled' : ''}`}
                  onClick={() => totalNotebookConcepts >= 10 && setStudyIntensity(StudyIntensity.PROGRESS)}
                >
                  <div className="intensity-icon">
                    <i className="fas fa-chart-line"></i>
                  </div>
                  <h4>Progreso</h4>
                  <p>10 conceptos</p>
                  <p className="intensity-description">Ideal para avance constante</p>
                  <p className="session-value">Cuenta como: <strong>1.5 sesiones</strong></p>
                  {totalNotebookConcepts < 10 && (
                    <p className="intensity-disabled-reason">Requiere al menos 10 conceptos</p>
                  )}
                </div>
                
                <div 
                  className={`intensity-option ${studyIntensity === StudyIntensity.ROCKET ? 'selected' : ''} ${totalNotebookConcepts < 20 ? 'disabled' : ''}`}
                  onClick={() => totalNotebookConcepts >= 20 && setStudyIntensity(StudyIntensity.ROCKET)}
                >
                  <div className="intensity-icon">
                    <i className="fas fa-rocket"></i>
                  </div>
                  <h4>Rocket</h4>
                  <p>20 conceptos</p>
                  <p className="intensity-description">Máximo aprendizaje</p>
                  <p className="session-value">Cuenta como: <strong>2 sesiones</strong></p>
                  {totalNotebookConcepts < 20 && (
                    <p className="intensity-disabled-reason">Requiere al menos 20 conceptos</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="intro-section">
              <h3>¿Qué pasa después?</h3>
              <p>
                Al completar el estudio inteligente, deberás hacer un <strong>Mini Quiz</strong> 
                de 5 preguntas aleatorias de los conceptos repasados. Necesitas al menos <strong>8/10</strong> para que cuente como 
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
              disabled={totalNotebookConcepts < 5 || 
                       (studyIntensity === StudyIntensity.WARM_UP && totalNotebookConcepts < 5) ||
                       (studyIntensity === StudyIntensity.PROGRESS && totalNotebookConcepts < 10) ||
                       (studyIntensity === StudyIntensity.ROCKET && totalNotebookConcepts < 20)}
            >
              <i className="fas fa-play"></i>
              {totalNotebookConcepts < 5 ? 'No hay suficientes conceptos' :
               `Iniciar ${studyIntensity === StudyIntensity.WARM_UP ? 'Warm-Up' : 
                         studyIntensity === StudyIntensity.PROGRESS ? 'Progreso' : 'Rocket'}`}
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
      {/* Mini Quiz - se muestra como overlay completo con la mayor prioridad */}
      {showMiniQuiz && selectedNotebook && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          backgroundColor: '#f8f9fa'
        }}>
          {(() => {
            console.log('🎮 RENDERIZANDO MINI QUIZ:', {
              notebookId: selectedNotebook.id,
              notebookTitle: selectedNotebook.title
            });
            return null;
          })()}
          <MiniQuiz
            notebookId={selectedNotebook.id}
            notebookTitle={selectedNotebook.title}
            sessionConcepts={sessionReviewedConcepts}
            onComplete={handleMiniQuizComplete}
            onClose={() => setShowMiniQuiz(false)}
          />
        </div>
      )}
      
      {/* Pantallas de introducción */}
      {showSmartStudyIntro && renderSmartStudyIntro()}
      {showQuizIntro && (
        <>
          {(() => {
            console.log('[QUIZ] About to render quiz intro screen, showQuizIntro=', showQuizIntro);
            console.log('[QUIZ] pendingStudyMode=', pendingStudyMode);
            console.log('[QUIZ] selectedNotebook=', selectedNotebook?.id);
            return null;
          })()}
          {renderQuizIntro()}
        </>
      )}
      {showFreeStudyIntro && renderFreeStudyIntro()}
      
      {/* Contenido principal */}
      <div className="study-mode-container">
        <HeaderWithHamburger
          title="Espacio de estudio"
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
                <div className="loading-container">
                  <FontAwesomeIcon icon={faSpinner} spin size="3x" />
                  <p>Cargando tus datos de estudio...</p>
                </div>
              ) : materias.length === 0 ? (
                <div className="empty-notebooks">
                  <div className="empty-icon">
                    <i className="fas fa-folder-open"></i>
                  </div>
                  <h3>{isSchoolStudent ? 'No tienes materias asignadas' : 'No tienes materias creadas'}</h3>
                  <p>{isSchoolStudent ? 'Contacta a tu profesor para que te asigne materias' : 'Crea tu primera materia para comenzar a estudiar'}</p>
                </div>
              ) : (
                <>
                  {/* Selector de materia */}
                  <div className="materia-selector-container">
                    <label className="materia-selector-label">
                      Selecciona una materia:
                    </label>
                    <div className="materia-dropdown-container">
                      <button 
                        className="materia-dropdown-btn"
                        onClick={() => {
                          console.log('[StudyModePage] Materias disponibles:', materias);
                          setShowMateriaDropdown(!showMateriaDropdown);
                        }}
                        type="button"
                        style={{
                          borderColor: selectedMateria?.color || '#6147FF'
                        }}
                      >
                        <span>{selectedMateria?.nombre || selectedMateria?.title || 'Seleccionar materia'}</span>
                        <FontAwesomeIcon icon={faChevronDown} className={`dropdown-icon ${showMateriaDropdown ? 'open' : ''}`} />
                      </button>
                      
                      {showMateriaDropdown && (
                        <div className="materia-dropdown" style={{ backgroundColor: '#ffffff' }}>
                          {materias.length === 0 ? (
                            <div className="materia-option" style={{ color: '#374151' }}>No hay materias disponibles</div>
                          ) : (
                            materias.map(materia => (
                              <div 
                                key={materia.id}
                                className={`materia-option ${selectedMateria?.id === materia.id ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedMateria(materia);
                                  const lastMateriaKey = isSchoolStudent ? 
                                    `student_${auth.currentUser?.uid}_lastStudyMateriaId` : 
                                    'lastStudyMateriaId';
                                  localStorage.setItem(lastMateriaKey, materia.id);
                                  setShowMateriaDropdown(false);
                                }}
                                style={{
                                  borderLeft: selectedMateria?.id === materia.id ? `4px solid ${materia.color || '#6147FF'}` : 'none',
                                  paddingLeft: selectedMateria?.id === materia.id ? '12px' : '16px'
                                }}
                              >
                                {materia.nombre || materia.title || 'Sin nombre'}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
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
                                  className={`notebook-item ${selectedNotebook?.id === notebook.id ? 'selected' : ''} ${notebook.isFrozen ? 'frozen' : ''}`}
                                  onClick={() => {
                                    if (notebook.isFrozen) {
                                      setShowFrozenMessage(true);
                                      setTimeout(() => setShowFrozenMessage(false), 3000);
                                    } else {
                                      handleSelectNotebook(notebook);
                                    }
                                  }}
                                  style={{ 
                                    borderColor: notebook.color,
                                    opacity: notebook.isFrozen ? 0.6 : 1,
                                    cursor: notebook.isFrozen ? 'not-allowed' : 'pointer'
                                  }}
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
                                    {notebook.isFrozen && (
                                      <div className="notebook-frozen-status">
                                        <i className="fas fa-snowflake"></i>
                                        <span>Congelado</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Mensaje de cuaderno congelado */}
                          {showFrozenMessage && (
                            <div className="frozen-message-overlay">
                              <div className="frozen-message">
                                <i className="fas fa-snowflake frozen-icon"></i>
                                <p>Este cuaderno está congelado ❄️</p>
                                <p className="frozen-subtitle">No puedes estudiar mientras esté congelado</p>
                              </div>
                            </div>
                          )}
                          
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
                        onClick={() => completeStudySession()}
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
          
          {sessionComplete && !showMiniQuiz && (
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
                    <div className="session-complete-stat-value">{conceptFinalResults.size}</div>
                    <div className="session-complete-stat-label">Conceptos revisados</div>
                  </div>
                  <div className="session-complete-stat-card mastered">
                    <div className="session-complete-stat-icon"><i className="fas fa-star"></i></div>
                    <div className="session-complete-stat-value">{Array.from(conceptFinalResults.values()).filter(quality => quality === ResponseQuality.MASTERED).length}</div>
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