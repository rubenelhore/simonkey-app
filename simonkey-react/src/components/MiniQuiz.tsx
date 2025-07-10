import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { 
  Concept, 
  QuizQuestion, 
  QuizOption, 
  QuizResponse, 
  MiniQuizSession
} from '../types/interfaces';
import { useQuizTimer } from '../hooks/useQuizTimer';
import { useUserType } from '../hooks/useUserType';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import '../styles/MiniQuiz.css';

interface MiniQuizProps {
  notebookId: string;
  notebookTitle: string;
  onComplete: (passed: boolean, score: number) => void;
  onClose: () => void;
}

const MiniQuiz: React.FC<MiniQuizProps> = ({ 
  notebookId, 
  notebookTitle, 
  onComplete, 
  onClose 
}) => {
  const navigate = useNavigate();
  const { isSchoolStudent } = useUserType();
  
  // Estado del mini quiz
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [sessionComplete, setSessionComplete] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Estado de UI
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  
  // Estado del timer y puntuación
  const [score, setScore] = useState<number>(0);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [passed, setPassed] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [sessionStartTime] = useState<Date>(new Date());

  // Usar useRef para guardar las preguntas y evitar que se pierdan
  const questionsRef = useRef<QuizQuestion[]>([]);
  
  // Usar useRef para guardar el score actual y evitar que se pierda
  const currentScoreRef = useRef<number>(0);

  // Configuración del timer para mini quiz (45 segundos)
  const timerConfig = {
    totalTime: 45,
    warningThreshold: 20,
    criticalThreshold: 10,
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
      console.log('[MINI QUIZ] Tiempo agotado!');
      handleTimeUp();
    },
    onWarning: () => console.log('¡Advertencia! Menos de 20 segundos'),
    onCritical: () => console.log('¡Crítico! Menos de 10 segundos')
  });

  // Manejar tiempo agotado
  const handleTimeUp = () => {
    console.log('[MINI QUIZ] handleTimeUp llamado, sessionComplete:', sessionComplete);
    
    if (!sessionComplete) {
      console.log('[MINI QUIZ] Completando mini quiz por tiempo agotado');
      console.log('[MINI QUIZ] Estado actual:', {
        questions: questions.length,
        responses: responses.length,
        currentQuestionIndex,
        sessionActive,
        sessionComplete
      });
      
      // Marcar como completado inmediatamente para evitar múltiples ejecuciones
      setSessionComplete(true);
      setSessionActive(false);
      stop();
      
      // Calcular score basado en las respuestas dadas hasta el momento
      const correctAnswers = responses.filter(r => r.isCorrect).length;
      const questionsAnswered = responses.length;
      const totalQuestions = questionsRef.current.length;
      
      console.log('[MINI QUIZ] Tiempo agotado - respuestas hasta el momento:', {
        correctAnswers,
        questionsAnswered,
        totalQuestions,
        responses: responses.map(r => ({ isCorrect: r.isCorrect })),
        currentScore: score,
        questionsRefLength: questionsRef.current.length,
        questionsLength: questions.length
      });
      
      // USAR EL SCORE ACTUAL en lugar de recalcular
      // El score actual ya incluye todas las respuestas dadas
      const finalScore = currentScoreRef.current; // Usar el score guardado en ref
      console.log('[MINI QUIZ] Score final (usando score actual):', {
        scoreActual: currentScoreRef.current,
        correctAnswers,
        totalQuestions,
        finalScore
      });
      
      completeMiniQuiz(finalScore, 0);
    } else {
      console.log('[MINI QUIZ] handleTimeUp ignorado - ya completado');
    }
  };

  // Generar preguntas del mini quiz
  const generateMiniQuizQuestions = useCallback(async (): Promise<QuizQuestion[]> => {
    try {
      if (!auth.currentUser) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener conceptos del cuaderno según el tipo de usuario
      const collectionName = isSchoolStudent ? 'schoolConcepts' : 'conceptos';
      console.log('[MINI QUIZ] Buscando conceptos en colección:', collectionName);
      
      const conceptsQuery = query(
        collection(db, collectionName),
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

      if (allConcepts.length === 0) {
        throw new Error('No hay conceptos disponibles para el mini quiz');
      }

      // Seleccionar 5 conceptos aleatorios (o todos si hay menos de 5)
      const maxQuestions = Math.min(5, allConcepts.length);
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
      console.error('Error generating mini quiz questions:', error);
      throw error;
    }
  }, [notebookId]);

  // Iniciar mini quiz
  const startMiniQuiz = async () => {
    try {
      console.log('[MINI QUIZ] Preparando mini quiz...');
      setLoading(true);
      
      // Generar preguntas
      const quizQuestions = await generateMiniQuizQuestions();
      console.log('[MINI QUIZ] Preguntas generadas:', quizQuestions.length);
      
      if (quizQuestions.length === 0) {
        console.error('[MINI QUIZ] No se pudieron generar preguntas');
        setLoading(false);
        return;
      }
      
      setQuestions(quizQuestions);
      setCurrentQuestionIndex(0);
      setResponses([]);
      setScore(0);
      setSessionActive(false);
      setSessionComplete(false);
      
      // Guardar preguntas en ref para evitar que se pierdan
      questionsRef.current = quizQuestions;
      
      console.log('[MINI QUIZ] Mini quiz preparado correctamente');
      console.log(`[MINI QUIZ] 🎯 Preparado con ${quizQuestions.length} preguntas. Score inicial: 0/10`);
      setLoading(false);
    } catch (error) {
      console.error("[MINI QUIZ] Error al preparar mini quiz:", error);
      setLoading(false);
    }
  };

  // Iniciar el mini quiz manualmente
  const beginMiniQuiz = () => {
    setShowIntro(false);
    setSessionActive(true);
    start(); // Iniciar timer
    console.log('[MINI QUIZ] Mini quiz iniciado manualmente');
  };

  // Manejar respuesta del usuario
  const handleAnswerSelection = (optionId: string) => {
    if (!sessionActive || selectedOption) return;

    setSelectedOption(optionId);
    
    // Usar questionsRef.current como fallback si questions está vacío
    const currentQuestions = questions.length > 0 ? questions : questionsRef.current;
    const currentQuestion = currentQuestions[currentQuestionIndex];
    const selectedOptionData = currentQuestion.options.find(opt => opt.id === optionId);
    const correctOption = currentQuestion.options.find(opt => opt.isCorrect);
    
    if (!selectedOptionData || !correctOption) return;

    const isCorrect = selectedOptionData.isCorrect;
    const response: QuizResponse = {
      questionId: currentQuestion.id,
      selectedOptionId: optionId,
      correctOptionId: correctOption.id,
      isCorrect,
      timeSpent: 0,
      timestamp: new Date()
    };

    setResponses(prev => [...prev, response]);
    
    if (isCorrect) {
      // Calcular puntuación actual incluyendo la respuesta actual
      const correctAnswers = responses.filter(r => r.isCorrect).length + 1; // +1 por la respuesta actual
      const totalQuestions = questionsRef.current.length;
      const currentScore = Math.round((correctAnswers / totalQuestions) * 10);
      setScore(currentScore);
      currentScoreRef.current = currentScore; // Guardar en ref
      
      console.log(`[MINI QUIZ] ✅ Respuesta correcta! Score actualizado: ${currentScore}/10 (${correctAnswers}/${totalQuestions} correctas)`);
      
      setFeedbackMessage('¡Correcto! 🎉');
      setFeedbackType('success');
    } else {
      // Calcular puntuación actual incluyendo la respuesta actual
      const correctAnswers = responses.filter(r => r.isCorrect).length; // No +1 porque esta respuesta es incorrecta
      const totalQuestions = questionsRef.current.length;
      const currentScore = Math.round((correctAnswers / totalQuestions) * 10);
      setScore(currentScore);
      currentScoreRef.current = currentScore; // Guardar en ref
      
      console.log(`[MINI QUIZ] ❌ Respuesta incorrecta. Score actualizado: ${currentScore}/10 (${correctAnswers}/${totalQuestions} correctas)`);
      
      setFeedbackMessage('Incorrecto. La respuesta correcta es: ' + correctOption.term);
      setFeedbackType('error');
    }

    setShowFeedback(true);

    // Avanzar a la siguiente pregunta después de 1.5 segundos
    setTimeout(() => {
      setShowFeedback(false);
      setSelectedOption(null);
      
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // Mini quiz completado
        const finalTimeRemaining = timerTimeRemaining;
        const finalScore = score + (isCorrect ? 1 : 0);
        
        console.log('[MINI QUIZ] Completando normalmente:', {
          currentScore: score,
          isCorrect,
          finalScore,
          responses: responses.length + 1, // +1 porque aún no se ha agregado la respuesta actual
          totalQuestions: questions.length
        });
        
        completeMiniQuiz(finalScore, finalTimeRemaining);
      }
    }, 1500);
  };

  // Completar mini quiz
  const completeMiniQuiz = async (finalScoreValue: number, timeRemainingValue: number) => {
    // Usar questionsRef.current como fallback si questions está vacío
    const currentQuestions = questions.length > 0 ? questions : questionsRef.current;
    
    console.log('[MINI QUIZ] Completando mini quiz:', {
      finalScoreValue,
      timeRemainingValue,
      totalQuestions: currentQuestions.length,
      responsesLength: responses.length,
      currentScore: score
    });

    try {
      setSessionActive(false);
      stop();
      
      // Usar questionsRef.current como fallback si questions está vacío
      const currentQuestions = questions.length > 0 ? questions : questionsRef.current;
      
      // VERIFICACIÓN CRÍTICA: Si ambos están vacíos, algo salió mal
      if (currentQuestions.length === 0) {
        console.error('[MINI QUIZ] ERROR: questions y questionsRef están vacíos!');
        console.error('[MINI QUIZ] Estado completo:', {
          questions: questions.length,
          questionsRef: questionsRef.current.length,
          responses,
          currentQuestionIndex,
          sessionActive,
          sessionComplete
        });
        // Intentar recuperar las preguntas o mostrar error
        return;
      }
      
      const correctAnswers = responses.filter(r => r.isCorrect).length;
      const questionsAnswered = responses.length;
      const totalQuestions = questionsRef.current.length;
      
      console.log('[MINI QUIZ] Datos de respuestas:', {
        responses: responses.map(r => ({ isCorrect: r.isCorrect, questionId: r.questionId })),
        correctAnswers,
        questionsAnswered,
        totalQuestions
      });
      
      // Calcular precisión basada en las preguntas respondidas
      const accuracy = questionsAnswered > 0 ? (correctAnswers / questionsAnswered) * 100 : 0;
      
      // CORRECCIÓN: Calcular puntuación base 10 sobre el total de preguntas
      const scoreBase10 = totalQuestions > 0 
        ? Math.round((correctAnswers / totalQuestions) * 10)
        : 0;
      
      // Verificar si pasó (promedio mínimo de 8)
      const passed = scoreBase10 >= 8;
      
      console.log('[MINI QUIZ] CÁLCULO DETALLADO:', {
        correctAnswers,
        questionsAnswered,
        totalQuestions,
        accuracy,
        scoreBase10,
        passed,
        threshold: 8,
        finalScoreValue,
        responses: responses.map(r => ({ isCorrect: r.isCorrect }))
      });
      
      setFinalScore(currentScoreRef.current);
      setPassed(currentScoreRef.current >= 8);
      
      // Calcular tiempo total usado
      const totalTimeUsed = 45 - timeRemainingValue;
      
      // Guardar resultados del mini quiz
      await saveMiniQuizResults({
        id: `mini-quiz-${Date.now()}`,
        userId: auth.currentUser!.uid,
        notebookId,
        notebookTitle,
        questions: currentQuestions,
        responses,
        startTime: sessionStartTime,
        endTime: new Date(),
        score: correctAnswers,
        maxScore: totalQuestions, // SIEMPRE sobre el total
        accuracy,
        finalScore: currentScoreRef.current,
        passed: currentScoreRef.current >= 8,
        timeRemaining: timeRemainingValue,
        totalTime: totalTimeUsed
      });
      
      console.log('[MINI QUIZ] Mini quiz completado:', {
        score: scoreBase10,
        passed,
        correctAnswers,
        questionsAnswered,
        totalQuestions
      });
      
      // Llamar al callback con el resultado
      onComplete(currentScoreRef.current >= 8, currentScoreRef.current);
      
    } catch (error) {
      console.error('[MINI QUIZ] Error completing mini quiz:', error);
    }
  };

  // Guardar resultados del mini quiz
  const saveMiniQuizResults = async (session: MiniQuizSession) => {
    if (!auth.currentUser) return;

    try {
      console.log('[MINI QUIZ] Guardando resultados:', {
        sessionId: session.id,
        notebookId: session.notebookId,
        score: session.finalScore,
        passed: session.passed
      });

      // Log detallado de todos los campos para identificar undefined
      console.log('[MINI QUIZ] Datos de sesión completos:', {
        id: session.id,
        userId: session.userId,
        notebookId: session.notebookId,
        notebookTitle: session.notebookTitle,
        questions: session.questions?.length || 'undefined',
        responses: session.responses?.length || 'undefined',
        startTime: session.startTime,
        endTime: session.endTime,
        score: session.score,
        maxScore: session.maxScore,
        accuracy: session.accuracy,
        finalScore: session.finalScore,
        passed: session.passed,
        timeRemaining: session.timeRemaining
      });

      const cleanData = {
        id: session.id || `mini-quiz-${Date.now()}`,
        userId: session.userId || auth.currentUser!.uid,
        notebookId: session.notebookId || '',
        notebookTitle: session.notebookTitle || '',
        questions: session.questions || [],
        responses: session.responses || [],
        startTime: session.startTime ? Timestamp.fromDate(session.startTime) : Timestamp.now(),
        endTime: session.endTime ? Timestamp.fromDate(session.endTime) : Timestamp.now(),
        score: session.score || 0,
        maxScore: session.maxScore || 0,
        accuracy: session.accuracy || 0,
        finalScore: session.finalScore || 0,
        passed: session.passed || false,
        timeRemaining: session.timeRemaining || 0,
        totalTime: session.totalTime || 0,
        createdAt: Timestamp.now()
      };

      // Verificar que no hay campos undefined
      Object.keys(cleanData).forEach(key => {
        if ((cleanData as any)[key] === undefined) {
          console.error(`[MINI QUIZ] Campo undefined encontrado: ${key}`);
          (cleanData as any)[key] = null;
        }
      });

      // Limpieza profunda: eliminar campos undefined de objetos anidados
      const cleanDeep = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
          return obj.map(cleanDeep).filter(item => item !== null);
        }
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
          const value = cleanDeep(obj[key]);
          if (value !== null && value !== undefined) {
            cleaned[key] = value;
          }
        });
        return cleaned;
      };

      const finalCleanData = cleanDeep(cleanData);
      console.log('[MINI QUIZ] Datos limpios para Firebase:', finalCleanData);

      // Log detallado de cada campo para identificar undefined
      console.log('[MINI QUIZ] Verificación detallada de campos:');
      Object.keys(finalCleanData).forEach(key => {
        const value = (finalCleanData as any)[key];
        console.log(`  ${key}: ${value} (${typeof value})`);
        if (value === undefined) {
          console.error(`  ❌ CAMPO UNDEFINED ENCONTRADO: ${key}`);
        }
      });

      // Obtener el ID efectivo del usuario para usuarios escolares
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      console.log('💾 Guardando miniQuizResults con userId:', userId);
      
      // Guardar resultado del mini quiz
      const miniQuizResultsRef = doc(db, 'users', userId, 'miniQuizResults', session.id);
      await setDoc(miniQuizResultsRef, finalCleanData);
      
      console.log('[MINI QUIZ] Resultados guardados exitosamente');
      
      // Actualizar KPIs después de guardar el mini quiz
      try {
        const { kpiService } = await import('../services/kpiService');
        console.log('[MINI QUIZ] Actualizando KPIs después del mini quiz...');
        await kpiService.updateUserKPIs(userId);
      } catch (kpiError) {
        console.error('[MINI QUIZ] Error actualizando KPIs:', kpiError);
      }
    } catch (error) {
      console.error('[MINI QUIZ] Error saving results:', error);
    }
  };

  // Iniciar mini quiz al montar el componente
  useEffect(() => {
    startMiniQuiz();
  }, []);

  // Renderizar pregunta actual
  const renderCurrentQuestion = () => {
    // Usar questionsRef.current como fallback si questions está vacío
    const currentQuestions = questions.length > 0 ? questions : questionsRef.current;
    
    if (!currentQuestions[currentQuestionIndex]) return null;

    const question = currentQuestions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;

    return (
      <div className="mini-quiz-session-container">
        {/* Moviendo el contenido del header directamente al contenedor de la pregunta */}

        {/* Pregunta */}
        <div className="mini-quiz-question-container">
          {/* Info del quiz integrada en el contenedor */}
          <div className="quiz-info-inline">
            <div className="quiz-progress-info">
              <span className="progress-text">Pregunta {currentQuestionIndex + 1} de {currentQuestions.length}</span>
              <div className="progress-bar-small">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
            <div className={`quiz-timer-info ${timerClass}`}>
              <i className="fas fa-clock"></i>
              <span>{formattedTime}</span>
            </div>
            <div className="quiz-score-info">
              <span>{score}/10</span>
            </div>
          </div>
          
          <div className="question-definition">
            <h3>Definición:</h3>
            <p>{question.definition}</p>
            <div className="question-source">
              <span>Fuente: {question.source}</span>
            </div>
          </div>
        </div>

        {/* Opciones de respuesta */}
        <div className="mini-quiz-options-container">
          {question.options.map((option) => (
            <button
              key={option.id}
              className={`mini-quiz-option ${
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
          <div className={`mini-quiz-feedback ${feedbackType}`}>
            <i className={`fas ${feedbackType === 'success' ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
            <span>{feedbackMessage}</span>
          </div>
        )}
      </div>
    );
  };

  // Renderizar resultados finales
  const renderMiniQuizResults = () => {
    const correctAnswers = responses.filter(r => r.isCorrect).length;
    const questionsAnswered = responses.length;
    const totalQuestions = questionsRef.current.length;
    const wasTimeUp = questionsAnswered < totalQuestions;

    return (
      <div className="mini-quiz-results">
        <div className="results-header">
          <i className={`fas ${passed ? 'fa-trophy' : 'fa-times-circle'}`}></i>
          <h2>
            {wasTimeUp ? '¡Tiempo Agotado!' : (passed ? '¡Mini Quiz Completado!' : 'Mini Quiz Fallido')}
          </h2>
        </div>
        
        <div className="results-stats">
          <div className="stat-item">
            <div className="stat-icon">
              <i className="fas fa-star"></i>
            </div>
            <div className="stat-value">{finalScore}/10</div>
            <div className="stat-label">Calificación</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="stat-value">
              {correctAnswers}/{questionsAnswered}
              {wasTimeUp && <span className="time-up-indicator"> (de {totalQuestions})</span>}
            </div>
            <div className="stat-label">Respuestas correctas</div>
          </div>
          
          <div className="stat-item">
            <div className="stat-icon">
              <i className="fas fa-percentage"></i>
            </div>
            <div className="stat-value">
              {questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0}%
            </div>
            <div className="stat-label">Precisión</div>
          </div>
        </div>

        <div className="results-message">
          {wasTimeUp ? (
            <div className="time-up-message">
              <p>Se acabó el tiempo. Respondiste {questionsAnswered} de {totalQuestions} preguntas.</p>
              <p>Tu calificación basada en las respuestas dadas: {finalScore}/10</p>
              {passed ? (
                <p>¡Aprobaste! Tu estudio inteligente ha sido validado.</p>
              ) : (
                <p>No aprobaste. Necesitas al menos 8/10 para validar el estudio inteligente.</p>
              )}
            </div>
          ) : passed ? (
            <div className="success-message">
              <p>¡Excelente! Has aprobado el mini quiz con una calificación de {finalScore}/10.</p>
              <p>Tu estudio inteligente ha sido validado y contabilizado.</p>
            </div>
          ) : (
            <div className="failure-message">
              <p>Tu calificación fue de {finalScore}/10. Necesitas al menos 8/10 para aprobar.</p>
              <p>Tu estudio inteligente no será contabilizado, pero no podrás repetirlo hoy.</p>
            </div>
          )}
        </div>

        <div className="results-actions">
          <button
            className="action-button primary"
            onClick={() => onComplete(passed, finalScore)}
          >
            <i className="fas fa-check"></i>
            Continuar
          </button>
        </div>
      </div>
    );
  };

  // Renderizar introducción al mini quiz
  const renderMiniQuizIntro = () => {
    return (
      <div className="mini-quiz-intro">
        <div className="intro-header">
          <i className="fas fa-graduation-cap"></i>
          <h2>Mini Quiz de Validación</h2>
        </div>
        
        <div className="intro-content">
          <div className="intro-section">
            <h3>¿Qué es el Mini Quiz?</h3>
            <p>
              Para validar tu estudio inteligente, necesitas completar un mini quiz de 
              <strong> 5 preguntas</strong> sobre los conceptos que acabas de estudiar.
            </p>
          </div>
          
          <div className="intro-section">
            <h3>¿Cómo funciona?</h3>
            <ul>
              <li><i className="fas fa-clock"></i> Tienes <strong>45 segundos</strong> para responder</li>
              <li><i className="fas fa-star"></i> Necesitas una calificación de <strong>8/10 o mayor</strong></li>
              <li><i className="fas fa-check-circle"></i> Si apruebas, tu estudio inteligente se valida</li>
              <li><i className="fas fa-redo"></i> Si no apruebas, puedes intentar mañana</li>
            </ul>
          </div>
          
          <div className="intro-section">
            <h3>¿Estás listo?</h3>
            <p>
              El mini quiz comenzará cuando hagas clic en "Iniciar Mini Quiz". 
              ¡Buena suerte!
            </p>
          </div>
        </div>
        
        <div className="intro-actions">
          <button
            className="action-button primary"
            onClick={beginMiniQuiz}
          >
            <i className="fas fa-play"></i>
            Iniciar Mini Quiz
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="mini-quiz-loading">
        <div className="loading-spinner"></div>
        <p>Preparando mini quiz...</p>
      </div>
    );
  }

  return (
    <div className="mini-quiz-container">
      
      <div className="mini-quiz-main">
        {showIntro && renderMiniQuizIntro()}
        {sessionActive && renderCurrentQuestion()}
      </div>
    </div>
  );
};

export default MiniQuiz; 