import { db, functions } from './firebase';
import { rankingService } from './rankingService';
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
import { httpsCallable } from 'firebase/functions';

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
  tiempoEstudioSemanal?: {
    domingo: number;
    lunes: number;
    martes: number;
    miercoles: number;
    jueves: number;
    viernes: number;
    sabado: number;
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

      // Verificar si es un usuario escolar - primero obtener datos del usuario
      const userDoc = await getDoc(doc(db, 'users', userId));
      let isSchoolUser = false;
      let userData: any = null;
      
      if (userDoc.exists()) {
        userData = userDoc.data();
        // Un usuario es escolar si tiene subscription SCHOOL o si su ID empieza con school_
        isSchoolUser = userData.subscription === 'school' || userId.startsWith('school_');
        console.log(`[KPIService] Usuario encontrado - subscription: ${userData.subscription}, schoolRole: ${userData.schoolRole}`);
      }
      
      console.log(`[KPIService] Es usuario escolar: ${isSchoolUser}`);
      
      // Obtener información de los cuadernos del usuario
      let notebooksSnap;
      if (isSchoolUser) {
        // Para usuarios escolares, los cuadernos se obtienen diferente
        console.log('[KPIService] Buscando cuadernos escolares para usuario:', userId);
        
        // Usar los datos del usuario que ya obtuvimos
        if (userData) {
          const idCuadernos = userData.idCuadernos || [];
          console.log('[KPIService] idCuadernos del usuario:', idCuadernos);
          
          // Obtener los cuadernos específicos
          const notebooks: any[] = [];
          for (const cuadernoId of idCuadernos) {
            const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', cuadernoId));
            if (notebookDoc.exists()) {
              notebooks.push(notebookDoc);
            }
          }
          
          notebooksSnap = {
            docs: notebooks,
            size: notebooks.length,
            forEach: (callback: any) => notebooks.forEach(callback)
          };
        } else {
          notebooksSnap = { docs: [], size: 0, forEach: () => {} };
        }
      } else {
        // Para usuarios regulares, buscar en notebooks
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', userId)
        );
        notebooksSnap = await getDocs(notebooksQuery);
      }

      // Obtener conceptos por cuaderno
      const conceptsByNotebook = new Map<string, number>();
      for (const notebookDoc of notebooksSnap.docs) {
        const notebookId = notebookDoc.id;
        // Determinar la colección de conceptos según el tipo de usuario
        const conceptsCollectionName = isSchoolUser ? 'schoolConcepts' : 'conceptos';
        console.log(`[KPIService] Buscando conceptos en colección: ${conceptsCollectionName} para cuaderno ${notebookId}`);
        
        const conceptsQuery = query(
          collection(db, conceptsCollectionName),
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
        
        console.log(`[KPIService] Cuaderno ${notebookId}: ${totalConcepts} conceptos encontrados`);
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
        tiempoEstudioSemanal: {
          domingo: 0,
          lunes: 0,
          martes: 0,
          miercoles: 0,
          jueves: 0,
          viernes: 0,
          sabado: 0
        },
        ultimaActualizacion: Timestamp.now()
      };

      // Mapeo de cuadernos a materias
      const notebooksMap = new Map<string, any>();
      const notebookToMateria = new Map<string, string>();
      
      // Procesar cuadernos y extraer materias
      console.log(`[KPIService] Procesando ${notebooksSnap.size} cuadernos...`);
      notebooksSnap.forEach(doc => {
        const data = doc.data();
        notebooksMap.set(doc.id, { id: doc.id, ...data });
        // Para cuadernos escolares el campo es 'idMateria', para regulares es 'materiaId'
        // También incluimos 'subjectId' para compatibilidad
        const materiaId = data.idMateria || data.materiaId || data.subjectId;
        console.log(`[KPIService] Cuaderno ${doc.id} (${data.title}): idMateria=${data.idMateria}, materiaId=${data.materiaId}, subjectId=${data.subjectId} => ${materiaId}`);
        if (materiaId) {
          notebookToMateria.set(doc.id, materiaId);
        }
      });
      
      console.log(`[KPIService] Mapeo cuaderno->materia:`, Array.from(notebookToMateria.entries()));
      
      // Si es usuario escolar, obtener las materias directamente de los cuadernos
      let subjectsMap = new Map<string, any>();
      if (isSchoolUser) {
        console.log('[KPIService] Usuario escolar detectado, obteniendo materias de los cuadernos...');
        
        // Obtener IDs únicos de materias de los cuadernos
        const uniqueMateriaIds = new Set<string>();
        notebookToMateria.forEach((materiaId) => {
          uniqueMateriaIds.add(materiaId);
        });
        
        console.log('[KPIService] Materias únicas encontradas en cuadernos:', Array.from(uniqueMateriaIds));
        
        // Cargar las materias desde schoolSubjects
        for (const materiaId of uniqueMateriaIds) {
          const subjectDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
          if (subjectDoc.exists()) {
            subjectsMap.set(materiaId, { id: materiaId, ...subjectDoc.data() });
            console.log(`[KPIService] Materia cargada: ${materiaId} - ${subjectDoc.data().nombre || subjectDoc.data().name}`);
          } else {
            console.log(`[KPIService] Advertencia: Materia ${materiaId} no encontrada en schoolSubjects`);
          }
        }
      }

      // Procesar sesiones de estudio por cuaderno
      const cuadernoStats = new Map<string, any>();
      
      // Inicializar estructura para tiempo de estudio semanal
      const weeklyStudyTime = {
        domingo: 0,
        lunes: 0,
        martes: 0,
        miercoles: 0,
        jueves: 0,
        viernes: 0,
        sabado: 0
      };
      
      // Obtener la fecha de inicio de la semana actual
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
      
      console.log(`[KPIService] Calculando tiempo semanal desde ${currentWeekStart.toISOString()} hasta ${currentWeekEnd.toISOString()}`);
      
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
        
        // Agregar tiempo al estudio semanal si la sesión es de esta semana
        if (session.startTime) {
          const sessionDate = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
          
          if (sessionDate >= currentWeekStart && sessionDate < currentWeekEnd) {
            const dayOfWeek = sessionDate.getDay();
            const daysOfWeek = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyStudyTime;
            
            // Convertir segundos a minutos
            const sessionMinutes = Math.round(sessionDuration / 60);
            weeklyStudyTime[dayName] += sessionMinutes;
            
            console.log(`[KPIService] Agregando ${sessionMinutes} minutos al ${dayName}`);
          }
        }

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
          timeBonus: result.timeBonus,
          timestamp: result.timestamp
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
          
          // Agregar tiempo al estudio semanal si el quiz es de esta semana
          if (result.timestamp) {
            const quizDate = result.timestamp.toDate ? result.timestamp.toDate() : new Date(result.timestamp);
            
            if (quizDate >= currentWeekStart && quizDate < currentWeekEnd) {
              const dayOfWeek = quizDate.getDay();
              const daysOfWeek = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
              const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyStudyTime;
              
              // Convertir segundos a minutos
              const quizMinutes = Math.round(result.totalTime / 60);
              weeklyStudyTime[dayName] += quizMinutes;
              
              console.log(`[KPIService] Agregando ${quizMinutes} minutos de quiz al ${dayName}`);
            }
          }
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
          
          // Agregar tiempo al estudio semanal si el mini quiz es de esta semana
          if (result.timestamp) {
            const miniQuizDate = result.timestamp.toDate ? result.timestamp.toDate() : new Date(result.timestamp);
            
            if (miniQuizDate >= currentWeekStart && miniQuizDate < currentWeekEnd) {
              const dayOfWeek = miniQuizDate.getDay();
              const daysOfWeek = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
              const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyStudyTime;
              
              // Convertir segundos a minutos
              const miniQuizMinutes = Math.round(result.totalTime / 60);
              weeklyStudyTime[dayName] += miniQuizMinutes;
              
              console.log(`[KPIService] Agregando ${miniQuizMinutes} minutos de mini quiz al ${dayName}`);
            }
          }
        }
        
        // Contar mini quizzes exitosos
        stats.totalCount++;
        if (result.passed) {
          stats.successCount++;
        }
      });

      // Obtener información del salón para ranking (si existe)
      let classroomUsers: string[] = [];
      // Ya tenemos userDoc y userData desde arriba
      if (userData && userData.classroomId) {
        const classroomId = userData.classroomId;
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
        console.log(`[KPIService] Procesando materia para cuaderno ${notebookId}: ${materiaId}`);
        
        if (materiaId) {
          if (!kpis.materias![materiaId]) {
            console.log(`[KPIService] Creando entrada para materia ${materiaId}`);
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
          
          console.log(`[KPIService] Materia ${materiaId} actualizada con score: ${kpis.materias![materiaId].scoreMateria}`);
        } else {
          console.log(`[KPIService] Cuaderno ${notebookId} no tiene materia asignada`);
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
      
      // Agregar el tiempo de estudio semanal a los KPIs
      kpis.tiempoEstudioSemanal = weeklyStudyTime;
      console.log('[KPIService] Tiempo de estudio semanal calculado:', weeklyStudyTime);
      
      // Calcular el total de minutos de la semana
      const totalMinutosSemana = Object.values(weeklyStudyTime).reduce((sum, minutes) => sum + minutes, 0);
      console.log(`[KPIService] Total de minutos esta semana: ${totalMinutosSemana}`);

      // Guardar KPIs en Firestore (primera fase - sin rankings)
      const kpisDocRef = doc(db, 'users', userId, 'kpis', 'dashboard');
      await setDoc(kpisDocRef, kpis);

      console.log(`[KPIService] KPIs actualizados exitosamente para usuario: ${userId}`);
      console.log(`[KPIService] KPIs guardados:`, kpis);
      
      // Agregar logs para debug del tiempo semanal
      console.log('[KPIService] === RESUMEN DE TIEMPO SEMANAL ===');
      Object.entries(weeklyStudyTime).forEach(([dia, minutos]) => {
        console.log(`[KPIService] ${dia}: ${minutos} minutos (${Math.round(minutos / 60 * 10) / 10} horas)`);
      });
      console.log('[KPIService] ================================');
      
      // Si es usuario escolar, calcular rankings reales
      if (isSchoolUser) {
        console.log(`[KPIService] Calculando rankings para usuario escolar...`);
        try {
          const rankings = await (rankingService as any).calculateStudentRankings(userId);
          
          // Actualizar KPIs con rankings reales por cuaderno
          for (const [notebookId, ranking] of Object.entries(rankings.notebookRankings)) {
            if (kpis.cuadernos[notebookId]) {
              kpis.cuadernos[notebookId].posicionRanking = (ranking as any).position;
              kpis.cuadernos[notebookId].percentilCuaderno = (ranking as any).percentile;
              console.log(`[KPIService] Cuaderno ${notebookId}: Posición ${(ranking as any).position}/${(ranking as any).totalStudents}, Percentil ${(ranking as any).percentile}%`);
            }
          }
          
          // Actualizar KPIs con rankings reales por materia
          for (const [subjectId, ranking] of Object.entries(rankings.subjectRankings)) {
            if (kpis.materias && kpis.materias[subjectId]) {
              kpis.materias[subjectId].percentilMateria = (ranking as any).percentile;
              console.log(`[KPIService] Materia ${subjectId}: Posición ${(ranking as any).position}/${(ranking as any).totalStudents}, Percentil ${(ranking as any).percentile}%`);
            }
          }
          
          // Actualizar percentil global
          kpis.global.percentilPromedioGlobal = rankings.globalPercentile;
          console.log(`[KPIService] Percentil global actualizado: ${rankings.globalPercentile}%`);
          
          // Guardar KPIs actualizados con rankings
          await setDoc(kpisDocRef, kpis);
          console.log(`[KPIService] KPIs actualizados con rankings reales`);
          
          // Actualizar rankings pre-calculados de la institución
          if (userData?.idInstitucion) {
            console.log(`[KPIService] Actualizando rankings pre-calculados para institución: ${userData.idInstitucion}`);
            try {
              // Llamar a la Cloud Function de forma asíncrona (no esperamos)
              const updateRankings = httpsCallable(functions, 'updateInstitutionRankings');
              updateRankings({ institutionId: userData.idInstitucion })
                .then(result => {
                  console.log('[KPIService] Rankings pre-calculados actualizados:', result.data);
                })
                .catch(error => {
                  console.error('[KPIService] Error actualizando rankings pre-calculados:', error);
                });
            } catch (error) {
              console.error('[KPIService] Error llamando función de rankings:', error);
            }
          }
          
        } catch (rankingError) {
          console.error('[KPIService] Error calculando rankings:', rankingError);
          // Los KPIs ya se guardaron sin rankings, así que continuamos
        }
      }

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