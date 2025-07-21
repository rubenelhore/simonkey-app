import React, { useState, useEffect, lazy, Suspense } from 'react';
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
import { kpiService } from '../services/kpiService';
import { rankingService } from '../services/rankingService';
import '../scripts/fixUserNotebooks';
import '../scripts/verifyNotebookIds';
import '../utils/forceReloadKPIs';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { getPositionHistory } from '../utils/createPositionHistory';
import ChartLoadingPlaceholder from '../components/Charts/ChartLoadingPlaceholder';
import '../styles/ProgressPage.css';

// Lazy load de los componentes de gráficos
const PositionHistoryChart = lazy(() => import('../components/Charts/PositionHistoryChart'));
const WeeklyStudyChart = lazy(() => import('../components/Charts/WeeklyStudyChart'));

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

const ProgressPage: React.FC = () => {
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const [showMateriaDropdown, setShowMateriaDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kpisData, setKpisData] = useState<any>(null);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [cuadernosReales, setCuadernosReales] = useState<CuadernoData[]>([]);
  const [progress, setProgress] = useState(0);
  const [effectiveUserId, setEffectiveUserId] = useState<string>('');

  // Cargar todo al montar el componente
  useEffect(() => {
    loadAllData();
  }, []);

  // Actualizar cuadernos cuando cambie la materia seleccionada
  useEffect(() => {
    if (kpisData && selectedMateria) {
      processCuadernosData();
    }
  }, [selectedMateria, kpisData]);

  // Calcular ranking cuando cambien los cuadernos o la materia
  useEffect(() => {
    // Solo calcular si hay datos de KPIs
    if (kpisData && cuadernosReales.length > 0) {
      calculateRanking();
      calculatePositionHistory();
      calculateWeeklyStudyTime();
    }
  }, [cuadernosReales, selectedMateria]);

  /** Reemplaza el useEffect de la barra de progreso por uno más fluido **/
  useEffect(() => {
    if (loading && !kpisData) {
      setProgress(0);
      let current = 0;
      const interval = setInterval(() => {
        current += Math.random() * 0.5 + 0.7; // avance muy suave y continuo
        if (current >= 100) {
          current = 100;
          clearInterval(interval);
        }
        setProgress(current);
      }, 16); // ~60fps
      return () => clearInterval(interval);
    }
  }, [loading, kpisData]);

  const loadAllData = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Obtener el ID efectivo del usuario solo una vez
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      setEffectiveUserId(userId);
      
      console.log('[ProgressPage] Cargando datos para usuario:', userId);
      
      // Cargar KPIs en paralelo con verificación de última actualización
      const kpisPromise = loadKPIsData(userId);
      
      // Esperar KPIs primero ya que son necesarios para las materias
      const kpis = await kpisPromise;
      if (kpis) {
        setKpisData(kpis);
        // Cargar materias inmediatamente después de KPIs
        await loadMaterias(userId, effectiveUserData?.isSchoolUser || false, kpis);
      }
      
    } catch (error) {
      console.error('[ProgressPage] Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKPIsData = async (userId: string) => {
    try {
      console.log('[ProgressPage] Cargando KPIs para usuario:', userId);
      
      // Primero intentar obtener KPIs existentes
      let kpis = await kpiService.getUserKPIs(userId);
      
      // Solo actualizar si no hay KPIs o si son muy antiguos (más de 1 hora)
      const shouldUpdate = !kpis || !kpis.ultimaActualizacion || 
        (Date.now() - (kpis.ultimaActualizacion?.toDate?.()?.getTime() || 0)) > 3600000;
      
      if (shouldUpdate) {
        console.log('[ProgressPage] Actualizando KPIs...');
        await kpiService.updateUserKPIs(userId);
        // Obtener KPIs actualizados
        kpis = await kpiService.getUserKPIs(userId);
      } else {
        console.log('[ProgressPage] Usando KPIs existentes (actualizados hace menos de 1 hora)');
      }
      
      console.log('[ProgressPage] KPIs obtenidos:', kpis);
      
      return kpis;
      
    } catch (error) {
      console.error('[ProgressPage] Error cargando KPIs:', error);
      return null;
    }
  };

  const loadMaterias = async (userId: string, isSchoolUser: boolean, kpis: any) => {
    try {
      console.log('[ProgressPage] Cargando materias, usuario escolar:', isSchoolUser);
      
      const materiasArray: Materia[] = [];
      
      if (isSchoolUser && kpis?.materias) {
        // Para usuarios escolares, usar las materias de los KPIs
        console.log('[ProgressPage] Usuario escolar detectado, extrayendo materias de KPIs');
        
        // Obtener todas las IDs de materias
        const materiaIds = Object.keys(kpis.materias);
        
        // Cargar todos los documentos de materias en paralelo
        const materiaPromises = materiaIds.map(materiaId => 
          getDoc(doc(db, 'schoolSubjects', materiaId))
        );
        
        const materiaDocs = await Promise.all(materiaPromises);
        
        // Procesar los resultados
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
        console.log('[ProgressPage] Materias extraídas de KPIs:', materiasArray);
      } else {
        // Para usuarios regulares, buscar en la colección materias
        const materiasQuery = query(
          collection(db, 'materias'),
          where('userId', '==', userId)
        );
        const materiasSnap = await getDocs(materiasQuery);
        
        console.log('[ProgressPage] Materias directas encontradas:', materiasSnap.size);
        
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
            where('userId', '==', userId)
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
      }
      
      // Si no se encontraron materias pero hay cuadernos en los KPIs, crear opción general
      if (materiasArray.length === 0 && isSchoolUser && kpisData?.cuadernos && Object.keys(kpisData.cuadernos).length > 0) {
        console.log('[ProgressPage] No se encontraron materias pero hay cuadernos, creando opción general');
        materiasArray.push({
          id: 'general',
          nombre: 'Todos los Cuadernos'
        });
      }
      
      console.log('[ProgressPage] Materias finales:', materiasArray);
      console.log('[ProgressPage] Total de materias encontradas:', materiasArray.length);
      materiasArray.forEach(m => console.log(`[ProgressPage] - Materia: ${m.nombre} (ID: ${m.id})`));
      
      setMaterias(materiasArray);
      
      // Seleccionar la primera materia por defecto
      if (materiasArray.length > 0 && !selectedMateria) {
        console.log('[ProgressPage] Seleccionando primera materia por defecto:', materiasArray[0]);
        setSelectedMateria(materiasArray[0].id);
      }
    } catch (error) {
      console.error('[ProgressPage] Error cargando materias:', error);
    }
  };

  const processCuadernosData = async () => {
    if (!auth.currentUser || !kpisData) return;
    
    console.log('[ProgressPage] === PROCESANDO DATOS DE CUADERNOS ===');
    console.log('[ProgressPage] Materia seleccionada:', selectedMateria);
    console.log('[ProgressPage] KPIs cuadernos:', kpisData.cuadernos);
    
    try {
      const effectiveUserData = await getEffectiveUserId();
      const isSchoolUser = effectiveUserData?.isSchoolUser || false;
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      const cuadernosTemp: CuadernoData[] = [];
      
      // Obtener información adicional de los cuadernos si es necesario
      const notebookNames = new Map<string, string>();
      const notebookMaterias = new Map<string, string>();
      
      if (isSchoolUser) {
        // Para usuarios escolares, obtener nombres de schoolNotebooks
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const idCuadernos = userData.idCuadernos || [];
          
          for (const cuadernoId of idCuadernos) {
            const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', cuadernoId));
            if (notebookDoc.exists()) {
              const notebookData = notebookDoc.data();
              notebookNames.set(cuadernoId, notebookData.title || 'Sin nombre');
              notebookMaterias.set(cuadernoId, notebookData.idMateria || '');
              console.log(`[ProgressPage] Cuaderno ${cuadernoId}: ${notebookData.title}, materia: ${notebookData.idMateria}`);
            }
          }
        }
      } else {
        // Para usuarios regulares, obtener información de notebooks
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', userId)
        );
        const notebooksSnap = await getDocs(notebooksQuery);
        
        notebooksSnap.forEach((doc) => {
          const notebookData = doc.data();
          notebookNames.set(doc.id, notebookData.title || 'Sin nombre');
          notebookMaterias.set(doc.id, notebookData.subjectId || notebookData.materiaId || '');
          console.log(`[ProgressPage] Notebook ${doc.id}: ${notebookData.title}, materia: ${notebookData.subjectId || notebookData.materiaId}`);
        });
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
          
          console.log(`[ProgressPage] Filtrando cuaderno ${cuadernoId}:`);
          console.log(`  - Materia del cuaderno (notebookMaterias): ${notebookMaterias.get(cuadernoId)}`);
          console.log(`  - Materia del cuaderno (KPIs): ${cuadernoData.idMateria}`);
          console.log(`  - Materia final: ${cuadernoMateria}`);
          console.log(`  - Materia seleccionada: ${selectedMateria}`);
          console.log(`  - Coincide: ${cuadernoMateria === selectedMateria}`);
          
          if (cuadernoMateria === selectedMateria) {
            const nombreCuaderno = notebookNames.get(cuadernoId) || cuadernoData.nombreCuaderno || 'Sin nombre';
            
            console.log(`  - Agregando cuaderno: ${nombreCuaderno}`);
            console.log(`[ProgressPage] Datos del cuaderno ${cuadernoId}:`, {
              juegosJugados: cuadernoData.juegosJugados,
              tiempoJuegosLocal: cuadernoData.tiempoJuegosLocal,
              rawData: cuadernoData
            });
            
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
      
      console.log('[ProgressPage] Cuadernos procesados:', cuadernosTemp.length);
      cuadernosTemp.forEach(c => {
        console.log(`[ProgressPage] - ${c.nombre}: score=${c.score}, pos=${c.posicion}, tiempo=${c.tiempoEstudio}min`);
      });
      
      setCuadernosReales(cuadernosTemp);
    } catch (error) {
      console.error('[ProgressPage] Error procesando cuadernos:', error);
      setCuadernosReales([]);
    }
  };

  const calculateRanking = async () => {
    if (!auth.currentUser || !kpisData) return;

    try {
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      const isSchoolUser = effectiveUserData?.isSchoolUser || false;
      
      console.log('[ProgressPage] Calculando ranking para materia:', selectedMateria);
      console.log('[ProgressPage] Es usuario escolar:', isSchoolUser);
      
      // Para usuarios regulares, mostrar su propio score
      if (!isSchoolUser) {
        console.log('[ProgressPage] Usuario regular, mostrando score personal');
        
        if (!selectedMateria || selectedMateria === 'general') {
          // Para vista general, mostrar el score global
          const globalScore = kpisData?.global?.scoreGlobal || 0;
          setRankingData([{ 
            posicion: 1, 
            nombre: 'Tú', 
            score: globalScore 
          }]);
        } else {
          // Para una materia específica, mostrar el score de esa materia
          const materiaScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
          setRankingData([{ 
            posicion: 1, 
            nombre: 'Tú', 
            score: materiaScore 
          }]);
        }
        return;
      }

      // Obtener el documento del usuario para tener la institución
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        console.log('[ProgressPage] Usuario no encontrado');
        setRankingData([]);
        return;
      }

      const userData = userDoc.data();
      const institutionId = userData.idInstitucion;
      
      if (!institutionId) {
        console.log('[ProgressPage] Usuario sin institución');
        setRankingData([]);
        return;
      }

      // Si no hay materia seleccionada o es general, no mostrar ranking
      // (porque decidimos no hacer ranking global)
      if (!selectedMateria || selectedMateria === 'general') {
        console.log('[ProgressPage] No hay ranking global disponible');
        setRankingData([]);
        return;
      }

      // Obtener el ranking pre-calculado de la materia
      const ranking = await rankingService.getSubjectRanking(institutionId, selectedMateria);
      
      if (!ranking) {
        console.log('[ProgressPage] No se encontró ranking pre-calculado');
        // Si no hay ranking pre-calculado, mostrar solo al usuario actual
        const userScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
        setRankingData([{ 
          posicion: 1, 
          nombre: 'Tú', 
          score: userScore 
        }]);
        return;
      }

      console.log('[ProgressPage] Ranking pre-calculado encontrado:', ranking);
      console.log(`[ProgressPage] Total estudiantes en ranking: ${ranking.totalStudents}`);
      console.log(`[ProgressPage] Última actualización: ${ranking.lastUpdated.toDate().toLocaleString()}`);

      // Convertir el ranking a formato para mostrar
      const rankingToShow = [];
      
      // Tomar los primeros 10 estudiantes
      const top10 = ranking.students.slice(0, 10);
      
      for (const student of top10) {
        rankingToShow.push({
          posicion: student.position,
          nombre: student.studentId === userId ? 'Tú' : student.name,
          score: student.score
        });
      }

      // Si el usuario no está en el top 10, buscarlo y agregarlo al final
      const userPosition = rankingService.getStudentPosition(ranking, userId);
      
      if (userPosition && userPosition > 10) {
        const userInRanking = ranking.students.find(s => s.studentId === userId);
        if (userInRanking) {
          rankingToShow.push({
            posicion: userPosition,
            nombre: 'Tú',
            score: userInRanking.score
          });
        }
      }

      // Si no hay estudiantes en el ranking, mostrar mensaje
      if (rankingToShow.length === 0) {
        console.log('[ProgressPage] No hay estudiantes con puntuación en esta materia');
        const userScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
        if (userScore > 0) {
          rankingToShow.push({ 
            posicion: 1, 
            nombre: 'Tú', 
            score: userScore 
          });
        }
      }

      console.log('[ProgressPage] Ranking a mostrar:', rankingToShow);
      setRankingData(rankingToShow);
      
      // Verificar si el ranking necesita actualización
      if (rankingService.needsUpdate(ranking)) {
        console.log('[ProgressPage] ⚠️ El ranking tiene más de 10 minutos, considerar actualización');
      }
      
    } catch (error) {
      console.error('[ProgressPage] Error calculando ranking:', error);
      setRankingData([]);
    }
  };

  const calculatePositionHistory = async () => {
    if (!auth.currentUser || !kpisData || !selectedMateria) return;

    try {
      const effectiveUserData = await getEffectiveUserId();
      const isSchoolUser = effectiveUserData?.isSchoolUser || false;
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      console.log('[ProgressPage] === CALCULANDO HISTORIAL DE POSICIONES ===');
      console.log('[ProgressPage] Usuario escolar:', isSchoolUser);
      console.log('[ProgressPage] Materia seleccionada:', selectedMateria);
      
      // Si es usuario escolar y hay datos de materia, buscar historial real
      if (isSchoolUser && selectedMateria && selectedMateria !== 'general') {
        // Intentar obtener historial real de la base de datos
        const history = await getPositionHistory(userId, selectedMateria, 8);
        
        if (history && history.length > 0) {
          console.log('[ProgressPage] Historial real encontrado:', history);
          const historyData = history.map(h => ({
            semana: h.semana,
            posicion: h.posicion
          }));
          setPositionHistoryData(historyData);
          return;
        }
        
        // Si no hay historial, generar datos basados en la posición actual
        console.log('[ProgressPage] No hay historial real, generando datos...');
      }
      
      // Generar datos por defecto o para usuarios no escolares
      const weeksData: PositionData[] = [];
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      
      // Obtener posición actual
      let currentPosition = 1;
      
      if (isSchoolUser && selectedMateria && selectedMateria !== 'general') {
        const materiaKpis = kpisData.materias?.[selectedMateria];
        if (materiaKpis) {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const institutionId = userData.idInstitucion;
            
            if (institutionId) {
              const ranking = await rankingService.getSubjectRanking(institutionId, selectedMateria);
              if (ranking) {
                const userPosition = rankingService.getStudentPosition(ranking, userId);
                if (userPosition) {
                  currentPosition = userPosition;
                  console.log('[ProgressPage] Posición actual:', currentPosition);
                }
              }
            }
          }
        }
      }
      
      // Si no hay historial real, mostrar posición actual constante
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        
        const day = weekStart.getDate().toString().padStart(2, '0');
        const month = (weekStart.getMonth() + 1).toString().padStart(2, '0');
        const weekLabel = `${day}/${month}`;
        
        // Sin datos históricos, mantener la posición actual constante
        weeksData.push({
          semana: weekLabel,
          posicion: currentPosition
        });
      }
      
      console.log('[ProgressPage] Historial generado:', weeksData);
      setPositionHistoryData(weeksData);
      
    } catch (error) {
      console.error('[ProgressPage] Error calculando historial de posiciones:', error);
      // En caso de error, mostrar posición 1 para todas las semanas
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
    if (!auth.currentUser || !kpisData) return;
    
    console.log('[ProgressPage] === CALCULANDO TIEMPO DE ESTUDIO SEMANAL ===');
    console.log('[ProgressPage] KPIs disponibles:', kpisData);
    console.log('[ProgressPage] Materia seleccionada:', selectedMateria);
    console.log('[ProgressPage] Cuadernos reales:', cuadernosReales);

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
      
      // Inicializar estructura de datos para cada día de la semana
      const studyTimeByDay = new Map<number, number>();
      for (let i = 0; i < 7; i++) {
        studyTimeByDay.set(i, 0);
      }
      
      // Función auxiliar para calcular tiempo desde sesiones
      const calculateFromStudySessions = async (timeByDay: Map<number, number>) => {
        const effectiveUserData = await getEffectiveUserId();
        const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser!.uid;
        
        // Obtener la fecha de inicio de la semana actual (ajustado a zona horaria local)
        const today = new Date();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay());
        currentWeekStart.setHours(0, 0, 0, 0);
        
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
        
        console.log('[ProgressPage] Hoy es:', today.toISOString(), 'Día de la semana:', today.getDay());
        console.log('[ProgressPage] Zona horaria:', Intl.DateTimeFormat().resolvedOptions().timeZone);

        console.log('[ProgressPage] Buscando sesiones desde:', currentWeekStart.toISOString());
        console.log('[ProgressPage] Hasta:', currentWeekEnd.toISOString());
        
        // Obtener todas las sesiones de estudio del usuario
        const studySessionsQuery = query(
          collection(db, 'studySessions'),
          where('userId', '==', userId)
        );
        
        const allSessionsSnap = await getDocs(studySessionsQuery);
        console.log('[ProgressPage] Total sesiones encontradas:', allSessionsSnap.size);
        
        // Filtrar manualmente por fecha y cuaderno si es necesario
        allSessionsSnap.forEach((doc: any) => {
          const session = doc.data();
          const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
          
          console.log(`[ProgressPage] Sesión ${doc.id}: fecha=${sessionDate.toISOString()}, notebook=${session.notebookId}, mode=${session.mode}`);
          
          if (sessionDate >= currentWeekStart && sessionDate < currentWeekEnd) {
            // Si hay materia seleccionada, filtrar por cuadernos de esa materia
            if (selectedMateria && selectedMateria !== 'general') {
              const belongsToMateria = cuadernosReales.some(c => c.id === session.notebookId);
              if (!belongsToMateria) {
                console.log(`[ProgressPage] Sesión ${doc.id} filtrada: no pertenece a la materia seleccionada`);
                return;
              }
            }
            
            const dayOfWeek = sessionDate.getDay();
            let sessionDuration = 0;
            
            // Calcular duración de la sesión
            if (session.metrics?.timeSpent) {
              // timeSpent está en segundos, convertir a minutos
              sessionDuration = Math.round(session.metrics.timeSpent / 60);
              console.log(`[ProgressPage] Sesión ${doc.id}: timeSpent=${session.metrics.timeSpent}s -> ${sessionDuration}min`);
            } else if (session.metrics?.sessionDuration) {
              sessionDuration = Math.round(session.metrics.sessionDuration / 60);
              console.log(`[ProgressPage] Sesión ${doc.id}: sessionDuration=${session.metrics.sessionDuration}s -> ${sessionDuration}min`);
            } else if (session.startTime && session.endTime) {
              const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
              const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
              sessionDuration = Math.round((end.getTime() - start.getTime()) / 60000);
              console.log(`[ProgressPage] Sesión ${doc.id}: calculado de start/end -> ${sessionDuration}min`);
            } else {
              sessionDuration = 5;
              console.log(`[ProgressPage] Sesión ${doc.id}: usando valor por defecto -> ${sessionDuration}min`);
            }
            
            const currentTime = timeByDay.get(dayOfWeek) || 0;
            timeByDay.set(dayOfWeek, currentTime + sessionDuration);
            console.log(`[ProgressPage] Agregando ${sessionDuration}min al día ${dayOfWeek} (total: ${currentTime + sessionDuration}min)`);
          }
        });
      };
      
      // Si hay materia seleccionada y no es general, filtrar por materia
      if (selectedMateria && selectedMateria !== 'general') {
        // Buscar tiempo de estudio por materia
        const materiaData = kpisData.materias?.[selectedMateria];
        if (materiaData?.tiempoEstudioSemanal) {
          console.log('[ProgressPage] Tiempo de estudio semanal encontrado para materia:', selectedMateria, materiaData.tiempoEstudioSemanal);
          console.log('[ProgressPage] Detalle del tiempo por día:', JSON.stringify(materiaData.tiempoEstudioSemanal, null, 2));
          
          // Usar los datos semanales de la materia específica
          Object.entries(materiaData.tiempoEstudioSemanal).forEach(([dia, tiempo]) => {
            const dayIndex = weekMapping[dia as keyof typeof weekMapping];
            if (dayIndex !== undefined && typeof tiempo === 'number') {
              studyTimeByDay.set(dayIndex, tiempo);
            }
          });
          
          // Log para debug
          const totalTimeInWeek = Object.values(materiaData.tiempoEstudioSemanal).reduce((sum: number, time: any) => sum + (time || 0), 0);
          console.log(`[ProgressPage] Tiempo total en la semana para materia ${selectedMateria}: ${totalTimeInWeek} minutos`);
        } else {
          // Si no hay datos específicos de la materia, calcular desde las sesiones de los cuadernos
          console.log('[ProgressPage] No hay tiempo semanal específico para la materia, calculando desde sesiones...');
          await calculateFromStudySessions(studyTimeByDay);
        }
      } else {
        // Vista general - usar datos globales si existen
        console.log('[ProgressPage] Datos de KPIs completos:', kpisData);
        console.log('[ProgressPage] tiempoEstudioSemanal existe?', !!kpisData.tiempoEstudioSemanal);
        
        if (kpisData.tiempoEstudioSemanal) {
          const tiempoSemanal = kpisData.tiempoEstudioSemanal;
          
          console.log('[ProgressPage] Usando tiempo de estudio global:', tiempoSemanal);
          
          studyTimeByDay.set(0, tiempoSemanal.domingo || 0);
          studyTimeByDay.set(1, tiempoSemanal.lunes || 0);
          studyTimeByDay.set(2, tiempoSemanal.martes || 0);
          studyTimeByDay.set(3, tiempoSemanal.miercoles || 0);
          studyTimeByDay.set(4, tiempoSemanal.jueves || 0);
          studyTimeByDay.set(5, tiempoSemanal.viernes || 0);
          studyTimeByDay.set(6, tiempoSemanal.sabado || 0);
          
          // Log para debug
          const totalGlobalTime = Object.values(tiempoSemanal).reduce((sum: number, time: any) => sum + ((typeof time === 'number' ? time : 0) || 0), 0);
          console.log(`[ProgressPage] Tiempo total global en la semana: ${totalGlobalTime} minutos`);
        } else {
          console.log('[ProgressPage] No hay datos de tiempo semanal en KPIs');
          // Dejar vacío si no hay datos
        }
      }
      
      // Convertir a formato del gráfico
      for (let i = 0; i < 7; i++) {
        const timeForDay = studyTimeByDay.get(i) || 0;
        chartData.push({
          dia: weekDays[i],
          tiempo: timeForDay
        });
        console.log(`[ProgressPage] ${weekDays[i]}: ${timeForDay} minutos`);
      }
      
      console.log('[ProgressPage] Tiempo de estudio por día (final):', JSON.stringify(chartData, null, 2));
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

  // Ya no necesitamos datos de ejemplo, usamos cuadernosReales

  // Usar datos reales si están disponibles, si no usar valores por defecto
  const globalScore = kpisData?.global?.scoreGlobal || 0;
  const globalPercentil = kpisData?.global?.percentilPromedioGlobal || 0;
  const globalStudyTime = kpisData?.global?.tiempoEstudioGlobal || 0;
  const globalSmartStudies = kpisData?.global?.estudiosInteligentesGlobal || 0;
  
  // Métricas adicionales de los KPIs

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
          <div className="loading-container" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 400, margin: '0 auto', position: 'relative', height: 60 }}>
              {/* Mono morado */}
              <div style={{ position: 'absolute', left: `calc(${progress}% - 32px)`, top: -38, transition: 'left 0.12s linear', zIndex: 2, fontSize: 32 }}>
                <span role="img" aria-label="mono" style={{ filter: 'hue-rotate(230deg)' }}>🐒</span>
              </div>
              {/* Barra de progreso */}
              <div style={{ width: '100%', height: 18, background: '#ede9fe', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(97,71,255,0.07)' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)', borderRadius: 12, transition: 'width 0.12s linear' }} />
              </div>
            </div>
            <p style={{ marginTop: 2, color: '#6b7280', fontWeight: 500 }}>Cargando tus datos de progreso...</p>
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
                    <>
                      {rankingData.map((student) => (
                        <div 
                          key={student.posicion} 
                          className={`ranking-item ${student.nombre === 'Tú' ? 'current-user' : ''}`}
                        >
                          <span className="ranking-position">#{student.posicion}</span>
                          <span className="ranking-name">{student.nombre}</span>
                          <span className="ranking-score">{student.score.toLocaleString()}</span>
                        </div>
                      ))}
                      {rankingData.length === 1 && rankingData[0].nombre === 'Tú' && (
                        <div className="no-data-message" style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
                          Otros estudiantes aún no tienen puntuación en esta materia
                        </div>
                      )}
                    </>
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
                        cuadernosReales.map((cuaderno) => {
                          console.log('[ProgressPage] Renderizando cuaderno en tabla:', cuaderno);
                          return (
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
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={9} className="no-data">
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