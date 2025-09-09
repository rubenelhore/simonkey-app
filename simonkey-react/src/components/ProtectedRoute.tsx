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
  const { isAuthenticated, isEmailVerified } = useAuth();
  const location = useLocation();

  // Si no está autenticado, redirigir al fallback
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // TEMPORALMENTE DESHABILITADO - Verificación de email
  // PERMITIR ACCESO A TODOS LOS USUARIOS AUTENTICADOS SIN VERIFICAR EMAIL
  
  // Usuario autenticado - permitir acceso directo
  return <>{children}</>;
};

export default ProtectedRoute;