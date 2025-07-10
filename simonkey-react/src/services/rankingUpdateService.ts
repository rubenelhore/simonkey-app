import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { rankingService } from './rankingService';

export class RankingUpdateService {
  private static instance: RankingUpdateService;

  private constructor() {}

  static getInstance(): RankingUpdateService {
    if (!RankingUpdateService.instance) {
      RankingUpdateService.instance = new RankingUpdateService();
    }
    return RankingUpdateService.instance;
  }

  /**
   * Actualiza los rankings de todos los estudiantes afectados cuando cambia un score
   * Esta función es llamada después de:
   * - Completar un estudio inteligente
   * - Completar un quiz
   * - Cualquier cambio que afecte el score
   */
  async updateRankingsAfterScoreChange(
    studentId: string, 
    notebookId: string,
    institutionId: string
  ): Promise<void> {
    console.log(`[RankingUpdateService] Actualizando rankings después de cambio de score`);
    console.log(`- Estudiante: ${studentId}`);
    console.log(`- Cuaderno: ${notebookId}`);
    console.log(`- Institución: ${institutionId}`);

    try {
      // 1. Obtener el cuaderno para saber la materia
      const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
      if (!notebookDoc.exists()) {
        console.error('[RankingUpdateService] Cuaderno no encontrado');
        return;
      }

      const notebookData = notebookDoc.data();
      const subjectId = notebookData.idMateria;

      if (!subjectId) {
        console.log('[RankingUpdateService] Cuaderno sin materia asignada');
        return;
      }

      // 2. Obtener todos los estudiantes de la institución que tienen este cuaderno
      const affectedStudents = await this.getAffectedStudents(institutionId, notebookId, subjectId);
      console.log(`[RankingUpdateService] Estudiantes afectados: ${affectedStudents.length}`);

      // 3. Calcular nuevos rankings para el cuaderno
      const notebookRanking = await rankingService.getNotebookRanking(notebookId, institutionId);
      
      // 4. Calcular nuevos rankings para la materia
      const subjectRanking = await rankingService.getSubjectRanking(subjectId, institutionId);

      // 5. Actualizar KPIs de todos los estudiantes afectados en batch
      const batch = writeBatch(db);
      let updateCount = 0;

      for (const affectedStudentId of affectedStudents) {
        try {
          // Obtener KPIs actuales del estudiante
          const kpisDocRef = doc(db, 'users', affectedStudentId, 'kpis', 'dashboard');
          const kpisDoc = await getDoc(kpisDocRef);

          if (!kpisDoc.exists()) {
            console.log(`[RankingUpdateService] No hay KPIs para estudiante ${affectedStudentId}`);
            continue;
          }

          const kpisData = kpisDoc.data();
          let updated = false;

          // Actualizar ranking del cuaderno si existe
          if (kpisData.cuadernos?.[notebookId] && notebookRanking && (notebookRanking as any).rankings?.[affectedStudentId]) {
            const oldPosition = kpisData.cuadernos[notebookId].posicionRanking;
            const oldPercentile = kpisData.cuadernos[notebookId].percentilCuaderno;
            
            kpisData.cuadernos[notebookId].posicionRanking = (notebookRanking as any).rankings[affectedStudentId].position;
            kpisData.cuadernos[notebookId].percentilCuaderno = (notebookRanking as any).rankings[affectedStudentId].percentile;
            
            if (oldPosition !== (notebookRanking as any).rankings[affectedStudentId].position) {
              console.log(`[RankingUpdateService] ${affectedStudentId} - Cuaderno ${notebookId}: Posición ${oldPosition} → ${(notebookRanking as any).rankings[affectedStudentId].position}`);
              updated = true;
            }
          }

          // Actualizar ranking de la materia si existe
          if (kpisData.materias?.[subjectId] && subjectRanking && (subjectRanking as any).rankings?.[affectedStudentId]) {
            const oldPercentile = kpisData.materias[subjectId].percentilMateria;
            
            kpisData.materias[subjectId].percentilMateria = (subjectRanking as any).rankings[affectedStudentId].percentile;
            
            if (oldPercentile !== (subjectRanking as any).rankings[affectedStudentId].percentile) {
              console.log(`[RankingUpdateService] ${affectedStudentId} - Materia ${subjectId}: Percentil ${oldPercentile}% → ${(subjectRanking as any).rankings[affectedStudentId].percentile}%`);
              updated = true;
            }
          }

          // Recalcular percentil global si es estudiante escolar
          if (kpisData.materias && Object.keys(kpisData.materias).length > 0) {
            const percentiles = Object.values(kpisData.materias).map((m: any) => m.percentilMateria || 0);
            const newGlobalPercentile = Math.round(
              percentiles.reduce((sum, p) => sum + p, 0) / percentiles.length
            );
            
            if (kpisData.global.percentilPromedioGlobal !== newGlobalPercentile) {
              console.log(`[RankingUpdateService] ${affectedStudentId} - Percentil global: ${kpisData.global.percentilPromedioGlobal}% → ${newGlobalPercentile}%`);
              kpisData.global.percentilPromedioGlobal = newGlobalPercentile;
              updated = true;
            }
          }

          // Solo actualizar si hubo cambios
          if (updated) {
            batch.update(kpisDocRef, kpisData);
            updateCount++;
          }

        } catch (error) {
          console.error(`[RankingUpdateService] Error actualizando estudiante ${affectedStudentId}:`, error);
        }
      }

      // 6. Ejecutar todas las actualizaciones en batch
      if (updateCount > 0) {
        await batch.commit();
        console.log(`[RankingUpdateService] ✅ Actualizados ${updateCount} estudiantes`);
      } else {
        console.log(`[RankingUpdateService] No hubo cambios en rankings`);
      }

    } catch (error) {
      console.error('[RankingUpdateService] Error actualizando rankings:', error);
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Obtiene todos los estudiantes que podrían verse afectados por un cambio de ranking
   */
  private async getAffectedStudents(
    institutionId: string, 
    notebookId: string, 
    subjectId: string
  ): Promise<string[]> {
    const affectedStudentIds = new Set<string>();

    // 1. Estudiantes con el mismo cuaderno
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', 'student'),
      where('idInstitucion', '==', institutionId)
    );

    const studentsSnap = await getDocs(studentsQuery);
    
    for (const studentDoc of studentsSnap.docs) {
      const studentData = studentDoc.data();
      const idCuadernos = studentData.idCuadernos || [];
      
      // Si tiene el cuaderno afectado, se verá afectado
      if (idCuadernos.includes(notebookId)) {
        affectedStudentIds.add(studentDoc.id);
      } else {
        // Si no tiene el cuaderno pero sí otros de la misma materia, 
        // también se ve afectado por el ranking de materia
        for (const cuadernoId of idCuadernos) {
          const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', cuadernoId));
          if (notebookDoc.exists() && notebookDoc.data().idMateria === subjectId) {
            affectedStudentIds.add(studentDoc.id);
            break;
          }
        }
      }
    }

    return Array.from(affectedStudentIds);
  }

  /**
   * Función simplificada para actualizar rankings después de cualquier actividad
   * que afecte el score (estudio inteligente, quiz, etc.)
   */
  async updateRankingsForStudent(studentId: string): Promise<void> {
    try {
      console.log(`[RankingUpdateService] Actualizando rankings para estudiante ${studentId}`);
      
      // Obtener datos del estudiante
      const userDoc = await getDoc(doc(db, 'users', studentId));
      if (!userDoc.exists()) {
        console.error('[RankingUpdateService] Usuario no encontrado');
        return;
      }

      const userData = userDoc.data();
      
      // Solo actualizar si es estudiante escolar
      if (userData.subscription !== 'school' || userData.schoolRole !== 'student') {
        console.log('[RankingUpdateService] No es estudiante escolar, no se actualizan rankings');
        return;
      }

      const institutionId = userData.idInstitucion;
      const idCuadernos = userData.idCuadernos || [];

      // Actualizar rankings para cada cuaderno del estudiante
      for (const notebookId of idCuadernos) {
        await this.updateRankingsAfterScoreChange(studentId, notebookId, institutionId);
      }

    } catch (error) {
      console.error('[RankingUpdateService] Error:', error);
    }
  }
}

// Exportar instancia única
export const rankingUpdateService = RankingUpdateService.getInstance();