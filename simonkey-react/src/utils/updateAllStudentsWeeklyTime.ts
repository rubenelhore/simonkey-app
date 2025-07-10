import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { debugWeeklyStudyTime } from './debugWeeklyStudyTime';

export const updateAllStudentsWeeklyTime = async () => {
  try {
    console.log('[UpdateAllStudentsWeeklyTime] === ACTUALIZANDO TIEMPO SEMANAL DE TODOS LOS ESTUDIANTES ===');
    
    // Obtener todos los estudiantes escolares
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', 'student')
    );
    
    const studentsSnapshot = await getDocs(studentsQuery);
    console.log(`[UpdateAllStudentsWeeklyTime] Total de estudiantes encontrados: ${studentsSnapshot.size}`);
    
    let successCount = 0;
    let errorCount = 0;
    let noDataCount = 0;
    
    // Procesar cada estudiante
    for (const studentDoc of studentsSnapshot.docs) {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();
      const studentName = studentData.displayName || studentData.nombre || 'Sin nombre';
      
      try {
        console.log(`\n[UpdateAllStudentsWeeklyTime] Procesando: ${studentName} (${studentId})`);
        
        // Calcular tiempo semanal usando la función de debug
        const weeklyTime = await debugWeeklyStudyTime(studentId);
        
        if (weeklyTime) {
          // Verificar si hay tiempo registrado
          const totalTime = Object.values(weeklyTime).reduce((sum: number, time: any) => sum + (time || 0), 0);
          
          if (totalTime > 0) {
            // Actualizar los KPIs con el tiempo calculado
            const kpisDocRef = doc(db, 'users', studentId, 'kpis', 'dashboard');
            await updateDoc(kpisDocRef, {
              tiempoEstudioSemanal: weeklyTime
            });
            
            console.log(`✅ ${studentName}: Actualizado con ${totalTime} minutos totales`);
            successCount++;
          } else {
            console.log(`⚠️ ${studentName}: Sin tiempo de estudio esta semana`);
            noDataCount++;
          }
        } else {
          console.log(`❌ ${studentName}: Error calculando tiempo`);
          errorCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error con ${studentName}:`, error);
        errorCount++;
      }
    }
    
    // Resumen final
    console.log('\n[UpdateAllStudentsWeeklyTime] === RESUMEN FINAL ===');
    console.log(`✅ Actualizados exitosamente: ${successCount}`);
    console.log(`⚠️ Sin datos de estudio: ${noDataCount}`);
    console.log(`❌ Con errores: ${errorCount}`);
    console.log(`📊 Total procesados: ${studentsSnapshot.size}`);
    console.log('=====================================');
    
    return {
      total: studentsSnapshot.size,
      success: successCount,
      noData: noDataCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('[UpdateAllStudentsWeeklyTime] Error general:', error);
    throw error;
  }
};

// Función alternativa más rápida que solo actualiza estudiantes con KPIs existentes
export const quickUpdateAllWeeklyTime = async () => {
  try {
    console.log('[QuickUpdateAllWeeklyTime] === ACTUALIZACIÓN RÁPIDA ===');
    
    // Buscar todos los documentos de KPIs
    const kpisQuery = query(collection(db, 'users'));
    const usersSnapshot = await getDocs(kpisQuery);
    
    let updateCount = 0;
    const batch = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      // Solo procesar estudiantes escolares
      if (userData.subscription === 'school' && userData.schoolRole === 'student') {
        const userId = userDoc.id;
        
        // Verificar si tiene KPIs
        const kpisDocRef = doc(db, 'users', userId, 'kpis', 'dashboard');
        const kpisDoc = await getDocs(query(collection(db, 'users', userId, 'kpis')));
        
        if (!kpisDoc.empty) {
          // Calcular tiempo semanal
          const weeklyTime = await debugWeeklyStudyTime(userId);
          
          if (weeklyTime) {
            batch.push({
              userId,
              name: userData.displayName || userData.nombre || 'Sin nombre',
              weeklyTime
            });
            updateCount++;
          }
        }
      }
    }
    
    // Actualizar todos en paralelo
    console.log(`[QuickUpdateAllWeeklyTime] Actualizando ${batch.length} estudiantes...`);
    
    const updatePromises = batch.map(async ({ userId, name, weeklyTime }) => {
      try {
        const kpisDocRef = doc(db, 'users', userId, 'kpis', 'dashboard');
        await updateDoc(kpisDocRef, {
          tiempoEstudioSemanal: weeklyTime
        });
        console.log(`✅ ${name} actualizado`);
      } catch (error) {
        console.error(`❌ Error actualizando ${name}:`, error);
      }
    });
    
    await Promise.all(updatePromises);
    
    console.log(`[QuickUpdateAllWeeklyTime] ✅ Proceso completado. ${updateCount} estudiantes actualizados`);
    
    return updateCount;
    
  } catch (error) {
    console.error('[QuickUpdateAllWeeklyTime] Error:', error);
    throw error;
  }
};

// Exponer las funciones para poder usarlas desde la consola
(window as any).updateAllStudentsWeeklyTime = updateAllStudentsWeeklyTime;
(window as any).quickUpdateAllWeeklyTime = quickUpdateAllWeeklyTime;