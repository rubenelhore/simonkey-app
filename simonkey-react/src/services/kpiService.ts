import { db } from './firebase';
import { rankingService } from './rankingService';
import { saveCurrentPositionToHistory } from '../utils/createPositionHistory';
import { studyStreakService } from './studyStreakService';
import { logger } from '../utils/logger';
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

// Voice recognition cache to avoid repeated queries
const voiceRecognitionCache = new Map<string, Map<string, number>>();

// Pre-load all voice recognition data for a user's notebooks
async function preloadVoiceRecognitionData(userId: string, notebookIds: string[]): Promise<void> {
  try {
    console.log(`[KPIService] Preloading voice recognition data for ${notebookIds.length} notebooks`);
    
    // Initialize cache for this user if not exists
    if (!voiceRecognitionCache.has(userId)) {
      voiceRecognitionCache.set(userId, new Map());
    }
    
    const userVoiceCache = voiceRecognitionCache.get(userId)!;
    
    // Get all voice recognition sessions for this user at once
    const allVoiceRecognitionSessions = await getDocs(query(
      collection(db, 'studySessions'),
      where('userId', '==', userId),
      where('mode', '==', 'voice_recognition'),
      where('validated', '==', true),
      limit(500) // Get more data upfront, but limit to prevent timeout
    ));
    
    // Group by notebook and sum scores
    const notebookScores = new Map<string, number>();
    allVoiceRecognitionSessions.forEach((doc) => {
      const sessionData = doc.data();
      const notebookId = sessionData.notebookId;
      const sessionScore = sessionData.sessionScore || sessionData.finalSessionScore || 0;
      
      if (notebookIds.includes(notebookId)) {
        notebookScores.set(notebookId, (notebookScores.get(notebookId) || 0) + sessionScore);
      }
    });
    
    // Cache all results
    for (const notebookId of notebookIds) {
      const score = notebookScores.get(notebookId) || 0;
      userVoiceCache.set(notebookId, score);
    }
    
    console.log(`[KPIService] Preloaded voice recognition data for ${notebookScores.size} notebooks with sessions`);
  } catch (error) {
    console.error('[KPIService] Error preloading voice recognition data:', error);
  }
}

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
      idMateria: string;
      nombreCuaderno: string;
      numeroConceptos: number;
      tiempoEstudioLocal: number;
      tiempoEstudioLibreLocal: number;
      tiempoEstudioInteligenteLocal: number;
      tiempoQuizLocal: number;
      tiempoJuegosLocal: number;
      estudiosInteligentesLocal: number;
      estudiosLibresLocal: number;
      juegosJugados: number;
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
      tiempoEstudioSemanal?: {
        domingo: number;
        lunes: number;
        martes: number;
        miercoles: number;
        jueves: number;
        viernes: number;
        sabado: number;
      };
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
    console.log('🚨 [KPIService] updateUserKPIs method called for user:', userId);
    try {
      // Obtener todas las sesiones de estudio del usuario
      const studySessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', userId)
      );
      const studySessionsSnap = await getDocs(studySessionsQuery);
      
      // Obtener todos los resultados de quiz del usuario
      let quizResultsSnap;
      try {
        const quizResultsQuery = query(
          collection(db, 'users', userId, 'quizResults'),
          orderBy('createdAt', 'desc')  // CORREGIDO: usar 'createdAt' en lugar de 'timestamp'
        );
        quizResultsSnap = await getDocs(quizResultsQuery);
      } catch (error) {
        console.log('[KPIService] Error con orderBy, intentando consulta simple:', error);
        const quizResultsQuery = query(
          collection(db, 'users', userId, 'quizResults')
        );
        quizResultsSnap = await getDocs(quizResultsQuery);
      }

      // Verificar si es un usuario escolar - primero obtener datos del usuario
      const userDoc = await getDoc(doc(db, 'users', userId));
      let isSchoolUser = false;
      let userData: any = null;
      
      if (userDoc.exists()) {
        userData = userDoc.data();
        // Un usuario es escolar si tiene subscription SCHOOL o si su ID empieza con school_
        isSchoolUser = userData.subscription === 'school' || userId.startsWith('school_');
      }
      
      // Obtener información de los cuadernos del usuario
      let notebooksSnap;
      if (isSchoolUser) {
        // Para usuarios escolares, los cuadernos se obtienen diferente
        const notebooks: any[] = [];
        
        // Usar los datos del usuario que ya obtuvimos
        if (userData) {
          const idCuadernos = userData.idCuadernos || [];
          
          // Primero obtener los cuadernos específicos de idCuadernos
          for (const cuadernoId of idCuadernos) {
            const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', cuadernoId));
            if (notebookDoc.exists()) {
              notebooks.push(notebookDoc);
            }
          }
          
          // Si no hay cuadernos en idCuadernos, buscar por materias asignadas
          if (notebooks.length === 0 && userData.subjectIds && userData.subjectIds.length > 0) {
            
            for (const subjectId of userData.subjectIds) {
              // Buscar notebooks de esta materia
              const notebooksQuery = query(
                collection(db, 'schoolNotebooks'),
                where('idMateria', '==', subjectId)
              );
              const notebooksForSubject = await getDocs(notebooksQuery);
              
              notebooksForSubject.forEach(doc => {
                // Evitar duplicados
                if (!notebooks.find(nb => nb.id === doc.id)) {
                  notebooks.push(doc);
                }
              });
            }
          }
          
          // Si aún no hay notebooks y es estudiante, buscar en learningData
          if (notebooks.length === 0 && userData.schoolRole === 'student') {
            
            const learningQuery = query(
              collection(db, 'learningData'),
              where('userId', '==', userId)
            );
            
            const learningSnap = await getDocs(learningQuery);
            const notebookIds = new Set<string>();
            
            learningSnap.forEach(doc => {
              const data = doc.data();
              if (data.notebookId) {
                notebookIds.add(data.notebookId);
              }
            });
            
            // Obtener los notebooks encontrados
            for (const notebookId of notebookIds) {
              const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
              if (notebookDoc.exists()) {
                // Evitar duplicados
                if (!notebooks.find(nb => nb.id === notebookDoc.id)) {
                  notebooks.push(notebookDoc);
                }
              }
            }
          }
        }
        
        notebooksSnap = {
          docs: notebooks,
          size: notebooks.length,
          forEach: (callback: any) => notebooks.forEach(callback)
        };
      } else {
        // Para usuarios regulares, buscar en notebooks propios y de profesores (materias inscritas)
        // Primero buscar por userId
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', userId)
        );
        const userNotebooksSnap = await getDocs(notebooksQuery);
        
        // También buscar notebooks de materias inscritas
        const notebooks: any[] = [...userNotebooksSnap.docs];
        
        // Buscar enrollments activos del usuario
        const enrollmentsQuery = query(
          collection(db, 'enrollments'),
          where('studentId', '==', userId),
          where('status', '==', 'active')
        );
        const enrollmentsSnap = await getDocs(enrollmentsQuery);
        
        // Para cada enrollment, obtener los notebooks del profesor
        for (const enrollmentDoc of enrollmentsSnap.docs) {
          const enrollmentData = enrollmentDoc.data();
          const teacherId = enrollmentData.teacherId;
          const materiaId = enrollmentData.materiaId;
          
          // Buscar notebooks del profesor para esta materia
          const teacherNotebooksQuery = query(
            collection(db, 'notebooks'),
            where('userId', '==', teacherId),
            where('materiaId', '==', materiaId)
          );
          const teacherNotebooksSnap = await getDocs(teacherNotebooksQuery);
          
          // Agregar notebooks del profesor
          teacherNotebooksSnap.docs.forEach(doc => {
            if (!notebooks.find(nb => nb.id === doc.id)) {
              notebooks.push(doc);
            }
          });
        }
        
        if (userData && userData.idCuadernos && userData.idCuadernos.length > 0) {
          for (const cuadernoId of userData.idCuadernos) {
            // Verificar si no está ya en la lista
            if (!notebooks.find(doc => doc.id === cuadernoId)) {
              const notebookDoc = await getDoc(doc(db, 'notebooks', cuadernoId));
              if (notebookDoc.exists()) {
                notebooks.push(notebookDoc);
              }
            }
          }
        }
        
        notebooksSnap = {
          docs: notebooks,
          size: notebooks.length,
          forEach: (callback: any) => notebooks.forEach(callback)
        };
      }

      // Obtener conceptos por cuaderno
      const conceptsByNotebook = new Map<string, number>();
      for (const notebookDoc of notebooksSnap.docs) {
        const notebookId = notebookDoc.id;
        // Determinar la colección de conceptos según el tipo de usuario
        const conceptsCollectionName = isSchoolUser ? 'schoolConcepts' : 'conceptos';
        
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
      notebooksSnap.forEach((doc: any) => {
        const data = doc.data();
        notebooksMap.set(doc.id, { id: doc.id, ...data });
        // Para cuadernos escolares el campo es 'idMateria', para regulares es 'materiaId'
        // También incluimos 'subjectId' para compatibilidad
        const materiaId = data.idMateria || data.materiaId || data.subjectId;
        if (materiaId) {
          notebookToMateria.set(doc.id, materiaId);
        }
      });
      
      // Si es usuario escolar, obtener las materias directamente de los cuadernos
      let subjectsMap = new Map<string, any>();
      if (isSchoolUser) {
        // Obtener IDs únicos de materias de los cuadernos
        const uniqueMateriaIds = new Set<string>();
        notebookToMateria.forEach((materiaId) => {
          uniqueMateriaIds.add(materiaId);
        });
        
        // Cargar las materias desde schoolSubjects
        for (const materiaId of uniqueMateriaIds) {
          const subjectDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
          if (subjectDoc.exists()) {
            subjectsMap.set(materiaId, { id: materiaId, ...subjectDoc.data() });
          }
        }
      }

      // Procesar sesiones de estudio por cuaderno
      const cuadernoStats = new Map<string, any>();
      
      // Inicializar estructura para tiempo de estudio semanal (acumulado histórico por día de la semana)
      const weeklyStudyTime = {
        domingo: 0,
        lunes: 0,
        martes: 0,
        miercoles: 0,
        jueves: 0,
        viernes: 0,
        sabado: 0
      };
      
      // IMPORTANTE: Inicializar materias ANTES de procesar sesiones para poder asignar tiempo
      const uniqueMateriaIds = new Set<string>();
      notebookToMateria.forEach((materiaId) => {
        uniqueMateriaIds.add(materiaId);
      });
      
      for (const materiaId of uniqueMateriaIds) {
        if (!kpis.materias![materiaId]) {
          kpis.materias![materiaId] = {
            scoreMateria: 0,
            percentilMateria: 0,
            tiempoEstudioMateria: 0,
            estudiosInteligentesMateria: 0,
            conceptosDominadosMateria: 0,
            conceptosNoDominadosMateria: 0,
            tiempoEstudioSemanal: {
              domingo: 0,
              lunes: 0,
              martes: 0,
              miercoles: 0,
              jueves: 0,
              viernes: 0,
              sabado: 0
            }
          };
        }
      }
      
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
            estudiosInteligentesValidadosConIntensidad: 0, // NEW: Track validated studies with intensity values
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
          
          // Calcular estudios inteligentes basado en la intensidad
          // Por defecto es 1 (Progress) si no está especificada la intensidad
          let studyValue = 1;
          if (session.intensity === 'warm_up') {
            studyValue = 0.5;
          } else if (session.intensity === 'rocket') {
            studyValue = 2;
          }
          stats.estudiosInteligentesTotal += studyValue;
          
          if (session.validated) {
            stats.estudiosInteligentesExitosos++;
            stats.estudiosInteligentesValidadosConIntensidad += studyValue; // Add fractional value
            stats.sesionesValidadas++;
          }
        } else if (session.mode === 'free') {
          stats.tiempoEstudioLibre += sessionDuration;
          stats.estudiosLibresTotal++;
        } else if (session.mode === 'voice_recognition') {
          // Añadir tiempo de estudio activo (reconocimiento de voz)
          stats.tiempoEstudioInteligente += sessionDuration;
          
          // Contar como estudio inteligente si está validado
          if (session.validated) {
            stats.estudiosInteligentesExitosos++;
            stats.estudiosInteligentesTotal += 1;
            stats.sesionesValidadas++;
          }
        }
        
        stats.sesionesTotales++;
        
        // Agregar tiempo al estudio semanal (acumulado histórico por día de la semana)
        if (session.startTime && sessionDuration > 0) {
          const sessionDate = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
          
          const dayOfWeek = sessionDate.getDay();
          const daysOfWeek = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
          const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyStudyTime;
          
          // Convertir segundos a minutos
          const sessionMinutes = Math.round(sessionDuration / 60);
          weeklyStudyTime[dayName] += sessionMinutes;
          
          // También agregar a la materia correspondiente si existe
          const materiaId = notebookToMateria.get(notebookId);
          if (materiaId && kpis.materias![materiaId]) {
            if (!kpis.materias![materiaId].tiempoEstudioSemanal) {
              kpis.materias![materiaId].tiempoEstudioSemanal = {
                domingo: 0, lunes: 0, martes: 0, miercoles: 0,
                jueves: 0, viernes: 0, sabado: 0
              };
            }
            kpis.materias![materiaId].tiempoEstudioSemanal![dayName] += sessionMinutes;
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
      
      console.log(`[KPIService] DEBUG: Procesando ${quizResultsSnap.size} resultados de quiz`);
      console.log(`[KPIService] DEBUG: Consulta de quiz results para usuario: ${userId}`);
      
      quizResultsSnap.forEach(doc => {
        const result = doc.data();
        const notebookId = result.notebookId;
        
        console.log(`[KPIService] DEBUG Quiz Result:`, {
          docId: doc.id,
          notebookId,
          totalTime: result.totalTime,
          timeRemaining: result.timeRemaining,
          timestamp: result.timestamp?.toDate?.() || result.timestamp,
          allFields: Object.keys(result)
        });
        
        if (!notebookId) return;

        if (!quizStats.has(notebookId)) {
          quizStats.set(notebookId, { scores: [], totalTime: 0 });
        }
        
        const stats = quizStats.get(notebookId)!;
        
        // Usar el score final que incluye bonus de tiempo
        const finalScore = result.finalScore || result.score || 0;
        stats.scores.push(finalScore);
        
        // Sumar tiempo del quiz
        if (result.totalTime) {
          console.log(`[KPIService] DEBUG Quiz: ${notebookId}, totalTime: ${result.totalTime}s`);
          stats.totalTime += result.totalTime;
          
          // Agregar tiempo al estudio semanal (acumulado histórico)
          if (result.timestamp) {
            const quizDate = result.timestamp.toDate ? result.timestamp.toDate() : new Date(result.timestamp);
            
            const dayOfWeek = quizDate.getDay();
            const daysOfWeek = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyStudyTime;
            
            // Convertir segundos a minutos
            const quizMinutes = Math.round(result.totalTime / 60);
            weeklyStudyTime[dayName] += quizMinutes;
            
            // También agregar a la materia correspondiente si existe
            const materiaId = notebookToMateria.get(notebookId);
            if (materiaId && kpis.materias![materiaId]) {
              if (!kpis.materias![materiaId].tiempoEstudioSemanal) {
                kpis.materias![materiaId].tiempoEstudioSemanal = {
                  domingo: 0, lunes: 0, martes: 0, miercoles: 0,
                  jueves: 0, viernes: 0, sabado: 0
                };
              }
              kpis.materias![materiaId].tiempoEstudioSemanal![dayName] += quizMinutes;
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
          
          // Agregar tiempo al estudio semanal (acumulado histórico)
          if (result.timestamp) {
            const miniQuizDate = result.timestamp.toDate ? result.timestamp.toDate() : new Date(result.timestamp);
            
            const dayOfWeek = miniQuizDate.getDay();
            const daysOfWeek = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyStudyTime;
            
            // Convertir segundos a minutos
            const miniQuizMinutes = Math.round(result.totalTime / 60);
            weeklyStudyTime[dayName] += miniQuizMinutes;
            
            // También agregar a la materia correspondiente si existe
            const materiaId = notebookToMateria.get(notebookId);
            if (materiaId && kpis.materias![materiaId]) {
              if (!kpis.materias![materiaId].tiempoEstudioSemanal) {
                kpis.materias![materiaId].tiempoEstudioSemanal = {
                  domingo: 0, lunes: 0, martes: 0, miercoles: 0,
                  jueves: 0, viernes: 0, sabado: 0
                };
              }
              kpis.materias![materiaId].tiempoEstudioSemanal![dayName] += miniQuizMinutes;
            }
          }
        }
        
        // Contar mini quizzes exitosos
        stats.totalCount++;
        if (result.passed) {
          stats.successCount++;
        }
      });

      // Procesar datos de juegos por cuaderno
      const gameStats = new Map<string, { gamesPlayed: number, totalTime: number, totalPoints: number }>();
      
      try {
        // Obtener historial de puntos de juegos con la nueva estructura
        const gamePointsDoc = await getDoc(doc(db, 'gamePoints', userId));
        
        if (gamePointsDoc.exists()) {
          const gamePointsData = gamePointsDoc.data();
          
          // Ahora los datos están organizados por notebookId
          const notebookPoints = gamePointsData.notebookPoints || {};
          
          // Procesar cada cuaderno
          for (const [notebookId, notebookData] of Object.entries(notebookPoints)) {
            const pointsHistory = (notebookData as any).pointsHistory || [];
            
            if (!gameStats.has(notebookId)) {
              gameStats.set(notebookId, { gamesPlayed: 0, totalTime: 0, totalPoints: 0 });
            }
            
            const stats = gameStats.get(notebookId)!;
            stats.gamesPlayed = pointsHistory.length;
            stats.totalPoints = (notebookData as any).totalPoints || 0;
            
            // Procesar cada transacción para calcular tiempo
            pointsHistory.forEach((transaction: any) => {
              // Extraer tipo de juego del gameId
              const gameType = transaction.gameId?.split('_')[0] || 'unknown';
              let estimatedTime = 60; // Por defecto 1 minuto
              
              // Estimaciones basadas en el tipo de juego (en segundos)
              switch(gameType) {
                case 'memory': estimatedTime = 90; break;  // 1.5 minutos = 90 segundos
                case 'puzzle': estimatedTime = 120; break; // 2 minutos = 120 segundos
                case 'quiz': estimatedTime = 180; break;   // 3 minutos = 180 segundos
                // race removido - ya no disponible
              }
              
              stats.totalTime += estimatedTime;
              
              // Agregar al tiempo semanal (acumulado histórico)
              if (transaction.timestamp) {
                const gameDate = transaction.timestamp.toDate ? transaction.timestamp.toDate() : new Date(transaction.timestamp);
                
                const dayOfWeek = gameDate.getDay();
                const daysOfWeek = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
                const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyStudyTime;
                
                // Convertir segundos a minutos para el tiempo semanal
                const gameMinutes = Math.round(estimatedTime / 60);
                weeklyStudyTime[dayName] += gameMinutes;
                
                // También agregar a la materia correspondiente si existe
                const materiaId = notebookToMateria.get(notebookId);
                if (materiaId && kpis.materias![materiaId]) {
                  if (!kpis.materias![materiaId].tiempoEstudioSemanal) {
                    kpis.materias![materiaId].tiempoEstudioSemanal = {
                      domingo: 0, lunes: 0, martes: 0, miercoles: 0,
                      jueves: 0, viernes: 0, sabado: 0
                    };
                  }
                  kpis.materias![materiaId].tiempoEstudioSemanal![dayName] += gameMinutes;
                }
              }
            });
          }
        }
      } catch (error) {
        console.error('[KPIService] Error procesando datos de juegos:', error);
        // Continuar sin datos de juegos
      }

      // Agregar cuadernos que tienen datos de juegos pero no están en notebooksMap
      for (const [notebookId] of gameStats) {
        if (!notebooksMap.has(notebookId)) {
          try {
            const notebookDoc = await getDoc(doc(db, 'notebooks', notebookId));
            if (notebookDoc.exists()) {
              const data = notebookDoc.data();
              notebooksMap.set(notebookId, { id: notebookId, ...data });
              
              // También agregar al mapeo de materias si corresponde
              const materiaId = data.idMateria || data.materiaId || data.subjectId;
              if (materiaId) {
                notebookToMateria.set(notebookId, materiaId);
              }
            }
          } catch (error) {
            console.error(`[KPIService] Error obteniendo cuaderno ${notebookId}:`, error);
          }
        }
      }

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

      // Obtener el bonus de racha actual del usuario
      const userStreak = await studyStreakService.getUserStreak(userId);
      const streakBonus = studyStreakService.getStreakBonus(userStreak.currentStreak);

      // Calcular KPIs por cuaderno
      let totalScore = 0;
      let totalPercentil = 0;
      let cuadernosConPercentil = 0;
      
      // Debug: Verificar si hay notebooks duplicados en la lista inicial
      const notebookIds = Array.from(notebooksMap.keys());
      const uniqueIds = [...new Set(notebookIds)];
      console.log(`[KPIService] Debug: notebooks en map: ${notebooksMap.size}, unique IDs: ${uniqueIds.length}`);
      console.log(`[KPIService] Procesando ${notebooksMap.size} notebooks para calcular Score Global`);

      // Pre-load ALL voice recognition data for the user at once for efficiency
      await preloadVoiceRecognitionData(userId, notebookIds);

      for (const [notebookId, notebook] of notebooksMap) {
        const stats = cuadernoStats.get(notebookId) || {
          tiempoEstudioLibre: 0,
          tiempoEstudioInteligente: 0,
          tiempoQuiz: 0,
          estudiosInteligentesTotal: 0,
          estudiosLibresTotal: 0,
          estudiosInteligentesExitosos: 0,
          estudiosInteligentesValidadosConIntensidad: 0, // Default value
          conceptosDominados: 0,
          conceptosNoDominados: 0,
          sesionesValidadas: 0,
          sesionesTotales: 0
        };

        const quizData = quizStats.get(notebookId) || { scores: [], totalTime: 0 };
        const miniQuizData = miniQuizStats.get(notebookId) || { totalTime: 0, successCount: 0, totalCount: 0 };
        const gameData = gameStats.get(notebookId) || { gamesPlayed: 0, totalTime: 0, totalPoints: 0 };
        // Calcular suma total de scores del quiz
        let totalQuizScore = quizData.scores.reduce((sum, score) => sum + score, 0);
        
        // Si no hay scores en quizResults, intentar obtener de quizStats
        if (totalQuizScore === 0) {
          try {
            const quizStatsRef = doc(db, 'users', userId, 'quizStats', notebookId);
            const quizStatsDoc = await getDoc(quizStatsRef);
            if (quizStatsDoc.exists()) {
              const statsData = quizStatsDoc.data();
              // Usar totalScore si existe, sino usar maxScore por compatibilidad
              if (statsData.totalScore !== undefined) {
                totalQuizScore = statsData.totalScore;
              } else if (statsData.maxScore) {
                totalQuizScore = statsData.maxScore;
              }
            }
          } catch (error) {
          }
        }
        
        // Calcular tiempo total de estudio (en segundos) - incluir estudio activo, mini quiz y juegos
        const tiempoQuizTotal = quizData.totalTime + miniQuizData.totalTime;
        const tiempoJuegosTotal = gameData.totalTime;
        const tiempoEstudioTotal = stats.tiempoEstudioLibre + stats.tiempoEstudioInteligente + tiempoQuizTotal + tiempoJuegosTotal;
        
        console.log(`[KPIService] DEBUG Cuaderno ${notebooksMap.get(notebookId)?.title || notebookId}:`);
        console.log(`  - quizData.totalTime: ${quizData.totalTime}s`);
        console.log(`  - miniQuizData.totalTime: ${miniQuizData.totalTime}s`);
        console.log(`  - tiempoQuizTotal: ${tiempoQuizTotal}s`);
        console.log(`  - tiempoEstudioTotal: ${tiempoEstudioTotal}s`);
        console.log(`  - tiempoEstudioLocal (minutos): ${Math.round(tiempoEstudioTotal / 60)}`);
        
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
              classroomScores.push(totalQuizScore);
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
          posicionRanking = classroomScores.findIndex(score => score === totalQuizScore) + 1;
          
          // Calcular percentil
          percentil = Math.round(((classroomUsers.length - posicionRanking + 1) / classroomUsers.length) * 100);
        }

        // Obtener número de conceptos del cuaderno
        const numeroConceptos = conceptsByNotebook.get(notebookId) || 0;

        // Calcular score del cuaderno con la misma fórmula de /study:
        // Score Total = totalStudyPoints + totalMultiplierPoints
        // totalStudyPoints = (estudiosInteligentes × 1000) + (voiceRecognition × 1000) + (estudiosLibres × 0.1 × 1000)
        // totalMultiplierPoints = maxScore + gamePoints + streakBonus
        
        // Calcular puntos de estudio (multiplicados por 1000)
        const smartStudyPoints = stats.estudiosInteligentesValidadosConIntensidad || stats.estudiosInteligentesExitosos || 0;
        
        // Get voice recognition points from preloaded cache
        let voiceRecognitionPoints = 0;
        const userVoiceCache = voiceRecognitionCache.get(userId);
        if (userVoiceCache && userVoiceCache.has(notebookId)) {
          voiceRecognitionPoints = userVoiceCache.get(notebookId)!;
        }
        
        const freeStudyPoints = stats.estudiosLibresTotal * 0.05; // Cada estudio libre vale 0.05 (50 puntos finales)
        const totalStudyPoints = (smartStudyPoints * 1000) + (voiceRecognitionPoints * 1000) + (freeStudyPoints * 1000);
        
        // Calcular puntos multiplicadores
        const maxQuizScore = totalQuizScore > 0 ? totalQuizScore : 0;
        const gamePoints = gameData.totalPoints || 0;
        const totalMultiplierPoints = maxQuizScore + gamePoints + streakBonus;
        
        // Score final del cuaderno
        const scoreCuaderno = totalStudyPoints + totalMultiplierPoints;
        
        console.log(`[KPIService] Notebook: ${notebook.title || notebook.name || notebookId}`, {
          scoreCuaderno,
          totalStudyPoints,
          totalMultiplierPoints,
          smartStudyPoints,
          voiceRecognitionPoints,
          freeStudyPoints,
          maxQuizScore,
          gamePoints,
          streakBonus
        });

        // Obtener el ID de la materia del cuaderno
        const idMateria = notebookToMateria.get(notebookId) || '';
        const nombreCuaderno = notebook.title || notebook.name || 'Sin nombre';

        
        kpis.cuadernos[notebookId] = {
          scoreCuaderno,
          scoreMaxCuaderno: totalQuizScore,  // Ahora es la suma total, no el máximo
          posicionRanking,
          percentilCuaderno: percentil,
          numeroConceptos,
          tiempoEstudioLocal: Math.round(tiempoEstudioTotal / 60), // Convertir a minutos
          tiempoEstudioLibreLocal: Math.round(stats.tiempoEstudioLibre / 60),
          tiempoEstudioInteligenteLocal: Math.round(stats.tiempoEstudioInteligente / 60),
          tiempoQuizLocal: Math.round(tiempoQuizTotal / 60),
          tiempoJuegosLocal: Math.round(tiempoJuegosTotal / 60),
          estudiosInteligentesLocal: stats.estudiosInteligentesTotal,
          estudiosLibresLocal: stats.estudiosLibresTotal,
          juegosJugados: gameData.gamesPlayed,
          porcentajeExitoEstudiosInteligentes: porcentajeExito,
          porcentajeDominioConceptos: porcentajeDominio,
          conceptosDominados: stats.conceptosDominados,
          conceptosNoDominados: stats.conceptosNoDominados,
          idMateria: idMateria,
          nombreCuaderno: nombreCuaderno
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
              conceptosNoDominadosMateria: 0,
              tiempoEstudioSemanal: {
                domingo: 0,
                lunes: 0,
                martes: 0,
                miercoles: 0,
                jueves: 0,
                viernes: 0,
                sabado: 0
              }
            };
          }
          
          kpis.materias![materiaId].scoreMateria += scoreCuaderno;
          kpis.materias![materiaId].tiempoEstudioMateria += Math.round(tiempoEstudioTotal / 60);
          kpis.materias![materiaId].estudiosInteligentesMateria += stats.estudiosInteligentesTotal;
          kpis.materias![materiaId].conceptosDominadosMateria += stats.conceptosDominados;
          kpis.materias![materiaId].conceptosNoDominadosMateria += stats.conceptosNoDominados;
          
        } else {
        }
      }

      // Calcular KPIs globales
      console.log(`[KPIService] Score Global Final: ${totalScore} (suma de ${notebooksMap.size} notebooks)`);
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
      
      // Calcular el total de minutos de la semana
      const totalMinutosSemana = Object.values(weeklyStudyTime).reduce((sum, minutes) => sum + minutes, 0);

      // Guardar KPIs en Firestore (primera fase - sin rankings)
      const kpisDocRef = doc(db, 'users', userId, 'kpis', 'dashboard');
      await setDoc(kpisDocRef, kpis);

      logger.info(`KPIs updated successfully for user: ${userId}`);
      
      // Agregar logs para debug del tiempo semanal
      
      // Si es usuario escolar, calcular rankings reales
      if (isSchoolUser) {
        try {
          const rankings = await (rankingService as any).calculateStudentRankings(userId);
          
          // Actualizar KPIs con rankings reales por cuaderno
          for (const [notebookId, ranking] of Object.entries(rankings.notebookRankings)) {
            if (kpis.cuadernos[notebookId]) {
              kpis.cuadernos[notebookId].posicionRanking = (ranking as any).position;
              kpis.cuadernos[notebookId].percentilCuaderno = (ranking as any).percentile;
            }
          }
          
          // Actualizar KPIs con rankings reales por materia
          for (const [subjectId, ranking] of Object.entries(rankings.subjectRankings)) {
            if (kpis.materias && kpis.materias[subjectId]) {
              kpis.materias[subjectId].percentilMateria = (ranking as any).percentile;
              
              // Guardar posición en el historial
              if (userData?.idInstitucion) {
                try {
                  await saveCurrentPositionToHistory(
                    userId,
                    userData.idInstitucion,
                    subjectId,
                    (ranking as any).position,
                    (ranking as any).totalStudents,
                    kpis.materias[subjectId].scoreMateria
                  );
                } catch (historyError) {
                  console.error(`[KPIService] Error guardando historial de posición:`, historyError);
                }
              }
            }
          }
          
          // Actualizar percentil global
          kpis.global.percentilPromedioGlobal = rankings.globalPercentile || 0;
          
          // Guardar KPIs actualizados con rankings
          await setDoc(kpisDocRef, kpis);
          
          // Los rankings ahora se actualizan automáticamente en calculateStudentRankings
          // cuando detecta que no existen o están desactualizados
          
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
    logger.debug(`getUserKPIs called with userId: ${userId}`);
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

  /**
   * Obtiene el conteo total de conceptos con repeticiones >= 2
   * Cuenta conceptos que han sido repasados al menos 2 veces (para divisiones)
   */
  async getConceptsWithMinRepetitions(userId: string, minRepetitions: number = 2): Promise<number> {
    try {
      // Obtener todos los datos de aprendizaje del usuario
      const learningDataQuery = query(
        collection(db, 'users', userId, 'learningData'),
        where('repetitions', '>=', minRepetitions)
      );
      
      const learningDataSnapshot = await getDocs(learningDataQuery);
      const count = learningDataSnapshot.size;
      
      return count;
      
    } catch (error) {
      console.error('[KPIService] Error obteniendo conceptos con repeticiones mínimas:', error);
      return 0;
    }
  }

  /**
   * Obtiene el conteo total de conceptos dominados para un usuario
   * Suma todos los conceptos dominados de todos los cuadernos
   */
  async getTotalDominatedConceptsByUser(userId: string): Promise<{
    conceptosDominados: number;
    conceptosNoDominados: number;
    totalConceptosEstudiados: number;
    porcentajeDominio: number;
  }> {
    try {
      // Obtener los KPIs actualizados
      const kpis = await this.getUserKPIs(userId);
      
      if (!kpis || !kpis.cuadernos) {
        return {
          conceptosDominados: 0,
          conceptosNoDominados: 0,
          totalConceptosEstudiados: 0,
          porcentajeDominio: 0
        };
      }
      
      let totalConceptosDominados = 0;
      let totalConceptosNoDominados = 0;
      
      // Sumar conceptos de todos los cuadernos
      for (const [cuadernoId, cuadernoData] of Object.entries(kpis.cuadernos)) {
        totalConceptosDominados += cuadernoData.conceptosDominados || 0;
        totalConceptosNoDominados += cuadernoData.conceptosNoDominados || 0;
      }
      
      const totalConceptosEstudiados = totalConceptosDominados + totalConceptosNoDominados;
      const porcentajeDominio = totalConceptosEstudiados > 0 
        ? Math.round((totalConceptosDominados / totalConceptosEstudiados) * 100)
        : 0;
      
      const result = {
        conceptosDominados: totalConceptosDominados,
        conceptosNoDominados: totalConceptosNoDominados,
        totalConceptosEstudiados,
        porcentajeDominio
      };
      
      return result;
      
    } catch (error) {
      console.error('[KPIService] Error obteniendo total de conceptos dominados:', error);
      return {
        conceptosDominados: 0,
        conceptosNoDominados: 0,
        totalConceptosEstudiados: 0,
        porcentajeDominio: 0
      };
    }
  }

  /**
   * Obtiene el conteo de conceptos dominados, aprendiz y no dominados por materia
   * Similar a getConceptStatsForNotebook pero agrupado por materia
   */
  async getConceptStatsBySubject(userId: string): Promise<{
    [subjectId: string]: {
      subjectName: string;
      conceptosDominados: number;
      conceptosAprendiz: number;
      conceptosNoDominados: number;
      totalConceptos: number;
    }
  }> {
    try {
      // Primero obtener los KPIs actualizados
      const kpis = await this.getUserKPIs(userId);
      
      if (!kpis || !kpis.materias) {
        return {};
      }
      
      const statsBySubject: {
        [subjectId: string]: {
          subjectName: string;
          conceptosDominados: number;
          conceptosAprendiz: number;
          conceptosNoDominados: number;
          totalConceptos: number;
        }
      } = {};
      
      // Determinar si es usuario escolar
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const isSchoolUser = !!userData?.idInstitucion;
      
      // Obtener información de las materias
      for (const [materiaId, materiaData] of Object.entries(kpis.materias)) {
        let subjectName = 'Sin nombre';
        
        if (isSchoolUser) {
          // Para usuarios escolares, buscar en schoolSubjects
          const subjectDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
          if (subjectDoc.exists()) {
            const subjectData = subjectDoc.data();
            subjectName = subjectData.nombre || subjectData.name || 'Sin nombre';
          }
        } else {
          // Para usuarios regulares, buscar en materias
          const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
          if (materiaDoc.exists()) {
            const materiaDocData = materiaDoc.data();
            subjectName = materiaDocData.nombre || materiaDocData.name || 'Sin nombre';
          }
        }
        
        // Los conceptos aprendiz serían el total menos los dominados y no dominados
        const totalConceptos = materiaData.conceptosDominadosMateria + materiaData.conceptosNoDominadosMateria;
        
        statsBySubject[materiaId] = {
          subjectName,
          conceptosDominados: materiaData.conceptosDominadosMateria || 0,
          conceptosAprendiz: 0, // Por ahora 0, ya que no se rastrea específicamente en KPIs
          conceptosNoDominados: materiaData.conceptosNoDominadosMateria || 0,
          totalConceptos
        };
      }
      
      return statsBySubject;
      
    } catch (error) {
      console.error('[KPIService] Error obteniendo estadísticas de conceptos por materia:', error);
      return {};
    }
  }
}

// Exportar instancia única
export const kpiService = KPIService.getInstance();

// También exportar la función getKPIsFromCache para compatibilidad
export async function getKPIsFromCache(userId: string): Promise<DashboardKPIs | null> {
  return kpiService.getUserKPIs(userId);
}