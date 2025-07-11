import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { kpiService } from '../services/kpiService';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

/**
 * Migración única para actualizar KPIs de todos los estudiantes escolares existentes
 */
export async function migrateAllSchoolStudentKPIs() {
  console.log('🚀 === INICIANDO MIGRACIÓN DE KPIs PARA ESTUDIANTES ESCOLARES ===');
  
  try {
    // Buscar todos los estudiantes escolares
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', UserSubscriptionType.SCHOOL),
      where('schoolRole', '==', SchoolRole.STUDENT)
    );
    
    const studentsSnap = await getDocs(studentsQuery);
    console.log(`📊 Total de estudiantes escolares encontrados: ${studentsSnap.size}`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors: { studentId: string; error: any }[] = [];
    
    // Procesar en lotes de 5 para no sobrecargar
    const batchSize = 5;
    const students = studentsSnap.docs;
    
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      console.log(`\n📦 Procesando lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(students.length / batchSize)}`);
      
      await Promise.all(
        batch.map(async (studentDoc) => {
          const studentId = studentDoc.id;
          const studentData = studentDoc.data();
          
          try {
            console.log(`⏳ Actualizando KPIs para: ${studentData.email || studentData.nombre} (${studentId})`);
            await kpiService.updateUserKPIs(studentId);
            successCount++;
            console.log(`✅ KPIs actualizados para: ${studentId}`);
          } catch (error) {
            errorCount++;
            errors.push({ studentId, error });
            console.error(`❌ Error con estudiante ${studentId}:`, error);
          }
        })
      );
      
      // Pequeña pausa entre lotes
      if (i + batchSize < students.length) {
        console.log('⏸️ Pausa de 2 segundos antes del siguiente lote...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Resumen final
    console.log('\n📊 === RESUMEN DE MIGRACIÓN ===');
    console.log(`✅ Exitosos: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Detalles de errores:');
      errors.forEach(({ studentId, error }) => {
        console.log(`- ${studentId}: ${error.message || error}`);
      });
    }
    
    console.log('\n✨ Migración completada');
    
    return {
      success: successCount,
      errors: errorCount,
      errorDetails: errors
    };
    
  } catch (error) {
    console.error('❌ Error fatal en migración:', error);
    throw error;
  }
}

/**
 * Verificar cuántos estudiantes necesitan actualización de KPIs
 */
export async function checkSchoolStudentsNeedingKPIs() {
  console.log('🔍 === VERIFICANDO ESTUDIANTES QUE NECESITAN KPIs ===');
  
  try {
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', UserSubscriptionType.SCHOOL),
      where('schoolRole', '==', SchoolRole.STUDENT)
    );
    
    const studentsSnap = await getDocs(studentsQuery);
    console.log(`📊 Total de estudiantes escolares: ${studentsSnap.size}`);
    
    let withKPIs = 0;
    let withoutKPIs = 0;
    let emptyKPIs = 0;
    
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      
      // Verificar si tiene KPIs
      const kpis = await kpiService.getUserKPIs(studentId);
      
      if (!kpis) {
        withoutKPIs++;
      } else if (Object.keys(kpis.cuadernos || {}).length === 0) {
        emptyKPIs++;
      } else {
        withKPIs++;
      }
    }
    
    console.log('\n📊 Resumen:');
    console.log(`✅ Con KPIs completos: ${withKPIs}`);
    console.log(`⚠️ Con KPIs vacíos: ${emptyKPIs}`);
    console.log(`❌ Sin KPIs: ${withoutKPIs}`);
    console.log(`📌 Necesitan actualización: ${withoutKPIs + emptyKPIs}`);
    
    return {
      total: studentsSnap.size,
      withKPIs,
      emptyKPIs,
      withoutKPIs,
      needingUpdate: withoutKPIs + emptyKPIs
    };
    
  } catch (error) {
    console.error('❌ Error verificando estudiantes:', error);
    throw error;
  }
}

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).migrateAllSchoolStudentKPIs = migrateAllSchoolStudentKPIs;
  (window as any).checkSchoolStudentsNeedingKPIs = checkSchoolStudentsNeedingKPIs;
}