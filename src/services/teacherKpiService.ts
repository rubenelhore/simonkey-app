import { db } from '../firebase/config';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  increment,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';

// Interfaces para las métricas del profesor
export interface TeacherMetrics {
  // Métricas globales (promedio de todas las materias)
  global: {
    porcentajeDominioConceptos: number; // Promedio del % de dominio de todos los alumnos
    tiempoEfectivo: number; // Tiempo promedio por alumno por estudio de concepto (en minutos)
    tiempoActivo: number; // Tiempo promedio por alumno por semana (en minutos)
    estudioPromedio: number; // Número de estudios inteligentes por alumno por semana
    scorePromedio: number; // Score promedio de todos los alumnos
    totalAlumnos: number; // Total de alumnos del profesor
    totalMaterias: number; // Total de materias que imparte
    totalCuadernos: number; // Total de cuadernos asignados
    ultimaActualizacion: Timestamp;
  };
  
  // Métricas por materia
  materias: {
    [materiaId: string]: {
      nombreMateria: string;
      porcentajeDominioConceptos: number;
      tiempoEfectivo: number;
      tiempoActivo: number;
      estudioPromedio: number;
      scorePromedio: number;
      totalAlumnos: number;
      totalCuadernos: number;
    };
  };
  
  // Métricas por cuaderno
  cuadernos: {
    [cuadernoId: string]: {
      nombreCuaderno: string;
      materiaId: string;
      scorePromedio: number;
      porcentajeDominioConceptos: number;
      tiempoEfectivo: number;
      tiempoActivo: number;
      estudioPromedio: number;
      totalAlumnos: number;
      conceptosDominados: number;
      conceptosTotales: number;
    };
  };
  
  // Tiempo de estudio semanal (agregado por día)
  tiempoEstudioSemanal: {
    lunes: number;
    martes: number;
    miercoles: number;
    jueves: number;
    viernes: number;
    sabado: number;
    domingo: number;
  };
}

export interface StudentMetricsForTeacher {
  studentId: string;
  studentName: string;
  materiaId: string;
  cuadernoId: string;
  porcentajeDominioConceptos: number;
  tiempoEfectivo: number;
  tiempoActivo: number;
  estudiosInteligentes: number;
  score: number;
  ultimoEstudio: Timestamp;
}

class TeacherKpiService {
  private readonly COLLECTION_NAME = 'teacherKpis';

  // Inicializar métricas del profesor
  async initializeTeacherMetrics(teacherId: string): Promise<void> {
    const metricsRef = doc(db, this.COLLECTION_NAME, teacherId);
    
    const initialMetrics: TeacherMetrics = {
      global: {
        porcentajeDominioConceptos: 0,
        tiempoEfectivo: 0,
        tiempoActivo: 0,
        estudioPromedio: 0,
        scorePromedio: 0,
        totalAlumnos: 0,
        totalMaterias: 0,
        totalCuadernos: 0,
        ultimaActualizacion: serverTimestamp() as Timestamp
      },
      materias: {},
      cuadernos: {},
      tiempoEstudioSemanal: {
        lunes: 0,
        martes: 0,
        miercoles: 0,
        jueves: 0,
        viernes: 0,
        sabado: 0,
        domingo: 0
      }
    };

    await setDoc(metricsRef, initialMetrics);
  }

  // Obtener métricas del profesor
  async getTeacherMetrics(teacherId: string): Promise<TeacherMetrics | null> {
    const metricsRef = doc(db, this.COLLECTION_NAME, teacherId);
    const metricsDoc = await getDoc(metricsRef);
    
    if (!metricsDoc.exists()) {
      await this.initializeTeacherMetrics(teacherId);
      return null;
    }
    
    return metricsDoc.data() as TeacherMetrics;
  }

  // Calcular y actualizar métricas del profesor
  async updateTeacherMetrics(teacherId: string): Promise<void> {
    try {
      // 1. Obtener todos los alumnos del profesor
      const studentsData = await this.getTeacherStudents(teacherId);
      
      // 2. Obtener métricas de cada alumno
      const studentMetrics = await this.calculateStudentMetrics(studentsData);
      
      // 3. Agregar métricas por materia y cuaderno
      const aggregatedMetrics = this.aggregateMetrics(studentMetrics);
      
      // 4. Calcular tiempo de estudio semanal
      const weeklyStudyTime = await this.calculateWeeklyStudyTime(studentsData.map(s => s.id));
      
      // 5. Actualizar en Firestore
      const metricsRef = doc(db, this.COLLECTION_NAME, teacherId);
      await setDoc(metricsRef, {
        ...aggregatedMetrics,
        tiempoEstudioSemanal: weeklyStudyTime,
        global: {
          ...aggregatedMetrics.global,
          ultimaActualizacion: serverTimestamp()
        }
      }, { merge: true });
      
    } catch (error) {
      console.error('Error actualizando métricas del profesor:', error);
      throw error;
    }
  }

  // Obtener estudiantes del profesor
  private async getTeacherStudents(teacherId: string): Promise<any[]> {
    // TODO: Implementar query real para obtener estudiantes del profesor
    // Por ahora retornamos array vacío
    return [];
  }

  // Calcular métricas de estudiantes
  private async calculateStudentMetrics(students: any[]): Promise<StudentMetricsForTeacher[]> {
    const metrics: StudentMetricsForTeacher[] = [];
    
    for (const student of students) {
      // Obtener KPIs del estudiante
      const kpisRef = doc(db, 'users', student.id, 'kpis', 'dashboard');
      const kpisDoc = await getDoc(kpisRef);
      
      if (kpisDoc.exists()) {
        const kpis = kpisDoc.data();
        
        // Procesar métricas por cuaderno
        for (const [cuadernoId, cuadernoData] of Object.entries(kpis.cuadernos || {})) {
          const cuaderno = cuadernoData as any;
          
          metrics.push({
            studentId: student.id,
            studentName: student.name || 'Sin nombre',
            materiaId: cuaderno.materiaId || 'sin-materia',
            cuadernoId: cuadernoId,
            porcentajeDominioConceptos: cuaderno.porcentajeDominioConceptos || 0,
            tiempoEfectivo: this.calculateEffectiveTime(cuaderno),
            tiempoActivo: cuaderno.tiempoEstudioLocal || 0,
            estudiosInteligentes: cuaderno.estudiosInteligentesLocal || 0,
            score: cuaderno.scoreCuaderno || 0,
            ultimoEstudio: cuaderno.ultimaActualizacion || Timestamp.now()
          });
        }
      }
    }
    
    return metrics;
  }

  // Calcular tiempo efectivo (tiempo promedio por concepto)
  private calculateEffectiveTime(cuadernoData: any): number {
    const tiempoTotal = cuadernoData.tiempoEstudioLocal || 0;
    const conceptosEstudiados = (cuadernoData.conceptosDominados || 0) + (cuadernoData.conceptosNoDominados || 0);
    
    return conceptosEstudiados > 0 ? tiempoTotal / conceptosEstudiados : 0;
  }

  // Agregar métricas
  private aggregateMetrics(studentMetrics: StudentMetricsForTeacher[]): Omit<TeacherMetrics, 'tiempoEstudioSemanal'> {
    const materias: { [key: string]: any } = {};
    const cuadernos: { [key: string]: any } = {};
    
    // Agrupar por materia y cuaderno
    studentMetrics.forEach(metric => {
      // Agregar por materia
      if (!materias[metric.materiaId]) {
        materias[metric.materiaId] = {
          nombreMateria: metric.materiaId, // TODO: Obtener nombre real
          metrics: [],
          cuadernos: new Set()
        };
      }
      materias[metric.materiaId].metrics.push(metric);
      materias[metric.materiaId].cuadernos.add(metric.cuadernoId);
      
      // Agregar por cuaderno
      if (!cuadernos[metric.cuadernoId]) {
        cuadernos[metric.cuadernoId] = {
          nombreCuaderno: metric.cuadernoId, // TODO: Obtener nombre real
          materiaId: metric.materiaId,
          metrics: []
        };
      }
      cuadernos[metric.cuadernoId].metrics.push(metric);
    });
    
    // Calcular promedios por materia
    const materiasMetrics: { [key: string]: any } = {};
    for (const [materiaId, data] of Object.entries(materias)) {
      const metrics = data.metrics;
      materiasMetrics[materiaId] = {
        nombreMateria: data.nombreMateria,
        porcentajeDominioConceptos: this.average(metrics.map((m: any) => m.porcentajeDominioConceptos)),
        tiempoEfectivo: this.average(metrics.map((m: any) => m.tiempoEfectivo)),
        tiempoActivo: this.average(metrics.map((m: any) => m.tiempoActivo)),
        estudioPromedio: this.average(metrics.map((m: any) => m.estudiosInteligentes)),
        scorePromedio: this.average(metrics.map((m: any) => m.score)),
        totalAlumnos: new Set(metrics.map((m: any) => m.studentId)).size,
        totalCuadernos: data.cuadernos.size
      };
    }
    
    // Calcular promedios por cuaderno
    const cuadernosMetrics: { [key: string]: any } = {};
    for (const [cuadernoId, data] of Object.entries(cuadernos)) {
      const metrics = data.metrics;
      cuadernosMetrics[cuadernoId] = {
        nombreCuaderno: data.nombreCuaderno,
        materiaId: data.materiaId,
        scorePromedio: this.average(metrics.map((m: any) => m.score)),
        porcentajeDominioConceptos: this.average(metrics.map((m: any) => m.porcentajeDominioConceptos)),
        tiempoEfectivo: this.average(metrics.map((m: any) => m.tiempoEfectivo)),
        tiempoActivo: this.average(metrics.map((m: any) => m.tiempoActivo)),
        estudioPromedio: this.average(metrics.map((m: any) => m.estudiosInteligentes)),
        totalAlumnos: new Set(metrics.map((m: any) => m.studentId)).size,
        conceptosDominados: 0, // TODO: Calcular desde datos reales
        conceptosTotales: 0 // TODO: Calcular desde datos reales
      };
    }
    
    // Calcular métricas globales
    const allMetrics = studentMetrics;
    const global = {
      porcentajeDominioConceptos: this.average(allMetrics.map(m => m.porcentajeDominioConceptos)),
      tiempoEfectivo: this.average(allMetrics.map(m => m.tiempoEfectivo)),
      tiempoActivo: this.average(allMetrics.map(m => m.tiempoActivo)),
      estudioPromedio: this.average(allMetrics.map(m => m.estudiosInteligentes)),
      scorePromedio: this.average(allMetrics.map(m => m.score)),
      totalAlumnos: new Set(allMetrics.map(m => m.studentId)).size,
      totalMaterias: Object.keys(materiasMetrics).length,
      totalCuadernos: Object.keys(cuadernosMetrics).length,
      ultimaActualizacion: serverTimestamp() as Timestamp
    };
    
    return {
      global,
      materias: materiasMetrics,
      cuadernos: cuadernosMetrics
    };
  }

  // Calcular tiempo de estudio semanal
  private async calculateWeeklyStudyTime(studentIds: string[]): Promise<TeacherMetrics['tiempoEstudioSemanal']> {
    const weeklyTime = {
      lunes: 0,
      martes: 0,
      miercoles: 0,
      jueves: 0,
      viernes: 0,
      sabado: 0,
      domingo: 0
    };
    
    const dayMap: { [key: number]: keyof typeof weeklyTime } = {
      1: 'lunes',
      2: 'martes',
      3: 'miercoles',
      4: 'jueves',
      5: 'viernes',
      6: 'sabado',
      0: 'domingo'
    };
    
    // Obtener sesiones de estudio de la última semana
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    for (const studentId of studentIds) {
      const sessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', studentId),
        where('startTime', '>=', Timestamp.fromDate(oneWeekAgo))
      );
      
      const sessionsSnapshot = await getDocs(sessionsQuery);
      
      sessionsSnapshot.forEach(doc => {
        const session = doc.data();
        const startTime = session.startTime.toDate();
        const dayOfWeek = startTime.getDay();
        const duration = session.duration || 0;
        
        weeklyTime[dayMap[dayOfWeek]] += duration;
      });
    }
    
    return weeklyTime;
  }

  // Función auxiliar para calcular promedio
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  // Actualizar métricas después de que un estudiante complete un estudio
  async updateAfterStudentStudy(
    teacherId: string, 
    studentId: string, 
    cuadernoId: string,
    materiaId: string,
    studyData: {
      duration: number;
      isSmartStudy: boolean;
      conceptsDominated: number;
      score: number;
    }
  ): Promise<void> {
    // Esta función se llamaría después de cada estudio para actualizar incrementalmente
    // las métricas del profesor sin tener que recalcular todo
    
    const batch = writeBatch(db);
    const metricsRef = doc(db, this.COLLECTION_NAME, teacherId);
    
    // Actualizar tiempo de estudio semanal
    const dayOfWeek = new Date().getDay();
    const dayMap: { [key: number]: string } = {
      1: 'lunes',
      2: 'martes',
      3: 'miercoles',
      4: 'jueves',
      5: 'viernes',
      6: 'sabado',
      0: 'domingo'
    };
    
    batch.update(metricsRef, {
      [`tiempoEstudioSemanal.${dayMap[dayOfWeek]}`]: increment(studyData.duration),
      'global.ultimaActualizacion': serverTimestamp()
    });
    
    await batch.commit();
    
    // Programar actualización completa de métricas (puede ser asíncrona)
    this.scheduleFullMetricsUpdate(teacherId);
  }

  // Programar actualización completa de métricas
  private scheduleFullMetricsUpdate(teacherId: string): void {
    // Implementar lógica de debounce para no actualizar muy frecuentemente
    // Por ahora, actualizar inmediatamente
    setTimeout(() => {
      this.updateTeacherMetrics(teacherId);
    }, 5000); // Esperar 5 segundos para agrupar posibles actualizaciones
  }
}

export const teacherKpiService = new TeacherKpiService();