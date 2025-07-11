import { kpiService } from '../services/kpiService';

export const testUpdateKPIs = async (userId: string) => {
  try {
    console.log('[TestUpdateKPIs] Actualizando KPIs para usuario:', userId);
    
    await kpiService.updateUserKPIs(userId);
    
    console.log('[TestUpdateKPIs] KPIs actualizados exitosamente');
    
    // Obtener y mostrar los KPIs actualizados
    const kpis = await kpiService.getUserKPIs(userId);
    console.log('[TestUpdateKPIs] KPIs actualizados:', kpis);
    
    if (kpis?.tiempoEstudioSemanal) {
      console.log('[TestUpdateKPIs] Tiempo de estudio semanal:', kpis.tiempoEstudioSemanal);
    }
    
    return kpis;
  } catch (error) {
    console.error('[TestUpdateKPIs] Error:', error);
    throw error;
  }
};

// Exponer la función para poder usarla desde la consola
(window as any).testUpdateKPIs = testUpdateKPIs;