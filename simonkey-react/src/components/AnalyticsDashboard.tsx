import React, { useState, useEffect } from 'react';
import { analyticsService, AnalyticsData } from '../services/analyticsService';
import ExecutiveDashboard from './analytics/ExecutiveDashboard';
import UserAnalyticsDashboard from './analytics/UserAnalyticsDashboard';
import AcademicPerformanceDashboard from './analytics/AcademicPerformanceDashboard';
import TeacherAnalyticsDashboard from './analytics/TeacherAnalyticsDashboard';
import InstitutionOverviewDashboard from './analytics/InstitutionOverviewDashboard';
import ContentAnalyticsDashboard from './analytics/ContentAnalyticsDashboard';
import TechnicalMonitoringDashboard from './analytics/TechnicalMonitoringDashboard';
import '../styles/AnalyticsDashboard.css';

type DashboardType = 'executive' | 'users' | 'academic' | 'teachers' | 'institutions' | 'content' | 'technical';

const AnalyticsDashboard: React.FC = () => {
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardType>('executive');
  const [analyticsData, setAnalyticsData] = useState<Partial<AnalyticsData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const dashboards = [
    { id: 'executive', name: 'Executive Dashboard', icon: 'fas fa-chart-line' },
    { id: 'users', name: 'User Analytics', icon: 'fas fa-users' },
    { id: 'academic', name: 'Academic Performance', icon: 'fas fa-graduation-cap' },
    { id: 'teachers', name: 'Teacher Analytics', icon: 'fas fa-chalkboard-teacher' },
    { id: 'institutions', name: 'Institution Overview', icon: 'fas fa-building' },
    { id: 'content', name: 'Content Analytics', icon: 'fas fa-book' },
    { id: 'technical', name: 'Technical Monitoring', icon: 'fas fa-server' }
  ];

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadAnalytics();
      }, 60000); // Refresh every minute

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await analyticsService.getAllAnalytics();
      setAnalyticsData(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Error al cargar los datos de analytics. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadAnalytics();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `analytics_${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading && Object.keys(analyticsData).length === 0) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Cargando datos de analytics...</p>
      </div>
    );
  }

  if (error && Object.keys(analyticsData).length === 0) {
    return (
      <div className="analytics-error">
        <i className="fas fa-exclamation-triangle"></i>
        <p>{error}</p>
        <button onClick={handleRefresh} className="retry-button">
          <i className="fas fa-redo"></i> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div className="header-left">
          <h1>📊 Analytics Dashboard</h1>
          <p className="last-refresh">
            Última actualización: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="header-controls">
          <button 
            className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-actualización cada minuto"
          >
            <i className="fas fa-sync-alt"></i>
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button onClick={handleRefresh} className="refresh-button" disabled={loading}>
            <i className="fas fa-sync-alt"></i> Actualizar
          </button>
          <button onClick={handleExport} className="export-button">
            <i className="fas fa-download"></i> Exportar
          </button>
        </div>
      </div>

      <div className="dashboard-tabs">
        {dashboards.map(dashboard => (
          <button
            key={dashboard.id}
            className={`dashboard-tab ${selectedDashboard === dashboard.id ? 'active' : ''}`}
            onClick={() => setSelectedDashboard(dashboard.id as DashboardType)}
          >
            <i className={dashboard.icon}></i>
            <span>{dashboard.name}</span>
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Actualizando datos...</p>
          </div>
        )}

        {selectedDashboard === 'executive' && analyticsData.executive && (
          <ExecutiveDashboard data={analyticsData.executive} />
        )}
        
        {selectedDashboard === 'users' && analyticsData.userAnalytics && (
          <UserAnalyticsDashboard data={analyticsData.userAnalytics} />
        )}
        
        {selectedDashboard === 'academic' && analyticsData.academicPerformance && (
          <AcademicPerformanceDashboard data={analyticsData.academicPerformance} />
        )}
        
        {selectedDashboard === 'teachers' && analyticsData.teacherAnalytics && (
          <TeacherAnalyticsDashboard data={analyticsData.teacherAnalytics} />
        )}
        
        {selectedDashboard === 'institutions' && analyticsData.institutionOverview && (
          <InstitutionOverviewDashboard data={analyticsData.institutionOverview} />
        )}
        
        {selectedDashboard === 'content' && analyticsData.contentAnalytics && (
          <ContentAnalyticsDashboard data={analyticsData.contentAnalytics} />
        )}
        
        {selectedDashboard === 'technical' && analyticsData.technicalMonitoring && (
          <TechnicalMonitoringDashboard data={analyticsData.technicalMonitoring} />
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;