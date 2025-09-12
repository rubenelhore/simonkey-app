import React, { useState, useEffect, lazy, Suspense } from 'react';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronDown,
  faChevronLeft,
  faChevronRight, 
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
import { MateriaRankingService } from '../services/materiaRankingService';
import '../scripts/fixUserNotebooks';
import '../scripts/verifyNotebookIds';
import '../utils/forceReloadKPIs';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { getPositionHistory } from '../utils/createPositionHistory';
import ChartLoadingPlaceholder from '../components/Charts/ChartLoadingPlaceholder';
import { gamePointsService } from '../services/gamePointsService';
import { studyStreakService } from '../services/studyStreakService';
import { getDomainProgressForNotebook } from '../utils/domainProgress';
import { useUserType } from '../hooks/useUserType';
import '../styles/ProgressPage.css';

// División levels configuration - 30 niveles basados en Score Global (5,000 puntos por nivel)
const DIVISION_LEVELS = [
  { name: 'Madera', icon: '🪵', minScore: 0, maxScore: 4999 },
  { name: 'Piedra', icon: '🪨', minScore: 5000, maxScore: 9999 },
  { name: 'Hierro', icon: '⚙️', minScore: 10000, maxScore: 14999 },
  { name: 'Bronce', icon: '🥉', minScore: 15000, maxScore: 19999 },
  { name: 'Plata', icon: '🥈', minScore: 20000, maxScore: 24999 },
  { name: 'Oro', icon: '🥇', minScore: 25000, maxScore: 29999 },
  { name: 'Platino', icon: '💍', minScore: 30000, maxScore: 34999 },
  { name: 'Esmeralda', icon: '💚', minScore: 35000, maxScore: 39999 },
  { name: 'Rubí', icon: '❤️', minScore: 40000, maxScore: 44999 },
  { name: 'Zafiro', icon: '💙', minScore: 45000, maxScore: 49999 },
  { name: 'Diamante', icon: '💎', minScore: 50000, maxScore: 54999 },
  { name: 'Amatista', icon: '💜', minScore: 55000, maxScore: 59999 },
  { name: 'Ópalo', icon: '🌈', minScore: 60000, maxScore: 64999 },
  { name: 'Jade', icon: '🟢', minScore: 65000, maxScore: 69999 },
  { name: 'Cristal', icon: '🔮', minScore: 70000, maxScore: 74999 },
  { name: 'Prisma', icon: '🔷', minScore: 75000, maxScore: 79999 },
  { name: 'Aurora', icon: '🌅', minScore: 80000, maxScore: 84999 },
  { name: 'Eclipse', icon: '🌑', minScore: 85000, maxScore: 89999 },
  { name: 'Lunar', icon: '🌙', minScore: 90000, maxScore: 94999 },
  { name: 'Solar', icon: '☀️', minScore: 95000, maxScore: 99999 },
  { name: 'Estelar', icon: '⭐', minScore: 100000, maxScore: 104999 },
  { name: 'Nebulosa', icon: '🌌', minScore: 105000, maxScore: 109999 },
  { name: 'Galaxia', icon: '🌠', minScore: 110000, maxScore: 114999 },
  { name: 'Cósmico', icon: '💫', minScore: 115000, maxScore: 119999 },
  { name: 'Cuántico', icon: '⚛️', minScore: 120000, maxScore: 124999 },
  { name: 'Dimensional', icon: '🌀', minScore: 125000, maxScore: 129999 },
  { name: 'Temporal', icon: '⏳', minScore: 130000, maxScore: 134999 },
  { name: 'Infinito', icon: '♾️', minScore: 135000, maxScore: 139999 },
  { name: 'Divino', icon: '👑', minScore: 140000, maxScore: 144999 },
  { name: 'Leyenda', icon: '🏆', minScore: 145000, maxScore: Infinity }
];

// Lazy load de los componentes de gráficos
const PositionHistoryChart = lazy(() => import('../components/Charts/PositionHistoryChart'));
const WeeklyStudyChart = lazy(() => import('../components/Charts/WeeklyStudyChart'));
const ConceptProgressChart = lazy(() => import('../components/Charts/ConceptProgressChart'));

interface Materia {
  id: string;
  nombre: string;
  teacherId?: string;
}

interface PositionData {
  semana: string;
  posicion: number;
}

interface StudyTimeData {
  dia: string;
  tiempo: number;
}

interface ConceptProgressData {
  fecha: string;
  dominados: number;
  aprendiendo: number;
  total: number;
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
  // Points for each activity type
  puntosRepasoInteligente: number;
  puntosEstudioActivo: number;
  puntosEstudioLibre: number;
  puntosQuiz: number;
  puntosJuegos: number;
}

const ProgressPage: React.FC = () => {
  const { isSchoolUser, isSchoolStudent, isTeacher, isSchoolAdmin } = useUserType();
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
      calculateConceptProgress();
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
      
      // Cargar racha del usuario en paralelo
      const loadUserStreak = async () => {
        try {
          const studyStreakService = await import('../services/studyStreakService');
          const streakServiceInstance = studyStreakService.StudyStreakService.getInstance();
          
          // Obtener racha y estado de estudio hoy
          const [streakData, studiedToday] = await Promise.all([
            streakServiceInstance.getUserStreak(userId),
            streakServiceInstance.hasStudiedToday(userId)
          ]);
          
          const streakBonusValue = streakServiceInstance.getStreakBonus(streakData.currentStreak);
          
          setCurrentStreak(streakData.currentStreak);
          setStreakBonus(streakBonusValue);
          setHasStudiedToday(studiedToday);
          
          console.log('[ProgressPage] Racha cargada:', streakData.currentStreak, 'Bonus:', streakBonusValue, 'Estudiado hoy:', studiedToday);
        } catch (error) {
          console.error('[ProgressPage] Error cargando racha:', error);
          setCurrentStreak(0);
          setStreakBonus(0);
          setHasStudiedToday(false);
        }
      };
      
      // Cargar conceptos dominados
      const loadConceptsDominated = async () => {
        try {
          const conceptStats = await kpiService.getTotalDominatedConceptsByUser(userId);
          setConceptsDominated(conceptStats.conceptosDominados || 0);
          console.log('[ProgressPage] Conceptos dominados cargados:', conceptStats.conceptosDominados);
        } catch (error) {
          console.error('[ProgressPage] Error cargando conceptos dominados:', error);
          setConceptsDominated(0);
        }
      };

      // Cargar materias y cuadernos activos
      const loadActiveStats = async () => {
        try {
          const firebase = await import('../services/firebase');
          
          // Contar materias del usuario (propias)
          const userMateriasQuery = await firebase.getDocs(
            firebase.query(
              firebase.collection(firebase.db, 'materias'), 
              firebase.where('userId', '==', userId)
            )
          );
          const userMateriasCount = userMateriasQuery.size;
          
          // Contar materias de profesores en los que está inscrito
          const userEnrollmentsQuery = await firebase.getDocs(
            firebase.query(
              firebase.collection(firebase.db, 'enrollments'), 
              firebase.where('studentId', '==', userId)
            )
          );
          
          const enrolledMateriasSet = new Set();
          for (const enrollmentDoc of userEnrollmentsQuery.docs) {
            const enrollmentData = enrollmentDoc.data();
            enrolledMateriasSet.add(enrollmentData.materiaId);
          }
          
          const totalMaterias = userMateriasCount + enrolledMateriasSet.size;
          
          // Contar cuadernos activos (propios)
          const ownNotebooksQuery = await firebase.getDocs(
            firebase.query(firebase.collection(firebase.db, 'notebooks'), firebase.where('userId', '==', userId))
          );
          
          // Contar cuadernos de materias inscritas
          const enrollmentsQuery = await firebase.getDocs(
            firebase.query(firebase.collection(firebase.db, 'enrollments'), firebase.where('studentId', '==', userId))
          );
          
          let enrolledNotebooksCount = 0;
          for (const enrollmentDoc of enrollmentsQuery.docs) {
            const enrollmentData = enrollmentDoc.data();
            const teacherNotebooksQuery = await firebase.getDocs(
              firebase.query(
                firebase.collection(firebase.db, 'notebooks'), 
                firebase.where('materiaId', '==', enrollmentData.materiaId)
              )
            );
            enrolledNotebooksCount += teacherNotebooksQuery.size;
          }
          
          const activeNotebooks = ownNotebooksQuery.size + enrolledNotebooksCount;
          
          setMateriasActivas(totalMaterias);
          setCuadernosActivos(activeNotebooks);
          
          console.log('[ProgressPage] Materias activas:', totalMaterias, 'Cuadernos activos:', activeNotebooks);
        } catch (error) {
          console.error('[ProgressPage] Error cargando estadísticas activas:', error);
          setMateriasActivas(0);
          setCuadernosActivos(0);
        }
      };

      // Ejecutar todas las promesas en paralelo
      await Promise.all([
        loadUserStreak(),
        loadConceptsDominated(),
        loadActiveStats(),
        (async () => {
          // Esperar KPIs primero ya que son necesarios para las materias
          const kpis = await kpisPromise;
          if (kpis) {
            setKpisData(kpis);
            // Obtener tiempo total de los KPIs
            const totalMinutes = kpis.global?.tiempoEstudioGlobal || 0;
            setTotalTime(totalMinutes);
            console.log('[ProgressPage] Tiempo total cargado:', totalMinutes);
            // Cargar materias inmediatamente después de KPIs
            await loadMaterias(userId, effectiveUserData?.isSchoolUser || false, kpis);
          }
        })()
      ]);
      
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
      
      // Actualizar si no hay KPIs, si son muy antiguos (más de 1 hora), o si no tienen cuadernos
      const hasNoCuadernos = !kpis?.cuadernos || Object.keys(kpis.cuadernos).length === 0;
      const shouldUpdate = !kpis || !kpis.ultimaActualizacion || 
        (Date.now() - (kpis.ultimaActualizacion?.toDate?.()?.getTime() || 0)) > 3600000 ||
        hasNoCuadernos;
      
      if (shouldUpdate) {
        if (hasNoCuadernos) {
          console.log('[ProgressPage] KPIs sin cuadernos, forzando actualización...');
        } else {
          console.log('[ProgressPage] Actualizando KPIs...');
        }
        await kpiService.updateUserKPIs(userId);
        // Obtener KPIs actualizados
        kpis = await kpiService.getUserKPIs(userId);
        console.log('[ProgressPage] KPIs actualizados:', kpis);
      } else {
        console.log('[ProgressPage] Usando KPIs existentes (actualizados hace menos de 1 hora)');
      }
      
      console.log('[ProgressPage] KPIs obtenidos:', kpis);
      console.log('[ProgressPage] Cuadernos en KPIs:', Object.keys(kpis?.cuadernos || {}));
      
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
      
      if (isSchoolUser) {
        // Para usuarios escolares, verificar el rol del usuario
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.schoolRole === 'teacher') {
            // Para profesores, buscar las materias de sus notebooks
            console.log('[ProgressPage] Usuario es profesor, buscando materias de sus notebooks');
            
            const notebooksQuery = query(
              collection(db, 'schoolNotebooks'),
              where('idProfesor', '==', userId)
            );
            const notebooksSnap = await getDocs(notebooksQuery);
            
            const materiaIds = new Set<string>();
            notebooksSnap.forEach(doc => {
              const notebookData = doc.data();
              if (notebookData.idMateria) {
                materiaIds.add(notebookData.idMateria);
              }
            });
            
            console.log('[ProgressPage] IDs de materias encontradas:', Array.from(materiaIds));
            
            // Cargar información de cada materia
            for (const materiaId of materiaIds) {
              try {
                const subjectDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
                if (subjectDoc.exists()) {
                  const subjectData = subjectDoc.data();
                  materiasArray.push({
                    id: materiaId,
                    nombre: subjectData.nombre || subjectData.name || 'Sin nombre'
                  });
                }
              } catch (error) {
                console.error('[ProgressPage] Error cargando materia:', materiaId, error);
              }
            }
            
            // Si no se encontraron materias, crear una materia genérica para mostrar progreso general
            if (materiasArray.length === 0) {
              console.log('[ProgressPage] No se encontraron materias, creando vista general');
              materiasArray.push({
                id: 'general',
                nombre: 'Progreso General'
              });
            }
          } else if (userData.schoolRole === 'student') {
            // Para estudiantes escolares, buscar sus materias asignadas
            console.log('[ProgressPage] Usuario escolar (estudiante), buscando materias asignadas');
            console.log('[ProgressPage] Datos del usuario:', userData);
            
            let materiaIds = new Set<string>();
            
            // Primero verificar si el usuario tiene subjectIds (este es el campo correcto para estudiantes)
            if (userData.subjectIds && Array.isArray(userData.subjectIds)) {
              console.log('[ProgressPage] subjectIds encontrados en usuario:', userData.subjectIds);
              userData.subjectIds.forEach((id: string) => materiaIds.add(id));
            }
            
            // También verificar idMaterias (otro posible campo)
            if (userData.idMaterias && Array.isArray(userData.idMaterias)) {
              console.log('[ProgressPage] idMaterias encontrados en usuario:', userData.idMaterias);
              userData.idMaterias.forEach((id: string) => materiaIds.add(id));
            }
            
            // Si no encontramos materias directamente, buscar en schoolStudents
            if (materiaIds.size === 0) {
              const studentQuery = query(
                collection(db, 'schoolStudents'),
                where('idUsuario', '==', userId)
              );
              const studentSnap = await getDocs(studentQuery);
              
              if (!studentSnap.empty) {
                const studentData = studentSnap.docs[0].data();
                console.log('[ProgressPage] Datos de schoolStudents:', studentData);
                
                if (studentData.idMaterias && Array.isArray(studentData.idMaterias)) {
                  studentData.idMaterias.forEach((id: string) => materiaIds.add(id));
                }
                if (studentData.subjectIds && Array.isArray(studentData.subjectIds)) {
                  studentData.subjectIds.forEach((id: string) => materiaIds.add(id));
                }
              }
            }
            
            // Si aún no hay materias, buscar en las asignaciones del admin/profesor
            if (materiaIds.size === 0 && userData.idAdmin) {
              console.log('[ProgressPage] Buscando materias asignadas por admin:', userData.idAdmin);
              
              // Buscar materias donde el estudiante esté asignado
              const subjectsQuery = query(
                collection(db, 'schoolSubjects'),
                where('idEstudiantes', 'array-contains', userId)
              );
              const subjectsSnap = await getDocs(subjectsQuery);
              
              subjectsSnap.forEach(doc => {
                console.log('[ProgressPage] Materia donde estudiante está asignado:', doc.id);
                materiaIds.add(doc.id);
              });
            }
            
            // También incluir materias de KPIs si existen
            if (kpis?.materias) {
              Object.keys(kpis.materias).forEach(materiaId => {
                materiaIds.add(materiaId);
              });
            }
            
            console.log('[ProgressPage] IDs de materias encontradas:', Array.from(materiaIds));
            
            // Cargar información de cada materia
            for (const materiaId of materiaIds) {
              try {
                const subjectDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
                if (subjectDoc.exists()) {
                  const subjectData = subjectDoc.data();
                  materiasArray.push({
                    id: materiaId,
                    nombre: subjectData.nombre || subjectData.name || 'Sin nombre'
                  });
                }
              } catch (error) {
                console.error('[ProgressPage] Error cargando materia:', materiaId, error);
              }
            }
            
            // Si no se encontraron materias, crear una materia genérica para mostrar progreso general
            if (materiasArray.length === 0) {
              console.log('[ProgressPage] No se encontraron materias, creando vista general');
              materiasArray.push({
                id: 'general',
                nombre: 'Progreso General'
              });
            }
          } else {
            console.log('[ProgressPage] Rol de usuario escolar no reconocido:', userData.schoolRole);
          }
        }
        console.log('[ProgressPage] Materias procesadas para usuario escolar:', materiasArray);
      } else {
        // Para usuarios regulares, buscar materias propias y materias inscritas
        // 1. Buscar materias propias
        const materiasQuery = query(
          collection(db, 'materias'),
          where('userId', '==', userId)
        );
        const materiasSnap = await getDocs(materiasQuery);
        
        console.log('[ProgressPage] Materias propias encontradas:', materiasSnap.size);
        
        // Agregar materias propias
        materiasSnap.forEach((doc: any) => {
          const data = doc.data();
          console.log('[ProgressPage] Materia propia:', { id: doc.id, data });
          materiasArray.push({
            id: doc.id,
            nombre: data.nombre || data.title || 'Sin nombre'
          });
        });
        
        // 2. Buscar materias donde está inscrito
        console.log('[ProgressPage] Buscando enrollments para userId:', userId);
        const enrollmentsQuery = query(
          collection(db, 'enrollments'),
          where('studentId', '==', userId),
          where('status', '==', 'active')
        );
        const enrollmentsSnap = await getDocs(enrollmentsQuery);
        
        console.log('[ProgressPage] Enrollments activos encontrados:', enrollmentsSnap.size);
        
        // Si no se encontraron enrollments activos, buscar TODOS los enrollments del usuario
        if (enrollmentsSnap.size === 0) {
          console.log('[ProgressPage] No hay enrollments activos. Buscando TODOS los enrollments...');
          const allEnrollmentsQuery = query(
            collection(db, 'enrollments'),
            where('studentId', '==', userId)
          );
          const allEnrollmentsSnap = await getDocs(allEnrollmentsQuery);
          console.log('[ProgressPage] TODOS los enrollments encontrados:', allEnrollmentsSnap.size);
          
          allEnrollmentsSnap.docs.forEach(doc => {
            const data = doc.data();
            console.log(`[ProgressPage] Enrollment (cualquier status):`, {
              id: doc.id,
              materiaId: data.materiaId,
              studentId: data.studentId,
              teacherId: data.teacherId,
              status: data.status
            });
          });
        }
        
        // Debug: Mostrar todos los enrollments encontrados
        enrollmentsSnap.docs.forEach(doc => {
          const data = doc.data();
          console.log(`[ProgressPage] Enrollment encontrado:`, {
            id: doc.id,
            materiaId: data.materiaId,
            studentId: data.studentId,
            teacherId: data.teacherId,
            status: data.status
          });
        });
        
        // Para cada enrollment, obtener la materia del profesor
        for (const enrollmentDoc of enrollmentsSnap.docs) {
          const enrollmentData = enrollmentDoc.data();
          const materiaId = enrollmentData.materiaId;
          
          // Verificar que no esté ya en la lista (evitar duplicados)
          if (!materiasArray.find(m => m.id === materiaId)) {
            const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
            if (materiaDoc.exists()) {
              const materiaData = materiaDoc.data();
              console.log('[ProgressPage] Materia inscrita:', { id: materiaId, data: materiaData, teacherId: enrollmentData.teacherId });
              materiasArray.push({
                id: materiaId,
                nombre: materiaData.nombre || materiaData.title || 'Sin nombre',
                teacherId: enrollmentData.teacherId
              });
            }
          }
        }
        
        if (materiasArray.length === 0) {
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
      
      // Para usuarios regulares, si no hay materias pero hay KPIs de materias, extraerlas de ahí
      if (!isSchoolUser && materiasArray.length === 0 && kpisData?.materias) {
        console.log('[ProgressPage] Extrayendo materias de KPIs para usuario regular...');
        const materiasFromKpis = Object.keys(kpisData.materias);
        for (const materiaId of materiasFromKpis) {
          // Intentar obtener el nombre de la materia desde Firestore
          try {
            const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
            if (materiaDoc.exists()) {
              const materiaData = materiaDoc.data();
              materiasArray.push({
                id: materiaId,
                nombre: materiaData.nombre || materiaData.title || 'Materia'
              });
            } else {
              // Si no existe en Firestore, usar el ID como nombre
              materiasArray.push({
                id: materiaId,
                nombre: materiaId
              });
            }
          } catch (error) {
            console.log(`[ProgressPage] Error obteniendo materia ${materiaId}:`, error);
            // Usar el ID como fallback
            materiasArray.push({
              id: materiaId,
              nombre: materiaId
            });
          }
        }
      }
      
      // Si aún no hay materias pero hay un score global, crear una materia general
      if (materiasArray.length === 0 && kpisData?.global?.scoreGlobal > 0) {
        console.log('[ProgressPage] Creando materia general basada en score global');
        materiasArray.push({
          id: 'general',
          nombre: 'General'
        });
      }
      
      console.log('[ProgressPage] Materias finales:', materiasArray);
      console.log('[ProgressPage] Total de materias encontradas:', materiasArray.length);
      materiasArray.forEach(m => console.log(`[ProgressPage] - Materia: ${m.nombre} (ID: ${m.id})`));
      
      setMaterias(materiasArray);
      
      // Priorizar materias inscritas sobre materias propias
      if (materiasArray.length > 0 && !selectedMateria) {
        // Buscar si hay materias donde el usuario está inscrito como estudiante
        let materiaToSelect = materiasArray[0]; // fallback
        
        // Verificar enrollments para priorizar materias inscritas
        try {
          const enrollmentsQuery = query(
            collection(db, 'enrollments'),
            where('studentId', '==', userId),
            where('status', '==', 'active')
          );
          const enrollmentsSnap = await getDocs(enrollmentsQuery);
          
          if (enrollmentsSnap.size > 0) {
            // Buscar la primera materia inscrita que esté en nuestra lista
            for (const enrollmentDoc of enrollmentsSnap.docs) {
              const enrollmentData = enrollmentDoc.data();
              const inscribedMateria = materiasArray.find(m => m.id === enrollmentData.materiaId);
              if (inscribedMateria) {
                materiaToSelect = inscribedMateria;
                console.log('[ProgressPage] Priorizando materia inscrita:', materiaToSelect);
                break;
              }
            }
          }
        } catch (error) {
          console.log('[ProgressPage] Error verificando enrollments para selección:', error);
        }
        
        console.log('[ProgressPage] Seleccionando materia por defecto:', materiaToSelect);
        setSelectedMateria(materiaToSelect.id);
      }
    } catch (error) {
      console.error('[ProgressPage] Error cargando materias:', error);
    }
  };

  // Helper function to calculate points for a notebook using direct Firebase queries (same as StudyModePage)
  const calculateNotebookPoints = async (notebookId: string, userId: string) => {
    console.log(`[ProgressPage] calculateNotebookPoints called for ${notebookId}, userId: ${userId}`);
    try {
      // Use the same queries as StudyModePage - query studySessions collection directly
      const [
        smartStudySessions,
        voiceRecognitionSessions, 
        freeStudySessions,
        quizStatsDoc,
        notebookPoints,
        userStreak,
        domainProgress
      ] = await Promise.all([
        // Smart study sessions - query studySessions collection with mode filter
        getDocs(query(
          collection(db, 'studySessions'),
          where('userId', '==', userId),
          where('notebookId', '==', notebookId),
          where('mode', '==', 'smart'),
          where('validated', '==', true),
          limit(100)
        )),
        // Voice recognition sessions - query studySessions collection with mode filter  
        getDocs(query(
          collection(db, 'studySessions'),
          where('userId', '==', userId),
          where('notebookId', '==', notebookId),
          where('mode', '==', 'voice_recognition'),
          where('validated', '==', true),
          limit(100)
        )),
        // Free study sessions - query studySessions collection with mode filter
        getDocs(query(
          collection(db, 'studySessions'),
          where('userId', '==', userId),
          where('notebookId', '==', notebookId),
          where('mode', '==', 'free'),
          limit(100)
        )),
        // Quiz stats
        getDoc(doc(db, 'users', userId, 'quizStats', notebookId)),
        // Game points
        gamePointsService.getNotebookPoints(userId, notebookId).catch(() => ({ totalPoints: 0 })),
        // User streak
        studyStreakService.getUserStreak(userId).catch(() => ({ currentStreak: 0 })),
        // Domain progress data (concepts dominated and total)
        getDomainProgressForNotebook(notebookId)
      ]);

      console.log(`[ProgressPage] DEBUG: Smart study sessions found: ${smartStudySessions.size}`);
      console.log(`[ProgressPage] DEBUG: Voice recognition sessions found: ${voiceRecognitionSessions.size}`);
      console.log(`[ProgressPage] DEBUG: Free study sessions found: ${freeStudySessions.size}`);

      // Calculate smart study points based on intensity (same as StudyModePage)
      let smartStudyPoints = 0;
      smartStudySessions.forEach((doc) => {
        const sessionData = doc.data();
        const intensity = sessionData.intensity || 'warm_up';
        console.log(`[ProgressPage] DEBUG: Smart study session intensity: ${intensity}`, sessionData);
        
        switch(intensity) {
          case 'warm_up':
            smartStudyPoints += 0.5;
            break;
          case 'progress':
            smartStudyPoints += 1.0;
            break;
          case 'rocket':
            smartStudyPoints += 2.0;
            break;
          default:
            smartStudyPoints += 0.5;
        }
      });

      // Calculate voice recognition points (same as StudyModePage)
      let voiceRecognitionPoints = 0;
      voiceRecognitionSessions.forEach((doc) => {
        const sessionData = doc.data();
        const sessionScore = sessionData.sessionScore || sessionData.finalSessionScore || 0;
        console.log(`[ProgressPage] DEBUG: Voice session data:`, {
          docId: doc.id,
          sessionScore: sessionData.sessionScore,
          finalSessionScore: sessionData.finalSessionScore,
          calculatedScore: sessionScore,
          notebookId: sessionData.notebookId
        });
        voiceRecognitionPoints += sessionScore;
      });

      // Calculate free study points
      const freeStudyCount = freeStudySessions.size;
      const freeStudyPoints = freeStudyCount * 0.1;

      // Get quiz points
      const quizPoints = quizStatsDoc.exists() ? (quizStatsDoc.data().maxScore || 0) : 0;

      // Get game points
      const gamePointsValue = notebookPoints.totalPoints || 0;

      // Calculate streak bonus (same as StudyModePage)
      const streakBonus = studyStreakService.getStreakBonus(userStreak.currentStreak);

      // Calculate individual points
      const puntosRepasoInteligente = Math.round(smartStudyPoints * 1000);
      const puntosEstudioActivo = Math.round(voiceRecognitionPoints * 1000);
      const puntosEstudioLibre = Math.round(freeStudyPoints * 1000);
      const puntosQuiz = quizPoints;
      const puntosJuegos = gamePointsValue;

      // Calculate domain percentage (same as MateriaItem)
      const porcentajeDominio = domainProgress.total > 0 
        ? Math.round((domainProgress.dominated / domainProgress.total) * 100)
        : 0;

      // Calculate score general as sum of all points + streak bonus
      const scoreGeneral = puntosRepasoInteligente + puntosEstudioActivo + puntosEstudioLibre + puntosQuiz + puntosJuegos + streakBonus;

      const result = {
        puntosRepasoInteligente,
        puntosEstudioActivo,
        puntosEstudioLibre,
        puntosQuiz,
        puntosJuegos,
        score: scoreGeneral, // Override the score with calculated value
        porcentajeDominio: porcentajeDominio // Override with calculated domain percentage
      };
      
      console.log(`[ProgressPage] DEBUG: Calculated points for ${notebookId}:`, {
        smartStudyPoints: smartStudyPoints,
        voiceRecognitionPoints: voiceRecognitionPoints,
        freeStudyPoints: freeStudyPoints,
        streakBonus: streakBonus,
        currentStreak: userStreak.currentStreak,
        scoreGeneral: scoreGeneral,
        porcentajeDominio: porcentajeDominio,
        domainProgress: domainProgress,
        result: result
      });
      
      return result;

    } catch (error) {
      console.error(`[ProgressPage] Error calculating points for notebook ${notebookId}:`, error);
      return {
        puntosRepasoInteligente: 0,
        puntosEstudioActivo: 0,
        puntosEstudioLibre: 0,
        puntosQuiz: 0,
        puntosJuegos: 0,
        score: 0,
        porcentajeDominio: 0
      };
    }
  };

  const processCuadernosData = async () => {
    console.log('[ProgressPage] processCuadernosData called');
    if (!auth.currentUser || !kpisData) return;
    
    try {
      console.log('[ProgressPage] === PROCESANDO DATOS DE CUADERNOS ===');
      console.log('[ProgressPage] Materia seleccionada:', selectedMateria);
      console.log('[ProgressPage] KPIs cuadernos:', kpisData.cuadernos);
    
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
          
          // Para profesores, buscar notebooks por idProfesor
          if (userData.schoolRole === 'teacher') {
            console.log('[ProgressPage] Usuario es profesor, buscando notebooks por idProfesor');
            const notebooksQuery = query(
              collection(db, 'schoolNotebooks'),
              where('idProfesor', '==', userId)
            );
            const notebooksSnap = await getDocs(notebooksQuery);
            
            console.log(`[ProgressPage] Notebooks encontrados para profesor: ${notebooksSnap.size}`);
            
            notebooksSnap.forEach((doc) => {
              const notebookData = doc.data();
              notebookNames.set(doc.id, notebookData.title || 'Sin nombre');
              notebookMaterias.set(doc.id, notebookData.idMateria || '');
              console.log(`[ProgressPage] Notebook profesor ${doc.id}: ${notebookData.title}, materia: ${notebookData.idMateria}`);
            });
          } else {
            // Para estudiantes, buscar notebooks de varias formas
            console.log('[ProgressPage] Usuario es estudiante, buscando notebooks');
            
            // Primero intentar con idCuadernos si existe
            const idCuadernos = userData.idCuadernos || [];
            console.log('[ProgressPage] idCuadernos del estudiante:', idCuadernos);
            
            if (idCuadernos.length > 0) {
              for (const cuadernoId of idCuadernos) {
                const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', cuadernoId));
                if (notebookDoc.exists()) {
                  const notebookData = notebookDoc.data();
                  notebookNames.set(cuadernoId, notebookData.title || 'Sin nombre');
                  notebookMaterias.set(cuadernoId, notebookData.idMateria || '');
                  console.log(`[ProgressPage] Cuaderno de idCuadernos ${cuadernoId}: ${notebookData.title}, materia: ${notebookData.idMateria}`);
                }
              }
            }
            
            // Si no hay idCuadernos o está vacío, buscar notebooks de la materia seleccionada
            if (notebookNames.size === 0 && selectedMateria && selectedMateria !== 'general') {
              console.log('[ProgressPage] Buscando notebooks de la materia:', selectedMateria);
              
              // Buscar notebooks de la materia que sean del profesor
              const materiaNotebooksQuery = query(
                collection(db, 'schoolNotebooks'),
                where('idMateria', '==', selectedMateria)
              );
              const materiaNotebooksSnap = await getDocs(materiaNotebooksQuery);
              
              console.log(`[ProgressPage] Notebooks encontrados para materia ${selectedMateria}: ${materiaNotebooksSnap.size}`);
              
              materiaNotebooksSnap.forEach(doc => {
                const notebookData = doc.data();
                // Solo incluir notebooks que tengan idProfesor (son del profesor)
                if (notebookData.idProfesor) {
                  notebookNames.set(doc.id, notebookData.title || 'Sin nombre');
                  notebookMaterias.set(doc.id, notebookData.idMateria || '');
                  console.log(`[ProgressPage] Notebook de materia ${doc.id}: ${notebookData.title}`);
                }
              });
            }
          }
        }
      } else {
        // Para usuarios regulares, obtener información de notebooks propios y de profesores inscritos
        
        // 1. Notebooks propios
        const ownNotebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', userId)
        );
        const ownNotebooksSnap = await getDocs(ownNotebooksQuery);
        
        ownNotebooksSnap.forEach((doc) => {
          const notebookData = doc.data();
          notebookNames.set(doc.id, notebookData.title || 'Sin nombre');
          notebookMaterias.set(doc.id, notebookData.subjectId || notebookData.materiaId || '');
          console.log(`[ProgressPage] Notebook propio ${doc.id}: ${notebookData.title}, materia: ${notebookData.subjectId || notebookData.materiaId}`);
        });
        
        // 2. Notebooks de materias inscritas
        const enrollmentsQuery = query(
          collection(db, 'enrollments'),
          where('studentId', '==', userId),
          where('status', '==', 'active')
        );
        const enrollmentsSnap = await getDocs(enrollmentsQuery);
        
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
          
          teacherNotebooksSnap.forEach((doc) => {
            const notebookData = doc.data();
            notebookNames.set(doc.id, notebookData.title || 'Sin nombre');
            notebookMaterias.set(doc.id, notebookData.materiaId || '');
            console.log(`[ProgressPage] Notebook inscrito ${doc.id}: ${notebookData.title}, materia: ${notebookData.materiaId}`);
          });
        }
      }
      
      if (!selectedMateria || selectedMateria === 'general') {
        // Mostrar todos los cuadernos del estudiante
        console.log('[ProgressPage] Vista general - buscando todos los cuadernos del estudiante');
        
        // Para estudiantes escolares, buscar todos sus notebooks de estudio
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.exists() ? userDoc.data() : null;
        
        if (isSchoolUser && userData?.schoolRole === 'student') {
          // Buscar en learningData todos los notebooks que el estudiante ha estudiado
          const learningQuery = query(
            collection(db, 'learningData'),
            where('userId', '==', userId)
          );
          
          try {
            const learningSnap = await getDocs(learningQuery);
            const studiedNotebooks = new Set<string>();
            
            learningSnap.forEach(doc => {
              const data = doc.data();
              if (data.notebookId) {
                studiedNotebooks.add(data.notebookId);
              }
            });
            
            console.log('[ProgressPage] Notebooks estudiados por el estudiante:', Array.from(studiedNotebooks));
            
            // Para cada notebook estudiado, obtener sus datos
            for (const notebookId of studiedNotebooks) {
              try {
                const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
                if (notebookDoc.exists()) {
                  const notebookData = notebookDoc.data();
                  const cuadernoKPI = kpisData.cuadernos?.[notebookId] || {};
                  
                  cuadernosTemp.push({
                    id: notebookId,
                    nombre: notebookData.title || 'Sin nombre',
                    score: cuadernoKPI.scoreCuaderno || 0,
                    posicion: cuadernoKPI.posicionRanking || 1,
                    totalAlumnos: cuadernoKPI.totalAlumnos || 1,
                    conceptos: cuadernoKPI.conceptosTotales || 0,
                    tiempoEstudio: cuadernoKPI.tiempoEstudio || 0,
                    estudiosInteligentes: cuadernoKPI.estudiosInteligentes || 0,
                    porcentajeExito: cuadernoKPI.porcentajeExito || 0,
                    porcentajeDominio: cuadernoKPI.porcentajeDominio || 0,
                    estudiosLibres: cuadernoKPI.estudiosLibres || 0,
                    juegosJugados: cuadernoKPI.juegosJugados || 0,
                    // Points will be calculated later
                    puntosRepasoInteligente: 0,
                    puntosEstudioActivo: 0,
                    puntosEstudioLibre: 0,
                    puntosQuiz: 0,
                    puntosJuegos: 0
                  });
                }
              } catch (error) {
                console.error('[ProgressPage] Error cargando notebook:', notebookId, error);
              }
            }
          } catch (error) {
            console.error('[ProgressPage] Error buscando notebooks estudiados:', error);
          }
        }
        
        // También incluir cuadernos de KPIs si no se encontraron de otra forma
        if (cuadernosTemp.length === 0) {
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
              juegosJugados: cuadernoData.juegosJugados || 0,
              // Points will be calculated later
              puntosRepasoInteligente: 0,
              puntosEstudioActivo: 0,
              puntosEstudioLibre: 0,
              puntosQuiz: 0,
              puntosJuegos: 0
            });
        });
        }
      } else {
        // Filtrar por materia seleccionada
        console.log('[ProgressPage] Filtrando cuadernos por materia:', selectedMateria);
        console.log('[ProgressPage] Notebooks con materias:', Array.from(notebookMaterias.entries()));
        
        // Primero, procesar cuadernos que están en KPIs
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
              juegosJugados: cuadernoData.juegosJugados || 0,
              // Points will be calculated later
              puntosRepasoInteligente: 0,
              puntosEstudioActivo: 0,
              puntosEstudioLibre: 0,
              puntosQuiz: 0,
              puntosJuegos: 0
            });
          }
        });
        
        // Luego, agregar cuadernos que no están en KPIs pero sí están asignados
        notebookMaterias.forEach((materiaId, cuadernoId) => {
          // Verificar si ya fue agregado
          const yaAgregado = cuadernosTemp.some(c => c.id === cuadernoId);
          
          // Si el cuaderno no está en KPIs pero su materia coincide y no ha sido agregado
          if (materiaId === selectedMateria && !yaAgregado) {
            const nombreCuaderno = notebookNames.get(cuadernoId) || 'Sin nombre';
            
            console.log(`[ProgressPage] Agregando cuaderno: ${cuadernoId} - ${nombreCuaderno}`);
            
            // Buscar datos del cuaderno en KPIs si existe
            const cuadernoKPI = kpisData.cuadernos?.[cuadernoId] || {};
            console.log(`[ProgressPage] Datos KPI para ${cuadernoId}:`, cuadernoKPI);
            console.log(`[ProgressPage] Todos los cuadernos en KPIs:`, Object.keys(kpisData.cuadernos || {}));
            
            // Si no hay datos KPI y el cuaderno existe, intentar forzar actualización
            if (Object.keys(cuadernoKPI).length === 0) {
              console.log(`[ProgressPage] ⚠️ No hay datos KPI para ${cuadernoId}, considere actualizar KPIs`);
              // TODO: Aquí podríamos llamar a updateUserKPIs si es necesario
            }
            
            cuadernosTemp.push({
              id: cuadernoId,
              nombre: nombreCuaderno,
              score: cuadernoKPI.scoreCuaderno || 0,
              posicion: cuadernoKPI.posicionRanking || 1,
              totalAlumnos: cuadernoKPI.totalAlumnos || 1,
              conceptos: cuadernoKPI.conceptosTotales || cuadernoKPI.numeroConceptos || 0,
              tiempoEstudio: cuadernoKPI.tiempoEstudio || cuadernoKPI.tiempoEstudioLocal || 0,
              estudiosInteligentes: cuadernoKPI.estudiosInteligentes || cuadernoKPI.estudiosInteligentesLocal || 0,
              porcentajeExito: cuadernoKPI.porcentajeExito || cuadernoKPI.porcentajeExitoEstudiosInteligentes || 0,
              porcentajeDominio: cuadernoKPI.porcentajeDominio || cuadernoKPI.porcentajeDominioConceptos || 0,
              estudiosLibres: cuadernoKPI.estudiosLibres || cuadernoKPI.estudiosLibresLocal || 0,
              juegosJugados: cuadernoKPI.juegosJugados || 0,
              // Points will be calculated later
              puntosRepasoInteligente: 0,
              puntosEstudioActivo: 0,
              puntosEstudioLibre: 0,
              puntosQuiz: 0,
              puntosJuegos: 0
            });
          }
        });
      }
      
      console.log('[ProgressPage] Cuadernos procesados:', cuadernosTemp.length);
      cuadernosTemp.forEach(c => {
        console.log(`[ProgressPage] - ${c.nombre}: score=${c.score}, pos=${c.posicion}, tiempo=${c.tiempoEstudio}min`);
      });
      
      // Calculate points for each notebook (same as StudyModePage)
      console.log('[ProgressPage] Calculating points for each notebook...');
      const pointsUserData = await getEffectiveUserId();
      const pointsUserId = pointsUserData ? pointsUserData.id : auth.currentUser.uid;
      
      // Use Promise.all to calculate all points in parallel for better performance
      const notebooksWithPoints = await Promise.all(
        cuadernosTemp.map(async (notebook) => {
          console.log(`[ProgressPage] Calculating points for ${notebook.nombre}...`);
          
          const points = await calculateNotebookPoints(notebook.id, pointsUserId);
          
          console.log(`[ProgressPage] Points for ${notebook.nombre}:`, points);
          
          return {
            ...notebook,
            ...points
          };
        })
      );
      
      console.log('[ProgressPage] All notebooks with calculated points:', notebooksWithPoints);
      
      setCuadernosReales(notebooksWithPoints);
    } catch (error) {
      console.error('[ProgressPage] Error procesando cuadernos:', error);
      setCuadernosReales([]);
    }
  };

  const calculateRanking = async () => {
    if (!auth.currentUser || !kpisData) return;

    setRankingLoading(true);
    
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      const isSchoolUser = effectiveUserData?.isSchoolUser || false;
      
      console.log('[ProgressPage] Calculando ranking para materia:', selectedMateria);
      console.log('[ProgressPage] Es usuario escolar:', isSchoolUser);
      
      // Primero intentar obtener ranking basado en enrollments (funciona para todos los usuarios)
      if (!selectedMateria || selectedMateria === 'general') {
        // Para vista general, mostrar el score global
        const globalScore = kpisData?.global?.scoreGlobal || 0;
        setRankingData([{ 
          posicion: 1, 
          nombre: 'Tú', 
          score: Math.ceil(globalScore) 
        }]);
        return;
      }

      // Para una materia específica, intentar obtener ranking basado en enrollments
      console.log('[ProgressPage] Intentando obtener ranking de enrollments para materia:', selectedMateria);
      
      // Buscar el objeto materia para obtener el teacherId
      const materiaObj = materias.find(m => m.id === selectedMateria);
      const teacherId = materiaObj?.teacherId;
      
      console.log('[ProgressPage] Materia encontrada:', materiaObj);
      console.log('[ProgressPage] TeacherId para ranking:', teacherId);
      
      try {
        const enrollmentRanking = await MateriaRankingService.getMateriaRanking(
          selectedMateria,
          userId,
          teacherId
        );
        
        if (enrollmentRanking && enrollmentRanking.length > 1) {
          console.log('[ProgressPage] Ranking de enrollments encontrado:', enrollmentRanking);
          setRankingData(enrollmentRanking);
          return;
        }
      } catch (error) {
        console.log('[ProgressPage] Error obteniendo ranking de enrollments:', error);
      }

      // Si no hay ranking de enrollments o solo hay un usuario, intentar lógica de institución
      console.log('[ProgressPage] Intentando lógica de institución como fallback...');

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
        console.log('[ProgressPage] Usuario sin institución, mostrando solo score personal');
        // Fallback: mostrar solo el score personal
        const personalScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
        setRankingData([{ 
          posicion: 1, 
          nombre: 'Tú', 
          score: Math.ceil(personalScore) 
        }]);
        return;
      }

      // Obtener el ranking pre-calculado de la materia
      const ranking = await rankingService.getSubjectRanking(institutionId, selectedMateria);
      
      if (!ranking) {
        console.log('[ProgressPage] No se encontró ranking pre-calculado, calculando en tiempo real...');
        console.log(`[ProgressPage] Usuario actual tiene KPIs con ID: ${userId}`);
        
        // Calcular ranking en tiempo real
        try {
          // Obtener todos los estudiantes de la institución
          const studentsQuery = query(
            collection(db, 'users'),
            where('idInstitucion', '==', institutionId),
            where('schoolRole', '==', 'student')
          );
          
          const studentsSnapshot = await getDocs(studentsQuery);
          console.log(`[ProgressPage] =====================================`);
          console.log(`[ProgressPage] INFORMACIÓN DEL USUARIO ACTUAL:`);
          console.log(`[ProgressPage] - ID efectivo: ${userId}`);
          console.log(`[ProgressPage] - Score en materia ${selectedMateria}: ${kpisData?.materias?.[selectedMateria]?.scoreMateria || 0}`);
          console.log(`[ProgressPage] - KPIs cargados desde: users/${userId}/kpis/dashboard`);
          console.log(`[ProgressPage] =====================================`);
          console.log(`[ProgressPage] Estudiantes encontrados en la institución: ${studentsSnapshot.size}`);
          
          const studentScores = [];
          
          // Obtener KPIs de cada estudiante
          for (const studentDoc of studentsSnapshot.docs) {
            const studentData = studentDoc.data();
            const studentDocId = studentDoc.id;
            let effectiveStudentId = studentDocId; // Declarar fuera del try
            
            // Skip si es el usuario actual para evitar duplicados
            if (studentDocId === userId) {
              console.log(`[ProgressPage] Saltando usuario actual (${studentDocId})`);
              continue;
            }
            
            console.log(`[ProgressPage] =====================================`);
            console.log(`[ProgressPage] PROCESANDO ESTUDIANTE:`);
            console.log(`[ProgressPage] - Document ID: ${studentDocId}`);
            console.log(`[ProgressPage] - Email: ${studentData.email}`);
            console.log(`[ProgressPage] - Nombre: ${studentData.displayName || studentData.nombre}`);
            
            try {
              // Para usuarios escolares, usar directamente el ID del documento
              // Este es el mismo formato que usamos para el usuario actual
              effectiveStudentId = studentDocId;
              console.log(`[ProgressPage] Usando ID del documento: ${effectiveStudentId}`);
              
              // Para usuarios escolares, los KPIs están en una subcolección
              // Primero intentar con la subcolección (formato nuevo)
              let kpiDoc = await getDoc(doc(db, 'users', effectiveStudentId, 'kpis', 'dashboard'));
              console.log(`[ProgressPage] Buscando KPIs en subcolección users/${effectiveStudentId}/kpis/dashboard, encontrado: ${kpiDoc.exists()}`);
              
              // Si no existe en subcolección, intentar en colección userKPIs (formato antiguo)
              if (!kpiDoc.exists()) {
                console.log(`[ProgressPage] No encontrado en subcolección, intentando en userKPIs/${effectiveStudentId}`);
                kpiDoc = await getDoc(doc(db, 'userKPIs', effectiveStudentId));
                console.log(`[ProgressPage] Buscando KPIs en userKPIs con ID: ${effectiveStudentId}, encontrado: ${kpiDoc.exists()}`);
                
                // Si no existe y no tiene el prefijo school_, intentar con él
                if (!kpiDoc.exists() && !effectiveStudentId.startsWith('school_')) {
                  const schoolId = `school_${effectiveStudentId}`;
                  console.log(`[ProgressPage] Intentando con ID school_ en userKPIs: ${schoolId}`);
                  kpiDoc = await getDoc(doc(db, 'userKPIs', schoolId));
                  
                  if (kpiDoc.exists()) {
                    console.log(`[ProgressPage] KPIs encontrados en userKPIs con ID school_${effectiveStudentId}`);
                  }
                }
              }
              
              if (kpiDoc.exists()) {
                const studentKpis = kpiDoc.data();
                console.log(`[ProgressPage] KPIs encontrados para ${effectiveStudentId}:`, {
                  tieneMaterias: !!studentKpis.materias,
                  materiasKeys: studentKpis.materias ? Object.keys(studentKpis.materias) : [],
                  materiaSeleccionada: selectedMateria
                });
                
                const materiaScore = studentKpis.materias?.[selectedMateria]?.scoreMateria || 0;
                console.log(`[ProgressPage] Score de ${effectiveStudentId} en materia ${selectedMateria}: ${materiaScore}`);
                
                if (materiaScore >= 0) { // Cambiado de > 0 a >= 0 para incluir estudiantes con 0 puntos
                  studentScores.push({
                    id: effectiveStudentId,
                    nombre: studentData.displayName || studentData.email || 'Estudiante',
                    score: Math.ceil(materiaScore),
                    isCurrentUser: effectiveStudentId === userId
                  });
                  console.log(`[ProgressPage] Estudiante agregado al ranking: ${studentData.displayName} con score ${materiaScore}`);
                }
              } else {
                console.log(`[ProgressPage] No se encontraron KPIs para estudiante ${effectiveStudentId}`);
              }
            } catch (error) {
              console.log(`[ProgressPage] Error obteniendo KPIs de estudiante ${effectiveStudentId}:`, error);
            }
          }
          
          // Agregar al usuario actual si no está ya incluido
          const currentUserScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
          console.log(`[ProgressPage] Score del usuario actual: ${currentUserScore}`);
          
          // Verificar si el usuario actual ya está en la lista
          const currentUserInList = studentScores.some(s => s.id === userId);
          if (!currentUserInList && currentUserScore >= 0) {
            studentScores.push({
              id: userId,
              nombre: 'Tú',
              score: Math.ceil(currentUserScore),
              isCurrentUser: true
            });
            console.log(`[ProgressPage] Usuario actual agregado al ranking con score ${currentUserScore}`);
          }
          
          // Ordenar por score descendente
          studentScores.sort((a, b) => b.score - a.score);
          
          // Asignar posiciones
          const rankingToShow = studentScores.map((student, index) => ({
            posicion: index + 1,
            nombre: student.isCurrentUser ? 'Tú' : student.nombre,
            score: student.score,
            isCurrentUser: student.isCurrentUser
          }));
          
          console.log(`[ProgressPage] Ranking calculado con ${rankingToShow.length} estudiantes`);
          
          // Si hay datos, mostrar el ranking completo
          if (rankingToShow.length > 0) {
            setRankingData(rankingToShow); // Mostrar todos los usuarios
          } else {
            // Si no hay datos de otros estudiantes, mostrar solo al usuario actual
            const userScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
            setRankingData([{ 
              posicion: 1, 
              nombre: 'Tú', 
              score: Math.ceil(userScore) 
            }]);
          }
        } catch (error) {
          console.error('[ProgressPage] Error calculando ranking en tiempo real:', error);
          // En caso de error, mostrar solo al usuario actual
          const userScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
          setRankingData([{ 
            posicion: 1, 
            nombre: 'Tú', 
            score: Math.ceil(userScore) 
          }]);
        }
        
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
    } finally {
      setRankingLoading(false);
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

  const calculateConceptProgress = async () => {
    if (!effectiveUserId || !kpisData) return;
    
    console.log('[ProgressPage] === CALCULANDO PROGRESO DE CONCEPTOS ===');
    console.log('[ProgressPage] KPIs disponibles:', kpisData);
    console.log('[ProgressPage] Materia seleccionada:', selectedMateria);
    console.log('[ProgressPage] Cuadernos reales:', cuadernosReales);

    try {
      const progressData: ConceptProgressData[] = [];
      
      // Si hay una materia seleccionada, usar los datos de esa materia
      if (selectedMateria && kpisData.materias && kpisData.materias[selectedMateria]) {
        const materiaData = kpisData.materias[selectedMateria];
        console.log('[ProgressPage] Datos de materia:', materiaData);
        
        // Obtener el historial de conceptos de los últimos 30 días
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        // Por ahora usar datos actuales para crear un punto
        // En el futuro, esto debería venir de un historial guardado
        const currentData = {
          fecha: endDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
          dominados: materiaData.conceptosDominados || 0,
          aprendiendo: materiaData.conceptosAprendiz || 0,
          total: (materiaData.conceptosDominados || 0) + (materiaData.conceptosAprendiz || 0) + (materiaData.conceptosNoDominados || 0)
        };
        
        progressData.push(currentData);
        
        // Simular datos históricos para mostrar tendencia (esto debería venir de Firestore)
        for (let i = 7; i >= 1; i--) {
          const date = new Date();
          date.setDate(date.getDate() - (i * 4));
          
          const dominados = Math.max(0, currentData.dominados - Math.floor(Math.random() * 2 * i));
          const aprendiendo = Math.max(0, currentData.aprendiendo - Math.floor(Math.random() * i));
          
          progressData.unshift({
            fecha: date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
            dominados: dominados,
            aprendiendo: aprendiendo,
            total: currentData.total
          });
        }
      } else if (kpisData.global) {
        // Usar datos globales si no hay materia seleccionada
        const globalData = kpisData.global;
        console.log('[ProgressPage] Usando datos globales:', globalData);
        
        // Calcular totales sumando todas las materias
        let totalDominados = 0;
        let totalAprendiendo = 0;
        let totalConceptos = 0;
        
        if (kpisData.materias) {
          Object.values(kpisData.materias).forEach((materia: any) => {
            totalDominados += materia.conceptosDominados || 0;
            totalAprendiendo += materia.conceptosAprendiz || 0;
            totalConceptos += (materia.conceptosDominados || 0) + 
                             (materia.conceptosAprendiz || 0) + 
                             (materia.conceptosNoDominados || 0);
          });
        }
        
        const currentData = {
          fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
          dominados: totalDominados,
          aprendiendo: totalAprendiendo,
          total: totalConceptos
        };
        
        progressData.push(currentData);
        
        // Simular datos históricos
        for (let i = 7; i >= 1; i--) {
          const date = new Date();
          date.setDate(date.getDate() - (i * 4));
          
          const dominados = Math.max(0, currentData.dominados - Math.floor(Math.random() * 3 * i));
          const aprendiendo = Math.max(0, currentData.aprendiendo - Math.floor(Math.random() * 2 * i));
          
          progressData.unshift({
            fecha: date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
            dominados: dominados,
            aprendiendo: aprendiendo,
            total: currentData.total
          });
        }
      }
      
      console.log('[ProgressPage] Progreso de conceptos calculado:', progressData);
      setConceptProgressData(progressData);
      
    } catch (error) {
      console.error('[ProgressPage] Error calculando progreso de conceptos:', error);
      setConceptProgressData([]);
    }
  };

  // Calcular el ranking real basado en los datos actuales
  const [rankingData, setRankingData] = useState<Array<{posicion: number, nombre: string, score: number}>>([]);
  const [rankingLoading, setRankingLoading] = useState(false);

  const [positionHistoryData, setPositionHistoryData] = useState<PositionData[]>([]);

  const [studyTimeData, setStudyTimeData] = useState<StudyTimeData[]>([]);
  const [conceptProgressData, setConceptProgressData] = useState<ConceptProgressData[]>([]);
  const [viewingDivision, setViewingDivision] = useState<number>(0);
  const [conceptsLearned, setConceptsLearned] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [streakBonus, setStreakBonus] = useState(0);
  const [hasStudiedToday, setHasStudiedToday] = useState(false);
  const [conceptsDominated, setConceptsDominated] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [materiasActivas, setMateriasActivas] = useState(0);
  const [cuadernosActivos, setCuadernosActivos] = useState(0);

  // Ya no necesitamos datos de ejemplo, usamos cuadernosReales

  // Usar datos reales si están disponibles, si no usar valores por defecto
  const globalScore = Math.ceil(kpisData?.global?.scoreGlobal || 0);
  const globalPercentil = kpisData?.global?.percentilPromedioGlobal || 0;
  const globalStudyTime = kpisData?.global?.tiempoEstudioGlobal || 0;
  const globalSmartStudies = kpisData?.global?.estudiosInteligentesGlobal || 0;
  
  // Load concepts learned with minimum repetitions
  useEffect(() => {
    const loadConceptsLearned = async () => {
      if (!auth.currentUser) return;
      
      try {
        const effectiveUserData = await getEffectiveUserId();
        const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        
        // Get concepts with at least 2 repetitions (same as StudyModePage)
        const conceptsWithMinReps = await kpiService.getConceptsWithMinRepetitions(userId, 2);
        setConceptsLearned(conceptsWithMinReps);
        
        console.log('[ProgressPage] Concepts with min repetitions:', conceptsWithMinReps);
      } catch (error) {
        console.error('[ProgressPage] Error loading concepts learned:', error);
      }
    };
    
    loadConceptsLearned();
  }, []);
  const getCurrentDivision = (score: number): number => {
    for (let i = 0; i < DIVISION_LEVELS.length; i++) {
      if (score >= DIVISION_LEVELS[i].minScore && score <= DIVISION_LEVELS[i].maxScore) {
        return i;
      }
    }
    return 0; // Madera por defecto
  };
  const currentDivision = getCurrentDivision(globalScore);
  
  // Division navigation
  const navigateToPreviousDivision = () => {
    if (viewingDivision > 0) {
      setViewingDivision(viewingDivision - 1);
    }
  };
  
  const navigateToNextDivision = () => {
    if (viewingDivision < DIVISION_LEVELS.length - 1) {
      setViewingDivision(viewingDivision + 1);
    }
  };
  
  // Update viewing division when current division changes
  useEffect(() => {
    setViewingDivision(currentDivision);
  }, [currentDivision]);
  
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
      <div className="progress-container">
        <HeaderWithHamburger title="Progreso" />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <HeaderWithHamburger title="Mi Progreso" />
      
      {/* Contenido de la página de progreso */}
        <div>
      <div className="progress-layout">
        <div className="progress-modules-row">
          <div className={`progress-module-col ${!isSchoolUser && materias.length === 0 ? 'no-side-module' : ''}`}>
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
            {(materias.length > 0 || kpisData?.global?.scoreGlobal > 0) && (
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
                  {rankingLoading ? (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      padding: '3rem 0',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <FontAwesomeIcon 
                        icon={faSpinner} 
                        spin 
                        size="2x" 
                        style={{ color: '#6366f1' }}
                      />
                      <span style={{ 
                        fontSize: '0.875rem', 
                        color: '#6b7280',
                        fontStyle: 'italic'
                      }}>
                        Cargando posiciones...
                      </span>
                    </div>
                  ) : rankingData.length > 0 ? (
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
            )}
          </div>

          <div className={`progress-modules-right ${!isSchoolUser && materias.length === 0 ? 'full-width' : ''}`}>
            <div className="daily-metrics">
              <div className="metric-card">
                <div className="metric-info-icon" data-tooltip="Días consecutivos de estudio">
                  <i className="fas fa-info-circle"></i>
                </div>
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="fire" className="svg-inline--fa fa-fire metric-icon fire" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                  <path fill="currentColor" d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"></path>
                </svg>
                <div className="metric-content">
                  <span className="metric-label">Racha</span>
                  <span className="metric-value">{currentStreak} días</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-info-icon" data-tooltip="Puntos bonus acumulados por tu racha de estudio">
                  <i className="fas fa-info-circle"></i>
                </div>
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="gift" className="svg-inline--fa fa-gift metric-icon bonus" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                  <path fill="currentColor" d="M190.5 68.8L225.3 128l-1.3 0-72 0c-22.1 0-40-17.9-40-40s17.9-40 40-40l2.2 0c14.9 0 28.8 7.9 36.3 20.8zM64 88c0 14.4 3.5 28 9.6 40L32 128c-17.7 0-32 14.3-32 32l0 64c0 17.7 14.3 32 32 32l448 0c17.7 0 32-14.3 32-32l0-64c0-17.7-14.3-32-32-32l-41.6 0c6.1-12 9.6-25.6 9.6-40c0-48.6-39.4-88-88-88l-2.2 0c-31.9 0-61.5 16.9-77.7 44.4L256 85.5l-24.1-41C215.7 16.9 186.1 0 154.2 0L152 0C103.4 0 64 39.4 64 88zm336 0c0 22.1-17.9 40-40 40l-72 0-1.3 0 34.8-59.2C329.1 55.9 342.9 48 357.8 48l2.2 0c22.1 0 40 17.9 40 40zM32 288l0 176c0 26.5 21.5 48 48 48l144 0 0-224L32 288zM288 512l144 0c26.5 0 48-21.5 48-48l0-176-192 0 0 224z"></path>
                </svg>
                <div className="metric-content">
                  <span className="metric-label">Bonus</span>
                  <span className="metric-value">{streakBonus} pts</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-info-icon" data-tooltip="Estado de tu sesión de estudio del día de hoy">
                  <i className="fas fa-info-circle"></i>
                </div>
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="chart-line" className="svg-inline--fa fa-chart-line metric-icon progress" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                  <path fill="currentColor" d="M64 64c0-17.7-14.3-32-32-32S0 46.3 0 64L0 400c0 44.2 35.8 80 80 80l400 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 416c-8.8 0-16-7.2-16-16L64 64zm406.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L320 210.7l-57.4-57.4c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L240 221.3l57.4 57.4c12.5 12.5 32.8 12.5 45.3 0l128-128z"></path>
                </svg>
                <div className="metric-content">
                  <span className="metric-label">Estudio Hoy</span>
                  <span className="metric-value" style={{ 
                    color: hasStudiedToday ? '#10b981' : '#ef4444',
                    fontSize: '0.9rem'
                  }}>
                    {loading ? '...' : hasStudiedToday ? 'INICIADO' : 'NO INICIADO'}
                  </span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-info-icon" data-tooltip="Tu división actual basada en tu Score Global (cada 5,000 puntos subes de división)">
                  <i className="fas fa-info-circle"></i>
                </div>
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="medal" className="svg-inline--fa fa-medal metric-icon division" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                  <path fill="currentColor" d="M4.1 38.2C1.4 34.2 0 29.4 0 24.6C0 11 11 0 24.6 0L133.9 0c11.2 0 21.7 5.9 27.4 15.5l68.5 114.1c-48.2 6.1-91.3 28.6-123.4 61.9L4.1 38.2zm503.7 0L405.6 191.5c-32.1-33.3-75.2-55.8-123.4-61.9L350.7 15.5C356.5 5.9 366.9 0 378.1 0L487.4 0C501 0 512 11 512 24.6c0 4.8-1.4 9.6-4.1 13.6zM80 336a176 176 0 1 1 352 0A176 176 0 1 1 80 336zm184.4-94.9c-3.4-7-13.3-7-16.8 0l-22.4 45.4c-1.4 2.8-4 4.7-7 5.1L168 298.9c-7.7 1.1-10.7 10.5-5.2 16l36.3 35.4c2.2 2.2 3.2 5.2 2.7 8.3l-8.6 49.9c-1.3 7.6 6.7 13.5 13.6 9.9l44.8-23.6c2.7-1.4 6-1.4 8.7 0l44.8 23.6c6.9 3.6 14.9-2.2 13.6-9.9l-8.6-49.9c-.5-3 .5-6.1 2.7-8.3l36.3-35.4c5.6-5.4 2.5-14.8-5.2-16l-50.1-7.3c-3-.4-5.7-2.4-7-5.1l-22.4-45.4z"></path>
                </svg>
                <div className="metric-content">
                  <span className="metric-label">División</span>
                  <span className="metric-value">
                    <span style={{marginRight: '0.5rem', fontSize: '1.2rem'}}>
                      {DIVISION_LEVELS[currentDivision].icon}
                    </span>
                    {DIVISION_LEVELS[currentDivision].name}
                  </span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-info-icon" data-tooltip="Tiempo total acumulado de estudio">
                  <i className="fas fa-info-circle"></i>
                </div>
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="clock" className="svg-inline--fa fa-clock metric-icon time" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                  <path fill="currentColor" d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120l0 136c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2 280 120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"></path>
                </svg>
                <div className="metric-content">
                  <span className="metric-label">Tiempo Total</span>
                  <span className="metric-value">{loading ? '...' : `${Math.round(totalTime)}m`}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-info-icon" data-tooltip="Número de materias en las que tienes actividad">
                  <i className="fas fa-info-circle"></i>
                </div>
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="graduation-cap" className="svg-inline--fa fa-graduation-cap metric-icon subjects" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
                  <path fill="currentColor" d="M320 32c-8.1 0-16.1 1.4-23.7 4.1L15.8 137.4C6.3 140.9 0 149.9 0 160s6.3 19.1 15.8 22.6l57.9 20.9C57.3 229.3 48 259.8 48 291.9l0 28.1c0 28.4-10.8 57.7-22.3 80.8c-6.5 13-13.9 25.8-22.5 37.6C0 442.7-.9 448.3 .9 453.4s6 8.9 11.2 10.2l64 16c4.2 1.1 8.7 .3 12.4-2s6.3-6.1 7.1-10.4c8.6-42.8 4.3-81.2-2.1-119.8c-.9-5.3-1.7-10.7-2.4-16.1l228.2 81.9c7.6 2.7 15.6 4.1 23.7 4.1s16.1-1.4 23.7-4.1L624.2 182.6c9.5-3.4 15.8-12.5 15.8-22.6s-6.3-19.1-15.8-22.6L343.7 36.1C336.1 33.4 328.1 32 320 32zM128 408c0 35.3 86 72 192 72s192-36.7 192-72L496.7 262.6 354.5 314c-11.1 4-22.8 6-34.5 6s-23.5-2-34.5-6L143.3 262.6 128 408z"></path>
                </svg>
                <div className="metric-content">
                  <span className="metric-label">Materias Activas</span>
                  <span className="metric-value">{loading ? '...' : materiasActivas}</span>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-info-icon" data-tooltip="Número de cuadernos en los que tienes actividad">
                  <i className="fas fa-info-circle"></i>
                </div>
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="book" className="svg-inline--fa fa-book metric-icon notebooks" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                  <path fill="currentColor" d="M96 0C43 0 0 43 0 96L0 416c0 53 43 96 96 96l288 0 32 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l0-64c17.7 0 32-14.3 32-32l0-320c0-17.7-14.3-32-32-32L384 0 96 0zm0 384l256 0 0 64L96 448c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16l192 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-192 0c-8.8 0-16-7.2-16-16zm16 48l192 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-192 0c-8.8 0-16-7.2-16-16s7.2-16 16-16z"></path>
                </svg>
                <div className="metric-content">
                  <span className="metric-label">Cuadernos Activos</span>
                  <span className="metric-value">{loading ? '...' : cuadernosActivos}</span>
                </div>
              </div>
            </div>

            {/* Módulo Inferior */}
            <div className="progress-bottom-module">

              {/* Tabla de Cuadernos */}
              <div className="notebooks-table-container">
                <h3><FontAwesomeIcon icon={faBook} className="table-icon" /> Detalle por Cuaderno</h3>
                <div className="notebooks-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Cuaderno</th>
                        <th>TOTAL</th>
                        <th>Repaso</th>
                        <th>Activo</th>
                        <th>Libre</th>
                        <th>Quiz</th>
                        <th>Juegos</th>
                        <th>% Dominio</th>
                        <th>Tiempo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuadernosReales.length > 0 ? (
                        cuadernosReales.map((cuaderno) => {
                          console.log('[ProgressPage] Renderizando cuaderno en tabla:', cuaderno);
                          return (
                            <tr key={cuaderno.id}>
                              <td className="notebook-name">{cuaderno.nombre}</td>
                              <td className="score-cell">{Math.ceil(cuaderno.score).toLocaleString('es-ES')}</td>
                              <td className="points-cell">{cuaderno.puntosRepasoInteligente || 0} pts</td>
                              <td className="points-cell">{cuaderno.puntosEstudioActivo || 0} pts</td>
                              <td className="points-cell">{cuaderno.puntosEstudioLibre || 0} pts</td>
                              <td className="points-cell">{cuaderno.puntosQuiz || 0} pts</td>
                              <td className="points-cell">{cuaderno.puntosJuegos || 0} pts</td>
                              <td className="percentage mastery">{cuaderno.porcentajeDominio}%</td>
                              <td>{formatTime(cuaderno.tiempoEstudio)}</td>
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

            </div>
          </div>
        </div>
      </div>
        </div>
    </>
  );
};

export default ProgressPage;