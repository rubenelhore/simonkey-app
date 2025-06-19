import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserProfile, getUserProfile } from '../services/userService';
import { useNavigate } from 'react-router-dom';
import { checkEmailVerificationStatus } from '../services/emailVerificationService';

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
      
      console.log(`✅ ${isSignup ? 'Registro' : 'Inicio de sesión'} exitoso con Google:`, user.uid);
      
      // Verificar que el usuario existe en Firestore
      const existingProfile = await getUserProfile(user.uid);
      if (!existingProfile) {
        // Usuario no existe en Firestore (fue eliminado), cerrar sesión
        console.log("Usuario eliminado detectado durante login con Google, cerrando sesión:", user.uid);
        await signOut(auth);
        setError("Tu cuenta ha sido eliminada. Por favor, regístrate nuevamente.");
        return;
      }
      
      // SIEMPRE crear perfil si no existe, tanto en login como en registro
      try {
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
      
      // Verificar estado de email para usuarios de Google
      const isEmailVerified = await checkEmailVerificationStatus(user);
      console.log('Estado de verificación de email:', isEmailVerified ? 'verificado' : 'no verificado');
      
      // Guardar información básica del usuario
      const userData = {
        id: user.uid,
        email: user.email || '',
        name: user.displayName || '',
        isAuthenticated: true
      };
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Navegar según el estado de verificación
      if (isEmailVerified) {
        // Email verificado, ir a notebooks
        navigate('/notebooks', { replace: true });
      } else {
        // Email no verificado, ir a página de verificación
        // Nota: Los usuarios de Google normalmente tienen emails verificados automáticamente
        // pero por seguridad verificamos de todas formas
        console.log('Usuario de Google requiere verificación de email');
        navigate('/verify-email', { replace: true });
      }
      
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