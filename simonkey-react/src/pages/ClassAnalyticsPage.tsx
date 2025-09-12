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
  faSpinner,
  faFilePdf
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
  const { isSchoolUser, isSchoolStudent, isTeacher, isSchoolAdmin, isSuperAdmin } = useUserType();
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const [showMateriaDropdown, setShowMateriaDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kpisData, setKpisData] = useState<any>(null);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [cuadernosReales, setCuadernosReales] = useState<CuadernoData[]>([]);
  const [progress, setProgress] = useState(0);
  const [effectiveUserId, setEffectiveUserId] = useState<string>('');
  
  // Estados para selector de estudiante (solo para profesores)
  const [selectedStudent, setSelectedStudent] = useState<{id: string, nombre: string} | null>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<Array<{id: string, nombre: string}>>([]);
  
  // Estados para selector de cuaderno y tabla de estudiantes
  const [selectedNotebook, setSelectedNotebook] = useState<{id: string, nombre: string} | null>(null);
  const [showNotebookDropdown, setShowNotebookDropdown] = useState(false);
  const [studentsInNotebook, setStudentsInNotebook] = useState<Array<{
    id: string;
    nombre: string;
    score: number;
    puntosRepasoInteligente: number;
    puntosEstudioActivo: number;
    puntosEstudioLibre: number;
    puntosQuiz: number;
    puntosJuegos: number;
    porcentajeDominio: number;
    tiempoEstudio: number;
  }>>([]);

  // Cargar todo al montar el componente
  useEffect(() => {
    loadAllData();
  }, []);

  // Actualizar cuadernos cuando cambie la materia seleccionada o el estudiante seleccionado
  useEffect(() => {
    if (kpisData && selectedMateria) {
      processCuadernosData();
    }
  }, [selectedMateria, selectedStudent, kpisData]);

  // Cargar estudiantes enrollados cuando cambie la materia seleccionada
  useEffect(() => {
    console.log('[ClassAnalytics] useEffect loadEnrolledStudents - selectedMateria:', selectedMateria);
    if (selectedMateria) {
      console.log('[ClassAnalytics] Calling loadEnrolledStudents...');
      loadEnrolledStudents();
    } else {
      console.log('[ClassAnalytics] No selectedMateria, clearing enrolled students');
      setEnrolledStudents([]);
    }
  }, [selectedMateria]);

  // Calcular ranking cuando cambien los cuadernos, la materia o el estudiante seleccionado
  useEffect(() => {
    // Solo calcular si hay datos de KPIs
    if (kpisData && cuadernosReales.length > 0) {
      calculateRanking();
      calculatePositionHistory();
      calculateWeeklyStudyTime();
      calculateConceptProgress();
    }
  }, [cuadernosReales, selectedMateria, selectedStudent]);

  // Cargar estudiantes cuando se seleccione un cuaderno
  useEffect(() => {
    console.log('[ClassAnalytics] useEffect loadStudentsInNotebook - selectedNotebook:', selectedNotebook);
    if (selectedNotebook && selectedMateria) {
      console.log('[ClassAnalytics] Loading students for notebook:', selectedNotebook.id);
      loadStudentsInNotebook(selectedNotebook.id);
    } else {
      console.log('[ClassAnalytics] No notebook selected, clearing students list');
      setStudentsInNotebook([]);
    }
  }, [selectedNotebook, selectedMateria]);

  // Función para exportar a PDF (imprimir toda la pantalla)
  const exportToPDF = () => {
    console.log('[ClassAnalytics] 🖨️ Exportando página a PDF...');
    
    // Obtener el nombre de la materia para el nombre del archivo
    const materiaName = materias.find(m => m.id === selectedMateria)?.nombre || 'ClassAnalytics';
    const fileName = `${materiaName.replace(/\s+/g, '_')}_Analytics.pdf`;
    
    // Configurar las opciones de impresión
    const printOptions = {
      silent: false, // Mostrar diálogo de impresión
      printBackground: true, // Incluir colores y fondos
      color: true,
      margin: {
        marginType: 'minimum',
      },
      landscape: false,
      pagesPerSheet: 1,
      collate: false,
      copies: 1,
    };

    // Usar la función nativa del navegador para imprimir
    try {
      // Ocultar temporalmente elementos que no queremos en el PDF
      const elementsToHide = document.querySelectorAll('.no-print');
      elementsToHide.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      // Configurar título para el PDF
      const originalTitle = document.title;
      document.title = fileName;

      // Crear estilos específicos para impresión
      const printStyles = document.createElement('style');
      printStyles.textContent = `
        @media print {
          @page {
            size: A4;
            margin: 0.5in;
          }
          
          body * {
            visibility: hidden;
          }
          
          .progress-layout, .progress-layout * {
            visibility: visible;
          }
          
          .progress-layout {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          .dropdown-icon {
            display: none !important;
          }
          
          .materia-dropdown {
            display: none !important;
          }
          
          .notebooks-table table {
            font-size: 10px;
          }
          
          .ranking-list {
            font-size: 11px;
          }
        }
      `;
      
      document.head.appendChild(printStyles);

      // Imprimir usando window.print()
      window.print();

      // Limpiar después de la impresión
      setTimeout(() => {
        document.head.removeChild(printStyles);
        document.title = originalTitle;
        elementsToHide.forEach(el => {
          (el as HTMLElement).style.display = '';
        });
        console.log('[ClassAnalytics] ✅ Exportación PDF completada');
      }, 1000);

    } catch (error) {
      console.error('[ClassAnalytics] ❌ Error exportando PDF:', error);
      alert('Error al exportar PDF. Por favor intenta de nuevo.');
    }
  };

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

  // Función para cargar estudiantes de un cuaderno específico
  const loadStudentsInNotebook = async (notebookId: string) => {
    console.log('[ClassAnalytics] 🔍 loadStudentsInNotebook called - notebookId:', notebookId);
    if (!selectedMateria || !notebookId) {
      console.log('[ClassAnalytics] ❌ No selectedMateria or notebookId');
      setStudentsInNotebook([]);
      return;
    }

    try {
      // Obtener todos los estudiantes enrolados en la materia
      const materiaDoc = await getDoc(doc(db, 'materias', selectedMateria));
      if (!materiaDoc.exists()) {
        console.log('[ClassAnalytics] Materia no encontrada:', selectedMateria);
        setStudentsInNotebook([]);
        return;
      }
      
      const materiaData = materiaDoc.data();
      const materiaOwnerId = materiaData.userId;
      
      // Solo permitir acceso si el usuario actual es el dueño de la materia o es SUPER_ADMIN
      if (materiaOwnerId !== auth.currentUser?.uid && !isSuperAdmin) {
        console.log('[ClassAnalytics] Usuario no autorizado para ver estudiantes de esta materia');
        setStudentsInNotebook([]);
        return;
      }

      // Obtener enrollments para esta materia
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('materiaId', '==', selectedMateria),
        where('teacherId', '==', materiaOwnerId),
        where('status', '==', 'active')
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      console.log(`[ClassAnalytics] 📚 Found ${enrollmentsSnapshot.size} enrolled students`);
      
      if (enrollmentsSnapshot.empty) {
        console.log('[ClassAnalytics] No students enrolled in this materia');
        setStudentsInNotebook([]);
        return;
      }

      // Procesar cada estudiante y calcular sus puntos para este cuaderno específico
      const studentsData = await Promise.all(
        enrollmentsSnapshot.docs.map(async (enrollmentDoc) => {
          const enrollment = enrollmentDoc.data();
          const studentId = enrollment.studentId;
          
          try {
            // Obtener información del estudiante
            const studentDoc = await getDoc(doc(db, 'users', studentId));
            const studentData = studentDoc.exists() ? studentDoc.data() : null;
            const studentName = studentData?.displayName || studentData?.nombre || studentData?.email || 'Estudiante';
            
            // Calcular puntos específicos para este cuaderno
            const notebookPoints = await calculateNotebookPoints(notebookId, studentId);
            
            // Obtener tiempo de estudio específico del cuaderno para este estudiante
            let tiempoEstudio = 0;
            try {
              // Primero intentar desde KPIs
              const studentKPIs = await kpiService.getUserKPIs(studentId);
              const cuadernoData = studentKPIs?.cuadernos?.[notebookId];
              tiempoEstudio = cuadernoData?.tiempoEstudioLocal || 0;
              
              // Si no hay tiempo en KPIs, calcular desde sesiones de estudio
              if (tiempoEstudio === 0) {
                const studySessions = await getDocs(query(
                  collection(db, 'studySessions'),
                  where('userId', '==', studentId),
                  where('notebookId', '==', notebookId),
                  where('validated', '==', true)
                ));
                
                studySessions.forEach((sessionDoc) => {
                  const sessionData = sessionDoc.data();
                  tiempoEstudio += sessionData.duration || 0;
                });
              }
            } catch (error) {
              console.warn(`[ClassAnalytics] Error getting study time for student ${studentId} in notebook ${notebookId}:`, error);
            }
            
            console.log(`[ClassAnalytics] ✅ Student ${studentName} points for notebook:`, notebookPoints);
            console.log(`[ClassAnalytics] ⏱️ Student ${studentName} study time for notebook: ${tiempoEstudio} minutes`);
            
            return {
              id: studentId,
              nombre: studentName,
              score: notebookPoints.score,
              puntosRepasoInteligente: notebookPoints.puntosRepasoInteligente,
              puntosEstudioActivo: notebookPoints.puntosEstudioActivo,
              puntosEstudioLibre: notebookPoints.puntosEstudioLibre,
              puntosQuiz: notebookPoints.puntosQuiz,
              puntosJuegos: notebookPoints.puntosJuegos,
              porcentajeDominio: notebookPoints.porcentajeDominio,
              tiempoEstudio: tiempoEstudio
            };
          } catch (error) {
            console.warn(`[ClassAnalytics] Error processing student ${studentId}:`, error);
            return {
              id: studentId,
              nombre: 'Error',
              score: 0,
              puntosRepasoInteligente: 0,
              puntosEstudioActivo: 0,
              puntosEstudioLibre: 0,
              puntosQuiz: 0,
              puntosJuegos: 0,
              porcentajeDominio: 0,
              tiempoEstudio: 0
            };
          }
        })
      );

      // Ordenar por score de mayor a menor
      studentsData.sort((a, b) => b.score - a.score);
      
      console.log(`[ClassAnalytics] 📊 Processed ${studentsData.length} students for notebook ${notebookId}`);
      setStudentsInNotebook(studentsData);

    } catch (error) {
      console.error('[ClassAnalytics] Error loading students in notebook:', error);
      setStudentsInNotebook([]);
    }
  };

  // Función para cargar estudiantes enrollados
  const loadEnrolledStudents = async () => {
    console.log('[ClassAnalytics] 🔍 loadEnrolledStudents called - selectedMateria:', selectedMateria);
    if (!selectedMateria) {
      console.log('[ClassAnalytics] ❌ No selectedMateria, returning');
      setEnrolledStudents([]);
      return;
    }

    try {
      console.log('[ClassAnalytics] ✅ Cargando estudiantes enrollados para materia:', selectedMateria);
      
      // Primero obtener la información de la materia para saber quien es el profesor
      const materiaDoc = await getDoc(doc(db, 'materias', selectedMateria));
      if (!materiaDoc.exists()) {
        console.log('[ClassAnalytics] Materia no encontrada:', selectedMateria);
        setEnrolledStudents([]);
        return;
      }
      
      const materiaData = materiaDoc.data();
      const materiaOwnerId = materiaData.userId;
      console.log('[ClassAnalytics] Materia owner:', materiaOwnerId, 'Current user:', auth.currentUser?.uid);
      
      // Solo permitir acceso si el usuario actual es el dueño de la materia o es SUPER_ADMIN
      if (materiaOwnerId !== auth.currentUser?.uid && !isSuperAdmin) {
        console.log('[ClassAnalytics] Usuario no autorizado para ver estudiantes de esta materia');
        setEnrolledStudents([]);
        return;
      }
      
      // Log para SUPER_ADMIN access
      if (isSuperAdmin && materiaOwnerId !== auth.currentUser?.uid) {
        console.log('[ClassAnalytics] SUPER_ADMIN accediendo a materia de otro profesor:', materiaOwnerId);
      }
      
      // Obtener enrollments para esta materia (buscar por materiaId y teacherId)
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('materiaId', '==', selectedMateria),
        where('teacherId', '==', materiaOwnerId),
        where('status', '==', 'active')
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      console.log(`[ClassAnalytics] Encontrados ${enrollmentsSnapshot.size} enrollments activos`);
      
      if (enrollmentsSnapshot.empty) {
        setEnrolledStudents([]);
        return;
      }
      
      // Obtener información de cada estudiante
      const studentsPromises = enrollmentsSnapshot.docs.map(async (enrollmentDoc) => {
        const enrollmentData = enrollmentDoc.data();
        const studentId = enrollmentData.studentId;
        
        try {
          const userDoc = await getDoc(doc(db, 'users', studentId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              id: studentId,
              nombre: userData.displayName || userData.nombre || userData.email || 'Usuario sin nombre'
            };
          }
          return {
            id: studentId,
            nombre: 'Usuario sin nombre'
          };
        } catch (error) {
          console.warn(`Error obteniendo datos del estudiante ${studentId}:`, error);
          return {
            id: studentId,
            nombre: 'Usuario sin nombre'
          };
        }
      });
      
      const students = await Promise.all(studentsPromises);
      // Ordenar por nombre
      students.sort((a, b) => a.nombre.localeCompare(b.nombre));
      
      setEnrolledStudents(students);
      console.log('[ClassAnalytics] Estudiantes cargados:', students.length);
      
    } catch (error) {
      console.error('[ClassAnalytics] Error cargando estudiantes enrollados:', error);
      setEnrolledStudents([]);
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
        const enrollmentsQuery = query(
          collection(db, 'enrollments'),
          where('studentId', '==', userId),
          where('status', '==', 'active')
        );
        const enrollmentsSnap = await getDocs(enrollmentsQuery);
        
        console.log('[ProgressPage] Enrollments activos encontrados:', enrollmentsSnap.size);
        
        // Para cada enrollment, obtener la materia del profesor
        for (const enrollmentDoc of enrollmentsSnap.docs) {
          const enrollmentData = enrollmentDoc.data();
          const materiaId = enrollmentData.materiaId;
          
          // Verificar que no esté ya en la lista (evitar duplicados)
          if (!materiasArray.find(m => m.id === materiaId)) {
            const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
            if (materiaDoc.exists()) {
              const materiaData = materiaDoc.data();
              console.log('[ProgressPage] Materia inscrita:', { id: materiaId, data: materiaData });
              materiasArray.push({
                id: materiaId,
                nombre: materiaData.nombre || materiaData.title || 'Sin nombre'
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
      
      // Seleccionar la primera materia por defecto
      if (materiasArray.length > 0 && !selectedMateria) {
        console.log('[ProgressPage] Seleccionando primera materia por defecto:', materiasArray[0]);
        setSelectedMateria(materiasArray[0].id);
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
        quizSessions,
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
        // Quiz sessions for time calculation - try multiple collection names
        Promise.allSettled([
          getDocs(query(
            collection(db, 'quizSessions'),
            where('userId', '==', userId),
            where('notebookId', '==', notebookId),
            limit(100)
          )),
          getDocs(query(
            collection(db, 'users', userId, 'quizSessions'),
            where('notebookId', '==', notebookId),
            limit(100)
          )),
          getDocs(query(
            collection(db, 'studySessions'),
            where('userId', '==', userId),
            where('notebookId', '==', notebookId),
            where('mode', '==', 'quiz'),
            limit(100)
          ))
        ]).then(results => {
          // Return the first successful result that has documents
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value.size > 0) {
              console.log(`[ProgressPage] Found quiz sessions in collection, size: ${result.value.size}`);
              return result.value;
            }
          }
          console.log(`[ProgressPage] No quiz sessions found in any collection`);
          return { docs: [] };
        }),
        // Game points
        gamePointsService.getNotebookPoints(userId, notebookId).catch(() => ({ totalPoints: 0 })),
        // User streak
        studyStreakService.getUserStreak(userId).catch(() => ({ currentStreak: 0 })),
        // Domain progress data (concepts dominated and total)
        getDomainProgressForNotebook(notebookId, userId)
      ]);

      console.log(`[ProgressPage] DEBUG: Smart study sessions found: ${smartStudySessions.size}`);
      console.log(`[ProgressPage] DEBUG: Voice recognition sessions found: ${voiceRecognitionSessions.size}`);
      console.log(`[ProgressPage] DEBUG: Free study sessions found: ${freeStudySessions.size}`);
      console.log(`[ProgressPage] DEBUG: Quiz sessions found: ${quizSessions.docs ? quizSessions.docs.length : 0}`);

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
      
      // Debug: Log quiz stats data to understand structure
      if (quizStatsDoc.exists()) {
        console.log(`[ProgressPage] Quiz stats data:`, quizStatsDoc.data());
      }

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

      // Calculate total study time from all sessions
      let totalStudyTime = 0;
      
      // Add time from smart study sessions
      smartStudySessions.forEach((doc) => {
        const sessionData = doc.data();
        let duration = sessionData.duration || 0;
        
        // If no duration field, calculate from startTime and endTime
        if (duration === 0 && sessionData.startTime && sessionData.endTime) {
          const startSeconds = sessionData.startTime.seconds || sessionData.startTime._seconds || 0;
          const endSeconds = sessionData.endTime.seconds || sessionData.endTime._seconds || 0;
          duration = Math.max(0, endSeconds - startSeconds) / 60; // Convert to minutes
        }
        
        console.log(`[ProgressPage] Smart session ${doc.id}:`, {
          duration: duration,
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          sessionData: sessionData
        });
        totalStudyTime += duration;
      });
      
      // Add time from voice recognition sessions
      voiceRecognitionSessions.forEach((doc) => {
        const sessionData = doc.data();
        let duration = sessionData.duration || 0;
        
        // If no duration field, calculate from startTime and endTime
        if (duration === 0 && sessionData.startTime && sessionData.endTime) {
          const startSeconds = sessionData.startTime.seconds || sessionData.startTime._seconds || 0;
          const endSeconds = sessionData.endTime.seconds || sessionData.endTime._seconds || 0;
          duration = Math.max(0, endSeconds - startSeconds) / 60; // Convert to minutes
        }
        
        console.log(`[ProgressPage] Voice session ${doc.id}:`, {
          duration: duration,
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          sessionData: sessionData
        });
        totalStudyTime += duration;
      });
      
      // Add time from free study sessions
      freeStudySessions.forEach((doc) => {
        const sessionData = doc.data();
        let duration = sessionData.duration || 0;
        
        // If no duration field, calculate from startTime and endTime
        if (duration === 0 && sessionData.startTime && sessionData.endTime) {
          const startSeconds = sessionData.startTime.seconds || sessionData.startTime._seconds || 0;
          const endSeconds = sessionData.endTime.seconds || sessionData.endTime._seconds || 0;
          duration = Math.max(0, endSeconds - startSeconds) / 60; // Convert to minutes
        }
        
        console.log(`[ProgressPage] Free session ${doc.id}:`, {
          duration: duration,
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          sessionData: sessionData
        });
        totalStudyTime += duration;
      });
      
      // Add time from quiz sessions
      const quizSessionsList = quizSessions.docs || [];
      let quizTime = 0;
      
      if (quizSessionsList.length > 0) {
        // Use actual quiz sessions if found
        quizSessionsList.forEach((doc) => {
          const sessionData = doc.data();
          let duration = sessionData.duration || 0;
          
          // If no duration field, calculate from startTime and endTime
          if (duration === 0 && sessionData.startTime && sessionData.endTime) {
            const startSeconds = sessionData.startTime.seconds || sessionData.startTime._seconds || 0;
            const endSeconds = sessionData.endTime.seconds || sessionData.endTime._seconds || 0;
            duration = Math.max(0, endSeconds - startSeconds) / 60; // Convert to minutes
          }
          
          console.log(`[ProgressPage] Quiz session ${doc.id}:`, {
            duration: duration,
            startTime: sessionData.startTime,
            endTime: sessionData.endTime,
            sessionData: sessionData
          });
          quizTime += duration;
        });
      } else if (quizStatsDoc.exists()) {
        // Estimate quiz time from quiz stats
        const quizData = quizStatsDoc.data();
        const totalQuestions = quizData.totalQuestions || 0;
        const totalQuizzes = quizData.totalQuizzes || 0;
        
        if (totalQuestions > 0 && totalQuizzes > 0) {
          // Estimate: ~9 seconds per question on average
          const estimatedTimePerQuestion = 0.15; // 9 seconds = 0.15 minutes
          quizTime = totalQuestions * estimatedTimePerQuestion;
          
          console.log(`[ProgressPage] Estimated quiz time from stats:`, {
            totalQuestions: totalQuestions,
            totalQuizzes: totalQuizzes,
            estimatedTime: quizTime,
            calculation: `${totalQuestions} questions × ${estimatedTimePerQuestion} min/question`
          });
        }
      }
      
      totalStudyTime += quizTime;

      // Calculate score general as sum of all points + streak bonus
      const scoreGeneral = puntosRepasoInteligente + puntosEstudioActivo + puntosEstudioLibre + puntosQuiz + puntosJuegos + streakBonus;

      const result = {
        puntosRepasoInteligente,
        puntosEstudioActivo,
        puntosEstudioLibre,
        puntosQuiz,
        puntosJuegos,
        score: scoreGeneral, // Override the score with calculated value
        porcentajeDominio: porcentajeDominio, // Override with calculated domain percentage
        tiempoEstudio: totalStudyTime // Add calculated study time
      };
      
      console.log(`[ProgressPage] DEBUG: Calculated points for ${notebookId}:`, {
        smartStudyPoints: smartStudyPoints,
        voiceRecognitionPoints: voiceRecognitionPoints,
        freeStudyPoints: freeStudyPoints,
        streakBonus: streakBonus,
        currentStreak: userStreak.currentStreak,
        scoreGeneral: scoreGeneral,
        porcentajeDominio: porcentajeDominio,
        totalStudyTime: totalStudyTime,
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
        porcentajeDominio: 0,
        tiempoEstudio: 0
      };
    }
  };

  const processCuadernosData = async () => {
    console.log('[ProgressPage] processCuadernosData called');
    if (!auth.currentUser || !kpisData) return;
    
    try {
      console.log('[ProgressPage] === PROCESANDO DATOS DE CUADERNOS ===');
      console.log('[ProgressPage] Materia seleccionada:', selectedMateria);
      console.log('[ProgressPage] Estudiante seleccionado:', selectedStudent?.id || 'ninguno');
      console.log('[ProgressPage] KPIs cuadernos:', kpisData.cuadernos);
    
      // Usar el ID del estudiante seleccionado si existe, sino usar el usuario actual
      let userId: string;
      let isSchoolUser = false;
      
      if (selectedStudent) {
        userId = selectedStudent.id;
        // Para estudiantes seleccionados, asumir que son usuarios escolares
        const studentUserDoc = await getDoc(doc(db, 'users', userId));
        if (studentUserDoc.exists()) {
          const studentUserData = studentUserDoc.data();
          isSchoolUser = studentUserData.isSchoolUser || false;
        }
        console.log('[ProgressPage] Usando datos del estudiante seleccionado:', userId, 'isSchoolUser:', isSchoolUser);
      } else {
        const effectiveUserData = await getEffectiveUserId();
        isSchoolUser = effectiveUserData?.isSchoolUser || false;
        userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        console.log('[ProgressPage] Usando datos del usuario actual:', userId, 'isSchoolUser:', isSchoolUser);
      }
      
      const cuadernosTemp: CuadernoData[] = [];
      
      // Obtener información adicional de los cuadernos si es necesario
      const notebookNames = new Map<string, string>();
      const notebookMaterias = new Map<string, string>();
      
      console.log('[ProgressPage] 🔍 DEBUG: Estado actual');
      console.log('[ProgressPage] 🔍 selectedMateria:', selectedMateria);
      console.log('[ProgressPage] 🔍 selectedStudent:', selectedStudent);
      console.log('[ProgressPage] 🔍 userId que se va a usar:', userId);
      
      // Si hay materia y estudiante seleccionado, buscar todos los notebooks de esa materia
      if (selectedMateria && selectedMateria !== 'general' && selectedStudent) {
        console.log('[ProgressPage] 🎯 ESTUDIANTE SELECCIONADO - Buscando todos los notebooks de la materia:', selectedMateria);
        const materiaNotebooksQuery = query(
          collection(db, 'notebooks'),
          where('materiaId', '==', selectedMateria)
        );
        
        const materiaNotebooksSnap = await getDocs(materiaNotebooksQuery);
        console.log(`[ProgressPage] 📚 Notebooks encontrados para materia: ${materiaNotebooksSnap.size}`);
        
        materiaNotebooksSnap.forEach(doc => {
          const notebookData = doc.data();
          notebookNames.set(doc.id, notebookData.title || 'Sin nombre');
          notebookMaterias.set(doc.id, notebookData.materiaId || '');
          console.log(`[ProgressPage] ✅ Notebook: ${doc.id} - ${notebookData.title}`);
        });
      }
      
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
      console.log('[ProgressPage] 🎯 Using userId for points calculation:', userId);
      const pointsUserId = userId; // Use the already determined userId (student selected or current user)
      
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
      
      // Para usuarios regulares, intentar obtener ranking basado en enrollments
      if (!isSchoolUser) {
        console.log('[ProgressPage] Usuario regular, verificando enrollments');
        
        if (!selectedMateria || selectedMateria === 'general') {
          // Para vista general, mostrar el score global
          const globalScore = kpisData?.global?.scoreGlobal || 0;
          setRankingData([{ 
            posicion: 1, 
            nombre: 'Tú', 
            score: Math.ceil(globalScore) 
          }]);
        } else {
          // Para una materia específica, intentar obtener ranking basado en enrollments
          console.log('[ProgressPage] Intentando obtener ranking de enrollments para materia:', selectedMateria);
          
          try {
            // Usar el ID del estudiante seleccionado como "usuario actual" para el ranking
            const currentUserForRanking = selectedStudent ? selectedStudent.id : userId;
            console.log('[ProgressPage] 🎯 Calculando ranking con usuario actual:', currentUserForRanking);
            
            const enrollmentRanking = await MateriaRankingService.getMateriaRanking(
              selectedMateria,
              currentUserForRanking,
              undefined, // teacherId
              true // isTeacherView - always show real names, never "Tú"
            );
            
            if (enrollmentRanking && enrollmentRanking.length > 0) {
              console.log('[ProgressPage] Ranking de enrollments encontrado:', enrollmentRanking);
              setRankingData(enrollmentRanking);
            } else {
              // Si no hay ranking de enrollments, calcular score basado en cuadernos reales
              let calculatedMateriaScore = 0;
              if (cuadernosReales && cuadernosReales.length > 0) {
                // Sumar los scores de todos los cuadernos de esta materia
                calculatedMateriaScore = cuadernosReales.reduce((sum, cuaderno) => sum + (cuaderno.score || 0), 0);
                console.log(`[ProgressPage] Score calculado para materia ${selectedMateria}:`, calculatedMateriaScore);
                console.log(`[ProgressPage] Cuadernos incluidos:`, cuadernosReales.map(c => ({name: c.nombre, score: c.score})));
              } else {
                // Fallback al score de KPIs si no hay cuadernos calculados
                calculatedMateriaScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
                console.log(`[ProgressPage] Usando score de KPIs como fallback:`, calculatedMateriaScore);
              }
              
              setRankingData([{ 
                posicion: 1, 
                nombre: 'Tú', 
                score: Math.ceil(calculatedMateriaScore) 
              }]);
            }
          } catch (error) {
            console.error('[ProgressPage] Error obteniendo ranking de enrollments:', error);
            // Fallback: intentar usar cuadernos reales, si no están disponibles usar KPIs
            let fallbackScore = 0;
            if (cuadernosReales && cuadernosReales.length > 0) {
              fallbackScore = cuadernosReales.reduce((sum, cuaderno) => sum + (cuaderno.score || 0), 0);
              console.log(`[ProgressPage] Fallback usando cuadernos reales:`, fallbackScore);
            } else {
              fallbackScore = kpisData?.materias?.[selectedMateria]?.scoreMateria || 0;
              console.log(`[ProgressPage] Fallback usando KPIs:`, fallbackScore);
            }
            
            setRankingData([{ 
              posicion: 1, 
              nombre: 'Tú', 
              score: Math.ceil(fallbackScore) 
            }]);
          }
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
    const mins = Math.round((minutes % 60) * 10) / 10; // Round to 1 decimal
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

          <div className={`progress-modules-right ${!isSchoolUser && materias.length === 0 ? 'full-width' : ''}`}>

            {/* Módulo Inferior */}
            <div className="progress-bottom-module">


              {/* Tabla de Cuadernos - DESHABILITADO */}
              {/* 
              <div className="notebooks-table-container">
                <h3><FontAwesomeIcon icon={faBook} className="table-icon" /> Detalle por Alumno</h3>
                
                {selectedMateria && selectedMateria !== 'general' && (
                  <div className="materia-dropdown-container" style={{ marginBottom: '1rem' }}>
                    <button 
                      className="materia-dropdown-btn"
                      onClick={() => setShowStudentDropdown(!showStudentDropdown)}
                      type="button"
                    >
                      <span>{selectedStudent ? selectedStudent.nombre : 'Seleccionar un alumno'}</span>
                      <FontAwesomeIcon icon={faChevronDown} className={`dropdown-icon ${showStudentDropdown ? 'open' : ''}`} />
                    </button>
                    
                    {showStudentDropdown && (
                      <div className="materia-dropdown">
                        {enrolledStudents.length === 0 ? (
                          <div className="materia-option">No hay estudiantes enrolados</div>
                        ) : (
                          <>
                            <div 
                              className={`materia-option ${!selectedStudent ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedStudent(null);
                                setShowStudentDropdown(false);
                              }}
                            >
                              Ver todos los estudiantes
                            </div>
                            {enrolledStudents.map((student) => (
                              <div 
                                key={student.id}
                                className={`materia-option ${selectedStudent?.id === student.id ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setShowStudentDropdown(false);
                                }}
                              >
                                {student.nombre}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="notebooks-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Cuaderno</th>
                        <th>Score General</th>
                        <th>Repaso Inteligente</th>
                        <th>Estudio Activo</th>
                        <th>Estudio Libre</th>
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
              */}

              {/* Nuevo Módulo: Selector de Cuadernos y Tabla de Estudiantes */}
              <div className="notebooks-table-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3><FontAwesomeIcon icon={faBook} className="table-icon" /> Detalle de Clase</h3>
                  <button 
                    onClick={exportToPDF}
                    className="materia-dropdown-btn"
                    style={{
                      backgroundColor: '#2563eb',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s',
                      width: 'auto',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#1d4ed8';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    type="button"
                  >
                    <FontAwesomeIcon icon={faFilePdf} />
                    Exportar a PDF
                  </button>
                </div>
                
                {/* Selector de Materia */}
                <div className="materia-dropdown-container" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: '500', color: '#374151', fontSize: '0.875rem' }}>Materia:</span>
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
                
                {/* Selector de Cuadernos */}
                <div className="materia-dropdown-container" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: '500', color: '#374151', fontSize: '0.875rem' }}>Cuaderno:</span>
                  <button 
                    className="materia-dropdown-btn"
                    onClick={() => setShowNotebookDropdown(!showNotebookDropdown)}
                    type="button"
                  >
                    <span>{selectedNotebook?.nombre || 'Seleccionar cuaderno'}</span>
                    <FontAwesomeIcon icon={faChevronDown} className={`dropdown-icon ${showNotebookDropdown ? 'open' : ''}`} />
                  </button>
              
                  {showNotebookDropdown && (
                    <div className="materia-dropdown">
                      {cuadernosReales.length === 0 ? (
                        <div className="materia-option">No hay cuadernos disponibles</div>
                      ) : (
                        <>
                          <div 
                            className={`materia-option ${!selectedNotebook ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedNotebook(null);
                              setShowNotebookDropdown(false);
                            }}
                          >
                            Seleccionar cuaderno
                          </div>
                          {cuadernosReales.map((cuaderno) => (
                            <div 
                              key={cuaderno.id}
                              className={`materia-option ${selectedNotebook?.id === cuaderno.id ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedNotebook({ id: cuaderno.id, nombre: cuaderno.nombre });
                                setShowNotebookDropdown(false);
                              }}
                            >
                              {cuaderno.nombre}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* KPIs Section */}
                {studentsInNotebook.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1rem',
                    marginBottom: '2rem',
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    {/* Score Promedio */}
                    <div style={{
                      textAlign: 'center',
                      padding: '1rem',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: '#2563eb',
                        marginBottom: '0.5rem'
                      }}>
                        {studentsInNotebook.length > 0 
                          ? Math.ceil(studentsInNotebook.reduce((sum, student) => sum + (student.score || 0), 0) / studentsInNotebook.length).toLocaleString('es-ES')
                          : '0'
                        }
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        fontWeight: '500'
                      }}>
                        Score Promedio
                      </div>
                    </div>

                    {/* % Alumnos Inactivos */}
                    <div style={{
                      textAlign: 'center',
                      padding: '1rem',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: '#2563eb',
                        marginBottom: '0.5rem'
                      }}>
                        {studentsInNotebook.length > 0 
                          ? Math.round((studentsInNotebook.filter(student => (student.score === 0 || student.score === '0' || !student.score || Math.ceil(student.score) === 0)).length / studentsInNotebook.length) * 100)
                          : '0'
                        }%
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        fontWeight: '500'
                      }}>
                        % Alumnos Inactivos
                      </div>
                    </div>

                    {/* Tiempo Promedio */}
                    <div style={{
                      textAlign: 'center',
                      padding: '1rem',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: '#2563eb',
                        marginBottom: '0.5rem'
                      }}>
                        {studentsInNotebook.length > 0 
                          ? (() => {
                              const totalMinutes = studentsInNotebook.reduce((sum, student) => sum + (student.tiempoEstudio || 0), 0);
                              const avgMinutes = Math.round(totalMinutes / studentsInNotebook.length);
                              return avgMinutes > 0 ? `${avgMinutes}m` : '0m';
                            })()
                          : '0m'
                        }
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        fontWeight: '500'
                      }}>
                        Tiempo Promedio
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabla de Estudiantes */}
                <div className="notebooks-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        <th>Score General</th>
                        <th>Repaso Inteligente</th>
                        <th>Estudio Activo</th>
                        <th>Estudio Libre</th>
                        <th>Quiz</th>
                        <th>Juegos</th>
                        <th>% Dominio</th>
                        <th>Tiempo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsInNotebook.length > 0 ? (
                        studentsInNotebook.map((student) => (
                          <tr 
                            key={student.id} 
                            className={(student.score === 0 || student.score === '0' || !student.score || Math.ceil(student.score) === 0) ? 'student-zero-points' : ''}
                          >
                            <td className="notebook-name">{student.nombre}</td>
                            <td className="score-cell">{Math.ceil(student.score).toLocaleString('es-ES')}</td>
                            <td className="points-cell">{student.puntosRepasoInteligente || 0} pts</td>
                            <td className="points-cell">{student.puntosEstudioActivo || 0} pts</td>
                            <td className="points-cell">{student.puntosEstudioLibre || 0} pts</td>
                            <td className="points-cell">{student.puntosQuiz || 0} pts</td>
                            <td className="points-cell">{student.puntosJuegos || 0} pts</td>
                            <td className="percentage mastery">{student.porcentajeDominio}%</td>
                            <td>{formatTime(student.tiempoEstudio)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="no-data">
                            {selectedNotebook ? 'Cargando datos de estudiantes...' : 'Selecciona un cuaderno para ver los estudiantes'}
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