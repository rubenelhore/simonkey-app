import { kpiService } from '../services/kpiService';

async function debugKpiService(userId: string = 'dTjO1PRNgRgvmOYItXhHseqpOY72') {
  console.log('🔍 Iniciando debug del servicio KPI...');
  
  try {
    // Llamar al servicio KPI sin actualizar la base de datos
    const kpis = await kpiService.getUserKPIs(userId);
    
    console.log('✅ KPIs obtenidos:', kpis);
    
    // Mostrar información específica sobre juegos
    if (kpis && kpis.cuadernos) {
      console.log('\n📓 Datos de juegos por cuaderno:');
      Object.entries(kpis.cuadernos).forEach(([notebookId, data]: [string, any]) => {
        console.log(`  ${notebookId}: ${data.nombreCuaderno}`);
        console.log(`    - juegosJugados: ${data.juegosJugados}`);
        console.log(`    - tiempoJuegosLocal: ${data.tiempoJuegosLocal} minutos`);
      });
    }
    
    return kpis;
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
    throw error;
  }
}

// Hacer la función disponible globalmente
(window as any).debugKpiService = debugKpiService;

console.log('🛠️ Función debugKpiService() disponible en la consola');
console.log('   Úsala para ver los logs del KPI service sin recargar la página');

export { debugKpiService };