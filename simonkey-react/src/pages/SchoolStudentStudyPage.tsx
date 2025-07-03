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
import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import { useUserType } from '../hooks/useUserType';
import { Concept, ResponseQuality, StudyMode, SchoolNotebook, StudySessionMetrics } from '../types/interfaces';
import '../styles/StudyModePage.css';
import '../styles/SchoolSystem.css';
import Confetti from 'react-confetti';

const SchoolStudentStudyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSchoolStudent } = useUserType();
  const { schoolNotebooks, loading: notebooksLoading } = useSchoolStudentData();
  
  // Redirigir automáticamente a la página de materias
  useEffect(() => {
    console.log('🎓 SchoolStudentStudyPage - Redirigiendo estudiante a /materias');
    navigate('/materias', { replace: true });
  }, [navigate]);
  
  const [selectedNotebook, setSelectedNotebook] = useState<SchoolNotebook | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>(StudyMode.SMART);
  
  // Estado para los conceptos y la sesión de estudio
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allConcepts, setAllConcepts] = useState<Concept[]>([]);
  const [currentConcepts, setCurrentConcepts] = useState<Concept[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Concept[]>([]);
  
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
  
  // Usar nuestro hook de servicio personalizado
  const studyService = useStudyService();
  
  // Timer para tracking de tiempo de estudio
  const [sessionTimer, setSessionTimer] = useState<number | null>(null);
  
  // Estados específicos para estudiantes escolares
  const [sessionReviewQueue, setSessionReviewQueue] = useState<Concept[]>([]);
  const [uniqueConceptIds, setUniqueConceptIds] = useState<Set<string>>(new Set());
  const [uniqueConceptsCount, setUniqueConceptsCount] = useState<number>(0);
  const [freeModeReviewQueue, setFreeModeReviewQueue] = useState<Concept[]>([]);
  const [reviewedConceptIds, setReviewedConceptIds] = useState<Set<string>>(new Set());
  const [masteredConceptIds, setMasteredConceptIds] = useState<Set<string>>(new Set());
  const [reviewingConceptIds, setReviewingConceptIds] = useState<Set<string>>(new Set());

  // Verificar autorización
  useEffect(() => {
    if (!notebooksLoading && !isSchoolStudent) {
      console.log('❌ Usuario no autorizado como estudiante escolar');
      navigate('/');
      return;
    }
  }, [isSchoolStudent, notebooksLoading, navigate]);

  // Convertir schoolNotebooks a formato compatible con Notebook
  const notebooks = useMemo(() => {
    if (!schoolNotebooks) return [];
    return schoolNotebooks.map(notebook => ({
      id: notebook.id,
      title: notebook.title,
      color: notebook.color || '#6147FF'
    }));
  }, [schoolNotebooks]);

  // Verificar si viene de otra página con datos
  useEffect(() => {
    if (location.state && location.state.notebookId) {
      const notebook = notebooks.find(n => n.id === location.state.notebookId);
      if (notebook) {
        setSelectedNotebook(schoolNotebooks?.find(n => n.id === location.state.notebookId) || null);
        
        if (location.state.refreshDashboard) {
          showFeedback('success', '¡Quiz completado! Tu progreso se ha actualizado');
          window.history.replaceState({}, document.title);
        }
      }
    }
  }, [location.state, notebooks, schoolNotebooks]);
  
  // Cargar estado inicial
  useEffect(() => {
    const initializeStudentData = async () => {
      if (!auth.currentUser || notebooksLoading) return;
      
      try {
        setLoading(true);
        
        if (notebooks.length === 0) {
          console.log('❌ El estudiante no tiene cuadernos asignados');
          setLoading(false);
          return;
        }

        // Restaurar último cuaderno usado (específico del estudiante)
        const lastNotebookKey = `student_${auth.currentUser.uid}_lastStudyNotebookId`;
        const lastNotebookId = localStorage.getItem(lastNotebookKey);
        
        if (lastNotebookId && notebooks.length > 0) {
          const lastNotebook = schoolNotebooks?.find(n => n.id === lastNotebookId);
          if (lastNotebook) {
            setSelectedNotebook(lastNotebook);
          }
        } else if (notebooks.length === 1) {
          // Si solo hay un cuaderno, seleccionarlo automáticamente
          setSelectedNotebook(schoolNotebooks?.[0] || null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error al inicializar datos del estudiante:", error);
        showFeedback('warning', 'Error al cargar tus cuadernos');
        setLoading(false);
      }
    };
    
    initializeStudentData();
  }, [notebooks, schoolNotebooks, notebooksLoading]);
  
  // Cuando se selecciona un cuaderno, cargar estadísticas de estudio (específicas del estudiante)
  useEffect(() => {
    const loadNotebookStats = async () => {
      if (!selectedNotebook || !auth.currentUser) return;
      
      try {
        // Para estudiantes escolares, las estadísticas se guardan con un prefijo específico
        const studentKey = `student_${auth.currentUser.uid}`;
        
        // Verificar si hay conceptos pendientes de repaso para este estudiante específico
        const reviewableCount = await studyService.getReviewableConceptsCount(
          studentKey, 
          selectedNotebook.id
        );
        
        if (reviewableCount > 0) {
          showFeedback('info', `Tienes ${reviewableCount} conceptos listos para repasar hoy`);
        }
        
        // Guardar último cuaderno usado (específico del estudiante)
        const lastNotebookKey = `student_${auth.currentUser.uid}_lastStudyNotebookId`;
        localStorage.setItem(lastNotebookKey, selectedNotebook.id);
      } catch (error) {
        console.error("Error al cargar estadísticas del estudiante:", error);
      }
    };
    
    if (selectedNotebook) {
      loadNotebookStats();
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
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sessionActive, sessionTimer]);
  
  // Mostrar mensajes de feedback
  const showFeedback = (type: 'success' | 'info' | 'warning', message: string) => {
    setFeedback({
      visible: true,
      type,
      message
    });
    
    setTimeout(() => {
      setFeedback(prev => ({ ...prev, visible: false }));
    }, 2000);
  };
  
  // Iniciar nueva sesión de estudio (adaptado para estudiantes escolares)
  const startStudySession = async (mode?: StudyMode) => {
    if (!auth.currentUser || !selectedNotebook) {
      showFeedback('warning', 'Por favor selecciona un cuaderno para estudiar');
      return;
    }
    
    const sessionMode = mode || studyMode;
    
    // Mostrar pantalla de introducción según el modo
    if (sessionMode === StudyMode.SMART) {
      setShowSmartStudyIntro(true);
      setPendingStudyMode(sessionMode);
      return;
    } else if (sessionMode === StudyMode.QUIZ) {
      setShowQuizIntro(true);
      setPendingStudyMode(sessionMode);
      return;
    } else if (sessionMode === StudyMode.FREE) {
      setShowFreeStudyIntro(true);
      setPendingStudyMode(sessionMode);
      return;
    }
  };

  // Función para iniciar la sesión después de la introducción (adaptado para estudiantes)
  const beginStudySession = async () => {
    if (!pendingStudyMode) return;
    
    setShowSmartStudyIntro(false);
    setShowQuizIntro(false);
    setShowFreeStudyIntro(false);
    
    const sessionMode = pendingStudyMode;
    setPendingStudyMode(null);
    setStudyMode(sessionMode);
    
    // Si el modo seleccionado es QUIZ, redirigir al QuizModePage con datos del estudiante
    if (sessionMode === StudyMode.QUIZ) {
      navigate('/quiz', { 
        state: { 
          notebookId: selectedNotebook!.id,
          notebookTitle: selectedNotebook!.title,
          isSchoolStudent: true
        } 
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Para estudiantes escolares, usar un identificador específico del estudiante
      const studentKey = `student_${auth.currentUser!.uid}`;
      
      // Crear nueva sesión en Firestore (con identificador de estudiante)
      const session = await studyService.createStudySession(
        studentKey, 
        selectedNotebook!.id,
        sessionMode
      );
      
      setSessionId(session.id);
      
      // Cargar conceptos según el modo seleccionado (desde schoolNotebooks)
      let concepts: Concept[];
      
      if (sessionMode === StudyMode.SMART) {
        // Obtener conceptos listos para repaso inteligente (específicos del estudiante)
        concepts = await studyService.getReviewableConcepts(
          studentKey, 
          selectedNotebook!.id
        );
        
        console.log('🎯 ESTUDIO INTELIGENTE ESCOLAR - Conceptos listos para repaso:', concepts.length);
        
        if (concepts.length === 0) {
          showFeedback('info', 'No tienes conceptos listos para repaso hoy según tu progreso individual. ¡Excelente trabajo!');
          setLoading(false);
          return;
        }
      } else {
        // ESTUDIO LIBRE: obtener TODOS los conceptos del schoolNotebook
        concepts = await studyService.getAllConceptsFromNotebook(
          studentKey, 
          selectedNotebook!.id
        );
        
        console.log('📚 ESTUDIO LIBRE ESCOLAR - Todos los conceptos del cuaderno:', concepts.length);
        
        if (concepts.length === 0) {
          showFeedback('warning', 'No hay conceptos en este cuaderno escolar');
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
      console.error("Error al iniciar sesión de estudiante:", error);
      
      if (error.message === 'Ya has usado tu sesión de estudio libre hoy') {
        showFeedback('warning', 'Ya has usado tu sesión de estudio libre hoy. El estudio libre está disponible una vez al día.');
        setLoading(false);
        return;
      } else {
        showFeedback('warning', 'Error al iniciar la sesión de estudio. Por favor, intenta de nuevo.');
      }
      
      setLoading(false);
    }
  };
  
  // Manejar respuesta del estudiante a un concepto (con almacenamiento local por estudiante)
  const handleConceptResponse = async (conceptId: string, quality: ResponseQuality) => {
    if (!auth.currentUser || !sessionId) return;
    
    console.log('🎓 handleConceptResponse del estudiante:', { conceptId, quality });
    
    try {
      // Para estudiantes escolares, usar identificador específico
      const studentKey = `student_${auth.currentUser.uid}`;
      
      // Actualizar respuesta usando SM-3 con datos específicos del estudiante
      await studyService.updateConceptResponse(
        studentKey,
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
      
      // Calcular conceptos restantes ANTES de remover el actual
      const remainingConceptsAfterRemoval = currentConcepts.filter(c => c.id !== conceptId);
      console.log('📊 Conceptos restantes después de remover actual:', remainingConceptsAfterRemoval.length);
      
      // Remover concepto de la cola actual
      setCurrentConcepts(remainingConceptsAfterRemoval);
      
      // LÓGICA DE REPASO INMEDIATO
      let newReviewQueue = [...sessionReviewQueue];
      
      if (quality === ResponseQuality.REVIEW_LATER && currentConcept) {
        newReviewQueue = [...sessionReviewQueue, currentConcept];
        console.log('🔄 Concepto agregado a cola de repaso inmediato:', currentConcept.término);
        showFeedback('info', `"${currentConcept.término}" se agregó a tu cola de repaso. Te lo preguntaremos de nuevo.`);
      } else if (quality === ResponseQuality.MASTERED && currentConcept) {
        const wasInReviewQueue = sessionReviewQueue.some(c => c.id === conceptId);
        if (wasInReviewQueue) {
          newReviewQueue = sessionReviewQueue.filter(c => c.id !== conceptId);
          console.log('✅ Concepto eliminado de cola de repaso (dominado):', currentConcept.término);
          showFeedback('success', `¡Excelente! Dominaste "${currentConcept.término}" y lo eliminamos de tu cola de repaso.`);
        }
      }
      
      // Actualizar la cola de repaso
      setSessionReviewQueue(newReviewQueue);
      
      // Verificar si es el último concepto
      if (remainingConceptsAfterRemoval.length === 0) {
        console.log('🔍 No quedan conceptos en la ronda principal');
        
        if (newReviewQueue.length > 0) {
          console.log('🔄 Continuando con conceptos de repaso inmediato...');
          continueWithImmediateReview(newReviewQueue);
        } else {
          console.log('✅ No hay conceptos en cola de repaso, completando sesión...');
          await completeStudySession();
        }
      } else {
        console.log('⏭️ Aún quedan conceptos en la ronda actual, continuando...');
      }
      
    } catch (error) {
      console.error("Error al procesar respuesta del estudiante:", error);
      showFeedback('warning', 'Error al guardar tu respuesta');
    }
  };
  
  // Continuar con conceptos de repaso inmediato
  const continueWithImmediateReview = async (queue: Concept[]) => {
    console.log('🔄 Iniciando repaso inmediato con', queue.length, 'conceptos');
    setCurrentConcepts([...queue]);
    setSessionReviewQueue([]);
    showFeedback('info', `Iniciando repaso inmediato de ${queue.length} conceptos que necesitas repasar`);
  };
  
  // Completar sesión de estudio
  const completeStudySession = async () => {
    console.log('✅ Completando sesión de estudio del estudiante');
    
    if (!sessionId || !auth.currentUser) return;
    
    try {
      const studentKey = `student_${auth.currentUser.uid}`;
      
      // Finalizar sesión con identificador específico del estudiante
      await studyService.completeStudySession(
        sessionId,
        metrics
      );
      
      setSessionActive(false);
      setSessionComplete(true);
      
      // Mostrar confetti de celebración
      setTimeout(() => {
        setSessionComplete(false);
      }, 5000);
      
      // Si es estudio inteligente, mostrar Mini Quiz
      if (studyMode === StudyMode.SMART && !studySessionValidated) {
        setTimeout(() => {
          setShowMiniQuiz(true);
        }, 2000);
      }
      
      showFeedback('success', '¡Sesión de estudio completada exitosamente!');
    } catch (error) {
      console.error("Error al completar sesión del estudiante:", error);
      showFeedback('warning', 'Error al finalizar la sesión');
    }
  };

  // Resto de funciones auxiliares (similares a StudyModePage pero adaptadas para estudiantes)
  
  const handleMiniQuizComplete = async (passed: boolean, score: number) => {
    setMiniQuizPassed(passed);
    setMiniQuizScore(score);
    setShowMiniQuiz(false);
    
    if (passed) {
      setStudySessionValidated(true);
      showFeedback('success', `¡Excelente! Aprobaste el Mini Quiz con ${score}/10. Tu sesión de estudio inteligente ha sido validada.`);
    } else {
      showFeedback('warning', `Obtuviste ${score}/10 en el Mini Quiz. Tu progreso se guardó, pero te recomendamos repasar más conceptos.`);
    }
  };

  const startNewSession = () => {
    setSessionActive(false);
    setSessionComplete(false);
    setCurrentConcepts([]);
    setAllConcepts([]);
    setSessionId(null);
    setSessionTimer(null);
    setShowMiniQuiz(false);
    setMiniQuizPassed(false);
    setStudySessionValidated(false);
    
    setMetrics({
      totalConcepts: 0,
      conceptsReviewed: 0,
      mastered: 0,
      reviewing: 0,
      timeSpent: 0,
      startTime: new Date()
    });
  };

  const formatStudyTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleModeChange = (mode: StudyMode) => {
    setStudyMode(mode);
  };

  const handleSelectNotebook = (notebook: any) => {
    const schoolNotebook = schoolNotebooks?.find(n => n.id === notebook.id);
    if (schoolNotebook) {
      setSelectedNotebook(schoolNotebook);
    }
  };

  // Estados para controlar el tamaño de la ventana (para confetti)
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Renderizado de pantallas de introducción (adaptadas para estudiantes)
  const renderSmartStudyIntro = () => (
    <div className="intro-overlay">
      <div className="intro-modal">
        <div className="intro-header">
          <h2>🎯 Estudio Inteligente Escolar</h2>
        </div>
        <div className="intro-content">
          <div className="intro-description">
            <p>El <strong>Estudio Inteligente</strong> utiliza un algoritmo de repaso espaciado para optimizar tu aprendizaje:</p>
            <ul>
              <li>📅 Solo muestra conceptos que necesitas repasar hoy</li>
              <li>🧠 Se adapta a tu ritmo de aprendizaje individual</li>
              <li>⚡ Maximiza la retención a largo plazo</li>
              <li>📊 Tu progreso se guarda independientemente de otros estudiantes</li>
            </ul>
            <div className="intro-highlight">
              <p><strong>Como estudiante escolar:</strong> Tu progreso es individual y privado, aunque compartas cuadernos con otros estudiantes.</p>
            </div>
          </div>
        </div>
        <div className="intro-footer">
          <button 
            className="btn-secondary" 
            onClick={() => {
              setShowSmartStudyIntro(false);
              setPendingStudyMode(null);
            }}
          >
            Cancelar
          </button>
          <button 
            className="btn-primary" 
            onClick={beginStudySession}
          >
            Comenzar Estudio Inteligente
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuizIntro = () => (
    <div className="intro-overlay">
      <div className="intro-modal">
        <div className="intro-header">
          <h2>🏆 Quiz Escolar</h2>
        </div>
        <div className="intro-content">
          <div className="intro-description">
            <p>El <strong>Quiz Escolar</strong> te permite evaluarte con los conceptos de tu cuaderno:</p>
            <ul>
              <li>❓ 20 preguntas aleatorias del cuaderno</li>
              <li>⏱️ 10 minutos para completarlo</li>
              <li>🎯 Puntuación basada en precisión y tiempo</li>
              <li>📈 Tu puntuación es individual y privada</li>
            </ul>
            <div className="intro-highlight">
              <p><strong>Nota:</strong> Aunque compartas cuadernos con otros estudiantes, tus resultados del quiz son únicamente tuyos.</p>
            </div>
          </div>
        </div>
        <div className="intro-footer">
          <button 
            className="btn-secondary" 
            onClick={() => {
              setShowQuizIntro(false);
              setPendingStudyMode(null);
            }}
          >
            Cancelar
          </button>
          <button 
            className="btn-primary" 
            onClick={beginStudySession}
          >
            Comenzar Quiz
          </button>
        </div>
      </div>
    </div>
  );

  const renderFreeStudyIntro = () => (
    <div className="intro-overlay">
      <div className="intro-modal">
        <div className="intro-header">
          <h2>📚 Estudio Libre Escolar</h2>
        </div>
        <div className="intro-content">
          <div className="intro-description">
            <p>El <strong>Estudio Libre</strong> te permite repasar todos los conceptos del cuaderno escolar:</p>
            <ul>
              <li>📖 Repasa todos los conceptos disponibles</li>
              <li>🔄 Orden aleatorio para mejor memorización</li>
              <li>⏰ Sin límite de tiempo</li>
              <li>💾 Tu progreso se guarda individualmente</li>
            </ul>
            <div className="intro-highlight">
              <p><strong>Límite:</strong> Una sesión de estudio libre por día para mantener un aprendizaje efectivo.</p>
            </div>
          </div>
        </div>
        <div className="intro-footer">
          <button 
            className="btn-secondary" 
            onClick={() => {
              setShowFreeStudyIntro(false);
              setPendingStudyMode(null);
            }}
          >
            Cancelar
          </button>
          <button 
            className="btn-primary" 
            onClick={beginStudySession}
          >
            Comenzar Estudio Libre
          </button>
        </div>
      </div>
    </div>
  );

  // Estados de carga
  if (loading || notebooksLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando tu área de estudio...</p>
      </div>
    );
  }

  // Si el estudiante no tiene cuadernos asignados
  if (!schoolNotebooks || schoolNotebooks.length === 0) {
    return (
      <>
        <HeaderWithHamburger
          title="Área del Estudiante"
          subtitle="Estudio Escolar"
        />
        <div className="empty-state-container">
          <div className="empty-state">
            <h2>📚 No tienes cuadernos asignados</h2>
            <p>Contacta a tu profesor o administrador para que te asignen cuadernos de estudio.</p>
          </div>
        </div>
      </>
    );
  }

  // Renderizado principal
  return (
    <>
      <HeaderWithHamburger
        title="Área del Estudiante"
        subtitle={`${selectedNotebook ? selectedNotebook.title : 'Selecciona un cuaderno'}`}
      />
      
      {sessionComplete && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
        />
      )}

      <main className="study-mode-container">
        {!sessionActive ? (
                   <div className="study-dashboard-container">
           <div className="notebook-selector">
             <h3>Selecciona un cuaderno:</h3>
             {notebooks.map(notebook => (
               <div 
                 key={notebook.id}
                 className={`notebook-item ${selectedNotebook?.id === notebook.id ? 'selected' : ''}`}
                 onClick={() => handleSelectNotebook(notebook)}
                 style={{ borderLeft: `4px solid ${notebook.color}` }}
               >
                 <h4>{notebook.title}</h4>
               </div>
             ))}
           </div>
           
           {selectedNotebook && (
             <div className="study-mode-selector">
               <h3>Modo de Estudio:</h3>
               <div className="mode-buttons">
                 <button 
                   className={`mode-btn ${studyMode === StudyMode.SMART ? 'active' : ''}`}
                   onClick={() => handleModeChange(StudyMode.SMART)}
                 >
                   🎯 Estudio Inteligente
                 </button>
                 <button 
                   className={`mode-btn ${studyMode === StudyMode.FREE ? 'active' : ''}`}
                   onClick={() => handleModeChange(StudyMode.FREE)}
                 >
                   📚 Estudio Libre
                 </button>
                 <button 
                   className={`mode-btn ${studyMode === StudyMode.QUIZ ? 'active' : ''}`}
                   onClick={() => handleModeChange(StudyMode.QUIZ)}
                 >
                   🏆 Quiz
                 </button>
               </div>
               
               <button 
                 className="start-session-btn"
                 onClick={() => startStudySession(studyMode)}
               >
                 Comenzar {studyMode === StudyMode.SMART ? 'Estudio Inteligente' : 
                           studyMode === StudyMode.FREE ? 'Estudio Libre' : 'Quiz'}
               </button>
             </div>
           )}
         </div>
        ) : (
          <div className="study-session-container">
            <div className="study-session-header">
              <div className="session-info">
                <h2>
                  {studyMode === StudyMode.SMART ? '🎯 Estudio Inteligente' : '📚 Estudio Libre'}
                </h2>
                <p>
                  {selectedNotebook?.title} • 
                  Progreso: {metrics.conceptsReviewed}/{metrics.totalConcepts} • 
                  Tiempo: {formatStudyTime(metrics.timeSpent)}
                </p>
              </div>
              <div className="session-stats">
                <div className="stat">
                  <span className="stat-value">{masteredConceptIds.size}</span>
                  <span className="stat-label">Dominados</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{reviewingConceptIds.size}</span>
                  <span className="stat-label">Repasando</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{sessionReviewQueue.length}</span>
                  <span className="stat-label">En Cola</span>
                </div>
              </div>
            </div>

                         {currentConcepts.length > 0 && (
               <SwipeableStudyCard
                 concept={currentConcepts[0]}
                 onResponse={(quality) => handleConceptResponse(currentConcepts[0].id, quality)}
                 reviewMode={studyMode === StudyMode.SMART}
                 quizMode={studyMode === StudyMode.QUIZ}
               />
             )}
          </div>
        )}

                 {/* Feedback message */}
         {feedback.visible && (
           <FeedbackMessage
             message={feedback.message}
             type={feedback.type}
           />
         )}

                 {/* Mini Quiz Modal */}
         {showMiniQuiz && selectedNotebook && (
           <MiniQuiz
             notebookId={selectedNotebook.id}
             notebookTitle={selectedNotebook.title}
             onComplete={handleMiniQuizComplete}
             onClose={() => setShowMiniQuiz(false)}
           />
         )}

        {/* Pantallas de introducción */}
        {showSmartStudyIntro && renderSmartStudyIntro()}
        {showQuizIntro && renderQuizIntro()}
        {showFreeStudyIntro && renderFreeStudyIntro()}

        {/* Botón de nueva sesión si la sesión está completa */}
        {sessionComplete && (
          <div className="session-complete-overlay">
            <div className="session-complete-modal">
              <h2>🎉 ¡Sesión Completada!</h2>
              <div className="completion-stats">
                <div className="stat-item">
                  <span className="stat-number">{metrics.conceptsReviewed}</span>
                  <span className="stat-text">Conceptos Revisados</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{masteredConceptIds.size}</span>
                  <span className="stat-text">Dominados</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{formatStudyTime(metrics.timeSpent)}</span>
                  <span className="stat-text">Tiempo Total</span>
                </div>
              </div>
              
              <div className="completion-actions">
                <button
                  className="btn-primary"
                  onClick={startNewSession}
                >
                  Nueva Sesión
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default SchoolStudentStudyPage; 