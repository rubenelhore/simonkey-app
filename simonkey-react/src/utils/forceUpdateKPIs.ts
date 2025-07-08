import { kpiService } from '../services/kpiService';
import { auth } from '../services/firebase';

/**
 * Función de utilidad para forzar la actualización de KPIs
 * Útil para depuración y pruebas
 */
export const forceUpdateKPIs = async (userId?: string): Promise<void> => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;
    
    if (!targetUserId) {
      console.error('[ForceUpdateKPIs] No se pudo determinar el userId');
      return;
    }
    
    console.log(`[ForceUpdateKPIs] Iniciando actualización forzada de KPIs para usuario: ${targetUserId}`);
    console.log('[ForceUpdateKPIs] Esta operación puede tardar unos segundos...');
    
    const startTime = Date.now();
    await kpiService.updateUserKPIs(targetUserId);
    const endTime = Date.now();
    
    console.log(`[ForceUpdateKPIs] ✅ KPIs actualizados exitosamente en ${endTime - startTime}ms`);
    console.log('[ForceUpdateKPIs] Revisa el Dashboard o la herramienta de verificación para ver los cambios');
  } catch (error) {
    console.error('[ForceUpdateKPIs] ❌ Error al actualizar KPIs:', error);
    throw error;
  }
};

// Exponer la función en el objeto window para uso desde la consola del navegador
if (typeof window !== 'undefined') {
  (window as any).forceUpdateKPIs = forceUpdateKPIs;
  console.log('[ForceUpdateKPIs] Función disponible en la consola: window.forceUpdateKPIs()');
}