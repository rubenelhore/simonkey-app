import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserType } from '../hooks/useUserType';

interface EmailVerificationGuardProps {
  children: React.ReactNode;
}

const EmailVerificationGuard: React.FC<EmailVerificationGuardProps> = ({ children }) => {
  const { isAuthenticated, isEmailVerified, loading, initializing } = useAuth();
  const { isSchoolTeacher, isSchoolStudent, isSchoolUser, userProfile, loading: userTypeLoading } = useUserType();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !initializing && !userTypeLoading) {
      // Si está autenticado pero no verificado y no está en la página de verificación
      if (isAuthenticated && !isEmailVerified && location.pathname !== '/verify-email') {
        console.log('🔒 Usuario no verificado, redirigiendo a verificación de email');
        navigate('/verify-email', { replace: true });
        return;
      }

      // Si está autenticado y verificado, manejar redirecciones de usuarios escolares
      if (isAuthenticated && isEmailVerified) {
        console.log('🔍 EmailVerificationGuard - Verificando redirecciones escolares:');
        console.log('   - isSchoolUser:', isSchoolUser);
        console.log('   - isSchoolTeacher:', isSchoolTeacher);
        console.log('   - isSchoolStudent:', isSchoolStudent);
        console.log('   - userProfile.schoolRole:', userProfile?.schoolRole);
        console.log('   - location.pathname:', location.pathname);

        // Detectar usuarios escolares sin rol definido
        const isSchoolUserWithoutRole = isSchoolUser && userProfile && !userProfile.schoolRole;

        // CASO 1: Usuario escolar sin rol definido - BLOQUEAR ACCESO
        if (isSchoolUserWithoutRole) {
          console.log('🚫 EmailVerificationGuard - Usuario escolar sin rol definido');
          // No redirigir, el SchoolUserGuard se encargará de mostrar el error
          return;
        }

        // CASO 2: Profesor escolar - Solo /school/teacher
        if (isSchoolTeacher && location.pathname !== '/school/teacher') {
          console.log('🏫 EmailVerificationGuard - Redirigiendo profesor escolar a su módulo');
          navigate('/school/teacher', { replace: true });
          return;
        }
        
        // CASO 3: Estudiante escolar - Solo /school/student
        if (isSchoolStudent && location.pathname !== '/school/student') {
          console.log('🎓 EmailVerificationGuard - Redirigiendo estudiante escolar a su módulo');
          navigate('/school/student', { replace: true });
          return;
        }
      }
    }
  }, [isAuthenticated, isEmailVerified, loading, initializing, userTypeLoading, isSchoolTeacher, isSchoolStudent, isSchoolUser, userProfile, location.pathname, navigate]);

  // Si está cargando, mostrar loading
  if (loading || initializing || userTypeLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e3e3e3',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ 
            color: '#636e72',
            margin: 0,
            fontSize: '14px'
          }}>
            Verificando acceso...
          </p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Si no está autenticado, no mostrar nada (se manejará en las rutas)
  if (!isAuthenticated) {
    return null;
  }

  // Si no está verificado y no está en la página de verificación, no mostrar contenido
  if (!isEmailVerified && location.pathname !== '/verify-email') {
    return null;
  }

  // Usuario autenticado y verificado (o en página de verificación)
  return <>{children}</>;
};

export default EmailVerificationGuard; 