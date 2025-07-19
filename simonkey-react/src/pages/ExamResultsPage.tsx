import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { SchoolExam, ExamAttempt } from '../types/exam.types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import '../styles/ExamResultsPage.css';

const ExamResultsPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { score, attemptId, materiaId } = location.state || {};
  
  const [exam, setExam] = useState<SchoolExam | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExamData = async () => {
      if (!examId || !attemptId) {
        console.error('Missing examId or attemptId');
        navigate('/study');
        return;
      }
      
      try {
        // Cargar datos del examen
        const examDoc = await getDoc(doc(db, 'schoolExams', examId));
        if (examDoc.exists()) {
          setExam({ id: examDoc.id, ...examDoc.data() } as SchoolExam);
        }
        
        // Cargar datos del intento
        const attemptDoc = await getDoc(doc(db, 'examAttempts', attemptId));
        if (attemptDoc.exists()) {
          setAttempt({ id: attemptDoc.id, ...attemptDoc.data() } as ExamAttempt);
        }
      } catch (error) {
        console.error('Error cargando datos del examen:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadExamData();
  }, [examId, attemptId, navigate]);

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return '#10b981';
    if (percentage >= 70) return '#3b82f6';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="exam-results-loading">
        <div className="loading-spinner"></div>
        <p>Cargando resultados...</p>
      </div>
    );
  }

  if (!exam || !attempt) {
    return (
      <div className="exam-results-error">
        <h2>Error al cargar los resultados</h2>
        <button onClick={() => navigate('/study')}>Volver al estudio</button>
      </div>
    );
  }

  const correctAnswers = attempt.answers.filter(a => a.isCorrect).length;
  const incorrectAnswers = attempt.answers.filter(a => !a.isCorrect).length;
  const averageTimePerQuestion = Math.round(
    attempt.answers.reduce((acc, a) => acc + a.timeSpent, 0) / attempt.answers.length
  );

  return (
    <div className="exam-results-page">
      <div className="exam-results-header">
        <button 
          className="back-to-study-btn"
          onClick={() => navigate('/study', { state: { materiaId } })}
        >
          <i className="fas fa-arrow-left"></i>
          Volver al estudio
        </button>
      </div>

      <div className="exam-results-container">
        <div className="results-hero">
          <div className="results-icon" style={{ color: getScoreColor(score || 0, 1000) }}>
            <i className="fas fa-trophy"></i>
          </div>
          
          <h1 className="results-title">¡Examen Completado!</h1>
          <p className="results-subtitle">{exam.title}</p>
          
          <div className="score-display" style={{ color: getScoreColor(score || 0, 1000) }}>
            <div className="score-value">{score || 0}</div>
            <div className="score-label">puntos</div>
          </div>
        </div>

        <div className="results-stats">
          <div className="stat-card">
            <div className="stat-icon correct">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="stat-value">{correctAnswers}</div>
            <div className="stat-label">Respuestas Correctas</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon incorrect">
              <i className="fas fa-times-circle"></i>
            </div>
            <div className="stat-value">{incorrectAnswers}</div>
            <div className="stat-label">Respuestas Incorrectas</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon time">
              <i className="fas fa-clock"></i>
            </div>
            <div className="stat-value">{formatTime(averageTimePerQuestion)}</div>
            <div className="stat-label">Tiempo Promedio</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon percentage">
              <i className="fas fa-percentage"></i>
            </div>
            <div className="stat-value">
              {Math.round((correctAnswers / attempt.answers.length) * 100)}%
            </div>
            <div className="stat-label">Precisión</div>
          </div>
        </div>

        <div className="results-details">
          <h2>Detalles del Examen</h2>
          
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Fecha:</span>
              <span className="detail-value">
                {attempt.completedAt ? 
                  formatDistanceToNow(attempt.completedAt.toDate(), { 
                    addSuffix: true, 
                    locale: es 
                  }) : 'Hace un momento'}
              </span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Tiempo total:</span>
              <span className="detail-value">
                {formatTime(exam.timePerConcept * attempt.assignedConcepts.length - attempt.timeRemaining)}
              </span>
            </div>
            
            {(attempt.tabSwitches || 0) > 0 && (
              <div className="detail-item warning">
                <span className="detail-label">Cambios de pestaña:</span>
                <span className="detail-value">{attempt.tabSwitches}</span>
              </div>
            )}
          </div>
        </div>

        <div className="answer-review">
          <h2>Revisión de Respuestas</h2>
          
          <div className="answers-list">
            {attempt.assignedConcepts.map((concept, index) => {
              const answer = attempt.answers.find(a => a.conceptId === concept.conceptId);
              if (!answer) return null;
              
              return (
                <div 
                  key={concept.conceptId} 
                  className={`answer-item ${answer.isCorrect ? 'correct' : 'incorrect'}`}
                >
                  <div className="answer-number">
                    {index + 1}
                  </div>
                  
                  <div className="answer-content">
                    <div className="answer-question">
                      <strong>{concept.término}</strong>
                    </div>
                    
                    <div className="answer-response">
                      <div className="response-label">Tu respuesta:</div>
                      <div className="response-text">{answer.userAnswer || '(Sin respuesta)'}</div>
                    </div>
                    
                    {!answer.isCorrect && (
                      <div className="correct-answer">
                        <div className="response-label">Respuesta correcta:</div>
                        <div className="response-text">{concept.definición}</div>
                      </div>
                    )}
                    
                    <div className="answer-meta">
                      <span className="time-spent">
                        <i className="fas fa-clock"></i>
                        {formatTime(answer.timeSpent)}
                      </span>
                      {answer.isCorrect && (
                        <span className="points-earned">
                          +{Math.round((exam.timePerConcept - answer.timeSpent) * 10)} pts
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="answer-status">
                    {answer.isCorrect ? (
                      <i className="fas fa-check-circle"></i>
                    ) : (
                      <i className="fas fa-times-circle"></i>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="results-actions">
          <button 
            className="secondary-btn"
            onClick={() => navigate('/study', { state: { materiaId } })}
          >
            <i className="fas fa-book"></i>
            Volver a Estudiar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamResultsPage;