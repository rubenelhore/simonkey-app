import React from 'react';
import { TechnicalMonitoringDashboard as TechnicalData } from '../../services/analyticsService';

interface Props {
  data: TechnicalData;
}

const TechnicalMonitoringDashboard: React.FC<Props> = ({ data }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  return (
    <div className="technical-monitoring-dashboard">
      <div className="dashboard-section">
        <h2>🔧 Monitoreo Técnico</h2>
        
        <div className="kpi-cards-grid">
          <div className={`kpi-card ${data.system.uptime >= 99 ? 'success' : 'warning'}`}>
            <i className="fas fa-server"></i>
            <div>
              <h3>Uptime</h3>
              <p className="kpi-value">{data.system.uptime.toFixed(2)}%</p>
            </div>
          </div>
          
          <div className={`kpi-card ${data.system.errorsLast24h > 10 ? 'danger' : 'success'}`}>
            <i className="fas fa-exclamation-triangle"></i>
            <div>
              <h3>Errores (24h)</h3>
              <p className="kpi-value">{data.system.errorsLast24h}</p>
              <span className="kpi-label">Total: {data.system.totalErrors}</span>
            </div>
          </div>
          
          <div className="kpi-card">
            <i className="fas fa-database"></i>
            <div>
              <h3>Almacenamiento</h3>
              <p className="kpi-value">{data.storage.totalStorageGB.toFixed(2)} GB</p>
            </div>
          </div>
          
          <div className="kpi-card">
            <i className="fas fa-tachometer-alt"></i>
            <div>
              <h3>Tiempo de Respuesta</h3>
              <p className="kpi-value">{data.performance.avgResponseTime}ms</p>
            </div>
          </div>
        </div>

        <div className="monitoring-grid">
          <div className="monitoring-section">
            <h3>Errores por Tipo</h3>
            <div className="error-list">
              {Object.entries(data.system.errorsByType).map(([type, count]) => (
                <div key={type} className="error-item">
                  <span className="error-type">{type}:</span>
                  <span className="error-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="monitoring-section">
            <h3>Autenticación</h3>
            <div className="auth-stats">
              <p>Total Logins: {formatNumber(data.authentication.totalLogins)}</p>
              <p>Failed Logins: {data.authentication.failedLogins}</p>
              <p>Password Resets: {data.authentication.passwordResets}</p>
              <p>Credenciales Temporales: {data.authentication.activeTemporaryCredentials}</p>
            </div>
          </div>
        </div>

        <div className="monitoring-section">
          <h3>Almacenamiento por Tipo</h3>
          <div className="storage-grid">
            {Object.entries(data.storage.storageByType).map(([type, size]) => (
              <div key={type} className="storage-item">
                <span className="storage-type">{type}</span>
                <span className="storage-size">{size.toFixed(3)} GB</span>
              </div>
            ))}
          </div>
        </div>

        <div className="monitoring-section">
          <h3>Archivos Más Grandes</h3>
          <div className="files-list">
            {data.storage.largestFiles.map((file, idx) => (
              <div key={idx} className="file-item">
                <span className="file-rank">#{idx + 1}</span>
                <span className="file-name">{file.name}</span>
                <span className="file-type">{file.type}</span>
                <span className="file-size">{file.size.toFixed(2)} MB</span>
              </div>
            ))}
          </div>
        </div>

        <div className="monitoring-section">
          <h3>Queries Más Lentas</h3>
          <div className="queries-list">
            {data.performance.slowestQueries.map((query, idx) => (
              <div key={idx} className="query-item">
                <span className="query-name">{query.query}</span>
                <span className="query-time">{query.time}ms</span>
              </div>
            ))}
          </div>
        </div>

        <div className="monitoring-section">
          <h3>API Calls por Servicio</h3>
          <div className="api-calls-grid">
            {Object.entries(data.performance.apiCallsByService).map(([service, calls]) => (
              <div key={service} className="api-call-item">
                <span className="service-name">{service}</span>
                <span className="call-count">{formatNumber(calls)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalMonitoringDashboard;