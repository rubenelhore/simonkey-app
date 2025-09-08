// Función temporal para recalcular scores con la nueva fórmula
import { kpiService } from '../services/kpiService';
import { auth } from '../services/firebase';

export async function recalculateUserScores() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No hay usuario autenticado');
      return null;
    }

    console.log('🔄 Recalculando scores con la nueva fórmula...');
    console.log('📊 Usuario:', user.uid);
    
    // Forzar actualización de KPIs
    await kpiService.updateUserKPIs(user.uid);
    
    // Obtener los nuevos KPIs
    const kpis = await kpiService.getUserKPIs(user.uid);
    
    if (kpis) {
      console.log('✅ Scores actualizados exitosamente');
      console.log('📈 Nuevo Score Global:', kpis.global.scoreGlobal);
      console.log('📚 Scores por cuaderno:');
      
      Object.entries(kpis.cuadernos).forEach(([id, data]: [string, any]) => {
        console.log(`  - ${data.nombreCuaderno}: ${data.scoreCuaderno} puntos`);
      });
      
      // Recargar la página para mostrar los nuevos valores
      window.location.reload();
      
      return kpis.global.scoreGlobal;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error recalculando scores:', error);
    return null;
  }
}

// Exponer la función globalmente para uso en consola
if (typeof window !== 'undefined') {
  (window as any).recalculateScores = recalculateUserScores;
}