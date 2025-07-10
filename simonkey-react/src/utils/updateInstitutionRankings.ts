import { rankingService } from '../services/rankingService';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Actualiza los rankings de una institución específica
 */
export async function updateInstitutionRankings(institutionId: string) {
  try {
    console.log('🚀 Actualizando rankings para institución:', institutionId);
    
    await rankingService.updateInstitutionRankings(institutionId);
    
    console.log('✅ Rankings actualizados exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error actualizando rankings:', error);
    return false;
  }
}

/**
 * Actualiza los rankings de todas las instituciones
 */
export async function updateAllInstitutionRankings() {
  try {
    console.log('🚀 Actualizando rankings de todas las instituciones...');
    
    // Obtener todas las instituciones
    const institutionsSnapshot = await getDocs(collection(db, 'schoolInstitutions'));
    
    console.log(`📊 Total de instituciones: ${institutionsSnapshot.size}`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const instDoc of institutionsSnapshot.docs) {
      const institutionId = instDoc.id;
      const institutionName = instDoc.data().nombre;
      
      console.log(`\n📍 Procesando: ${institutionName} (${institutionId})`);
      
      try {
        await rankingService.updateInstitutionRankings(institutionId);
        successCount++;
        console.log(`✅ ${institutionName} actualizada`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error en ${institutionName}:`, error);
      }
    }
    
    console.log('\n📊 Resumen:');
    console.log(`✅ Exitosas: ${successCount}`);
    console.log(`❌ Con errores: ${errorCount}`);
    
    return { successCount, errorCount };
  } catch (error) {
    console.error('❌ Error general:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas de rankings de una institución
 */
export async function getInstitutionRankingStats(institutionId: string) {
  try {
    console.log('📊 Obteniendo estadísticas de rankings...');
    
    // Obtener todos los rankings de la institución
    const rankingsSnapshot = await getDocs(
      collection(db, 'institutionRankings', institutionId, 'rankings')
    );
    
    const stats = {
      totalRankings: rankingsSnapshot.size,
      subjectRankings: 0,
      notebookRankings: 0,
      totalStudentsInRankings: new Set<string>(),
      lastUpdated: null as Date | null
    };
    
    rankingsSnapshot.forEach(doc => {
      const data = doc.data();
      
      if (data.type === 'subject') {
        stats.subjectRankings++;
      } else if (data.type === 'notebook') {
        stats.notebookRankings++;
      }
      
      // Agregar estudiantes únicos
      data.students?.forEach((student: any) => {
        stats.totalStudentsInRankings.add(student.studentId);
      });
      
      // Actualizar fecha más reciente
      if (data.lastUpdated) {
        const updateDate = data.lastUpdated.toDate();
        if (!stats.lastUpdated || updateDate > stats.lastUpdated) {
          stats.lastUpdated = updateDate;
        }
      }
    });
    
    console.log('\n📊 Estadísticas:');
    console.log(`- Total rankings: ${stats.totalRankings}`);
    console.log(`- Rankings por materia: ${stats.subjectRankings}`);
    console.log(`- Rankings por cuaderno: ${stats.notebookRankings}`);
    console.log(`- Estudiantes únicos: ${stats.totalStudentsInRankings.size}`);
    console.log(`- Última actualización: ${stats.lastUpdated?.toLocaleString()}`);
    
    return {
      ...stats,
      totalStudentsInRankings: stats.totalStudentsInRankings.size
    };
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    throw error;
  }
}

// Hacer disponibles las funciones globalmente
if (typeof window !== 'undefined') {
  (window as any).updateInstitutionRankings = updateInstitutionRankings;
  (window as any).updateAllInstitutionRankings = updateAllInstitutionRankings;
  (window as any).getInstitutionRankingStats = getInstitutionRankingStats;
}