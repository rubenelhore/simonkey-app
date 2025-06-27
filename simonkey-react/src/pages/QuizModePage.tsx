import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { 
  Concept, 
  Notebook, 
  QuizQuestion, 
  QuizOption, 
  QuizResponse, 
  QuizSession,
  QuizStats,
  QuizTimerState,
  QuizTimerConfig
} from '../types/interfaces';
import { useQuizTimer } from '../hooks/useQuizTimer';
import { 
  calculateFinalQuizScore,
  formatTime,
  getTimerStateClass,
  getTimerColor
} from '../utils/quizTimer';
import { useUserType } from '../hooks/useUserType';
import '../styles/QuizModePage.css';

const QuizModePage: React.FC = () => {
  console.log('[QuizModePage] Component rendering at', new Date().toISOString());
  const navigate = useNavigate();
  const location = useLocation();
  const { isSchoolStudent } = useUserType();
  console.log('[QuizModePage] Location state:', location.state);
  console.log('[QuizModePage] isSchoolStudent:', isSchoolStudent);
  
  // Estado principal
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [quizAvailable, setQuizAvailable] = useState<boolean>(true);
  const [quizLimitMessage, setQuizLimitMessage] = useState<string>('');
  const [autoStartAttempted, setAutoStartAttempted] = useState<boolean>(false);
  const [notebooksLoaded, setNotebooksLoaded] = useState<boolean>(false);
  const [isAutoStarting, setIsAutoStarting] = useState<boolean>(false);
  
  // Estado de la sesión de quiz
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [sessionComplete, setSessionComplete] = useState<boolean>(false);
  
  // Estado del timer y puntuación
  const [score, setScore] = useState<number>(0);
  const [maxScore, setMaxScore] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(600);
  const [finalScore, setFinalScore] = useState<number>(0);
  
  // Estado de UI
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  const [showQuizIntro, setShowQuizIntro] = useState<boolean>(false);

  // Configuración del timer
  const timerConfig: QuizTimerConfig = {
    totalTime: 600,
    warningThreshold: 60,
    criticalThreshold: 30,
    autoSubmit: true
  };

  // Hook del timer
  const {
    timerState,
    timeRemaining: timerTimeRemaining,
    isRunning,
    isWarning,
    isCritical,
    isTimeUp,
    start,
    stop,
    reset,
    formattedTime,
    timerClass,
    timerColor,
    progress
  } = useQuizTimer({
    config: timerConfig,
    onTimeUp: () => {
      console.log('[DEBUG] onTimeUp callback fired!');
      handleTimeUp();
    },
    onWarning: () => console.log('¡Advertencia! Menos de 1 minuto'),
    onCritical: () => console.log('¡Crítico! Menos de 30 segundos')
  });

  const quizEndedByTimeRef = useRef(false);

  // Manejar tiempo agotado
  function handleTimeUp() {
    console.log('[DEBUG] handleTimeUp called. sessionActive:', sessionActive, 'sessionComplete:', sessionComplete);
    if (!sessionComplete && !quizEndedByTimeRef.current) {
      quizEndedByTimeRef.current = true;
      console.log('[DEBUG] Completing quiz session due to time up (forced, only once)!');
      setSessionActive(false);
      setSessionComplete(true);
      stop();
      completeQuizSession(score, 0);
    }
  }

  // Cargar cuadernos al montar el componente
  useEffect(() => {
    console.log('[QuizModePage] useEffect - fetchNotebooks');
    fetchNotebooks();
  }, [isSchoolStudent]); // Re-cargar si cambia el tipo de usuario

  // Pre-seleccionar cuaderno si viene de StudyModePage e iniciar quiz automáticamente
  useEffect(() => {
    console.log('useEffect ejecutado:', { 
      hasLocationState: !!location.state, 
      notebookId: location.state?.notebookId, 
      notebooksLength: notebooks.length,
      notebooksLoaded,
      autoStartAttempted
    });
    
    // Si no hay estado de navegación, redirigir a study
    if (notebooksLoaded && !location.state?.notebookId) {
      console.log('No hay notebook seleccionado, redirigiendo a /study');
      navigate('/study');
      return;
    }
    
    if (location.state && location.state.notebookId && notebooksLoaded && !autoStartAttempted) {
      console.log('[QuizModePage] Cuadernos disponibles:', notebooks.map(n => ({ id: n.id, title: n.title })));
      const notebook = notebooks.find(n => n.id === location.state.notebookId);
      console.log('[QuizModePage] Buscando cuaderno:', location.state.notebookId, 'Encontrado:', !!notebook);
      
      if (notebook) {
        console.log('Cuaderno encontrado, iniciando quiz automáticamente:', notebook.title);
        setSelectedNotebook(notebook);
        setAutoStartAttempted(true);
        setIsAutoStarting(true);
        
        // Si viene del dashboard, asumir que está disponible (ya fue verificado)
        const startQuizAutomatically = async () => {
          try {
            console.log('Iniciando sesión automáticamente desde dashboard...');
            // Pasar el notebook directamente para evitar problemas de timing
            await startQuizSessionWithNotebook(notebook, true, location.state?.skipIntro || false);
            console.log('Sesión iniciada exitosamente');
          } catch (error) {
            console.error('Error al iniciar sesión automáticamente:', error);
            setIsAutoStarting(false);
            // Si hay error, redirigir a study
            navigate('/study');
          }
        };
        
        startQuizAutomatically();
      } else {
        console.log('Notebook no encontrado, redirigiendo a /study');
        navigate('/study');
      }
    }
  }, [location.state, notebooks, notebooksLoaded, navigate]);

  // Verificar disponibilidad del quiz (máximo 1 por semana POR CUADERNO)
  const checkQuizAvailabilitySync = async (notebookId: string): Promise<boolean> => {
    console.log('🔍 checkQuizAvailabilitySync llamado para cuaderno:', notebookId);
    
    if (!auth.currentUser) {
      console.log('❌ No hay usuario autenticado');
      return false;
    }

    try {
      // Verificar límites de quiz para este cuaderno específico
      console.log('🔍 Verificando límites de quiz para cuaderno:', notebookId);
      // CORRECCIÓN: Usar un solo documento con campos separados
      const notebookLimitsRef = doc(db, 'users', auth.currentUser.uid, 'notebookLimits', notebookId);
      const notebookLimitsDoc = await getDoc(notebookLimitsRef);
      
      console.log('🔍 Documento de límites del cuaderno existe:', notebookLimitsDoc.exists());
      
      if (notebookLimitsDoc.exists()) {
        const limits = notebookLimitsDoc.data();
        const lastQuizDate = limits.lastQuizDate?.toDate();
        
        console.log('🔍 Límites del cuaderno encontrados:', limits);
        console.log('🔍 Última fecha de quiz del cuaderno:', lastQuizDate);
        
        if (lastQuizDate) {
          // Aplicar límite de 7 días para este cuaderno específico
          const now = new Date();
          const daysSinceLastQuiz = Math.floor((now.getTime() - lastQuizDate.getTime()) / (1000 * 60 * 60 * 24));
          console.log('🔍 Cálculo de días desde último quiz del cuaderno:', {
            now: now.toISOString(),
            lastQuizDate: lastQuizDate.toISOString(),
            daysSinceLastQuiz: daysSinceLastQuiz,
            shouldBeAvailable: daysSinceLastQuiz >= 7
          });
          
          if (daysSinceLastQuiz < 7) {
            const daysRemaining = 7 - daysSinceLastQuiz;
            const message = `Puedes hacer otro quiz de este cuaderno en ${daysRemaining} día${daysRemaining > 1 ? 's' : ''}`;
            setQuizLimitMessage(message);
            console.log('❌ Quiz no disponible para este cuaderno, días restantes:', daysRemaining);
            setQuizAvailable(false);
            return false;
          } else {
            setQuizLimitMessage('');
            console.log('✅ Quiz disponible para este cuaderno (pasó más de 7 días)');
            setQuizAvailable(true);
            return true;
          }
        }
      }
      
      // Si no hay límites previos o no se ha usado el quiz en este cuaderno, permitir quiz (primer uso)
      setQuizLimitMessage('');
      console.log('✅ Quiz disponible para este cuaderno (primer uso)');
      setQuizAvailable(true);
      return true;
      
    } catch (error) {
      console.error('❌ Error checking quiz availability:', error);
      setQuizLimitMessage('Error verificando disponibilidad del quiz');
      console.log('❌ Error en verificación, asumiendo no disponible');
      setQuizAvailable(false);
      return false;
    }
  };

  // Verificar disponibilidad del quiz (máximo 1 por semana) - versión para estado
  const checkQuizAvailability = async (notebookId: string) => {
    await checkQuizAvailabilitySync(notebookId);
  };

  // Cargar cuadernos del usuario
  const fetchNotebooks = async () => {
    console.log('[QuizModePage] fetchNotebooks called, isSchoolStudent:', isSchoolStudent);
    if (!auth.currentUser) {
      console.log('[QuizModePage] No current user, navigating to login');
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      let notebooksData: Notebook[] = [];
      
      if (isSchoolStudent) {
        // Para estudiantes escolares, buscar en schoolNotebooks
        console.log('[QuizModePage] Buscando cuadernos escolares...');
        
        // Primero obtener los IDs de cuadernos del estudiante
        const studentDoc = await getDoc(doc(db, 'schoolStudents', auth.currentUser.uid));
        if (studentDoc.exists()) {
          const studentData = studentDoc.data();
          const notebookIds = studentData.idCuadernos || [];
          console.log('[QuizModePage] IDs de cuadernos del estudiante:', notebookIds);
          
          // Luego obtener cada cuaderno
          for (const notebookId of notebookIds) {
            const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
            if (notebookDoc.exists()) {
              notebooksData.push({
                id: notebookDoc.id,
                ...notebookDoc.data()
              } as Notebook);
            }
          }
          console.log('[QuizModePage] Cuadernos escolares encontrados:', notebooksData.length);
        }
      } else {
        // Para usuarios regulares, buscar en notebooks
        console.log('[QuizModePage] Buscando cuadernos regulares...');
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const querySnapshot = await getDocs(notebooksQuery);
        querySnapshot.forEach((doc) => {
          notebooksData.push({
            id: doc.id,
            ...doc.data()
          } as Notebook);
        });
        console.log('[QuizModePage] Cuadernos regulares encontrados:', notebooksData.length);
      }
      
      setNotebooks(notebooksData);
      setNotebooksLoaded(true);
    } catch (error) {
      console.error('Error fetching notebooks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generar preguntas de quiz
  const generateQuizQuestions = useCallback(async (notebookId: string): Promise<QuizQuestion[]> => {
    try {
      if (!auth.currentUser) {
        throw new Error('Usuario no autenticado');
      }

      // Determinar la colección de conceptos según el tipo de usuario
      const conceptsCollection = isSchoolStudent ? 'schoolConcepts' : 'conceptos';
      console.log('[QuizModePage] Buscando conceptos en colección:', conceptsCollection);
      
      // Obtener conceptos del cuaderno usando una consulta filtrada por cuaderno
      const conceptsQuery = query(
        collection(db, conceptsCollection),
        where('cuadernoId', '==', notebookId)
      );
      
      const conceptDocs = await getDocs(conceptsQuery);
      const allConcepts: Concept[] = [];
      
      // Procesar los documentos de conceptos
      for (const doc of conceptDocs.docs) {
        const conceptosData = doc.data().conceptos || [];
        conceptosData.forEach((concepto: any, index: number) => {
          allConcepts.push({
            id: `${doc.id}-${index}`,
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
      
      console.log('[QuizModePage] Total conceptos encontrados:', allConcepts.length);

      if (allConcepts.length < 4) {
        throw new Error('Se necesitan al menos 4 conceptos para generar el quiz');
      }

      // Seleccionar 10 conceptos aleatorios para el quiz (o todos si hay menos de 10)
      const maxQuestions = Math.min(10, allConcepts.length);
      const shuffledConcepts = allConcepts.sort(() => 0.5 - Math.random());
      const selectedConcepts = shuffledConcepts.slice(0, maxQuestions);

      // Generar preguntas
      const quizQuestions: QuizQuestion[] = selectedConcepts.map((concept, index) => {
        // Seleccionar 3 distractores aleatorios
        const otherConcepts = allConcepts.filter(c => c.id !== concept.id);
        const distractors = otherConcepts
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        // Crear opciones
        const options: QuizOption[] = [
          {
            id: `option-${index}-correct`,
            term: concept.término,
            isCorrect: true,
            conceptId: concept.id
          },
          ...distractors.map((distractor, distractorIndex) => ({
            id: `option-${index}-${distractorIndex}`,
            term: distractor.término,
            isCorrect: false,
            conceptId: distractor.id
          }))
        ];

        // Mezclar las opciones aleatoriamente
        const shuffledOptions = options.sort(() => 0.5 - Math.random());

        return {
          id: `question-${index}`,
          definition: concept.definición,
          correctAnswer: concept,
          options: shuffledOptions,
          source: concept.fuente
        };
      });

      return quizQuestions;
    } catch (error) {
      console.error('Error generating quiz questions:', error);
      throw error;
    }
  }, [isSchoolStudent]);

  // Función eliminada - ya no se necesita selección manual de notebooks
  // El quiz siempre viene con un notebook pre-seleccionado desde StudyModePage

  const startQuizSessionWithNotebook = async (notebook: Notebook, skipAvailabilityCheck: boolean = false, skipIntro: boolean = false) => {
    console.log('startQuizSessionWithNotebook llamado:', { 
      notebook: notebook.title, 
      quizAvailable, 
      skipAvailabilityCheck,
      skipIntro
    });
    
    // Si se salta la verificación de disponibilidad, asumir que está disponible
    if (skipAvailabilityCheck) {
      console.log('Saltando verificación de disponibilidad, asumiendo disponible');
      setQuizAvailable(true);
      setQuizLimitMessage('');
    } else {
      // Verificar disponibilidad del quiz de forma síncrona
      console.log('Verificando disponibilidad de forma síncrona...');
      const isAvailable = await checkQuizAvailabilitySync(notebook.id);
      if (!isAvailable) {
        console.error('Quiz no disponible después de verificación síncrona');
        return;
      }
    }

    // Si skipIntro es true, iniciar directamente el quiz
    if (skipIntro) {
      console.log('Saltando introducción, iniciando quiz directamente');
      // Establecer el notebook seleccionado
      setSelectedNotebook(notebook);
      // Iniciar el quiz directamente pasando el notebook
      beginQuizSession(notebook);
    } else {
      // Mostrar pantalla de introducción
      setShowQuizIntro(true);
    }
  };

  // Función para iniciar el quiz después de la introducción
  const beginQuizSession = async (notebookToUse?: Notebook) => {
    const notebook = notebookToUse || selectedNotebook;
    if (!notebook) {
      console.error('No hay cuaderno disponible para iniciar el quiz');
      return;
    }
    
    setShowQuizIntro(false);
    
    try {
      console.log('Iniciando sesión de quiz...');
      setLoading(true);
      
      console.log('Generando preguntas...');
      // Generar preguntas
      const quizQuestions = await generateQuizQuestions(notebook.id);
      console.log('Preguntas generadas:', quizQuestions.length);
      
      if (quizQuestions.length === 0) {
        console.error('No se pudieron generar preguntas');
        setLoading(false);
        return;
      }
      
      setQuestions(quizQuestions);
      setMaxScore(quizQuestions.length);
      
      // Inicializar sesión
      const session: QuizSession = {
        id: `quiz-${Date.now()}`,
        userId: auth.currentUser!.uid,
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        questions: quizQuestions,
        responses: [],
        startTime: new Date(),
        score: 0,
        maxScore: quizQuestions.length,
        accuracy: 0,
        timeBonus: 0,
        finalScore: 0
      };
      
      console.log('Sesión creada:', session.id);
      setQuizSession(session);
      setCurrentQuestionIndex(0);
      setResponses([]);
      setScore(0);
      setSessionActive(true);
      setSessionComplete(false);
      setIsAutoStarting(false); // Quiz iniciado, ocultar loading
      console.log('Quiz session initialized - sessionActive:', true, 'sessionComplete:', false);
      
      // Iniciar timer
      start();
      
      console.log('Sesión iniciada correctamente');
      setLoading(false);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setLoading(false);
      setIsAutoStarting(false); // Error al iniciar, ocultar loading
    }
  };

  // Manejar respuesta del usuario
  const handleAnswerSelection = (optionId: string) => {
    if (!sessionActive || selectedOption) return;

    setSelectedOption(optionId);
    
    const currentQuestion = questions[currentQuestionIndex];
    const selectedOptionData = currentQuestion.options.find(opt => opt.id === optionId);
    const correctOption = currentQuestion.options.find(opt => opt.isCorrect);
    
    if (!selectedOptionData || !correctOption) return;

    const isCorrect = selectedOptionData.isCorrect;
    const response: QuizResponse = {
      questionId: currentQuestion.id,
      selectedOptionId: optionId,
      correctOptionId: correctOption.id,
      isCorrect,
      timeSpent: 0, // Calcularemos el tiempo real después
      timestamp: new Date()
    };

    setResponses(prev => [...prev, response]);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      setFeedbackMessage('¡Correcto! 🎉');
      setFeedbackType('success');
    } else {
      setFeedbackMessage(`Incorrecto. La respuesta correcta era: ${correctOption.term}`);
      setFeedbackType('error');
    }

    setShowFeedback(true);

    // Avanzar a la siguiente pregunta después de 2 segundos
    setTimeout(() => {
      setShowFeedback(false);
      setSelectedOption(null);
      
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // Quiz completado
        const finalTimeRemaining = timerTimeRemaining;
        const finalScoreResult = calculateFinalQuizScore(score + (isCorrect ? 1 : 0), questions.length, finalTimeRemaining);
        completeQuizSession(finalScoreResult.finalScore, finalTimeRemaining);
      }
    }, 2000);
  };

  // Completar sesión de quiz
  const completeQuizSession = async (finalScoreValue: number, timeRemainingValue: number) => {
    console.log('INICIANDO completeQuizSession:', {
      finalScoreValue,
      timeRemainingValue,
      quizSessionExists: !!quizSession
    });
    
    if (!quizSession || !auth.currentUser) return;

    try {
      setSessionActive(false);
      setSessionComplete(true);
      stop();
      
      const correctAnswers = responses.filter(r => r.isCorrect).length;
      const accuracy = (correctAnswers / questions.length) * 100;
      
      const finalScoreResult = calculateFinalQuizScore(correctAnswers, questions.length, timeRemainingValue);
      
      console.log('🎯 CÁLCULO DEL SCORE FINAL:', {
        correctAnswers,
        totalQuestions: questions.length,
        timeRemaining: timeRemainingValue,
        finalScoreResult,
        formula: `Math.max(${correctAnswers}, ${correctAnswers} × ${timeRemainingValue}) = ${finalScoreResult.finalScore}`
      });
      
      // Actualizar sesión con resultados finales
      const completedSession: QuizSession = {
        ...quizSession,
        endTime: new Date(),
        totalTime: 600 - timeRemainingValue,
        timeRemaining: timeRemainingValue,
        score: correctAnswers,
        accuracy,
        timeBonus: finalScoreResult.timeBonus,
        finalScore: finalScoreResult.finalScore
      };
      
      setQuizSession(completedSession);
      setFinalScore(finalScoreResult.finalScore);
      
      // Guardar resultados en Firestore
      await saveQuizResults(completedSession);
      
      // IMPORTANTE: Aplicar el límite al COMPLETAR el quiz
      console.log('Aplicando límite de quiz al completar...');
      await updateQuizLimits(completedSession.notebookId);
      
      // CRÍTICO: Verificar disponibilidad después de aplicar límites
      console.log('Verificando disponibilidad después de aplicar límites...');
      await checkQuizAvailabilitySync(completedSession.notebookId);
      
      // NOTA: Los límites ya se aplicaron al iniciar el quiz, no al finalizar
      console.log('✅ Quiz completado exitosamente. Los límites fueron aplicados al completar.');
      
      console.log('✅ Quiz completado y guardado exitosamente:', {
        finalScore: finalScoreResult.finalScore,
        correctAnswers,
        notebookId: completedSession.notebookId
      });
      
    } catch (error) {
      console.error('Error completing quiz session:', error);
    }
  };

  // Guardar resultados del quiz
  const saveQuizResults = async (session: QuizSession) => {
    if (!auth.currentUser) return;

    try {
      console.log('💾 Guardando resultados del quiz:', {
        sessionId: session.id,
        notebookId: session.notebookId,
        score: session.score,
        finalScore: session.finalScore,
        accuracy: session.accuracy
      });

      // Recursive function to remove undefined values from objects
      const removeUndefinedValues = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return null;
        }
        
        if (Array.isArray(obj)) {
          return obj.map(item => removeUndefinedValues(item)).filter(item => item !== null);
        }
        
        if (typeof obj === 'object') {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              cleaned[key] = removeUndefinedValues(value);
            }
          }
          return cleaned;
        }
        
        return obj;
      };

      // Create a completely clean object with only defined values
      const cleanQuizResultData: any = {
        id: session.id,
        userId: session.userId || auth.currentUser.uid,
        notebookId: session.notebookId,
        notebookTitle: session.notebookTitle,
        questions: session.questions,
        responses: session.responses,
        startTime: Timestamp.fromDate(session.startTime),
        score: session.score,
        maxScore: session.maxScore,
        accuracy: session.accuracy,
        timeBonus: session.timeBonus,
        finalScore: session.finalScore,
        createdAt: Timestamp.now()
      };

      // Only add optional fields if they exist and are not undefined
      if (session.endTime) {
        cleanQuizResultData.endTime = Timestamp.fromDate(session.endTime);
      }
      if (session.totalTime !== undefined && session.totalTime !== null) {
        cleanQuizResultData.totalTime = session.totalTime;
      }
      if (session.timeRemaining !== undefined && session.timeRemaining !== null) {
        cleanQuizResultData.timeRemaining = session.timeRemaining;
      }
      
      // Clean all undefined values recursively
      const finalCleanData = removeUndefinedValues(cleanQuizResultData);
      
      console.log('🧹 Datos limpios para guardar:', finalCleanData);
      
      // 1. Guardar resultado del quiz
      const quizResultsRef = doc(db, 'users', auth.currentUser.uid, 'quizResults', session.id);
      
      await setDoc(quizResultsRef, finalCleanData);
      console.log('✅ Resultado del quiz guardado');

      // 2. Actualizar estadísticas del cuaderno
      const notebookStatsRef = doc(db, 'users', auth.currentUser.uid, 'quizStats', session.notebookId);
      console.log('💾 Guardando en ruta:', `users/${auth.currentUser.uid}/quizStats/${session.notebookId}`);
      const statsDoc = await getDoc(notebookStatsRef);
      
      const baseStats = {
        totalQuizzes: 1,
        totalQuestions: session.questions?.length || 0,
        correctAnswers: session.score || 0,
        maxScore: session.finalScore || 0,
        lastQuizDate: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      if (statsDoc.exists()) {
        const currentStats = statsDoc.data();
        const updatedStats = {
          ...baseStats,
          totalQuizzes: (currentStats.totalQuizzes || 0) + 1,
          totalQuestions: (currentStats.totalQuestions || 0) + (session.questions?.length || 0),
          correctAnswers: (currentStats.correctAnswers || 0) + (session.score || 0),
          maxScore: Math.max(currentStats.maxScore || 0, session.finalScore || 0)
        };
        
        console.log('🏆 ACTUALIZANDO MAX SCORE:', {
          currentMaxScore: currentStats.maxScore || 0,
          newFinalScore: session.finalScore || 0,
          newMaxScore: Math.max(currentStats.maxScore || 0, session.finalScore || 0),
          formula: `Math.max(${currentStats.maxScore || 0}, ${session.finalScore || 0}) = ${Math.max(currentStats.maxScore || 0, session.finalScore || 0)}`
        });
        
        console.log('📊 Actualizando estadísticas existentes:', {
          antes: currentStats,
          despues: updatedStats
        });
        
        await updateDoc(notebookStatsRef, updatedStats);
      } else {
        const newStats = {
          ...baseStats,
          createdAt: Timestamp.now()
        };
        console.log('📊 Creando nuevas estadísticas:', newStats);
        await setDoc(notebookStatsRef, newStats);
      }
      
      console.log('✅ Estadísticas del cuaderno actualizadas');
    } catch (error) {
      console.error('❌ Error saving quiz results:', error);
      throw error; // Re-lanzar el error para que se maneje en completeQuizSession
    }
  };

  // Actualizar límites de quiz - POR CUADERNO
  const updateQuizLimits = async (notebookId: string) => {
    if (!auth.currentUser || !notebookId) return;

    try {
      console.log('🔄 Aplicando límite de quiz para cuaderno:', notebookId);
      console.log('🔍 Usuario actual:', auth.currentUser.uid);
      console.log('🔄 Ruta de guardado:', `users/${auth.currentUser.uid}/notebookLimits/${notebookId}`);
      
      // CORRECCIÓN: Usar un solo documento con campos separados
      const notebookLimitsRef = doc(db, 'users', auth.currentUser.uid, 'notebookLimits', notebookId);
      const currentDate = new Date();
      
      console.log('🔍 Fecha actual para límite del cuaderno:', currentDate.toISOString());
      
      const newLimits = {
        userId: auth.currentUser.uid,
        notebookId: notebookId,
        lastQuizDate: currentDate,
        quizCountThisWeek: 1,
        weekStartDate: getWeekStartDate(),
        updatedAt: Timestamp.now()
      };
      
      console.log('🔍 Nuevos límites del cuaderno a guardar:', {
        ...newLimits,
        lastQuizDate: currentDate.toISOString(),
        weekStartDate: getWeekStartDate().toISOString()
      });
      
      await setDoc(notebookLimitsRef, newLimits, { merge: true });
      
      console.log('✅ ===== LÍMITE DE QUIZ APLICADO EXITOSAMENTE =====');
      console.log('✅ Cuaderno:', notebookId);
      console.log('✅ lastQuizDate:', currentDate.toISOString());
      console.log('✅ quizCountThisWeek: 1');
      console.log('✅ Ruta del documento:', `users/${auth.currentUser.uid}/notebookLimits/${notebookId}`);
      
      // VERIFICACIÓN: Leer de vuelta para confirmar que se guardó
      const verificationDoc = await getDoc(notebookLimitsRef);
      if (verificationDoc.exists()) {
        const savedData = verificationDoc.data();
        console.log('✅ VERIFICACIÓN: Datos guardados correctamente:', savedData);
      } else {
        console.error('❌ VERIFICACIÓN: Los datos NO se guardaron correctamente');
      }
      
    } catch (error) {
      console.error('❌ Error aplicando límite de quiz para cuaderno:', error);
    }
  };

  // Función temporal para resetear límites de quiz (SOLO PARA DESARROLLO) - POR CUADERNO
  const resetQuizLimits = async () => {
    if (!auth.currentUser || !selectedNotebook) return;

    try {
      console.log('🔄 Reseteando límites de quiz para cuaderno:', selectedNotebook.id);
      // CORRECCIÓN: Usar un solo documento con campos separados
      const limitsRef = doc(db, 'users', auth.currentUser.uid, 'notebookLimits', selectedNotebook.id);
      
      // Resetear límites del cuaderno específico
      await setDoc(limitsRef, {
        userId: auth.currentUser.uid,
        notebookId: selectedNotebook.id,
        lastQuizDate: null,
        quizCountThisWeek: 0,
        weekStartDate: new Date(),
        updatedAt: Timestamp.now()
      }, { merge: true });
      
      console.log('✅ Límites de quiz del cuaderno reseteados');
      setQuizAvailable(true);
      setQuizLimitMessage('');
      
      // Recargar disponibilidad
      await checkQuizAvailabilitySync(selectedNotebook.id);
    } catch (error) {
      console.error('❌ Error reseteando límites del cuaderno:', error);
    }
  };

  // Obtener fecha de inicio de la semana actual
  const getWeekStartDate = (): Date => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    return new Date(now.setDate(diff));
  };

  // Función eliminada - ya no se necesita selección manual

  // Renderizar selección de cuaderno (función obsoleta)
  const renderNotebookSelection = () => (
    <div className="quiz-notebook-selection">
      <div className="quiz-header">
        <h2>Selecciona un cuaderno para el Quiz</h2>
        <div className="quiz-subtitle">
          Elige el cuaderno que quieres evaluar
        </div>
      </div>
      
      {loading ? (
        <div className="empty-notebooks">
          <div className="empty-icon">
            <i className="fas fa-spinner fa-spin"></i>
          </div>
          <h3>Cargando cuadernos...</h3>
        </div>
      ) : notebooks.length === 0 ? (
        <div className="empty-notebooks">
          <div className="empty-icon">
            <i className="fas fa-book-open"></i>
          </div>
          <h3>No tienes cuadernos creados</h3>
          <p>Crea tu primer cuaderno para comenzar a hacer quizzes</p>
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
              {notebooks.map((notebook, index) => (
                <div
                  key={notebook.id || index}
                  className={`notebook-item ${selectedNotebook?.id === notebook.id ? 'selected' : ''}`}
                  onClick={() => setSelectedNotebook(notebook)}
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
            <div className="quiz-availability-section">
              {!quizAvailable ? (
                <div className="quiz-unavailable">
                  <div className="unavailable-icon">
                    <i className="fas fa-clock"></i>
                  </div>
                  <h3>Quiz no disponible</h3>
                  <p>{quizLimitMessage}</p>
                </div>
              ) : (
                <div className="quiz-available">
                  <div className="available-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <h3>Quiz disponible</h3>
                  <p>Puedes hacer el quiz de este cuaderno</p>
                  <button
                    className="start-quiz-button"
                    onClick={() => startQuizSessionWithNotebook(selectedNotebook)}
                  >
                    <i className="fas fa-play"></i> Iniciar Quiz
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Renderizar introducción al Quiz
  const renderQuizIntro = () => {
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
              onClick={() => setShowQuizIntro(false)}
            >
              <i className="fas fa-times"></i>
              Cancelar
            </button>
            <button
              className="action-button primary"
              onClick={() => beginQuizSession()}
            >
              <i className="fas fa-play"></i>
              Iniciar Quiz
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar pregunta actual
  const renderCurrentQuestion = () => {
    if (!questions[currentQuestionIndex]) return null;

    const question = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
      <div className="quiz-session-container">
        {/* Header con progreso y timer */}
        <div className="quiz-header">
          <div className="quiz-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-text">
              Pregunta {currentQuestionIndex + 1} de {questions.length}
            </div>
          </div>
          
          {/* Timer */}
          <div className={`quiz-timer ${timerClass}`}>
            <div className="timer-display">
              <i className="fas fa-clock"></i>
              <span className="timer-text">{formattedTime}</span>
            </div>
            <div className="timer-progress">
              <div 
                className="timer-progress-fill" 
                style={{ 
                  width: `${progress}%`,
                  backgroundColor: timerColor
                }}
              ></div>
            </div>
          </div>
          
          <div className="quiz-score">
            <span className="score-label">Puntuación:</span>
            <span className={`score-value ${score >= 0 ? 'positive' : 'negative'}`}>
              {score >= 0 ? '+' : ''}{score}
            </span>
          </div>
        </div>

        {/* Pregunta */}
        <div className="quiz-question-container">
          <div className="question-definition">
            <h3>Definición:</h3>
            <p>{question.definition}</p>
            <div className="question-source">
              <span>Fuente: {question.source}</span>
            </div>
          </div>
        </div>

        {/* Opciones de respuesta */}
        <div className="quiz-options-container">
          {question.options.map((option) => (
            <button
              key={option.id}
              className={`quiz-option ${
                selectedOption === option.id 
                  ? option.isCorrect 
                    ? 'correct' 
                    : 'incorrect'
                  : ''
              } ${selectedOption ? 'disabled' : ''}`}
              onClick={() => handleAnswerSelection(option.id)}
              disabled={selectedOption !== null}
            >
              <span className="option-text">{option.term}</span>
              {selectedOption === option.id && (
                <i className={`fas ${option.isCorrect ? 'fa-check' : 'fa-times'}`}></i>
              )}
            </button>
          ))}
        </div>

        {/* Feedback */}
        {showFeedback && (
          <div className={`quiz-feedback ${feedbackType}`}>
            <i className={`fas ${feedbackType === 'success' ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
            <span>{feedbackMessage}</span>
          </div>
        )}
      </div>
    );
  };

  // Renderizar resultados finales
  const renderQuizResults = () => {
    if (!quizSession) return null;

    const correctAnswers = responses.filter(r => r.isCorrect).length;
    const totalTime = quizSession.totalTime || 0;

    return (
      <div className="quiz-results">
        <div className="results-header">
          <i className="fas fa-trophy"></i>
          <h2>¡Quiz completado!</h2>
        </div>
        
        <div className="results-stats">
          <div className="stat-item">
            <div className="stat-icon">
              <i className="fas fa-star"></i>
            </div>
            <div className="stat-value">{finalScore}</div>
            <div className="stat-label">Puntuación final</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="stat-value">{correctAnswers}/{questions.length}</div>
            <div className="stat-label">Respuestas correctas</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-icon">
              <i className="fas fa-percentage"></i>
            </div>
            <div className="stat-value">{Math.round((correctAnswers / questions.length) * 100)}%</div>
            <div className="stat-label">Precisión</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-icon">
              <i className="fas fa-clock"></i>
            </div>
            <div className="stat-value">{Math.round(totalTime)}s</div>
            <div className="stat-label">Tiempo total</div>
          </div>
          
          {quizSession.timeBonus > 0 && (
            <div className="stat-item bonus">
              <div className="stat-icon">
                <i className="fas fa-bolt"></i>
              </div>
              <div className="stat-value">+{quizSession.timeBonus}</div>
              <div className="stat-label">Bonus por tiempo</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Log de estado en el render
  console.log('[QuizModePage] Render states:', {
    loading,
    isAutoStarting,
    sessionActive,
    sessionComplete,
    notebooksLoaded,
    selectedNotebook: selectedNotebook?.title
  });

  return (
    <div className="quiz-mode-container">
      {/* Pantalla de introducción al Quiz */}
      {showQuizIntro && renderQuizIntro()}
      
      <header className="quiz-mode-header">
        <div className="header-content">
          <button
            className="back-button"
            onClick={() => {
              if (sessionActive) {
                if (window.confirm("⚠️ ¿Estás seguro de que quieres salir?\n\nSi cierras el quiz ahora, no podrás hacer otro quiz hasta la próxima semana. Tu progreso actual se perderá.\n\n¿Quieres continuar con el quiz?")) {
                  navigate('/study');
                }
              } else {
                navigate('/study');
              }
            }}
          >
            {sessionActive ? <i className="fas fa-times"></i> : <i className="fas fa-arrow-left"></i>}
          </button>
          
          <h1>
            {selectedNotebook ? selectedNotebook.title : 'Quiz'}
            {sessionActive && (
              <span className="mode-badge quiz">
                Quiz
              </span>
            )}
          </h1>
          
          <div className="header-spacer"></div>
        </div>
      </header>
      
      <main className="quiz-mode-main">
        {loading || isAutoStarting ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Iniciando quiz...</p>
          </div>
        ) : (
          <>
            {sessionActive && renderCurrentQuestion()}
            {sessionComplete && renderQuizResults()}
            {!sessionActive && !sessionComplete && (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Preparando quiz...</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default QuizModePage;