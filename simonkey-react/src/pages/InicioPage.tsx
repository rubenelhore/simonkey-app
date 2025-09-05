import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFire, faClock, faChartLine, faGift, faMedal, faTrophy,
  faBook, faGraduationCap, faChartBar, faCalendarAlt, faCalendar, faRedo,
} from '@fortawesome/free-solid-svg-icons';
import { StudyStreakService } from '../services/studyStreakService';
import { db, collection, query, where, getDocs, getDoc, doc, Timestamp, updateDoc } from '../services/firebase';
import { getDomainProgressForMateria } from '../utils/domainProgress';
import { CacheManager } from '../utils/cacheManager';
import '../styles/InicioPage.css';

// Interface for calendar events
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'study' | 'quiz' | 'custom';
  time?: string;
  description?: string;
}

// Interface for materias with dominio
interface MateriaWithDominio {
  id: string;
  title: string;
  color: string;
  dominioPercentage: number;
  totalConcepts: number;
  dominatedConcepts: number;
}

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

const InicioPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  const { isTeacher, isSchoolStudent, isSchoolAdmin, isSchoolTutor } = useUserType();
  const userName = userProfile?.nombre || userProfile?.displayName || userProfile?.email?.split('@')[0] || 'Santiago';
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [weeklyProgress, setWeeklyProgress] = useState<string>('0%');
  const [currentScore, setCurrentScore] = useState(0);
  const [hasStudiedToday, setHasStudiedToday] = useState(false);
  const [currentDivision, setCurrentDivision] = useState<{ name: string; icon: string }>({ name: 'Madera', icon: '🪵' });
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [materiasByDominio, setMateriasByDominio] = useState<MateriaWithDominio[]>([]);
  const [materiasLoading, setMateriasLoading] = useState(false);
  const materiasLoadedRef = React.useRef(false);
  const lastMateriasFetchRef = React.useRef(0);
  
  // Estados para el módulo de Progreso
  const [progressData, setProgressData] = useState({
    conceptsDominated: 0,
    totalTime: 0,
    successRate: 0,
    activeNotebooks: 0
  });
  
  // Ya no redirigir usuarios - todos usan la misma página de inicio
  
  // Global cache using localStorage
  const getCachedData = (key: string) => {
    try {
      const cached = localStorage.getItem(`inicio_cache_${key}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed;
      }
    } catch (error) {
      console.error('Error reading cache:', error);
    }
    return null;
  };

  const setCachedData = (key: string, data: any, timestamp: number) => {
    try {
      localStorage.setItem(`inicio_cache_${key}`, JSON.stringify({ data, timestamp }));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  };

  const clearCache = (userId: string) => {
    try {
      localStorage.removeItem(`inicio_cache_materias_${userId}`);
      localStorage.removeItem(`inicio_cache_events_${userId}`);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  // Listen for cache invalidation events
  React.useEffect(() => {
    const handleCacheInvalidation = (event: CustomEvent) => {
      if (event.detail.userId === user?.uid) {
        fetchMateriasByDominio(true); // Force refresh
      }
    };

    window.addEventListener('invalidate-materias-cache', handleCacheInvalidation as EventListener);

    return () => {
      window.removeEventListener('invalidate-materias-cache', handleCacheInvalidation as EventListener);
    };
  }, [user?.uid]);

  // Calculate division based on global score
  const calculateDivision = (globalScore: number) => {
    // Encontrar la división correspondiente al score
    let currentDivision = DIVISION_LEVELS[0]; // Por defecto Madera
    
    for (const division of DIVISION_LEVELS) {
      if (globalScore >= division.minScore && globalScore <= division.maxScore) {
        currentDivision = division;
        break;
      }
    }
    
    console.log(`🏆 Score Global: ${globalScore} -> División: ${currentDivision.name} ${currentDivision.icon}`);
    
    setCurrentDivision({ name: currentDivision.name, icon: currentDivision.icon });
    return { name: currentDivision.name, icon: currentDivision.icon };
  };

  // Check if cache is valid (5 minutes)
  const isCacheValid = (timestamp: number) => {
    return Date.now() - timestamp < 5 * 60 * 1000; // 5 minutes
  };

  // Fetch materias with lowest dominio for module 1
  const fetchMateriasByDominio = async (forceRefresh = false) => {
    if (!user?.uid) return;
    
    // PRIMERA VERIFICACIÓN: Prevenir llamadas simultáneas
    if (materiasLoading) {
      return;
    }
    
    // Debounce: no llamar si se llamó hace menos de 2 segundos
    const now = Date.now();
    if (!forceRefresh && (now - lastMateriasFetchRef.current) < 2000) {
      return;
    }
    lastMateriasFetchRef.current = now;
    
    
    // If already loaded and not forcing refresh, skip
    if (!forceRefresh && materiasLoadedRef.current && materiasByDominio.length > 0) {
      return;
    }
    
    // Check localStorage cache first
    const cachedMaterias = getCachedData(`materias_${user.uid}`);
    // Invalidar caché si tiene exactamente 5 materias (probablemente del límite anterior)
    const cacheValid = cachedMaterias && 
                       isCacheValid(cachedMaterias.timestamp) && 
                       (!cachedMaterias.data || cachedMaterias.data.length !== 5);
    
    
    // TEMPORALMENTE deshabilitado el cache para debug de enrolled courses
    if (false && !forceRefresh && cacheValid && cachedMaterias.data) {
      setMateriasByDominio(cachedMaterias.data);
      materiasLoadedRef.current = true;
      return;
    }
    
    try {
      setMateriasLoading(true);
      
      let materiasSnapshot: any;
      
      // Para todos los usuarios - cargar materias propias y las inscritas
      console.log('👤 Buscando materias para usuario');
      
      // 1. Obtener materias propias
      const materiasQuery = query(
        collection(db, 'materias'),
        where('userId', '==', user.uid)
      );
      const ownMateriasSnapshot = await getDocs(materiasQuery);
      
      // 2. Obtener materias donde está inscrito
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('studentId', '==', user.uid),
        where('status', '==', 'active')
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      
      // 3. Combinar todas las materias
      const allMateriasDocs = [...ownMateriasSnapshot.docs];
      
      // Para cada enrollment, obtener la materia del profesor
      for (const enrollmentDoc of enrollmentsSnapshot.docs) {
        const enrollmentData = enrollmentDoc.data();
        const materiaId = enrollmentData.materiaId;
        console.log(`📖 Fetching enrolled materia: ${materiaId}`);
        
        // Obtener la materia del profesor
        const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
        if (materiaDoc.exists()) {
          allMateriasDocs.push(materiaDoc);
        }
      }
      
      materiasSnapshot = {
        empty: allMateriasDocs.length === 0,
        docs: allMateriasDocs
      };
      
      if (materiasSnapshot.empty) {
        const emptyResult: MateriaWithDominio[] = [];
        setMateriasByDominio(emptyResult);
        setCachedData(`materias_${user.uid}`, emptyResult, Date.now());
        return;
      }
      
      // Calculate dominio for each materia - OPTIMIZED with parallel queries
      console.log(`🚀 Calculating dominio for ${materiasSnapshot.docs.length} materias in parallel...`);
      
      // Create parallel promises for all materia domain progress
      const materiaPromises = materiasSnapshot.docs.map(async (materiaDoc: any) => {
        const materiaData = materiaDoc.data();
        const materiaTitle = materiaData.nombre || materiaData.title || 'Sin nombre';
        
        try {
          // Calculate domain progress (this is where the slowness was)
          const domainProgress = await getDomainProgressForMateria(materiaDoc.id);
          
          const dominioPercentage = domainProgress.total > 0 
            ? Math.round((domainProgress.dominated / domainProgress.total) * 100)
            : 0;
          
          return {
            id: materiaDoc.id,
            title: materiaTitle,
            color: materiaData.color || '#6147FF',
            dominioPercentage,
            totalConcepts: domainProgress.total,
            dominatedConcepts: domainProgress.dominated
          };
        } catch (error) {
          console.error(`Error calculating dominio for materia ${materiaDoc.id}:`, error);
          // Return materia with 0% dominio if error
          return {
            id: materiaDoc.id,
            title: materiaTitle,
            color: materiaData.color || '#6147FF',
            dominioPercentage: 0,
            totalConcepts: 0,
            dominatedConcepts: 0
          };
        }
      });
      
      // Wait for all domain progress calculations to complete
      const materiasWithDominio = await Promise.all(materiaPromises);
      console.log(`✅ Dominio calculation completed for ${materiasWithDominio.length} materias`);
      
      materiasWithDominio.forEach(m => {
        console.log(`  - ${m.title}: ${m.dominioPercentage}% (${m.dominatedConcepts}/${m.totalConcepts})`);
      });
      
      // Sort by lowest dominio first, then by title alphabetically
      materiasWithDominio.sort((a, b) => {
        if (a.dominioPercentage === b.dominioPercentage) {
          return a.title.localeCompare(b.title);
        }
        return a.dominioPercentage - b.dominioPercentage;
      });
      
      // Show all materias sorted by dominio (no limit)
      // const topMaterias = materiasWithDominio.slice(0, 5); // Removed limit
      
      
      setMateriasByDominio(materiasWithDominio); // Use all materias
      
      // Update localStorage cache
      setCachedData(`materias_${user.uid}`, materiasWithDominio, Date.now());
      materiasLoadedRef.current = true;
    } catch (error) {
      console.error('Error fetching materias by dominio:', error);
      setMateriasByDominio([]);
    } finally {
      setMateriasLoading(false);
    }
  };

  // Fetch today's calendar events
  const fetchTodayEvents = async (forceRefresh = false) => {
    if (!user?.uid || (!forceRefresh && eventsLoaded)) {
      return;
    }

    // Check localStorage cache first
    const cachedEvents = getCachedData(`events_${user.uid}`);
    if (!forceRefresh && cachedEvents && isCacheValid(cachedEvents.timestamp)) {
      setTodayEvents(cachedEvents.data);
      setEventsLoaded(true);
      return;
    }

    try {
      setEventsLoading(true);
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const eventsQuery = query(
        collection(db, 'calendarEvents'),
        where('userId', '==', user.uid)
      );
      
      const snapshot = await getDocs(eventsQuery);
      const events: CalendarEvent[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Filter for today's events
        let eventDate = data.date;
        if (data.date instanceof Timestamp) {
          const date = data.date.toDate();
          eventDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        
        if (eventDate === todayString) {
          events.push({
            id: doc.id,
            title: data.title,
            date: eventDate,
            type: data.type || 'custom',
            time: data.time || '',
            description: data.description || ''
          });
        }
      });
      
      // Sort events by time
      events.sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });
      
      setTodayEvents(events);
      setEventsLoaded(true);
      
      // Update localStorage cache
      setCachedData(`events_${user.uid}`, events, Date.now());
    } catch (error) {
      console.error('Error fetching today events:', error);
      setTodayEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const fetchData = async (forceRefresh = false) => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    
    // Check localStorage cache first
    const cachedMainData = getCachedData(`main_data_${user.uid}`);
    if (!forceRefresh && cachedMainData && isCacheValid(cachedMainData.timestamp)) {
      console.log('📦 Usando datos principales desde cache localStorage');
      const data = cachedMainData.data;
      setCurrentStreak(data.currentStreak);
      setHasStudiedToday(data.hasStudiedToday);
      setCurrentScore(data.currentScore);
      setWeeklyProgress(data.weeklyProgress);
      // NO cargar división desde caché - continuar para recalcularla
      // setCurrentDivision(data.currentDivision); // ELIMINADO
      // Cargar datos de progreso desde el caché si existen
      if (data.progressData) {
        setProgressData(data.progressData);
      }
      // NO retornar aquí - continuar para recalcular la división
      // setLoading(false);
      // return;
    }
    
    try {
        console.log('🔄 Obteniendo datos principales del servidor...');
        setLoading(true);
        
        // Obtener racha
        const streakService = StudyStreakService.getInstance();
        
        // Verificar si ha estudiado hoy
        const studiedToday = await streakService.hasStudiedToday(user.uid);
        setHasStudiedToday(studiedToday);
        
        // Si ha estudiado hoy, actualizar la racha automáticamente
        let currentStreakValue = 0;
        if (studiedToday) {
          currentStreakValue = await streakService.updateStreakIfStudied(user.uid);
          console.log('🔥 Racha actualizada a:', currentStreakValue);
        } else {
          // Si no ha estudiado hoy, solo obtener la racha actual
          const streakData = await streakService.getUserStreak(user.uid);
          currentStreakValue = streakData.currentStreak;
        }
        setCurrentStreak(currentStreakValue);

        // Obtener KPIs actuales
        const kpiService = await import('../services/kpiService');
        let kpisData = await kpiService.getKPIsFromCache(user.uid);
        const globalScore = kpisData?.global?.scoreGlobal || 0;
        const scoreValue = Math.ceil(globalScore);
        setCurrentScore(scoreValue);
        
        // Calcular división basada en Score Global
        const calculatedDivision = calculateDivision(scoreValue);
        
        // Actualizar datos del módulo de Progreso
        console.log('KPIs Data:', kpisData);
        
        if (kpisData) {
          // Calcular tiempo total en minutos
          const totalMinutes = kpisData.global?.tiempoEstudioGlobal || 0;
          
          // Obtener número de materias del usuario
          const firebase = await import('../services/firebase');
          
          // Contar materias del usuario
          const userMateriasQuery = await firebase.getDocs(
            firebase.query(
              firebase.collection(firebase.db, 'materias'), 
              firebase.where('userId', '==', user.uid)
            )
          );
          const userMateriasCount = userMateriasQuery.size;
          
          // Contar materias de profesores en los que está inscrito
          const userEnrollmentsQuery = await firebase.getDocs(
            firebase.query(
              firebase.collection(firebase.db, 'enrollments'), 
              firebase.where('studentId', '==', user.uid)
            )
          );
          
          const enrolledMateriasSet = new Set();
          for (const enrollmentDoc of userEnrollmentsQuery.docs) {
            const enrollmentData = enrollmentDoc.data();
            enrolledMateriasSet.add(enrollmentData.materiaId);
          }
          
          const totalMaterias = userMateriasCount + enrolledMateriasSet.size;
          
          // Contar cuadernos activos (propios y de profesores inscritos)
          
          // Cuadernos propios
          const ownNotebooksQuery = await firebase.getDocs(
            firebase.query(firebase.collection(firebase.db, 'notebooks'), firebase.where('userId', '==', user.uid))
          );
          
          // Cuadernos de materias inscritas
          const enrollmentsQuery = await firebase.getDocs(
            firebase.query(firebase.collection(firebase.db, 'enrollments'), 
              firebase.where('studentId', '==', user.uid), 
              firebase.where('status', '==', 'active'))
          );
          
          let enrolledNotebooksCount = 0;
          for (const enrollmentDoc of enrollmentsQuery.docs) {
            const enrollmentData = enrollmentDoc.data();
            const teacherNotebooksQuery = await firebase.getDocs(
              firebase.query(
                firebase.collection(firebase.db, 'notebooks'), 
                firebase.where('userId', '==', enrollmentData.teacherId),
                firebase.where('materiaId', '==', enrollmentData.materiaId)
              )
            );
            enrolledNotebooksCount += teacherNotebooksQuery.size;
          }
          
          const activeNotebooks = ownNotebooksQuery.size + enrolledNotebooksCount;
          
          // Obtener conceptos dominados para el módulo de progreso
          const conceptStats = await kpiService.kpiService.getTotalDominatedConceptsByUser(user.uid);
          
          const newProgressData = {
            conceptsDominated: conceptStats.conceptosDominados || 0,
            totalTime: totalMinutes,
            successRate: totalMaterias,
            activeNotebooks: activeNotebooks
          };
          
          setProgressData(newProgressData);
          
          // Obtener historial de posiciones para calcular progreso
          const { getPositionHistory } = await import('../utils/createPositionHistory');
          const history = await getPositionHistory(user.uid, 'general', 2); // Obtener últimas 2 semanas
          
          let weeklyProgressValue = '0%';
          if (history.length >= 2) {
            // Comparar score actual con el de la semana pasada
            const currentWeekScore = history[0].score;
            const lastWeekScore = history[1].score;
            
            if (lastWeekScore > 0) {
              const percentageChange = ((currentWeekScore - lastWeekScore) / lastWeekScore) * 100;
              const sign = percentageChange >= 0 ? '+' : '';
              weeklyProgressValue = `${sign}${Math.round(percentageChange)}%`;
            } else if (currentWeekScore > 0) {
              weeklyProgressValue = '+100%';
            } else {
              weeklyProgressValue = '0%';
            }
          } else {
            weeklyProgressValue = 'N/A';
          }
          setWeeklyProgress(weeklyProgressValue);
          
          // Cache the main data including progress data (con los datos actualizados)
          const mainData = {
            currentStreak: currentStreakValue, // Usar el valor de racha actualizado
            hasStudiedToday: studiedToday,
            currentScore: scoreValue,
            weeklyProgress: weeklyProgressValue,
            currentDivision: calculatedDivision, // Usar la división recién calculada
            progressData: newProgressData // Usar los nuevos datos de progreso
          };
          setCachedData(`main_data_${user.uid}`, mainData, Date.now());
        } else {
          
          // Intentar inicializar KPIs si no existen
          console.log('🔄 Intentando inicializar KPIs para el usuario...');
          try {
            const { kpiService: kpiSvc } = await import('../services/kpiService');
            await kpiSvc.updateUserKPIs(user.uid);
            // Intentar obtener los KPIs recién creados
            const newKpisData = await kpiSvc.getUserKPIs(user.uid);
            if (newKpisData) {
              // Actualizar kpisData en lugar de usar setMainData que no existe
              kpisData = newKpisData;
            }
          } catch (initError) {
          }
          
          const defaultProgressData = {
            conceptsDominated: 0,
            totalTime: 0,
            successRate: 0,
            activeNotebooks: 0
          };
          setProgressData(defaultProgressData);
          
          // Obtener historial de posiciones para calcular progreso
          const { getPositionHistory } = await import('../utils/createPositionHistory');
          const history = await getPositionHistory(user.uid, 'general', 2); // Obtener últimas 2 semanas
          
          let weeklyProgressValue = '0%';
          if (history.length >= 2) {
            // Comparar score actual con el de la semana pasada
            const currentWeekScore = history[0].score;
            const lastWeekScore = history[1].score;
            
            if (lastWeekScore > 0) {
              const percentageChange = ((currentWeekScore - lastWeekScore) / lastWeekScore) * 100;
              const sign = percentageChange >= 0 ? '+' : '';
              weeklyProgressValue = `${sign}${Math.round(percentageChange)}%`;
            } else if (currentWeekScore > 0) {
              weeklyProgressValue = '+100%';
            } else {
              weeklyProgressValue = '0%';
            }
          } else {
            weeklyProgressValue = 'N/A';
          }
          setWeeklyProgress(weeklyProgressValue);
          
          // Cache the main data including progress data (con valores por defecto)
          const mainData = {
            currentStreak: currentStreakValue, // Usar el valor de racha actualizado
            hasStudiedToday: studiedToday,
            currentScore: scoreValue,
            weeklyProgress: weeklyProgressValue,
            currentDivision: calculatedDivision, // Usar la división recién calculada
            progressData: defaultProgressData // Usar los datos por defecto
          };
          setCachedData(`main_data_${user.uid}`, mainData, Date.now());
        }
        
      } catch (error) {
        console.error('Error obteniendo datos:', error);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    if (user?.uid) {
      
      // Reset loaded ref when user changes
      materiasLoadedRef.current = false;
      
      // Initialize with cached data IMMEDIATELY
      const cachedMaterias = getCachedData(`materias_${user.uid}`);
      const cachedEvents = getCachedData(`events_${user.uid}`);
      const cachedMainData = getCachedData(`main_data_${user.uid}`);
      
      // Limpiar caché si tiene exactamente 5 materias (límite anterior)
      if (cachedMaterias?.data?.length === 5) {
        localStorage.removeItem(`inicio_cache_materias_${user.uid}`);
      }
      
      // Load main data from cache
      if (cachedMainData && isCacheValid(cachedMainData.timestamp)) {
        const data = cachedMainData.data;
        setCurrentStreak(data.currentStreak);
        setHasStudiedToday(data.hasStudiedToday);
        setCurrentScore(data.currentScore);
        setWeeklyProgress(data.weeklyProgress);
        // NO cargar la división desde el caché - siempre recalcular basado en conceptos actuales
        // setCurrentDivision(data.currentDivision); // ELIMINADO - división se calcula en fetchData()
        // Cargar datos de progreso desde el caché si existen
        if (data.progressData) {
          setProgressData(data.progressData);
        }
        setLoading(false);
      }
      
      if (cachedMaterias && isCacheValid(cachedMaterias.timestamp)) {
        setMateriasByDominio(cachedMaterias.data);
        materiasLoadedRef.current = true;
      }
      
      if (cachedEvents && isCacheValid(cachedEvents.timestamp)) {
        setTodayEvents(cachedEvents.data);
        setEventsLoaded(true);
      }
      
      // Then fetch fresh data in background
      fetchData();
      fetchTodayEvents();
      // Solo cargar materias si no están en cache
      if (!cachedMaterias || !isCacheValid(cachedMaterias.timestamp)) {
        fetchMateriasByDominio();
      }
    } else {
      setLoading(false);
      setEventsLoading(false);
      setEventsLoaded(false);
      setMateriasLoading(false);
      materiasLoadedRef.current = false;
    }
  }, [user?.uid]);

  // Refrescar datos cuando la página recibe el foco (usuario regresa después de estudiar)
  useEffect(() => {
    const handleFocus = () => {
      if (user?.uid) {
        console.log('Página recibió foco, refrescando datos...');
        // Force refresh main data
        fetchData();
        // Force refresh cached data
        setEventsLoaded(false);
        fetchTodayEvents(true);
        fetchMateriasByDominio(true);
      }
    };

    // Also listen for visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.uid) {
        
        const cachedMaterias = getCachedData(`materias_${user.uid}`);
        const cachedEvents = getCachedData(`events_${user.uid}`);
        const cachedMainData = getCachedData(`main_data_${user.uid}`);
        
        // Only refresh if cache is old
        if (!cachedMainData || !isCacheValid(cachedMainData.timestamp)) {
          console.log('🔄 Cache de datos principales expirado, refrescando...');
          fetchData(false);
        }
        if (!cachedEvents || !isCacheValid(cachedEvents.timestamp)) {
          console.log('🔄 Cache de eventos expirado, refrescando...');
          fetchTodayEvents(false);
        }
        // Only check materias if not already loaded or cache is invalid
        if (!materiasLoadedRef.current || !cachedMaterias || !isCacheValid(cachedMaterias.timestamp)) {
          console.log('🔄 Cache de materias expirado o no cargado, refrescando...');
          fetchMateriasByDominio(false);
        } else {
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.uid]); // Remove dataCache from dependencies to prevent re-renders

  // Datos del dashboard
  const dailyStats = {
    streak: currentStreak,
    todayMinutes: 0,
    weeklyProgress: weeklyProgress,
    weeklyTimeChange: '+15%', // Cambio porcentual en tiempo semanal
    currentDivision: currentDivision.name,
    divisionIcon: currentDivision.icon,
    globalScore: currentScore
  };

  return (
    <div className="dashboard-container">
      <HeaderWithHamburger title="Página de Inicio" />
      
      <div className="dashboard-content">
        
        {/* 🟪 FILA 1: Bienvenida y resumen diario */}
        <section className="row-1">
          <div className="welcome-section">
            <div className="welcome-content">
              <h1 className="welcome-greeting">Hola, {userName}</h1>
            </div>
          </div>
          
          <div className="daily-metrics">
            <div className="metric-card">
              <div className="metric-info-icon" data-tooltip="Días consecutivos de estudio">
                <i className="fas fa-info-circle"></i>
              </div>
              <FontAwesomeIcon icon={faFire} className="metric-icon fire" />
              <div className="metric-content">
                <span className="metric-label">Racha</span>
                <span className="metric-value">{loading ? '...' : `${dailyStats.streak} días`}</span>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-info-icon" data-tooltip="Puntos bonus acumulados por tu racha de estudio">
                <i className="fas fa-info-circle"></i>
              </div>
              <FontAwesomeIcon icon={faGift} className="metric-icon bonus" />
              <div className="metric-content">
                <span className="metric-label">Bonus</span>
                <span className="metric-value">{loading ? '...' : `${dailyStats.streak * 200} pts`}</span>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-info-icon" data-tooltip="Estado de tu sesión de estudio del día de hoy">
                <i className="fas fa-info-circle"></i>
              </div>
              <FontAwesomeIcon icon={faChartLine} className="metric-icon progress" />
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
              <FontAwesomeIcon icon={faMedal} className="metric-icon division" />
              <div className="metric-content">
                <span className="metric-label">División</span>
                <span className="metric-value">
                  <span style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}>{dailyStats.divisionIcon}</span>
                  {dailyStats.currentDivision}
                </span>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-info-icon" data-tooltip="Tu puntuación global acumulada de todos tus estudios">
                <i className="fas fa-info-circle"></i>
              </div>
              <FontAwesomeIcon icon={faTrophy} className="metric-icon score" />
              <div className="metric-content">
                <span className="metric-label">Score Global</span>
                <span className="metric-value">{loading ? '...' : dailyStats.globalScore.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 🟦 FILA 2: Módulos horizontales */}
        <section className="row-2">
          <div className="horizontal-modules-container">
            <div className="horizontal-module materias-dominio-module">
              <div className="metric-info-icon" data-tooltip="Materias ordenadas por menor dominio">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="module-content">
                <div 
                  className="module-header"
                  onClick={() => navigate('/materias')}
                  style={{ cursor: 'pointer' }}
                >
                  <h3>Materias</h3>
                  <span className="current-date">Menor Dominio</span>
                </div>
                <div className="materias-container">
                  {materiasLoading ? (
                    <p className="loading-text">Cargando materias...</p>
                  ) : materiasByDominio.length > 0 ? (
                    <div 
                      className={`materias-list ${materiasByDominio.length > 5 ? 'has-scroll' : ''}`}
                      onScroll={(e) => {
                        // Opcionalmente podemos agregar lógica de scroll aquí
                        const element = e.currentTarget;
                        if (element.scrollHeight > element.clientHeight) {
                          element.classList.add('has-scroll');
                        }
                      }}
                    >
                      {materiasByDominio.map((materia, index) => {
                        // Determine dominio level for styling
                        const getDominioLevel = (percentage: number) => {
                          if (percentage < 30) return 'low';
                          if (percentage < 70) return 'medium';
                          return 'high';
                        };
                        
                        return (
                          <div 
                            key={materia.id} 
                            className="materia-item"
                            style={{ '--materia-color': materia.color } as React.CSSProperties}
                            onClick={() => {
                              const encodedNameWithId = `${encodeURIComponent(materia.title)}-${materia.id}`;
                              navigate(`/materias/${encodedNameWithId}/notebooks`);
                            }}
                          >
                            <div className="materia-rank">#{index + 1}</div>
                            <div className="materia-info">
                              <div className="materia-details">
                                <div className="materia-title">{materia.title}</div>
                              </div>
                            </div>
                            <div className={`dominio-percentage ${getDominioLevel(materia.dominioPercentage)}`}>
                              {materia.dominioPercentage}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div 
                      className={`no-materias ${!isSchoolStudent ? 'clickable' : ''}`}
                      onClick={() => {
                        if (!isSchoolStudent) {
                          navigate('/materias');
                        }
                      }}
                      style={{ cursor: !isSchoolStudent ? 'pointer' : 'default' }}
                    >
                      <FontAwesomeIcon icon={faBook} style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        No tienes materias
                      </p>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
                        Crea tu primera materia o únete a una
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="horizontal-module study-modes-module">
              <div className="metric-info-icon" data-tooltip="Selecciona tu modo de estudio preferido">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="module-content">
                <div 
                  className="module-header"
                  onClick={() => navigate('/study')}
                  style={{ cursor: 'pointer' }}
                >
                  <h3>Modos de Estudio</h3>
                  <span className="current-date">Elige tu modo</span>
                </div>
                <div className="study-modes-grid">
                  <div 
                    className="study-mode-card intelligent-mode"
                    onClick={() => navigate('/study')}
                  >
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-brain"></i>
                    </div>
                    <span className="mode-title">Repaso Inteligente</span>
                  </div>
                  
                  <div 
                    className="study-mode-card quiz-mode"
                    onClick={() => navigate('/study')}
                  >
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-trophy"></i>
                    </div>
                    <span className="mode-title">Quiz</span>
                  </div>
                  
                  <div 
                    className="study-mode-card free-mode"
                    onClick={() => navigate('/study')}
                  >
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-book-open"></i>
                    </div>
                    <span className="mode-title">Estudio Libre</span>
                  </div>
                  
                  <div 
                    className="study-mode-card games-mode"
                    onClick={() => navigate('/study')}
                  >
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-gamepad"></i>
                    </div>
                    <span className="mode-title">Juegos</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="horizontal-module progress-module">
              <div className="metric-info-icon" data-tooltip="Resumen de tu progreso académico">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="module-content">
                <div 
                  className="module-header"
                  onClick={() => navigate('/progress')}
                  style={{ cursor: 'pointer' }}
                >
                  <h3>Progreso</h3>
                  <span className="current-date">Tu resumen</span>
                </div>
                <div className="progress-insights-container">
                  <div 
                    className="progress-metric"
                    onClick={() => navigate('/progress')}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="progress-metric-value">
                      <i className="fas fa-brain"></i>
                      <span>{loading ? '...' : progressData.conceptsDominated}</span>
                    </div>
                    <span className="progress-metric-label">Conceptos Dominados</span>
                  </div>
                  
                  <div 
                    className="progress-metric"
                    onClick={() => navigate('/progress')}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="progress-metric-value">
                      <i className="fas fa-clock"></i>
                      <span>{loading ? '...' : `${Math.round(progressData.totalTime)}m`}</span>
                    </div>
                    <span className="progress-metric-label">Tiempo Total</span>
                  </div>
                  
                  <div 
                    className="progress-metric"
                    onClick={() => navigate('/progress')}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="progress-metric-value">
                      <i className="fas fa-graduation-cap"></i>
                      <span>{loading ? '...' : `${progressData.successRate}`}</span>
                    </div>
                    <span className="progress-metric-label">Materias Activas</span>
                  </div>
                  
                  <div 
                    className="progress-metric"
                    onClick={() => navigate('/progress')}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="progress-metric-value">
                      <i className="fas fa-book"></i>
                      <span>{loading ? '...' : progressData.activeNotebooks}</span>
                    </div>
                    <span className="progress-metric-label">Cuadernos Activos</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="horizontal-module calendar-module">
              <div className="metric-info-icon" data-tooltip="Eventos y actividades programadas">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="module-content">
                <div 
                  className="module-header"
                  onClick={() => navigate('/calendar')}
                  style={{ cursor: 'pointer' }}
                >
                  <h3>Calendario</h3>
                  <span className="current-date">
                    {(() => {
                      const today = new Date();
                      const weekday = today.toLocaleDateString('es-ES', { weekday: 'short' });
                      const day = today.getDate().toString().padStart(2, '0');
                      return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}. ${day}`;
                    })()}
                  </span>
                </div>
                <div className="events-container">
                  {eventsLoading && todayEvents.length === 0 ? (
                    <p className="loading-text">Cargando eventos...</p>
                  ) : todayEvents.length > 0 ? (
                    <div className="events-list">
                      {todayEvents.map(event => (
                        <div 
                          key={event.id} 
                          className="event-item clickable-event"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/calendar', { 
                              state: { 
                                selectedDate: event.date,
                                view: 'day'
                              } 
                            });
                          }}
                        >
                          <div className="event-time">{event.time || 'Todo el día'}</div>
                          <div className="event-title">{event.title}</div>
                          {event.description && (
                            <div className="event-description">{event.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="events-list">
                      <div 
                        className="event-item"
                        style={{ opacity: 0.6, cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/calendar');
                        }}
                      >
                        <div className="event-time">Todo el día</div>
                        <div className="event-title">No tienes eventos hoy</div>
                        <div className="event-description" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                          Click para agregar un evento
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
        
      </div>
    </div>
  );
};

export default InicioPage;