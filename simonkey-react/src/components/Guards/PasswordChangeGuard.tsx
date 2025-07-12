import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUserType } from '../../hooks/useUserType';

interface PasswordChangeGuardProps {
  children: React.ReactNode;
}

const PasswordChangeGuard: React.FC<PasswordChangeGuardProps> = ({ children }) => {
  const { userProfile, loading: authLoading } = useAuth();
  const { isSchoolUser } = useUserType();
  const location = useLocation();

  // Log para depuración - COMENTADO PARA REDUCIR RUIDO
  // console.log('🔐 PasswordChangeGuard - Estado:');
  // console.log('  - loading:', authLoading);
  // console.log('  - userProfile:', userProfile);
  // console.log('  - requiresPasswordChange:', userProfile?.requiresPasswordChange);
  // console.log('  - isSchoolUser:', isSchoolUser);
  // console.log('  - location:', location.pathname);

  // Si está cargando, mostrar loading
  if (authLoading) {
    console.log('🔐 PasswordChangeGuard mostrando loading');
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Verificando seguridad...</p>
      </div>
    );
  }

  // Si es usuario escolar y requiere cambio de contraseña
  // y no está en la página de cambio de contraseña
  if (isSchoolUser && userProfile?.requiresPasswordChange && location.pathname !== '/change-password-required') {
    // console.log('🚨 PasswordChangeGuard - Redirigiendo a cambio de contraseña obligatorio');
    return <Navigate to="/change-password-required" replace />;
  }

  // Si está en la página de cambio de contraseña pero no lo requiere
  if (location.pathname === '/change-password-required' && !userProfile?.requiresPasswordChange) {
    // console.log('✅ PasswordChangeGuard - Usuario ya cambió contraseña, redirigiendo');
    if (isSchoolUser) {
      // Redirigir según el rol
      if (userProfile?.schoolRole === 'admin') {
        return <Navigate to="/materias" replace />;
      } else if (userProfile?.schoolRole === 'teacher') {
        return <Navigate to="/school/teacher" replace />;
      } else if (userProfile?.schoolRole === 'student') {
        return <Navigate to="/materias" replace />;
      }
    }
    return <Navigate to="/" replace />;
  }

  console.log('🔐 PasswordChangeGuard - Renderizando children');
  return <>{children}</>;
};

export default PasswordChangeGuard;