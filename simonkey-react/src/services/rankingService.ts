import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc,
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp,
  writeBatch
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

export class RankingService {
  private static instance: RankingService;

  private constructor() {}

  static getInstance(): RankingService {
    if (!RankingService.instance) {
      RankingService.instance = new RankingService();
    }
    return RankingService.instance;
  }

  /**
   * Obtiene el ranking de una materia para una institución
   */
  async getSubjectRanking(institutionId: string, subjectId: string): Promise<SubjectRanking | null> {
    try {
      const rankingDoc = await getDoc(
        doc(db, 'institutionRankings', institutionId, 'rankings', `subject_${subjectId}`)
      );

      if (rankingDoc.exists()) {
        return rankingDoc.data() as SubjectRanking;
      }

      return null;
    } catch (error) {
      console.error('[RankingService] Error obteniendo ranking de materia:', error);
      return null;
    }
  }

  /**
   * Obtiene el ranking de un cuaderno para una institución
   */
  async getNotebookRanking(institutionId: string, notebookId: string): Promise<NotebookRanking | null> {
    try {
      const rankingDoc = await getDoc(
        doc(db, 'institutionRankings', institutionId, 'rankings', `notebook_${notebookId}`)
      );

      if (rankingDoc.exists()) {
        return rankingDoc.data() as NotebookRanking;
      }

      return null;
    } catch (error) {
      console.error('[RankingService] Error obteniendo ranking de cuaderno:', error);
      return null;
    }
  }

  /**
   * Actualiza todos los rankings de una institución
   * Esta función debería ser llamada por una Cloud Function
   */
  async updateInstitutionRankings(institutionId: string): Promise<void> {
    try {
      console.log(`[RankingService] Actualizando rankings para institución: ${institutionId}`);

      // 1. Obtener todos los estudiantes de la institución
      const studentsQuery = query(
        collection(db, 'users'),
        where('subscription', '==', 'school'),
        where('schoolRole', '==', 'student'),
        where('idInstitucion', '==', institutionId)
      );

      const studentsSnapshot = await getDocs(studentsQuery);
      console.log(`[RankingService] Total estudiantes: ${studentsSnapshot.size}`);

      // 2. Recopilar datos de KPIs de todos los estudiantes
      const studentKPIs = new Map<string, any>();
      
      console.log(`[RankingService] Recopilando KPIs de estudiantes...`);
      
      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const kpisDoc = await getDoc(doc(db, 'users', studentDoc.id, 'kpis', 'dashboard'));
        
        if (kpisDoc.exists()) {
          studentKPIs.set(studentDoc.id, {
            id: studentDoc.id,
            name: studentData.displayName || studentData.nombre || 'Estudiante',
            kpis: kpisDoc.data()
          });
          console.log(`[RankingService] KPIs encontrados para estudiante ${studentData.nombre}`);
        } else {
          console.log(`[RankingService] No se encontraron KPIs para estudiante ${studentData.nombre}`);
        }
      }
      
      console.log(`[RankingService] Total estudiantes con KPIs: ${studentKPIs.size}`);
      
      // Verificar si hay materias en los KPIs
      for (const [studentId, studentData] of studentKPIs) {
        if (studentData.kpis.materias) {
          console.log(`[RankingService] Estudiante ${studentData.name} tiene ${Object.keys(studentData.kpis.materias).length} materias en KPIs`);
        }
      }

      // 3. Obtener todas las materias de la institución
      const subjectsQuery = query(
        collection(db, 'schoolSubjects'),
        where('idEscuela', '==', institutionId)
      );

      const subjectsSnapshot = await getDocs(subjectsQuery);
      const subjects = new Map<string, any>();
      
      console.log(`[RankingService] Total materias en la institución: ${subjectsSnapshot.size}`);
      
      subjectsSnapshot.forEach(doc => {
        const subjectData = doc.data();
        subjects.set(doc.id, {
          id: doc.id,
          name: subjectData.nombre || subjectData.name || 'Sin nombre'
        });
        console.log(`[RankingService] Materia encontrada: ${subjectData.nombre} (${doc.id})`);
      });

      // 4. Crear rankings por materia
      const batch = writeBatch(db);
      let batchOperations = 0;
      
      console.log(`[RankingService] Procesando ${subjects.size} materias...`);
      
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

        // Solo agregar si hay estudiantes con scores
        if (ranking.totalStudents > 0) {
          // Agregar al batch
          const rankingRef = doc(db, 'institutionRankings', institutionId, 'rankings', `subject_${subjectId}`);
          batch.set(rankingRef, ranking);
          batchOperations++;
          console.log(`[RankingService] Ranking agregado para materia ${subjectData.name} con ${ranking.totalStudents} estudiantes`);
        } else {
          console.log(`[RankingService] Materia ${subjectData.name} sin estudiantes con scores, omitiendo`);
        }
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

        // Solo agregar si hay estudiantes con scores
        if (ranking.totalStudents > 0) {
          // Agregar al batch
          const rankingRef = doc(db, 'institutionRankings', institutionId, 'rankings', `notebook_${notebookId}`);
          batch.set(rankingRef, ranking);
          batchOperations++;
          console.log(`[RankingService] Ranking agregado para cuaderno ${notebookData.title} con ${ranking.totalStudents} estudiantes`);
        } else {
          console.log(`[RankingService] Cuaderno ${notebookData.title} sin estudiantes con scores, omitiendo`);
        }
      }

      // 6. Ejecutar el batch
      console.log(`[RankingService] Ejecutando batch con ${batchOperations} operaciones...`);
      
      if (batchOperations > 0) {
        await batch.commit();
        console.log(`[RankingService] Batch ejecutado exitosamente`);
      } else {
        console.log(`[RankingService] No hay operaciones para ejecutar en el batch`);
      }
      
      console.log(`[RankingService] Rankings actualizados exitosamente para institución: ${institutionId}`);
      
    } catch (error) {
      console.error('[RankingService] Error actualizando rankings:', error);
      throw error;
    }
  }

  /**
   * Obtiene la posición de un estudiante en un ranking específico
   */
  getStudentPosition(ranking: SubjectRanking | NotebookRanking, studentId: string): number | null {
    const student = ranking.students.find(s => s.studentId === studentId);
    return student ? student.position : null;
  }

  /**
   * Verifica si los rankings necesitan actualización (más de 10 minutos)
   */
  needsUpdate(ranking: SubjectRanking | NotebookRanking): boolean {
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
    
    return ranking.lastUpdated.toDate() < tenMinutesAgo;
  }
}

// Exportar instancia única
export const rankingService = RankingService.getInstance();