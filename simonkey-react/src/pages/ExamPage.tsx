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
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [allConcepts, setAllConcepts] = useState<any[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const questionStartTime = useRef<number>(Date.now());
  const lastSaveTime = useRef<number>(Date.now());

  // Función para generar opciones múltiples
  const generateOptions = (correctAnswer: string, allDefinitions: string[]) => {
    console.log('🎯 Generando opciones para respuesta correcta:', correctAnswer);
    console.log('📚 Total definiciones disponibles:', allDefinitions.length);
    
    // Filtrar definiciones válidas y únicas
    const validDefinitions = allDefinitions.filter(def => def && def.trim() !== '');
    const uniqueDefinitions = [...new Set(validDefinitions)];
    console.log('📋 Definiciones únicas válidas:', uniqueDefinitions.length);
    
    const options = [correctAnswer];
    const otherDefinitions = uniqueDefinitions.filter(def => def !== correctAnswer);
    console.log('🔀 Otras definiciones disponibles:', otherDefinitions.length);
    
    // Si no hay suficientes opciones, generar opciones falsas
    if (otherDefinitions.length < 3) {
      console.warn('⚠️ No hay suficientes definiciones para generar 4 opciones');
      console.warn('📝 Definiciones disponibles:', otherDefinitions);
      
      // Usar las que hay disponibles
      options.push(...otherDefinitions);
      
      // Generar opciones falsas más realistas para completar hasta 4
      const fakeOptions = [
        "Esta definición corresponde a otro concepto no incluido en este examen",
        "Definición que no se aplica a este término específico", 
        "Esta opción no es la definición correcta para el término mostrado"
      ];
      
      const needed = 4 - options.length;
      options.push(...fakeOptions.slice(0, needed));
    } else {
      // Seleccionar 3 opciones incorrectas aleatorias
      const shuffled = otherDefinitions.sort(() => 0.5 - Math.random());
      const incorrectOptions = shuffled.slice(0, 3);
      console.log('❌ Opciones incorrectas seleccionadas:', incorrectOptions.length);
      
      options.push(...incorrectOptions);
    }
    
    // Mezclar todas las opciones
    const finalOptions = options.sort(() => 0.5 - Math.random());
    console.log('✅ Total opciones generadas:', finalOptions.length);
    console.log('📝 Opciones:', finalOptions);
    
    return finalOptions;
  };

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
        
        // Cargar todos los conceptos de los cuadernos del examen
        console.log('📚 Cargando conceptos de los cuadernos:', examData.notebookIds);
        const allConceptsData = await ExamService.getAllConceptsFromNotebooks(examData.notebookIds);
        setAllConcepts(allConceptsData);
        console.log('📝 Total conceptos cargados:', allConceptsData.length);
        
        // Si ya estaba en progreso, continuar donde se quedó
        if (attemptData.status === 'in_progress') {
          setExamStarted(true);
        }
        
        // Generar opciones para la pregunta actual
        if (attemptData.assignedConcepts.length > 0) {
          const currentConcept = attemptData.assignedConcepts[attemptData.currentQuestionIndex];
          console.log('🎯 Concepto actual:', {
            término: currentConcept.término,
            definición: currentConcept.definición,
            conceptId: currentConcept.conceptId
          });
          const allDefinitions = allConceptsData.map(c => c.definición);
          const options = generateOptions(currentConcept.definición, allDefinitions);
          setCurrentOptions(options);
          
          // Cargar respuesta actual si existe
          if (attemptData.answers.length > 0) {
            const existingAnswer = attemptData.answers.find(a => a.conceptId === currentConcept.conceptId);
            if (existingAnswer) {
              const selectedIndex = options.findIndex(opt => opt === existingAnswer.userAnswer);
              setSelectedOption(selectedIndex >= 0 ? selectedIndex : null);
            }
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
    
    // Prevenir múltiples guardados simultáneos
    if (saving) {
      console.warn('⚠️ Ya se está guardando una respuesta, ignorando...');
      return;
    }
    
    const currentConcept = attempt.assignedConcepts[attempt.currentQuestionIndex];
    const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
    
    // Evaluar respuesta - comparar con la opción seleccionada
    const isCorrect = currentAnswer.trim() === currentConcept.definición.trim();
    
    console.log('📝 Evaluando respuesta:', {
      userAnswer: currentAnswer.trim(),
      correctAnswer: currentConcept.definición.trim(),
      isCorrect: isCorrect
    });
    
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
      
      console.log('✅ Respuesta guardada exitosamente:', {
        conceptId: answer.conceptId,
        userAnswer: answer.userAnswer,
        isCorrect: answer.isCorrect,
        attemptId: attempt.id
      });
      
      lastSaveTime.current = Date.now();
      
      if (moveToNext) {
        if (attempt.currentQuestionIndex < attempt.assignedConcepts.length - 1) {
          // Siguiente pregunta
          setAttempt(prev => {
            if (!prev) return null;
            const newAttempt = {
              ...prev,
              currentQuestionIndex: prev.currentQuestionIndex + 1,
              answers: [...prev.answers.filter(a => a.conceptId !== answer.conceptId), answer]
            };
            
            // Generar nuevas opciones para la siguiente pregunta
            const nextConcept = newAttempt.assignedConcepts[newAttempt.currentQuestionIndex];
            const allDefinitions = allConcepts.map(c => c.definición);
            const options = generateOptions(nextConcept.definición, allDefinitions);
            setCurrentOptions(options);
            setSelectedOption(null);
            
            return newAttempt;
          });
          setCurrentAnswer('');
          questionStartTime.current = Date.now();
        } else {
          // Última pregunta - no limpiar currentAnswer antes de completar
          // handleCompleteExam se llamará después de guardar
          await ExamService.completeExamAttempt(attempt.id).then(score => {
            navigate(`/exam/${examId}/results`, { 
              state: { score, attemptId: attempt.id, materiaId } 
            });
          });
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
      console.log('🏁 Completando examen...');
      
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
            <label>Selecciona la definición correcta:</label>
            <div className="options-container">
              {currentOptions.map((option, index) => (
                <button
                  key={index}
                  className={`option-button ${
                    selectedOption === index ? 'selected' : ''
                  } ${
                    showResult && index === selectedOption
                      ? option === currentConcept.definición ? 'correct' : 'incorrect'
                      : ''
                  } ${
                    showResult && option === currentConcept.definición ? 'show-correct' : ''
                  }`}
                  onClick={async () => {
                    if (saving || showResult) return;
                    
                    setSelectedOption(index);
                    setShowResult(true);
                    setLastAnswerCorrect(option.trim() === currentConcept.definición.trim());
                    
                    // Guardar la respuesta directamente sin depender del estado
                    const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
                    const isCorrect = option.trim() === currentConcept.definición.trim();
                    
                    const answer: ExamAnswer = {
                      conceptId: currentConcept.conceptId,
                      userAnswer: option.trim(),
                      isCorrect,
                      timeSpent,
                      answeredAt: Timestamp.now()
                    };
                    
                    setSaving(true);
                    
                    try {
                      await ExamService.saveAnswer(
                        attempt.id, 
                        answer, 
                        attempt.currentQuestionIndex < attempt.assignedConcepts.length - 1 
                          ? attempt.currentQuestionIndex + 1 
                          : attempt.currentQuestionIndex,
                        timeRemaining
                      );
                      
                      console.log('✅ Respuesta guardada desde onClick:', {
                        conceptId: answer.conceptId,
                        userAnswer: answer.userAnswer,
                        isCorrect: answer.isCorrect
                      });
                      
                      // Esperar 1 segundo para mostrar feedback
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      
                      setShowResult(false);
                      setSaving(false);
                      
                      // Mover a la siguiente pregunta
                      if (attempt.currentQuestionIndex < attempt.assignedConcepts.length - 1) {
                        setAttempt(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            currentQuestionIndex: prev.currentQuestionIndex + 1,
                            answers: [...prev.answers.filter(a => a.conceptId !== answer.conceptId), answer]
                          };
                        });
                        
                        // Generar nuevas opciones para la siguiente pregunta
                        const nextIndex = attempt.currentQuestionIndex + 1;
                        const nextConcept = attempt.assignedConcepts[nextIndex];
                        const allDefinitions = allConcepts.map(c => c.definición);
                        const options = generateOptions(nextConcept.definición, allDefinitions);
                        setCurrentOptions(options);
                        setSelectedOption(null);
                        questionStartTime.current = Date.now();
                      } else {
                        // Última pregunta - completar examen
                        await ExamService.completeExamAttempt(attempt.id).then(score => {
                          navigate(`/exam/${examId}/results`, { 
                            state: { score, attemptId: attempt.id, materiaId } 
                          });
                        });
                      }
                    } catch (error) {
                      console.error('Error guardando respuesta:', error);
                      alert('Error al guardar la respuesta');
                      setSaving(false);
                      setShowResult(false);
                    }
                  }}
                  disabled={saving || showResult}
                >
                  <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{option}</span>
                  {showResult && option === currentConcept.definición && (
                    <i className="fas fa-check-circle" style={{ marginLeft: 'auto', color: '#10b981' }}></i>
                  )}
                  {showResult && index === selectedOption && option !== currentConcept.definición && (
                    <i className="fas fa-times-circle" style={{ marginLeft: 'auto', color: '#ef4444' }}></i>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="exam-footer">
        <div className="exam-progress-info">
          {saving && (
            <div className="saving-indicator">
              <i className="fas fa-spinner fa-spin"></i>
              Guardando...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamPage;