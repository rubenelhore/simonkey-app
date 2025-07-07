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
      posicionRanking: number;
      percentilCuaderno: number;
      numeroConceptos: number;
      tiempoEstudioLocal: number;
      estudiosInteligentesLocal: number;
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
        collection(db, 'users', userId, 'studySessions'),
        orderBy('endTime', 'desc')
      );
      const studySessionsSnap = await getDocs(studySessionsQuery);
      
      // Obtener todos los resultados de quiz del usuario
      const quizResultsQuery = query(
        collection(db, 'users', userId, 'quizResults'),
        orderBy('timestamp', 'desc')
      );
      const quizResultsSnap = await getDocs(quizResultsQuery);

      // Obtener información de los cuadernos del usuario
      const notebooksQuery = query(
        collection(db, 'notebooks'),
        where('userId', '==', userId)
      );
      const notebooksSnap = await getDocs(notebooksQuery);

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

      // Mapeo de cuadernos
      const notebooksMap = new Map<string, any>();
      notebooksSnap.forEach(doc => {
        notebooksMap.set(doc.id, { id: doc.id, ...doc.data() });
      });

      // Procesar sesiones de estudio por cuaderno
      const cuadernoStats = new Map<string, any>();
      
      studySessionsSnap.forEach(doc => {
        const session = doc.data();
        const notebookId = session.notebookId;
        
        if (!notebookId) return;

        if (!cuadernoStats.has(notebookId)) {
          cuadernoStats.set(notebookId, {
            tiempoEstudio: 0,
            estudiosInteligentes: 0,
            conceptosEstudiados: new Set(),
            conceptosDominados: new Set(),
            sesionesValidadas: 0,
            sesionesTotales: 0
          });
        }

        const stats = cuadernoStats.get(notebookId);
        
        // Sumar tiempo de estudio (en minutos)
        const duration = session.duration || 0;
        stats.tiempoEstudio += Math.round(duration / 60);

        // Contar estudios inteligentes (sesiones validadas)
        if (session.mode === 'smart' && session.validated) {
          stats.estudiosInteligentes++;
          stats.sesionesValidadas++;
        }
        stats.sesionesTotales++;

        // Registrar conceptos estudiados y dominados
        if (session.conceptsReviewed) {
          session.conceptsReviewed.forEach((concept: any) => {
            stats.conceptosEstudiados.add(concept.id);
            if (concept.mastered) {
              stats.conceptosDominados.add(concept.id);
            }
          });
        }
      });

      // Procesar resultados de quiz por cuaderno
      const quizScores = new Map<string, number[]>();
      
      quizResultsSnap.forEach(doc => {
        const result = doc.data();
        const notebookId = result.notebookId;
        
        if (!notebookId) return;

        if (!quizScores.has(notebookId)) {
          quizScores.set(notebookId, []);
        }
        
        // Usar el score final que incluye bonus de tiempo
        const finalScore = result.finalScore || result.score || 0;
        quizScores.get(notebookId)!.push(finalScore);
      });

      // Calcular KPIs por cuaderno
      let totalScore = 0;
      let totalPercentil = 0;
      let cuadernosConPercentil = 0;

      for (const [notebookId, notebook] of notebooksMap) {
        const stats = cuadernoStats.get(notebookId) || {
          tiempoEstudio: 0,
          estudiosInteligentes: 0,
          conceptosEstudiados: new Set(),
          conceptosDominados: new Set(),
          sesionesValidadas: 0,
          sesionesTotales: 0
        };

        const scores = quizScores.get(notebookId) || [];
        const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
        
        // Calcular porcentaje de éxito de estudios inteligentes
        const porcentajeExito = stats.sesionesTotales > 0 
          ? Math.round((stats.sesionesValidadas / stats.sesionesTotales) * 100)
          : 0;

        // Calcular porcentaje de dominio
        const totalConceptos = stats.conceptosEstudiados.size;
        const conceptosDominados = stats.conceptosDominados.size;
        const porcentajeDominio = totalConceptos > 0
          ? Math.round((conceptosDominados / totalConceptos) * 100)
          : 0;

        // Simular posición en ranking (esto debería calcularse comparando con otros usuarios)
        const posicionRanking = Math.floor(Math.random() * 20) + 1;
        
        // Calcular percentil basado en posición simulada
        const totalAlumnos = 30; // Simulado, debería obtenerse de la base de datos
        const percentil = Math.round(((totalAlumnos - posicionRanking + 1) / totalAlumnos) * 100);

        kpis.cuadernos[notebookId] = {
          scoreCuaderno: maxScore,
          posicionRanking: posicionRanking,
          percentilCuaderno: percentil,
          numeroConceptos: totalConceptos,
          tiempoEstudioLocal: stats.tiempoEstudio,
          estudiosInteligentesLocal: stats.estudiosInteligentes,
          porcentajeExitoEstudiosInteligentes: porcentajeExito,
          porcentajeDominioConceptos: porcentajeDominio,
          conceptosDominados: conceptosDominados,
          conceptosNoDominados: totalConceptos - conceptosDominados
        };

        // Sumar a totales globales
        totalScore += maxScore;
        kpis.global.tiempoEstudioGlobal += stats.tiempoEstudio;
        kpis.global.estudiosInteligentesGlobal += stats.estudiosInteligentes;
        
        if (percentil > 0) {
          totalPercentil += percentil;
          cuadernosConPercentil++;
        }
      }

      // Calcular KPIs globales
      kpis.global.scoreGlobal = totalScore;
      kpis.global.percentilPromedioGlobal = cuadernosConPercentil > 0
        ? Math.round(totalPercentil / cuadernosConPercentil)
        : 0;

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
      return null;
    }
  }
}

// Exportar instancia singleton
export const kpiService = KPIService.getInstance();