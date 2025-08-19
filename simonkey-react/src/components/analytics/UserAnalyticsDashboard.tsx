import React from 'react';
import { UserAnalyticsDashboard as UserAnalyticsData } from '../../services/analyticsService';
import { Bar, Line, Pie, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  data: UserAnalyticsData;
}

const UserAnalyticsDashboard: React.FC<Props> = ({ data }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}m`;
    }
    return `${Math.round(minutes)}m`;
  };

  // Age distribution chart
  const ageDistributionData = {
    labels: Object.keys(data.demographics.byAge),
    datasets: [{
      label: 'Usuarios por Edad',
      data: Object.values(data.demographics.byAge),
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40',
        '#FF6384'
      ]
    }]
  };

  // Subscription distribution chart
  const subscriptionData = {
    labels: Object.keys(data.demographics.bySubscription).map(s => 
      s.charAt(0).toUpperCase() + s.slice(1)
    ),
    datasets: [{
      data: Object.values(data.demographics.bySubscription),
      backgroundColor: [
        '#8b9dc3',
        '#3b5998',
        '#4CAF50',
        '#FF9800',
        '#9C27B0'
      ]
    }]
  };

  // Role distribution chart
  const roleData = {
    labels: Object.keys(data.demographics.byRole).map(r => {
      const roleNames: { [key: string]: string } = {
        'individual': 'Individual',
        'student': 'Estudiante',
        'teacher': 'Profesor',
        'admin': 'Administrador',
        'tutor': 'Tutor'
      };
      return roleNames[r] || r;
    }),
    datasets: [{
      label: 'Usuarios por Rol',
      data: Object.values(data.demographics.byRole),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }]
  };

  // Peak hours chart
  const peakHoursData = {
    labels: data.behavior.peakHours.map(h => `${h.hour}:00`),
    datasets: [{
      label: 'Actividad por Hora',
      data: data.behavior.peakHours.map(h => h.count),
      backgroundColor: 'rgba(255, 159, 64, 0.6)',
      borderColor: 'rgba(255, 159, 64, 1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4
    }]
  };

  // Weekday activity chart
  const weekdayData = {
    labels: Object.keys(data.behavior.weekdayActivity).map(d => 
      d.charAt(0).toUpperCase() + d.slice(1)
    ),
    datasets: [{
      label: 'Actividad por Día',
      data: Object.values(data.behavior.weekdayActivity),
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)',
        'rgba(153, 102, 255, 0.6)',
        'rgba(255, 159, 64, 0.6)',
        'rgba(199, 199, 199, 0.6)'
      ]
    }]
  };

  // Retention funnel chart
  const retentionData = {
    labels: ['Día 1', 'Día 7', 'Día 30'],
    datasets: [{
      label: 'Retención (%)',
      data: [data.retention.day1, data.retention.day7, data.retention.day30],
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2,
      barThickness: 60
    }]
  };

  // Engagement radar chart
  const engagementRadarData = {
    labels: [
      'Streaks Activos',
      'Duración Promedio',
      'Sesiones/Usuario',
      'Retención D30',
      'Tiempo de Estudio'
    ],
    datasets: [{
      label: 'Métricas de Engagement',
      data: [
        (data.engagement.activeStreaks / 100) * 100, // Normalize to 0-100
        Math.min(100, data.engagement.avgStreakLength * 10),
        Math.min(100, data.engagement.studySessionsPerUser * 10),
        data.retention.day30,
        Math.min(100, data.behavior.avgStudyTime / 60 * 10)
      ],
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      pointBackgroundColor: 'rgba(255, 99, 132, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(255, 99, 132, 1)'
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      }
    }
  };

  const radarOptions = {
    ...chartOptions,
    scales: {
      r: {
        beginAtZero: true,
        max: 100
      }
    }
  };

  return (
    <div className="user-analytics-dashboard">
      {/* Demographics Section */}
      <div className="dashboard-section">
        <h2>👥 Demografía de Usuarios</h2>
        <div className="demographics-grid">
          <div className="chart-container">
            <h3>Distribución por Edad</h3>
            <div className="chart-wrapper">
              <Pie data={ageDistributionData} options={chartOptions} />
            </div>
          </div>

          <div className="chart-container">
            <h3>Distribución por Suscripción</h3>
            <div className="chart-wrapper">
              <Pie data={subscriptionData} options={chartOptions} />
            </div>
            <div className="subscription-stats">
              {Object.entries(data.demographics.bySubscription).map(([key, value]) => (
                <div key={key} className="stat-row">
                  <span className="stat-label">{key}:</span>
                  <span className="stat-value">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-container">
            <h3>Distribución por Rol</h3>
            <div className="chart-wrapper">
              <Bar data={roleData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Behavior Patterns Section */}
      <div className="dashboard-section">
        <h2>🔍 Patrones de Comportamiento</h2>
        
        <div className="behavior-kpis">
          <div className="kpi-card">
            <i className="fas fa-clock"></i>
            <div>
              <h4>Tiempo Promedio de Estudio</h4>
              <p className="kpi-value">{formatTime(data.behavior.avgStudyTime)}</p>
              <span className="kpi-label">por usuario</span>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-container">
            <h3>Horas Pico de Actividad</h3>
            <div className="chart-wrapper">
              <Line data={peakHoursData} options={chartOptions} />
            </div>
            <div className="peak-hours-list">
              <h4>Top 3 Horas:</h4>
              {data.behavior.peakHours.slice(0, 3).map((hour, idx) => (
                <div key={idx} className="peak-hour-item">
                  <span className="rank">#{idx + 1}</span>
                  <span className="hour">{hour.hour}:00</span>
                  <span className="count">{hour.count} sesiones</span>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-container">
            <h3>Actividad por Día de la Semana</h3>
            <div className="chart-wrapper">
              <Bar data={weekdayData} options={chartOptions} />
            </div>
            <div className="weekday-insights">
              {(() => {
                const days = Object.entries(data.behavior.weekdayActivity);
                const maxDay = days.reduce((max, curr) => 
                  curr[1] > max[1] ? curr : max
                );
                const minDay = days.reduce((min, curr) => 
                  curr[1] < min[1] ? curr : min
                );
                return (
                  <>
                    <p className="insight">
                      <i className="fas fa-arrow-up"></i>
                      Mayor actividad: <strong>{maxDay[0]}</strong> ({maxDay[1]} sesiones)
                    </p>
                    <p className="insight">
                      <i className="fas fa-arrow-down"></i>
                      Menor actividad: <strong>{minDay[0]}</strong> ({minDay[1]} sesiones)
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Retention & Engagement Section */}
      <div className="dashboard-section">
        <h2>📈 Retención y Engagement</h2>
        
        <div className="retention-kpis">
          <div className="kpi-card success">
            <div className="kpi-icon">
              <i className="fas fa-user-check"></i>
            </div>
            <div className="kpi-content">
              <h4>Retención D1</h4>
              <p className="kpi-value">{formatPercentage(data.retention.day1)}</p>
            </div>
          </div>

          <div className="kpi-card warning">
            <div className="kpi-icon">
              <i className="fas fa-user-clock"></i>
            </div>
            <div className="kpi-content">
              <h4>Retención D7</h4>
              <p className="kpi-value">{formatPercentage(data.retention.day7)}</p>
            </div>
          </div>

          <div className="kpi-card info">
            <div className="kpi-icon">
              <i className="fas fa-user-friends"></i>
            </div>
            <div className="kpi-content">
              <h4>Retención D30</h4>
              <p className="kpi-value">{formatPercentage(data.retention.day30)}</p>
            </div>
          </div>

          <div className="kpi-card danger">
            <div className="kpi-icon">
              <i className="fas fa-user-times"></i>
            </div>
            <div className="kpi-content">
              <h4>Churn Rate</h4>
              <p className="kpi-value">{formatPercentage(data.retention.churnRate)}</p>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-container">
            <h3>Funnel de Retención</h3>
            <div className="chart-wrapper">
              <Bar data={retentionData} options={{
                ...chartOptions,
                indexAxis: 'y' as const,
                scales: {
                  x: {
                    beginAtZero: true,
                    max: 100
                  }
                }
              }} />
            </div>
          </div>

          <div className="chart-container">
            <h3>Métricas de Engagement</h3>
            <div className="chart-wrapper">
              <Radar data={engagementRadarData} options={radarOptions} />
            </div>
          </div>
        </div>

        <div className="engagement-stats">
          <h3>📊 Estadísticas de Engagement</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <i className="fas fa-fire"></i>
              <div>
                <p className="stat-label">Streaks Activos</p>
                <p className="stat-value">{data.engagement.activeStreaks}</p>
              </div>
            </div>
            <div className="stat-card">
              <i className="fas fa-calendar-check"></i>
              <div>
                <p className="stat-label">Streak Promedio</p>
                <p className="stat-value">{data.engagement.avgStreakLength.toFixed(1)} días</p>
              </div>
            </div>
            <div className="stat-card">
              <i className="fas fa-trophy"></i>
              <div>
                <p className="stat-label">Streak Más Largo</p>
                <p className="stat-value">{data.engagement.longestStreak} días</p>
              </div>
            </div>
            <div className="stat-card">
              <i className="fas fa-book-reader"></i>
              <div>
                <p className="stat-label">Sesiones/Usuario</p>
                <p className="stat-value">{data.engagement.studySessionsPerUser.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Segments */}
      <div className="dashboard-section">
        <h2>🎯 Segmentos de Usuarios</h2>
        <div className="segments-grid">
          <div className="segment-card power-users">
            <h3>Power Users</h3>
            <p className="segment-description">
              Usuarios con streak &gt; 7 días y &gt; 10 sesiones
            </p>
            <div className="segment-metric">
              <span className="metric-value">
                {Math.round(data.engagement.activeStreaks * 0.2)}
              </span>
              <span className="metric-label">usuarios</span>
            </div>
          </div>

          <div className="segment-card at-risk">
            <h3>En Riesgo</h3>
            <p className="segment-description">
              Usuarios sin actividad en últimos 7 días
            </p>
            <div className="segment-metric">
              <span className="metric-value">
                {Math.round(data.retention.churnRate * 10)}
              </span>
              <span className="metric-label">usuarios</span>
            </div>
          </div>

          <div className="segment-card new-users">
            <h3>Nuevos Usuarios</h3>
            <p className="segment-description">
              Registrados en últimos 30 días
            </p>
            <div className="segment-metric">
              <span className="metric-value">
                {Math.round(100 - data.retention.day30)}%
              </span>
              <span className="metric-label">del total</span>
            </div>
          </div>

          <div className="segment-card engaged">
            <h3>Engaged</h3>
            <p className="segment-description">
              Usuarios activos semanalmente
            </p>
            <div className="segment-metric">
              <span className="metric-value">
                {Math.round(data.retention.day7)}%
              </span>
              <span className="metric-label">engagement rate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAnalyticsDashboard;