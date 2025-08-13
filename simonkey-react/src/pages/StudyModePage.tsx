// src/pages/StudyModePage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { Notebook } from '../types/interfaces';
import '../styles/StudyModePage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faTrophy, faInfoCircle, faBrain, faQuestion, faBook, faGamepad, faChevronDown, faLightbulb, faStar, faPlay, faChevronLeft, faChevronRight, faMedal, faSnowflake, faClock } from '@fortawesome/free-solid-svg-icons';
import { useUserType } from '../hooks/useUserType';
import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { studyStreakService } from '../services/studyStreakService';
import { useStudyService } from '../hooks/useStudyService';
import { gamePointsService } from '../services/gamePointsService';
import { kpiService } from '../services/kpiService';
import { rankingService } from '../services/rankingService';

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

// Get array of division keys for navigation
const DIVISION_KEYS = Object.keys(DIVISION_LEVELS) as (keyof typeof DIVISION_LEVELS)[];

const StudyModePage = () => {
  const navigate = useNavigate();
  const { isSchoolStudent, subscription } = useUserType();
  const { schoolNotebooks, schoolSubjects } = useSchoolStudentData();
  const studyService = useStudyService(subscription);
  
  // State
  const [materias, setMaterias] = useState<any[]>([]);
  const [selectedMateria, setSelectedMateria] = useState<any | null>(null);
  const [showMateriaDropdown, setShowMateriaDropdown] = useState<boolean>(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [showNotebookDropdown, setShowNotebookDropdown] = useState<boolean>(false);
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [allUserNotebooks, setAllUserNotebooks] = useState<{ [materiaId: string]: { materia: any, notebooks: Notebook[] } }>({});
  const [studyAvailability, setStudyAvailability] = useState<{ 
    available: boolean; 
    nextAvailable?: Date; 
    conceptsCount: number;
    totalConcepts?: number;
    hasStudiedConcepts?: boolean;
  }>({ 
    available: false, 
    conceptsCount: 0 
  });
  const [quizAvailability, setQuizAvailability] = useState<{ available: boolean; nextAvailable?: Date }>({
    available: true
  });
  const [smartStudyCount, setSmartStudyCount] = useState<number>(0);
  const [maxQuizScore, setMaxQuizScore] = useState<number>(0);
  const [freeStudyCount, setFreeStudyCount] = useState<number>(0);
  const [notebookRanking, setNotebookRanking] = useState<{
    userPosition: number;
    totalUsers: number;
    userScore: number;
    pointsToNext: number;
    topUsers: Array<{
      position: number;
      userId: string;
      displayName: string;
      score: number;
      isCurrentUser: boolean;
    }>;
  } | null>(null);
  const [rankingLoadError, setRankingLoadError] = useState<string | null>(null);
  const [gamePoints, setGamePoints] = useState<number>(0);
  
  // Motivational modules state
  const [streakData, setStreakData] = useState({ days: 0, message: '' });
  const [divisionData, setDivisionData] = useState({ 
    current: 'WOOD', 
    progress: 0, 
    total: 0, 
    nextMilestone: 5 
  });
  const [conceptsLearned, setConceptsLearned] = useState(0);
  const [notebookScore, setNotebookScore] = useState({ score: 0, level: 1, progress: 0 });
  const [challenges, setChallenges] = useState<{text: string, boost: string}[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [viewingDivision, setViewingDivision] = useState<keyof typeof DIVISION_LEVELS>('WOOD');
  const [showMedalDetails, setShowMedalDetails] = useState(false);
  const [showNotebookError, setShowNotebookError] = useState(false);

  // Clear notebook selection only on fresh page loads (not when coming back from navigation)
  useEffect(() => {
    // Check if we're coming back from games page
    const comingFromGames = sessionStorage.getItem('returning-from-games');
    if (comingFromGames) {
      // Don't reset selections when returning from games
      sessionStorage.removeItem('returning-from-games');
    } else {
      // Reset selections on fresh loads
      setSelectedNotebook(null);
      setSelectedMateria(null);
      setNotebookScore({ score: 0, level: 1, progress: 0 });
    }
  }, []);

  // Reset score when no notebook is selected
  useEffect(() => {
    if (!selectedNotebook) {
      setNotebookScore({ score: 0, level: 1, progress: 0 });
    }
  }, [selectedNotebook]);

  // Load effective user ID and user data - OPTIMIZADO
  useEffect(() => {
    const loadInitialData = async () => {
      if (!auth.currentUser) return;
      
      try {
        // Cargar effectiveUserId primero
        const effectiveUserData = await getEffectiveUserId();
        const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        setEffectiveUserId(userId);
        
        // Ahora cargar datos del usuario en paralelo
        const [streak, hasStudiedToday, conceptsWithMinReps] = await Promise.all([
          studyStreakService.getUserStreak(userId),
          studyStreakService.hasStudiedToday(userId),
          kpiService.getConceptsWithMinRepetitions(userId, 2)
        ]);
        
        // Actualizar estados
        setStreakData({
          days: streak.currentStreak,
          message: hasStudiedToday ? 
            `¡${streak.currentStreak} días seguidos!` : 
            '¡Estudia hoy para mantener tu racha!'
        });
        
        setConceptsLearned(conceptsWithMinReps);
        calculateDivision(conceptsWithMinReps);
        generateSuggestionsAndChallenges(streak.currentStreak);
        
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };
    
    loadInitialData();
  }, [auth.currentUser]);

  // Generate initial suggestions and challenges immediately
  useEffect(() => {
    // Generate default suggestions and challenges while loading
    generateSuggestionsAndChallenges(0);
  }, []);
  
  // Regenerate suggestions when concepts learned or streak changes
  useEffect(() => {
    if (streakData.days !== undefined) {
      generateSuggestionsAndChallenges(streakData.days);
    }
  }, [conceptsLearned, streakData.days, divisionData]);

  // Load materias
  useEffect(() => {
    const fetchMaterias = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }
      
      try {
        setLoading(true);
        let materiasData: any[] = [];
        
        if (isSchoolStudent && schoolSubjects) {
          materiasData = schoolSubjects.map(subject => ({
            id: subject.id,
            title: subject.nombre,
            color: '#6147FF',
            nombre: subject.nombre
          }));
        } else {
          const materiasQuery = query(
            collection(db, 'materias'),
            where('userId', '==', auth.currentUser.uid)
          );
          
          const materiasSnapshot = await getDocs(materiasQuery);
          materiasData = materiasSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        
        setMaterias(materiasData);
        
        // Don't restore previous selections - force manual selection
        
        setLoading(false);
      } catch (error) {
        console.error("Error al cargar materias:", error);
        setLoading(false);
      }
    };
    
    fetchMaterias();
  }, [navigate, isSchoolStudent, schoolSubjects]);

  // Load all user notebooks organized by materia - OPTIMIZADO
  useEffect(() => {
    const fetchAllUserNotebooks = async () => {
      if (!auth.currentUser || !materias.length) return;
      
      try {
        const notebooksByMateria: { [materiaId: string]: { materia: any, notebooks: Notebook[] } } = {};
        
        if (isSchoolStudent && schoolNotebooks) {
          // Para estudiantes escolares, procesar directamente sin consultas
          materias.forEach(materia => {
            const notebooksData = schoolNotebooks
              .filter(notebook => notebook.idMateria === materia.id)
              .map(notebook => ({
                id: notebook.id,
                title: notebook.title,
                color: notebook.color || '#6147FF',
                type: 'school' as const,
                materiaId: notebook.idMateria,
                isFrozen: notebook.isFrozen || false,
                frozenScore: notebook.frozenScore
              }))
              .sort((a, b) => a.title.localeCompare(b.title));
            
            if (notebooksData.length > 0) {
              notebooksByMateria[materia.id] = {
                materia: materia,
                notebooks: notebooksData
              };
            }
          });
        } else {
          // Para usuarios regulares, hacer una sola consulta para TODOS los notebooks
          const allNotebooksQuery = query(
            collection(db, 'notebooks'),
            where('userId', '==', auth.currentUser.uid)
          );
          
          const notebooksSnapshot = await getDocs(allNotebooksQuery);
          
          // Agrupar notebooks por materia
          materias.forEach(materia => {
            const notebooksData = notebooksSnapshot.docs
              .filter(doc => doc.data().materiaId === materia.id)
              .map(doc => ({
                id: doc.id,
                title: doc.data().title,
                color: doc.data().color || '#6147FF',
                type: doc.data().type || 'personal' as const,
                materiaId: doc.data().materiaId
              }))
              .sort((a, b) => a.title.localeCompare(b.title));
            
            if (notebooksData.length > 0) {
              notebooksByMateria[materia.id] = {
                materia: materia,
                notebooks: notebooksData
              };
            }
          });
        }
        
        setAllUserNotebooks(notebooksByMateria);
      } catch (error) {
        console.error("Error loading all notebooks:", error);
      }
    };
    
    fetchAllUserNotebooks();
  }, [materias, isSchoolStudent, schoolNotebooks]);

  // Load notebooks when materia is selected
  useEffect(() => {
    const fetchNotebooksForMateria = async () => {
      if (!selectedMateria || !auth.currentUser) {
        setNotebooks([]);
        return;
      }
      
      try {
        let notebooksData: Notebook[] = [];
        
        if (isSchoolStudent && schoolNotebooks) {
          notebooksData = schoolNotebooks
            .filter(notebook => notebook.idMateria === selectedMateria.id)
            .map(notebook => ({
              id: notebook.id,
              title: notebook.title,
              color: notebook.color || '#6147FF',
              type: 'school' as const,
              idMateria: notebook.idMateria,
              isFrozen: notebook.isFrozen || false,
              frozenScore: notebook.frozenScore
            }));
        } else {
          const notebooksQuery = query(
            collection(db, 'notebooks'),
            where('userId', '==', auth.currentUser.uid),
            where('materiaId', '==', selectedMateria.id)
          );
          
          const notebooksSnapshot = await getDocs(notebooksQuery);
          notebooksData = notebooksSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            color: doc.data().color || '#6147FF',
            type: doc.data().type || 'personal' as const,
            materiaId: doc.data().materiaId
          }));
        }
        
        setNotebooks(notebooksData);
        
        // Don't auto-select notebooks, user must choose manually
      } catch (error) {
        console.error("Error al cargar cuadernos:", error);
      }
    };
    
    fetchNotebooksForMateria();
  }, [selectedMateria, isSchoolStudent, schoolNotebooks]);


  // Calculate division based on concepts learned
  const calculateDivision = (concepts: number) => {
    let currentDivision = 'WOOD';
    let nextMilestone = 5;
    
    // Find current division
    for (const [key, data] of Object.entries(DIVISION_LEVELS)) {
      const maxInDivision = Math.max(...data.ranges);
      if (concepts >= maxInDivision) {
        continue;
      } else {
        currentDivision = key;
        // Find next milestone in this division
        for (const milestone of data.ranges) {
          if (concepts < milestone) {
            nextMilestone = milestone;
            break;
          }
        }
        break;
      }
    }
    
    // If beyond the highest division, stay at legend max
    if (concepts >= 50000) {
      currentDivision = 'LEGEND';
      nextMilestone = 50000;
    }
    
    setDivisionData({
      current: currentDivision,
      progress: concepts,
      total: nextMilestone,
      nextMilestone
    });
    
    // Set viewing division to current division
    setViewingDivision(currentDivision as keyof typeof DIVISION_LEVELS);
  };

  // Navigation functions for divisions
  const navigateToPreviousDivision = () => {
    const currentIndex = DIVISION_KEYS.indexOf(viewingDivision);
    if (currentIndex > 0) {
      setViewingDivision(DIVISION_KEYS[currentIndex - 1]);
    }
  };

  const navigateToNextDivision = () => {
    const currentIndex = DIVISION_KEYS.indexOf(viewingDivision);
    if (currentIndex < DIVISION_KEYS.length - 1) {
      setViewingDivision(DIVISION_KEYS[currentIndex + 1]);
    }
  };

  // Get medal status for current user
  const getMedalStatus = (requiredConcepts: number) => {
    return conceptsLearned >= requiredConcepts;
  };

  // Generate suggestions and daily challenges
  const generateSuggestionsAndChallenges = (streakDays: number) => {
    const newSuggestions = [];
    
    // Dynamic suggestions based on progress
    if (divisionData.progress < divisionData.nextMilestone) {
      const remaining = divisionData.nextMilestone - divisionData.progress;
      newSuggestions.push(`Estudia ${remaining} concepto${remaining > 1 ? 's' : ''} más y consigue la siguiente medalla`);
    }
    
    // Streak-based suggestions
    if (streakDays === 0) {
      newSuggestions.push('Inicia tu racha estudiando al menos 1 concepto hoy');
    } else if (streakDays > 0) {
      newSuggestions.push(`¡Mantén tu racha! Llevas ${streakDays} día${streakDays > 1 ? 's' : ''} seguido${streakDays > 1 ? 's' : ''}`);
    }
    
    // Division-based suggestions
    if (divisionData.current === 'WOOD' && conceptsLearned === 0) {
      newSuggestions.push('Domina tu primer concepto para empezar tu progreso');
    } else if (divisionData.current === 'WOOD' && conceptsLearned < 20) {
      newSuggestions.push(`Completa la división Madera dominando ${20 - conceptsLearned} conceptos más`);
    }
    
    // Weekly bonus suggestion
    if (streakDays > 0 && streakDays < 7) {
      newSuggestions.push(`${7 - streakDays} día${7 - streakDays > 1 ? 's' : ''} más para bonus semanal (+1400 pts)`);
    } else if (streakDays >= 7 && streakDays < 30) {
      newSuggestions.push(`${30 - streakDays} días más para bonus mensual especial`);
    }
    
    // Score milestone suggestions
    if (streakData.days >= 5) {
      const bonusPoints = streakData.days * 200;
      newSuggestions.push(`Tu racha actual te da ${bonusPoints} puntos de bonus`);
    }
    
    // Add motivational suggestions based on time of day
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      newSuggestions.push('La mañana es el mejor momento para aprender conceptos nuevos');
    } else if (hour >= 12 && hour < 18) {
      newSuggestions.push('Repasa conceptos anteriores para reforzar tu memoria');
    } else if (hour >= 18 && hour < 22) {
      newSuggestions.push('Termina el día dominando al menos 3 conceptos más');
    }
    
    // Limit to 3 suggestions max
    setSuggestions(newSuggestions.slice(0, 3));
    
    // Generate daily challenges (2 options that change daily)
    const allChallenges = [
      { text: 'Completa un Estudio Inteligente en menos de 2 minutos', boost: '+50% XP' },
      { text: 'Domina 5 conceptos seguidos sin fallar ninguno', boost: '+25 puntos' },
      { text: 'Completa un Quiz con puntuación perfecta (10/10)', boost: '+100 puntos' },
      { text: 'Estudia durante 15 minutos sin parar', boost: '+30% XP' },
      { text: 'Aprende 3 conceptos nuevos en modo libre', boost: '+40 puntos' },
      { text: 'Mantén una racha de respuestas correctas de 8 seguidas', boost: '+60 puntos' },
      { text: 'Completa 2 sesiones de estudio en el mismo día', boost: '+75 puntos' },
      { text: 'Alcanza el 90% de precisión en un quiz', boost: '+35% XP' },
      { text: 'Domina 10 conceptos en un solo día', boost: '+150 puntos' },
      { text: 'Juega Space Invaders y obtén más de 500 puntos', boost: '+50 puntos' },
      { text: 'Completa un Mini-Quiz sin errores', boost: '+40 puntos' },
      { text: 'Estudia conceptos de 2 materias diferentes hoy', boost: '+80 puntos' },
      { text: 'Alcanza una racha de 3 días consecutivos', boost: '+200 puntos' },
      { text: 'Domina tu primer concepto del día antes de las 10 AM', boost: '+45% XP' },
      { text: 'Completa el modo Historia de un juego', boost: '+100 puntos' },
      { text: 'Repasa 5 conceptos que dominaste hace una semana', boost: '+30 puntos' }
    ];
    
    // Use current date to select 2 daily challenges
    const today = new Date().toDateString();
    const seed = today.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    const dailyChallenges = [];
    
    // Select 2 different challenges based on today's seed
    const index1 = Math.abs(seed) % allChallenges.length;
    let index2 = Math.abs(seed + 1) % allChallenges.length;
    if (index2 === index1) index2 = (index2 + 1) % allChallenges.length;
    
    dailyChallenges.push(allChallenges[index1]);
    dailyChallenges.push(allChallenges[index2]);
    
    setSuggestions(newSuggestions);
    setChallenges(dailyChallenges);
  };

  // Handle notebook selection - SUPER OPTIMIZADO
  const handleSelectNotebook = async (notebook: Notebook) => {
    if (notebook.isFrozen) {
      alert('Este cuaderno está congelado. No puedes realizar actividades de estudio.');
      return;
    }
    
    setSelectedNotebook(notebook);
    setShowNotebookError(false);
    
    // Mostrar valores estimados INMEDIATAMENTE basados en valores típicos
    setNotebookScore({ score: 0, level: 1, progress: 0 });
    setStudyAvailability({ available: true, conceptsCount: 5 }); // Asumir que hay conceptos disponibles
    setQuizAvailability({ available: true });
    setSmartStudyCount(0);
    setMaxQuizScore(0);
    setFreeStudyCount(0);
    setGamePoints(0);
    
    if (!effectiveUserId) return;
    
    // Cargar datos críticos primero (lo mínimo necesario)
    loadCriticalData(notebook);
    // Cargar datos secundarios en background
    loadSecondaryData(notebook);
  };
  
  // Cargar solo datos críticos para mostrar la UI rápidamente
  const loadCriticalData = async (notebook: Notebook) => {
    if (!effectiveUserId) return;
    
    try {
      console.log('Loading critical data for notebook:', notebook.id);
      
      // SOLO cargar lo esencial para mostrar la UI
      const [
        reviewableConceptsCount,
        allConceptsCount,
        learningData,
        notebookLimitsDoc
      ] = await Promise.all([
        // Obtener el conteo de conceptos disponibles usando el método que respeta SM-3
        studyService.getReviewableConceptsCount(effectiveUserId, notebook.id),
        // Obtener el total de conceptos en el cuaderno
        studyService.getAllConceptsFromNotebook(effectiveUserId, notebook.id).then(concepts => concepts.length),
        // Obtener learning data para calcular próxima fecha
        studyService.getLearningDataForNotebook(effectiveUserId, notebook.id),
        // Notebook limits - para saber si puede hacer quiz
        getDoc(doc(db, 'users', effectiveUserId, 'notebookLimits', notebook.id))
      ]);
        
      // PROCESAR DATOS CRÍTICOS - ultra rápido
      console.log('Critical data loaded, processing...');
      console.log('🎯 Conceptos disponibles para estudio inteligente (SM-3):', reviewableConceptsCount);
      console.log('📚 Total de conceptos en el cuaderno:', allConceptsCount);
      
      // Calcular próxima fecha de revisión si no hay conceptos disponibles
      let nextAvailableDate: Date | undefined;
      let hasStudiedConcepts = false;
      
      if (reviewableConceptsCount === 0 && learningData.length > 0) {
        // Hay datos de aprendizaje, así que ya se han estudiado conceptos
        hasStudiedConcepts = true;
        
        // Encontrar la próxima fecha de revisión más cercana
        const now = new Date();
        for (const ld of learningData) {
          if (ld.nextReviewDate) {
            let nextReview: Date;
            if ((ld.nextReviewDate as any).toDate) {
              nextReview = (ld.nextReviewDate as any).toDate();
            } else if (ld.nextReviewDate instanceof Date) {
              nextReview = ld.nextReviewDate;
            } else {
              nextReview = new Date(ld.nextReviewDate);
            }
            
            if (nextReview > now && (!nextAvailableDate || nextReview < nextAvailableDate)) {
              nextAvailableDate = nextReview;
            }
          }
        }
      }
      
      // Verificar límite de estudio inteligente además de conceptos disponibles
      let canStudyToday = true;
      let studyLimitReason = '';
      
      if (notebookLimitsDoc.exists()) {
        const limits = notebookLimitsDoc.data();
        if (limits.lastSmartStudyDate) {
          const lastSmartStudyDate = limits.lastSmartStudyDate.toDate ? 
            limits.lastSmartStudyDate.toDate() : 
            new Date(limits.lastSmartStudyDate);
          
          const today = new Date();
          const lastStudy = new Date(lastSmartStudyDate);
          
          today.setHours(0, 0, 0, 0);
          lastStudy.setHours(0, 0, 0, 0);
          
          if (today.getTime() === lastStudy.getTime()) {
            canStudyToday = false;
            studyLimitReason = 'Ya usado hoy';
            console.log('❌ Estudio inteligente ya usado hoy para este cuaderno');
          }
        }
      }
      
      // Actualizar disponibilidad de estudio con más contexto
      setStudyAvailability({
        available: reviewableConceptsCount > 0 && canStudyToday,
        nextAvailable: canStudyToday ? nextAvailableDate : new Date(new Date().setDate(new Date().getDate() + 1)),
        conceptsCount: reviewableConceptsCount,
        totalConcepts: allConceptsCount,
        hasStudiedConcepts,
        limitReason: studyLimitReason
      } as any);
      
      // Check quiz availability from limits
      if (notebookLimitsDoc.exists()) {
        const limits = notebookLimitsDoc.data();
        if (limits.lastQuizDate) {
          const lastQuizDate = limits.lastQuizDate.toDate ? limits.lastQuizDate.toDate() : new Date(limits.lastQuizDate);
          const now = new Date();
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          
          if (lastQuizDate > oneWeekAgo) {
            const nextQuizDate = new Date(lastQuizDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            setQuizAvailability({
              available: false,
              nextAvailable: nextQuizDate
            });
          }
        }
      }
      
    } catch (error) {
      console.error('Error loading critical data:', error);
    }
  };
  
  // Cargar datos secundarios en background (puntos, scores, etc)
  const loadSecondaryData = async (notebook: Notebook) => {
    if (!effectiveUserId) return;
    
    try {
      console.log('Loading secondary data in background...');
      
      // Cargar el resto de datos en paralelo
      const [
        quizStatsDoc,
        notebookPoints,
        userStreak,
        smartStudySessions,
        freeStudyCount
      ] = await Promise.all([
        // Quiz stats
        getDoc(doc(db, 'users', effectiveUserId, 'quizStats', notebook.id)),
        // Game points
        gamePointsService.getNotebookPoints(effectiveUserId, notebook.id).catch(() => ({ totalPoints: 0 })),
        // Streak data
        studyStreakService.getUserStreak(effectiveUserId).catch(() => ({ currentStreak: 0 })),
        // Study sessions - Obtener para calcular puntos por intensidad
        getDocs(query(
          collection(db, 'studySessions'),
          where('userId', '==', effectiveUserId),
          where('notebookId', '==', notebook.id),
          where('mode', '==', 'smart'),
          where('validated', '==', true),
          limit(100) // Limitar para performance
        )),
        // Free study count
        getCountFromQuery(query(
          collection(db, 'studySessions'),
          where('userId', '==', effectiveUserId),
          where('notebookId', '==', notebook.id),
          where('mode', '==', 'free'),
          limit(100) // Limitar para performance
        ))
      ]);
      
      // Actualizar valores secundarios
      const maxQuizScoreValue = quizStatsDoc.exists() ? 
        (quizStatsDoc.data().maxScore || 0) : 0;
      setMaxQuizScore(maxQuizScoreValue);
      
      const gamePointsValue = notebookPoints.totalPoints || 0;
      setGamePoints(gamePointsValue);
      
      // Calcular puntos de estudio inteligente basados en intensidad
      // warm_up = 0.5, progress = 1.0, rocket = 2.0
      let smartStudyPoints = 0;
      smartStudySessions.forEach((doc) => {
        const sessionData = doc.data();
        const intensity = sessionData.intensity || 'warm_up';
        
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
            smartStudyPoints += 0.5; // Por defecto warm_up
        }
      });
      
      setSmartStudyCount(smartStudyPoints);
      setFreeStudyCount(freeStudyCount);
      
      // Calculate final score
      const streakBonus = studyStreakService.getStreakBonus(userStreak.currentStreak);
      const studyScore = smartStudyPoints * maxQuizScoreValue;
      const totalScore = studyScore + gamePointsValue + streakBonus;
      
      setNotebookScore({
        score: totalScore,
        level: Math.floor(totalScore / 50) + 1,
        progress: totalScore % 50
      });
      
      // Load ranking if school student - en background
      if (isSchoolStudent) {
        loadNotebookRanking(notebook.id, totalScore);
      }
      
    } catch (error) {
      console.error('Error loading secondary data:', error);
    }
  };
  
  // Helper function para contar documentos sin traerlos todos
  const getCountFromQuery = async (q: any): Promise<number> => {
    try {
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error counting documents:', error);
      return 0;
    }
  };

  // Load notebook ranking - optimizado con consultas paralelas
  const loadNotebookRanking = async (notebookId: string, currentScore?: number) => {
    if (!effectiveUserId || !isSchoolStudent) {
      setNotebookRanking(null);
      setRankingLoadError(null);
      return;
    }
    
    // Reset error state when starting to load
    setRankingLoadError(null);
    
    try {
      console.log('Loading ranking for notebook:', notebookId);
      
      // Cargar notebook y user data en paralelo
      const [notebookDoc, userDoc] = await Promise.all([
        getDoc(doc(db, 'schoolNotebooks', notebookId)),
        getDoc(doc(db, 'users', effectiveUserId))
      ]);
      
      if (!notebookDoc.exists()) {
        console.log('Notebook not found');
        setNotebookRanking(null);
        setRankingLoadError('Cuaderno no encontrado');
        return;
      }
      
      const notebookData = notebookDoc.data();
      const materiaId = notebookData.idMateria || notebookData.materiaId || notebookData.subjectId;
      
      if (!materiaId) {
        console.log('Notebook has no associated subject');
        setNotebookRanking(null);
        setRankingLoadError('Este cuaderno no está asociado a una materia escolar');
        return;
      }
      
      // Get user's institution from already loaded data
      const userData = userDoc.data();
      const institutionId = userData?.idInstitucion || userData?.idEscuela;
      
      if (!institutionId) {
        console.log('User has no institution');
        setNotebookRanking(null);
        setRankingLoadError('No estás asignado a una institución');
        return;
      }
      
      // Get the subject ranking from rankingService
      const ranking = await rankingService.getSubjectRanking(institutionId, materiaId);
      
      if (!ranking || !ranking.students || ranking.students.length === 0) {
        console.log('No ranking data available');
        setNotebookRanking(null);
        setRankingLoadError('No hay datos de ranking disponibles para esta materia');
        return;
      }
      
      // Find current user in ranking
      const userIndex = ranking.students.findIndex((s: any) => s.userId === effectiveUserId);
      // Use the score from ranking if found, otherwise use the provided score or notebookScore
      const userScore = userIndex >= 0 ? ranking.students[userIndex].score : (currentScore || notebookScore?.score || 0);
      
      // Calculate user position
      let userPosition = userIndex >= 0 ? userIndex + 1 : 0;
      
      // If user is not in ranking but has score, calculate their position
      if (userIndex < 0 && userScore > 0) {
        // Find where the user would be positioned based on their score
        // Count how many students have a higher score
        const studentsWithHigherScore = ranking.students.filter((s: any) => s.score > userScore).length;
        userPosition = studentsWithHigherScore + 1;
        
        // Log for debugging
        console.log('User not in ranking, calculating position:', {
          userScore,
          studentsWithHigherScore,
          calculatedPosition: userPosition,
          topStudentScore: ranking.students[0]?.score
        });
      }
      
      // Calculate points to next position
      let pointsToNext = 0;
      if (userPosition > 1 && userPosition <= ranking.students.length) {
        // Points to reach the person above them
        const aboveIndex = userPosition - 2; // -2 because position is 1-based and we want the person above
        if (aboveIndex >= 0 && aboveIndex < ranking.students.length) {
          pointsToNext = ranking.students[aboveIndex].score - userScore;
        }
      } else if (userPosition === 1) {
        // Already first, no points needed
        pointsToNext = 0;
      }
      
      // Get top 10 users (or all if less than 10)
      const topUsers = ranking.students.slice(0, 10).map((student: any, index: number) => ({
        position: index + 1,
        userId: student.userId,
        displayName: student.displayName,
        score: student.score,
        isCurrentUser: student.userId === effectiveUserId
      }));
      
      setNotebookRanking({
        userPosition,
        totalUsers: ranking.totalStudents,
        userScore,
        pointsToNext,
        topUsers
      });
      
      console.log('Ranking loaded successfully:', {
        userPosition,
        totalUsers: ranking.totalStudents,
        userScore,
        materiaId
      });
      
    } catch (error) {
      console.error('Error loading notebook ranking:', error);
      setNotebookRanking(null);
      setRankingLoadError('Error al cargar el ranking');
    }
  };

  // Handle study mode selection
  const handleStudyMode = (mode: string) => {
    if (!selectedNotebook) {
      setShowNotebookError(true);
      // Scroll to selector to make error visible
      const selectorElement = document.querySelector('.notebook-dropdown-container');
      if (selectorElement) {
        selectorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      // Auto-hide error after 4 seconds
      setTimeout(() => {
        setShowNotebookError(false);
      }, 4000);
      
      return;
    }
    
    // Clear any previous errors
    setShowNotebookError(false);
    
    // Additional validations for specific modes
    if (mode === 'smart' && !studyAvailability.available) {
      // Smart study not available - don't navigate, just return
      console.log('Smart study not available - staying on current page');
      return;
    }
    
    if (mode === 'quiz' && !quizAvailability.available) {
      // Quiz not available - don't navigate, just return  
      console.log('Quiz not available - staying on current page');
      return;
    }
    
    // Navigate to the appropriate study session
    switch (mode) {
      case 'smart':
        navigate('/study-session', { 
          state: { 
            mode: 'smart',
            notebookId: selectedNotebook.id,
            notebookTitle: selectedNotebook.title
          }
        });
        break;
      case 'quiz':
        navigate('/quiz', { 
          state: { 
            notebookId: selectedNotebook.id,
            notebookTitle: selectedNotebook.title
          }
        });
        break;
      case 'free':
        navigate('/study-session', { 
          state: { 
            mode: 'free',
            notebookId: selectedNotebook.id,
            notebookTitle: selectedNotebook.title
          }
        });
        break;
      case 'games':
        navigate('/games', { 
          state: { 
            notebookId: selectedNotebook.id,
            notebookTitle: selectedNotebook.title
          }
        });
        break;
      case 'exam':
        // Módulo deshabilitado temporalmente
        return;
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.notebook-dropdown-container')) {
        setShowNotebookDropdown(false);
      }
      if (!target.closest('.materia-dropdown-container')) {
        setShowMateriaDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format time until next available study
  const formatTimeUntil = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff <= 0) return 'Disponible ahora';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Disponible en ${days} día${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return 'Disponible mañana';
    } else {
      return `Disponible en ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    }
  };

  if (loading) {
    return (
      <div className="study-mode-container">
        <HeaderWithHamburger title="Espacio de estudio" subtitle="" />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="study-mode-container">
      <HeaderWithHamburger title="Espacio de estudio" subtitle="" />
      
      
      <main className="study-mode-main">

        {/* Main Study Module */}
        <div className="main-study-module">
          {/* Study Module Header */}
          <div className="study-module-header">
            {/* Medal Module */}
            <div className="corner-medal-module">
              <div className="corner-medal-header">
                <div className="corner-medal-center">
                  <div className="corner-medal-icon">
                    {DIVISION_LEVELS[viewingDivision].icon}
                  </div>
                  <div className="corner-medal-content">
                    {viewingDivision === divisionData.current && (
                      <div className="corner-medal-label">Tu división actual</div>
                    )}
                    <div className="corner-medal-division">{DIVISION_LEVELS[viewingDivision].name}</div>
                    <div className="corner-medal-progress">{conceptsLearned} conceptos</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Dropdown with Score */}
            <div className="notebook-dropdown-wrapper">
              <div className="notebook-dropdown-container">
            <button 
                className={`notebook-dropdown-btn ${showNotebookError ? 'error' : ''}`}
                onClick={() => setShowNotebookDropdown(!showNotebookDropdown)}
                disabled={materias.length === 0}
              >
                <span>
                  {selectedNotebook ? 
                    `${selectedMateria?.nombre || selectedMateria?.title} - ${selectedNotebook.title}` : 
                    selectedMateria ?
                    'Seleccionar cuaderno' :
                    'Seleccionar materia y cuaderno'
                  }
                </span>
                <FontAwesomeIcon icon={faChevronDown} className={showNotebookDropdown ? 'open' : ''} />
              </button>
              
              {showNotebookDropdown && (
                <>
                  {/* Mobile overlay */}
                  {window.innerWidth <= 768 && (
                    <div 
                      className="mobile-dropdown-overlay"
                      onClick={() => setShowNotebookDropdown(false)}
                    />
                  )}
                  <div className="notebook-dropdown">
                    {Object.keys(allUserNotebooks).length === 0 ? (
                      <div className="dropdown-empty">No hay cuadernos disponibles</div>
                    ) : (
                      <>
                        {/* Mostrar todas las materias con sus cuadernos */}
                        {Object.entries(allUserNotebooks)
                          .sort(([, a], [, b]) => {
                            // Ordenar materias alfabéticamente
                            const nombreA = a.materia.nombre || a.materia.title || '';
                            const nombreB = b.materia.nombre || b.materia.title || '';
                            return nombreA.localeCompare(nombreB);
                          })
                          .map(([materiaId, { materia, notebooks }]) => (
                            <div key={materiaId} className="materia-group">
                              <div className="dropdown-section-title">
                                {materia.nombre || materia.title}
                              </div>
                              {notebooks.map(notebook => (
                                <div 
                                  key={notebook.id}
                                  className={`dropdown-item notebook-item ${selectedNotebook?.id === notebook.id ? 'selected' : ''} ${notebook.isFrozen ? 'frozen' : ''}`}
                                  onClick={() => {
                                    setSelectedMateria(materia);
                                    handleSelectNotebook(notebook);
                                    setShowNotebookDropdown(false);
                                    const lastMateriaKey = isSchoolStudent ? 
                                      `student_${auth.currentUser?.uid}_lastStudyMateriaId` : 
                                      'lastStudyMateriaId';
                                    localStorage.setItem(lastMateriaKey, materia.id);
                                  }}
                                >
                                  <span>{notebook.title}</span>
                                  {notebook.isFrozen && <FontAwesomeIcon icon={faSnowflake} />}
                                </div>
                              ))}
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                </>
              )}
              
              {/* Error message */}
              {showNotebookError && (
                <div className="notebook-error-message">
                  ⚠️ Debes seleccionar un cuaderno antes de continuar
                </div>
              )}
            </div>
            
            {/* Score Content */}
            <div className="study-score-content">
              <div className="study-score-value">
                {selectedNotebook ? Math.round(notebookScore.score).toLocaleString() : '0'}
              </div>
              <div className="study-score-label">
                {selectedNotebook ? 'puntos totales' : 'Selecciona un cuaderno'}
              </div>
            </div>
          </div>
        </div>

          {/* Study Functions */}
          <div className="study-functions">
          <div 
              className={`study-function-card ${!selectedNotebook || !studyAvailability.available ? 'disabled' : ''}`}
              onClick={() => handleStudyMode('smart')}
            >
              {selectedNotebook && (
                <div className="study-count-badge">#{smartStudyCount || 0}</div>
              )}
              <div className="function-icon">
                <FontAwesomeIcon icon={faBrain} />
              </div>
              <h3>Estudio Inteligente</h3>
              {!selectedNotebook ? (
                <p className="function-status">Selecciona un cuaderno</p>
              ) : studyAvailability.available ? (
                <>
                  <p className="function-status available">{studyAvailability.conceptsCount} conceptos disponibles</p>
                  <button className="function-btn">
                    <FontAwesomeIcon icon={faPlay} /> Iniciar
                  </button>
                </>
              ) : (
                <p className="function-status unavailable">
                  {(() => {
                    // Si se alcanzó el límite diario
                    if ((studyAvailability as any).limitReason === 'Ya usado hoy') {
                      return 'Disponible mañana';
                    }
                    // Si el cuaderno está vacío
                    if (!studyAvailability.totalConcepts || studyAvailability.totalConcepts === 0) {
                      return 'Agrega conceptos al cuaderno';
                    }
                    // Si hay conceptos pero ya se estudiaron todos hoy
                    if (studyAvailability.hasStudiedConcepts && studyAvailability.nextAvailable) {
                      return formatTimeUntil(studyAvailability.nextAvailable);
                    }
                    // Si todos los conceptos ya fueron dominados completamente
                    if (studyAvailability.hasStudiedConcepts && !studyAvailability.nextAvailable) {
                      return '¡Todos los conceptos dominados! 🎉';
                    }
                    // Caso por defecto
                    return 'No hay conceptos disponibles';
                  })()}
                </p>
              )}
            </div>

            <div 
              className={`study-function-card ${!selectedNotebook || !quizAvailability.available ? 'disabled' : ''}`}
              onClick={() => handleStudyMode('quiz')}
            >
              {selectedNotebook && maxQuizScore > 0 && (
                <div className="quiz-score-badge">Max: {maxQuizScore}</div>
              )}
              <div className="function-icon">
                <FontAwesomeIcon icon={faQuestion} />
              </div>
              <h3>Quiz</h3>
              {!selectedNotebook ? (
                <p className="function-status">Selecciona un cuaderno</p>
              ) : quizAvailability.available ? (
                <>
                  <p className="function-status available">Disponible</p>
                  <button className="function-btn">
                    <FontAwesomeIcon icon={faPlay} /> Iniciar
                  </button>
                </>
              ) : (
                <p className="function-status unavailable">
                  {formatTimeUntil(quizAvailability.nextAvailable!)}
                </p>
              )}
            </div>

            <div 
              className={`study-function-card ${!selectedNotebook ? 'disabled' : ''}`}
              onClick={() => handleStudyMode('free')}
            >
              {selectedNotebook && (
                <div className="free-study-badge">#{freeStudyCount || 0}</div>
              )}
              <div className="function-icon">
                <FontAwesomeIcon icon={faBook} />
              </div>
              <h3>Estudio Libre</h3>
              {!selectedNotebook ? (
                <p className="function-status">Selecciona un cuaderno</p>
              ) : (
                <>
                  <p className="function-status available">Disponible</p>
                  <button className="function-btn">
                    <FontAwesomeIcon icon={faPlay} /> Iniciar
                  </button>
                </>
              )}
            </div>

            <div 
              className={`study-function-card ${!selectedNotebook ? 'disabled' : ''}`}
              onClick={() => handleStudyMode('games')}
            >
              {selectedNotebook && (
                <div className="game-points-badge">Pts: {gamePoints || 0}</div>
              )}
              <div className="function-icon">
                <FontAwesomeIcon icon={faGamepad} />
              </div>
              <h3>Juegos</h3>
              {!selectedNotebook ? (
                <p className="function-status">Selecciona un cuaderno</p>
              ) : (
                <>
                  <p className="function-status available">Disponible</p>
                  <button className="function-btn">
                    <FontAwesomeIcon icon={faPlay} /> Iniciar
                  </button>
                </>
              )}
            </div>

            <div 
              className="study-function-card disabled coming-soon"
            >
              <div className="coming-soon-tag">
                Próximamente
              </div>
              <div className="function-icon">
                <FontAwesomeIcon icon={faMedal} />
              </div>
              <h3>Prueba de examen</h3>
              <p className="function-status">Evaluaciones personalizadas</p>
            </div>
          </div>
        </div>
      </main>

      {/* Medal Details Modal */}
      {showMedalDetails && (
        <div className="modal-overlay" onClick={() => setShowMedalDetails(false)}>
          <div className="medal-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Galería de Medallas</h3>
              <button className="close-modal" onClick={() => setShowMedalDetails(false)}>
                ×
              </button>
            </div>
            
            {/* Division Navigation Header */}
            <div className="medal-gallery-header">
              <button 
                className="division-nav-btn"
                onClick={navigateToPreviousDivision}
                disabled={DIVISION_KEYS.indexOf(viewingDivision) === 0}
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              
              <div className="viewing-division-info">
                <div className="division-icon">
                  {DIVISION_LEVELS[viewingDivision].icon}
                </div>
                <div className="division-details">
                  <div className="division-name">
                    División {DIVISION_LEVELS[viewingDivision].name}
                  </div>
                  <div className="division-status">
                    {viewingDivision === divisionData.current ? (
                      <span className="current-division">División actual</span>
                    ) : DIVISION_KEYS.indexOf(viewingDivision) < DIVISION_KEYS.indexOf(divisionData.current as keyof typeof DIVISION_LEVELS) ? (
                      <span className="completed-division">Completada</span>
                    ) : (
                      <span className="locked-division">Bloqueada</span>
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                className="division-nav-btn"
                onClick={navigateToNextDivision}
                disabled={DIVISION_KEYS.indexOf(viewingDivision) === DIVISION_KEYS.length - 1}
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>

            {/* Medals Grid */}
            <div className="medals-grid">
              {DIVISION_LEVELS[viewingDivision].ranges.map((requiredConcepts, index) => {
                const isEarned = getMedalStatus(requiredConcepts);
                const isCurrentTarget = viewingDivision === divisionData.current && requiredConcepts === divisionData.nextMilestone;
                
                return (
                  <div 
                    key={`${viewingDivision}-${requiredConcepts}`}
                    className={`medal-item ${isEarned ? 'earned' : 'locked'} ${isCurrentTarget ? 'current-target' : ''}`}
                  >
                    <div 
                      className="medal-icon"
                      style={{ 
                        color: isEarned ? DIVISION_LEVELS[viewingDivision].color : '#ccc',
                        borderColor: isCurrentTarget ? DIVISION_LEVELS[viewingDivision].color : 'transparent'
                      }}
                    >
                      <FontAwesomeIcon icon={faMedal} />
                    </div>
                    <div className="medal-requirement">{requiredConcepts}</div>
                  </div>
                );
              })}
            </div>

            {/* Motivational Message */}
            <div className="medal-motivation-message">
              {viewingDivision === divisionData.current && divisionData.progress < divisionData.nextMilestone && (
                <div className="motivation-text">
                  ✨ Estudia {divisionData.nextMilestone - divisionData.progress} conceptos más y consigue tu siguiente medalla
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyModePage;