import { getAuth } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getUserProfile, createUserProfile } from '../services/userService';

/**
 * Utilidad para depurar problemas de autenticación
 */
export const authDebugger = {
  /**
   * Mostrar información completa sobre el estado de autenticación
   */
  showAuthState: () => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    console.group("🔍 Información de Autenticación");
    console.log("Usuario actual:", user ? {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      providerId: user.providerData?.[0]?.providerId,
      isAnonymous: user.isAnonymous,
      emailVerified: user.emailVerified,
      metadata: user.metadata
    } : "No hay usuario autenticado");
    
    console.log("Estado de persistencia:", localStorage.getItem('firebase:authUser:AIza...') ? 
      'LOCAL_STORAGE' : sessionStorage.getItem('firebase:authUser:AIza...') ? 
      'SESSION_STORAGE' : 'NONE');
    
    console.log("Cookie de autenticación:", document.cookie.includes('firebaseAuth') ? 'PRESENTE' : 'AUSENTE');
    
    console.log("User en localStorage:", localStorage.getItem('user') || 'No existe');
    console.log("Contexto de redirección:", sessionStorage.getItem('authRedirectPending') || 'No existe');
    console.groupEnd();
    
    return "Información de autenticación impresa en consola";
  },
  
  /**
   * Limpiar datos de autenticación
   */
  clearAuthData: () => {
    // Limpiar localStorage
    localStorage.removeItem('user');
    
    // Buscar y limpiar datos de Firebase en localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.includes('firebase:authUser')) {
        localStorage.removeItem(key);
      }
    });
    
    // Limpiar sessionStorage
    sessionStorage.removeItem('authRedirectPending');
    
    // Buscar y limpiar datos de Firebase en sessionStorage
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('firebase:authUser')) {
        sessionStorage.removeItem(key);
      }
    });
    
    // Limpiar cookies relacionadas con Firebase
    document.cookie.split(";").forEach(function(c) {
      if (c.trim().startsWith("firebaseAuth") || c.trim().startsWith("__session")) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      }
    });
    
    console.log("✅ Datos de autenticación limpiados. Recarga la página para que los cambios surtan efecto.");
    
    return "Datos de autenticación limpiados";
  },

  /**
   * Forzar redirección a notebooks
   */
  forceRedirectToNotebooks: () => {
    window.location.href = '/notebooks';
    return "Redirigiendo a /notebooks...";
  }
};

/**
 * Script de diagnóstico para problemas de autenticación
 */
export const diagnoseAuthIssues = async () => {
  console.log('🔍 === DIAGNÓSTICO DE AUTENTICACIÓN ===');
  
  try {
    // 1. Verificar usuario actual de Firebase Auth
    const currentUser = auth.currentUser;
    console.log('1. Usuario actual de Firebase Auth:', currentUser ? {
      uid: currentUser.uid,
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      displayName: currentUser.displayName
    } : 'No hay usuario autenticado');

    if (!currentUser) {
      console.log('❌ No hay usuario autenticado en Firebase Auth');
      return;
    }

    // 2. Verificar documento en Firestore
    console.log('2. Verificando documento en Firestore...');
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    console.log('Documento existe en Firestore:', userDoc.exists());
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('Datos del usuario en Firestore:', {
        id: userData.id,
        email: userData.email,
        subscription: userData.subscription,
        schoolRole: userData.schoolRole,
        notebookCount: userData.notebookCount,
        maxNotebooks: userData.maxNotebooks
      });
    } else {
      console.log('❌ Documento de usuario no existe en Firestore');
    }

    // 3. Probar getUserProfile
    console.log('3. Probando getUserProfile...');
    const profile = await getUserProfile(currentUser.uid);
    console.log('Perfil obtenido con getUserProfile:', profile ? {
      id: profile.id,
      email: profile.email,
      subscription: profile.subscription,
      schoolRole: profile.schoolRole
    } : 'null');

    // 4. Verificar si es usuario huérfano
    if (!userDoc.exists()) {
      console.log('4. Usuario huérfano detectado, creando perfil...');
      
      const userData = {
        email: currentUser.email || '',
        username: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
        nombre: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
        displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
        birthdate: ''
      };

      await createUserProfile(currentUser.uid, userData);
      console.log('✅ Perfil de usuario creado exitosamente');
      
      // Verificar que se creó correctamente
      const newProfile = await getUserProfile(currentUser.uid);
      console.log('Nuevo perfil creado:', newProfile ? {
        id: newProfile.id,
        email: newProfile.email,
        subscription: newProfile.subscription,
        schoolRole: newProfile.schoolRole
      } : 'null');
    }

    console.log('✅ === DIAGNÓSTICO COMPLETADO ===');
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
  }
};

/**
 * Función para arreglar usuario huérfano manualmente
 */
export const fixOrphanUser = async () => {
  console.log('🔧 === ARREGLANDO USUARIO HUÉRFANO ===');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return false;
    }

    console.log('Usuario a arreglar:', currentUser.email);

    // Verificar si ya existe el documento
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      console.log('✅ Usuario ya existe en Firestore');
      return true;
    }

    // Crear perfil de usuario
    const userData = {
      email: currentUser.email || '',
      username: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
      nombre: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
      displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
      birthdate: ''
    };

    await createUserProfile(currentUser.uid, userData);
    console.log('✅ Usuario huérfano arreglado exitosamente');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error arreglando usuario huérfano:', error);
    return false;
  }
};

// Exponer la función globalmente para uso en depuración
if (typeof window !== 'undefined') {
  (window as any).authDebug = authDebugger;
  (window as any).diagnoseAuthIssues = diagnoseAuthIssues;
  (window as any).fixOrphanUser = fixOrphanUser;
}