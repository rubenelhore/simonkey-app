import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUserType } from '../../hooks/useUserType';

interface PasswordChangeGuardProps {
  children: React.ReactNode;
}

const PasswordChangeGuard: React.FC<PasswordChangeGuardProps> = ({ children }) => {
  // DESHABILITADO: Ya no forzamos cambio de contraseña
  // Los usuarios ahora crean sus propias contraseñas via reset de Firebase
  
  // Simplemente renderizar los children sin verificaciones
  return <>{children}</>;
};

export default PasswordChangeGuard;