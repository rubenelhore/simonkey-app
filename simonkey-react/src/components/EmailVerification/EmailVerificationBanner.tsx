import React, { useState } from 'react';
import { sendVerificationEmail } from '../../services/emailVerificationService';
import { useAuth } from '../../hooks/useAuth';
import './EmailVerificationBanner.css';

interface EmailVerificationBannerProps {
  onDismiss?: () => void;
  showDismiss?: boolean;
}

const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({ 
  onDismiss, 
  showDismiss = false 
}) => {
  const { user, refreshEmailVerification } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

  const handleResendVerification = async () => {
    if (!user) return;
    
    setIsResending(true);
    setMessage(null);
    
    try {
      const result = await sendVerificationEmail(user);
      
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
        
        // Refrescar estado después de enviar
        setTimeout(() => {
          refreshEmailVerification();
        }, 2000);
      } else {
        setMessage(result.message);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error reenviando verificación:', error);
      setMessage('Error enviando email de verificación');
      setMessageType('error');
    } finally {
      setIsResending(false);
      
      // Limpiar mensaje después de 8 segundos
      setTimeout(() => {
        setMessage(null);
        setMessageType(null);
      }, 8000);
    }
  };

  const handleRefreshStatus = async () => {
    const isVerified = await refreshEmailVerification();
    if (isVerified) {
      setMessage('¡Email verificado exitosamente!');
      setMessageType('success');
    } else {
      setMessage('Email aún no verificado. Revisa tu bandeja de entrada.');
      setMessageType('error');
    }
    
    // Limpiar mensaje después de 5 segundos
    setTimeout(() => {
      setMessage(null);
      setMessageType(null);
    }, 5000);
  };

  return (
    <div className="email-verification-banner">
      <div className="banner-content">
        <div className="banner-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
          </svg>
        </div>
        
        <div className="banner-text">
          <h4>Verifica tu email</h4>
          <p>
            Te enviamos un email de verificación a <strong>{user?.email}</strong>. 
            Haz clic en el enlace del email para activar tu cuenta.
          </p>
          
          {message && (
            <div className={`banner-message ${messageType}`}>
              {message}
            </div>
          )}
        </div>
        
        <div className="banner-actions">
          <button 
            onClick={handleResendVerification}
            disabled={isResending}
            className="btn-resend"
          >
            {isResending ? 'Enviando...' : 'Reenviar email'}
          </button>
          
          <button 
            onClick={handleRefreshStatus}
            className="btn-refresh"
            title="Verificar si ya confirmaste tu email"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="currentColor"/>
            </svg>
            Actualizar
          </button>
          
          {showDismiss && onDismiss && (
            <button 
              onClick={onDismiss}
              className="btn-dismiss"
              title="Cerrar banner"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;