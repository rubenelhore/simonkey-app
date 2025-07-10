import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';
import { teacherKpiService } from '../services/teacherKpiService';

/**
 * Genera métricas iniciales para todos los profesores existentes
 */
export async function initializeAllTeacherMetrics() {
  console.log('🚀 === INICIALIZANDO MÉTRICAS PARA TODOS LOS PROFESORES ===');
  
  try {
    // Buscar todos los profesores
    const teachersQuery = query(
      collection(db, 'users'),
      where('subscription', '==', UserSubscriptionType.SCHOOL),
      where('schoolRole', '==', SchoolRole.TEACHER)
    );
    
    const teachersSnap = await getDocs(teachersQuery);
    console.log(`📊 Total de profesores encontrados: ${teachersSnap.size}`);
    
    if (teachersSnap.size === 0) {
      console.log('⚠️ No se encontraron profesores en el sistema');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const teacherDoc of teachersSnap.docs) {
      const teacherId = teacherDoc.id;
      const teacherData = teacherDoc.data();
      
      try {
        console.log(`\n⏳ Procesando profesor: ${teacherData.email || teacherData.nombre} (${teacherId})`);
        
        // Verificar si ya tiene métricas
        const existingMetrics = await teacherKpiService.getTeacherMetrics(teacherId);
        
        if (existingMetrics) {
          console.log(`ℹ️ El profesor ya tiene métricas generadas`);
          successCount++;
          continue;
        }
        
        // Generar métricas
        console.log(`📊 Generando métricas para el profesor...`);
        await teacherKpiService.updateTeacherMetrics(teacherId);
        
        // Verificar que se generaron correctamente
        const newMetrics = await teacherKpiService.getTeacherMetrics(teacherId);
        
        if (newMetrics) {
          console.log(`✅ Métricas generadas exitosamente`);
          console.log(`   - Materias: ${newMetrics.global.totalMaterias}`);
          console.log(`   - Cuadernos: ${newMetrics.global.totalCuadernos}`);
          console.log(`   - Alumnos: ${newMetrics.global.totalAlumnos}`);
          successCount++;
        } else {
          console.log(`⚠️ Las métricas se generaron pero no se pudieron verificar`);
          errorCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error procesando profesor ${teacherId}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📊 === RESUMEN DE INICIALIZACIÓN ===');
    console.log(`✅ Exitosos: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📌 Total procesados: ${successCount + errorCount} de ${teachersSnap.size}`);
    
  } catch (error) {
    console.error('❌ Error fatal en inicialización:', error);
    throw error;
  }
}

/**
 * Verifica el estado de las métricas de un profesor específico
 */
export async function checkTeacherMetricsById(teacherId: string) {
  console.log(`\n🔍 === VERIFICANDO MÉTRICAS DEL PROFESOR ${teacherId} ===`);
  
  try {
    // Obtener datos del profesor
    const { doc, getDoc } = await import('firebase/firestore');
    const teacherDoc = await getDoc(doc(db, 'users', teacherId));
    
    if (!teacherDoc.exists()) {
      console.error('❌ Profesor no encontrado');
      return;
    }
    
    const teacherData = teacherDoc.data();
    console.log(`👨‍🏫 Profesor: ${teacherData.nombre || teacherData.email}`);
    console.log(`🏫 Institución: ${teacherData.idInstitucion}`);
    
    // Verificar métricas
    const metrics = await teacherKpiService.getTeacherMetrics(teacherId);
    
    if (!metrics) {
      console.log('❌ No se encontraron métricas para este profesor');
      console.log('💡 Usa initializeAllTeacherMetrics() para generar métricas');
      return;
    }
    
    console.log('\n📊 MÉTRICAS GLOBALES:');
    console.log(`   - Total Alumnos: ${metrics.global.totalAlumnos}`);
    console.log(`   - Total Materias: ${metrics.global.totalMaterias}`);
    console.log(`   - Total Cuadernos: ${metrics.global.totalCuadernos}`);
    console.log(`   - % Dominio Global: ${metrics.global.porcentajeDominioConceptos}%`);
    console.log(`   - Score Promedio: ${metrics.global.scorePromedio}`);
    console.log(`   - Tiempo Activo Promedio: ${metrics.global.tiempoActivo} min`);
    console.log(`   - Última Actualización: ${metrics.global.ultimaActualizacion.toDate().toLocaleString()}`);
    
    if (Object.keys(metrics.materias).length > 0) {
      console.log('\n📚 MÉTRICAS POR MATERIA:');
      Object.entries(metrics.materias).forEach(([materiaId, materia]) => {
        console.log(`\n   ${materia.nombreMateria} (${materiaId}):`);
        console.log(`      - Alumnos: ${materia.totalAlumnos}`);
        console.log(`      - Cuadernos: ${materia.totalCuadernos}`);
        console.log(`      - % Dominio: ${materia.porcentajeDominioConceptos}%`);
        console.log(`      - Score Promedio: ${materia.scorePromedio}`);
      });
    }
    
    console.log('\n📅 TIEMPO DE ESTUDIO SEMANAL:');
    Object.entries(metrics.tiempoEstudioSemanal).forEach(([dia, minutos]) => {
      if (minutos > 0) {
        console.log(`   - ${dia.charAt(0).toUpperCase() + dia.slice(1)}: ${minutos} minutos`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error verificando métricas:', error);
  }
}

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).initializeAllTeacherMetrics = initializeAllTeacherMetrics;
  (window as any).checkTeacherMetricsById = checkTeacherMetricsById;
}