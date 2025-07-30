import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronDown, 
  faTrophy, 
  faClock, 
  faBrain, 
  faBullseye, 
  faChartLine,
  faCalendarAlt,
  faBook,
  faLightbulb,
  faArrowUp,
  faArrowDown,
  faSpinner,
  faUserGraduate
} from '@fortawesome/free-solid-svg-icons';
import { kpiService } from '../services/kpiService';
import { rankingService } from '../services/rankingService';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { getPositionHistory } from '../utils/createPositionHistory';
import ChartLoadingPlaceholder from '../components/Charts/ChartLoadingPlaceholder';
import '../styles/ProgressPage.css';
import '../styles/SchoolSystem.css';

// Lazy load de los componentes de gráficos
const PositionHistoryChart = lazy(() => import('../components/Charts/PositionHistoryChart'));
const WeeklyStudyChart = lazy(() => import('../components/Charts/WeeklyStudyChart'));

interface SchoolStudent {
  id: string;
  nombre: string;
  email: string;
  idTutor?: string;
}

interface Materia {
  id: string;
  nombre: string;
}

interface PositionData {
  semana: string;
  posicion: number;
}

interface StudyTimeData {
  dia: string;
  tiempo: number;
}

interface CuadernoData {
  id: string;
  nombre: string;
  score: number;
  posicion: number;
  totalAlumnos: number;
  conceptos: number;
  tiempoEstudio: number;
  estudiosInteligentes: number;
  porcentajeExito: number;
  porcentajeDominio: number;
  estudiosLibres: number;
  juegosJugados: number;
}

const SchoolTutorPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { isSchoolTutor } = useUserType();
  
  // Estados del selector de estudiante (nuevo para tutor)
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  
  // Estados idénticos a ProgressPage
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const [showMateriaDropdown, setShowMateriaDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kpisData, setKpisData] = useState<any>(null);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [cuadernosReales, setCuadernosReales] = useState<CuadernoData[]>([]);
  const [progress, setProgress] = useState(0);
  const [effectiveUserId, setEffectiveUserId] = useState<string>('');
  const [rankingData, setRankingData] = useState<Array<{posicion: number, nombre: string, score: number}>>([]);
  const [positionHistoryData, setPositionHistoryData] = useState<PositionData[]>([]);
  const [studyTimeData, setStudyTimeData] = useState<StudyTimeData[]>([]);

  // Cargar lista de estudiantes vinculados al tutor
  useEffect(() => {
    const loadStudents = async () => {
      if (!user || !userProfile || !isSchoolTutor) return;

      try {
        setLoadingStudents(true);
        const tutorId = userProfile.id || user.uid;
        console.log('🔍 Buscando estudiantes del tutor:', tutorId);
        
        // Obtener el documento del tutor para acceder a idAlumnos
        const tutorDoc = await getDoc(doc(db, 'users', tutorId));
        
        if (!tutorDoc.exists()) {
          console.error('No se encontró el documento del tutor');
          setStudents([]);
          return;
        }
        
        const tutorData = tutorDoc.data();
        const studentIds = tutorData.idAlumnos || [];
        console.log('📚 IDs de estudiantes asignados:', studentIds);
        
        if (studentIds.length === 0) {
          console.log('No hay estudiantes asignados a este tutor');
          setStudents([]);
          return;
        }
        
        // Buscar los documentos de cada estudiante
        const studentsData: SchoolStudent[] = [];
        for (const studentId of studentIds) {
          const studentDoc = await getDoc(doc(db, 'users', studentId));
          if (studentDoc.exists()) {
            const data = studentDoc.data();
            studentsData.push({
              id: studentDoc.id,
              nombre: data.nombre || data.displayName || '',
              email: data.email || '',
              idTutor: tutorId
            });
          }
        }

        console.log('👥 Estudiantes encontrados:', studentsData);
        setStudents(studentsData);
        
        // Seleccionar el primer estudiante por defecto
        if (studentsData.length > 0 && !selectedStudent) {
          setSelectedStudent(studentsData[0].id);
        }
      } catch (error) {
        console.error('Error loading students:', error);
      } finally {
        setLoadingStudents(false);
      }
    };

    loadStudents();
  }, [user, userProfile, isSchoolTutor]);

  // Cargar datos del estudiante seleccionado cuando cambie
  useEffect(() => {
    if (selectedStudent) {
      loadAllData();
    }
  }, [selectedStudent]);

  // Actualizar cuadernos cuando cambie la materia seleccionada
  useEffect(() => {
    if (kpisData && selectedMateria) {
      processCuadernosData();
    }
  }, [selectedMateria, kpisData]);

  // Calcular ranking cuando cambien los cuadernos o la materia
  useEffect(() => {
    if (kpisData && cuadernosReales.length > 0) {
      calculateRanking();
      calculatePositionHistory();
      calculateWeeklyStudyTime();
    }
  }, [cuadernosReales, selectedMateria]);

  // Barra de progreso
  useEffect(() => {
    if (loading && !kpisData) {
      setProgress(0);
      let current = 0;
      const interval = setInterval(() => {
        current += Math.random() * 0.5 + 0.7;
        if (current >= 100) {
          current = 100;
          clearInterval(interval);
        }
        setProgress(current);
      }, 16);
      return () => clearInterval(interval);
    }
  }, [loading, kpisData]);

  const loadAllData = async () => {
    if (!selectedStudent) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      console.log('[TutorPage] Cargando datos para estudiante:', selectedStudent);
      
      // Cargar KPIs del estudiante seleccionado
      const kpis = await loadKPIsData(selectedStudent);
      if (kpis) {
        setKpisData(kpis);
        // Cargar materias inmediatamente después de KPIs
        await loadMaterias(selectedStudent, true, kpis); // true porque siempre son estudiantes escolares
      }
      
    } catch (error) {
      console.error('[TutorPage] Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKPIsData = async (userId: string) => {
    try {
      console.log('[TutorPage] Cargando KPIs para estudiante:', userId);
      
      // Obtener KPIs del estudiante
      let kpis = await kpiService.getUserKPIs(userId);
      
      // Solo actualizar si no hay KPIs o si son muy antiguos (más de 1 hora)
      const shouldUpdate = !kpis || !kpis.ultimaActualizacion || 
        (Date.now() - (kpis.ultimaActualizacion?.toDate?.()?.getTime() || 0)) > 3600000;
      
      if (shouldUpdate) {
        console.log('[TutorPage] Actualizando KPIs del estudiante...');
        await kpiService.updateUserKPIs(userId);
        kpis = await kpiService.getUserKPIs(userId);
      } else {
        console.log('[TutorPage] Usando KPIs existentes del estudiante');
      }
      
      console.log('[TutorPage] KPIs obtenidos:', kpis);
      return kpis;
      
    } catch (error) {
      console.error('[TutorPage] Error cargando KPIs:', error);
      return null;
    }
  };

  const loadMaterias = async (userId: string, isSchoolUser: boolean, kpis: any) => {
    try {
      console.log('[TutorPage] Cargando materias del estudiante:', userId);
      
      const materiasArray: Materia[] = [];
      
      if (isSchoolUser && kpis?.materias) {
        // Para estudiantes escolares, usar las materias de los KPIs
        console.log('[TutorPage] Extrayendo materias de KPIs del estudiante');
        
        const materiaIds = Object.keys(kpis.materias);
        
        // Cargar documentos de materias
        const materiaPromises = materiaIds.map(materiaId => 
          getDoc(doc(db, 'schoolSubjects', materiaId))
        );
        
        const materiaDocs = await Promise.all(materiaPromises);
        
        materiaDocs.forEach((subjectDoc, index) => {
          const materiaId = materiaIds[index];
          let nombreMateria = 'Sin nombre';
          
          if (subjectDoc.exists()) {
            const subjectData = subjectDoc.data();
            nombreMateria = subjectData.nombre || subjectData.name || 'Sin nombre';
          }
          
          materiasArray.push({
            id: materiaId,
            nombre: nombreMateria
          });
        });
        console.log('[TutorPage] Materias del estudiante:', materiasArray);
      }
      
      // Si no se encontraron materias pero hay cuadernos en los KPIs, crear opción general
      if (materiasArray.length === 0 && kpis?.cuadernos && Object.keys(kpis.cuadernos).length > 0) {
        console.log('[TutorPage] Creando opción general para cuadernos del estudiante');
        materiasArray.push({
          id: 'general',
          nombre: 'Todos los Cuadernos'
        });
      }
      
      console.log('[TutorPage] Materias finales del estudiante:', materiasArray);
      setMaterias(materiasArray);
      
      // Seleccionar la primera materia por defecto
      if (materiasArray.length > 0 && !selectedMateria) {
        setSelectedMateria(materiasArray[0].id);
      }
    } catch (error) {
      console.error('[TutorPage] Error cargando materias:', error);
    }
  };

  const processCuadernosData = async () => {
    if (!selectedStudent || !kpisData) return;
    
    console.log('[TutorPage] Procesando cuadernos del estudiante:', selectedStudent);
    
    try {
      const cuadernosTemp: CuadernoData[] = [];
      
      // Obtener información adicional de los cuadernos
      const notebookNames = new Map<string, string>();
      const notebookMaterias = new Map<string, string>();
      
      // Para estudiantes escolares, obtener nombres de schoolNotebooks
      const userDoc = await getDoc(doc(db, 'users', selectedStudent));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const idCuadernos = userData.idCuadernos || [];
        
        for (const cuadernoId of idCuadernos) {
          const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', cuadernoId));
          if (notebookDoc.exists()) {
            const notebookData = notebookDoc.data();
            notebookNames.set(cuadernoId, notebookData.title || 'Sin nombre');
            notebookMaterias.set(cuadernoId, notebookData.idMateria || '');
          }
        }
      }
      
      if (!selectedMateria || selectedMateria === 'general') {
        // Mostrar todos los cuadernos
        Object.entries(kpisData.cuadernos || {}).forEach(([cuadernoId, cuadernoData]: [string, any]) => {
          const nombreCuaderno = notebookNames.get(cuadernoId) || cuadernoData.nombreCuaderno || 'Sin nombre';
          
          cuadernosTemp.push({
            id: cuadernoId,
            nombre: nombreCuaderno,
            score: cuadernoData.scoreCuaderno || 0,
            posicion: cuadernoData.posicionRanking || 1,
            totalAlumnos: cuadernoData.totalAlumnos || 1,
            conceptos: cuadernoData.numeroConceptos || 0,
            tiempoEstudio: cuadernoData.tiempoEstudioLocal || 0,
            estudiosInteligentes: cuadernoData.estudiosInteligentesLocal || 0,
            porcentajeExito: cuadernoData.porcentajeExitoEstudiosInteligentes || 0,
            porcentajeDominio: cuadernoData.porcentajeDominioConceptos || 0,
            estudiosLibres: cuadernoData.estudiosLibresLocal || 0,
            juegosJugados: cuadernoData.juegosJugados || 0
          });
        });
      } else {
        // Filtrar por materia seleccionada
        Object.entries(kpisData.cuadernos || {}).forEach(([cuadernoId, cuadernoData]: [string, any]) => {
          const cuadernoMateria = notebookMaterias.get(cuadernoId) || cuadernoData.idMateria || '';
          
          if (cuadernoMateria === selectedMateria) {
            const nombreCuaderno = notebookNames.get(cuadernoId) || cuadernoData.nombreCuaderno || 'Sin nombre';
            
            cuadernosTemp.push({
              id: cuadernoId,
              nombre: nombreCuaderno,
              score: cuadernoData.scoreCuaderno || 0,
              posicion: cuadernoData.posicionRanking || 1,
              totalAlumnos: cuadernoData.totalAlumnos || 1,
              conceptos: cuadernoData.numeroConceptos || 0,
              tiempoEstudio: cuadernoData.tiempoEstudioLocal || 0,
              estudiosInteligentes: cuadernoData.estudiosInteligentesLocal || 0,
              porcentajeExito: cuadernoData.porcentajeExitoEstudiosInteligentes || 0,
              porcentajeDominio: cuadernoData.porcentajeDominioConceptos || 0,
              estudiosLibres: cuadernoData.estudiosLibresLocal || 0,
              juegosJugados: cuadernoData.juegosJugados || 0
            });
          }
        });
      }
      
      console.log('[TutorPage] Cuadernos procesados del estudiante:', cuadernosTemp.length);
      setCuadernosReales(cuadernosTemp);
    } catch (error) {
      console.error('[TutorPage] Error procesando cuadernos:', error);
      setCuadernosReales([]);
    }
  };

  const calculateRanking = async () => {
    if (!selectedStudent || !kpisData) return;

    try {
      console.log('[TutorPage] Calculando ranking para estudiante:', selectedStudent);
      
      // Obtener el documento del estudiante para tener la institución
      const userDoc = await getDoc(doc(db, 'users', selectedStudent));
      if (!userDoc.exists()) {
        console.log('[TutorPage] Estudiante no encontrado');
        setRankingData([]);
        return;
      }

      const userData = userDoc.data();
      const institutionId = userData.idInstitucion;
      
      if (!institutionId) {
        console.log('[TutorPage] Estudiante sin institución');
        setRankingData([]);
        return;
      }

      // Si no hay materia seleccionada o es general, no mostrar ranking
      if (!selectedMateria || selectedMateria === 'general') {
        console.log('[TutorPage] No hay ranking global disponible');
        setRankingData([]);
        return;
      }

      // Obtener el ranking pre-calculado de la materia
      const ranking = await rankingService.getSubjectRanking(institutionId, selectedMateria);
      
      if (!ranking) {
        console.log('[TutorPage] No se encontró ranking pre-calculado');
        const userScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
        setRankingData([{ 
          posicion: 1, 
          nombre: 'Este estudiante', 
          score: userScore 
        }]);
        return;
      }

      console.log('[TutorPage] Ranking pre-calculado encontrado:', ranking);

      // Convertir el ranking a formato para mostrar
      const rankingToShow = [];
      
      // Tomar los primeros 10 estudiantes
      const top10 = ranking.students.slice(0, 10);
      
      for (const student of top10) {
        rankingToShow.push({
          posicion: student.position,
          nombre: student.studentId === selectedStudent ? 'Este estudiante' : student.name,
          score: student.score
        });
      }

      // Si el estudiante no está en el top 10, buscarlo y agregarlo al final
      const userPosition = rankingService.getStudentPosition(ranking, selectedStudent);
      
      if (userPosition && userPosition > 10) {
        const userInRanking = ranking.students.find(s => s.studentId === selectedStudent);
        if (userInRanking) {
          rankingToShow.push({
            posicion: userPosition,
            nombre: 'Este estudiante',
            score: userInRanking.score
          });
        }
      }

      // Si no hay estudiantes en el ranking, mostrar el estudiante actual
      if (rankingToShow.length === 0) {
        const userScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
        if (userScore > 0) {
          rankingToShow.push({ 
            posicion: 1, 
            nombre: 'Este estudiante', 
            score: userScore 
          });
        }
      }

      console.log('[TutorPage] Ranking a mostrar:', rankingToShow);
      setRankingData(rankingToShow);
      
    } catch (error) {
      console.error('[TutorPage] Error calculando ranking:', error);
      setRankingData([]);
    }
  };

  const calculatePositionHistory = async () => {
    if (!selectedStudent || !kpisData || !selectedMateria) return;

    try {
      console.log('[TutorPage] Calculando historial de posiciones del estudiante');
      
      // Si hay datos de materia, buscar historial real
      if (selectedMateria && selectedMateria !== 'general') {
        const history = await getPositionHistory(selectedStudent, selectedMateria, 8);
        
        if (history && history.length > 0) {
          console.log('[TutorPage] Historial real encontrado:', history);
          const historyData = history.map(h => ({
            semana: h.semana,
            posicion: h.posicion
          }));
          setPositionHistoryData(historyData);
          return;
        }
        
        console.log('[TutorPage] No hay historial real, generando datos...');
      }
      
      // Generar datos por defecto
      const weeksData: PositionData[] = [];
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      
      // Obtener posición actual
      let currentPosition = 1;
      
      if (selectedMateria && selectedMateria !== 'general') {
        const materiaKpis = kpisData.materias?.[selectedMateria];
        if (materiaKpis) {
          const userDoc = await getDoc(doc(db, 'users', selectedStudent));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const institutionId = userData.idInstitucion;
            
            if (institutionId) {
              const ranking = await rankingService.getSubjectRanking(institutionId, selectedMateria);
              if (ranking) {
                const userPosition = rankingService.getStudentPosition(ranking, selectedStudent);
                if (userPosition) {
                  currentPosition = userPosition;
                }
              }
            }
          }
        }
      }
      
      // Mostrar posición actual constante
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        
        const day = weekStart.getDate().toString().padStart(2, '0');
        const month = (weekStart.getMonth() + 1).toString().padStart(2, '0');
        const weekLabel = `${day}/${month}`;
        
        weeksData.push({
          semana: weekLabel,
          posicion: currentPosition
        });
      }
      
      console.log('[TutorPage] Historial generado:', weeksData);
      setPositionHistoryData(weeksData);
      
    } catch (error) {
      console.error('[TutorPage] Error calculando historial de posiciones:', error);
      // En caso de error, mostrar posición 1
      const defaultData: PositionData[] = [];
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const day = weekStart.getDate().toString().padStart(2, '0');
        const month = (weekStart.getMonth() + 1).toString().padStart(2, '0');
        
        defaultData.push({
          semana: `${day}/${month}`,
          posicion: 1
        });
      }
      setPositionHistoryData(defaultData);
    }
  };

  const calculateWeeklyStudyTime = async () => {
    if (!selectedStudent || !kpisData) return;
    
    console.log('[TutorPage] Calculando tiempo de estudio semanal del estudiante');

    try {
      const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const chartData: StudyTimeData[] = [];
      
      // Inicializar todos los días con 0
      const weekMapping = {
        'domingo': 0,
        'lunes': 1,
        'martes': 2,
        'miercoles': 3,
        'jueves': 4,
        'viernes': 5,
        'sabado': 6
      };
      
      const studyTimeByDay = new Map<number, number>();
      for (let i = 0; i < 7; i++) {
        studyTimeByDay.set(i, 0);
      }
      
      // Si hay materia seleccionada y no es general, filtrar por materia
      if (selectedMateria && selectedMateria !== 'general') {
        const materiaData = kpisData.materias?.[selectedMateria];
        if (materiaData?.tiempoEstudioSemanal) {
          console.log('[TutorPage] Tiempo de estudio semanal encontrado para materia:', selectedMateria);
          
          Object.entries(materiaData.tiempoEstudioSemanal).forEach(([dia, tiempo]) => {
            const dayIndex = weekMapping[dia as keyof typeof weekMapping];
            if (dayIndex !== undefined && typeof tiempo === 'number') {
              studyTimeByDay.set(dayIndex, tiempo);
            }
          });
        }
      } else {
        // Vista general - usar datos globales si existen
        if (kpisData.tiempoEstudioSemanal) {
          const tiempoSemanal = kpisData.tiempoEstudioSemanal;
          
          studyTimeByDay.set(0, tiempoSemanal.domingo || 0);
          studyTimeByDay.set(1, tiempoSemanal.lunes || 0);
          studyTimeByDay.set(2, tiempoSemanal.martes || 0);
          studyTimeByDay.set(3, tiempoSemanal.miercoles || 0);
          studyTimeByDay.set(4, tiempoSemanal.jueves || 0);
          studyTimeByDay.set(5, tiempoSemanal.viernes || 0);
          studyTimeByDay.set(6, tiempoSemanal.sabado || 0);
        }
      }
      
      // Convertir a formato del gráfico
      for (let i = 0; i < 7; i++) {
        const timeForDay = studyTimeByDay.get(i) || 0;
        chartData.push({
          dia: weekDays[i],
          tiempo: timeForDay
        });
      }
      
      console.log('[TutorPage] Tiempo de estudio por día del estudiante:', chartData);
      setStudyTimeData(chartData);
      
    } catch (error) {
      console.error('[TutorPage] Error calculando tiempo de estudio semanal:', error);
      const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const emptyData = weekDays.map(dia => ({ dia, tiempo: 0 }));
      setStudyTimeData(emptyData);
    }
  };

  // Usar datos reales si están disponibles, si no usar valores por defecto
  const globalScore = kpisData?.global?.scoreGlobal || 0;
  const globalPercentil = kpisData?.global?.percentilPromedioGlobal || 0;
  const globalStudyTime = kpisData?.global?.tiempoEstudioGlobal || 0;
  const globalSmartStudies = kpisData?.global?.estudiosInteligentesGlobal || 0;
  
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Generar insights basados en datos reales del estudiante
  const generateInsights = () => {
    const cuadernosToUse = cuadernosReales.length > 0 ? cuadernosReales : [];
    
    const maxDay = studyTimeData.length > 0 && studyTimeData.some(d => d.tiempo > 0)
      ? studyTimeData.reduce((max, day) => day.tiempo > max.tiempo ? day : max)
      : null;
    
    const worstDominioNotebook = cuadernosToUse.length > 0 
      ? cuadernosToUse.reduce((worst, notebook) => 
          notebook.porcentajeDominio < worst.porcentajeDominio ? notebook : worst
        )
      : null;
    
    const bestSuccessNotebook = cuadernosToUse.length > 0 
      ? cuadernosToUse.reduce((best, notebook) => 
          notebook.porcentajeExito > best.porcentajeExito ? notebook : best
        )
      : null;
    
    const totalWeekTime = studyTimeData.reduce((total, day) => total + day.tiempo, 0);
    const avgSuccess = cuadernosToUse.length > 0
      ? Math.round(cuadernosToUse.reduce((sum, nb) => sum + nb.porcentajeExito, 0) / cuadernosToUse.length)
      : 0;
    
    const selectedStudentName = students.find(s => s.id === selectedStudent)?.nombre || 'el estudiante';
    
    const allInsights = [];
    
    if (maxDay && maxDay.tiempo > 0) {
      allInsights.push({
        id: 1,
        type: 'study-day',
        title: 'Día más productivo',
        content: `${selectedStudentName} es más productivo los ${maxDay.dia} con ${maxDay.tiempo} minutos de estudio.`,
        icon: faCalendarAlt,
        color: 'green'
      });
    }
    
    if (totalWeekTime > 0) {
      allInsights.push({
        id: 2,
        type: 'study-time',
        title: 'Tiempo semanal',
        content: `${selectedStudentName} ha estudiado ${formatTime(totalWeekTime)} esta semana. ${totalWeekTime > 300 ? '¡Excelente dedicación!' : 'Podría aumentar su tiempo de estudio.'}`,
        icon: faClock,
        color: totalWeekTime > 300 ? 'blue' : 'orange'
      });
    }
    
    if (worstDominioNotebook) {
      allInsights.push({
        id: 3,
        type: 'opportunity',
        title: 'Área de oportunidad',
        content: `El cuaderno "${worstDominioNotebook.nombre}" tiene ${worstDominioNotebook.porcentajeDominio}% de dominio. Necesita más práctica.`,
        icon: faBook,
        color: 'orange'
      });
    }
    
    if (bestSuccessNotebook && bestSuccessNotebook.porcentajeExito > 80) {
      allInsights.push({
        id: 4,
        type: 'success',
        title: 'Mejor desempeño',
        content: `¡Excelente! El cuaderno "${bestSuccessNotebook.nombre}" tiene ${bestSuccessNotebook.porcentajeExito}% de éxito en estudios inteligentes.`,
        icon: faTrophy,
        color: 'purple'
      });
    }
    
    if (globalSmartStudies > 0) {
      allInsights.push({
        id: 5,
        type: 'smart-studies',
        title: 'Estudios validados',
        content: `${selectedStudentName} ha completado ${globalSmartStudies} estudios inteligentes con un promedio de ${avgSuccess}% de éxito.`,
        icon: faBrain,
        color: avgSuccess > 80 ? 'green' : 'blue'
      });
    }
    
    if (allInsights.length === 0) {
      allInsights.push({
        id: 6,
        type: 'welcome',
        title: 'Sin datos suficientes',
        content: 'Selecciona un estudiante para ver sus estadísticas personalizadas.',
        icon: faLightbulb,
        color: 'blue'
      });
    }

    return allInsights.slice(0, 2);
  };

  const insights = generateInsights();

  // Redirigir si no es tutor escolar
  useEffect(() => {
    if (!loadingStudents && !isSchoolTutor) {
      navigate('/');
    }
  }, [loadingStudents, isSchoolTutor, navigate]);

  if (loadingStudents) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando estudiantes...</p>
      </div>
    );
  }

  if (loading && selectedStudent) {
    return (
      <>
        <HeaderWithHamburger title="Panel del Tutor" subtitle="Progreso del Estudiante" />
        <div className="progress-layout">
          <div className="loading-container" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 400, margin: '0 auto', position: 'relative', height: 60 }}>
              <div style={{ position: 'absolute', left: `calc(${progress}% - 32px)`, top: -38, transition: 'left 0.12s linear', zIndex: 2, fontSize: 32 }}>
                <span role="img" aria-label="mono" style={{ filter: 'hue-rotate(230deg)' }}>🐒</span>
              </div>
              <div style={{ width: '100%', height: 18, background: '#ede9fe', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(97,71,255,0.07)' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)', borderRadius: 12, transition: 'width 0.12s linear' }} />
              </div>
            </div>
            <p style={{ marginTop: 2, color: '#6b7280', fontWeight: 500 }}>Cargando datos del estudiante...</p>
          </div>
        </div>
      </>
    );
  }

  if (!isSchoolTutor) {
    return null;
  }

  return (
    <>
      <HeaderWithHamburger title="Panel del Tutor" subtitle="Progreso del Estudiante" />
      <div className="progress-layout">
        {/* Selector de Estudiante (nuevo elemento único del tutor) */}
        <div className="admin-teacher-selector">
          <FontAwesomeIcon icon={faUserGraduate} className="selector-icon" />
          <button 
            className="teacher-dropdown-btn"
            onClick={() => setShowStudentDropdown(!showStudentDropdown)}
          >
            <span>{students.find(s => s.id === selectedStudent)?.nombre || 'Seleccionar Estudiante'}</span>
            <FontAwesomeIcon icon={faChevronDown} className={`dropdown-icon ${showStudentDropdown ? 'open' : ''}`} />
          </button>
          
          {showStudentDropdown && (
            <div className="teacher-dropdown">
              {students.length === 0 ? (
                <div className="teacher-option no-teachers">
                  <span className="teacher-name">No hay estudiantes asignados</span>
                  <span className="teacher-email">Los estudiantes deben ser vinculados por el administrador</span>
                </div>
              ) : (
                students.map(student => (
                  <div 
                    key={student.id}
                    className={`teacher-option ${selectedStudent === student.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedStudent(student.id);
                      setShowStudentDropdown(false);
                    }}
                  >
                    <span className="teacher-name">{student.nombre}</span>
                    <span className="teacher-email">{student.email}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Resto del contenido idéntico a ProgressPage */}
        <div className="progress-modules-row">
          <div className="progress-module-col">
            {/* Módulo 1: Score Global */}
            <div className="progress-module kpi-module">
              <div className="kpi-icon icon-trophy">
                <FontAwesomeIcon icon={faTrophy} />
              </div>
              <div className="kpi-content">
                <h3>Score Global</h3>
                <p className="kpi-value">{!selectedStudent ? '0' : globalScore.toLocaleString()}</p>
                <span className="kpi-label">puntos totales</span>
              </div>
            </div>

            {/* Módulo Lateral: Selector de Materias y Ranking */}
            <div className="progress-side-module">
              {materias.length === 0 ? (
                <div className="no-materias-message">
                  <p>No hay materias disponibles para este estudiante.</p>
                </div>
              ) : (
                <>
                  <div className="materia-dropdown-container">
                    <button 
                      className="materia-dropdown-btn"
                      onClick={() => setShowMateriaDropdown(!showMateriaDropdown)}
                      type="button"
                    >
                      <span>{materias.find(m => m.id === selectedMateria)?.nombre || 'Seleccionar materia'}</span>
                      <FontAwesomeIcon icon={faChevronDown} className={`dropdown-icon ${showMateriaDropdown ? 'open' : ''}`} />
                    </button>
                
                    {showMateriaDropdown && (
                      <div className="materia-dropdown">
                        {materias.length === 0 ? (
                          <div className="materia-option">No hay materias disponibles</div>
                        ) : (
                          materias.map(materia => (
                            <div 
                              key={materia.id}
                              className={`materia-option ${selectedMateria === materia.id ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedMateria(materia.id);
                                setShowMateriaDropdown(false);
                              }}
                            >
                              {materia.nombre}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

              <div className="ranking-table">
                <h4>Tabla de Posiciones</h4>
                <div className="ranking-list">
                  {rankingData.length > 0 ? (
                    <>
                      {rankingData.map((student) => (
                        <div 
                          key={student.posicion} 
                          className={`ranking-item ${student.nombre === 'Este estudiante' ? 'current-user' : ''}`}
                        >
                          <span className="ranking-position">#{student.posicion}</span>
                          <span className="ranking-name">{student.nombre}</span>
                          <span className="ranking-score">{student.score.toLocaleString()}</span>
                        </div>
                      ))}
                      {rankingData.length === 1 && rankingData[0].nombre === 'Este estudiante' && (
                        <div className="no-data-message" style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
                          Otros estudiantes aún no tienen puntuación en esta materia
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ranking-item current-user">
                      <span className="ranking-position">#1</span>
                      <span className="ranking-name">Este estudiante</span>
                      <span className="ranking-score">0</span>
                    </div>
                  )}
                </div>
              </div>
                </>
              )}
            </div>
          </div>

          <div className="progress-modules-right">
            <div className="progress-modules-right-row">
              {/* Módulo 2: Percentil Promedio Global */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-percentil">
                  <FontAwesomeIcon icon={faBullseye} />
                </div>
                <div className="kpi-content">
                  <h3>Percentil Global</h3>
                  <p className="kpi-value">{!selectedStudent ? '0' : globalPercentil}°</p>
                  <span className="kpi-label">percentil</span>
                </div>
              </div>

              {/* Módulo 3: Tiempo de Estudio Global */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-time">
                  <FontAwesomeIcon icon={faClock} />
                </div>
                <div className="kpi-content">
                  <h3>Tiempo de Estudio</h3>
                  <p className="kpi-value">{!selectedStudent ? '0h 0m' : formatTime(globalStudyTime)}</p>
                  <span className="kpi-label">tiempo total</span>
                </div>
              </div>

              {/* Módulo 4: Estudios Inteligentes Global */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-brain">
                  <FontAwesomeIcon icon={faBrain} />
                </div>
                <div className="kpi-content">
                  <h3>Estudios Inteligentes</h3>
                  <p className="kpi-value">{!selectedStudent ? '0' : globalSmartStudies}</p>
                  <span className="kpi-label">sesiones validadas</span>
                </div>
              </div>
            </div>

            {/* Módulo Inferior */}
            <div className="progress-bottom-module">
              {/* Gráficos */}
              <div className="charts-container">
                <div className="chart-section">
                  <h3><FontAwesomeIcon icon={faChartLine} className="chart-icon" /> Posicionamiento Histórico</h3>
                  <Suspense fallback={<ChartLoadingPlaceholder height={250} />}>
                    <PositionHistoryChart data={positionHistoryData} />
                  </Suspense>
                </div>

                <div className="chart-section">
                  <h3><FontAwesomeIcon icon={faCalendarAlt} className="chart-icon" /> Tiempo de Estudio Semanal</h3>
                  <Suspense fallback={<ChartLoadingPlaceholder height={250} />}>
                    <WeeklyStudyChart data={studyTimeData} />
                  </Suspense>
                </div>
              </div>

              {/* Tabla de Cuadernos */}
              <div className="notebooks-table-container">
                <h3><FontAwesomeIcon icon={faBook} className="table-icon" /> Detalle por Cuaderno</h3>
                <div className="notebooks-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Cuaderno</th>
                        <th>Score</th>
                        <th>Posición</th>
                        <th>Conceptos</th>
                        <th>Tiempo</th>
                        <th>E. Inteligentes</th>
                        <th>% Éxito</th>
                        <th>% Dominio</th>
                        <th>E. Libres</th>
                        <th>Juegos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuadernosReales.length > 0 ? (
                        cuadernosReales.map((cuaderno) => (
                          <tr key={cuaderno.id}>
                            <td className="notebook-name">{cuaderno.nombre}</td>
                            <td className="score-cell">{Math.round(cuaderno.score).toLocaleString('es-ES')}</td>
                            <td className="position-cell">
                              #{cuaderno.posicion} de {cuaderno.totalAlumnos}
                            </td>
                            <td>{cuaderno.conceptos}</td>
                            <td>{formatTime(cuaderno.tiempoEstudio)}</td>
                            <td className="smart-studies">{cuaderno.estudiosInteligentes}</td>
                            <td className="percentage success">{cuaderno.porcentajeExito}%</td>
                            <td className="percentage mastery">{cuaderno.porcentajeDominio}%</td>
                            <td>{cuaderno.estudiosLibres}</td>
                            <td>{cuaderno.juegosJugados || 0}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="no-data">
                            {loading ? 'Cargando datos...' : selectedMateria === 'general' ? 'No hay cuadernos con datos disponibles' : 'No hay cuadernos para esta materia'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Módulo de Insights */}
              <div className="insights-module">
                <div className="insights-header">
                  <FontAwesomeIcon icon={faLightbulb} className="insights-header-icon" />
                  <h3>Insights del Estudiante</h3>
                </div>
                <div className="insights-grid">
                  {insights.map((insight) => (
                    <div key={insight.id} className={`insight-card ${insight.color}`}>
                      <div className="insight-icon">
                        <FontAwesomeIcon icon={insight.icon} />
                      </div>
                      <div className="insight-content">
                        <h4>{insight.title}</h4>
                        <p>{insight.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SchoolTutorPage;