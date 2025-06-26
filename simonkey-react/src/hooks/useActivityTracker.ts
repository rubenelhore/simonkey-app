import { useCallback } from 'react';

// Hook para registrar actividad específica de la plataforma
export const useActivityTracker = () => {
  const recordActivity = useCallback((action: string, details?: any) => {
    // Buscar la función recordActivity del hook de inactividad
    const inactivityHook = (window as any).__inactivityHook;
    if (inactivityHook?.recordActivity) {
      inactivityHook.recordActivity(action);
    }
    
    // También registrar en el servicio de actividad si hay usuario autenticado
    const user = (window as any).firebase?.auth?.currentUser;
    if (user?.uid) {
      import('../services/activityService').then(({ recordUserActivity }) => {
        recordUserActivity(user.uid, window.location.pathname, action);
      });
    }
    
    console.log(`📊 Actividad registrada: ${action}`, details);
  }, []);

  return { recordActivity };
};

// Función helper para registrar actividad desde cualquier lugar
export const trackActivity = (action: string, details?: any) => {
  const inactivityHook = (window as any).__inactivityHook;
  if (inactivityHook?.recordActivity) {
    inactivityHook.recordActivity(action);
  }
  
  const user = (window as any).firebase?.auth?.currentUser;
  if (user?.uid) {
    import('../services/activityService').then(({ recordUserActivity }) => {
      recordUserActivity(user.uid, window.location.pathname, action);
    });
  }
  
  console.log(`📊 Actividad registrada: ${action}`, details);
}; 