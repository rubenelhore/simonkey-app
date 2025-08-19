import React from 'react';
import { ExecutiveDashboard as ExecutiveDashboardData } from '../../services/analyticsService';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
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
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Props {
  data: ExecutiveDashboardData;
}

const ExecutiveDashboard: React.FC<Props> = ({ data }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  // User distribution chart
  const userDistributionData = {
    labels: ['Free', 'Pro', 'School', 'University', 'Super Admin'],
    datasets: [{
      data: [
        data.usersBySubscription.free,
        data.usersBySubscription.pro,
        data.usersBySubscription.school,
        data.usersBySubscription.university,
        data.usersBySubscription.super_admin
      ],
      backgroundColor: [
        '#8b9dc3',
        '#3b5998',
        '#4CAF50',
        '#FF9800',
        '#9C27B0'
      ],
      borderWidth: 0
    }]
  };

  // Growth trend chart
  const growthTrendData = {
    labels: ['Mes Anterior', 'Este Mes'],
    datasets: [{
      label: 'Nuevos Usuarios',
      data: [data.growth.usersLastMonth, data.growth.usersThisMonth],
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 2,
      fill: true
    }]
  };

  // Active users comparison
  const activeUsersData = {
    labels: ['Diario', 'Semanal', 'Mensual'],
    datasets: [{
      label: 'Usuarios Activos',
      data: [
        data.activeUsers.daily,
        data.activeUsers.weekly,
        data.activeUsers.monthly
      ],
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)'
      ],
      borderWidth: 1
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

  return (
    <div className="executive-dashboard">
      {/* KPI Cards Row 1 */}
      <div className="kpi-cards-grid">
        <div className="kpi-card primary">
          <div className="kpi-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="kpi-content">
            <h3>Total Usuarios</h3>
            <p className="kpi-value">{formatNumber(data.totalUsers)}</p>
            <span className="kpi-change positive">
              <i className="fas fa-arrow-up"></i> +{formatPercentage(data.growth.growthRate)}
            </span>
          </div>
        </div>

        <div className="kpi-card success">
          <div className="kpi-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="kpi-content">
            <h3>DAU/MAU Ratio</h3>
            <p className="kpi-value">{formatPercentage(data.engagement.dauMauRatio * 100)}</p>
            <span className="kpi-label">Engagement Rate</span>
          </div>
        </div>

        <div className="kpi-card warning">
          <div className="kpi-icon">
            <i className="fas fa-dollar-sign"></i>
          </div>
          <div className="kpi-content">
            <h3>MRR</h3>
            <p className="kpi-value">{formatCurrency(data.revenue.mrr)}</p>
            <span className="kpi-label">Proyectado: {formatCurrency(data.revenue.projectedMrr)}</span>
          </div>
        </div>

        <div className="kpi-card info">
          <div className="kpi-icon">
            <i className="fas fa-heartbeat"></i>
          </div>
          <div className="kpi-content">
            <h3>Platform Health</h3>
            <p className="kpi-value">{data.platformHealth.score.toFixed(0)}/100</p>
            <div className="health-bar">
              <div 
                className="health-bar-fill"
                style={{ width: `${data.platformHealth.score}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Users Section */}
      <div className="dashboard-section">
        <h2>📊 Usuarios Activos</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <h4>Usuarios Activos Diarios (DAU)</h4>
            <p className="metric-value">{formatNumber(data.activeUsers.daily)}</p>
            <div className="metric-chart">
              <div className="mini-bar-chart">
                <div 
                  className="bar-fill daily"
                  style={{ height: `${(data.activeUsers.daily / data.totalUsers) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <h4>Usuarios Activos Semanales (WAU)</h4>
            <p className="metric-value">{formatNumber(data.activeUsers.weekly)}</p>
            <div className="metric-chart">
              <div className="mini-bar-chart">
                <div 
                  className="bar-fill weekly"
                  style={{ height: `${(data.activeUsers.weekly / data.totalUsers) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <h4>Usuarios Activos Mensuales (MAU)</h4>
            <p className="metric-value">{formatNumber(data.activeUsers.monthly)}</p>
            <div className="metric-chart">
              <div className="mini-bar-chart">
                <div 
                  className="bar-fill monthly"
                  style={{ height: `${(data.activeUsers.monthly / data.totalUsers) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-container">
          <h3>Distribución de Usuarios por Suscripción</h3>
          <div className="chart-wrapper">
            <Doughnut data={userDistributionData} options={chartOptions} />
          </div>
          <div className="chart-legend">
            {Object.entries(data.usersBySubscription).map(([key, value]) => (
              <div key={key} className="legend-item">
                <span className="legend-label">{key}:</span>
                <span className="legend-value">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-container">
          <h3>Crecimiento de Usuarios</h3>
          <div className="chart-wrapper">
            <Line data={growthTrendData} options={chartOptions} />
          </div>
          <div className="growth-stats">
            <div className="stat">
              <span className="stat-label">Tasa de Crecimiento:</span>
              <span className={`stat-value ${data.growth.growthRate >= 0 ? 'positive' : 'negative'}`}>
                {data.growth.growthRate >= 0 ? '+' : ''}{formatPercentage(data.growth.growthRate)}
              </span>
            </div>
          </div>
        </div>

        <div className="chart-container">
          <h3>Comparación de Usuarios Activos</h3>
          <div className="chart-wrapper">
            <Bar data={activeUsersData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Engagement & Revenue Metrics */}
      <div className="dashboard-section">
        <h2>💰 Métricas de Revenue & Engagement</h2>
        <div className="revenue-grid">
          <div className="revenue-card">
            <h4>Tasa de Conversión</h4>
            <div className="revenue-metric">
              <span className="revenue-value">{formatPercentage(data.revenue.conversionRate)}</span>
              <span className="revenue-label">Free → Paid</span>
            </div>
            <div className="conversion-funnel">
              <div className="funnel-stage">
                <div className="funnel-bar free" style={{ width: '100%' }}></div>
                <span>Free ({data.usersBySubscription.free})</span>
              </div>
              <div className="funnel-stage">
                <div 
                  className="funnel-bar paid" 
                  style={{ width: `${data.revenue.conversionRate}%` }}
                ></div>
                <span>Paid ({data.usersBySubscription.pro + data.usersBySubscription.school + data.usersBySubscription.university})</span>
              </div>
            </div>
          </div>

          <div className="revenue-card">
            <h4>Métricas de Engagement</h4>
            <div className="engagement-metrics">
              <div className="engagement-item">
                <span className="label">Sesiones/Usuario:</span>
                <span className="value">{data.engagement.avgSessionsPerUser.toFixed(1)}</span>
              </div>
              <div className="engagement-item">
                <span className="label">Duración Promedio:</span>
                <span className="value">{data.engagement.avgSessionDuration.toFixed(0)} min</span>
              </div>
              <div className="engagement-item">
                <span className="label">Streaks Activos:</span>
                <span className="value">{data.platformHealth.activeStreaks}</span>
              </div>
              <div className="engagement-item">
                <span className="label">Contenido/Día:</span>
                <span className="value">{data.platformHealth.contentCreationRate.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-item">
          <i className="fas fa-user-plus"></i>
          <div>
            <p className="stat-value">{data.growth.usersThisMonth}</p>
            <p className="stat-label">Nuevos este mes</p>
          </div>
        </div>
        <div className="stat-item">
          <i className="fas fa-fire"></i>
          <div>
            <p className="stat-value">{data.platformHealth.activeStreaks}</p>
            <p className="stat-label">Streaks Activos</p>
          </div>
        </div>
        <div className="stat-item">
          <i className="fas fa-book"></i>
          <div>
            <p className="stat-value">{(data.platformHealth.contentCreationRate * 7).toFixed(0)}</p>
            <p className="stat-label">Contenido/Semana</p>
          </div>
        </div>
        <div className="stat-item">
          <i className="fas fa-clock"></i>
          <div>
            <p className="stat-value">{data.engagement.avgSessionDuration.toFixed(0)}</p>
            <p className="stat-label">Min/Sesión</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;