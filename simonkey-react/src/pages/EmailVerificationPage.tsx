import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { sendVerificationEmail, startVerificationMonitoring } from '../services/emailVerificationService';
import EmailVerificationBanner from '../components/EmailVerification/EmailVerificationBanner';
import simonLogo from '/img/favicon.svg';
import './EmailVerificationPage.css';

const EmailVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isEmailVerified, refreshEmailVerification, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info' | null>(null);

  // Verificar automáticamente el estado al cargar la página
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!user) return;
      
      setIsChecking(true);
      try {
        const isVerified = await refreshEmailVerification();
        if (isVerified) {
          setMessage('¡Excelente! Tu email ha sido verificado exitosamente.');
          setMessageType('success');
          
          // Redirigir a notebooks después de 3 segundos
          setTimeout(() => {
            navigate('/notebooks', { replace: true });
          }, 3000);
        } else {
          setMessage('Tu email aún no ha sido verificado. Revisa tu bandeja de entrada y spam.');
          setMessageType('info');
        }
      } catch (error) {
        console.error('Error verificando email:', error);
        setMessage('Error verificando el estado de tu email. Intenta nuevamente.');
        setMessageType('error');
      } finally {
        setIsChecking(false);
      }
    };

    if (user) {
      checkVerificationStatus();
    }
  }, [user, refreshEmailVerification, navigate]);

  // Iniciar monitoreo automático de verificación
  useEffect(() => {
    if (!user || isEmailVerified) return;

    const cleanup = startVerificationMonitoring(user, () => {
      setMessage('¡Email verificado exitosamente! Redirigiendo...');
      setMessageType('success');
      
      setTimeout(() => {
        navigate('/notebooks', { replace: true });
      }, 2000);
    });

    return cleanup;
  }, [user, isEmailVerified, navigate]);

  // Redirigir si ya está verificado
  useEffect(() => {
    if (isEmailVerified) {
      navigate('/notebooks', { replace: true });
    }
  }, [isEmailVerified, navigate]);

  // Redirigir si no hay usuario
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  const handleSendVerification = async () => {
    if (!user) return;

    try {
      const result = await sendVerificationEmail(user);
      setMessage(result.message);
      setMessageType(result.success ? 'success' : 'error');
    } catch (error) {
      console.error('Error enviando verificación:', error);
      setMessage('Error enviando email de verificación');
      setMessageType('error');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleCheckAgain = async () => {
    setIsChecking(true);
    setMessage(null);
    
    try {
      const isVerified = await refreshEmailVerification();
      if (isVerified) {
        setMessage('¡Email verificado exitosamente! Redirigiendo...');
        setMessageType('success');
        
        setTimeout(() => {
          navigate('/notebooks', { replace: true });
        }, 2000);
      } else {
        setMessage('Email aún no verificado. El email puede tardar unos minutos en llegar.');
        setMessageType('info');
      }
    } catch (error) {
      console.error('Error verificando email:', error);
      setMessage('Error verificando el estado. Intenta nuevamente.');
      setMessageType('error');
    } finally {
      setIsChecking(false);
    }
  };

  if (!user) {
    return null; // Se redirigirá automáticamente
  }

  return (
    <div className="email-verification-page">
      <div className="verification-container">
        <div className="verification-header">
          <img src={simonLogo} alt="Simio Simón" className="simon-logo" />
          <h1>
            <span style={{ color: 'black' }}>Simon</span>
            <span style={{ color: 'white' }}>key</span>
          </h1>
          <h2>Verifica tu email</h2>
          <p className="subtitle">
            Casi terminamos. Solo necesitamos confirmar tu dirección de email.
          </p>
        </div>

        <div className="verification-content">
          <div className="email-info">
            <div className="email-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="currentColor"/>
              </svg>
            </div>
            <p>
              Enviamos un email de verificación a:
            </p>
            <strong className="user-email">{user.email}</strong>
          </div>

          <div className="verification-steps">
            <h3>Pasos a seguir:</h3>
            <ol>
              <li>Revisa tu bandeja de entrada de <strong>{user.email}</strong></li>
              <li>Si no lo encuentras, revisa tu carpeta de spam o correo no deseado</li>
              <li>Haz clic en el enlace "Verificar email" en el email</li>
              <li>Regresa aquí para continuar</li>
            </ol>
          </div>

          {message && (
            <div className={`verification-message ${messageType}`}>
              <div className="message-icon">
                {messageType === 'success' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="currentColor"/>
                  </svg>
                )}
                {messageType === 'error' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
                  </svg>
                )}
                {messageType === 'info' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V11H13V17ZM13 9H11V7H13V9Z" fill="currentColor"/>
                  </svg>
                )}
              </div>
              {message}
            </div>
          )}

          <div className="verification-actions">
            <button 
              onClick={handleCheckAgain}
              disabled={isChecking}
              className="btn-primary"
            >
              {isChecking ? 'Verificando...' : 'Ya verifiqué mi email'}
            </button>

            <button 
              onClick={handleSendVerification}
              className="btn-secondary"
            >
              Reenviar email de verificación
            </button>

            <div className="help-section">
              <h4>¿No recibiste el email?</h4>
              <ul>
                <li>Verifica que el email <strong>{user.email}</strong> sea correcto</li>
                <li>Revisa tu carpeta de spam o correo no deseado</li>
                <li>El email puede tardar unos minutos en llegar</li>
                <li>Puedes reenviar el email usando el botón de arriba</li>
              </ul>
            </div>

            <div className="alternative-actions">
              <button 
                onClick={handleLogout}
                className="btn-text"
              >
                Usar una cuenta diferente
              </button>
            </div>
          </div>
        </div>

        <div className="verification-footer">
          <p>¿Necesitas ayuda? <a href="mailto:support@simonkey.com">Contacta soporte</a></p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;