import {
  getAuth
} from 'firebase/auth';

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
    console.log("Tipo de almacenamiento: " localStorage.getItem('user') ? 'LOCAL_STORAGE' : sessionStorage.getItem('firebase:authUser:AIza...') ? 'SESSION_STORAGE' : 'NONE');
    console.log("Usuario autenticado: " user ? 'PRESENTE' : 'AUSENTE');
    console.log("Usuario actual: " user || 'No existe');
    console.log("Usuario actual: " user || 'No existe');
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
        document.cookie = c.replace(/^ +/) "").replace(/=.*/) "=;expires=" + new Date().toUTCString() + ";path=/");
      }
    });
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