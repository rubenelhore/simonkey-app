import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useNavigate, Link } from 'react-router-dom';
import simonLogo from '/img/favicon.svg';
import './LoginPage.css'; // Reutilizamos los estilos de login

const ResetPasswordPage: React.FC = () => {
  console.log('ResetPasswordPage component loaded');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  
  // Debug: verificar que el componente se renderiza
  console.log('ResetPasswordPage rendering, success:', success);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Por favor ingresa tu email');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (error: any) {
      console.error('Error al enviar email de recuperación:', error);
      
      let errorMessage = 'Error al enviar el email de recuperación';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No existe una cuenta con este email';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos. Por favor intenta más tarde';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src={simonLogo} alt="Simonkey Logo" className="login-logo" />
            <h2>Email enviado</h2>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ marginBottom: '20px' }}>
              Hemos enviado un email a <strong>{email}</strong> con instrucciones 
              para restablecer tu contraseña.
            </p>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Si no recibes el email en unos minutos, revisa tu carpeta de spam.
            </p>
          </div>

          <button 
            onClick={() => navigate('/login')}
            className="login-button"
            style={{ width: '100%' }}
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src={simonLogo} alt="Simonkey Logo" className="login-logo" />
          <h2>Recuperar contraseña</h2>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="tu@email.com"
              required
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="error-message" style={{ marginBottom: '15px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
            style={{ width: '100%', marginBottom: '15px' }}
          >
            {isLoading ? 'Enviando...' : 'Enviar email de recuperación'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <Link 
              to="/login" 
              style={{ fontSize: '14px', color: '#666', textDecoration: 'none' }}
            >
              Volver al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;