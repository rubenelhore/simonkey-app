import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ExamService } from '../services/examService';
import { SchoolExam, ExamAttempt, ExamAnswer } from '../types/exam.types';
import { Timestamp } from 'firebase/firestore';
import '../styles/ExamPage.css';

const ExamPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { materiaId } = location.state || {};
  
  const [exam, setExam] = useState<SchoolExam | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const questionStartTime = useRef<number>(Date.now());
  const lastSaveTime = useRef<number>(Date.now());

  // Cargar examen e intento
  useEffect(() => {
    const loadExamData = async () => {
      if (!examId || !user) return;
      
      try {
        // Cargar examen
        const examData = await ExamService.getExamById(examId);
        if (!examData) {
          alert('Examen no encontrado');
          navigate(-1);
          return;
        }
        setExam(examData);
        
        // Obtener o crear intento
        const attemptData = await ExamService.getOrCreateExamAttempt(examId, user.uid);
        if (!attemptData) {
          alert('Error al iniciar el examen');
          navigate(-1);
          return;
        }
        
        setAttempt(attemptData);
        setTimeRemaining(attemptData.timeRemaining);
        
        // Si ya estaba en progreso, continuar donde se quedó
        if (attemptData.status === 'in_progress') {
          setExamStarted(true);
        }
        
        // Cargar respuesta actual si existe
        if (attemptData.answers.length > 0) {
          const currentConcept = attemptData.assignedConcepts[attemptData.currentQuestionIndex];
          const existingAnswer = attemptData.answers.find(a => a.conceptId === currentConcept.conceptId);
          if (existingAnswer) {
            setCurrentAnswer(existingAnswer.userAnswer);
          }
        }
      } catch (error) {
        console.error('Error cargando datos del examen:', error);
        alert('Error al cargar el examen');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    
    loadExamData();
  }, [examId, user, navigate]);

  // Timer
  useEffect(() => {
    if (examStarted && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleCompleteExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [examStarted]);

  // Detectar cambio de pestaña
  useEffect(() => {
    if (!examStarted || !exam?.settings.preventTabSwitch || !attempt) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        ExamService.incrementTabSwitch(attempt.id);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [examStarted, exam, attempt]);

  // Auto-guardar cada 10 segundos
  useEffect(() => {
    if (!examStarted || !attempt) return;
    
    const autoSaveInterval = setInterval(() => {
      if (Date.now() - lastSaveTime.current > 10000 && currentAnswer.trim()) {
        saveCurrentAnswer(false);
      }
    }, 10000);
    
    return () => clearInterval(autoSaveInterval);
  }, [examStarted, currentAnswer, attempt]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartExam = async () => {
    if (!attempt) return;
    
    try {
      await ExamService.startExamAttempt(attempt.id);
      setExamStarted(true);
      questionStartTime.current = Date.now();
    } catch (error) {
      console.error('Error iniciando examen:', error);
      alert('Error al iniciar el examen');
    }
  };

  const saveCurrentAnswer = async (moveToNext: boolean = true) => {
    if (!attempt || !exam) return;
    
    const currentConcept = attempt.assignedConcepts[attempt.currentQuestionIndex];
    const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
    
    // Evaluar respuesta (comparación simple, se puede mejorar)
    const isCorrect = currentAnswer.trim().toLowerCase() === 
                     currentConcept.definición.toLowerCase();
    
    const answer: ExamAnswer = {
      conceptId: currentConcept.conceptId,
      userAnswer: currentAnswer.trim(),
      isCorrect,
      timeSpent,
      answeredAt: Timestamp.now()
    };
    
    setSaving(true);
    try {
      await ExamService.saveAnswer(
        attempt.id, 
        answer, 
        moveToNext ? attempt.currentQuestionIndex + 1 : attempt.currentQuestionIndex,
        timeRemaining
      );
      
      lastSaveTime.current = Date.now();
      
      if (moveToNext) {
        if (attempt.currentQuestionIndex < attempt.assignedConcepts.length - 1) {
          // Siguiente pregunta
          setAttempt(prev => prev ? {
            ...prev,
            currentQuestionIndex: prev.currentQuestionIndex + 1,
            answers: [...prev.answers.filter(a => a.conceptId !== answer.conceptId), answer]
          } : null);
          setCurrentAnswer('');
          questionStartTime.current = Date.now();
        } else {
          // Última pregunta
          handleCompleteExam();
        }
      }
    } catch (error) {
      console.error('Error guardando respuesta:', error);
      alert('Error al guardar la respuesta');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteExam = async () => {
    if (!attempt) return;
    
    try {
      // Guardar respuesta actual si existe
      if (currentAnswer.trim()) {
        await saveCurrentAnswer(false);
      }
      
      const score = await ExamService.completeExamAttempt(attempt.id);
      
      // Navegar a página de resultados
      navigate(`/exam/${examId}/results`, { 
        state: { score, attemptId: attempt.id, materiaId } 
      });
    } catch (error) {
      console.error('Error completando examen:', error);
      alert('Error al finalizar el examen');
    }
  };

  if (loading) {
    return (
      <div className="exam-loading">
        <div className="loading-spinner"></div>
        <p>Cargando examen...</p>
      </div>
    );
  }

  if (!exam || !attempt) {
    return (
      <div className="exam-error">
        <h2>Error al cargar el examen</h2>
        <button onClick={() => navigate(-1)}>Volver</button>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="exam-start-screen">
        <div className="exam-start-card">
          <h1>{exam.title}</h1>
          {exam.description && <p>{exam.description}</p>}
          
          <div className="exam-instructions">
            <h3>Instrucciones:</h3>
            <ul>
              <li>Este examen tiene {attempt.assignedConcepts.length} preguntas</li>
              <li>Tiempo total: {formatTime(timeRemaining)}</li>
              <li>Las preguntas son aleatorias para cada estudiante</li>
              <li>Tu progreso se guarda automáticamente</li>
              {exam.settings.preventTabSwitch && (
                <li className="warning">⚠️ No cambies de pestaña durante el examen</li>
              )}
            </ul>
          </div>
          
          <button 
            className="start-exam-button"
            onClick={handleStartExam}
          >
            Comenzar Examen
          </button>
        </div>
      </div>
    );
  }

  const currentConcept = attempt.assignedConcepts[attempt.currentQuestionIndex];
  const progress = ((attempt.currentQuestionIndex + 1) / attempt.assignedConcepts.length) * 100;

  return (
    <div className="exam-interface">
      <div className="exam-header">
        <div className="exam-progress-info">
          <span className="question-counter">
            Pregunta {attempt.currentQuestionIndex + 1} de {attempt.assignedConcepts.length}
          </span>
          <div className="progress-bar-exam">
            <div 
              className="progress-fill-exam" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        
        <div className={`exam-timer ${timeRemaining < 60 ? 'timer-warning' : ''}`}>
          <i className="fas fa-clock"></i>
          <span>{formatTime(timeRemaining)}</span>
        </div>
      </div>
      
      <div className="exam-content">
        <div className="question-container">
          <h2 className="question-term">{currentConcept.término}</h2>
          
          <div className="answer-section">
            <label>Escribe la definición:</label>
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Escribe aquí tu respuesta..."
              className="answer-textarea"
              disabled={saving}
              autoFocus
            />
          </div>
        </div>
      </div>
      
      <div className="exam-footer">
        <div className="exam-controls">
          {attempt.currentQuestionIndex < attempt.assignedConcepts.length - 1 ? (
            <button 
              className="next-button"
              onClick={() => saveCurrentAnswer(true)}
              disabled={!currentAnswer.trim() || saving}
            >
              {saving ? 'Guardando...' : 'Siguiente'}
              <i className="fas fa-arrow-right"></i>
            </button>
          ) : (
            <button 
              className="finish-button"
              onClick={handleCompleteExam}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Finalizar Examen'}
              <i className="fas fa-check"></i>
            </button>
          )}
        </div>
        
        {saving && (
          <div className="saving-indicator">
            <i className="fas fa-spinner fa-spin"></i>
            Guardando respuesta...
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamPage;