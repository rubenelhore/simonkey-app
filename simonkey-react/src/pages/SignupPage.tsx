import React, { useState, useEffect } from 'react';
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
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { createUserProfile, getUserProfile } from '../services/userService';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { sendVerificationEmail } from '../services/emailVerificationService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { handleGoogleAuth, handleRedirectResult, isLoading: googleLoading, error: googleError } = useGoogleAuth();
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [birthdate, setBirthdate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [visiblePassword, setVisiblePassword] = useState<'none' | 'password' | 'confirmPassword'>('none');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: boolean;
    username?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
    birthdate?: boolean;
  }>({});
  
  // Manejar resultado de redirect al cargar la página
  useEffect(() => {
    handleRedirectResult();
  }, [handleRedirectResult]);
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);
    setFieldErrors(prev => ({ ...prev, email: false }));
  };
  
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    setError(null);
    setFieldErrors(prev => ({ ...prev, username: false }));
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setError(null);
    setFieldErrors(prev => ({ ...prev, password: false }));
  };
  
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    setError(null);
    setFieldErrors(prev => ({ ...prev, confirmPassword: false }));
  };
  
  const handleBirthdateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBirthdate(e.target.value);
    setError(null);
    setFieldErrors(prev => ({ ...prev, birthdate: false }));
  };
  
  const validateForm = (): boolean => {
    const errors: typeof fieldErrors = {};
    let firstErrorMessage = '';
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (!firstErrorMessage) firstErrorMessage = 'Ingresa un correo electrónico válido';
      errors.email = true;
    }
    
    // Validar nombre de usuario
    if (username.length < 3) {
      if (!firstErrorMessage) firstErrorMessage = 'El nombre de usuario debe tener al menos 3 caracteres';
      errors.username = true;
    }
    
    // Validar contraseña
    if (password.length < 6) {
      if (!firstErrorMessage) firstErrorMessage = 'La contraseña debe tener al menos 6 caracteres';
      errors.password = true;
    }
    
    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      if (!firstErrorMessage) firstErrorMessage = 'Las contraseñas no coinciden';
      errors.password = true;
      errors.confirmPassword = true;
    }
    
    // Validar fecha de nacimiento
    if (!birthdate) {
      if (!firstErrorMessage) firstErrorMessage = 'Por favor, ingresa tu fecha de nacimiento';
      errors.birthdate = true;
    } else {
      const birthdateDate = new Date(birthdate);
      const year = birthdateDate.getFullYear();
      
      // Verificar rango de años (1950-2020)
      if (year < 1950 || year > 2020) {
        if (!firstErrorMessage) firstErrorMessage = 'La fecha introducida no es válida';
        errors.birthdate = true;
      } else {
        // Verificar que sea mayor de 13 años (solo si está en el rango válido)
        const today = new Date();
        let age = today.getFullYear() - year;
        const m = today.getMonth() - birthdateDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthdateDate.getDate())) {
          age--;
        }
        
        if (age < 13) {
          if (!firstErrorMessage) firstErrorMessage = 'Debes tener al menos 13 años para registrarte';
          errors.birthdate = true;
        }
      }
    }
    
    setError(firstErrorMessage || null);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
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
      
      // Crear perfil de usuario en Firestore usando el nuevo servicio
      await createUserProfile(user.uid, {
        email,
        username,
        nombre: username,
        displayName: username,
        birthdate,
        password
      });
      
      // Actualizar el perfil del usuario en Auth
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: username
        });
      }
      
      // Enviar email de verificación
      try {
        const verificationResult = await sendVerificationEmail(user);
        if (verificationResult.success) {
          console.log('✅ Email de verificación enviado exitosamente');
        } else {
          console.warn('⚠️ Error enviando verificación:', verificationResult.message);
        }
      } catch (verificationError) {
        console.error('❌ Error en verificación de email:', verificationError);
        // No bloquear el registro por error de verificación
      }
      
      console.log('Registro exitoso');
      
      // Verificar si hay un código de invitación pendiente
      const inviteCode = searchParams.get('inviteCode') || location.state?.inviteCode;
      
      if (inviteCode) {
        // Si hay código de invitación, ir directamente a la página de join
        console.log('Redirigiendo a join con código:', inviteCode);
        navigate(`/join/${inviteCode}`, { replace: true });
      } else {
        // TEMPORALMENTE DESHABILITADO - Ir directamente a inicio en lugar de verificación
        navigate('/inicio');
      }
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
    await handleGoogleAuth(true); // true para signup
  };
  
  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <img src="/img/favicon.svg" alt="Simio Simón" className="simon-logo" />
          <h1><a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span style={{ color: 'black' }}>Simon</span>
              <span style={{ color: 'black' }}>key</span>
              </a></h1>
          <p className="tagline">Crea tu cuenta y comienza a aprender</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        {googleError && <div className="error-message">{googleError}</div>}
        
        <div className="social-signup">
          <div className="social-buttons">
            <button 
              className="google-button" 
              onClick={handleGoogleSignup}
              disabled={isLoading || googleLoading}
              style={{width: '100%', marginBottom: '20px'}}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Registrarse con Google
            </button>
          </div>
          
          <p className="divider">O regístrate con email</p>
        </div>
        
        <form onSubmit={handleSignup} className="signup-form" noValidate>
          <div className="form-group form-group-email">
            <label htmlFor="email">Correo electrónico</label>
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={handleEmailChange} 
              placeholder="ejemplo@correo.com"
              disabled={isLoading}
              className={fieldErrors.email ? 'error-input' : ''}
            />
          </div>
          
          <div className="form-group form-group-username">
            <label htmlFor="username">Nombre de usuario</label>
            <input 
              type="text" 
              id="username" 
              value={username} 
              onChange={handleUsernameChange} 
              placeholder="Tu nombre de usuario"
              disabled={isLoading}
              className={fieldErrors.username ? 'error-input' : ''}
            />
          </div>
          
          <div className="form-group form-group-birthdate">
            <label htmlFor="birthdate">Fecha de nacimiento</label>
            <input 
              type="date" 
              id="birthdate" 
              value={birthdate} 
              onChange={handleBirthdateChange} 
              min="1950-01-01"
              max="2020-12-31"
              disabled={isLoading}
              className={fieldErrors.birthdate ? 'error-input' : ''}
              onInvalid={(e) => e.preventDefault()}
            />
          </div>
          
          <div className="form-group form-group-password">
            <label htmlFor="password">Contraseña</label>
            <div className="password-input-container">
              <input 
                type={visiblePassword === 'password' ? "text" : "password"} 
                id="password" 
                value={password} 
                onChange={handlePasswordChange} 
                placeholder="Tu contraseña"
                disabled={isLoading}
                className={fieldErrors.password ? 'error-input' : ''}
              />
              <button 
                type="button"
                className="password-toggle"
                onClick={() => setVisiblePassword(visiblePassword === 'password' ? 'none' : 'password')}
                disabled={isLoading}
              >
                <FontAwesomeIcon 
                  icon={visiblePassword === 'password' ? faEye : faEyeSlash} 
                  style={{ color: '#9ca3af', fontSize: '14px' }}
                />
              </button>
            </div>
          </div>
          
          <div className="form-group form-group-confirm-password">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <div className="password-input-container">
              <input 
                type={visiblePassword === 'confirmPassword' ? "text" : "password"} 
                id="confirmPassword" 
                value={confirmPassword} 
                onChange={handleConfirmPasswordChange} 
                placeholder="Confirma tu contraseña"
                disabled={isLoading}
                className={fieldErrors.confirmPassword ? 'error-input' : ''}
              />
              <button 
                type="button"
                className="password-toggle"
                onClick={() => setVisiblePassword(visiblePassword === 'confirmPassword' ? 'none' : 'confirmPassword')}
                disabled={isLoading}
              >
                <FontAwesomeIcon 
                  icon={visiblePassword === 'confirmPassword' ? faEye : faEyeSlash} 
                  style={{ color: '#9ca3af', fontSize: '14px' }}
                />
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="signup-button" 
            disabled={isLoading}
          >
            {isLoading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>
        
        <div className="signup-footer">
          <p>¿Ya tienes cuenta? <a href="/login">Iniciar sesión</a></p>
          <p className="terms">Al registrarte, aceptas nuestros <a href="/">Términos y Condiciones</a> y <a href="/">Política de Privacidad</a></p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;