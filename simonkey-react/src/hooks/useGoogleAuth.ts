import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserProfile, getUserProfile } from '../services/userService';
import { checkEmailVerificationStatus } from '../services/emailVerificationService';

export const useGoogleAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      
      console.log(`✅ ${isSignup ? 'Registro' : 'Inicio de sesión'} exitoso con Google:`, user.uid);
      
      // Verificar que el usuario existe en Firestore
      const existingProfile = await getUserProfile(user.uid);
      if (!existingProfile) {
        // Usuario no existe en Firestore, crear perfil automáticamente
        console.log("Usuario no encontrado en Firestore, creando perfil automáticamente:", user.uid);
        
        try {
          await createUserProfile(user.uid, {
            email: user.email || '',
            username: user.displayName || user.email?.split('@')[0] || '',
            nombre: user.displayName || '',
            displayName: user.displayName || '',
            birthdate: new Date().toISOString().split('T')[0] // Valor por defecto: fecha actual
          });
          console.log('✅ Perfil creado exitosamente para usuario Google:', user.uid);
        } catch (profileError: any) {
          console.error("Error creando perfil de usuario:", profileError);
          setError("Error creando perfil de usuario: " + (profileError?.message || profileError));
          return;
        }
      } else {
        console.log('Usuario con perfil existente');
      }
      
      // Verificar estado de email para usuarios de Google
      console.log('🔍 useGoogleAuth - Verificando estado de email para usuario de Google');
      console.log('🔍 useGoogleAuth - user.emailVerified (antes de checkEmailVerificationStatus):', user.emailVerified);
      console.log('🔍 useGoogleAuth - user.providerData:', user.providerData);
      
      const isEmailVerified = await checkEmailVerificationStatus(user);
      console.log('🔍 useGoogleAuth - Estado de verificación de email:', isEmailVerified ? 'verificado' : 'no verificado');
      
      // Guardar información básica del usuario
      const userData = {
        id: user.uid,
        email: user.email || '',
        name: user.displayName || '',
        isAuthenticated: true
      };
      localStorage.setItem('user', JSON.stringify(userData));
      
      // NO navegar aquí - dejar que el sistema de rutas maneje la navegación
      console.log('✅ useGoogleAuth - Autenticación con Google completada. El sistema de rutas manejará la navegación.');
      console.log('✅ useGoogleAuth - Estado final: isEmailVerified =', isEmailVerified);
      
    } catch (err: any) {
      console.error(`Error en ${isSignup ? 'registro' : 'inicio de sesión'} con Google:`, err);
      let errorMessage = `Error al ${isSignup ? 'registrarse' : 'iniciar sesión'} con Google`;
      if (err.code === 'auth/cancelled-popup-request') {
        errorMessage = `La solicitud de ${isSignup ? 'registro' : 'inicio de sesión'} fue cancelada`;
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'La ventana de Google se cerró antes de completar el proceso';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'El popup fue bloqueado por el navegador. Permite popups para este sitio.';
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