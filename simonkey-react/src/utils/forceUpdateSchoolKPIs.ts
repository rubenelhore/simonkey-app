import { kpiService } from '../services/kpiService';

export async function forceUpdateSchoolKPIs(studentId: string) {
  console.log('🔧 === FORZANDO ACTUALIZACIÓN DE KPIs ===');
  console.log('📌 ID del estudiante:', studentId);
  
  try {
    console.log('⏳ Actualizando KPIs...');
    await kpiService.updateUserKPIs(studentId);
    console.log('✅ KPIs actualizados exitosamente');
    
    // Verificar los nuevos KPIs
    console.log('\n📊 Verificando KPIs actualizados...');
    const updatedKPIs = await kpiService.getUserKPIs(studentId);
    
    if (updatedKPIs) {
      console.log('✅ KPIs actualizados:', JSON.stringify(updatedKPIs, null, 2));
      
      // Verificar si ahora tienen datos
      const cuadernosCount = Object.keys(updatedKPIs.cuadernos || {}).length;
      const materiasCount = Object.keys(updatedKPIs.materias || {}).length;
      
      console.log(`\n📚 Resumen:`);
      console.log(`- Cuadernos con KPIs: ${cuadernosCount}`);
      console.log(`- Materias con KPIs: ${materiasCount}`);
      console.log(`- Score Global: ${updatedKPIs.global.scoreGlobal}`);
      console.log(`- Tiempo de Estudio Global: ${updatedKPIs.global.tiempoEstudioGlobal} minutos`);
      console.log(`- Estudios Inteligentes Global: ${updatedKPIs.global.estudiosInteligentesGlobal}`);
      
      if (cuadernosCount === 0) {
        console.log('\n⚠️ ADVERTENCIA: Los KPIs siguen sin cuadernos. Posibles causas:');
        console.log('1. Las sesiones de estudio no tienen notebookId correcto');
        console.log('2. Los notebookIds de las sesiones no coinciden con los cuadernos asignados');
        console.log('3. Hay un problema al buscar los cuadernos escolares');
      }
    } else {
      console.log('❌ No se pudieron obtener los KPIs actualizados');
    }
    
  } catch (error) {
    console.error('❌ Error actualizando KPIs:', error);
  }
}

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).forceUpdateSchoolKPIs = forceUpdateSchoolKPIs;
}