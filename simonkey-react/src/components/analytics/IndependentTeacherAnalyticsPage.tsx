import React from 'react';
import HeaderWithHamburger from '../HeaderWithHamburger';
import TeacherStudentAnalytics from '../TeacherStudentAnalytics';
import '../../styles/TeacherAnalytics.css';

const IndependentTeacherAnalyticsPage: React.FC = () => {
  return (
    <>
      <HeaderWithHamburger
        title="Analytics del Aula"
        subtitle="Análisis de Estudiantes"
        themeColor="#667eea"
      />
      <TeacherStudentAnalytics />
    </>
  );
};

export default IndependentTeacherAnalyticsPage;