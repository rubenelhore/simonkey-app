import React, { useState, useEffect } from 'react';
import { analyticsService, TeacherAnalyticsDashboard as TeacherData } from '../../services/analyticsService';
import TeacherAnalyticsDashboard from './TeacherAnalyticsDashboard';

const TeacherAnalyticsPage: React.FC = () => {
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTeacherAnalytics();
  }, []);

  const loadTeacherAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await analyticsService.getAllAnalytics();
      if (data.teacherAnalytics) {
        setTeacherData(data.teacherAnalytics);
      } else {
        setError('No se encontraron datos de analíticas de profesores');
      }
    } catch (err) {
      console.error('Error loading teacher analytics:', err);
      setError('Error al cargar los datos de analíticas. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Cargando analíticas de profesores...</p>
      </div>
    );
  }

  if (error || !teacherData) {
    return (
      <div className="analytics-error">
        <i className="fas fa-exclamation-triangle"></i>
        <p>{error || 'No hay datos disponibles'}</p>
        <button onClick={loadTeacherAnalytics} className="retry-button">
          <i className="fas fa-redo"></i> Reintentar
        </button>
      </div>
    );
  }

  return <TeacherAnalyticsDashboard data={teacherData} />;
};

export default TeacherAnalyticsPage;