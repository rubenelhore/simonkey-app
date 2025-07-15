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

  /**
   * Genera o actualiza el ranking de una materia específica
   */
  async generateSubjectRanking(institutionId: string, subjectId: string): Promise<void> {
    try {
      console.log(`[RankingService] Generando ranking para materia ${subjectId} en institución ${institutionId}`);
      
      // Obtener información de la materia
      const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
      if (!subjectDoc.exists()) {
        console.error(`[RankingService] Materia ${subjectId} no encontrada`);
        return;
      }
      
      const subjectData = subjectDoc.data();
      const subjectName = subjectData.nombre || subjectData.name || 'Sin nombre';
      
      // Obtener todos los estudiantes de la institución
      const studentsQuery = query(
        collection(db, 'users'),
        where('subscription', '==', 'school'),
        where('schoolRole', '==', 'student'),
        where('idInstitucion', '==', institutionId)
      );
      
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentScores: Array<{id: string, name: string, score: number}> = [];
      
      // Recopilar scores de todos los estudiantes para esta materia
      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;
        
        // Obtener KPIs del estudiante
        const kpisDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
        if (kpisDoc.exists()) {
          const kpis = kpisDoc.data();
          const materiaKpis = kpis.materias?.[subjectId];
          
          if (materiaKpis && materiaKpis.scoreMateria > 0) {
            studentScores.push({
              id: studentId,
              name: studentData.displayName || studentData.nombre || 'Estudiante',
              score: materiaKpis.scoreMateria
            });
          }
        }
      }
      
      // Ordenar por score descendente
      studentScores.sort((a, b) => b.score - a.score);
      
      // Crear el documento de ranking
      const ranking: SubjectRanking = {
        type: 'subject',
        subjectId,
        subjectName,
        institutionId,
        lastUpdated: Timestamp.now(),
        totalStudents: studentScores.length,
        students: studentScores.slice(0, 100).map((student, index) => ({
          studentId: student.id,
          name: student.name,
          score: student.score,
          position: index + 1
        }))
      };
      
      // Guardar el ranking
      const rankingRef = doc(db, 'institutionRankings', institutionId, 'rankings', `subject_${subjectId}`);
      await setDoc(rankingRef, ranking);
      
      console.log(`[RankingService] Ranking generado para materia ${subjectName} con ${ranking.totalStudents} estudiantes`);
      
    } catch (error) {
      console.error('[RankingService] Error generando ranking de materia:', error);
    }
  }

  /**
   * Genera o actualiza el ranking de un cuaderno específico
   */
  async generateNotebookRanking(institutionId: string, notebookId: string): Promise<void> {
    try {
      console.log(`[RankingService] Generando ranking para cuaderno ${notebookId} en institución ${institutionId}`);
      
      // Obtener información del cuaderno
      const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
      if (!notebookDoc.exists()) {
        console.error(`[RankingService] Cuaderno ${notebookId} no encontrado`);
        return;
      }
      
      const notebookData = notebookDoc.data();
      const notebookName = notebookData.title || 'Sin nombre';
      const subjectId = notebookData.idMateria || '';
      
      // Obtener todos los estudiantes de la institución
      const studentsQuery = query(
        collection(db, 'users'),
        where('subscription', '==', 'school'),
        where('schoolRole', '==', 'student'),
        where('idInstitucion', '==', institutionId)
      );
      
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentScores: Array<{id: string, name: string, score: number}> = [];
      
      // Recopilar scores de todos los estudiantes para este cuaderno
      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;
        
        // Obtener KPIs del estudiante
        const kpisDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
        if (kpisDoc.exists()) {
          const kpis = kpisDoc.data();
          const cuadernoKpis = kpis.cuadernos?.[notebookId];
          
          if (cuadernoKpis && cuadernoKpis.scoreCuaderno > 0) {
            studentScores.push({
              id: studentId,
              name: studentData.displayName || studentData.nombre || 'Estudiante',
              score: cuadernoKpis.scoreCuaderno
            });
          }
        }
      }
      
      // Ordenar por score descendente
      studentScores.sort((a, b) => b.score - a.score);
      
      // Crear el documento de ranking
      const ranking: NotebookRanking = {
        type: 'notebook',
        notebookId,
        notebookName,
        subjectId,
        institutionId,
        lastUpdated: Timestamp.now(),
        totalStudents: studentScores.length,
        students: studentScores.slice(0, 50).map((student, index) => ({
          studentId: student.id,
          name: student.name,
          score: student.score,
          position: index + 1
        }))
      };
      
      // Guardar el ranking
      const rankingRef = doc(db, 'institutionRankings', institutionId, 'rankings', `notebook_${notebookId}`);
      await setDoc(rankingRef, ranking);
      
      console.log(`[RankingService] Ranking generado para cuaderno ${notebookName} con ${ranking.totalStudents} estudiantes`);
      
    } catch (error) {
      console.error('[RankingService] Error generando ranking de cuaderno:', error);
    }
  }

  /**
   * Calcula los rankings de un estudiante en sus materias y cuadernos
   */
  async calculateStudentRankings(userId: string): Promise<{
    subjectRankings: Record<string, { position: number; totalStudents: number; percentile: number }>;
    notebookRankings: Record<string, { position: number; totalStudents: number; percentile: number }>;
    globalPercentile: number;
  }> {
    try {
      console.log(`[RankingService] Calculando rankings para estudiante: ${userId}`);
      
      // Obtener datos del estudiante
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('Usuario no encontrado');
      }
      
      const userData = userDoc.data();
      const institutionId = userData.idInstitucion;
      
      if (!institutionId) {
        console.log('[RankingService] Usuario sin institución asociada');
        return {
          subjectRankings: {},
          notebookRankings: {},
          globalPercentile: 0
        };
      }

      // Obtener KPIs del estudiante
      const kpisDoc = await getDoc(doc(db, 'users', userId, 'kpis', 'dashboard'));
      if (!kpisDoc.exists()) {
        console.log('[RankingService] No se encontraron KPIs para el estudiante');
        return {
          subjectRankings: {},
          notebookRankings: {},
          globalPercentile: 0
        };
      }

      const kpis = kpisDoc.data();
      const subjectRankings: Record<string, { position: number; totalStudents: number; percentile: number }> = {};
      const notebookRankings: Record<string, { position: number; totalStudents: number; percentile: number }> = {};

      // Calcular rankings por materia
      if (kpis.materias) {
        console.log(`[RankingService] Procesando ${Object.keys(kpis.materias).length} materias`);
        for (const [subjectId, subjectKpis] of Object.entries(kpis.materias)) {
          console.log(`[RankingService] Buscando ranking para materia ${subjectId}`);
          let ranking = await this.getSubjectRanking(institutionId, subjectId);
          
          // Si no existe el ranking o necesita actualización, generarlo
          if (!ranking || this.needsUpdate(ranking)) {
            console.log(`[RankingService] Generando/actualizando ranking para materia ${subjectId}`);
            await this.generateSubjectRanking(institutionId, subjectId);
            ranking = await this.getSubjectRanking(institutionId, subjectId);
          }
          
          if (ranking) {
            console.log(`[RankingService] Ranking encontrado para materia ${subjectId}, total estudiantes: ${ranking.totalStudents}`);
            const position = this.getStudentPosition(ranking, userId);
            if (position !== null) {
              const percentile = Math.round(((ranking.totalStudents - position + 1) / ranking.totalStudents) * 100);
              subjectRankings[subjectId] = {
                position,
                totalStudents: ranking.totalStudents,
                percentile
              };
              console.log(`[RankingService] Estudiante en posición ${position} de ${ranking.totalStudents} (percentil ${percentile}%)`);
            } else {
              console.log(`[RankingService] Estudiante no encontrado en ranking de materia ${subjectId}`);
            }
          } else {
            console.log(`[RankingService] No se pudo generar ranking para materia ${subjectId}`);
          }
        }
      } else {
        console.log(`[RankingService] No hay materias en los KPIs del estudiante`);
      }

      // Calcular rankings por cuaderno
      if (kpis.cuadernos) {
        console.log(`[RankingService] Procesando ${Object.keys(kpis.cuadernos).length} cuadernos`);
        for (const [notebookId, notebookKpis] of Object.entries(kpis.cuadernos)) {
          console.log(`[RankingService] Buscando ranking para cuaderno ${notebookId}`);
          let ranking = await this.getNotebookRanking(institutionId, notebookId);
          
          // Si no existe el ranking o necesita actualización, generarlo
          if (!ranking || this.needsUpdate(ranking)) {
            console.log(`[RankingService] Generando/actualizando ranking para cuaderno ${notebookId}`);
            await this.generateNotebookRanking(institutionId, notebookId);
            ranking = await this.getNotebookRanking(institutionId, notebookId);
          }
          
          if (ranking) {
            console.log(`[RankingService] Ranking encontrado para cuaderno ${notebookId}, total estudiantes: ${ranking.totalStudents}`);
            const position = this.getStudentPosition(ranking, userId);
            if (position !== null) {
              const percentile = Math.round(((ranking.totalStudents - position + 1) / ranking.totalStudents) * 100);
              notebookRankings[notebookId] = {
                position,
                totalStudents: ranking.totalStudents,
                percentile
              };
              console.log(`[RankingService] Estudiante en posición ${position} de ${ranking.totalStudents} (percentil ${percentile}%)`);
            } else {
              console.log(`[RankingService] Estudiante no encontrado en ranking de cuaderno ${notebookId}`);
            }
          } else {
            console.log(`[RankingService] No se pudo generar ranking para cuaderno ${notebookId}`);
          }
        }
      } else {
        console.log(`[RankingService] No hay cuadernos en los KPIs del estudiante`);
      }

      console.log(`[RankingService] Rankings calculados - Materias: ${Object.keys(subjectRankings).length}, Cuadernos: ${Object.keys(notebookRankings).length}`);

      // Calcular percentil global promedio
      let globalPercentile = 0;
      const allPercentiles: number[] = [];
      
      // Agregar percentiles de materias
      Object.values(subjectRankings).forEach(ranking => {
        allPercentiles.push(ranking.percentile);
      });
      
      // Agregar percentiles de cuadernos
      Object.values(notebookRankings).forEach(ranking => {
        allPercentiles.push(ranking.percentile);
      });
      
      // Calcular promedio si hay percentiles
      if (allPercentiles.length > 0) {
        globalPercentile = Math.round(allPercentiles.reduce((sum, p) => sum + p, 0) / allPercentiles.length);
      }

      return {
        subjectRankings,
        notebookRankings,
        globalPercentile
      };
    } catch (error) {
      console.error('[RankingService] Error calculando rankings del estudiante:', error);
      throw error;
    }
  }
}

// Exportar instancia única
export const rankingService = RankingService.getInstance();