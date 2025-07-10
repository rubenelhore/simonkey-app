import * as functions from 'firebase-functions';
import { db } from './config';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';

interface RankingEntry {
  studentId: string;
  name: string;
  score: number;
  position: number;
}

interface SubjectRanking {
  type: 'subject';
  subjectId: string;
  subjectName: string;
  institutionId: string;
  lastUpdated: Timestamp;
  totalStudents: number;
  students: RankingEntry[];
}

interface NotebookRanking {
  type: 'notebook';
  notebookId: string;
  notebookName: string;
  subjectId: string;
  institutionId: string;
  lastUpdated: Timestamp;
  totalStudents: number;
  students: RankingEntry[];
}

/**
 * Cloud Function que actualiza los rankings de una institución
 * Se puede ejecutar de forma programada o cuando se actualizan KPIs
 */
export const updateInstitutionRankings = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutos
    memory: '1GB'
  })
  .https.onCall(async (data, context) => {
    try {
      const { institutionId } = data;
      
      if (!institutionId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Se requiere institutionId'
        );
      }

      console.log(`[updateRankings] Actualizando rankings para institución: ${institutionId}`);

      // 1. Obtener todos los estudiantes de la institución
      const studentsQuery = query(
        collection(db, 'users'),
        where('subscription', '==', 'school'),
        where('schoolRole', '==', 'student'),
        where('idInstitucion', '==', institutionId)
      );

      const studentsSnapshot = await getDocs(studentsQuery);
      console.log(`[updateRankings] Total estudiantes: ${studentsSnapshot.size}`);

      // 2. Recopilar datos de KPIs de todos los estudiantes
      const studentKPIs = new Map<string, any>();
      
      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const kpisDoc = await getDoc(doc(db, 'users', studentDoc.id, 'kpis', 'dashboard'));
        
        if (kpisDoc.exists()) {
          studentKPIs.set(studentDoc.id, {
            id: studentDoc.id,
            name: studentData.displayName || studentData.nombre || 'Estudiante',
            kpis: kpisDoc.data()
          });
        }
      }

      // 3. Obtener todas las materias de la institución
      const subjectsQuery = query(
        collection(db, 'schoolSubjects'),
        where('idEscuela', '==', institutionId)
      );

      const subjectsSnapshot = await getDocs(subjectsQuery);
      const subjects = new Map<string, any>();
      
      subjectsSnapshot.forEach(doc => {
        subjects.set(doc.id, {
          id: doc.id,
          name: doc.data().nombre || doc.data().name || 'Sin nombre'
        });
      });

      // 4. Crear rankings por materia
      const batch = writeBatch(db);
      let rankingsCreated = 0;
      
      for (const [subjectId, subjectData] of subjects) {
        const subjectScores: Array<{id: string, name: string, score: number}> = [];
        
        // Recopilar scores de todos los estudiantes para esta materia
        for (const [studentId, studentData] of studentKPIs) {
          const materiaKpis = studentData.kpis.materias?.[subjectId];
          if (materiaKpis && materiaKpis.scoreMateria > 0) {
            subjectScores.push({
              id: studentId,
              name: studentData.name,
              score: materiaKpis.scoreMateria
            });
          }
        }

        // Ordenar por score descendente
        subjectScores.sort((a, b) => b.score - a.score);

        // Crear el documento de ranking
        const ranking: SubjectRanking = {
          type: 'subject',
          subjectId,
          subjectName: subjectData.name,
          institutionId,
          lastUpdated: Timestamp.now(),
          totalStudents: subjectScores.length,
          students: subjectScores.slice(0, 100).map((student, index) => ({
            studentId: student.id,
            name: student.name,
            score: student.score,
            position: index + 1
          }))
        };

        // Agregar al batch
        const rankingRef = doc(db, 'institutionRankings', institutionId, 'rankings', `subject_${subjectId}`);
        batch.set(rankingRef, ranking);
        rankingsCreated++;
      }

      // 5. Crear rankings por cuaderno
      const notebooksQuery = query(
        collection(db, 'schoolNotebooks'),
        where('idEscuela', '==', institutionId)
      );

      const notebooksSnapshot = await getDocs(notebooksQuery);
      
      for (const notebookDoc of notebooksSnapshot.docs) {
        const notebookData = notebookDoc.data();
        const notebookId = notebookDoc.id;
        const notebookScores: Array<{id: string, name: string, score: number}> = [];
        
        // Recopilar scores de todos los estudiantes para este cuaderno
        for (const [studentId, studentData] of studentKPIs) {
          const cuadernoKpis = studentData.kpis.cuadernos?.[notebookId];
          if (cuadernoKpis && cuadernoKpis.scoreCuaderno > 0) {
            notebookScores.push({
              id: studentId,
              name: studentData.name,
              score: cuadernoKpis.scoreCuaderno
            });
          }
        }

        // Ordenar por score descendente
        notebookScores.sort((a, b) => b.score - a.score);

        // Crear el documento de ranking
        const ranking: NotebookRanking = {
          type: 'notebook',
          notebookId,
          notebookName: notebookData.title || 'Sin nombre',
          subjectId: notebookData.idMateria || '',
          institutionId,
          lastUpdated: Timestamp.now(),
          totalStudents: notebookScores.length,
          students: notebookScores.slice(0, 50).map((student, index) => ({
            studentId: student.id,
            name: student.name,
            score: student.score,
            position: index + 1
          }))
        };

        // Agregar al batch
        const rankingRef = doc(db, 'institutionRankings', institutionId, 'rankings', `notebook_${notebookId}`);
        batch.set(rankingRef, ranking);
        rankingsCreated++;
      }

      // 6. Ejecutar el batch
      await batch.commit();
      
      console.log(`[updateRankings] Rankings actualizados exitosamente. Total: ${rankingsCreated}`);
      
      return {
        success: true,
        institutionId,
        rankingsCreated,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[updateRankings] Error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Error actualizando rankings',
        error
      );
    }
  });

/**
 * Cloud Function programada para actualizar rankings de todas las instituciones
 * Se ejecuta cada 30 minutos
 */
export const scheduledRankingsUpdate = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
  })
  .pubsub
  .schedule('every 30 minutes')
  .onRun(async (context) => {
    try {
      console.log('[scheduledRankingsUpdate] Iniciando actualización programada de rankings');
      
      // Obtener todas las instituciones
      const institutionsSnapshot = await getDocs(collection(db, 'schoolInstitutions'));
      
      console.log(`[scheduledRankingsUpdate] Total de instituciones: ${institutionsSnapshot.size}`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Procesar cada institución
      for (const instDoc of institutionsSnapshot.docs) {
        const institutionId = instDoc.id;
        const institutionName = instDoc.data().nombre;
        
        try {
          console.log(`[scheduledRankingsUpdate] Procesando: ${institutionName} (${institutionId})`);
          
          // Llamar a la función de actualización para esta institución
          await updateInstitutionRankingsInternal(institutionId);
          
          successCount++;
          console.log(`[scheduledRankingsUpdate] ✅ ${institutionName} actualizada`);
        } catch (error) {
          errorCount++;
          console.error(`[scheduledRankingsUpdate] ❌ Error en ${institutionName}:`, error);
        }
      }
      
      console.log('[scheduledRankingsUpdate] Actualización completada');
      console.log(`[scheduledRankingsUpdate] ✅ Exitosas: ${successCount}`);
      console.log(`[scheduledRankingsUpdate] ❌ Con errores: ${errorCount}`);
      
      return null;
    } catch (error) {
      console.error('[scheduledRankingsUpdate] Error general:', error);
      throw error;
    }
  });

/**
 * Función interna para actualizar rankings de una institución
 */
async function updateInstitutionRankingsInternal(institutionId: string): Promise<void> {
  // Reutilizar la lógica de la función callable
  const result = await updateInstitutionRankings(
    { institutionId },
    {} as functions.https.CallableContext
  );
  
  if (!result.success) {
    throw new Error('Error actualizando rankings');
  }
}