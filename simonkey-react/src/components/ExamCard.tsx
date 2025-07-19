import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SchoolExam } from '../types/exam.types';
import '../styles/ExamCard.css';

interface ExamCardProps {
  exam: SchoolExam;
  materiaId: string;
}

const ExamCard: React.FC<ExamCardProps> = ({ exam, materiaId }) => {
  const navigate = useNavigate();

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  const totalTime = exam.questionsPerStudent * exam.timePerConcept;

  const handleStartExam = () => {
    navigate(`/exam/${exam.id}`, { state: { materiaId } });
  };

  return (
    <div className="exam-card">
      <div className="exam-badge">
        <i className="fas fa-file-alt"></i>
        EXAMEN
      </div>
      
      <div className="exam-card-content">
        <h3>{exam.title}</h3>
        {exam.description && (
          <p className="exam-description">{exam.description}</p>
        )}
        
        <div className="exam-info">
          <div className="exam-info-item">
            <i className="fas fa-question-circle"></i>
            <span>{exam.questionsPerStudent} preguntas</span>
          </div>
          <div className="exam-info-item">
            <i className="fas fa-clock"></i>
            <span>{formatTime(totalTime)}</span>
          </div>
          <div className="exam-info-item">
            <i className="fas fa-random"></i>
            <span>Aleatorio</span>
          </div>
        </div>

        {exam.deadline && (
          <div className="exam-deadline">
            <i className="fas fa-calendar-times"></i>
            <span>
              Fecha límite: {new Date(exam.deadline.toDate()).toLocaleDateString()}
            </span>
          </div>
        )}
        
        <button 
          className="start-exam-btn"
          onClick={handleStartExam}
        >
          <i className="fas fa-play"></i>
          Comenzar Examen
        </button>
      </div>
    </div>
  );
};

export default ExamCard;