import React from 'react';
import { TeacherAnalyticsDashboard as TeacherData } from '../../services/analyticsService';

interface Props {
  data: TeacherData;
}

const TeacherAnalyticsDashboard: React.FC<Props> = ({ data }) => {
  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  return (
    <div className="teacher-analytics-dashboard">
      <div className="dashboard-section">
        <h2>👨‍🏫 Análisis de Profesores</h2>
        
        <div className="kpi-cards-grid">
          <div className="kpi-card">
            <i className="fas fa-chalkboard-teacher"></i>
            <div>
              <h3>Total Profesores</h3>
              <p className="kpi-value">{data.overview.totalTeachers}</p>
              <span className="kpi-label">Activos: {data.overview.activeTeachers}</span>
            </div>
          </div>
          
          <div className="kpi-card">
            <i className="fas fa-users"></i>
            <div>
              <h3>Estudiantes/Profesor</h3>
              <p className="kpi-value">{data.overview.avgStudentsPerTeacher.toFixed(1)}</p>
            </div>
          </div>
          
          <div className="kpi-card">
            <i className="fas fa-book"></i>
            <div>
              <h3>Materias/Profesor</h3>
              <p className="kpi-value">{data.overview.avgSubjectsPerTeacher.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <h3>Top Profesores por Progreso Estudiantil</h3>
        <div className="top-teachers-list">
          {data.topTeachers.byStudentProgress.map((teacher, idx) => (
            <div key={teacher.teacherId} className="teacher-item">
              <span className="rank">#{idx + 1}</span>
              <span className="name">{teacher.name}</span>
              <span className="value">+{teacher.improvement.toFixed(1)}%</span>
            </div>
          ))}
        </div>

        <h3>Métricas por Materia</h3>
        <div className="subjects-grid">
          {Object.entries(data.subjectMetrics).slice(0, 6).map(([id, subject]) => (
            <div key={id} className="subject-card">
              <h4>{subject.name}</h4>
              <div className="subject-stats">
                <p>Profesores: {subject.teachers}</p>
                <p>Tiempo de estudio: {subject.studyTime.toFixed(0)} min</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherAnalyticsDashboard;