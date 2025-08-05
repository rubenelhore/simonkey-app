// src/pages/StudyModePage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { Notebook } from '../types/interfaces';
import '../styles/StudyModePage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faTrophy, faInfoCircle, faBrain, faQuestion, faBook, faGamepad, faChevronDown, faLightbulb, faStar, faPlay, faChevronLeft, faChevronRight, faMedal, faSnowflake } from '@fortawesome/free-solid-svg-icons';
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
  const [studyAvailability, setStudyAvailability] = useState<{ available: boolean; nextAvailable?: Date; conceptsCount: number }>({ 
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

  // Clear notebook selection on page load
  useEffect(() => {
    setSelectedNotebook(null);
    setSelectedMateria(null);
    setNotebookScore({ score: 0, level: 1, progress: 0 });
  }, []);

  // Reset score when no notebook is selected
  useEffect(() => {
    if (!selectedNotebook) {
      setNotebookScore({ score: 0, level: 1, progress: 0 });
    }
  }, [selectedNotebook]);

  // Load effective user ID
  useEffect(() => {
    const loadEffectiveUserId = async () => {
      if (auth.currentUser) {
        const effectiveUserData = await getEffectiveUserId();
        setEffectiveUserId(effectiveUserData ? effectiveUserData.id : auth.currentUser.uid);
      }
    };
    loadEffectiveUserId();
  }, [auth.currentUser]);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!effectiveUserId) return;
      
      try {
        // Load streak data
        const streak = await studyStreakService.getUserStreak(effectiveUserId);
        const hasStudiedToday = await studyStreakService.hasStudiedToday(effectiveUserId);
        setStreakData({
          days: streak.currentStreak,
          message: hasStudiedToday ? 
            `¡${streak.currentStreak} días seguidos!` : 
            '¡Estudia hoy para mantener tu racha!'
        });

        // Calculate concepts with repetitions >= 2 for division system
        const conceptsWithMinReps = await kpiService.getConceptsWithMinRepetitions(effectiveUserId, 2);
        setConceptsLearned(conceptsWithMinReps);
        
        // Calculate division based on concepts with repetitions >= 2
        calculateDivision(conceptsWithMinReps);

        // Generate suggestions and challenges
        generateSuggestionsAndChallenges(streak.currentStreak);
        
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    if (effectiveUserId) {
      loadUserData();
    }
  }, [effectiveUserId]);

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

  // Load all user notebooks organized by materia
  useEffect(() => {
    const fetchAllUserNotebooks = async () => {
      if (!auth.currentUser || !materias.length) return;
      
      try {
        const notebooksByMateria: { [materiaId: string]: { materia: any, notebooks: Notebook[] } } = {};
        
        for (const materia of materias) {
          let notebooksData: Notebook[] = [];
          
          if (isSchoolStudent && schoolNotebooks) {
            notebooksData = schoolNotebooks
              .filter(notebook => notebook.idMateria === materia.id)
              .map(notebook => ({
                id: notebook.id,
                title: notebook.title,
                color: notebook.color || '#6147FF',
                type: 'school' as const,
                materiaId: notebook.idMateria,
                isFrozen: notebook.isFrozen || false,
                frozenScore: notebook.frozenScore
              }));
          } else {
            const notebooksQuery = query(
              collection(db, 'notebooks'),
              where('userId', '==', auth.currentUser.uid),
              where('materiaId', '==', materia.id)
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
          
          // Ordenar cuadernos alfabéticamente
          notebooksData.sort((a, b) => a.title.localeCompare(b.title));
          
          if (notebooksData.length > 0) {
            notebooksByMateria[materia.id] = {
              materia: materia,
              notebooks: notebooksData
            };
          }
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

  // Handle notebook selection
  const handleSelectNotebook = async (notebook: Notebook) => {
    if (notebook.isFrozen) {
      alert('Este cuaderno está congelado. No puedes realizar actividades de estudio.');
      return;
    }
    
    setSelectedNotebook(notebook);
    setShowNotebookError(false); // Clear error when notebook is selected
    // Don't save to localStorage - force fresh selection each time
    
    // Reset score while loading
    setNotebookScore({ score: 0, level: 1, progress: 0 });
    
    // Load notebook stats
    try {
      if (effectiveUserId) {
        console.log('Loading stats for notebook:', notebook.id, 'user:', effectiveUserId);
        
        const allConcepts = await studyService.getAllConceptsFromNotebook(effectiveUserId, notebook.id);
        const learningData = await studyService.getLearningDataForNotebook(effectiveUserId, notebook.id);
        
        console.log('All concepts:', allConcepts.length);
        console.log('Learning data:', learningData.length);
        
        // Calculate comprehensive score
        const masteredConcepts = learningData.filter(d => d.repetitions >= 3).length;
        const studiedConcepts = learningData.filter(d => d.repetitions > 0).length;
        
        console.log('Mastered concepts:', masteredConcepts);
        console.log('Studied concepts:', studiedConcepts);
        
        // Temporarily set a placeholder score - will be calculated after all data is loaded
        setNotebookScore({
          score: 0,
          level: 1,
          progress: 0
        });

        // Check study availability based on SM-3 algorithm
        const now = new Date();
        let availableConcepts = 0;
        let nextAvailableDate: Date | undefined;

        console.log('Checking study availability for notebook:', notebook.id);
        console.log('Total concepts in notebook:', allConcepts.length);
        console.log('Learning data entries:', learningData.length);

        if (allConcepts.length === 0) {
          // No concepts in notebook
          console.log('No concepts found in notebook');
          setStudyAvailability({
            available: false,
            nextAvailable: undefined,
            conceptsCount: 0
          });
        } else {
          for (const concept of allConcepts) {
            const learningDataItem = learningData.find(ld => ld.conceptId === concept.id);
            
            if (!learningDataItem || learningDataItem.repetitions === 0) {
              // New concepts are always available
              availableConcepts++;
              console.log(`Concept ${concept.id} is new/unlearned - available`);
            } else if (learningDataItem.nextReviewDate) {
              // Handle both Timestamp and Date objects
              let nextReview: Date;
              if ((learningDataItem.nextReviewDate as any).toDate) {
                nextReview = (learningDataItem.nextReviewDate as any).toDate();
              } else if (learningDataItem.nextReviewDate instanceof Date) {
                nextReview = learningDataItem.nextReviewDate;
              } else {
                // If it's a string or number, try to parse it
                nextReview = new Date(learningDataItem.nextReviewDate);
              }
              
              if (nextReview <= now) {
                // Concept is due for review
                availableConcepts++;
                console.log(`Concept ${concept.id} is due for review - available`);
              } else if (!nextAvailableDate || nextReview < nextAvailableDate) {
                // Track the earliest next review date
                nextAvailableDate = nextReview;
                console.log(`Concept ${concept.id} next review at:`, nextReview);
              }
            }
          }

          console.log('Available concepts:', availableConcepts);
          console.log('Next available date:', nextAvailableDate);

          // Temporarily set availability based on concepts
          // Will be updated later after checking daily limit
          setStudyAvailability({
            available: availableConcepts > 0,
            nextAvailable: nextAvailableDate,
            conceptsCount: availableConcepts
          });
        }

        // Initialize variables for all data we need
        let completedSmartStudies = 0;
        let maxQuizScoreValue = 0;
        let gamePointsValue = 0;
        let streakBonusValue = 0;
        
        // Count completed smart study sessions for this notebook - ONLY VALIDATED
        try {
          // Try first with completed and validated fields
          let studySessionsQuery = query(
            collection(db, 'studySessions'),
            where('userId', '==', effectiveUserId),
            where('notebookId', '==', notebook.id),
            where('mode', '==', 'smart'),
            where('completed', '==', true),
            where('validated', '==', true)  // Solo sesiones validadas (mini quiz aprobado)
          );
          let studySessionsSnapshot = await getDocs(studySessionsQuery);
          
          // Calculate total based on intensity
          studySessionsSnapshot.docs.forEach(doc => {
            const sessionData = doc.data();
            let studyValue = 1; // Default value (Progress)
            
            if (sessionData.intensity === 'warm_up') {
              studyValue = 0.5;
            } else if (sessionData.intensity === 'rocket') {
              studyValue = 2;
            }
            
            completedSmartStudies += studyValue;
          });
          
          console.log('Query 1 - Completed smart studies (with intensity):', completedSmartStudies);
          
          // If no results, try without completed field but still requiring validated
          if (completedSmartStudies === 0) {
            studySessionsQuery = query(
              collection(db, 'studySessions'),
              where('userId', '==', effectiveUserId),
              where('notebookId', '==', notebook.id),
              where('mode', '==', 'smart'),
              where('validated', '==', true)  // Solo sesiones validadas
            );
            studySessionsSnapshot = await getDocs(studySessionsQuery);
            
            // Recalculate with intensity
            studySessionsSnapshot.docs.forEach(doc => {
              const sessionData = doc.data();
              let studyValue = 1; // Default value (Progress)
              
              if (sessionData.intensity === 'warm_up') {
                studyValue = 0.5;
              } else if (sessionData.intensity === 'rocket') {
                studyValue = 2;
              }
              
              completedSmartStudies += studyValue;
            });
            
            console.log('Query 2 - All smart studies (with intensity):', completedSmartStudies);
          }
          
          // If still no results, try with sessionType field and validated
          if (completedSmartStudies === 0) {
            studySessionsQuery = query(
              collection(db, 'studySessions'),
              where('userId', '==', effectiveUserId),
              where('notebookId', '==', notebook.id),
              where('sessionType', '==', 'smart'),
              where('validated', '==', true)  // Solo sesiones validadas
            );
            studySessionsSnapshot = await getDocs(studySessionsQuery);
            
            // Recalculate with intensity
            studySessionsSnapshot.docs.forEach(doc => {
              const sessionData = doc.data();
              let studyValue = 1; // Default value (Progress)
              
              if (sessionData.intensity === 'warm_up') {
                studyValue = 0.5;
              } else if (sessionData.intensity === 'rocket') {
                studyValue = 2;
              }
              
              completedSmartStudies += studyValue;
            });
            
            console.log('Query 3 - Smart studies with sessionType (with intensity):', completedSmartStudies);
          }
          
          // If still no results, check all study sessions for this notebook
          if (completedSmartStudies === 0) {
            const allSessionsQuery = query(
              collection(db, 'studySessions'),
              where('userId', '==', effectiveUserId),
              where('notebookId', '==', notebook.id)
            );
            const allSessionsSnapshot = await getDocs(allSessionsQuery);
            console.log('All sessions for notebook:', allSessionsSnapshot.size);
            
            // Log all documents to see their structure
            allSessionsSnapshot.docs.forEach((doc, index) => {
              if (index < 3) { // Log first 3 documents
                console.log(`Session ${index + 1}:`, doc.data());
              }
            });
          }
          
          setSmartStudyCount(completedSmartStudies);
          
          // Count free study sessions
          const freeStudyQuery = query(
            collection(db, 'studySessions'),
            where('userId', '==', effectiveUserId),
            where('notebookId', '==', notebook.id),
            where('mode', '==', 'free')
          );
          const freeStudySnapshot = await getDocs(freeStudyQuery);
          const completedFreeStudies = freeStudySnapshot.size;
          setFreeStudyCount(completedFreeStudies);
          console.log('Free study count:', completedFreeStudies);
          
        } catch (error) {
          console.error('Error counting smart studies:', error);
          setSmartStudyCount(0);
          setFreeStudyCount(0);
        }

        // Get max quiz score for this notebook
        try {
          const quizStatsRef = doc(db, 'users', effectiveUserId, 'quizStats', notebook.id);
          const quizStatsDoc = await getDoc(quizStatsRef);
          
          if (quizStatsDoc.exists()) {
            const stats = quizStatsDoc.data();
            maxQuizScoreValue = stats.maxScore || 0;
            setMaxQuizScore(maxQuizScoreValue);
            console.log('Max quiz score:', maxQuizScoreValue);
          } else {
            maxQuizScoreValue = 0;
            setMaxQuizScore(0);
          }
        } catch (error) {
          console.error('Error getting quiz stats:', error);
          maxQuizScoreValue = 0;
          setMaxQuizScore(0);
        }

        // Get game points for this notebook
        try {
          const notebookPoints = await gamePointsService.getNotebookPoints(effectiveUserId, notebook.id);
          gamePointsValue = notebookPoints.totalPoints || 0;
          setGamePoints(gamePointsValue);
          console.log('Game points:', gamePointsValue);
        } catch (error) {
          console.error('Error getting game points:', error);
          gamePointsValue = 0;
          setGamePoints(0);
        }

        // Check study limits (quiz and smart study)
        const notebookLimitsRef = doc(db, 'users', effectiveUserId, 'notebookLimits', notebook.id);
        const notebookLimitsDoc = await getDoc(notebookLimitsRef);
        
        if (notebookLimitsDoc.exists()) {
          const limits = notebookLimitsDoc.data();
          
          // Check smart study availability (once per day) - TEMPORALMENTE DESACTIVADO PARA TESTING
          /*
          if (limits.lastSmartStudyDate) {
            const lastSmartStudyDate = limits.lastSmartStudyDate.toDate ? limits.lastSmartStudyDate.toDate() : new Date(limits.lastSmartStudyDate);
            const now = new Date();
            
            // Check if it's the same day
            const isSameDay = lastSmartStudyDate.toDateString() === now.toDateString();
            
            if (isSameDay) {
              // Smart study already done today
              const tomorrow = new Date(now);
              tomorrow.setDate(tomorrow.getDate() + 1);
              tomorrow.setHours(0, 0, 0, 0);
              
              setStudyAvailability(prev => ({
                ...prev,
                available: false,
                nextAvailable: tomorrow
              }));
              console.log('Smart study already done today, next available:', tomorrow);
            } else if (availableConcepts === 0) {
              // No concepts available but it's a new day
              setStudyAvailability(prev => ({
                ...prev,
                available: false,
                nextAvailable: nextAvailableDate || undefined
              }));
            }
          }
          */
          console.log('🧪 [TESTING] Limitación de estudio inteligente temporalmente desactivada');
          
          if (limits.lastQuizDate) {
            const lastQuizDate = limits.lastQuizDate.toDate ? limits.lastQuizDate.toDate() : new Date(limits.lastQuizDate);
            const now = new Date();
            
            // Check if it's been a week since last quiz
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            if (lastQuizDate > oneWeekAgo) {
              // Quiz not available yet
              const nextQuizDate = new Date(lastQuizDate.getTime() + 7 * 24 * 60 * 60 * 1000);
              setQuizAvailability({
                available: false,
                nextAvailable: nextQuizDate
              });
              console.log('Quiz not available until:', nextQuizDate);
            } else {
              // Quiz is available
              setQuizAvailability({
                available: true,
                nextAvailable: undefined
              });
              console.log('Quiz is available');
            }
          } else {
            // Never taken quiz, it's available
            setQuizAvailability({
              available: true,
              nextAvailable: undefined
            });
            console.log('Quiz available - never taken');
          }
        } else {
          // No limits doc, quiz is available
          setQuizAvailability({
            available: true,
            nextAvailable: undefined
          });
          setSmartStudyCount(0);
        }
        
        // Calculate general score using the correct formula
        // SCORE = (Smart Studies × Max Quiz Score) + Game Points + Streak Bonus
        let streakDays = 0;
        try {
          const userStreak = await studyStreakService.getUserStreak(effectiveUserId);
          streakDays = userStreak.currentStreak;
          streakBonusValue = studyStreakService.getStreakBonus(userStreak.currentStreak);
          console.log(`Streak details:`, {
            currentStreak: userStreak.currentStreak,
            lastStudyDate: userStreak.lastStudyDate,
            streakBonus: streakBonusValue,
            calculation: `${streakDays} days × 200 = ${streakBonusValue} pts`
          });
        } catch (error) {
          console.error('Error getting streak bonus:', error);
          streakBonusValue = 0;
        }
        
        // Calculate final score with all the data we've collected
        const studyScore = completedSmartStudies * maxQuizScoreValue;
        const totalScore = studyScore + gamePointsValue + streakBonusValue;
        
        console.log('DETAILED Score calculation:', {
          completedSmartStudies: completedSmartStudies,
          maxQuizScore: maxQuizScoreValue,
          studyScore: `${completedSmartStudies} × ${maxQuizScoreValue} = ${studyScore}`,
          gamePoints: gamePointsValue,
          streakDays,
          streakBonus: streakBonusValue,
          totalScore,
          expectedTotal: studyScore + gamePointsValue + streakBonusValue,
          formula: `(${completedSmartStudies} × ${maxQuizScoreValue}) + ${gamePointsValue} + ${streakBonusValue} = ${totalScore}`
        });
        
        setNotebookScore({
          score: totalScore,
          level: Math.floor(totalScore / 50) + 1, // Level up every 50 points
          progress: totalScore % 50
        });
        
        // Load ranking for this notebook with the current score
        await loadNotebookRanking(notebook.id, totalScore);
      }
    } catch (error) {
      console.error('Error loading notebook stats:', error);
      // Set default score on error
      setNotebookScore({ score: 0, level: 1, progress: 0 });
      setStudyAvailability({ available: false, conceptsCount: 0 });
      setQuizAvailability({ available: true });
    }
  };

  // Load notebook ranking
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
      
      // Get notebook document to find its subject
      const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
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
      
      // Get user's institution
      const userDoc = await getDoc(doc(db, 'users', effectiveUserId));
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
          {/* Score Module on the Left */}
          <div className="study-score-module">
            <div className="study-score-header">
              <FontAwesomeIcon icon={faTrophy} className="study-score-icon" />
              <h3>Score</h3>
            </div>
            <div className="study-score-content">
              <div className="study-score-value">
                {selectedNotebook ? notebookScore.score.toLocaleString() : '0'}
              </div>
              <div className="study-score-label">
                {selectedNotebook ? 'puntos totales' : 'Selecciona un cuaderno'}
              </div>
            </div>
          </div>

          {/* Simple Medal Corner with Current Division Medals */}
          <div className="corner-medal-module">
            <div className="corner-medal-header">
              <button 
                className="corner-nav-btn prev"
                onClick={navigateToPreviousDivision}
                disabled={DIVISION_KEYS.indexOf(viewingDivision) === 0}
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              
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
              
              <button 
                className="corner-nav-btn next"
                onClick={navigateToNextDivision}
                disabled={DIVISION_KEYS.indexOf(viewingDivision) === DIVISION_KEYS.length - 1}
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
            
            {/* Small medals for viewing division */}
            <div className="corner-medals-grid">
              {DIVISION_LEVELS[viewingDivision].ranges.map((requiredConcepts, index) => {
                const isEarned = getMedalStatus(requiredConcepts);
                const isCurrentTarget = requiredConcepts === divisionData.nextMilestone;
                
                return (
                  <div 
                    key={`corner-${requiredConcepts}`}
                    className={`corner-medal-item ${isEarned ? 'earned' : 'locked'} ${isCurrentTarget ? 'current-target' : ''}`}
                  >
                    <div 
                      className="corner-medal-small-icon"
                      style={{ 
                        color: isEarned ? DIVISION_LEVELS[viewingDivision].color : '#ccc'
                      }}
                    >
                      🏅
                    </div>
                    <div className="corner-medal-requirement">{requiredConcepts}</div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Motivational Message */}
          <div className="motivational-message">
            <h3>¡Es hora de estudiar y brillar! ✨</h3>
          </div>

          {/* Top Row: Dropdowns */}
          <div className="study-module-header">
            {/* Materia & Notebook Dropdown */}
            <div className="notebook-dropdown-container">
              <div className="dropdown-instruction">
                Elige el cuaderno para estudiar
              </div>
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
                  Debe seleccionar un cuaderno antes
                </div>
              )}
            </div>
          </div>

          {/* Study Functions */}
          <div className="study-functions">
            <div 
              className={`study-function-card ${!selectedNotebook || !studyAvailability.available ? 'disabled' : ''}`}
              onClick={() => studyAvailability.available && handleStudyMode('smart')}
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
                  {studyAvailability.nextAvailable && studyAvailability.conceptsCount > 0 ? 
                    'Ya estudiaste hoy. Disponible mañana' :
                    studyAvailability.nextAvailable ? 
                    formatTimeUntil(studyAvailability.nextAvailable) : 
                    'Agrega conceptos al cuaderno'}
                </p>
              )}
            </div>

            <div 
              className={`study-function-card ${!selectedNotebook || !quizAvailability.available ? 'disabled' : ''}`}
              onClick={() => quizAvailability.available && handleStudyMode('quiz')}
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
              onClick={() => selectedNotebook && handleStudyMode('free')}
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
              onClick={() => selectedNotebook && handleStudyMode('games')}
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
          </div>
        </div>
        
        {/* Learning modules - Simplified without header */}
        <div className="learning-space-section">
          <div className="learning-modules-grid">
            {/* Suggestions Section */}
            <div className="learning-module">
              <div className="section-header">
                <FontAwesomeIcon icon={faLightbulb} />
                <h4>Sugerencias de estudio</h4>
              </div>
              <div className="suggestions-list">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="suggestion-item">
                    <FontAwesomeIcon icon={faStar} />
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking Section */}
            <div className="learning-module">
              <div className="section-header">
                <FontAwesomeIcon icon={faTrophy} />
                <h4>Ranking del Cuaderno</h4>
              </div>
              
              {!selectedNotebook ? (
                <div className="ranking-empty-state">
                  <p>Selecciona un cuaderno para ver el ranking</p>
                </div>
              ) : !isSchoolStudent ? (
                <div className="ranking-empty-state">
                  <p>El ranking está disponible solo para estudiantes escolares</p>
                </div>
              ) : rankingLoadError ? (
                <div className="ranking-empty-state">
                  <p>{rankingLoadError}</p>
                </div>
              ) : !notebookRanking ? (
                <div className="ranking-loading">
                  <p>Cargando ranking...</p>
                </div>
              ) : (
                <div className="ranking-content">
                  {/* Your position card */}
                  <div className="your-position-card">
                    <div className="position-badge">#{notebookRanking.userPosition}</div>
                    <div className="position-info">
                      <span className="position-label">Tu posición</span>
                      <span className="position-score">{notebookRanking.userScore.toLocaleString()} pts</span>
                      {notebookRanking.pointsToNext > 0 && (
                        <span className="points-to-next">
                          {notebookRanking.pointsToNext} pts para el siguiente
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Top 3 Podium */}
                  <div className="ranking-podium">
                    {notebookRanking.topUsers.slice(0, 3).map((user, index) => (
                      <div 
                        key={user.userId} 
                        className={`podium-position position-${index + 1} ${user.isCurrentUser ? 'is-current-user' : ''}`}
                      >
                        <div className="podium-medal">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                        </div>
                        <div className="podium-name">{user.displayName}</div>
                        <div className="podium-score">{user.score.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Rest of top 10 */}
                  {notebookRanking.topUsers.length > 3 && (
                    <div className="ranking-list">
                      {notebookRanking.topUsers.slice(3).map((user) => (
                        <div 
                          key={user.userId} 
                          className={`ranking-item ${user.isCurrentUser ? 'is-current-user' : ''}`}
                        >
                          <span className="rank-position">#{user.position}</span>
                          <span className="rank-name">{user.displayName}</span>
                          <span className="rank-score">{user.score.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="ranking-footer">
                    <span className="total-students">Total: {notebookRanking.totalUsers} estudiantes</span>
                  </div>
                </div>
              )}
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