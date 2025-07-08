import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  getDoc,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';

interface DashboardKPIs {
  global: {
    scoreGlobal: number;
    percentilPromedioGlobal: number;
    tiempoEstudioGlobal: number;
    estudiosInteligentesGlobal: number;
  };
  cuadernos: {
    [cuadernoId: string]: {
      scoreCuaderno: number;
      scoreMaxCuaderno: number;
      posicionRanking: number;
      percentilCuaderno: number;
      numeroConceptos: number;
      tiempoEstudioLocal: number;
      tiempoEstudioLibreLocal: number;
      tiempoEstudioInteligenteLocal: number;
      tiempoQuizLocal: number;
      estudiosInteligentesLocal: number;
      estudiosLibresLocal: number;
      porcentajeExitoEstudiosInteligentes: number;
      porcentajeDominioConceptos: number;
      conceptosDominados: number;
      conceptosNoDominados: number;
    };
  };
  materias?: {
    [materiaId: string]: {
      scoreMateria: number;
      percentilMateria: number;
      tiempoEstudioMateria: number;
      estudiosInteligentesMateria: number;
      conceptosDominadosMateria: number;
      conceptosNoDominadosMateria: number;
    };
  };
  ultimaActualizacion: Timestamp;
}

export class KPIService {
  private static instance: KPIService;

  private constructor() {}

  static getInstance(): KPIService {
    if (!KPIService.instance) {
      KPIService.instance = new KPIService();
    }
    return KPIService.instance;
  }

  /**
   * Calcula y actualiza los KPIs del dashboard para un usuario
   */
  async updateUserKPIs(userId: string): Promise<void> {
    try {
      console.log(`[KPIService] Actualizando KPIs para usuario: ${userId}`);

      // Obtener todas las sesiones de estudio del usuario
      const studySessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', userId)
      );
      const studySessionsSnap = await getDocs(studySessionsQuery);
      console.log(`[KPIService] Sesiones de estudio encontradas: ${studySessionsSnap.size}`);
      
      // Obtener todos los resultados de quiz del usuario
      let quizResultsSnap;
      try {
        const quizResultsQuery = query(
          collection(db, 'users', userId, 'quizResults'),
          orderBy('timestamp', 'desc')
        );
        quizResultsSnap = await getDocs(quizResultsQuery);
      } catch (error) {
        // Si falla el orderBy, intentar sin orden
        console.log('[KPIService] Error con orderBy, intentando sin orden:', error);
        const quizResultsQuery = query(
          collection(db, 'users', userId, 'quizResults')
        );
        quizResultsSnap = await getDocs(quizResultsQuery);
      }
      console.log(`[KPIService] Resultados de quiz encontrados: ${quizResultsSnap.size}`);

      // Obtener información de los cuadernos del usuario
      const notebooksQuery = query(
        collection(db, 'notebooks'),
        where('userId', '==', userId)
      );
      const notebooksSnap = await getDocs(notebooksQuery);

      // Obtener conceptos por cuaderno
      const conceptsByNotebook = new Map<string, number>();
      for (const notebookDoc of notebooksSnap.docs) {
        const notebookId = notebookDoc.id;
        const conceptsQuery = query(
          collection(db, 'conceptos'),
          where('cuadernoId', '==', notebookId)
        );
        const conceptsSnap = await getDocs(conceptsQuery);
        
        let totalConcepts = 0;
        conceptsSnap.forEach(doc => {
          const data = doc.data();
          if (data.conceptos && Array.isArray(data.conceptos)) {
            totalConcepts += data.conceptos.length;
          }
        });
        
        conceptsByNotebook.set(notebookId, totalConcepts);
      }

      // Inicializar estructura de KPIs
      const kpis: DashboardKPIs = {
        global: {
          scoreGlobal: 0,
          percentilPromedioGlobal: 0,
          tiempoEstudioGlobal: 0,
          estudiosInteligentesGlobal: 0
        },
        cuadernos: {},
        materias: {},
        ultimaActualizacion: Timestamp.now()
      };

      // Mapeo de cuadernos a materias
      const notebooksMap = new Map<string, any>();
      const notebookToMateria = new Map<string, string>();
      notebooksSnap.forEach(doc => {
        const data = doc.data();
        notebooksMap.set(doc.id, { id: doc.id, ...data });
        if (data.materiaId) {
          notebookToMateria.set(doc.id, data.materiaId);
        }
      });

      // Procesar sesiones de estudio por cuaderno
      const cuadernoStats = new Map<string, any>();
      
      studySessionsSnap.forEach(sessionDoc => {
        const session = sessionDoc.data();
        const notebookId = session.notebookId;
        
        if (!notebookId) return;

        if (!cuadernoStats.has(notebookId)) {
          cuadernoStats.set(notebookId, {
            tiempoEstudioLibre: 0,
            tiempoEstudioInteligente: 0,
            tiempoQuiz: 0,
            estudiosInteligentesTotal: 0,
            estudiosLibresTotal: 0,
            estudiosInteligentesExitosos: 0,
            conceptosDominados: 0,
            conceptosNoDominados: 0,
            sesionesValidadas: 0,
            sesionesTotales: 0
          });
        }

        const stats = cuadernoStats.get(notebookId);
        
        // Calcular duración de la sesión
        let sessionDuration = 0;
        if (session.metrics?.sessionDuration) {
          sessionDuration = session.metrics.sessionDuration;
        } else if (session.startTime && session.endTime) {
          const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
          const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
          sessionDuration = Math.floor((end.getTime() - start.getTime()) / 1000);
        }

        // Distribuir tiempo según el modo de estudio
        if (session.mode === 'smart') {
          stats.tiempoEstudioInteligente += sessionDuration;
          stats.estudiosInteligentesTotal++;
          
          if (session.validated) {
            stats.estudiosInteligentesExitosos++;
            stats.sesionesValidadas++;
          }
        } else if (session.mode === 'free') {
          stats.tiempoEstudioLibre += sessionDuration;
          stats.estudiosLibresTotal++;
        }
        
        stats.sesionesTotales++;

        // Procesar conceptos dominados/no dominados
        if (session.metrics?.conceptsDominados !== undefined) {
          stats.conceptosDominados += session.metrics.conceptsDominados;
        }
        if (session.metrics?.conceptosNoDominados !== undefined) {
          stats.conceptosNoDominados += session.metrics.conceptosNoDominados;
        }
      });

      // Procesar resultados de quiz por cuaderno
      const quizStats = new Map<string, { scores: number[], totalTime: number }>();
      
      console.log(`[KPIService] Procesando ${quizResultsSnap.size} resultados de quiz`);
      console.log(`[KPIService] Ruta de búsqueda: users/${userId}/quizResults`);
      
      quizResultsSnap.forEach(doc => {
        const result = doc.data();
        const notebookId = result.notebookId;
        
        console.log(`[KPIService] Quiz result:`, {
          docId: doc.id,
          notebookId,
          score: result.score,
          finalScore: result.finalScore,
          maxScore: result.maxScore,
          correctAnswers: result.correctAnswers,
          timeBonus: result.timeBonus
        });
        
        if (!notebookId) return;

        if (!quizStats.has(notebookId)) {
          quizStats.set(notebookId, { scores: [], totalTime: 0 });
        }
        
        const stats = quizStats.get(notebookId)!;
        
        // Usar el score final que incluye bonus de tiempo
        const finalScore = result.finalScore || result.score || 0;
        stats.scores.push(finalScore);
        console.log(`[KPIService] Agregando score ${finalScore} al cuaderno ${notebookId}`);
        
        // Sumar tiempo del quiz
        if (result.totalTime) {
          stats.totalTime += result.totalTime;
        }
      });

      // Procesar resultados de mini quiz por cuaderno
      const miniQuizStats = new Map<string, { totalTime: number, successCount: number, totalCount: number }>();
      
      // Obtener mini quiz results
      const miniQuizQuery = query(
        collection(db, 'users', userId, 'miniQuizResults')
      );
      const miniQuizSnap = await getDocs(miniQuizQuery);
      
      miniQuizSnap.forEach(doc => {
        const result = doc.data();
        const notebookId = result.notebookId;
        
        if (!notebookId) return;

        if (!miniQuizStats.has(notebookId)) {
          miniQuizStats.set(notebookId, { totalTime: 0, successCount: 0, totalCount: 0 });
        }
        
        const stats = miniQuizStats.get(notebookId)!;
        
        // Sumar tiempo del mini quiz
        if (result.totalTime) {
          stats.totalTime += result.totalTime;
        }
        
        // Contar mini quizzes exitosos
        stats.totalCount++;
        if (result.passed) {
          stats.successCount++;
        }
      });

      // Obtener información del salón para ranking (si existe)
      let classroomUsers: string[] = [];
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists() && userDoc.data().classroomId) {
        const classroomId = userDoc.data().classroomId;
        const classroomUsersQuery = query(
          collection(db, 'users'),
          where('classroomId', '==', classroomId)
        );
        const classroomUsersSnap = await getDocs(classroomUsersQuery);
        classroomUsers = classroomUsersSnap.docs.map(doc => doc.id);
      }

      // Calcular KPIs por cuaderno
      let totalScore = 0;
      let totalPercentil = 0;
      let cuadernosConPercentil = 0;

      for (const [notebookId, notebook] of notebooksMap) {
        const stats = cuadernoStats.get(notebookId) || {
          tiempoEstudioLibre: 0,
          tiempoEstudioInteligente: 0,
          tiempoQuiz: 0,
          estudiosInteligentesTotal: 0,
          estudiosLibresTotal: 0,
          estudiosInteligentesExitosos: 0,
          conceptosDominados: 0,
          conceptosNoDominados: 0,
          sesionesValidadas: 0,
          sesionesTotales: 0
        };

        const quizData = quizStats.get(notebookId) || { scores: [], totalTime: 0 };
        const miniQuizData = miniQuizStats.get(notebookId) || { totalTime: 0, successCount: 0, totalCount: 0 };
        let maxScore = quizData.scores.length > 0 ? Math.max(...quizData.scores) : 0;
        
        // Si no hay scores en quizResults, intentar obtener de quizStats
        if (maxScore === 0) {
          try {
            const quizStatsRef = doc(db, 'users', userId, 'quizStats', notebookId);
            const quizStatsDoc = await getDoc(quizStatsRef);
            console.log(`[KPIService] Buscando quizStats para ${notebookId}:`, quizStatsDoc.exists());
            if (quizStatsDoc.exists()) {
              const statsData = quizStatsDoc.data();
              console.log(`[KPIService] Datos de quizStats:`, statsData);
              if (statsData.maxScore) {
                maxScore = statsData.maxScore;
                console.log(`[KPIService] Score obtenido de quizStats para ${notebookId}: ${maxScore}`);
              }
            }
          } catch (error) {
            console.log(`[KPIService] Error obteniendo quizStats para ${notebookId}:`, error);
          }
        }
        
        // Calcular tiempo total de estudio (en segundos) - incluir mini quiz
        const tiempoQuizTotal = quizData.totalTime + miniQuizData.totalTime;
        const tiempoEstudioTotal = stats.tiempoEstudioLibre + stats.tiempoEstudioInteligente + tiempoQuizTotal;
        
        // Calcular porcentaje de éxito de estudios inteligentes
        const porcentajeExito = stats.estudiosInteligentesTotal > 0 
          ? Math.round((stats.estudiosInteligentesExitosos / stats.estudiosInteligentesTotal) * 100)
          : 0;

        // Calcular porcentaje de dominio
        const totalConceptosEstudiados = stats.conceptosDominados + stats.conceptosNoDominados;
        const porcentajeDominio = totalConceptosEstudiados > 0
          ? Math.round((stats.conceptosDominados / totalConceptosEstudiados) * 100)
          : 0;

        // Calcular ranking y percentil
        let posicionRanking = 1;
        let percentil = 100;
        
        if (classroomUsers.length > 1) {
          // Obtener scores de todos los usuarios del salón para este cuaderno
          const classroomScores: number[] = [];
          
          for (const classroomUserId of classroomUsers) {
            if (classroomUserId === userId) {
              classroomScores.push(maxScore);
            } else {
              // Obtener el score máximo del otro usuario para este cuaderno
              const otherUserQuizQuery = query(
                collection(db, 'users', classroomUserId, 'quizResults'),
                where('notebookId', '==', notebookId)
              );
              const otherUserQuizSnap = await getDocs(otherUserQuizQuery);
              let otherMaxScore = 0;
              otherUserQuizSnap.forEach(doc => {
                const score = doc.data().finalScore || doc.data().score || 0;
                otherMaxScore = Math.max(otherMaxScore, score);
              });
              classroomScores.push(otherMaxScore);
            }
          }
          
          // Ordenar scores de mayor a menor
          classroomScores.sort((a, b) => b - a);
          
          // Encontrar posición del usuario
          posicionRanking = classroomScores.findIndex(score => score === maxScore) + 1;
          
          // Calcular percentil
          percentil = Math.round(((classroomUsers.length - posicionRanking + 1) / classroomUsers.length) * 100);
        }

        // Obtener número de conceptos del cuaderno
        const numeroConceptos = conceptsByNotebook.get(notebookId) || 0;

        // Calcular score del cuaderno (scoreMax * estudiosInteligentes)
        const scoreCuaderno = maxScore * stats.estudiosInteligentesTotal;
        
        console.log(`[KPIService] Cálculo de score para cuaderno ${notebookId}:`, {
          maxScore,
          estudiosInteligentesTotal: stats.estudiosInteligentesTotal,
          scoreCuaderno,
          formula: `${maxScore} × ${stats.estudiosInteligentesTotal} = ${scoreCuaderno}`
        });

        kpis.cuadernos[notebookId] = {
          scoreCuaderno,
          scoreMaxCuaderno: maxScore,
          posicionRanking,
          percentilCuaderno: percentil,
          numeroConceptos,
          tiempoEstudioLocal: Math.round(tiempoEstudioTotal / 60), // Convertir a minutos
          tiempoEstudioLibreLocal: Math.round(stats.tiempoEstudioLibre / 60),
          tiempoEstudioInteligenteLocal: Math.round(stats.tiempoEstudioInteligente / 60),
          tiempoQuizLocal: Math.round(tiempoQuizTotal / 60),
          estudiosInteligentesLocal: stats.estudiosInteligentesTotal,
          estudiosLibresLocal: stats.estudiosLibresTotal,
          porcentajeExitoEstudiosInteligentes: porcentajeExito,
          porcentajeDominioConceptos: porcentajeDominio,
          conceptosDominados: stats.conceptosDominados,
          conceptosNoDominados: stats.conceptosNoDominados
        };

        // Sumar a totales globales
        totalScore += scoreCuaderno;
        kpis.global.tiempoEstudioGlobal += Math.round(tiempoEstudioTotal / 60);
        kpis.global.estudiosInteligentesGlobal += stats.estudiosInteligentesTotal;
        
        if (percentil > 0) {
          totalPercentil += percentil;
          cuadernosConPercentil++;
        }

        // Agregar a KPIs de materia si existe
        const materiaId = notebookToMateria.get(notebookId);
        if (materiaId) {
          if (!kpis.materias![materiaId]) {
            kpis.materias![materiaId] = {
              scoreMateria: 0,
              percentilMateria: 0,
              tiempoEstudioMateria: 0,
              estudiosInteligentesMateria: 0,
              conceptosDominadosMateria: 0,
              conceptosNoDominadosMateria: 0
            };
          }
          
          kpis.materias![materiaId].scoreMateria += scoreCuaderno;
          kpis.materias![materiaId].tiempoEstudioMateria += Math.round(tiempoEstudioTotal / 60);
          kpis.materias![materiaId].estudiosInteligentesMateria += stats.estudiosInteligentesTotal;
          kpis.materias![materiaId].conceptosDominadosMateria += stats.conceptosDominados;
          kpis.materias![materiaId].conceptosNoDominadosMateria += stats.conceptosNoDominados;
        }
      }

      // Calcular KPIs globales
      kpis.global.scoreGlobal = totalScore;
      kpis.global.percentilPromedioGlobal = cuadernosConPercentil > 0
        ? Math.round(totalPercentil / cuadernosConPercentil)
        : 0;

      // Calcular percentiles promedio por materia
      if (kpis.materias) {
        for (const materiaId of Object.keys(kpis.materias)) {
          const cuadernosDeMateria = Array.from(notebookToMateria.entries())
            .filter(([_, matId]) => matId === materiaId)
            .map(([notebookId, _]) => notebookId);
          
          let totalPercentilMateria = 0;
          let countMateria = 0;
          
          for (const notebookId of cuadernosDeMateria) {
            if (kpis.cuadernos[notebookId]) {
              totalPercentilMateria += kpis.cuadernos[notebookId].percentilCuaderno;
              countMateria++;
            }
          }
          
          kpis.materias[materiaId].percentilMateria = countMateria > 0
            ? Math.round(totalPercentilMateria / countMateria)
            : 0;
        }
      }

      // Guardar KPIs en Firestore
      const kpisDocRef = doc(db, 'users', userId, 'kpis', 'dashboard');
      await setDoc(kpisDocRef, kpis);

      console.log(`[KPIService] KPIs actualizados exitosamente para usuario: ${userId}`);
      console.log(`[KPIService] KPIs guardados:`, kpis);

    } catch (error) {
      console.error('[KPIService] Error actualizando KPIs:', error);
      throw error;
    }
  }

  /**
   * Obtiene los KPIs del dashboard para un usuario
   */
  async getUserKPIs(userId: string): Promise<DashboardKPIs | null> {
    try {
      const kpisDocRef = doc(db, 'users', userId, 'kpis', 'dashboard');
      const kpisDoc = await getDoc(kpisDocRef);
      
      if (kpisDoc.exists()) {
        return kpisDoc.data() as DashboardKPIs;
      }
      
      return null;
    } catch (error) {
      console.error('[KPIService] Error obteniendo KPIs:', error);
      throw error;
    }
  }
}

// Exportar instancia única
export const kpiService = KPIService.getInstance();