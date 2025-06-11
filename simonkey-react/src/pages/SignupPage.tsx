import React, { useState } from 'react';
import './SignupPage.css';
import simonLogo from '/img/favicon.svg';
// Arreglamos las importaciones de Firebase
import { 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  updateProfile 
} from 'firebase/auth';
// Importar específicamente signInWithPopup
import { signInWithPopup } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [birthdate, setBirthdate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);
  };
  
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    setError(null);
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setError(null);
  };
  
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    setError(null);
  };
  
  const handleBirthdateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBirthdate(e.target.value);
    setError(null);
  };
  
  const validateForm = (): boolean => {
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Ingresa un correo electrónico válido');
      return false;
    }
    
    // Validar nombre de usuario
    if (username.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres');
      return false;
    }
    
    // Validar contraseña
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    
    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }
    
    // Validar fecha de nacimiento
    if (!birthdate) {
      setError('Por favor, ingresa tu fecha de nacimiento');
      return false;
    }
    
    // Verificar que sea mayor de 13 años
    const today = new Date();
    const birthdateDate = new Date(birthdate);
    let age = today.getFullYear() - birthdateDate.getFullYear();
    const m = today.getMonth() - birthdateDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthdateDate.getDate())) {
      age--;
    }
    
    if (age < 13) {
      setError('Debes tener al menos 13 años para registrarte');
      return false;
    }
    
    return true;
  };
  
  const createUserProfile = async (userId: string) => {
    try {
      // Añadir usuario a Firestore con datos adicionales
      await setDoc(doc(firestore, 'users', userId), {
        email,
        username,
        birthdate,
        createdAt: serverTimestamp(),
        subscription: 'free',
        notebookCount: 0
      });
      
      // Actualizar el perfil del usuario en Auth
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: username
        });
      }
    } catch (err) {
      console.error('Error al crear perfil de usuario:', err);
      throw err;
    }
  };
  
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Crear usuario con email y contraseña
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Crear perfil de usuario en Firestore
      await createUserProfile(user.uid);
      
      console.log('Registro exitoso');
      // Redirigir al usuario a la página de Notebooks
      navigate('/notebooks');
    } catch (err: any) {
      let errorMessage = 'Error al registrarse';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Este correo electrónico ya está en uso';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Correo electrónico inválido';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'La contraseña es demasiado débil';
      }
      setError(errorMessage);
      console.error('Error de registro:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleSignup = async () => {
    setIsLoading(true);
    
    try {
      // Iniciar sesión con proveedor
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Usar signInWithPopup en lugar de signInWithRedirect
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Crear perfil de usuario en Firestore si es un usuario nuevo
      try {
        // Verificamos si es un usuario nuevo
        const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
        
        if (isNewUser) {
          await createUserProfile(user.uid);
        }
        
        // Guardar información básica del usuario
        const userData = {
          id: user.uid,
          email: user.email || '',
          name: user.displayName || '',
          isAuthenticated: true
        };
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Navegar a notebooks después de autenticación exitosa
        navigate('/notebooks', { replace: true });
      } catch (error) {
        console.error("Error creando perfil de usuario:", error);
        setError("Error al crear el perfil de usuario");
      }
      
    } catch (err: any) {
      console.error('Error en registro con Google:', err);
      
      let errorMessage = 'Error al registrarse con Google';
      
      if (err.code === 'auth/cancelled-popup-request') {
        errorMessage = 'La solicitud de registro fue cancelada';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <img src={simonLogo} alt="Simio Simón" className="simon-logo" />
          <h1><a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span style={{ color: 'black' }}>Simon</span>
              <span style={{ color: '#6147FF' }}>key</span>
              </a></h1>
          <p className="tagline">Crea tu cuenta y comienza a aprender</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSignup} className="signup-form">
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
            <label htmlFor="username">Nombre de usuario</label>
            <input 
              type="text" 
              id="username" 
              value={username} 
              onChange={handleUsernameChange} 
              placeholder="Tu nombre de usuario"
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="birthdate">Fecha de nacimiento</label>
            <input 
              type="date" 
              id="birthdate" 
              value={birthdate} 
              onChange={handleBirthdateChange} 
              max={new Date().toISOString().split('T')[0]}
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
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <input 
              type="password" 
              id="confirmPassword" 
              value={confirmPassword} 
              onChange={handleConfirmPasswordChange} 
              placeholder="Confirma tu contraseña"
              disabled={isLoading}
            />
          </div>
          
          <button 
            type="submit" 
            className="signup-button" 
            disabled={isLoading}
          >
            {isLoading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>
        
        <div className="social-signup">
          <p className="divider">O regístrate con</p>
          
          <div className="social-buttons">
            <button 
              className="google-button" 
              onClick={handleGoogleSignup}
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
        
        <div className="signup-footer">
          <p>¿Ya tienes cuenta? <a href="/login">Iniciar sesión</a></p>
          <p className="terms">Al registrarte, aceptas nuestros <a href="/">Términos y Condiciones</a> y <a href="/">Política de Privacidad</a></p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;