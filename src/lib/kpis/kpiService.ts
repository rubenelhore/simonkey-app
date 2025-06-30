import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, Timestamp, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import type { 
  DashboardKPIs, 
  KPIsPorCuaderno, 
  EventoEstudioInteligente, 
  EventoEstudioLibre, 
  EventoQuiz,
  HistogramaTiempoEstudio,
  PosicionHistorica
} from '@/types/kpis';

export class KPIService {
  private static instance: KPIService;
  
  private constructor() {}
  
  static getInstance(): KPIService {
    if (!KPIService.instance) {
      KPIService.instance = new KPIService();
    }
    return KPIService.instance;
  }

  // Inicializar estructura de KPIs para un usuario
  async initializeUserKPIs(userId: string, tipoUsuario: 'pro' | 'free' | 'school-student' | 'school-teacher'): Promise<void> {
    const kpiRef = doc(db, 'users', userId, 'kpis', 'dashboard');
    
    const initialKPIs: DashboardKPIs = {
      userId,
      tipoUsuario,
      global: {
        scoreGlobal: 0,
        percentilPromedioGlobal: 50, // Empezamos en la mediana
        tiempoEstudioGlobal: 0,
        estudiosInteligentesGlobal: 0,
        ultimaActualizacion: new Date(),
        totalCuadernos: 0,
        totalMaterias: 0
      },
      cuadernos: {},
      histogramaSemanal: this.initializeHistogram(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (tipoUsuario.startsWith('school')) {
      initialKPIs.materias = {};
      initialKPIs.historicosPosiciones = {};
    }
    
    await setDoc(kpiRef, initialKPIs);
  }

  // Actualizar KPIs después de un estudio inteligente
  async updateAfterSmartStudy(evento: EventoEstudioInteligente): Promise<void> {
    const { cuadernoId, materiaId, duracion, exitoso, conceptosEstudiados, conceptosDominados, conceptosNoDominados, timestamp } = evento;
    
    const userId = await this.getUserIdFromNotebook(cuadernoId);
    if (!userId) return;
    
    const kpiRef = doc(db, 'users', userId, 'kpis', 'dashboard');
    const kpiDoc = await getDoc(kpiRef);
    
    if (!kpiDoc.exists()) {
      await this.initializeUserKPIs(userId, 'free'); // Default type
    }
    
    const currentData = kpiDoc.data() as DashboardKPIs;
    
    // Actualizar KPIs del cuaderno
    if (!currentData.cuadernos[cuadernoId]) {
      currentData.cuadernos[cuadernoId] = await this.initializeCuadernoKPIs(cuadernoId);
    }
    
    const cuadernoKPIs = currentData.cuadernos[cuadernoId];
    cuadernoKPIs.tiempoEstudioInteligente += duracion;
    cuadernoKPIs.tiempoEstudioLocal += duracion;
    cuadernoKPIs.estudiosInteligentesTotales++;
    
    if (exitoso) {
      cuadernoKPIs.estudiosInteligentesExitosos++;
      cuadernoKPIs.estudiosInteligentesLocal++;
    }
    
    cuadernoKPIs.conceptosDominados += conceptosDominados;
    cuadernoKPIs.conceptosNoDominados += conceptosNoDominados;
    
    // Recalcular porcentajes
    cuadernoKPIs.porcentajeExitoEstudiosInteligentes = 
      cuadernoKPIs.estudiosInteligentesTotales > 0 
        ? (cuadernoKPIs.estudiosInteligentesExitosos / cuadernoKPIs.estudiosInteligentesTotales) * 100 
        : 0;
    
    const totalConceptosEvaluados = cuadernoKPIs.conceptosDominados + cuadernoKPIs.conceptosNoDominados;
    cuadernoKPIs.porcentajeDominioConceptos = 
      totalConceptosEvaluados > 0 
        ? (cuadernoKPIs.conceptosDominados / totalConceptosEvaluados) * 100 
        : 0;
    
    // Actualizar KPIs globales
    currentData.global.tiempoEstudioGlobal += duracion;
    if (exitoso) {
      currentData.global.estudiosInteligentesGlobal++;
    }
    
    // Actualizar histograma semanal
    this.updateHistogram(currentData.histogramaSemanal, timestamp, duracion, 'estudioInteligente');
    
    // Actualizar KPIs por materia si aplica
    if (materiaId && currentData.materias) {
      await this.updateMateriaKPIs(currentData, materiaId, duracion, exitoso);
    }
    
    currentData.updatedAt = new Date();
    await updateDoc(kpiRef, currentData);
    
    // Actualizar score y rankings
    await this.updateScoresAndRankings(userId, cuadernoId, materiaId);
  }

  // Actualizar KPIs después de un estudio libre
  async updateAfterFreeStudy(evento: EventoEstudioLibre): Promise<void> {
    const { cuadernoId, materiaId, duracion, conceptosRepasados, timestamp } = evento;
    
    const userId = await this.getUserIdFromNotebook(cuadernoId);
    if (!userId) return;
    
    const kpiRef = doc(db, 'users', userId, 'kpis', 'dashboard');
    const kpiDoc = await getDoc(kpiRef);
    
    if (!kpiDoc.exists()) return;
    
    const currentData = kpiDoc.data() as DashboardKPIs;
    
    if (!currentData.cuadernos[cuadernoId]) {
      currentData.cuadernos[cuadernoId] = await this.initializeCuadernoKPIs(cuadernoId);
    }
    
    const cuadernoKPIs = currentData.cuadernos[cuadernoId];
    cuadernoKPIs.tiempoEstudioLibre += duracion;
    cuadernoKPIs.tiempoEstudioLocal += duracion;
    cuadernoKPIs.estudiosLibresLocal++;
    
    currentData.global.tiempoEstudioGlobal += duracion;
    
    this.updateHistogram(currentData.histogramaSemanal, timestamp, duracion, 'estudioLibre');
    
    if (materiaId && currentData.materias) {
      currentData.materias[materiaId].tiempoEstudioMateria += duracion;
    }
    
    currentData.updatedAt = new Date();
    await updateDoc(kpiRef, currentData);
  }

  // Actualizar KPIs después de un quiz
  async updateAfterQuiz(evento: EventoQuiz): Promise<void> {
    const { cuadernoId, materiaId, duracion, score, accuracy, timestamp } = evento;
    
    const userId = await this.getUserIdFromNotebook(cuadernoId);
    if (!userId) return;
    
    const kpiRef = doc(db, 'users', userId, 'kpis', 'dashboard');
    const kpiDoc = await getDoc(kpiRef);
    
    if (!kpiDoc.exists()) return;
    
    const currentData = kpiDoc.data() as DashboardKPIs;
    
    if (!currentData.cuadernos[cuadernoId]) {
      currentData.cuadernos[cuadernoId] = await this.initializeCuadernoKPIs(cuadernoId);
    }
    
    const cuadernoKPIs = currentData.cuadernos[cuadernoId];
    cuadernoKPIs.tiempoQuiz += duracion;
    cuadernoKPIs.tiempoEstudioLocal += duracion;
    cuadernoKPIs.scoreCuaderno += score;
    
    currentData.global.tiempoEstudioGlobal += duracion;
    currentData.global.scoreGlobal += score;
    
    this.updateHistogram(currentData.histogramaSemanal, timestamp, duracion, 'quiz');
    
    if (materiaId && currentData.materias) {
      currentData.materias[materiaId].tiempoEstudioMateria += duracion;
      currentData.materias[materiaId].scoreMateria += score;
    }
    
    currentData.updatedAt = new Date();
    await updateDoc(kpiRef, currentData);
    
    await this.updateScoresAndRankings(userId, cuadernoId, materiaId);
  }

  // Calcular y actualizar rankings y percentiles
  async updateScoresAndRankings(userId: string, cuadernoId: string, materiaId?: string): Promise<void> {
    // Actualizar ranking del cuaderno
    const notebookRankings = await this.calculateNotebookRankings(cuadernoId);
    const userPosition = notebookRankings.findIndex(r => r.userId === userId) + 1;
    const totalUsers = notebookRankings.length;
    
    const kpiRef = doc(db, 'users', userId, 'kpis', 'dashboard');
    const kpiDoc = await getDoc(kpiRef);
    
    if (!kpiDoc.exists()) return;
    
    const currentData = kpiDoc.data() as DashboardKPIs;
    
    if (currentData.cuadernos[cuadernoId]) {
      currentData.cuadernos[cuadernoId].posicionRanking = userPosition;
      currentData.cuadernos[cuadernoId].totalAlumnosCuaderno = totalUsers;
      currentData.cuadernos[cuadernoId].percentilCuaderno = totalUsers > 0 ? ((totalUsers - userPosition + 1) / totalUsers) * 100 : 50;
    }
    
    // Actualizar percentil global (promedio de todos los cuadernos)
    const percentiles = Object.values(currentData.cuadernos).map(c => c.percentilCuaderno);
    currentData.global.percentilPromedioGlobal = percentiles.length > 0 
      ? percentiles.reduce((a, b) => a + b, 0) / percentiles.length 
      : 50;
    
    // Si hay materia, actualizar ranking de materia
    if (materiaId && currentData.materias) {
      const materiaRankings = await this.calculateSubjectRankings(materiaId);
      const materiaPosition = materiaRankings.findIndex(r => r.userId === userId) + 1;
      
      if (currentData.materias[materiaId]) {
        currentData.materias[materiaId].posicionRanking = materiaPosition;
        currentData.materias[materiaId].totalAlumnosMateria = materiaRankings.length;
        currentData.materias[materiaId].percentilMateria = materiaRankings.length > 0 
          ? ((materiaRankings.length - materiaPosition + 1) / materiaRankings.length) * 100 
          : 50;
      }
      
      // Actualizar histórico de posiciones (semanal)
      await this.updateWeeklyPositionHistory(userId, materiaId, materiaPosition, currentData.materias[materiaId].scoreMateria);
    }
    
    await updateDoc(kpiRef, currentData);
  }

  // Funciones auxiliares
  private async getUserIdFromNotebook(notebookId: string): Promise<string | null> {
    const notebookDoc = await getDoc(doc(db, 'notebooks', notebookId));
    return notebookDoc.exists() ? notebookDoc.data().userId : null;
  }

  private async initializeCuadernoKPIs(cuadernoId: string): Promise<KPIsPorCuaderno> {
    const notebookDoc = await getDoc(doc(db, 'notebooks', cuadernoId));
    const notebookData = notebookDoc.data();
    
    // Contar conceptos del cuaderno
    const conceptsQuery = query(collection(db, 'conceptos'), where('cuadernoId', '==', cuadernoId));
    const conceptsSnapshot = await getDocs(conceptsQuery);
    
    return {
      cuadernoId,
      cuadernoTitulo: notebookData?.title || '',
      materiaId: notebookData?.subjectId,
      scoreCuaderno: 0,
      posicionRanking: 0,
      totalAlumnosCuaderno: 0,
      percentilCuaderno: 50,
      numeroConceptos: conceptsSnapshot.size,
      tiempoEstudioLocal: 0,
      estudiosInteligentesLocal: 0,
      estudiosLibresLocal: 0,
      estudiosInteligentesExitosos: 0,
      estudiosInteligentesTotales: 0,
      porcentajeExitoEstudiosInteligentes: 0,
      conceptosDominados: 0,
      conceptosNoDominados: 0,
      porcentajeDominioConceptos: 0,
      tiempoQuiz: 0,
      tiempoEstudioInteligente: 0,
      tiempoEstudioLibre: 0
    };
  }

  private initializeHistogram(): HistogramaTiempoEstudio[] {
    const dias: Array<HistogramaTiempoEstudio['dia']> = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    return dias.map(dia => ({
      dia,
      tiempoTotal: 0,
      sesionesQuiz: 0,
      sesionesEstudioInteligente: 0,
      sesionesEstudioLibre: 0
    }));
  }

  private updateHistogram(
    histograma: HistogramaTiempoEstudio[], 
    timestamp: Date, 
    duracion: number, 
    tipo: 'quiz' | 'estudioInteligente' | 'estudioLibre'
  ): void {
    const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const diaSemana = diasSemana[timestamp.getDay()] as HistogramaTiempoEstudio['dia'];
    
    const diaData = histograma.find(h => h.dia === diaSemana);
    if (diaData) {
      diaData.tiempoTotal += duracion;
      switch (tipo) {
        case 'quiz':
          diaData.sesionesQuiz++;
          break;
        case 'estudioInteligente':
          diaData.sesionesEstudioInteligente++;
          break;
        case 'estudioLibre':
          diaData.sesionesEstudioLibre++;
          break;
      }
    }
  }

  private async updateMateriaKPIs(
    data: DashboardKPIs, 
    materiaId: string, 
    duracion: number, 
    estudiosInteligentesIncremento: boolean
  ): Promise<void> {
    if (!data.materias) return;
    
    if (!data.materias[materiaId]) {
      // Inicializar KPIs de materia
      const subjectDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
      const subjectData = subjectDoc.data();
      
      data.materias[materiaId] = {
        materiaId,
        materiaNombre: subjectData?.name || '',
        scoreMateria: 0,
        percentilMateria: 50,
        tiempoEstudioMateria: 0,
        estudiosInteligentesMateria: 0,
        cuadernosIds: [],
        posicionRanking: 0,
        totalAlumnosMateria: 0
      };
    }
    
    data.materias[materiaId].tiempoEstudioMateria += duracion;
    if (estudiosInteligentesIncremento) {
      data.materias[materiaId].estudiosInteligentesMateria++;
    }
  }

  private async calculateNotebookRankings(notebookId: string): Promise<Array<{userId: string, score: number}>> {
    // Esta es una implementación simplificada. En producción, querrías usar una 
    // colección separada para rankings o Cloud Functions para calcular esto eficientemente
    const rankings: Array<{userId: string, score: number}> = [];
    
    // Obtener todos los usuarios que tienen este cuaderno
    const usersQuery = query(collection(db, 'users'));
    const usersSnapshot = await getDocs(usersQuery);
    
    for (const userDoc of usersSnapshot.docs) {
      const kpiDoc = await getDoc(doc(db, 'users', userDoc.id, 'kpis', 'dashboard'));
      if (kpiDoc.exists()) {
        const kpiData = kpiDoc.data() as DashboardKPIs;
        if (kpiData.cuadernos[notebookId]) {
          rankings.push({
            userId: userDoc.id,
            score: kpiData.cuadernos[notebookId].scoreCuaderno
          });
        }
      }
    }
    
    return rankings.sort((a, b) => b.score - a.score);
  }

  private async calculateSubjectRankings(materiaId: string): Promise<Array<{userId: string, score: number}>> {
    const rankings: Array<{userId: string, score: number}> = [];
    
    const usersQuery = query(collection(db, 'users'));
    const usersSnapshot = await getDocs(usersQuery);
    
    for (const userDoc of usersSnapshot.docs) {
      const kpiDoc = await getDoc(doc(db, 'users', userDoc.id, 'kpis', 'dashboard'));
      if (kpiDoc.exists()) {
        const kpiData = kpiDoc.data() as DashboardKPIs;
        if (kpiData.materias && kpiData.materias[materiaId]) {
          rankings.push({
            userId: userDoc.id,
            score: kpiData.materias[materiaId].scoreMateria
          });
        }
      }
    }
    
    return rankings.sort((a, b) => b.score - a.score);
  }

  private async updateWeeklyPositionHistory(
    userId: string, 
    materiaId: string, 
    nuevaPosicion: number, 
    scoreTotal: number
  ): Promise<void> {
    const kpiRef = doc(db, 'users', userId, 'kpis', 'dashboard');
    const kpiDoc = await getDoc(kpiRef);
    
    if (!kpiDoc.exists()) return;
    
    const currentData = kpiDoc.data() as DashboardKPIs;
    
    if (!currentData.historicosPosiciones) {
      currentData.historicosPosiciones = {};
    }
    
    if (!currentData.historicosPosiciones[materiaId]) {
      currentData.historicosPosiciones[materiaId] = [];
    }
    
    const historico = currentData.historicosPosiciones[materiaId];
    const now = new Date();
    const weekNumber = this.getWeekNumber(now);
    const weekString = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    
    const lastEntry = historico[historico.length - 1];
    const cambioVsAnterior = lastEntry ? nuevaPosicion - lastEntry.posicion : 0;
    
    // Verificar si ya existe una entrada para esta semana
    const existingWeekIndex = historico.findIndex(h => h.semana === weekString);
    
    if (existingWeekIndex >= 0) {
      // Actualizar entrada existente
      historico[existingWeekIndex] = {
        semana: weekString,
        fechaInicio: this.getWeekStart(now),
        fechaFin: this.getWeekEnd(now),
        posicion: nuevaPosicion,
        scoreTotal,
        totalAlumnos: currentData.materias![materiaId].totalAlumnosMateria,
        cambioVsSemanaAnterior: cambioVsAnterior
      };
    } else {
      // Agregar nueva entrada
      historico.push({
        semana: weekString,
        fechaInicio: this.getWeekStart(now),
        fechaFin: this.getWeekEnd(now),
        posicion: nuevaPosicion,
        scoreTotal,
        totalAlumnos: currentData.materias![materiaId].totalAlumnosMateria,
        cambioVsSemanaAnterior: cambioVsAnterior
      });
    }
    
    // Mantener solo las últimas 12 semanas
    if (historico.length > 12) {
      currentData.historicosPosiciones[materiaId] = historico.slice(-12);
    }
    
    await updateDoc(kpiRef, currentData);
  }

  // Funciones de utilidad para fechas
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  private getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekEnd;
  }

  // Obtener tabla de posicionamiento general
  async getGeneralRankingTable(materiaId?: string, limit: number = 50): Promise<any[]> {
    const rankings: any[] = [];
    
    if (materiaId) {
      // Ranking por materia
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const kpiDoc = await getDoc(doc(db, 'users', userDoc.id, 'kpis', 'dashboard'));
        
        if (kpiDoc.exists()) {
          const kpiData = kpiDoc.data() as DashboardKPIs;
          if (kpiData.materias && kpiData.materias[materiaId]) {
            rankings.push({
              userId: userDoc.id,
              nombreAlumno: userData.displayName || userData.nombre || 'Sin nombre',
              scoreTotal: kpiData.materias[materiaId].scoreMateria,
              tiempoEstudioTotal: kpiData.materias[materiaId].tiempoEstudioMateria,
              estudiosInteligentesTotales: kpiData.materias[materiaId].estudiosInteligentesMateria
            });
          }
        }
      }
    } else {
      // Ranking global
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const kpiDoc = await getDoc(doc(db, 'users', userDoc.id, 'kpis', 'dashboard'));
        
        if (kpiDoc.exists()) {
          const kpiData = kpiDoc.data() as DashboardKPIs;
          rankings.push({
            userId: userDoc.id,
            nombreAlumno: userData.displayName || userData.nombre || 'Sin nombre',
            scoreTotal: kpiData.global.scoreGlobal,
            tiempoEstudioTotal: kpiData.global.tiempoEstudioGlobal,
            estudiosInteligentesTotales: kpiData.global.estudiosInteligentesGlobal
          });
        }
      }
    }
    
    // Ordenar por score y asignar posiciones
    rankings.sort((a, b) => b.scoreTotal - a.scoreTotal);
    
    rankings.forEach((ranking, index) => {
      ranking.posicion = index + 1;
      ranking.cambioVsAnterior = 0; // Por ahora dummy
    });
    
    return rankings.slice(0, limit);
  }
}

// Exportar instancia singleton
export const kpiService = KPIService.getInstance();