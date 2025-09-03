import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserProfile, getUserProfile, checkUserExistsByEmail, handleExistingUserWithSameEmail } from '../services/userService';
import { checkEmailVerificationStatus } from '../services/emailVerificationService';

export const useGoogleAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Función para detectar si el entorno tiene políticas COOP activas
  const shouldUseRedirect = () => {
    // Si hay un error previo guardado relacionado con COOP, usar redirect
    const hasPreviousCOOPError = localStorage.getItem('coop_error_detected') === 'true';
    
    // IMPORTANTE: Limpiar errores COOP antiguos (más de 24 horas)
    const coopErrorTimestamp = localStorage.getItem('coop_error_timestamp');
    if (coopErrorTimestamp) {
      const errorAge = Date.now() - parseInt(coopErrorTimestamp);
      const oneDayInMs = 24 * 60 * 60 * 1000;
      if (errorAge > oneDayInMs) {
        console.log('🧹 Limpiando error COOP antiguo');
        localStorage.removeItem('coop_error_detected');
        localStorage.removeItem('coop_error_timestamp');
        return false; // Intentar popup primero
      }
    }
    
    // Detectar dominios conocidos con políticas COOP estrictas
    const hostname = window.location.hostname;
    const knownCOOPDomains = [
      'simonkey.ai',
      'www.simonkey.ai',
      // Agregar otros dominios de producción si es necesario
    ];
    
    const isKnownCOOPDomain = knownCOOPDomains.includes(hostname);
    
    // Detectar si estamos en un entorno con HTTPS (más probable que tenga COOP)
    const isHTTPS = window.location.protocol === 'https:';
    
    // NUEVO: Detectar entornos de desarrollo con Vite que pueden tener COOP
    const isViteDev = hostname === 'localhost' && (
      window.location.port === '5173' || 
      window.location.port === '3000' ||
      window.location.port === '5174'
    );
    
    // Detectar si el navegador soporta Cross-Origin-Opener-Policy
    const supportsCOOP = 'crossOriginIsolated' in window;
    
    // Usar redirect SOLO si hay error COOP previo reciente
    // NO forzar redirect solo por ser dominio conocido
    return hasPreviousCOOPError;
  };

  const handleGoogleAuth = async (isSignup: boolean = false) => {
    setIsLoading(true);
    setError(null);
    
    // Debug: Mostrar información sobre la detección COOP
    const useRedirect = shouldUseRedirect();
    console.log('🔍 Información de autenticación:', {
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      port: window.location.port,
      hasPreviousCOOPError: localStorage.getItem('coop_error_detected') === 'true',
      supportsCOOP: 'crossOriginIsolated' in window,
      crossOriginIsolated: window.crossOriginIsolated,
      willUseRedirect: useRedirect
    });
    
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      let result;
      let user;
      
      // Decidir el método de autenticación basado en el entorno
      if (useRedirect) {
        console.log('🔄 Usando redirect debido a políticas de seguridad detectadas');
        
        // Guardar el estado antes del redirect
        localStorage.setItem('google_auth_intent', isSignup ? 'signup' : 'login');
        
        // Usar redirect directamente
        await signInWithRedirect(auth, provider);
        return; // La función terminará aquí, el redirect manejará el resto
      }
      
      try {
        // Intentar con popup solo si el entorno lo permite
        console.log('🔄 Intentando autenticación con popup');
        result = await signInWithPopup(auth, provider);
        user = result.user;
        
        // Si el popup funcionó correctamente, limpiar el flag de error COOP
        localStorage.removeItem('coop_error_detected');
      } catch (popupError: any) {
        console.warn('⚠️ Error con popup:', popupError.code);
        
        // Detectar errores relacionados con COOP incluso si no tienen códigos específicos
        const isCOOPError = popupError.code === 'auth/popup-blocked' || 
                           popupError.code === 'auth/cancelled-popup-request' ||
                           popupError.message?.includes('Cross-Origin-Opener-Policy') ||
                           popupError.message?.includes('window.closed') ||
                           popupError.message?.includes('window.close') ||
                           popupError.name === 'TypeError'; // A veces los errores COOP son TypeError
        
        if (isCOOPError) {
          localStorage.setItem('coop_error_detected', 'true');
          localStorage.setItem('coop_error_timestamp', Date.now().toString());
          console.log('🔄 Error COOP detectado, usando redirect como fallback');
          console.log('🔍 Detalles del error:', {
            code: popupError.code,
            message: popupError.message,
            name: popupError.name
          });
          
          // Mostrar mensaje informativo al usuario
          console.log('ℹ️ Se detectaron políticas de seguridad estrictas. Redirigiendo a Google...');
          
          // Guardar el estado antes del redirect
          localStorage.setItem('google_auth_intent', isSignup ? 'signup' : 'login');
          
          // Pequeña pausa para que el usuario vea el mensaje
          setTimeout(async () => {
            try {
              await signInWithRedirect(auth, provider);
            } catch (redirectError) {
              console.error('❌ Error incluso con redirect:', redirectError);
              setError('Error de autenticación. Por favor, intenta nuevamente.');
            }
          }, 1000);
          
          return;
        } else {
          // Si es otro tipo de error, re-lanzarlo
          throw popupError;
        }
      }
      
      // Procesar el usuario usando la función auxiliar
      await processGoogleUser(user, isSignup);
      
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

  // Función para manejar el resultado del redirect
  const handleRedirectResult = async () => {
    try {
      const result = await getRedirectResult(auth);
      
      if (result) {
        console.log('✅ Redirect exitoso, procesando usuario...');
        const user = result.user;
        const authIntent = localStorage.getItem('google_auth_intent');
        const isSignup = authIntent === 'signup';
        
        // Limpiar el estado guardado
        localStorage.removeItem('google_auth_intent');
        
        // Limpiar también los flags de COOP ya que el redirect funcionó
        localStorage.removeItem('coop_error_detected');
        localStorage.removeItem('coop_error_timestamp');
        
        // Procesar el usuario como en el método original
        await processGoogleUser(user, isSignup);
        
        console.log('✅ Procesamiento post-redirect completado');
      }
    } catch (error) {
      console.error('❌ Error procesando redirect result:', error);
      
      // Si el redirect falla consistentemente, limpiar los flags
      const attempts = parseInt(localStorage.getItem('redirect_attempts') || '0');
      if (attempts > 2) {
        console.log('🧹 Limpiando flags de COOP después de múltiples intentos fallidos');
        localStorage.removeItem('coop_error_detected');
        localStorage.removeItem('coop_error_timestamp');
        localStorage.removeItem('redirect_attempts');
      } else {
        localStorage.setItem('redirect_attempts', (attempts + 1).toString());
      }
      
      setError('Error procesando la autenticación. Por favor, intenta nuevamente.');
    }
  };

  // Función auxiliar para procesar el usuario (extraída del código original)
  const processGoogleUser = async (user: any, isSignup: boolean) => {
    console.log(`✅ ${isSignup ? 'Registro' : 'Inicio de sesión'} exitoso con Google:`, user.uid);
    console.log('🔍 Email del usuario de Google Auth:', user.email);
    
    // Verificar si ya existe un usuario con el mismo email en Firestore
    console.log('🔍 Iniciando verificación de usuario existente...');
    const existingUserCheck = await checkUserExistsByEmail(user.email || '');
    console.log('🔍 Resultado de verificación de usuario existente:', existingUserCheck);
    
    // Si es login (isSignup = false) y el usuario existe, verificar perfil
    if (!isSignup && existingUserCheck.exists) {
      console.log('🔍 Modo LOGIN: Verificando que el usuario existe sin crear perfiles...');
      console.log('🔍 ID del usuario existente:', existingUserCheck.userId);
      console.log('🔍 UID de Google:', user.uid);
      
      // Para usuarios escolares, el perfil está bajo el ID escolar, no el UID de Google
      const profileIdToCheck = existingUserCheck.userId || user.uid;
      console.log('🔍 Verificando perfil con ID:', profileIdToCheck);
      
      // Verificar que el usuario existe en Firestore
      const existingProfile = await getUserProfile(profileIdToCheck);
      if (!existingProfile) {
        console.log('❌ Usuario no tiene perfil en Firestore, cerrando sesión...');
        await signOut(auth);
        setError('Tu cuenta no tiene un perfil válido. Por favor, regístrate nuevamente.');
        localStorage.removeItem('user');
        window.location.replace('/signup');
        return;
      }
      
      console.log('✅ Usuario existe y tiene perfil válido, continuando con login...');
      console.log('✅ Tipo de usuario:', existingUserCheck.userType);
      
      // Guardar información básica del usuario
      const userData = {
        id: existingUserCheck.userId || user.uid,
        email: user.email || '',
        name: user.displayName || '',
        isAuthenticated: true
      };
      localStorage.setItem('user', JSON.stringify(userData));
      
      console.log('✅ Login con Google completado exitosamente.');
      return;
    }
    
    // Si es registro (isSignup = true) o login con usuario nuevo, continuar con la lógica existente
    console.log('🔍 Modo REGISTRO o LOGIN con usuario nuevo: Continuando con lógica de registro...');
    
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
        
        // Si es un usuario escolar, estamos usando su ID original, NO el UID de Google
        if (existingUserCheck.userType?.includes('SCHOOL')) {
          console.log('🏫 Usuario escolar detectado, usando perfil escolar existente');
        }
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
  };

  // Función de diagnóstico COOP para depuración
  const diagnoseCOOP = () => {
    console.log('🔧 === DIAGNÓSTICO COOP ===');
    console.log('🌐 Información del entorno:');
    console.log('  - hostname:', window.location.hostname);
    console.log('  - protocol:', window.location.protocol);
    console.log('  - port:', window.location.port);
    console.log('  - href completo:', window.location.href);
    
    console.log('🔒 Información de seguridad:');
    console.log('  - crossOriginIsolated:', window.crossOriginIsolated);
    console.log('  - supportsCOOP:', 'crossOriginIsolated' in window);
    console.log('  - isSecureContext:', window.isSecureContext);
    
    console.log('💾 Estado guardado:');
    console.log('  - coop_error_detected:', localStorage.getItem('coop_error_detected'));
    console.log('  - google_auth_intent:', localStorage.getItem('google_auth_intent'));
    
    console.log('🎯 Configuración recomendada:');
    const shouldUseRedirectNow = shouldUseRedirect();
    console.log('  - shouldUseRedirect:', shouldUseRedirectNow);
    console.log('  - recomendación:', shouldUseRedirectNow ? 'Usar redirect' : 'Usar popup');
    
    console.log('🔧 Acciones disponibles:');
    console.log('  - window.clearCOOPError() - Limpiar error COOP guardado');
    console.log('  - window.forceCOOPRedirect() - Forzar uso de redirect');
    console.log('========================');
  };

  // Funciones de utilidad para la consola
  if (typeof window !== 'undefined') {
    (window as any).diagnoseCOOP = diagnoseCOOP;
    (window as any).clearCOOPError = () => {
      localStorage.removeItem('coop_error_detected');
      localStorage.removeItem('google_auth_intent');
      console.log('✅ Errores COOP limpiados');
    };
    (window as any).forceCOOPRedirect = () => {
      localStorage.setItem('coop_error_detected', 'true');
      console.log('✅ Forzado uso de redirect para próximas autenticaciones');
    };
  }

  return {
    handleGoogleAuth,
    handleRedirectResult,
    isLoading,
    error,
    setError,
    diagnoseCOOP
  };
}; 