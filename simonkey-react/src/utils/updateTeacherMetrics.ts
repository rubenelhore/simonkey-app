import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { teacherKpiService } from '../services/teacherKpiService';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

/**
 * Actualiza las métricas de un profesor específico
 */
export async function updateTeacherMetrics(teacherId: string) {
  console.log('📊 === ACTUALIZANDO MÉTRICAS DEL PROFESOR ===');
  console.log('👨‍🏫 ID del profesor:', teacherId);
  
  try {
    await teacherKpiService.updateTeacherMetrics(teacherId);
    console.log('✅ Métricas actualizadas exitosamente');
    
    // Verificar las métricas generadas
    const metrics = await teacherKpiService.getTeacherMetrics(teacherId);
    if (metrics) {
      console.log('\n📊 Resumen de métricas:');
      console.log('- Total de alumnos:', metrics.global.totalAlumnos);
      console.log('- Total de materias:', metrics.global.totalMaterias);
      console.log('- Total de cuadernos:', metrics.global.totalCuadernos);
      console.log('- % Dominio global:', metrics.global.porcentajeDominioConceptos + '%');
      console.log('- Score promedio:', metrics.global.scorePromedio);
    }
    
  } catch (error) {
    console.error('❌ Error actualizando métricas:', error);
  }
}

/**
 * Actualiza las métricas de todos los profesores de la plataforma
 */
export async function updateAllTeacherMetrics() {
  console.log('🚀 === ACTUALIZANDO MÉTRICAS DE TODOS LOS PROFESORES ===');
  
  try {
    // Buscar todos los profesores
    const teachersQuery = query(
      collection(db, 'users'),
      where('subscription', '==', UserSubscriptionType.SCHOOL),
      where('schoolRole', '==', SchoolRole.TEACHER)
    );
    
    const teachersSnap = await getDocs(teachersQuery);
    console.log(`📊 Total de profesores encontrados: ${teachersSnap.size}`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors: { teacherId: string; error: any }[] = [];
    
    // Procesar en lotes de 3 para no sobrecargar
    const batchSize = 3;
    const teachers = teachersSnap.docs;
    
    for (let i = 0; i < teachers.length; i += batchSize) {
      const batch = teachers.slice(i, i + batchSize);
      console.log(`\n📦 Procesando lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(teachers.length / batchSize)}`);
      
      await Promise.all(
        batch.map(async (teacherDoc) => {
          const teacherId = teacherDoc.id;
          const teacherData = teacherDoc.data();
          
          try {
            console.log(`⏳ Actualizando métricas para: ${teacherData.email || teacherData.nombre} (${teacherId})`);
            await teacherKpiService.updateTeacherMetrics(teacherId);
            successCount++;
            console.log(`✅ Métricas actualizadas para: ${teacherId}`);
          } catch (error) {
            errorCount++;
            errors.push({ teacherId, error });
            console.error(`❌ Error con profesor ${teacherId}:`, error);
          }
        })
      );
      
      // Pequeña pausa entre lotes
      if (i + batchSize < teachers.length) {
        console.log('⏸️ Pausa de 2 segundos antes del siguiente lote...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Resumen final
    console.log('\n📊 === RESUMEN DE ACTUALIZACIÓN ===');
    console.log(`✅ Exitosos: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Detalles de errores:');
      errors.forEach(({ teacherId, error }) => {
        console.log(`- ${teacherId}: ${error.message || error}`);
      });
    }
    
    console.log('\n✨ Actualización completada');
    
    return {
      success: successCount,
      errors: errorCount,
      errorDetails: errors
    };
    
  } catch (error) {
    console.error('❌ Error fatal en actualización:', error);
    throw error;
  }
}

/**
 * Verifica cuántos profesores tienen métricas generadas
 */
export async function checkTeacherMetricsStatus() {
  console.log('🔍 === VERIFICANDO ESTADO DE MÉTRICAS DE PROFESORES ===');
  
  try {
    // Buscar todos los profesores
    const teachersQuery = query(
      collection(db, 'users'),
      where('subscription', '==', UserSubscriptionType.SCHOOL),
      where('schoolRole', '==', SchoolRole.TEACHER)
    );
    
    const teachersSnap = await getDocs(teachersQuery);
    console.log(`📊 Total de profesores: ${teachersSnap.size}`);
    
    let withMetrics = 0;
    let withoutMetrics = 0;
    let emptyMetrics = 0;
    
    for (const teacherDoc of teachersSnap.docs) {
      const teacherId = teacherDoc.id;
      const teacherData = teacherDoc.data();
      
      // Verificar si tiene métricas
      const metrics = await teacherKpiService.getTeacherMetrics(teacherId);
      
      if (!metrics) {
        withoutMetrics++;
        console.log(`❌ Sin métricas: ${teacherData.nombre || teacherData.email} (${teacherId})`);
      } else if (metrics.global.totalCuadernos === 0) {
        emptyMetrics++;
        console.log(`⚠️ Métricas vacías: ${teacherData.nombre || teacherData.email} (${teacherId})`);
      } else {
        withMetrics++;
        console.log(`✅ Con métricas: ${teacherData.nombre || teacherData.email} - ${metrics.global.totalCuadernos} cuadernos`);
      }
    }
    
    console.log('\n📊 Resumen:');
    console.log(`✅ Con métricas completas: ${withMetrics}`);
    console.log(`⚠️ Con métricas vacías: ${emptyMetrics}`);
    console.log(`❌ Sin métricas: ${withoutMetrics}`);
    console.log(`📌 Necesitan actualización: ${withoutMetrics + emptyMetrics}`);
    
    return {
      total: teachersSnap.size,
      withMetrics,
      emptyMetrics,
      withoutMetrics,
      needingUpdate: withoutMetrics + emptyMetrics
    };
    
  } catch (error) {
    console.error('❌ Error verificando estado:', error);
    throw error;
  }
}

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).updateTeacherMetrics = updateTeacherMetrics;
  (window as any).updateAllTeacherMetrics = updateAllTeacherMetrics;
  (window as any).checkTeacherMetricsStatus = checkTeacherMetricsStatus;
}