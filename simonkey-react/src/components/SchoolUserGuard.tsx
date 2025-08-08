import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';

interface SchoolUserGuardProps {
  children: React.ReactNode;
}

const SchoolUserGuard: React.FC<SchoolUserGuardProps> = ({ children }) => {
  const { isSchoolTeacher, isSchoolStudent, isSchoolAdmin, isSchoolTutor, isSchoolUser, userProfile, loading } = useUserType();
  const location = useLocation();

  // Detectar usuarios escolares sin rol definido
  const isSchoolUserWithoutRole = isSchoolUser && userProfile && !userProfile.schoolRole;

  // Log detallado para diagnóstico
  console.log('🔍 SchoolUserGuard - Estado actual:');
  console.log('  - loading:', loading);
  console.log('  - isSchoolUser:', isSchoolUser);
  console.log('  - isSchoolTeacher:', isSchoolTeacher);
  console.log('  - isSchoolStudent:', isSchoolStudent);
  console.log('  - isSchoolAdmin:', isSchoolAdmin);
  console.log('  - isSchoolTutor:', isSchoolTutor);
  console.log('  - userProfile:', userProfile);
  console.log('  - location.pathname:', location.pathname);

  if (loading) {
    console.log('⏳ SchoolUserGuard - Mostrando loading...');
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando permisos escolares...</p>
      </div>
    );
  }

  // Si es usuario escolar válido, renderiza children
  if (isSchoolTeacher || isSchoolStudent || isSchoolAdmin || isSchoolTutor) {
    console.log('✅ SchoolUserGuard - Renderizando contenido para usuario escolar');
    return <>{children}</>;
  } else {
    console.log('❌ SchoolUserGuard - Usuario no autorizado, redirigiendo...');
    return <Navigate to="/" replace />;
  }
};

export default SchoolUserGuard; 