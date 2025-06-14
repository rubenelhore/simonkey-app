import React, { useState, useEffect } from 'react';
import { StudyDashboardData, Notebook } from '../types/interfaces';
import '../styles/StudyDashboard.css';

interface StudyDashboardProps {
  notebook: Notebook | null;
  userId: string;
  onRefresh?: () => void;
}

const StudyDashboard: React.FC<StudyDashboardProps> = ({ 
  notebook, 
  userId, 
  onRefresh 
}) => {
  const [dashboardData, setDashboardData] = useState<StudyDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos del dashboard
  useEffect(() => {
    if (notebook && userId) {
      loadDashboardData();
    }
  }, [notebook, userId]);

  const loadDashboardData = async () => {
    if (!notebook || !userId) return;

    try {
      setLoading(true);
      setError(null);

      // TODO: Implementar lógica real de carga de datos
      // Por ahora usamos datos mock para la estructura
      const mockData: StudyDashboardData = {
        generalScore: 1250,
        nextSmartStudyDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana
        nextQuizDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // En una semana
        smartStudiesCount: 25,
        maxQuizScore: 50,
        isFreeStudyAvailable: true,
        lastFreeStudyDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // Hace 2 días
      };

      setDashboardData(mockData);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Si es mañana
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Mañana';
    }
    
    // Si es la próxima semana
    if (date.toDateString() === nextWeek.toDateString()) {
      return 'Próximo ' + date.toLocaleDateString('es-ES', { weekday: 'long' });
    }

    // Si es hoy
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    }

    // Formato normal
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatScore = (score: number): string => {
    if (score >= 1000) {
      return `${(score / 1000).toFixed(1)}k`;
    }
    return score.toString();
  };

  const getScoreColor = (score: number): string => {
    if (score >= 1000) return '#10B981'; // Verde
    if (score >= 500) return '#F59E0B';  // Amarillo
    return '#EF4444'; // Rojo
  };

  const getAvailabilityColor = (isAvailable: boolean): string => {
    return isAvailable ? '#10B981' : '#6B7280';
  };

  if (loading) {
    return (
      <div className="study-dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="study-dashboard">
        <div className="dashboard-error">
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <div className="study-dashboard">
      <div className="dashboard-header">
        <h3>Dashboard de Estudio</h3>
        <button 
          onClick={onRefresh || loadDashboardData} 
          className="refresh-button"
          title="Actualizar datos"
        >
          🔄
        </button>
      </div>

      <div className="dashboard-grid">
        {/* Score General */}
        <div className="dashboard-card score-card">
          <div className="card-header">
            <h4>Score General</h4>
            <div className="card-icon">🏆</div>
          </div>
          <div className="card-content">
            <div 
              className="score-value"
              style={{ color: getScoreColor(dashboardData.generalScore) }}
            >
              {formatScore(dashboardData.generalScore)}
            </div>
            <div className="score-description">
              {dashboardData.smartStudiesCount} estudios × {dashboardData.maxQuizScore} pts
            </div>
          </div>
        </div>

        {/* Próximo Estudio Inteligente */}
        <div className="dashboard-card study-card">
          <div className="card-header">
            <h4>Próximo Estudio Inteligente</h4>
            <div className="card-icon">🧠</div>
          </div>
          <div className="card-content">
            <div className="date-value">
              {formatDate(dashboardData.nextSmartStudyDate)}
            </div>
            <div className="date-description">
              Disponible para repaso
            </div>
          </div>
        </div>

        {/* Próximo Quiz */}
        <div className="dashboard-card quiz-card">
          <div className="card-header">
            <h4>Próximo Quiz</h4>
            <div className="card-icon">📝</div>
          </div>
          <div className="card-content">
            <div className="date-value">
              {formatDate(dashboardData.nextQuizDate)}
            </div>
            <div className="date-description">
              Máximo 1 por semana
            </div>
          </div>
        </div>

        {/* Estado Estudio Libre */}
        <div className="dashboard-card free-study-card">
          <div className="card-header">
            <h4>Estudio Libre</h4>
            <div className="card-icon">🎯</div>
          </div>
          <div className="card-content">
            <div 
              className="availability-status"
              style={{ color: getAvailabilityColor(dashboardData.isFreeStudyAvailable) }}
            >
              {dashboardData.isFreeStudyAvailable ? 'Disponible' : 'Usado hoy'}
            </div>
            <div className="availability-description">
              Máximo 1 por día
            </div>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="dashboard-info">
        <p>
          <strong>Score General:</strong> Estudios inteligentes completados × Puntuación máxima del quiz
        </p>
        <p>
          <strong>Estudio Inteligente:</strong> Algoritmo SM-3 con candado de 5 segundos por concepto
        </p>
        <p>
          <strong>Quiz:</strong> 10 conceptos aleatorios, 10 minutos, puntuación × tiempo restante
        </p>
      </div>
    </div>
  );
};

export default StudyDashboard; 