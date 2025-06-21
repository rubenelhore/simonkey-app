import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';

interface SchoolUserGuardProps {
  children: React.ReactNode;
}

const SchoolUserGuard: React.FC<SchoolUserGuardProps> = ({ children }) => {
  const { isSchoolTeacher, isSchoolStudent, isSchoolUser, userProfile, loading } = useUserType();
  const location = useLocation();
  const navigate = useNavigate();

  // Detectar usuarios escolares sin rol definido
  const isSchoolUserWithoutRole = isSchoolUser && userProfile && !userProfile.schoolRole;

  useEffect(() => {
    // SOLO redirigir si loading es false
    if (!loading && !isSchoolTeacher && !isSchoolStudent) {
      console.log('❌ SchoolUserGuard - Usuario no autorizado como escolar, redirigiendo a /');
      navigate('/');
    }
  }, [isSchoolTeacher, isSchoolStudent, loading, navigate]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando permisos escolares...</p>
      </div>
    );
  }

  // Si es usuario escolar válido, renderiza children
  return <>{children}</>;
};

export default SchoolUserGuard; 