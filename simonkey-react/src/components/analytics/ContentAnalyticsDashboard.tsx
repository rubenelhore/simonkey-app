import React from 'react';
import { ContentAnalyticsDashboard as ContentData } from '../../services/analyticsService';

interface Props {
  data: ContentData;
}

const ContentAnalyticsDashboard: React.FC<Props> = ({ data }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  return (
    <div className="content-analytics-dashboard">
      <div className="dashboard-section">
        <h2>📚 Análisis de Contenido</h2>
        
        <div className="kpi-cards-grid">
          <div className="kpi-card">
            <i className="fas fa-book"></i>
            <div>
              <h3>Total Cuadernos</h3>
              <p className="kpi-value">{formatNumber(data.overview.totalNotebooks)}</p>
              <span className="kpi-label">Activos: {data.usage.activeNotebooks}</span>
            </div>
          </div>
          
          <div className="kpi-card">
            <i className="fas fa-lightbulb"></i>
            <div>
              <h3>Total Conceptos</h3>
              <p className="kpi-value">{formatNumber(data.overview.totalConcepts)}</p>
              <span className="kpi-label">Promedio: {data.overview.avgConceptsPerNotebook.toFixed(1)}/cuaderno</span>
            </div>
          </div>
          
          <div className="kpi-card">
            <i className="fas fa-file"></i>
            <div>
              <h3>Materiales</h3>
              <p className="kpi-value">{formatNumber(data.overview.totalMaterials)}</p>
              <span className="kpi-label">{data.usage.materialsUploadedGB.toFixed(2)} GB</span>
            </div>
          </div>
        </div>

        <h3>Creación de Contenido</h3>
        <div className="creation-stats">
          <div className="stat-row">
            <span className="label">Cuadernos Hoy:</span>
            <span className="value">{data.creation.notebooksCreatedToday}</span>
          </div>
          <div className="stat-row">
            <span className="label">Cuadernos Esta Semana:</span>
            <span className="value">{data.creation.notebooksCreatedWeek}</span>
          </div>
          <div className="stat-row">
            <span className="label">Cuadernos Este Mes:</span>
            <span className="value">{data.creation.notebooksCreatedMonth}</span>
          </div>
          <div className="stat-row">
            <span className="label">Conceptos Hoy:</span>
            <span className="value">{data.creation.conceptsCreatedToday}</span>
          </div>
          <div className="stat-row">
            <span className="label">Conceptos Esta Semana:</span>
            <span className="value">{data.creation.conceptsCreatedWeek}</span>
          </div>
          <div className="stat-row">
            <span className="label">Conceptos Este Mes:</span>
            <span className="value">{data.creation.conceptsCreatedMonth}</span>
          </div>
        </div>

        <div className="content-lists">
          <div className="list-section">
            <h3>Cuadernos Más Estudiados</h3>
            <div className="content-list">
              {data.quality.mostStudiedNotebooks.map((notebook, idx) => (
                <div key={notebook.id} className="content-item">
                  <span className="rank">#{idx + 1}</span>
                  <span className="title">{notebook.title}</span>
                  <span className="value">{notebook.studySessions} sesiones</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="list-section">
            <h3>Contenido Más Efectivo</h3>
            <div className="content-list">
              {data.quality.mostEffectiveContent.map((content, idx) => (
                <div key={content.id} className="content-item">
                  <span className="rank">#{idx + 1}</span>
                  <span className="title">{content.title}</span>
                  <span className="value">{content.masteryRate.toFixed(1)}% dominio</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="usage-stats">
          <h3>Estadísticas de Uso</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <i className="fas fa-lock-open"></i>
              <p>Activos: {data.usage.activeNotebooks}</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-snowflake"></i>
              <p>Congelados: {data.usage.frozenNotebooks}</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-share-alt"></i>
              <p>Compartidos: {data.usage.sharedNotebooks}</p>
            </div>
            <div className="stat-card">
              <i className="fas fa-brain"></i>
              <p>Dominio Promedio: {data.quality.avgConceptMastery.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentAnalyticsDashboard;