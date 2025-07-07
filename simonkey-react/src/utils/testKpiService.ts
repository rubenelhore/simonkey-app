import { kpiService } from '../services/kpiService';

// Función para probar la actualización de KPIs
export async function testKpiUpdate(userId: string) {
  try {
    console.log('🔧 Iniciando actualización de KPIs para usuario:', userId);
    
    const startTime = Date.now();
    await kpiService.updateUserKPIs(userId);
    const endTime = Date.now();
    
    console.log(`✅ KPIs actualizados exitosamente en ${endTime - startTime}ms`);
    
    // Obtener y mostrar los KPIs actualizados
    const kpis = await kpiService.getUserKPIs(userId);
    if (kpis) {
      console.log('📊 KPIs actuales:', kpis);
    } else {
      console.log('⚠️ No se encontraron KPIs para el usuario');
    }
    
    return kpis;
  } catch (error) {
    console.error('❌ Error al actualizar KPIs:', error);
    throw error;
  }
}

// Hacer la función disponible globalmente para pruebas en consola
if (typeof window !== 'undefined') {
  (window as any).testKpiUpdate = testKpiUpdate;
  console.log('🔧 Función testKpiUpdate disponible en window.testKpiUpdate(userId)');
}