import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserProfile, getUserProfile } from '../services/userService';
import { useNavigate } from 'react-router-dom';

export const useGoogleAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGoogleAuth = async (isSignup: boolean = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Usar signInWithPopup para autenticación directa
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      console.log(`${isSignup ? 'Registro' : 'Inicio de sesión'} con Google exitoso:`, user.uid);
      
      // SIEMPRE crear perfil si no existe, tanto en login como en registro
      try {
        const existingProfile = await getUserProfile(user.uid);
        if (!existingProfile) {
          // Crear perfil con datos básicos y valores por defecto
          await createUserProfile(user.uid, {
            email: user.email || '',
            username: user.displayName || user.email?.split('@')[0] || '',
            nombre: user.displayName || '',
            displayName: user.displayName || '',
            birthdate: new Date().toISOString().split('T')[0] // Valor por defecto: fecha actual
          });
          console.log('Perfil creado automáticamente para usuario Google:', user.uid);
        } else {
          console.log('Usuario con perfil existente');
        }
      } catch (profileError: any) {
        console.error("Error verificando/creando perfil de usuario:", profileError);
        setError("Error verificando/creando perfil de usuario: " + (profileError?.message || profileError));
        // No bloquear la autenticación por este error
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
      
    } catch (err: any) {
      console.error(`Error en ${isSignup ? 'registro' : 'inicio de sesión'} con Google:`, err);
      let errorMessage = `Error al ${isSignup ? 'registrarse' : 'iniciar sesión'} con Google`;
      if (err.code === 'auth/cancelled-popup-request') {
        errorMessage = `La solicitud de ${isSignup ? 'registro' : 'inicio de sesión'} fue cancelada`;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleGoogleAuth,
    isLoading,
    error,
    setError
  };
}; 