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
import '../styles/QuizModePage.css';

const QuizModePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Estado principal
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [quizAvailable, setQuizAvailable] = useState<boolean>(true);
  const [quizLimitMessage, setQuizLimitMessage] = useState<string>('');
  const [autoStartAttempted, setAutoStartAttempted] = useState<boolean>(false);
  
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
    fetchNotebooks();
  }, []);

  // Pre-seleccionar cuaderno si viene de StudyModePage e iniciar quiz automáticamente
  useEffect(() => {
    console.log('useEffect ejecutado:', { 
      hasLocationState: !!location.state, 
      notebookId: location.state?.notebookId, 
      notebooksLength: notebooks.length,
      autoStartAttempted
    });
    
    if (location.state && location.state.notebookId && notebooks.length > 0 && !autoStartAttempted) {
      const notebook = notebooks.find(n => n.id === location.state.notebookId);
      console.log('Buscando cuaderno:', location.state.notebookId, 'Encontrado:', !!notebook);
      
      if (notebook) {
        console.log('Cuaderno encontrado, iniciando quiz automáticamente:', notebook.title);
        setSelectedNotebook(notebook);
        setAutoStartAttempted(true);
        
        // Si viene del dashboard, asumir que está disponible (ya fue verificado)
        const startQuizAutomatically = async () => {
          try {
            console.log('Iniciando sesión automáticamente desde dashboard...');
            // Pasar el notebook directamente para evitar problemas de timing
            await startQuizSessionWithNotebook(notebook, true);
            console.log('Sesión iniciada exitosamente');
          } catch (error) {
            console.error('Error al iniciar sesión automáticamente:', error);
          }
        };
        
        startQuizAutomatically();
      }
    }
  }, [location.state, notebooks]);

  // Verificar disponibilidad del quiz (máximo 1 por semana) - CORREGIDO: LÍMITE GLOBAL
  const checkQuizAvailabilitySync = async (notebookId: string): Promise<boolean> => {
    console.log('🔍 checkQuizAvailabilitySync llamado para:', notebookId);
    console.log('🔍 Estado actual - quizAvailable:', quizAvailable, 'quizLimitMessage:', quizLimitMessage);
    
    if (!auth.currentUser) return false;

    try {
      // CORRECCIÓN: Verificar límites GLOBALES del usuario, no por cuaderno
      console.log('🔍 Verificando límites GLOBALES de quiz para usuario:', auth.currentUser.uid);
      const userLimitsRef = doc(db, 'users', auth.currentUser.uid, 'limits', 'study');
      const userLimitsDoc = await getDoc(userLimitsRef);
      
      console.log('🔍 Documento de límites globales existe:', userLimitsDoc.exists());
      
      if (userLimitsDoc.exists()) {
        const limits = userLimitsDoc.data();
        const lastQuizDate = limits.lastQuizDate?.toDate();
        
        console.log('🔍 Límites globales encontrados:', limits);
        console.log('🔍 Última fecha de quiz GLOBAL:', lastQuizDate);
        
        if (lastQuizDate) {
          // CORRECCIÓN: Aplicar límite de 7 días GLOBALMENTE
          const now = new Date();
          const daysSinceLastQuiz = Math.floor((now.getTime() - lastQuizDate.getTime()) / (1000 * 60 * 60 * 24));
          console.log('🔍 Cálculo de días desde último quiz GLOBAL:', {
            now: now.toISOString(),
            lastQuizDate: lastQuizDate.toISOString(),
            daysSinceLastQuiz: daysSinceLastQuiz,
            shouldBeAvailable: daysSinceLastQuiz >= 7
          });
          
          if (daysSinceLastQuiz < 7) {
            const daysRemaining = 7 - daysSinceLastQuiz;
            setQuizLimitMessage(`Puedes hacer otro quiz en ${daysRemaining} día${daysRemaining > 1 ? 's' : ''}`);
            console.log('❌ Quiz no disponible GLOBALMENTE, días restantes:', daysRemaining);
            setQuizAvailable(false);
            return false;
          } else {
            setQuizLimitMessage('');
            console.log('✅ Quiz disponible GLOBALMENTE (pasó más de 7 días)');
            setQuizAvailable(true);
            return true;
          }
        }
      }
      
      // Si no hay límites previos o no se ha usado el quiz, permitir quiz (primer uso)
      setQuizLimitMessage('');
      console.log('✅ Quiz disponible GLOBALMENTE (primer uso)');
      setQuizAvailable(true);
      return true;
      
    } catch (error) {
      console.error('❌ Error checking quiz availability:', error);
      setQuizLimitMessage('');
      console.log('✅ Error en verificación, asumiendo disponible');
      setQuizAvailable(true);
      return true;
    }
  };

  // Verificar disponibilidad del quiz (máximo 1 por semana) - versión para estado
  const checkQuizAvailability = async (notebookId: string) => {
    await checkQuizAvailabilitySync(notebookId);
  };

  // Cargar cuadernos del usuario
  const fetchNotebooks = async () => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      const notebooksQuery = query(
        collection(db, 'notebooks'),
        where('userId', '==', auth.currentUser.uid)
      );
      
      const querySnapshot = await getDocs(notebooksQuery);
      const notebooksData: Notebook[] = [];
      
      querySnapshot.forEach((doc) => {
        notebooksData.push({
          id: doc.id,
          ...doc.data()
        } as Notebook);
      });
      
      setNotebooks(notebooksData);
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

      // Obtener conceptos del cuaderno usando una consulta filtrada por cuaderno
      const conceptsQuery = query(
        collection(db, 'conceptos'),
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
  }, []);

  // Iniciar sesión de quiz
  const startQuizSession = async (skipAvailabilityCheck: boolean = false) => {
    console.log('startQuizSession llamado:', { 
      selectedNotebook: !!selectedNotebook, 
      quizAvailable, 
      skipAvailabilityCheck 
    });
    
    if (!selectedNotebook) {
      console.error('No hay cuaderno seleccionado');
      return;
    }
    
    return startQuizSessionWithNotebook(selectedNotebook, skipAvailabilityCheck);
  };

  const startQuizSessionWithNotebook = async (notebook: Notebook, skipAvailabilityCheck: boolean = false) => {
    console.log('startQuizSessionWithNotebook llamado:', { 
      notebook: notebook.title, 
      quizAvailable, 
      skipAvailabilityCheck 
    });
    
    // Si se salta la verificación de disponibilidad, asumir que está disponible
    if (skipAvailabilityCheck) {
      console.log('Saltando verificación de disponibilidad, asumiendo disponible');
      setQuizAvailable(true);
      setQuizLimitMessage('');
    } else if (!quizAvailable) {
      console.error('Quiz no disponible');
      return;
    }

    try {
      console.log('Iniciando sesión de quiz...');
      setLoading(true);
      
      // Verificar disponibilidad del quiz solo si no se saltó la verificación
      if (!skipAvailabilityCheck) {
        console.log('Verificando disponibilidad...');
        await checkQuizAvailability(notebook.id);
        if (!quizAvailable) {
          console.error('Quiz no disponible después de verificación');
          setLoading(false);
          return;
        }
      }
      
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
      
      // Iniciar timer
      start();
      
      console.log('Sesión iniciada correctamente');
      setLoading(false);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setLoading(false);
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
    console.log('🏁 INICIANDO completeQuizSession:', {
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

  // Actualizar límites de quiz - CORREGIDO: LÍMITE GLOBAL
  const updateQuizLimits = async (notebookId: string) => {
    if (!auth.currentUser || !notebookId) return;

    try {
      console.log('🔄 Aplicando límite GLOBAL de quiz para usuario:', auth.currentUser.uid);
      console.log('🔍 Quiz completado en cuaderno:', notebookId);
      
      // CORRECCIÓN: Aplicar límite GLOBAL del usuario, no por cuaderno
      const userLimitsRef = doc(db, 'users', auth.currentUser.uid, 'limits', 'study');
      const currentDate = new Date();
      
      console.log('🔍 Fecha actual para límite GLOBAL:', currentDate.toISOString());
      
      const newLimits = {
        userId: auth.currentUser.uid,
        lastQuizDate: currentDate,
        quizCountThisWeek: 1,
        weekStartDate: getWeekStartDate(),
        updatedAt: Timestamp.now()
      };
      
      console.log('🔍 Nuevos límites GLOBALES a guardar:', {
        ...newLimits,
        lastQuizDate: currentDate.toISOString(),
        weekStartDate: getWeekStartDate().toISOString()
      });
      
      await setDoc(userLimitsRef, newLimits, { merge: true });
      
      console.log('✅ Límite GLOBAL de quiz aplicado exitosamente:', {
        userId: auth.currentUser.uid,
        lastQuizDate: currentDate.toISOString(),
        quizCountThisWeek: 1,
        documentPath: `users/${auth.currentUser.uid}/limits/study`
      });
      
    } catch (error) {
      console.error('❌ Error aplicando límite GLOBAL de quiz:', error);
    }
  };

  // Función temporal para resetear límites de quiz (SOLO PARA DESARROLLO) - CORREGIDO
  const resetQuizLimits = async () => {
    if (!auth.currentUser) return;

    try {
      console.log('🔄 Reseteando límites GLOBALES de quiz...');
      const limitsRef = doc(db, 'users', auth.currentUser.uid, 'limits', 'study');
      
      // CORRECCIÓN: Resetear límites GLOBALES
      await setDoc(limitsRef, {
        userId: auth.currentUser.uid,
        lastQuizDate: null,
        quizCountThisWeek: 0,
        weekStartDate: new Date(),
        updatedAt: Timestamp.now()
      }, { merge: true });
      
      console.log('✅ Límites GLOBALES de quiz reseteados');
      setQuizAvailable(true);
      setQuizLimitMessage('');
      
      // Recargar disponibilidad
      if (selectedNotebook?.id) {
        await checkQuizAvailabilitySync(selectedNotebook.id);
      }
    } catch (error) {
      console.error('❌ Error reseteando límites GLOBALES:', error);
    }
  };

  // Obtener fecha de inicio de la semana actual
  const getWeekStartDate = (): Date => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  // Renderizar selección de cuaderno
  const renderNotebookSelection = () => (
    <div className="quiz-notebook-selection">
      <h2>Selecciona un cuaderno para el quiz</h2>
      
      {loading ? (
        <div className="loading-notebooks">
          <div className="loading-spinner"></div>
          <p>Cargando cuadernos...</p>
        </div>
      ) : notebooks.length === 0 ? (
        <div className="empty-notebooks">
          <i className="fas fa-book-open"></i>
          <h3>No tienes cuadernos</h3>
          <p>Crea un cuaderno con conceptos para poder hacer quizzes</p>
          <button
            className="create-notebook-button"
            onClick={() => navigate('/notebooks')}
          >
            <i className="fas fa-plus"></i>
            Crear cuaderno
          </button>
        </div>
      ) : (
        <div className="notebooks-list">
          {notebooks.map((notebook) => (
            <div
              key={notebook.id}
              className={`notebook-item ${selectedNotebook?.id === notebook.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedNotebook(notebook);
                checkQuizAvailability(notebook.id);
              }}
            >
              <div className="notebook-color" style={{ backgroundColor: notebook.color }}></div>
              <div className="notebook-title">{notebook.title}</div>
            </div>
          ))}
        </div>
      )}
      
      {selectedNotebook && (
        <div className="quiz-options">
          <div className="quiz-info">
            <h3>¿Listo para el quiz?</h3>
            <p>
              Se te mostrarán definiciones y deberás seleccionar el término correcto.
              <br />
              <strong>10 preguntas aleatorias</strong> con <strong>10 minutos</strong> de tiempo.
              <br />
              <strong>Puntuación:</strong> Respuestas correctas × tiempo restante
            </p>
            
            {!quizAvailable && (
              <div className="quiz-limit-warning">
                <i className="fas fa-clock"></i>
                <span>{quizLimitMessage}</span>
              </div>
            )}
          </div>
          
          <div className="quiz-buttons">
            <button
              className={`start-quiz-button ${!quizAvailable ? 'disabled' : ''}`}
              onClick={() => startQuizSession()}
              disabled={loading || !quizAvailable}
            >
              {loading ? (
                <><i className="fas fa-spinner fa-spin"></i> Preparando quiz...</>
              ) : !quizAvailable ? (
                <><i className="fas fa-lock"></i> Quiz no disponible</>
              ) : (
                <><i className="fas fa-play"></i> Comenzar quiz</>
              )}
            </button>
            
            {/* Botón temporal para resetear límites (SOLO PARA DESARROLLO) */}
            <button
              className="reset-limits-button"
              onClick={resetQuizLimits}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-sync-alt"></i> Resetear límites (Desarrollo)
            </button>
          </div>
        </div>
      )}
    </div>
  );

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

  return (
    <div className="quiz-mode-container">
      <header className="quiz-mode-header">
        <div className="header-content">
          <button
            className="back-button"
            onClick={() => {
              if (sessionActive) {
                if (window.confirm("⚠️ ¿Estás seguro de que quieres salir?\n\nSi cierras el quiz ahora, no podrás hacer otro quiz hasta la próxima semana. Tu progreso actual se perderá.\n\n¿Quieres continuar con el quiz?")) {
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
        {!sessionActive && !sessionComplete && renderNotebookSelection()}
        {sessionActive && renderCurrentQuestion()}
        {sessionComplete && renderQuizResults()}
      </main>
    </div>
  );
};

export default QuizModePage;