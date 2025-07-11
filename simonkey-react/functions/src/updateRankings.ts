import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './config';

interface RankingEntry {
  studentId: string;
  name: string;
  score: number;
  position: number;
}

interface StudentRanking {
  studentId: string;
  name: string;
  score: number;
}

interface SubjectRanking {
  subjectId: string;
  subjectName: string;
  rankings: RankingEntry[];
}

interface RankingData {
  position: number;
  totalStudents: number;
  percentile: number;
}

/**
 * Cloud Function que actualiza los rankings de una institución
 * Se puede ejecutar de forma programada o cuando se actualizan KPIs
 */
export const updateInstitutionRankings = functions.https.onCall(async (request) => {
    try {
      const { institutionId } = request.data;
      
      if (!institutionId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Se requiere el ID de la institución'
        );
      }

      console.log(`[updateInstitutionRankings] Iniciando actualización para institución: ${institutionId}`);

      // 1. Obtener todos los estudiantes de la institución
      const studentsQuery = db
        .collection('users')
        .where('subscription', '==', 'school')
        .where('schoolRole', '==', 'student')
        .where('idInstitucion', '==', institutionId);

      const studentsSnapshot = await studentsQuery.get();
      console.log(`[updateInstitutionRankings] Estudiantes encontrados: ${studentsSnapshot.size}`);

      if (studentsSnapshot.empty) {
        return { 
          success: true, 
          message: 'No se encontraron estudiantes',
          studentsProcessed: 0
        };
      }

      // 2. Recopilar KPIs de cada estudiante
      const studentScores: Map<string, Map<string, number>> = new Map();
      const studentNames: Map<string, string> = new Map();

      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const kpisDoc = await db.doc(`users/${studentDoc.id}/kpis/dashboard`).get();

        if (kpisDoc.exists) {
          const kpis = kpisDoc.data();
          studentNames.set(studentDoc.id, studentData.nombre || 'Sin nombre');

          // Recopilar scores por materia
          if (kpis.materias) {
            const materiaScores = new Map<string, number>();
            
            for (const [materiaId, materiaData] of Object.entries(kpis.materias)) {
              const score = (materiaData as any).scoreMateria || 0;
              materiaScores.set(materiaId, score);
            }
            
            studentScores.set(studentDoc.id, materiaScores);
          }
        }
      }

      console.log(`[updateInstitutionRankings] KPIs procesados para ${studentScores.size} estudiantes`);

      // 3. Obtener todas las materias de la institución
      const subjectsQuery = db
        .collection('schoolSubjects')
        .where('idEscuela', '==', institutionId);

      const subjectsSnapshot = await subjectsQuery.get();
      console.log(`[updateInstitutionRankings] Materias encontradas: ${subjectsSnapshot.size}`);

      // 4. También obtener materias desde los notebooks
      const notebooksQuery = db
        .collection('schoolNotebooks')
        .where('idEscuela', '==', institutionId);

      const notebooksSnapshot = await notebooksQuery.get();
      const subjectIds = new Set<string>();
      const subjectNames = new Map<string, string>();

      // Recopilar IDs de materias desde subjects
      subjectsSnapshot.forEach(doc => {
        subjectIds.add(doc.id);
        subjectNames.set(doc.id, doc.data().nombre || 'Sin nombre');
      });

      // Recopilar IDs de materias desde notebooks
      notebooksSnapshot.forEach(doc => {
        const idMateria = doc.data().idMateria;
        if (idMateria) {
          subjectIds.add(idMateria);
        }
      });

      console.log(`[updateInstitutionRankings] Total de materias únicas: ${subjectIds.size}`);

      // 5. Calcular rankings por materia
      const subjectRankings: SubjectRanking[] = [];
      
      for (const subjectId of subjectIds) {
        const rankings: StudentRanking[] = [];
        
        // Recopilar estudiantes con score en esta materia
        studentScores.forEach((materiaScores, studentId) => {
          const score = materiaScores.get(subjectId) || 0;
          if (score > 0) { // Solo incluir estudiantes con score > 0
            rankings.push({
              studentId,
              name: studentNames.get(studentId) || 'Sin nombre',
              score
            });
          }
        });

        // Ordenar por score descendente
        rankings.sort((a, b) => b.score - a.score);

        // Asignar posiciones
        const rankingsWithPosition: RankingEntry[] = rankings.map((student, index) => ({
          ...student,
          position: index + 1
        }));

        if (rankingsWithPosition.length > 0) {
          subjectRankings.push({
            subjectId,
            subjectName: subjectNames.get(subjectId) || 'Sin nombre',
            rankings: rankingsWithPosition
          });
        }
      }

      console.log(`[updateInstitutionRankings] Rankings calculados para ${subjectRankings.length} materias`);

      // 6. Guardar rankings en Firestore
      if (subjectRankings.length > 0) {
        const batch = db.batch();
        let operationsCount = 0;

        for (const subject of subjectRankings) {
          const totalStudents = subject.rankings.length;

          for (const student of subject.rankings) {
            // Calcular percentil
            const percentile = Math.round(((totalStudents - student.position + 1) / totalStudents) * 100);

            const rankingData: RankingData = {
              position: student.position,
              totalStudents,
              percentile
            };

            // Guardar en la colección del estudiante
            batch.set(db.doc(`users/${student.studentId}/rankings/subjects/${subject.subjectId}`), rankingData);

            // Guardar en la colección central de rankings
            batch.set(db.doc(`rankings/institutions/${institutionId}/subjects/${subject.subjectId}/students/${student.studentId}`), {
              ...rankingData,
              studentName: student.name,
              score: student.score,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            operationsCount += 2;

            // Firestore tiene un límite de 500 operaciones por batch
            if (operationsCount >= 400) {
              await batch.commit();
              operationsCount = 0;
            }
          }
        }

        // Commit final si quedan operaciones pendientes
        if (operationsCount > 0) {
          await batch.commit();
        }
      }

      console.log(`[updateInstitutionRankings] Rankings actualizados exitosamente`);

      return {
        success: true,
        message: 'Rankings actualizados exitosamente',
        studentsProcessed: studentScores.size,
        subjectsProcessed: subjectRankings.length
      };

    } catch (error) {
      console.error('[updateInstitutionRankings] Error:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Error al actualizar rankings',
        error
      );
    }
  });

/**
 * Cloud Function programada para actualizar rankings de todas las instituciones
 * Se ejecuta cada 30 minutos
 */
export const scheduledRankingsUpdate = functions.pubsub.schedule('every 30 minutes').onRun(async (context) => {
    try {
      console.log('[scheduledRankingsUpdate] Iniciando actualización programada de rankings');
      
      // Obtener todas las instituciones
      const institutionsSnapshot = await db.collection('schoolInstitutions').get();
      
      console.log(`[scheduledRankingsUpdate] Total de instituciones: ${institutionsSnapshot.size}`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Procesar cada institución
      for (const institutionDoc of institutionsSnapshot.docs) {
        const institutionId = institutionDoc.id;
        
        try {
          console.log(`[scheduledRankingsUpdate] Procesando institución: ${institutionId}`);
          
          // Actualizar rankings para esta institución
          await updateInstitutionRankingsInternal(institutionId);
          
          successCount++;
        } catch (error) {
          console.error(`[scheduledRankingsUpdate] Error procesando institución ${institutionId}:`, error);
          errorCount++;
        }
      }
      
      console.log(`[scheduledRankingsUpdate] Actualización completada. Éxito: ${successCount}, Errores: ${errorCount}`);
      
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
  const updateFunction = updateInstitutionRankings as any;
  const result = await updateFunction(
    { institutionId },
    {}
  );
  
  if (!result.success) {
    throw new Error('Error actualizando rankings');
  }
}