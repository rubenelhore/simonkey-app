export interface GlobalKPIs {
  // KPIs Globales
  scoreGlobal: number;
  percentilPromedioGlobal: number;
  tiempoEstudioGlobal: number; // en minutos
  estudiosInteligentesGlobal: number;
  
  // Metadatos
  ultimaActualizacion: Date;
  totalCuadernos: number;
  totalMaterias: number;
}

export interface KPIsPorMateria {
  materiaId: string;
  materiaNombre: string;
  scoreMateria: number;
  percentilMateria: number;
  tiempoEstudioMateria: number; // en minutos
  estudiosInteligentesMateria: number;
  cuadernosIds: string[];
  posicionRanking: number;
  totalAlumnosMateria: number;
}

export interface KPIsPorCuaderno {
  cuadernoId: string;
  cuadernoTitulo: string;
  materiaId?: string;
  scoreCuaderno: number;
  posicionRanking: number;
  totalAlumnosCuaderno: number;
  percentilCuaderno: number;
  numeroConceptos: number;
  tiempoEstudioLocal: number; // en minutos
  estudiosInteligentesLocal: number;
  estudiosLibresLocal: number;
  
  // Métricas de éxito
  estudiosInteligentesExitosos: number;
  estudiosInteligentesTotales: number;
  porcentajeExitoEstudiosInteligentes: number;
  
  // Dominio de conceptos
  conceptosDominados: number;
  conceptosNoDominados: number;
  porcentajeDominioConceptos: number;
  
  // Desglose por tipo de sesión
  tiempoQuiz: number;
  tiempoEstudioInteligente: number;
  tiempoEstudioLibre: number;
}

export interface HistogramaTiempoEstudio {
  dia: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
  tiempoTotal: number; // en minutos
  sesionesQuiz: number;
  sesionesEstudioInteligente: number;
  sesionesEstudioLibre: number;
}

export interface PosicionHistorica {
  semana: string; // formato: "2024-W01"
  fechaInicio: Date;
  fechaFin: Date;
  posicion: number;
  scoreTotal: number;
  totalAlumnos: number;
  cambioVsSemanaAnterior: number; // positivo = subió, negativo = bajó
}

export interface TablaPosicionamiento {
  actualizadoEn: Date;
  posiciones: {
    userId: string;
    nombreAlumno: string;
    scoreTotal: number;
    posicion: number;
    cambioVsAnterior: number;
    tiempoEstudioTotal: number;
    estudiosInteligentesTotales: number;
  }[];
}

// Estructura completa del dashboard
export interface DashboardKPIs {
  userId: string;
  tipoUsuario: 'pro' | 'free' | 'school-student' | 'school-teacher';
  
  // KPIs Globales
  global: GlobalKPIs;
  
  // KPIs por Materia (solo para usuarios escolares)
  materias?: {
    [materiaId: string]: KPIsPorMateria;
  };
  
  // KPIs por Cuaderno
  cuadernos: {
    [cuadernoId: string]: KPIsPorCuaderno;
  };
  
  // Histogramas
  histogramaSemanal: HistogramaTiempoEstudio[];
  
  // Histórico de posiciones (por materia)
  historicosPosiciones?: {
    [materiaId: string]: PosicionHistorica[];
  };
  
  // Metadatos
  createdAt: Date;
  updatedAt: Date;
}

// Interfaces para eventos de actualización
export interface EventoEstudioInteligente {
  cuadernoId: string;
  materiaId?: string;
  duracion: number;
  exitoso: boolean;
  conceptosEstudiados: number;
  conceptosDominados: number;
  conceptosNoDominados: number;
  timestamp: Date;
}

export interface EventoEstudioLibre {
  cuadernoId: string;
  materiaId?: string;
  duracion: number;
  conceptosRepasados: number;
  timestamp: Date;
}

export interface EventoQuiz {
  cuadernoId: string;
  materiaId?: string;
  duracion: number;
  score: number;
  accuracy: number;
  timestamp: Date;
}