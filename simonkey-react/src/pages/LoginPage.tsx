import React, { useState, useEffect } from 'react';
import './LoginPage.css';
import simonLogo from '/img/favicon.svg';
// Importar todas las funciones de Firebase desde un solo lugar
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup // Añadir aquí, no como importación separada
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {     
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  
  // Check if user is already logged in
  useEffect(() => {
    console.log("Verificando autenticación en LoginPage");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, redirect to notebooks
        console.log("Usuario ya autenticado, redirigiendo a notebooks");
        navigate('/notebooks', { replace: true });
      }
    });
    
    return () => unsubscribe();
  }, [navigate]);
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setError(null);
  };
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor, ingresa tu correo y contraseña');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Usar Firebase para el inicio de sesión
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Inicio de sesión exitoso');
      // Usar replace: true para evitar problemas con navegación anterior
      navigate('/notebooks', { replace: true });
    } catch (err: any) {
      // Manejar errores específicos de Firebase
      let errorMessage = 'Error al iniciar sesión';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Correo o contraseña incorrectos';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos fallidos. Inténtalo más tarde';
      }
      setError(errorMessage);
      console.error('Error de autenticación:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters
      provider.setCustomParameters({
        prompt: 'select_account',
        ...(email ? { login_hint: email } : {})
      });
      
      // Usar signInWithPopup para autenticación directa sin redirección
      const result = await signInWithPopup(auth, provider);
      
      console.log("Autenticación con Google exitosa:", result.user.uid);
      
      // Guardar información básica del usuario
      if (result.user) {
        const userData = {
          id: result.user.uid,
          email: result.user.email || '',
          name: result.user.displayName || '',
          isAuthenticated: true
        };
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Navegar a notebooks después de autenticación exitosa
        // Usar replace: true para evitar problemas con navegación anterior
        navigate('/notebooks', { replace: true });
      }
    } catch (err: any) {
      console.error('Error en inicio de sesión con Google:', err);
      
      let errorMessage = 'Error al iniciar sesión con Google';
      
      if (err.code === 'auth/cancelled-popup-request') {
        errorMessage = 'La solicitud de inicio de sesión fue cancelada';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src={simonLogo} alt="Simio Simón" className="simon-logo"/>
              <h1><a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span style={{ color: 'black' }}>Simon</span>
              <span style={{ color: '#6147FF' }}>key</span>
              </a></h1>
          <p className="tagline">Tu estudio, tu ritmo</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={handleEmailChange} 
              placeholder="ejemplo@correo.com"
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input 
              type="password" 
              id="password" 
              value={password} 
              onChange={handlePasswordChange} 
              placeholder="Tu contraseña"
              disabled={isLoading}
            />
          </div>
          
          <button 
            type="submit" 
            className="login-button" 
            disabled={isLoading}
          >
            {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
        
        <div className="social-login">
          <p className="divider">O inicia sesión con</p>
          
          <div className="social-buttons">
            <button 
              className="google-button" 
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
          </div>
        </div>
        
        <div className="login-footer">
          <p>¿No tienes cuenta? <a href="/signup">Regístrate</a></p>
          <p className="forgot-password"><a href="/reset-password">¿Olvidaste tu contraseña?</a></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;