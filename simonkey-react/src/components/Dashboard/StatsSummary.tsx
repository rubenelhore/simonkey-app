// src/components/Dashboard/StatsSummary.jsx
import React from 'react';

// Define an interface for the stats prop
interface StatsSummaryProps {
  stats: {
    totalConcepts?: number;
    totalNotebooks?: number;
    studyTimeMinutes?: number;
    masteredConcepts?: number;
    studiedToday?: number;
    // Add more properties as needed
  };
}

const StatsSummary = ({ stats }: StatsSummaryProps) => {
  const { totalConcepts, totalNotebooks, studyTimeMinutes, masteredConcepts } = stats;
  
  // Formatear tiempo de estudio en horas y minutos
  const formatStudyTime = () => {
    const totalMinutes = studyTimeMinutes ?? 0;  // Usar 0 si studyTimeMinutes es undefined
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
    }
    
    return `${minutes}m`;
  };
  
  // Calcular porcentaje de dominio
  const masteryPercentage = (() => {
    const concepts = totalConcepts ?? 0;
    const mastered = masteredConcepts ?? 0;
    
    return concepts > 0 ? Math.round((mastered / concepts) * 100) : 0;
  })();
  
  return (
    <div className="stats-summary">
      <h3>Tus Estadísticas</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-book"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalNotebooks}</div>
            <div className="stat-label">Cuadernos</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalConcepts}</div>
            <div className="stat-label">Conceptos</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatStudyTime()}</div>
            <div className="stat-label">Tiempo de estudio</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{masteryPercentage}%</div>
            <div className="stat-label">Conceptos dominados</div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${masteryPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsSummary;