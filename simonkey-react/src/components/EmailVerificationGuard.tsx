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
      
      // Ya no hay restricciones especiales para profesores

      // USUARIOS NORMALES: Verificar email
      if (isAuthenticated && !isEmailVerified && !isSchoolUser && !hasNavigated.current) {
        hasNavigated.current = true;
        navigate('/verify-email', { replace: true });
        return;
      }
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

  // Si no está verificado y no está en la página de verificación, no mostrar contenido
  // EXCEPTO para usuarios escolares que pueden acceder sin verificación
  if (!isEmailVerified && location.pathname !== '/verify-email' && !isSchoolUser) {
    return null;
  }

  // Usuario autenticado y verificado (o en página de verificación)
  return <>{children}</>;
};

export default EmailVerificationGuard;