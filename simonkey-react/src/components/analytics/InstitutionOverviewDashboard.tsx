import React from 'react';
import { InstitutionOverviewDashboard as InstitutionData } from '../../services/analyticsService';

interface Props {
  data: InstitutionData;
}

const InstitutionOverviewDashboard: React.FC<Props> = ({ data }) => {
  return (
    <div className="institution-overview-dashboard">
      <div className="dashboard-section">
        <h2>🏫 Vista General de Instituciones</h2>
        
        <div className="kpi-cards-grid">
          <div className="kpi-card">
            <i className="fas fa-building"></i>
            <div>
              <h3>Total Instituciones</h3>
              <p className="kpi-value">{data.summary.totalInstitutions}</p>
            </div>
          </div>
          
          <div className="kpi-card">
            <i className="fas fa-user-graduate"></i>
            <div>
              <h3>Usuarios Escolares</h3>
              <p className="kpi-value">{data.summary.totalSchoolUsers}</p>
            </div>
          </div>
          
          <div className="kpi-card">
            <i className="fas fa-percentage"></i>
            <div>
              <h3>Tasa de Adopción</h3>
              <p className="kpi-value">{data.summary.adoptionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <h3>Top Instituciones</h3>
        <div className="institutions-table">
          <table>
            <thead>
              <tr>
                <th>Institución</th>
                <th>Usuarios</th>
                <th>Profesores</th>
                <th>Estudiantes</th>
                <th>Rendimiento</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {data.institutions.map(inst => (
                <tr key={inst.id}>
                  <td>{inst.name}</td>
                  <td>{inst.userCount}</td>
                  <td>{inst.teacherCount}</td>
                  <td>{inst.studentCount}</td>
                  <td>{inst.avgPerformance.toFixed(0)}</td>
                  <td>{inst.engagementRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rankings-grid">
          <div className="ranking-card">
            <h4>Por Tamaño</h4>
            {data.rankings.bySize.map((inst, idx) => (
              <div key={inst.institutionId} className="ranking-item">
                <span>#{idx + 1}</span>
                <span>{inst.name}</span>
                <span>{inst.users} usuarios</span>
              </div>
            ))}
          </div>
          
          <div className="ranking-card">
            <h4>Por Rendimiento</h4>
            {data.rankings.byPerformance.map((inst, idx) => (
              <div key={inst.institutionId} className="ranking-item">
                <span>#{idx + 1}</span>
                <span>{inst.name}</span>
                <span>{inst.score.toFixed(0)} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstitutionOverviewDashboard;