import { kpiService } from '../services/kpiService';
import { auth } from '../services/firebase';

async function forceReloadKPIs() {
  console.log('🔄 Forzando recarga de KPIs...');
  
  const userId = auth.currentUser?.uid;
  if (!userId) {
    console.log('❌ No hay usuario autenticado');
    return;
  }
  
  try {
    // Limpiar cualquier caché que pueda existir
    (window as any).__kpiCache = null;
    
    // Llamar directamente al servicio
    console.log('📊 Llamando a getUserKPIs...');
    const kpis = await kpiService.getUserKPIs(userId);
    
    console.log('✅ KPIs recargados:', kpis);
    
    if (kpis) {
      console.log('🎮 Datos de juegos por cuaderno:');
      Object.entries(kpis.cuadernos).forEach(([notebookId, data]: [string, any]) => {
        console.log(`   - ${notebookId}: juegosJugados=${data.juegosJugados}`);
      });
    } else {
      console.log('⚠️ No se obtuvieron KPIs');
    }
    
    // Forzar actualización de la página
    window.location.reload();
    
  } catch (error) {
    console.error('❌ Error recargando KPIs:', error);
  }
}

// Hacer la función disponible en la consola
(window as any).forceReloadKPIs = forceReloadKPIs;

console.log('🛠️ Script cargado. Ejecuta forceReloadKPIs() en la consola.');

export default forceReloadKPIs;