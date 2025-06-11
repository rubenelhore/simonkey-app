import { getAuth } from 'firebase/auth';

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

// Exponer la función globalmente para uso en depuración
if (typeof window !== 'undefined') {
  (window as any).authDebug = authDebugger;
}