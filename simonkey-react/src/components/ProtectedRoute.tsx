import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import EmailVerificationBanner from './EmailVerification/EmailVerificationBanner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
  fallbackPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireEmailVerification = true,
  fallbackPath = '/login'
}) => {
  const { isAuthenticated, isEmailVerified, loading } = useAuth();
  const location = useLocation();

  // Mostrar loading mientras se inicializa
  if (loading) {
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
            Cargando...
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

  // Redirigir a login si no está autenticado
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Si se requiere verificación de email y no está verificado
  if (requireEmailVerification && !isEmailVerified) {
    // Si estamos en la página de verificación, permitir acceso
    if (location.pathname === '/verify-email') {
      return <>{children}</>;
    }
    
    // Para otras rutas, mostrar el banner de verificación sobre el contenido
    return (
      <div>
        <EmailVerificationBanner />
        <div style={{ 
          opacity: 0.6,
          pointerEvents: 'none',
          position: 'relative'
        }}>
          {children}
        </div>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            textAlign: 'center',
            maxWidth: '400px',
            margin: '20px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#fff3cd',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#856404'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="currentColor"/>
              </svg>
            </div>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#2d3436'
            }}>
              Verifica tu email
            </h3>
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              color: '#636e72',
              lineHeight: '1.4'
            }}>
              Para continuar usando Simonkey, necesitas verificar tu dirección de email.
            </p>
            <button
              onClick={() => window.location.href = '/verify-email'}
              style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Ir a verificación
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Usuario autenticado y verificado (o verificación no requerida)
  return <>{children}</>;
};

export default ProtectedRoute;