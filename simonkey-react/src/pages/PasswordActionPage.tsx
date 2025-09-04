import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../services/firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import './LoginPage.css'; // Reutilizar estilos existentes

const PasswordActionPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<string | null>(null);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isValidatingCode, setIsValidatingCode] = useState<boolean>(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const modeParam = urlParams.get('mode');
    const oobCodeParam = urlParams.get('oobCode');
    
    setMode(modeParam);
    setOobCode(oobCodeParam);
    
    if (modeParam === 'resetPassword' && oobCodeParam) {
      // Verificar que el código es válido
      verifyPasswordResetCode(auth, oobCodeParam)
        .then((email) => {
          setEmail(email);
          setIsValidatingCode(false);
        })
        .catch((error) => {
          console.error('Error verificando código:', error);
          setError('El enlace de recuperación es inválido o ha expirado.');
          setIsValidatingCode(false);
        });
    } else {
      setError('Enlace de recuperación inválido.');
      setIsValidatingCode(false);
    }
  }, [location.search]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      setError('Por favor completa todos los campos');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (!oobCode) {
      setError('Código de recuperación no válido');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
    } catch (error: any) {
      console.error('Error al restablecer contraseña:', error);
      
      let errorMessage = 'Error al restablecer la contraseña';
      
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'El enlace de recuperación ha expirado. Solicita uno nuevo.';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'El enlace de recuperación es inválido.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña es muy débil. Usa al menos 6 caracteres.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrar loading mientras validamos el código
  if (isValidatingCode) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src="/img/favicon.svg" alt="Simonkey" className="simon-logo" />
            <h1>
              <span style={{ color: 'black' }}>Simon</span>
              <span style={{ color: 'black' }}>key</span>
            </h1>
            <p className="tagline">Validando enlace de recuperación...</p>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar mensaje de éxito
  if (success) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src="/img/favicon.svg" alt="Simonkey" className="simon-logo" />
            <h1>
              <span style={{ color: 'black' }}>Simon</span>
              <span style={{ color: 'black' }}>key</span>
            </h1>
            <p className="tagline">¡Contraseña actualizada!</p>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ marginBottom: '20px', color: 'var(--success-color)' }}>
              Tu contraseña ha sido restablecida exitosamente.
            </p>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
          </div>

          <button 
            onClick={() => navigate('/login')}
            className="login-button"
            style={{ width: '100%' }}
          >
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  // Mostrar error si el enlace no es válido
  if (error && !newPassword) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src="/img/favicon.svg" alt="Simonkey" className="simon-logo" />
            <h1>
              <span style={{ color: 'black' }}>Simon</span>
              <span style={{ color: 'black' }}>key</span>
            </h1>
            <p className="tagline">Error en el enlace</p>
          </div>
          
          <div className="error-message" style={{ marginBottom: '20px' }}>
            {error}
          </div>

          <button 
            onClick={() => navigate('/reset-password')}
            className="login-button"
            style={{ width: '100%', marginBottom: '10px' }}
          >
            Solicitar nuevo enlace
          </button>
          
          <button 
            onClick={() => navigate('/login')}
            className="login-button"
            style={{ 
              width: '100%', 
              backgroundColor: 'transparent',
              color: 'var(--primary-color)',
              border: '1px solid var(--primary-color)'
            }}
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  // Mostrar formulario de nueva contraseña
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/img/favicon.svg" alt="Simonkey" className="simon-logo" />
          <h1>
            <span style={{ color: 'black' }}>Simon</span>
            <span style={{ color: 'black' }}>key</span>
          </h1>
          <p className="tagline">Crear nueva contraseña</p>
        </div>
        
        {email && (
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '20px', 
            padding: '12px', 
            backgroundColor: '#f0f8ff', 
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            Restableciendo contraseña para: <strong>{email}</strong>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handlePasswordReset} className="login-form">
          <div className="form-group">
            <label htmlFor="newPassword">Nueva contraseña</label>
            <div className="password-input-container">
              <input 
                type={showPassword ? "text" : "password"}
                id="newPassword" 
                value={newPassword} 
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Nueva contraseña"
                disabled={isLoading}
                minLength={6}
                required
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <FontAwesomeIcon 
                  icon={showPassword ? faEye : faEyeSlash} 
                  style={{ color: '#999', fontSize: '14px' }}
                />
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <div className="password-input-container">
              <input 
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword" 
                value={confirmPassword} 
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Confirmar nueva contraseña"
                disabled={isLoading}
                minLength={6}
                required
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                <FontAwesomeIcon 
                  icon={showConfirmPassword ? faEye : faEyeSlash} 
                  style={{ color: '#999', fontSize: '14px' }}
                />
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="login-button" 
            disabled={isLoading}
          >
            {isLoading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
        
        <div className="login-footer">
          <p><a href="/login">Volver al login</a></p>
        </div>
      </div>
    </div>
  );
};

export default PasswordActionPage;