import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserProfile, getUserProfile, checkUserExistsByEmail, handleExistingUserWithSameEmail } from '../services/userService';
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
      console.log('🔍 Email del usuario de Google Auth:', user.email);
      
      // Verificar si ya existe un usuario con el mismo email en Firestore
      console.log('🔍 Iniciando verificación de usuario existente...');
      const existingUserCheck = await checkUserExistsByEmail(user.email || '');
      console.log('🔍 Resultado de verificación de usuario existente:', existingUserCheck);
      
      let userIdToUse = user.uid; // Por defecto usar el UID de Google Auth
      let shouldCreateProfile = true; // Por defecto crear perfil
      
      if (existingUserCheck.exists) {
        console.log('⚠️ Usuario existente encontrado con el mismo email:', existingUserCheck.userId);
        console.log('⚠️ Tipo de usuario existente:', existingUserCheck.userType);
        console.log('⚠️ Datos del usuario existente:', existingUserCheck.userData);
        
        // Manejar el caso de usuario existente
        console.log('🔄 Manejando usuario existente...');
        const handleResult = await handleExistingUserWithSameEmail(user, existingUserCheck);
        console.log('🔄 Resultado del manejo de usuario existente:', handleResult);
        
        if (!handleResult.shouldContinue) {
          // Cerrar sesión y mostrar mensaje de error
          console.log('❌ No se debe continuar, cerrando sesión...');
          await signOut(auth);
          setError(handleResult.message || "Error procesando tu cuenta. Por favor, intenta nuevamente.");
          return;
        }
        
        // Si hay un mensaje de éxito, mostrarlo
        if (handleResult.message) {
          console.log('✅', handleResult.message);
        }
        
        // Si necesitamos usar el ID del usuario existente
        if (handleResult.useExistingUserId) {
          userIdToUse = handleResult.useExistingUserId;
          shouldCreateProfile = false; // No crear perfil nuevo, usar el existente
          console.log('🔄 Usando ID de usuario existente:', userIdToUse);
          console.log('🔄 No se creará perfil nuevo, se usará el existente');
        }
      } else {
        console.log('✅ No se encontró usuario existente, continuando con creación normal');
      }
      
      // Verificar que el usuario existe en Firestore usando el ID correcto
      console.log('🔍 Verificando perfil en Firestore con ID:', userIdToUse);
      const existingProfile = await getUserProfile(userIdToUse);
      console.log('🔍 Perfil encontrado en Firestore:', existingProfile);
      
      if (!existingProfile && shouldCreateProfile) {
        // Usuario no existe en Firestore, crear perfil automáticamente
        console.log("Usuario no encontrado en Firestore, creando perfil automáticamente:", userIdToUse);
        
        try {
          await createUserProfile(userIdToUse, {
            email: user.email || '',
            username: user.displayName || user.email?.split('@')[0] || '',
            nombre: user.displayName || '',
            displayName: user.displayName || '',
            birthdate: new Date().toISOString().split('T')[0] // Valor por defecto: fecha actual
          });
          console.log('✅ Perfil creado exitosamente para usuario Google:', userIdToUse);
        } catch (profileError: any) {
          console.error("Error creando perfil de usuario:", profileError);
          setError("Error creando perfil de usuario: " + (profileError?.message || profileError));
          return;
        }
      } else if (existingProfile) {
        console.log('✅ Usuario con perfil existente encontrado:', existingProfile);
        console.log('📋 Detalles del perfil existente:', {
          id: existingProfile.id,
          email: existingProfile.email,
          subscription: existingProfile.subscription,
          schoolRole: existingProfile.schoolRole
        });
      } else {
        console.log('✅ Usando perfil existente sin crear uno nuevo');
      }
      
      // Verificar estado de email para usuarios de Google
      console.log('🔍 useGoogleAuth - Verificando estado de email para usuario de Google');
      console.log('🔍 useGoogleAuth - user.emailVerified (antes de checkEmailVerificationStatus):', user.emailVerified);
      console.log('🔍 useGoogleAuth - user.providerData:', user.providerData);
      
      const isEmailVerified = await checkEmailVerificationStatus(user);
      console.log('🔍 useGoogleAuth - Estado de verificación de email:', isEmailVerified ? 'verificado' : 'no verificado');
      
      // Guardar información básica del usuario usando el ID correcto
      const userData = {
        id: userIdToUse,
        email: user.email || '',
        name: user.displayName || '',
        isAuthenticated: true
      };
      localStorage.setItem('user', JSON.stringify(userData));
      
      // NO navegar aquí - dejar que el sistema de rutas maneje la navegación
      console.log('✅ useGoogleAuth - Autenticación con Google completada. El sistema de rutas manejará la navegación.');
      console.log('✅ useGoogleAuth - Estado final: isEmailVerified =', isEmailVerified);
      console.log('✅ useGoogleAuth - ID de usuario final usado:', userIdToUse);
      
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