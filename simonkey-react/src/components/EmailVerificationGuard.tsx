import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';

interface EmailVerificationGuardProps {
  children: React.ReactNode;
}

const EmailVerificationGuard: React.FC<EmailVerificationGuardProps> = ({ children }) => {
  const { isAuthenticated, isEmailVerified, loading } = useAuth();
  const { isSchoolTeacher, isSchoolStudent, isSchoolUser, userProfile, loading: userTypeLoading } = useUserType();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('🔍 EmailVerificationGuard - useEffect triggered');
    console.log('🔍 EmailVerificationGuard - loading:', loading);
    console.log('🔍 EmailVerificationGuard - isAuthenticated:', isAuthenticated);
    console.log('🔍 EmailVerificationGuard - isEmailVerified:', isEmailVerified);
    console.log('🔍 EmailVerificationGuard - isSchoolUser:', isSchoolUser);
    console.log('🔍 EmailVerificationGuard - isSchoolTeacher:', isSchoolTeacher);
    console.log('🔍 EmailVerificationGuard - isSchoolStudent:', isSchoolStudent);
    console.log('🔍 EmailVerificationGuard - location.pathname:', location.pathname);
    
    if (!loading) {
      console.log('🔍 EmailVerificationGuard - Verificando redirecciones escolares:');
      console.log('   - isSchoolUser:', isSchoolUser);
      console.log('   - isSchoolTeacher:', isSchoolTeacher);
      console.log('   - isSchoolStudent:', isSchoolStudent);
      console.log('   - userProfile.schoolRole:', userProfile?.schoolRole);
      console.log('   - location.pathname:', location.pathname);

      // USUARIOS ESCOLARES: Redirigir según su rol
      if (isSchoolUser && userProfile?.schoolRole) {
        console.log('🔍 EmailVerificationGuard - Usuario escolar detectado con rol:', userProfile.schoolRole);
        
        if (isSchoolTeacher && location.pathname !== '/school/teacher') {
          console.log('🏫 EmailVerificationGuard - Redirigiendo profesor escolar a /school/teacher');
          console.log('🏫 From:', location.pathname, 'To: /school/teacher');
          navigate('/school/teacher', { replace: true });
          return;
        }
        
        if (isSchoolStudent && location.pathname !== '/school/student') {
          console.log('🎓 EmailVerificationGuard - Redirigiendo estudiante escolar a /school/student');
          console.log('🎓 From:', location.pathname, 'To: /school/student');
          navigate('/school/student', { replace: true });
          return;
        }
        
        console.log('✅ EmailVerificationGuard - Usuario escolar ya está en la ruta correcta');
      }

      // USUARIOS NORMALES: Verificar email
      if (isAuthenticated && !isEmailVerified && !isSchoolUser) {
        console.log('📧 EmailVerificationGuard - Usuario normal no verificado, redirigiendo a verificación');
        console.log('📧 From:', location.pathname, 'To: /verify-email');
        navigate('/verify-email', { replace: true });
        return;
      }
      
      console.log('✅ EmailVerificationGuard - No se requieren redirecciones');
    } else {
      console.log('🔍 EmailVerificationGuard - Still loading, skipping checks');
    }
  }, [isAuthenticated, isEmailVerified, isSchoolUser, isSchoolTeacher, isSchoolStudent, userProfile, location.pathname, navigate, loading]);

  // Si está cargando, mostrar loading
  if (loading || userTypeLoading) {
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