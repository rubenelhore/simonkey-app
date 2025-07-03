import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';

interface SchoolUserGuardProps {
  children: React.ReactNode;
}

const SchoolUserGuard: React.FC<SchoolUserGuardProps> = ({ children }) => {
  const { isSchoolTeacher, isSchoolStudent, isSchoolAdmin, isSchoolTutor, isSchoolUser, userProfile, loading } = useUserType();
  const location = useLocation();
  const navigate = useNavigate();

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

  useEffect(() => {
    console.log('🔍 SchoolUserGuard - useEffect triggered');
    console.log('  - loading:', loading);
    console.log('  - isSchoolTeacher:', isSchoolTeacher);
    console.log('  - isSchoolStudent:', isSchoolStudent);
    console.log('  - isSchoolAdmin:', isSchoolAdmin);
    console.log('  - isSchoolTutor:', isSchoolTutor);
    
    // SOLO redirigir si loading es false
    if (!loading && !isSchoolTeacher && !isSchoolStudent && !isSchoolAdmin && !isSchoolTutor) {
      console.log('❌ SchoolUserGuard - Usuario no autorizado como escolar, redirigiendo a /');
      navigate('/');
    } else if (!loading && (isSchoolTeacher || isSchoolStudent || isSchoolAdmin || isSchoolTutor)) {
      console.log('✅ SchoolUserGuard - Usuario autorizado como escolar');
    }
  }, [isSchoolTeacher, isSchoolStudent, isSchoolAdmin, isSchoolTutor, loading, navigate]);

  if (loading) {
    console.log('⏳ SchoolUserGuard - Mostrando loading...');
    return (
      <div className="loading-container">
        <div className="spinner"></div>
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