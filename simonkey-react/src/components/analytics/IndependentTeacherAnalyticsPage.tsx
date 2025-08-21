import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TeacherAnalyticsService, TeacherAnalyticsData } from '../../services/teacherAnalyticsService';
import HeaderWithHamburger from '../HeaderWithHamburger';
import '../../styles/TeacherAnalytics.css';

const IndependentTeacherAnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<TeacherAnalyticsData | null>(null);
  const [materiasData, setMateriasData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📊 Loading analytics for teacher:', user.uid);
      
      // Load teacher analytics
      const analytics = await TeacherAnalyticsService.getTeacherAnalytics(user.uid);
      setAnalyticsData(analytics);
      
      // Load materias analytics
      const materias = await TeacherAnalyticsService.getMateriasAnalytics(user.uid);
      setMateriasData(materias);
      
      console.log('✅ Analytics loaded successfully');
    } catch (err) {
      console.error('❌ Error loading analytics:', err);
      setError('Error al cargar las analíticas. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <HeaderWithHamburger
          title="Analytics del Aula"
          subtitle="Métricas y estadísticas de tu clase"
          themeColor="#667eea"
        />
        <div className="analytics-container">
          <div className="analytics-loading">
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: '#667eea' }}></i>
            <p>Cargando analíticas...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !analyticsData) {
    return (
      <>
        <HeaderWithHamburger
          title="Analytics del Aula"
          subtitle="Métricas y estadísticas de tu clase"
          themeColor="#667eea"
        />
        <div className="analytics-container">
          <div className="analytics-error">
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '3rem', color: '#ff6b6b' }}></i>
            <p>{error || 'No hay datos disponibles'}</p>
            <button onClick={loadAnalytics} className="retry-button">
              <i className="fas fa-redo"></i> Reintentar
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderWithHamburger
        title="Analytics del Aula"
        subtitle="Métricas y estadísticas de tu clase"
        themeColor="#667eea"
      />
      <div className="analytics-container">
        <div className="analytics-dashboard">
          {/* Overview Cards */}
          <div className="analytics-overview">
            <div className="stat-card">
              <div className="stat-icon students">
                <i className="fas fa-users"></i>
              </div>
              <div className="stat-content">
                <h3>Total Estudiantes</h3>
                <p className="stat-value">{analyticsData.overview.totalStudents}</p>
                <span className="stat-label">
                  {analyticsData.overview.activeStudents} activos esta semana
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon materias">
                <i className="fas fa-book"></i>
              </div>
              <div className="stat-content">
                <h3>Materias</h3>
                <p className="stat-value">{analyticsData.overview.totalMaterias}</p>
                <span className="stat-label">Materias activas</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon exams">
                <i className="fas fa-clipboard-list"></i>
              </div>
              <div className="stat-content">
                <h3>Exámenes</h3>
                <p className="stat-value">{analyticsData.overview.totalExams}</p>
                <span className="stat-label">
                  {analyticsData.examMetrics.totalAttempts} intentos totales
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon engagement">
                <i className="fas fa-chart-line"></i>
              </div>
              <div className="stat-content">
                <h3>Engagement</h3>
                <p className="stat-value">{analyticsData.overview.avgEngagement.toFixed(1)}%</p>
                <span className="stat-label">Tasa de participación</span>
              </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="analytics-section">
            <h2>Progreso de Estudiantes</h2>
            <div className="progress-grid">
              <div className="progress-card">
                <h4>Puntuación Promedio</h4>
                <div className="progress-value">
                  {analyticsData.studentProgress.avgScore.toFixed(0)} pts
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${Math.min(analyticsData.studentProgress.avgScore / 1000 * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="progress-card">
                <h4>Tasa de Completación</h4>
                <div className="progress-value">
                  {analyticsData.studentProgress.completionRate.toFixed(1)}%
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${analyticsData.studentProgress.completionRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Materias Section */}
          {materiasData.length > 0 && (
            <div className="analytics-section">
              <h2>Análisis por Materia</h2>
              <div className="materias-table">
                <table>
                  <thead>
                    <tr>
                      <th>Materia</th>
                      <th>Estudiantes</th>
                      <th>Exámenes</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiasData.map(materia => (
                      <tr key={materia.id}>
                        <td>{materia.name}</td>
                        <td>{materia.studentCount}</td>
                        <td>{materia.examCount}</td>
                        <td>
                          <span className={`status-badge ${materia.isActive ? 'active' : 'inactive'}`}>
                            {materia.isActive ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Activity Section */}
          <div className="analytics-section">
            <h2>Actividad Reciente</h2>
            <div className="activity-cards">
              <div className="activity-card">
                <i className="fas fa-calendar-week"></i>
                <div className="activity-content">
                  <h4>Última Semana</h4>
                  <p>{analyticsData.recentActivity.lastWeekActive} estudiantes activos</p>
                </div>
              </div>
              <div className="activity-card">
                <i className="fas fa-calendar-alt"></i>
                <div className="activity-content">
                  <h4>Último Mes</h4>
                  <p>{analyticsData.recentActivity.lastMonthActive} estudiantes activos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default IndependentTeacherAnalyticsPage;