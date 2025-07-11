import { kpiService } from '../services/kpiService';

async function testKpiWithLogs(userId: string = 'dTjO1PRNgRgvmOYItXhHseqpOY72') {
  console.log('🔍 Ejecutando KPI Service con logs habilitados...\n');
  
  // Habilitar logs temporalmente
  const originalLog = console.log;
  const logs: string[] = [];
  
  // Capturar todos los logs
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    logs.push(message);
    originalLog(...args);
  };
  
  try {
    console.log('📊 Llamando a updateUserKPIs para forzar recálculo...');
    await kpiService.updateUserKPIs(userId);
    console.log('✅ KPIs actualizados, ahora obteniendo los nuevos valores...');
    const kpis = await kpiService.getUserKPIs(userId);
    
    // Restaurar console.log
    console.log = originalLog;
    
    console.log('\n📋 TODOS los logs capturados:');
    console.log('='.repeat(50));
    
    // Mostrar TODOS los logs para debug
    if (logs.length === 0) {
      console.log('⚠️ NO SE CAPTURARON LOGS!');
    } else {
      logs.forEach((log, index) => console.log(`[${index}] ${log}`));
    }
    
    console.log('='.repeat(50));
    
    // Mostrar resultado final
    console.log('\n📊 Resultado final de KPIs:');
    if (kpis && kpis.cuadernos) {
      Object.entries(kpis.cuadernos).forEach(([id, data]: [string, any]) => {
        if (data.juegosJugados !== undefined) {
          console.log(`  ${id}: ${data.juegosJugados} juegos`);
        }
      });
    }
    
    return kpis;
    
  } catch (error) {
    console.log = originalLog;
    console.error('❌ Error:', error);
    throw error;
  }
}

// Hacer disponible en consola
(window as any).testKpiWithLogs = testKpiWithLogs;

console.log('🛠️ Función testKpiWithLogs() disponible en la consola');
console.log('   Úsala para ver todos los logs del servicio KPI');

export { testKpiWithLogs };