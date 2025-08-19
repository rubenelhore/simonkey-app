import React from 'react';
import { AcademicPerformanceDashboard as AcademicData } from '../../services/analyticsService';
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';
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
  data: AcademicData;
}

const AcademicPerformanceDashboard: React.FC<Props> = ({ data }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  // Concepts distribution chart
  const conceptsData = {
    labels: ['Dominados', 'En Progreso'],
    datasets: [{
      data: [
        data.globalMetrics.conceptsMastered,
        data.globalMetrics.conceptsInProgress
      ],
      backgroundColor: [
        '#4CAF50',
        '#FFC107'
      ],
      borderWidth: 0
    }]
  };

  // Learning progress chart
  const forgettingCurveData = {
    labels: data.learningProgress.forgettingCurve.map(d => `Día ${d.day}`),
    datasets: [{
      label: 'Retención (%)',
      data: data.learningProgress.forgettingCurve.map(d => d.retention),
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      tension: 0.4,
      fill: true
    }]
  };

  // Assessment performance comparison
  const assessmentComparisonData = {
    labels: ['Quizzes', 'Exámenes'],
    datasets: [
      {
        label: 'Score Promedio',
        data: [data.assessments.avgQuizScore, data.assessments.avgExamScore],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      },
      {
        label: 'Tasa de Completación',
        data: [data.assessments.quizPassRate, data.assessments.examCompletionRate],
        backgroundColor: 'rgba(255, 206, 86, 0.6)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1
      }
    ]
  };

  // Top performers leaderboard
  const topPerformersData = {
    labels: data.rankings.topPerformers.slice(0, 10).map(p => p.name),
    datasets: [{
      label: 'Score Global',
      data: data.rankings.topPerformers.slice(0, 10).map(p => p.score),
      backgroundColor: [
        '#FFD700', // Gold
        '#C0C0C0', // Silver
        '#CD7F32', // Bronze
        '#4169E1',
        '#4169E1',
        '#4169E1',
        '#4169E1',
        '#4169E1',
        '#4169E1',
        '#4169E1'
      ],
      borderColor: [
        '#FFD700',
        '#C0C0C0',
        '#CD7F32',
        '#4169E1',
        '#4169E1',
        '#4169E1',
        '#4169E1',
        '#4169E1',
        '#4169E1',
        '#4169E1'
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

  const barOptions = {
    ...chartOptions,
    indexAxis: 'y' as const,
    scales: {
      x: {
        beginAtZero: true
      }
    }
  };

  return (
    <div className="academic-performance-dashboard">
      {/* Global Metrics Section */}
      <div className="dashboard-section">
        <h2>🎓 Métricas Globales de Rendimiento</h2>
        <div className="kpi-cards-grid">
          <div className="kpi-card primary">
            <div className="kpi-icon">
              <i className="fas fa-chart-line"></i>
            </div>
            <div className="kpi-content">
              <h3>Score Global Promedio</h3>
              <p className="kpi-value">{data.globalMetrics.avgGlobalScore.toFixed(0)}</p>
              <span className="kpi-label">puntos</span>
            </div>
          </div>

          <div className="kpi-card success">
            <div className="kpi-icon">
              <i className="fas fa-percentage"></i>
            </div>
            <div className="kpi-content">
              <h3>Percentil Promedio</h3>
              <p className="kpi-value">{formatPercentage(data.globalMetrics.avgPercentile)}</p>
              <div className="percentile-bar">
                <div 
                  className="percentile-fill"
                  style={{ width: `${data.globalMetrics.avgPercentile}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="kpi-card warning">
            <div className="kpi-icon">
              <i className="fas fa-brain"></i>
            </div>
            <div className="kpi-content">
              <h3>Conceptos Totales</h3>
              <p className="kpi-value">
                {formatNumber(data.globalMetrics.conceptsMastered + data.globalMetrics.conceptsInProgress)}
              </p>
              <span className="kpi-label">en la plataforma</span>
            </div>
          </div>

          <div className="kpi-card info">
            <div className="kpi-icon">
              <i className="fas fa-graduation-cap"></i>
            </div>
            <div className="kpi-content">
              <h3>Tasa de Dominio</h3>
              <p className="kpi-value">{formatPercentage(data.learningProgress.avgMasteryRate)}</p>
              <span className="kpi-label">conceptos dominados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Learning Progress Section */}
      <div className="dashboard-section">
        <h2>📈 Progreso de Aprendizaje</h2>
        <div className="charts-grid">
          <div className="chart-container">
            <h3>Distribución de Conceptos</h3>
            <div className="chart-wrapper">
              <Doughnut data={conceptsData} options={chartOptions} />
            </div>
            <div className="concept-stats">
              <div className="stat">
                <span className="stat-icon mastered">●</span>
                <span className="stat-label">Dominados:</span>
                <span className="stat-value">{formatNumber(data.globalMetrics.conceptsMastered)}</span>
              </div>
              <div className="stat">
                <span className="stat-icon progress">●</span>
                <span className="stat-label">En Progreso:</span>
                <span className="stat-value">{formatNumber(data.globalMetrics.conceptsInProgress)}</span>
              </div>
            </div>
          </div>

          <div className="chart-container">
            <h3>Curva de Olvido</h3>
            <div className="chart-wrapper">
              <Line data={forgettingCurveData} options={chartOptions} />
            </div>
            <div className="learning-metrics">
              <div className="metric">
                <span className="metric-label">Velocidad de Aprendizaje:</span>
                <span className="metric-value">{data.learningProgress.avgLearningVelocity.toFixed(1)} días</span>
              </div>
              <div className="metric">
                <span className="metric-label">Tasa de Retención:</span>
                <span className="metric-value">{formatPercentage(data.learningProgress.retentionRate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assessments Section */}
      <div className="dashboard-section">
        <h2>📝 Evaluaciones y Exámenes</h2>
        
        <div className="assessment-kpis">
          <div className="kpi-row">
            <div className="kpi-card small">
              <h4>Total Quizzes</h4>
              <p className="value">{formatNumber(data.assessments.totalQuizzes)}</p>
            </div>
            <div className="kpi-card small">
              <h4>Score Promedio Quiz</h4>
              <p className="value">{data.assessments.avgQuizScore.toFixed(1)}/10</p>
            </div>
            <div className="kpi-card small">
              <h4>Tasa de Aprobación</h4>
              <p className="value">{formatPercentage(data.assessments.quizPassRate)}</p>
            </div>
          </div>
          
          <div className="kpi-row">
            <div className="kpi-card small">
              <h4>Total Exámenes</h4>
              <p className="value">{formatNumber(data.assessments.totalExams)}</p>
            </div>
            <div className="kpi-card small">
              <h4>Score Promedio Examen</h4>
              <p className="value">{data.assessments.avgExamScore.toFixed(1)}%</p>
            </div>
            <div className="kpi-card small">
              <h4>Tasa de Completación</h4>
              <p className="value">{formatPercentage(data.assessments.examCompletionRate)}</p>
            </div>
          </div>
        </div>

        <div className="chart-container">
          <h3>Comparación de Rendimiento en Evaluaciones</h3>
          <div className="chart-wrapper">
            <Bar data={assessmentComparisonData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Rankings Section */}
      <div className="dashboard-section">
        <h2>🏆 Rankings y Competencia</h2>
        
        <div className="rankings-stats">
          <div className="stat-card">
            <i className="fas fa-trophy"></i>
            <div>
              <p className="stat-label">Participación en Rankings</p>
              <p className="stat-value">{formatPercentage(data.rankings.competitionParticipation)}</p>
            </div>
          </div>
          <div className="stat-card">
            <i className="fas fa-exchange-alt"></i>
            <div>
              <p className="stat-label">Cambio Promedio de Posición</p>
              <p className="stat-value">±{data.rankings.avgPositionChange.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="leaderboard-container">
          <h3>🥇 Top 10 Performers</h3>
          <div className="leaderboard">
            {data.rankings.topPerformers.slice(0, 10).map((performer, index) => (
              <div key={performer.userId} className={`leaderboard-item rank-${index + 1}`}>
                <div className="rank">
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && `#${index + 1}`}
                </div>
                <div className="performer-info">
                  <span className="name">{performer.name}</span>
                  <span className="score">{formatNumber(performer.score)} pts</span>
                </div>
                <div className="score-bar">
                  <div 
                    className="score-fill"
                    style={{ 
                      width: `${(performer.score / data.rankings.topPerformers[0].score) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-container">
          <h3>Distribución de Scores - Top 10</h3>
          <div className="chart-wrapper">
            <Bar data={topPerformersData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="dashboard-section">
        <h2>💡 Insights de Rendimiento</h2>
        <div className="insights-grid">
          <div className="insight-card">
            <i className="fas fa-chart-line"></i>
            <h3>Tendencia de Aprendizaje</h3>
            <p>
              El {formatPercentage(data.learningProgress.avgMasteryRate)} de los conceptos 
              han sido dominados con una velocidad promedio de {data.learningProgress.avgLearningVelocity.toFixed(1)} días.
            </p>
          </div>

          <div className="insight-card">
            <i className="fas fa-brain"></i>
            <h3>Retención de Conocimiento</h3>
            <p>
              La tasa de retención actual es del {formatPercentage(data.learningProgress.retentionRate)}, 
              siguiendo la curva de olvido esperada.
            </p>
          </div>

          <div className="insight-card">
            <i className="fas fa-medal"></i>
            <h3>Competitividad</h3>
            <p>
              {formatPercentage(data.rankings.competitionParticipation)} de los usuarios 
              participan activamente en los rankings con un cambio promedio 
              de ±{data.rankings.avgPositionChange.toFixed(1)} posiciones.
            </p>
          </div>

          <div className="insight-card">
            <i className="fas fa-clipboard-check"></i>
            <h3>Evaluaciones</h3>
            <p>
              Los quizzes tienen una tasa de aprobación del {formatPercentage(data.assessments.quizPassRate)}, 
              mientras que los exámenes se completan en un {formatPercentage(data.assessments.examCompletionRate)}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcademicPerformanceDashboard;