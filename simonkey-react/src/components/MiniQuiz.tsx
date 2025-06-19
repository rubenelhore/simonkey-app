import React, { useState, useEffect, useCallback } from 'react';
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

  // Configuración del timer para mini quiz (20 segundos)
  const timerConfig = {
    totalTime: 20,
    warningThreshold: 10,
    criticalThreshold: 5,
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
    onWarning: () => console.log('¡Advertencia! Menos de 10 segundos'),
    onCritical: () => console.log('¡Crítico! Menos de 5 segundos')
  });

  // Manejar tiempo agotado
  const handleTimeUp = () => {
    if (!sessionComplete) {
      console.log('[MINI QUIZ] Completando mini quiz por tiempo agotado');
      setSessionActive(false);
      setSessionComplete(true);
      stop();
      
      // Calcular score basado en las respuestas dadas hasta el momento
      const correctAnswers = responses.filter(r => r.isCorrect).length;
      const questionsAnswered = responses.length;
      
      console.log('[MINI QUIZ] Tiempo agotado - respuestas hasta el momento:', {
        correctAnswers,
        questionsAnswered,
        totalQuestions: questions.length,
        responses: responses.map(r => ({ isCorrect: r.isCorrect }))
      });
      
      // Completar con el score actual basado en las respuestas dadas
      completeMiniQuiz(correctAnswers, 0);
    }
  };

  // Generar preguntas del mini quiz
  const generateMiniQuizQuestions = useCallback(async (): Promise<QuizQuestion[]> => {
    try {
      if (!auth.currentUser) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener conceptos del cuaderno que están listos para repaso hoy
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
      console.log('[MINI QUIZ] Iniciando mini quiz...');
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
      setSessionActive(true);
      setSessionComplete(false);
      
      // Iniciar timer
      start();
      
      console.log('[MINI QUIZ] Mini quiz iniciado correctamente');
      setLoading(false);
    } catch (error) {
      console.error("[MINI QUIZ] Error al iniciar mini quiz:", error);
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
      timeSpent: 0,
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
    console.log('[MINI QUIZ] Completando mini quiz:', {
      finalScoreValue,
      timeRemainingValue,
      totalQuestions: questions.length
    });

    try {
      setSessionActive(false);
      setSessionComplete(true);
      stop();
      
      const correctAnswers = responses.filter(r => r.isCorrect).length;
      const questionsAnswered = responses.length;
      const totalQuestions = questions.length;
      
      // Calcular precisión basada en las preguntas respondidas
      const accuracy = questionsAnswered > 0 ? (correctAnswers / questionsAnswered) * 100 : 0;
      
      // Calcular puntuación base 10 basada en las preguntas respondidas
      // Si respondió todas las preguntas: (correctas / total) * 10
      // Si no respondió todas: (correctas / respondidas) * 10
      const scoreBase10 = questionsAnswered > 0 
        ? Math.round((correctAnswers / questionsAnswered) * 10)
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
      
      // Verificar que el cálculo sea consistente
      if (finalScoreValue !== correctAnswers) {
        console.warn('[MINI QUIZ] INCONSISTENCIA DETECTADA:', {
          finalScoreValue,
          correctAnswers,
          questionsAnswered
        });
      }
      
      setFinalScore(scoreBase10);
      setPassed(passed);
      
      // Guardar resultados del mini quiz
      await saveMiniQuizResults({
        id: `mini-quiz-${Date.now()}`,
        userId: auth.currentUser!.uid,
        notebookId,
        notebookTitle,
        questions,
        responses,
        startTime: new Date(),
        endTime: new Date(),
        score: correctAnswers,
        maxScore: questionsAnswered, // Usar preguntas respondidas en lugar del total
        accuracy,
        finalScore: scoreBase10,
        passed,
        timeRemaining: timeRemainingValue
      });
      
      console.log('[MINI QUIZ] Mini quiz completado:', {
        score: scoreBase10,
        passed,
        correctAnswers,
        questionsAnswered,
        totalQuestions
      });
      
      // Llamar al callback con el resultado
      onComplete(passed, scoreBase10);
      
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

      const cleanData = {
        id: session.id,
        userId: session.userId,
        notebookId: session.notebookId,
        notebookTitle: session.notebookTitle,
        questions: session.questions,
        responses: session.responses,
        startTime: Timestamp.fromDate(session.startTime),
        endTime: Timestamp.fromDate(session.endTime),
        score: session.score,
        maxScore: session.maxScore,
        accuracy: session.accuracy,
        finalScore: session.finalScore,
        passed: session.passed,
        timeRemaining: session.timeRemaining,
        createdAt: Timestamp.now()
      };

      // Guardar resultado del mini quiz
      const miniQuizResultsRef = doc(db, 'users', auth.currentUser.uid, 'miniQuizResults', session.id);
      await setDoc(miniQuizResultsRef, cleanData);
      
      console.log('[MINI QUIZ] Resultados guardados exitosamente');
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
    if (!questions[currentQuestionIndex]) return null;

    const question = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
      <div className="mini-quiz-session-container">
        {/* Header con progreso y timer */}
        <div className="mini-quiz-header">
          <div className="mini-quiz-progress">
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
          <div className={`mini-quiz-timer ${timerClass}`}>
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
          
          <div className="mini-quiz-score">
            <span className="score-label">Puntuación:</span>
            <span className={`score-value ${score >= 0 ? 'positive' : 'negative'}`}>
              {score >= 0 ? '+' : ''}{score}
            </span>
          </div>
        </div>

        {/* Pregunta */}
        <div className="mini-quiz-question-container">
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
    const totalQuestions = questions.length;
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
      <div className="mini-quiz-header">
        <div className="header-content">
          <h1>
            Mini Quiz - {notebookTitle}
            <span className="mode-badge mini-quiz">
              Mini Quiz
            </span>
          </h1>
        </div>
      </div>
      
      <div className="mini-quiz-main">
        {sessionActive && renderCurrentQuestion()}
        {sessionComplete && renderMiniQuizResults()}
      </div>
    </div>
  );
};

export default MiniQuiz; 