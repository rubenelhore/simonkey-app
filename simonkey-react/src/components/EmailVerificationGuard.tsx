import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';

interface EmailVerificationGuardProps {
  children: React.ReactNode;
}

const EmailVerificationGuard: React.FC<EmailVerificationGuardProps> = ({ children }) => {
  const { isAuthenticated, isEmailVerified, loading } = useAuth();
  const { isTeacher, isSchoolStudent, isSchoolUser, userProfile, loading: userTypeLoading } = useUserType();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Referencias para evitar re-renders innecesarios
  const lastProcessedState = useRef<string>('');
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Crear un hash del estado actual para evitar procesamiento duplicado
    const currentState = `${loading}-${userTypeLoading}-${isAuthenticated}-${isEmailVerified}-${isSchoolUser}-${isTeacher}-${isSchoolStudent}-${location.pathname}`;
    
    // Si el estado no ha cambiado, no procesar
    if (lastProcessedState.current === currentState) {
      return;
    }
    
    lastProcessedState.current = currentState;
    
    if (!loading && !userTypeLoading) {
      // Reset navigation flag when state changes
      hasNavigated.current = false;
      
      // Debug log para verificar datos del usuario
      if (isAuthenticated && userProfile) {
        console.log('🐛 EmailVerificationGuard - Perfil del usuario:', {
          email: userProfile.email,
          createdViaUpload: userProfile.createdViaUpload,
          isEmailVerified,
          isSchoolUser,
          subscription: userProfile.subscription
        });
      }
      
      // Ya no hay restricciones especiales para profesores

      // USUARIOS CREADOS VIA BULK UPLOAD: Ir a cambiar contraseña
      if (isAuthenticated && userProfile?.createdViaUpload && !hasNavigated.current) {
        console.log('🔄 Usuario creado via bulk upload detectado, redirigiendo a cambiar contraseña');
        hasNavigated.current = true;
        navigate('/change-password-required', { replace: true });
        return;
      }

      // WORKAROUND: Usuarios con subscription 'free' y emailVerified=true (probablemente bulk upload)
      // EXCEPCIÓN: No aplicar a usuarios de Google OAuth (detectados por providerId o por no tener createdViaUpload)
      const isGoogleUser = userProfile?.email?.endsWith('@gmail.com') || !userProfile?.createdViaUpload;
      if (isAuthenticated && userProfile?.subscription === 'free' && isEmailVerified && userProfile?.uploadedBy && userProfile?.createdViaUpload && !isGoogleUser && !hasNavigated.current) {
        console.log('🔄 Usuario free con uploadedBy detectado, redirigiendo a cambiar contraseña');
        hasNavigated.current = true;
        navigate('/change-password-required', { replace: true });
        return;
      }

      // USUARIOS NORMALES: Verificar email - TEMPORALMENTE DESHABILITADO
      // if (isAuthenticated && !isEmailVerified && !isSchoolUser && !userProfile?.createdViaUpload && !hasNavigated.current) {
      //   hasNavigated.current = true;
      //   navigate('/verify-email', { replace: true });
      //   return;
      // }
    }
  }, [isAuthenticated, isEmailVerified, isSchoolUser, isTeacher, isSchoolStudent, userProfile, location.pathname, navigate, loading, userTypeLoading]);

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

  // Si no está verificado y no está en las páginas permitidas, no mostrar contenido
  // EXCEPTO para usuarios escolares y usuarios creados via bulk upload
  // TEMPORALMENTE DESHABILITADO - PERMITIR ACCESO A TODOS LOS USUARIOS AUTENTICADOS
  // const allowedPaths = ['/verify-email', '/change-password-required'];
  // if (!isEmailVerified && !allowedPaths.includes(location.pathname) && !isSchoolUser && !userProfile?.createdViaUpload) {
  //   return null;
  // }

  // Usuario autenticado y verificado (o en página de verificación)
  return <>{children}</>;
};

export default EmailVerificationGuard;