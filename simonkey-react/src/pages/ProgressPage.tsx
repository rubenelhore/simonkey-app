import React, { useState, useEffect } from 'react';
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
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { kpiService } from '../services/kpiService';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import '../styles/ProgressPage.css';

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
}

const ProgressPage: React.FC = () => {
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const [showMateriaDropdown, setShowMateriaDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kpisData, setKpisData] = useState<any>(null);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [cuadernosReales, setCuadernosReales] = useState<CuadernoData[]>([]);

  // Cargar datos reales de KPIs al montar el componente
  useEffect(() => {
    loadKPIsData();
  }, []);

  // Actualizar cuadernos cuando cambie la materia seleccionada
  useEffect(() => {
    if (kpisData && selectedMateria) {
      processCuadernosData();
    }
  }, [selectedMateria, kpisData]);

  // Calcular ranking cuando cambien los cuadernos o la materia
  useEffect(() => {
    calculateRanking();
    calculatePositionHistory();
    calculateWeeklyStudyTime();
  }, [cuadernosReales, selectedMateria, kpisData]);

  const loadKPIsData = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('[ProgressPage] Cargando KPIs para usuario:', auth.currentUser.uid);
      
      // Obtener KPIs del usuario
      const kpis = await kpiService.getUserKPIs(auth.currentUser.uid);
      console.log('[ProgressPage] KPIs obtenidos:', kpis);
      
      if (!kpis) {
        console.log('[ProgressPage] No hay KPIs, actualizando...');
        // Si no hay KPIs, intentar actualizarlos
        await kpiService.updateUserKPIs(auth.currentUser.uid);
        const updatedKpis = await kpiService.getUserKPIs(auth.currentUser.uid);
        setKpisData(updatedKpis);
      } else {
        setKpisData(kpis);
      }
      
      // Cargar materias basándose en los cuadernos del usuario
      await loadMaterias();
      
    } catch (error) {
      console.error('[ProgressPage] Error cargando KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterias = async () => {
    if (!auth.currentUser) return;
    
    try {
      // Primero, intentar obtener materias directamente
      const materiasQuery = query(
        collection(db, 'materias'),
        where('userId', '==', auth.currentUser.uid)
      );
      const materiasSnap = await getDocs(materiasQuery);
      
      console.log('[ProgressPage] Materias directas encontradas:', materiasSnap.size);
      
      const materiasArray: Materia[] = [];
      
      if (materiasSnap.size > 0) {
        // Si hay materias en la colección materias
        materiasSnap.forEach((doc: any) => {
          const data = doc.data();
          console.log('[ProgressPage] Materia data:', { id: doc.id, data });
          materiasArray.push({
            id: doc.id,
            nombre: data.nombre || data.title || 'Sin nombre'
          });
        });
      } else {
        // Si no hay materias directas, intentar extraerlas de los cuadernos
        console.log('[ProgressPage] No hay materias directas, buscando en cuadernos...');
        
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', auth.currentUser.uid)
        );
        const notebooksSnap = await getDocs(notebooksQuery);
        
        console.log('[ProgressPage] Cuadernos encontrados:', notebooksSnap.size);
        
        // Extraer materias únicas de los cuadernos
        const materiasMap = new Map<string, string>();
        
        notebooksSnap.forEach((doc: any) => {
          const data = doc.data();
          console.log('[ProgressPage] Notebook completo:', { id: doc.id, ...data });
          
          // Buscar el ID de la materia en diferentes campos posibles
          const materiaId = data.materiaId || data.subjectId || data.subject?.id || null;
          
          // Buscar el nombre de la materia en diferentes campos posibles
          const materiaNombre = data.materiaNombre || 
                               data.subjectName || 
                               data.materia || 
                               data.subject?.nombre || 
                               data.subject?.name ||
                               data.subject ||
                               null;
          
          console.log('[ProgressPage] Materia extraída:', { materiaId, materiaNombre });
          
          // Si encontramos nombre pero no ID, usar el nombre como ID
          if (materiaNombre && !materiaId) {
            const generatedId = materiaNombre.toLowerCase().replace(/\s+/g, '-');
            materiasMap.set(generatedId, materiaNombre);
          } else if (materiaId && materiaNombre) {
            materiasMap.set(materiaId, materiaNombre);
          } else if (materiaNombre && typeof materiaNombre === 'string') {
            // Si solo tenemos el nombre como string
            const generatedId = materiaNombre.toLowerCase().replace(/\s+/g, '-');
            materiasMap.set(generatedId, materiaNombre);
          }
        });
        
        // Convertir a array
        Array.from(materiasMap).forEach(([id, nombre]) => {
          materiasArray.push({ id, nombre });
        });
        
        // Si no se encontraron materias pero hay cuadernos, crear una materia "General"
        if (materiasArray.length === 0 && notebooksSnap.size > 0) {
          console.log('[ProgressPage] No se encontraron materias, creando materia General...');
          materiasArray.push({
            id: 'general',
            nombre: 'Todos los Cuadernos'
          });
        }
      }
      
      console.log('[ProgressPage] Materias finales:', materiasArray);
      console.log('[ProgressPage] Total de materias encontradas:', materiasArray.length);
      materiasArray.forEach(m => console.log(`[ProgressPage] - Materia: ${m.nombre} (ID: ${m.id})`));
      
      setMaterias(materiasArray);
      
      // Seleccionar la primera materia por defecto
      if (materiasArray.length > 0 && !selectedMateria) {
        setSelectedMateria(materiasArray[0].id);
      }
    } catch (error) {
      console.error('[ProgressPage] Error cargando materias:', error);
    }
  };

  const processCuadernosData = async () => {
    if (!auth.currentUser || !kpisData || !selectedMateria) return;
    
    try {
      let notebooksSnap;
      
      // Si la materia es "general", obtener todos los cuadernos
      if (selectedMateria === 'general') {
        const allNotebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', auth.currentUser.uid)
        );
        notebooksSnap = await getDocs(allNotebooksQuery);
      } else {
        // Obtener TODOS los cuadernos y filtrar manualmente
        const allNotebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', auth.currentUser.uid)
        );
        const allNotebooksSnap = await getDocs(allNotebooksQuery);
        
        // Filtrar manualmente los cuadernos que pertenecen a la materia seleccionada
        const filteredDocs: any[] = [];
        allNotebooksSnap.forEach((doc: any) => {
          const data = doc.data();
          
          // Verificar si el cuaderno pertenece a la materia seleccionada
          const notebookMateriaId = data.materiaId || data.subjectId || data.subject?.id;
          const notebookMateriaNombre = data.materiaNombre || 
                                       data.subjectName || 
                                       data.materia || 
                                       data.subject?.nombre || 
                                       data.subject?.name ||
                                       data.subject;
          
          // Comparar por ID o por nombre normalizado
          if (notebookMateriaId === selectedMateria || 
              (notebookMateriaNombre && notebookMateriaNombre.toLowerCase().replace(/\s+/g, '-') === selectedMateria) ||
              notebookMateriaNombre === materias.find(m => m.id === selectedMateria)?.nombre) {
            filteredDocs.push(doc);
          }
        });
        
        // Crear un snapshot falso con los documentos filtrados
        notebooksSnap = {
          docs: filteredDocs,
          size: filteredDocs.length,
          empty: filteredDocs.length === 0,
          forEach: (callback: any) => filteredDocs.forEach(callback)
        } as any;
      }
      
      console.log('[ProgressPage] Cuadernos encontrados para procesar:', notebooksSnap.size);
      
      const cuadernosTemp: CuadernoData[] = [];
      
      notebooksSnap.forEach((doc: any) => {
        const notebookData = doc.data();
        const notebookId = doc.id;
        const kpiCuaderno = kpisData.cuadernos?.[notebookId];
        
        if (kpiCuaderno) {
          // Usar datos reales de KPIs
          cuadernosTemp.push({
            id: notebookId,
            nombre: notebookData.title || 'Sin nombre',
            score: kpiCuaderno.scoreCuaderno || 0,
            posicion: kpiCuaderno.posicionRanking || 1,
            totalAlumnos: 1, // Por ahora, esto vendría del salón si es usuario escolar
            conceptos: kpiCuaderno.numeroConceptos || 0,
            tiempoEstudio: kpiCuaderno.tiempoEstudioLocal || 0,
            estudiosInteligentes: kpiCuaderno.estudiosInteligentesLocal || 0,
            porcentajeExito: kpiCuaderno.porcentajeExitoEstudiosInteligentes || 0,
            porcentajeDominio: kpiCuaderno.porcentajeDominioConceptos || 0,
            estudiosLibres: kpiCuaderno.estudiosLibresLocal || 0
          });
        }
      });
      
      console.log('[ProgressPage] Cuadernos procesados:', cuadernosTemp);
      setCuadernosReales(cuadernosTemp);
    } catch (error) {
      console.error('[ProgressPage] Error procesando cuadernos:', error);
    }
  };

  const calculateRanking = async () => {
    if (!auth.currentUser || !selectedMateria) return;

    try {
      // Calcular el score total del usuario actual para la materia seleccionada
      let userScore = 0;
      
      if (selectedMateria === 'general') {
        // Si es general, usar el score global
        userScore = kpisData?.global?.scoreGlobal || 0;
      } else {
        // Sumar los scores de todos los cuadernos de la materia
        userScore = cuadernosReales.reduce((total, cuaderno) => total + cuaderno.score, 0);
      }

      console.log('[ProgressPage] Score del usuario para ranking:', userScore);

      // Por ahora, como solo hay un usuario, establecerlo como #1
      const ranking = [
        { 
          posicion: 1, 
          nombre: 'Tú', 
          score: userScore 
        }
      ];

      // TODO: En el futuro, aquí se podría buscar otros usuarios del mismo salón
      // si el usuario es de tipo escolar y comparar scores

      setRankingData(ranking);
    } catch (error) {
      console.error('[ProgressPage] Error calculando ranking:', error);
      // En caso de error, mostrar al usuario como #1 con su score
      setRankingData([
        { 
          posicion: 1, 
          nombre: 'Tú', 
          score: cuadernosReales.reduce((total, cuaderno) => total + cuaderno.score, 0) 
        }
      ]);
    }
  };

  const calculatePositionHistory = async () => {
    if (!auth.currentUser) return;

    try {
      // Obtener las últimas 8 semanas
      const weeksData: PositionData[] = [];
      const today = new Date();
      
      // Calcular el inicio de la semana actual
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      
      // Generar datos para las últimas 8 semanas
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        // Formatear la fecha como "DD/MM"
        const day = weekStart.getDate().toString().padStart(2, '0');
        const month = (weekStart.getMonth() + 1).toString().padStart(2, '0');
        const weekLabel = `${day}/${month}`;
        
        // Por ahora, siempre mostrar posición 1 para evitar el error de índice
        // TODO: Crear el índice en Firebase y luego restaurar la consulta original
        const position = 1;
        
        weeksData.push({
          semana: weekLabel,
          posicion: position
        });
      }
      
      console.log('[ProgressPage] Historial de posiciones:', weeksData);
      setPositionHistoryData(weeksData);
      
    } catch (error) {
      console.error('[ProgressPage] Error calculando historial de posiciones:', error);
      // En caso de error, mostrar datos por defecto
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
    if (!auth.currentUser) return;

    try {
      // Inicializar estructura de datos para cada día de la semana
      const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const studyTimeByDay = new Map<number, number>();
      
      // Inicializar todos los días con 0 minutos
      for (let i = 0; i < 7; i++) {
        studyTimeByDay.set(i, 0);
      }

      // Obtener la fecha de inicio de la semana actual
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);

      console.log('[ProgressPage] Buscando sesiones desde:', currentWeekStart.toISOString());
      console.log('[ProgressPage] Hasta:', currentWeekEnd.toISOString());
      
      // Obtener todas las sesiones de estudio del usuario (sin filtro de fecha para evitar índice)
      const studySessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', auth.currentUser.uid)
      );
      
      const allSessionsSnap = await getDocs(studySessionsQuery);
      
      // Filtrar manualmente por fecha
      const sessionsThisWeek: any[] = [];
      allSessionsSnap.forEach((doc: any) => {
        const session = doc.data();
        const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
        
        if (sessionDate >= currentWeekStart && sessionDate < currentWeekEnd) {
          sessionsThisWeek.push({ id: doc.id, ...session });
        }
      });
      
      const sessionsSnap = {
        size: sessionsThisWeek.length,
        docs: sessionsThisWeek,
        forEach: (callback: any) => sessionsThisWeek.forEach(session => callback({ data: () => session }))
      } as any;
      
      console.log('[ProgressPage] Sesiones de la semana encontradas:', sessionsSnap.size);
      
      // Si no hay sesiones en studySessions, buscar en actividades
      if (sessionsSnap.size === 0) {
        console.log('[ProgressPage] No hay sesiones en studySessions, buscando en activities...');
        
        // Buscar en actividades de tipo estudio
        const activitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', auth.currentUser.uid),
          where('type', 'in', ['study_session', 'study', 'intelligent_study', 'free_study']),
          where('timestamp', '>=', currentWeekStart),
          where('timestamp', '<', currentWeekEnd)
        );
        
        const activitiesSnap = await getDocs(activitiesQuery);
        console.log('[ProgressPage] Actividades de estudio encontradas:', activitiesSnap.size);
        
        // Procesar actividades como sesiones
        activitiesSnap.forEach((doc: any) => {
          const activity = doc.data();
          const activityDate = activity.timestamp.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp);
          const dayOfWeek = activityDate.getDay();
          
          // Estimar 5 minutos por actividad de estudio para ser más realista
          const estimatedDuration = 5;
          
          const currentTime = studyTimeByDay.get(dayOfWeek) || 0;
          studyTimeByDay.set(dayOfWeek, currentTime + estimatedDuration);
          
          console.log(`[ProgressPage] Actividad agregada: ${activity.type} en día ${weekDays[dayOfWeek]} (+${estimatedDuration}min)`);
        });
      } else {
        // Procesar cada sesión y acumular tiempo por día
        sessionsSnap.forEach((doc: any) => {
          const session = doc.data();
          console.log('[ProgressPage] Procesando sesión:', { id: doc.id, ...session });
          
          let sessionDuration = 0;
          
          // Calcular duración de la sesión
          if (session.metrics?.timeSpent) {
            // timeSpent viene en minutos
            sessionDuration = Math.round(session.metrics.timeSpent);
          } else if (session.metrics?.sessionDuration) {
            sessionDuration = Math.round(session.metrics.sessionDuration / 60); // Convertir a minutos
          } else if (session.startTime && session.endTime) {
            const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
            const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
            sessionDuration = Math.round((end.getTime() - start.getTime()) / 60000); // Convertir a minutos
          } else {
            // Si no hay información de duración, estimar 5 minutos
            sessionDuration = 5;
            console.log('[ProgressPage] No hay duración, estimando 5 minutos');
          }
          
          // Obtener el día de la semana de la sesión
          const sessionDate = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
          const dayOfWeek = sessionDate.getDay();
          
          console.log(`[ProgressPage] Sesión del ${weekDays[dayOfWeek]} con duración: ${sessionDuration} minutos`);
          
          // Si es para la materia seleccionada o es vista general
          if (selectedMateria === 'general' || 
              (session.notebookId && cuadernosReales.some(c => c.id === session.notebookId))) {
            const currentTime = studyTimeByDay.get(dayOfWeek) || 0;
            studyTimeByDay.set(dayOfWeek, currentTime + sessionDuration);
            console.log(`[ProgressPage] Tiempo acumulado para ${weekDays[dayOfWeek]}: ${currentTime + sessionDuration} minutos`);
          }
        });
      }
      
      // También buscar en los KPIs si hay tiempo de estudio reciente
      if (kpisData?.global?.tiempoEstudioGlobal > 0 && Array.from(studyTimeByDay.values()).every(time => time === 0)) {
        console.log('[ProgressPage] Usando tiempo de KPIs como respaldo...');
        // Si hay tiempo global pero no sesiones específicas, distribuir el tiempo en el día actual
        const todayIndex = today.getDay();
        const currentTime = studyTimeByDay.get(todayIndex) || 0;
        // Usar solo 5 minutos como estimación para que sea coherente con sesiones futuras
        const estimatedTodayTime = 5;
        studyTimeByDay.set(todayIndex, currentTime + estimatedTodayTime);
        console.log(`[ProgressPage] Agregando ${estimatedTodayTime} minutos estimados para hoy`);
      }

      // Convertir a formato del gráfico
      const chartData: StudyTimeData[] = [];
      for (let i = 0; i < 7; i++) {
        chartData.push({
          dia: weekDays[i],
          tiempo: studyTimeByDay.get(i) || 0
        });
      }
      
      console.log('[ProgressPage] Tiempo de estudio por día:', chartData);
      setStudyTimeData(chartData);
      
    } catch (error) {
      console.error('[ProgressPage] Error calculando tiempo de estudio semanal:', error);
      // En caso de error, mostrar datos vacíos
      const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const emptyData = weekDays.map(dia => ({ dia, tiempo: 0 }));
      setStudyTimeData(emptyData);
    }
  };

  // Calcular el ranking real basado en los datos actuales
  const [rankingData, setRankingData] = useState<Array<{posicion: number, nombre: string, score: number}>>([]);

  const [positionHistoryData, setPositionHistoryData] = useState<PositionData[]>([]);

  const [studyTimeData, setStudyTimeData] = useState<StudyTimeData[]>([]);

  const cuadernosData: CuadernoData[] = [
    {
      id: '1',
      nombre: 'Álgebra Lineal',
      score: 450,
      posicion: 3,
      totalAlumnos: 25,
      conceptos: 48,
      tiempoEstudio: 240,
      estudiosInteligentes: 12,
      porcentajeExito: 85,
      porcentajeDominio: 72,
      estudiosLibres: 8,
    },
    {
      id: '2',
      nombre: 'Cálculo Diferencial',
      score: 380,
      posicion: 5,
      totalAlumnos: 30,
      conceptos: 36,
      tiempoEstudio: 180,
      estudiosInteligentes: 8,
      porcentajeExito: 75,
      porcentajeDominio: 65,
      estudiosLibres: 6,
    },
    {
      id: '3',
      nombre: 'Geometría Analítica',
      score: 520,
      posicion: 2,
      totalAlumnos: 22,
      conceptos: 42,
      tiempoEstudio: 300,
      estudiosInteligentes: 15,
      porcentajeExito: 90,
      porcentajeDominio: 80,
      estudiosLibres: 10,
    },
    {
      id: '4',
      nombre: 'Estadística',
      score: 310,
      posicion: 8,
      totalAlumnos: 28,
      conceptos: 30,
      tiempoEstudio: 150,
      estudiosInteligentes: 6,
      porcentajeExito: 70,
      porcentajeDominio: 60,
      estudiosLibres: 5,
    },
  ];

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

  // Generar insights basados en datos reales
  const generateInsights = () => {
    // Usar cuadernosReales si hay datos, si no usar array vacío
    const cuadernosToUse = cuadernosReales.length > 0 ? cuadernosReales : [];
    
    // Encontrar el día con más y menos tiempo de estudio
    const maxDay = studyTimeData.length > 0 && studyTimeData.some(d => d.tiempo > 0)
      ? studyTimeData.reduce((max, day) => day.tiempo > max.tiempo ? day : max)
      : null;
    const minDay = studyTimeData.length > 0 && studyTimeData.some(d => d.tiempo > 0)
      ? studyTimeData.filter(d => d.tiempo > 0).reduce((min, day) => day.tiempo < min.tiempo ? day : min)
      : null;
    
    // Encontrar el cuaderno con menor % de dominio
    const worstDominioNotebook = cuadernosToUse.length > 0 
      ? cuadernosToUse.reduce((worst, notebook) => 
          notebook.porcentajeDominio < worst.porcentajeDominio ? notebook : worst
        )
      : null;
    
    // Encontrar el cuaderno con mejor % de éxito
    const bestSuccessNotebook = cuadernosToUse.length > 0 
      ? cuadernosToUse.reduce((best, notebook) => 
          notebook.porcentajeExito > best.porcentajeExito ? notebook : best
        )
      : null;
    
    // Calcular tiempo total de estudio esta semana
    const totalWeekTime = studyTimeData.reduce((total, day) => total + day.tiempo, 0);
    
    // Calcular promedio de éxito en estudios inteligentes
    const avgSuccess = cuadernosToUse.length > 0
      ? Math.round(cuadernosToUse.reduce((sum, nb) => sum + nb.porcentajeExito, 0) / cuadernosToUse.length)
      : 0;
    
    const allInsights = [];
    
    // Insight sobre día más productivo
    if (maxDay && maxDay.tiempo > 0) {
      allInsights.push({
        id: 1,
        type: 'study-day',
        title: 'Día más productivo',
        content: `Tu día más productivo de la semana es ${maxDay.dia} con ${maxDay.tiempo} minutos de estudio.`,
        icon: faCalendarAlt,
        color: 'green'
      });
    }
    
    // Insight sobre tiempo total de estudio
    if (totalWeekTime > 0) {
      allInsights.push({
        id: 2,
        type: 'study-time',
        title: 'Tiempo semanal',
        content: `Has estudiado ${formatTime(totalWeekTime)} esta semana. ${totalWeekTime > 300 ? '¡Excelente dedicación!' : 'Intenta aumentar tu tiempo de estudio.'}`,
        icon: faClock,
        color: totalWeekTime > 300 ? 'blue' : 'orange'
      });
    }
    
    // Insight sobre área de oportunidad
    if (worstDominioNotebook) {
      allInsights.push({
        id: 3,
        type: 'opportunity',
        title: 'Área de oportunidad',
        content: `Tu cuaderno "${worstDominioNotebook.nombre}" tiene ${worstDominioNotebook.porcentajeDominio}% de dominio. Dedícale más tiempo para mejorar.`,
        icon: faBook,
        color: 'orange'
      });
    }
    
    // Insight sobre mejor desempeño
    if (bestSuccessNotebook && bestSuccessNotebook.porcentajeExito > 80) {
      allInsights.push({
        id: 4,
        type: 'success',
        title: 'Mejor desempeño',
        content: `¡Felicidades! Tu cuaderno "${bestSuccessNotebook.nombre}" tiene ${bestSuccessNotebook.porcentajeExito}% de éxito en estudios inteligentes.`,
        icon: faTrophy,
        color: 'purple'
      });
    }
    
    // Insight sobre estudios inteligentes
    if (globalSmartStudies > 0) {
      allInsights.push({
        id: 5,
        type: 'smart-studies',
        title: 'Estudios validados',
        content: `Has completado ${globalSmartStudies} estudios inteligentes con un promedio de ${avgSuccess}% de éxito.`,
        icon: faBrain,
        color: avgSuccess > 80 ? 'green' : 'blue'
      });
    }
    
    // Si no hay insights basados en datos, mostrar mensajes motivacionales
    if (allInsights.length === 0) {
      allInsights.push(
        {
          id: 6,
          type: 'welcome',
          title: 'Comienza tu viaje',
          content: 'Completa tu primer estudio inteligente para empezar a ver tus estadísticas personalizadas.',
          icon: faLightbulb,
          color: 'blue'
        },
        {
          id: 7,
          type: 'motivation',
          title: 'Establece una rutina',
          content: 'Estudiar un poco cada día es más efectivo que sesiones largas esporádicas.',
          icon: faChartLine,
          color: 'green'
        }
      );
    }

    // Seleccionar 2 insights (priorizando los basados en datos reales)
    const insightsToShow = allInsights.slice(0, 2);
    return insightsToShow;
  };

  const insights = generateInsights();

  if (loading && !kpisData) {
    return (
      <>
        <HeaderWithHamburger title="Progreso" />
        <div className="progress-layout">
          <div className="loading-container">
            <FontAwesomeIcon icon={faSpinner} spin size="3x" />
            <p>Cargando tus datos de progreso...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderWithHamburger title="Progreso" />
      <div className="progress-layout">
        <div className="progress-modules-row">
          <div className="progress-module-col">
            {/* Módulo 1: Score Global */}
            <div className="progress-module kpi-module">
              <div className="kpi-icon icon-trophy">
                <FontAwesomeIcon icon={faTrophy} />
              </div>
              <div className="kpi-content">
                <h3>Score Global</h3>
                <p className="kpi-value">{globalScore.toLocaleString()}</p>
                <span className="kpi-label">puntos totales</span>
              </div>
            </div>

            {/* Módulo Lateral: Selector de Materias y Ranking */}
            <div className="progress-side-module">
              {materias.length === 0 ? (
                <div className="no-materias-message">
                  <p>No hay materias disponibles. Crea cuadernos y asígnalos a materias para ver el progreso.</p>
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
                                console.log('[ProgressPage] Materia seleccionada:', materia);
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
                    rankingData.map((student) => (
                      <div 
                        key={student.posicion} 
                        className={`ranking-item ${student.nombre === 'Tú' ? 'current-user' : ''}`}
                      >
                        <span className="ranking-position">#{student.posicion}</span>
                        <span className="ranking-name">{student.nombre}</span>
                        <span className="ranking-score">{student.score.toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <div className="ranking-item current-user">
                      <span className="ranking-position">#1</span>
                      <span className="ranking-name">Tú</span>
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
                  <p className="kpi-value">{globalPercentil}°</p>
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
                  <p className="kpi-value">{formatTime(globalStudyTime)}</p>
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
                  <p className="kpi-value">{globalSmartStudies}</p>
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
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={positionHistoryData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="semana" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        reversed 
                        domain={[1, 5]} 
                        ticks={[1, 2, 3, 4, 5]}
                        label={{ value: 'Posición', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        formatter={(value: any) => [`Posición #${value}`, 'Ranking']}
                        labelFormatter={(label) => `Semana del ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="posicion" 
                        stroke="#8B5CF6" 
                        strokeWidth={3}
                        dot={{ fill: '#8B5CF6', r: 6 }}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-section">
                  <h3><FontAwesomeIcon icon={faCalendarAlt} className="chart-icon" /> Tiempo de Estudio Semanal</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={studyTimeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dia" />
                      <YAxis 
                        label={{ value: 'Minutos', angle: -90, position: 'insideLeft' }}
                        tickFormatter={(value) => `${value}m`}
                      />
                      <Tooltip 
                        formatter={(value: any) => [`${value} minutos`, 'Tiempo de estudio']}
                        labelFormatter={(label) => `${label}`}
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb' }}
                      />
                      <Bar 
                        dataKey="tiempo" 
                        fill="#10B981" 
                        radius={[8, 8, 0, 0]}
                        animationDuration={800}
                      >
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
                      </tr>
                    </thead>
                    <tbody>
                      {cuadernosReales.length > 0 ? (
                        cuadernosReales.map((cuaderno) => (
                          <tr key={cuaderno.id}>
                            <td className="notebook-name">{cuaderno.nombre}</td>
                            <td className="score-cell">{cuaderno.score}</td>
                            <td className="position-cell">
                              {cuaderno.posicion}/{cuaderno.totalAlumnos}
                            </td>
                            <td>{cuaderno.conceptos}</td>
                            <td>{formatTime(cuaderno.tiempoEstudio)}</td>
                            <td className="smart-studies">{cuaderno.estudiosInteligentes}</td>
                            <td className="percentage success">{cuaderno.porcentajeExito}%</td>
                            <td className="percentage mastery">{cuaderno.porcentajeDominio}%</td>
                            <td>{cuaderno.estudiosLibres}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="no-data">
                            {loading ? 'Cargando datos...' : 'No hay datos disponibles para esta materia'}
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
                  <h3>Insights Personalizados</h3>
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

export default ProgressPage;