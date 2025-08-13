import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFire, faClock, faChartLine, faGift, faMedal, faTrophy,
  faBook, faGraduationCap, faChartBar, faCalendarAlt, faCalendar
} from '@fortawesome/free-solid-svg-icons';
import { StudyStreakService } from '../services/studyStreakService';
import { db, collection, query, where, getDocs, getDoc, doc, Timestamp } from '../services/firebase';
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

// División levels configuration
const DIVISION_LEVELS = {
  WOOD: { name: 'Madera', icon: '🪵', color: '#8B4513', ranges: [1, 5, 10, 15, 20] },
  STONE: { name: 'Piedra', icon: '⛰️', color: '#808080', ranges: [25, 35, 45, 55, 65] },
  BRONZE: { name: 'Bronce', icon: '🥉', color: '#CD7F32', ranges: [75, 90, 110, 130, 150] },
  SILVER: { name: 'Plata', icon: '🥈', color: '#C0C0C0', ranges: [170, 200, 230, 260, 300] },
  GOLD: { name: 'Oro', icon: '🥇', color: '#FFD700', ranges: [330, 380, 430, 480, 550] },
  RUBY: { name: 'Rubí', icon: '💎', color: '#E0115F', ranges: [600, 700, 850, 1000, 1200] },
  JADE: { name: 'Jade', icon: '💚', color: '#50C878', ranges: [1400, 1650, 1900, 2200, 2500] },
  CRYSTAL: { name: 'Cristal', icon: '💙', color: '#0F52BA', ranges: [2800, 3200, 3700, 4200, 4800] },
  COSMIC: { name: 'Cósmico', icon: '💜', color: '#9966CC', ranges: [5400, 6100, 6900, 7800, 8800] },
  VOID: { name: 'Vacío', icon: '⚫', color: '#1C1C1C', ranges: [10000, 11500, 13000, 15000, 17000] },
  LEGEND: { name: 'Leyenda', icon: '⭐', color: '#FF6B35', ranges: [20000, 25000, 30000, 40000, 50000] }
};

const InicioPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  const { isSchoolTeacher, isSchoolStudent, isSchoolAdmin, isSchoolTutor } = useUserType();
  const userName = userProfile?.displayName || userProfile?.email?.split('@')[0] || 'Santiago';
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
  
  // Redirección automática para usuarios escolares
  useEffect(() => {
    if (isSchoolTeacher) {
      console.log('🎓 Profesor detectado, redirigiendo a /teacher/home');
      navigate('/teacher/home', { replace: true });
    } else if (isSchoolAdmin) {
      console.log('👨‍💼 Admin escolar detectado, redirigiendo a /school/admin');
      navigate('/school/admin', { replace: true });
    } else if (isSchoolTutor) {
      console.log('👨‍🏫 Tutor detectado, redirigiendo a /school/tutor');
      navigate('/school/tutor', { replace: true });
    }
    // Los estudiantes escolares pueden quedarse en esta página
  }, [isSchoolTeacher, isSchoolAdmin, isSchoolTutor, navigate]);
  
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
      console.log('🗑️ Cache de inicio limpiado');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  // Listen for cache invalidation events
  React.useEffect(() => {
    const handleCacheInvalidation = (event: CustomEvent) => {
      if (event.detail.userId === user?.uid) {
        console.log('🔄 Cache invalidado, recargando materias...');
        fetchMateriasByDominio(true); // Force refresh
      }
    };

    window.addEventListener('invalidate-materias-cache', handleCacheInvalidation as EventListener);

    return () => {
      window.removeEventListener('invalidate-materias-cache', handleCacheInvalidation as EventListener);
    };
  }, [user?.uid]);

  // Calculate division based on concepts learned
  const calculateDivision = (concepts: number) => {
    let divisionKey = 'WOOD';
    
    console.log('🏆 Calculando división para', concepts, 'conceptos');
    
    // Ordenar las divisiones por su valor mínimo para procesarlas en orden
    const divisionsInOrder = Object.entries(DIVISION_LEVELS).sort((a, b) => {
      const minA = Math.min(...a[1].ranges);
      const minB = Math.min(...b[1].ranges);
      return minA - minB;
    });
    
    // Find current division based on concepts
    for (const [key, data] of divisionsInOrder) {
      const minInDivision = Math.min(...data.ranges);
      const maxInDivision = Math.max(...data.ranges);
      console.log(`  - ${key}: rango ${minInDivision}-${maxInDivision}, conceptos actuales: ${concepts}`);
      
      if (concepts >= minInDivision && concepts <= maxInDivision) {
        // El usuario está en esta división
        divisionKey = key;
        console.log(`  ✓ DIVISIÓN ENCONTRADA: ${key}`);
      } else if (concepts > maxInDivision) {
        // El usuario superó esta división, continuar buscando
        divisionKey = key; // Mantener esta como la más alta alcanzada hasta ahora
        console.log(`  ↑ Superó ${key}, continuando...`);
      } else {
        // El usuario no alcanza esta división, usar la anterior
        console.log(`  ✗ No alcanza ${key}, usando la división anterior`);
        break;
      }
    }
    
    const division = DIVISION_LEVELS[divisionKey as keyof typeof DIVISION_LEVELS];
    console.log(`🎖️ División final asignada: ${division.name} ${division.icon} para ${concepts} conceptos`);
    setCurrentDivision({ name: division.name, icon: division.icon });
    return { name: division.name, icon: division.icon }; // Return the division for immediate use
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
      console.log('⏳ Ya se están cargando las materias, ignorando llamada duplicada');
      return;
    }
    
    // Debounce: no llamar si se llamó hace menos de 2 segundos
    const now = Date.now();
    if (!forceRefresh && (now - lastMateriasFetchRef.current) < 2000) {
      console.log('⏱️ Llamada muy reciente, ignorando (debounce 2s)');
      return;
    }
    lastMateriasFetchRef.current = now;
    
    console.log(`🔍 fetchMateriasByDominio llamada - forceRefresh: ${forceRefresh}, loaded: ${materiasLoadedRef.current}`);
    
    // If already loaded and not forcing refresh, skip
    if (!forceRefresh && materiasLoadedRef.current && materiasByDominio.length > 0) {
      console.log('✅ Materias ya cargadas en memoria, no recargando');
      return;
    }
    
    // Check localStorage cache first
    const cachedMaterias = getCachedData(`materias_${user.uid}`);
    const cacheValid = cachedMaterias && isCacheValid(cachedMaterias.timestamp);
    
    console.log(`💾 Cache status - exists: ${!!cachedMaterias}, valid: ${cacheValid}`);
    
    // Para estudiantes escolares, siempre forzar recarga en desarrollo
    if (!forceRefresh && cacheValid && cachedMaterias.data && !isSchoolStudent) {
      console.log('📦 Usando materias desde cache localStorage');
      setMateriasByDominio(cachedMaterias.data);
      materiasLoadedRef.current = true;
      return;
    }
    
    if (isSchoolStudent) {
      console.log('👩‍🎓 Estudiante escolar detectado, forzando recarga de materias desde servidor');
    }
    
    try {
      console.log('🚀 Iniciando carga de materias desde servidor...');
      console.log('📚 Tipo de usuario - isSchoolStudent:', isSchoolStudent, 'isSchoolTeacher:', isSchoolTeacher);
      setMateriasLoading(true);
      
      let materiasSnapshot: any;
      
      if (isSchoolStudent || isSchoolTeacher) {
        // Para usuarios escolares, buscar materias asignadas
        console.log('👩‍🎓 Buscando materias para usuario escolar');
        
        // Obtener datos del usuario
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          console.log('❌ No se encontró documento del usuario');
          setMateriasByDominio([]);
          return;
        }
        
        const userData = userDoc.data();
        const subjectIds = userData.subjectIds || [];
        
        console.log('📚 Subject IDs del usuario:', subjectIds);
        
        if (subjectIds.length === 0) {
          console.log('⚠️ Usuario sin materias asignadas');
          const emptyResult: MateriaWithDominio[] = [];
          setMateriasByDominio(emptyResult);
          setCachedData(`materias_${user.uid}`, emptyResult, Date.now());
          return;
        }
        
        // Obtener las materias de schoolSubjects
        const materiasDocs: any[] = [];
        for (const subjectId of subjectIds) {
          const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
          if (subjectDoc.exists()) {
            materiasDocs.push(subjectDoc);
          }
        }
        
        materiasSnapshot = {
          empty: materiasDocs.length === 0,
          docs: materiasDocs
        };
      } else {
        // Para usuarios regulares
        const materiasQuery = query(
          collection(db, 'materias'),
          where('userId', '==', user.uid)
        );
        materiasSnapshot = await getDocs(materiasQuery);
      }
      
      if (materiasSnapshot.empty) {
        const emptyResult: MateriaWithDominio[] = [];
        setMateriasByDominio(emptyResult);
        setCachedData(`materias_${user.uid}`, emptyResult, Date.now());
        return;
      }
      
      // Calculate dominio for each materia
      const materiasWithDominio: MateriaWithDominio[] = [];
      
      for (const materiaDoc of materiasSnapshot.docs) {
        const materiaData = materiaDoc.data();
        try {
          // Para usuarios escolares, usar una lógica diferente
          let domainProgress;
          if (isSchoolStudent || isSchoolTeacher) {
            // Para usuarios escolares, calcular dominio basado en notebooks de la materia
            console.log(`📊 Calculando dominio para materia escolar: ${materiaDoc.id}`);
            domainProgress = await getDomainProgressForMateria(materiaDoc.id);
          } else {
            domainProgress = await getDomainProgressForMateria(materiaDoc.id);
          }
          
          const dominioPercentage = domainProgress.total > 0 
            ? Math.round((domainProgress.dominated / domainProgress.total) * 100)
            : 0;
          
          // Para materias escolares, usar el campo 'nombre' en lugar de 'title'
          const materiaTitle = materiaData.nombre || materiaData.title || 'Sin nombre';
          
          materiasWithDominio.push({
            id: materiaDoc.id,
            title: materiaTitle,
            color: materiaData.color || '#6147FF',
            dominioPercentage,
            totalConcepts: domainProgress.total,
            dominatedConcepts: domainProgress.dominated
          });
        } catch (error) {
          console.error(`Error calculating dominio for materia ${materiaDoc.id}:`, error);
          // Include materia with 0% dominio if error
          const materiaTitle = materiaData.nombre || materiaData.title || 'Sin nombre';
          materiasWithDominio.push({
            id: materiaDoc.id,
            title: materiaTitle,
            color: materiaData.color || '#6147FF',
            dominioPercentage: 0,
            totalConcepts: 0,
            dominatedConcepts: 0
          });
        }
      }
      
      // Sort by lowest dominio first, then by title alphabetically
      materiasWithDominio.sort((a, b) => {
        if (a.dominioPercentage === b.dominioPercentage) {
          return a.title.localeCompare(b.title);
        }
        return a.dominioPercentage - b.dominioPercentage;
      });
      
      // Take only top 5
      const topMaterias = materiasWithDominio.slice(0, 5);
      
      console.log('📚 Materias con dominio calculado:', materiasWithDominio);
      console.log('📚 Top 5 materias:', topMaterias);
      
      setMateriasByDominio(topMaterias);
      
      // Update localStorage cache
      setCachedData(`materias_${user.uid}`, topMaterias, Date.now());
      console.log('💾 Materias guardadas en cache localStorage');
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
      console.log('📦 Usando eventos desde cache localStorage');
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
      console.log('💾 Eventos guardados en cache localStorage');
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
        console.log('📊 Usando datos de progreso desde cache:', data.progressData);
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
          console.log('✅ Usuario ha estudiado hoy, actualizando racha...');
          currentStreakValue = await streakService.updateStreakIfStudied(user.uid);
          console.log('🔥 Racha actualizada a:', currentStreakValue);
        } else {
          // Si no ha estudiado hoy, solo obtener la racha actual
          const streakData = await streakService.getUserStreak(user.uid);
          currentStreakValue = streakData.currentStreak;
          console.log('📊 Racha actual (sin actualizar):', currentStreakValue);
        }
        console.log('🎯 Valor final de racha para mostrar:', currentStreakValue);
        setCurrentStreak(currentStreakValue);

        // Obtener KPIs actuales
        const kpiService = await import('../services/kpiService');
        const kpisData = await kpiService.getKPIsFromCache(user.uid);
        const globalScore = kpisData?.global?.scoreGlobal || 0;
        const scoreValue = Math.ceil(globalScore);
        setCurrentScore(scoreValue);
        
        // Obtener conceptos dominados y calcular división
        const conceptStats = await kpiService.kpiService.getTotalDominatedConceptsByUser(user.uid);
        console.log('🎯 División: Conceptos dominados actuales:', conceptStats.conceptosDominados);
        
        // También obtener conceptos con repeticiones >= 2 (otra métrica alternativa)
        const conceptsWithRepetitions = await kpiService.kpiService.getConceptsWithMinRepetitions(user.uid, 2);
        console.log('🎯 División: Conceptos con 2+ repeticiones:', conceptsWithRepetitions);
        
        // Usar el mayor de los dos valores para ser más generoso con la división
        const conceptsForDivision = Math.max(conceptStats.conceptosDominados, conceptsWithRepetitions);
        console.log('🎯 División: Usando', conceptsForDivision, 'conceptos para calcular división');
        
        const calculatedDivision = calculateDivision(conceptsForDivision);
        
        // Actualizar datos del módulo de Progreso
        console.log('📊 Actualizando datos del módulo de Progreso...');
        console.log('KPIs Data:', kpisData);
        console.log('Concept Stats:', conceptStats);
        
        if (kpisData) {
          // Calcular tiempo total en horas
          const totalMinutes = kpisData.global?.tiempoEstudioGlobal || 0;
          const totalHours = Math.round(totalMinutes / 60);
          
          // Calcular tasa de éxito (usar percentil como indicador de éxito)
          const successRate = Math.round(kpisData.global?.percentilPromedioGlobal || 0);
          
          // Contar cuadernos activos
          const notebooksQuery = await import('../services/firebase').then(m => 
            m.getDocs(m.query(m.collection(m.db, 'notebooks'), m.where('userId', '==', user.uid)))
          );
          const activeNotebooks = notebooksQuery.size;
          
          const newProgressData = {
            conceptsDominated: conceptStats.conceptosDominados || 0,
            totalTime: totalHours,
            successRate: successRate,
            activeNotebooks: activeNotebooks
          };
          
          console.log('📊 Nuevos datos de progreso:', newProgressData);
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
          console.log('💾 Datos principales y de progreso guardados en cache localStorage con división:', calculatedDivision);
        } else {
          console.log('⚠️ No se encontraron KPIs data, estableciendo valores por defecto');
          const defaultProgressData = {
            conceptsDominated: conceptStats?.conceptosDominados || 0,
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
          console.log('💾 Datos principales guardados con valores por defecto en cache localStorage con división:', calculatedDivision);
        }
        
      } catch (error) {
        console.error('Error obteniendo datos:', error);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    if (user?.uid) {
      console.log('🚀 Inicializando página de inicio para usuario:', user.uid);
      console.log('📚 Tipo de usuario detectado:', {
        isSchoolStudent,
        isSchoolTeacher,
        isSchoolAdmin,
        isSchoolTutor
      });
      
      // Reset loaded ref when user changes
      materiasLoadedRef.current = false;
      
      // Initialize with cached data IMMEDIATELY
      const cachedMaterias = getCachedData(`materias_${user.uid}`);
      const cachedEvents = getCachedData(`events_${user.uid}`);
      const cachedMainData = getCachedData(`main_data_${user.uid}`);
      
      // Load main data from cache
      if (cachedMainData && isCacheValid(cachedMainData.timestamp)) {
        console.log('⚡ Cargando datos principales desde cache localStorage');
        const data = cachedMainData.data;
        setCurrentStreak(data.currentStreak);
        setHasStudiedToday(data.hasStudiedToday);
        setCurrentScore(data.currentScore);
        setWeeklyProgress(data.weeklyProgress);
        // NO cargar la división desde el caché - siempre recalcular basado en conceptos actuales
        // setCurrentDivision(data.currentDivision); // ELIMINADO - división se calcula en fetchData()
        // Cargar datos de progreso desde el caché si existen
        if (data.progressData) {
          console.log('📊 Cargando datos de progreso desde cache:', data.progressData);
          setProgressData(data.progressData);
        }
        setLoading(false);
      }
      
      if (cachedMaterias && isCacheValid(cachedMaterias.timestamp)) {
        console.log('⚡ Cargando materias desde cache localStorage');
        setMateriasByDominio(cachedMaterias.data);
        materiasLoadedRef.current = true;
      }
      
      if (cachedEvents && isCacheValid(cachedEvents.timestamp)) {
        console.log('⚡ Cargando eventos desde cache localStorage');
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
        console.log('👁️ Pestaña visible, verificando cache...');
        
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
          console.log('✅ Cache de materias válido, no recargando');
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
            <h1 className="welcome-greeting">Hola, {userName}</h1>
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
              <div className="metric-info-icon" data-tooltip="Tu división actual basada en conceptos dominados">
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
              <div className="module-content">
                <div className="module-header">
                  <h3>Materias</h3>
                  <span className="current-date">Menor Dominio</span>
                </div>
                <div className="materias-container">
                  {materiasLoading ? (
                    <p className="loading-text">Cargando materias...</p>
                  ) : materiasByDominio.length > 0 ? (
                    <div className="materias-list">
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
                              const encodedName = encodeURIComponent(materia.title);
                              navigate(`/materias/${encodedName}/notebooks`);
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
                    <div className="no-materias">
                      <FontAwesomeIcon icon={faBook} style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        {isSchoolStudent ? 'No tienes materias asignadas' : 'No tienes materias creadas'}
                      </p>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
                        {isSchoolStudent 
                          ? 'Contacta a tu profesor para que te asigne materias' 
                          : 'Crea tu primera materia para empezar'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="horizontal-module study-modes-module">
              <div className="module-content">
                <div className="module-header">
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
                    <span className="mode-title">Estudio Inteligente</span>
                  </div>
                  
                  <div 
                    className="study-mode-card quiz-mode"
                    onClick={() => navigate('/study')}
                  >
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-trophy"></i>
                    </div>
                    <span className="mode-title">Mini Quiz</span>
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
              <div className="module-content">
                <div className="module-header">
                  <h3>Progreso</h3>
                  <span className="current-date">Tu resumen</span>
                </div>
                <div className="progress-insights-container">
                  <div className="progress-metric">
                    <div className="progress-metric-value">
                      <i className="fas fa-brain"></i>
                      <span>{loading ? '...' : progressData.conceptsDominated}</span>
                    </div>
                    <span className="progress-metric-label">Conceptos Dominados</span>
                  </div>
                  
                  <div className="progress-metric">
                    <div className="progress-metric-value">
                      <i className="fas fa-clock"></i>
                      <span>{loading ? '...' : `${progressData.totalTime}h`}</span>
                    </div>
                    <span className="progress-metric-label">Tiempo Total</span>
                  </div>
                  
                  <div className="progress-metric">
                    <div className="progress-metric-value">
                      <i className="fas fa-percentage"></i>
                      <span>{loading ? '...' : `${progressData.successRate}%`}</span>
                    </div>
                    <span className="progress-metric-label">Tasa de Éxito</span>
                  </div>
                  
                  <div className="progress-metric">
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
              <div className="module-content">
                <div className="module-header">
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