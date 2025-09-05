// src/pages/StudyModePage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { Notebook } from '../types/interfaces';
import '../styles/StudyModePage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faTrophy, faInfoCircle, faBrain, faQuestion, faBook, faGamepad, faChevronDown, faLightbulb, faStar, faPlay, faChevronLeft, faChevronRight, faMedal, faSnowflake, faClock, faMicrophone } from '@fortawesome/free-solid-svg-icons';
import { useUserType } from '../hooks/useUserType';
// import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { studyStreakService } from '../services/studyStreakService';
import { useStudyService } from '../hooks/useStudyService';
import { gamePointsService } from '../services/gamePointsService';
import { kpiService } from '../services/kpiService';
import { rankingService } from '../services/rankingService';
import { studySessionPersistence } from '../utils/studySessionPersistence';

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
  const location = useLocation();
  const { selectedNotebook: passedNotebook, maintainSelection } = location.state || {};
  const { isSchoolStudent, subscription, isTeacher } = useUserType();
  // const { schoolNotebooks, schoolSubjects } = useSchoolStudentData(); // deprecated
  // Usar useMemo para evitar recrear arrays en cada render
  const schoolNotebooks = React.useMemo<any[]>(() => [], []);
  const schoolSubjects = React.useMemo<any[]>(() => [], []);
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
  const [freeStudySessionsEarned, setFreeStudySessionsEarned] = useState<number>(0);
  const [voiceRecognitionCount, setVoiceRecognitionCount] = useState<number>(0);
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
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [scoreBreakdown, setScoreBreakdown] = useState({
    totalStudySessions: 0,
    smartStudyPoints: 0,
    voiceRecognitionPoints: 0,
    freeStudyPoints: 0,
    totalMultiplierPoints: 0,
    maxQuizScore: 0,
    gamePoints: 0,
    streakBonus: 0,
    finalScore: 0
  });

  // Load persisted selection on component mount ONLY if explicitly requested
  useEffect(() => {
    // Only restore selection if maintainSelection is explicitly true (coming from a study session)
    if (maintainSelection) {
      const persistedSelection = studySessionPersistence.getSelection();
      if (persistedSelection && persistedSelection.notebook && persistedSelection.materia) {
        console.log('Restaurando selección persistida desde sesión de estudio:', persistedSelection);
        setSelectedMateria(persistedSelection.materia);
        setSelectedNotebook(persistedSelection.notebook);
      }
    } else {
      // Clear persisted selection when coming from navigation menu
      console.log('Limpiando selección al venir desde menú de navegación');
      studySessionPersistence.clearSelection();
      setSelectedMateria(null);
      setSelectedNotebook(null);
    }
  }, []);

  // Handle passed notebook from voice recognition
  useEffect(() => {
    if (passedNotebook && maintainSelection && materias.length > 0) {
      console.log('Restaurando cuaderno desde voice recognition:', passedNotebook);
      
      // Find the materia that contains this notebook
      const matchingMateria = materias.find(materia => 
        materia.id === passedNotebook.materiaId || 
        (passedNotebook as any).idMateria === materia.id
      );
      
      if (matchingMateria) {
        console.log('Materia encontrada para el cuaderno:', matchingMateria.nombre || matchingMateria.title);
        setSelectedMateria(matchingMateria);
        setSelectedNotebook(passedNotebook);
        
        // Save the selection
        studySessionPersistence.saveSelection(passedNotebook, matchingMateria);
      } else {
        console.log('No se encontró materia para el cuaderno:', passedNotebook.title);
      }
    }
  }, [passedNotebook, maintainSelection, materias]);

  // Reset score when no notebook is selected
  useEffect(() => {
    if (!selectedNotebook) {
      setNotebookScore({ score: 0, level: 1, progress: 0 });
    }
  }, [selectedNotebook]);

  // Verificar si el notebook seleccionado está congelado
  useEffect(() => {
    if (selectedNotebook && selectedNotebook.isFrozen && !isTeacher) {
      console.log('Notebook congelado detectado, deseleccionando...');
      alert('Este cuaderno está congelado. No puedes realizar actividades de estudio.');
      setSelectedNotebook(null);
    }
  }, [selectedNotebook?.isFrozen, isTeacher]);

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
        const [streak, hasStudiedToday, conceptsWithMinReps, conceptStats] = await Promise.all([
          studyStreakService.getUserStreak(userId),
          studyStreakService.hasStudiedToday(userId),
          kpiService.getConceptsWithMinRepetitions(userId, 2),
          kpiService.getTotalDominatedConceptsByUser(userId)
        ]);
        
        // Usar el mayor de los dos valores para ser más generoso con la división (igual que InicioPage)
        const conceptsForDivision = Math.max(conceptStats.conceptosDominados, conceptsWithMinReps);
        
        // Actualizar estados
        setStreakData({
          days: streak.currentStreak,
          message: hasStudiedToday ? 
            `¡${streak.currentStreak} días seguidos!` : 
            '¡Estudia hoy para mantener tu racha!'
        });
        
        // Calcular el bonus de racha inmediatamente
        const calculatedStreakBonus = studyStreakService.getStreakBonus(streak.currentStreak);
        setScoreBreakdown(prev => ({
          ...prev,
          streakBonus: calculatedStreakBonus
        }));
        
        setConceptsLearned(conceptsForDivision);
        calculateDivision(conceptsForDivision);
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
          // 1. Obtener materias propias
          const materiasQuery = query(
            collection(db, 'materias'),
            where('userId', '==', auth.currentUser.uid)
          );
          
          const materiasSnapshot = await getDocs(materiasQuery);
          const ownMaterias = materiasSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isEnrolled: false
          }));
          
          // 2. Obtener materias donde está inscrito
          const enrollmentsQuery = query(
            collection(db, 'enrollments'),
            where('studentId', '==', auth.currentUser.uid),
            where('status', '==', 'active')
          );
          const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
          
          // Para cada enrollment, obtener la materia del profesor
          const enrolledMaterias = [];
          for (const enrollmentDoc of enrollmentsSnapshot.docs) {
            const enrollmentData = enrollmentDoc.data();
            const materiaDoc = await getDoc(doc(db, 'materias', enrollmentData.materiaId));
            if (materiaDoc.exists()) {
              enrolledMaterias.push({
                id: materiaDoc.id,
                ...materiaDoc.data(),
                isEnrolled: true,
                teacherId: enrollmentData.teacherId
              });
            }
          }
          
          // 3. Combinar ambas listas
          materiasData = [...ownMaterias, ...enrolledMaterias];
        }
        
        setMaterias(materiasData);
        
        // Try to restore persisted selection after loading materias
        const persistedSelection = studySessionPersistence.getSelection();
        if (persistedSelection && persistedSelection.notebook && persistedSelection.materia) {
          // Verificar que la materia y cuaderno aún existan
          const materiaExists = materiasData.find(m => m.id === persistedSelection.materia.id);
          if (materiaExists) {
            setSelectedMateria(persistedSelection.materia);
            // El notebook se restaurará cuando se carguen los notebooks de esta materia
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error al cargar materias:", error);
        setLoading(false);
      }
    };
    
    fetchMaterias();
  }, [navigate, isSchoolStudent]);

  // Load all user notebooks organized by materia - OPTIMIZADO
  useEffect(() => {
    const fetchAllUserNotebooks = async () => {
      if (!auth.currentUser || !materias.length) return;
      
      try {
        const notebooksByMateria: { [materiaId: string]: { materia: any, notebooks: Notebook[] } } = {};
        
        // Ya no usar sistema escolar
        {
          // Para usuarios regulares, obtener notebooks propios y de profesores (para materias inscritas)
          for (const materia of materias) {
            let notebooksQuery;
            
            if (materia.isEnrolled && materia.teacherId) {
              // Si está inscrito, buscar notebooks del profesor
              notebooksQuery = query(
                collection(db, 'notebooks'),
                where('userId', '==', materia.teacherId),
                where('materiaId', '==', materia.id)
              );
            } else {
              // Si es propia, buscar sus propios notebooks
              notebooksQuery = query(
                collection(db, 'notebooks'),
                where('userId', '==', auth.currentUser.uid),
                where('materiaId', '==', materia.id)
              );
            }
            
            const notebooksSnapshot = await getDocs(notebooksQuery);
            const notebooksData = notebooksSnapshot.docs
              .map(doc => ({
                id: doc.id,
                title: doc.data().title,
                color: doc.data().color || '#6147FF',
                type: doc.data().type || 'personal' as const,
                materiaId: doc.data().materiaId,
                isEnrolled: materia.isEnrolled || false
              }))
              .sort((a, b) => a.title.localeCompare(b.title));
            
            if (notebooksData.length > 0) {
              notebooksByMateria[materia.id] = {
                materia: materia,
                notebooks: notebooksData
              };
            }
          }
        }
        
        setAllUserNotebooks(notebooksByMateria);
      } catch (error) {
        console.error("Error loading all notebooks:", error);
      }
    };
    
    fetchAllUserNotebooks();
  }, [materias, isSchoolStudent]);

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
          let notebooksQuery;
          
          if (selectedMateria.isEnrolled && selectedMateria.teacherId) {
            // Si está inscrito, buscar notebooks del profesor
            notebooksQuery = query(
              collection(db, 'notebooks'),
              where('userId', '==', selectedMateria.teacherId),
              where('materiaId', '==', selectedMateria.id)
            );
          } else {
            // Si es propia, buscar sus propios notebooks
            notebooksQuery = query(
              collection(db, 'notebooks'),
              where('userId', '==', auth.currentUser.uid),
              where('materiaId', '==', selectedMateria.id)
            );
          }
          
          const notebooksSnapshot = await getDocs(notebooksQuery);
          notebooksData = notebooksSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            color: doc.data().color || '#6147FF',
            type: doc.data().type || 'personal' as const,
            materiaId: doc.data().materiaId,
            isEnrolled: selectedMateria.isEnrolled || false
          }));
        }
        
        setNotebooks(notebooksData);
        
        // Actualizar el notebook seleccionado si cambió su estado de congelación
        if (selectedNotebook) {
          const updatedNotebook = notebooksData.find(n => n.id === selectedNotebook.id);
          if (updatedNotebook && updatedNotebook.isFrozen !== selectedNotebook.isFrozen) {
            // El estado de congelación cambió
            if (updatedNotebook.isFrozen && !isTeacher) {
              // Se congeló y el usuario no es profesor, deseleccionar
              console.log('Notebook fue congelado, deseleccionando...');
              setSelectedNotebook(null);
              alert('Este cuaderno ha sido congelado. No puedes realizar actividades de estudio.');
            } else {
              // Actualizar con el nuevo estado
              setSelectedNotebook(updatedNotebook);
            }
          }
        }
        
        // Try to restore persisted notebook selection if the materia matches
        const persistedSelection = studySessionPersistence.getSelection();
        if (persistedSelection && persistedSelection.notebook && persistedSelection.materia &&
            selectedMateria && persistedSelection.materia.id === selectedMateria.id) {
          // Verificar que el notebook aún exista
          const notebookExists = notebooksData.find(n => n.id === persistedSelection.notebook!.id);
          if (notebookExists) {
            console.log('Restaurando notebook persistido:', persistedSelection.notebook.title);
            handleSelectNotebook(notebookExists);
          } else {
            console.log('Notebook persistido ya no existe, limpiando selección');
            studySessionPersistence.clearSelection();
          }
        }
      } catch (error) {
        console.error("Error al cargar cuadernos:", error);
      }
    };
    
    fetchNotebooksForMateria();
  }, [selectedMateria, isSchoolStudent, schoolNotebooks]);


  // Calculate division based on concepts learned
  const calculateDivision = (concepts: number) => {
    let currentDivision = 'WOOD';
    let nextMilestone = 25;
    
    // Using same logic as InicioPage - check if concepts fall within division ranges
    // Each division has a range, not just a minimum threshold
    if (concepts >= 20000) {
      currentDivision = 'LEGEND';
      nextMilestone = 50000;
    } else if (concepts >= 10000) {
      currentDivision = 'VOID';
      nextMilestone = 20000;
    } else if (concepts >= 5400) {
      currentDivision = 'COSMIC';
      nextMilestone = 10000;
    } else if (concepts >= 2800) {
      currentDivision = 'CRYSTAL';
      nextMilestone = 5400;
    } else if (concepts >= 1400) {
      currentDivision = 'JADE';
      nextMilestone = 2800;
    } else if (concepts >= 600) {
      currentDivision = 'RUBY';
      nextMilestone = 1400;
    } else if (concepts >= 330) {
      currentDivision = 'GOLD';
      nextMilestone = 600;
    } else if (concepts >= 170) {
      currentDivision = 'SILVER';
      nextMilestone = 330;
    } else if (concepts >= 75) {
      currentDivision = 'BRONZE';
      nextMilestone = 170;
    } else if (concepts >= 25) {
      currentDivision = 'STONE';
      nextMilestone = 75;
    } else if (concepts <= 20) {
      // Madera range is 1-20
      currentDivision = 'WOOD';
      nextMilestone = 25;
    } else {
      // Concepts between 21-24 stay in Wood until reaching Stone at 25
      currentDivision = 'WOOD';
      nextMilestone = 25;
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
      { text: 'Completa un Repaso Inteligente en menos de 2 minutos', boost: '+50% XP' },
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
    // Verificar el estado actual del notebook desde la base de datos
    try {
      const notebookDoc = await getDoc(doc(db, 'notebooks', notebook.id));
      if (notebookDoc.exists()) {
        const currentData = notebookDoc.data();
        const isCurrentlyFrozen = currentData.isFrozen || false;
        
        // Bloquear acceso a cuadernos congelados para todos excepto profesores
        if (isCurrentlyFrozen && !isTeacher) {
          alert('Este cuaderno está congelado. No puedes realizar actividades de estudio.');
          return;
        }
        
        // Actualizar el notebook con el estado actual
        notebook.isFrozen = isCurrentlyFrozen;
      }
    } catch (error) {
      console.error('Error verificando estado del notebook:', error);
    }
    
    setSelectedNotebook(notebook);
    setShowNotebookError(false);
    
    // Guardar la selección en localStorage
    studySessionPersistence.saveSelection(notebook, selectedMateria);
    
    // Mostrar valores estimados INMEDIATAMENTE basados en valores típicos
    setNotebookScore({ score: 0, level: 1, progress: 0 });
    setStudyAvailability({ available: true, conceptsCount: 5 }); // Asumir que hay conceptos disponibles
    setQuizAvailability({ available: true });
    setSmartStudyCount(0);
    setMaxQuizScore(0);
    setFreeStudyCount(0);
    setFreeStudySessionsEarned(0);
    setVoiceRecognitionCount(0);
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
      
      // SIN LÍMITE DIARIO - El estudio inteligente ya no tiene restricciones de una vez al día
      // Se permite usar el estudio inteligente tantas veces como el usuario quiera
      console.log('✅ Estudio inteligente disponible sin límites diarios');
      
      // Actualizar disponibilidad de estudio con más contexto
      setStudyAvailability({
        available: reviewableConceptsCount > 0 && canStudyToday,
        nextAvailable: canStudyToday ? nextAvailableDate : new Date(new Date().setDate(new Date().getDate() + 1)),
        conceptsCount: reviewableConceptsCount,
        totalConcepts: allConceptsCount,
        hasStudiedConcepts,
        limitReason: studyLimitReason
      } as any);
      
      // SIN LÍMITE SEMANAL - El quiz siempre está disponible
      // Se permite hacer el quiz tantas veces como el usuario quiera
      console.log('✅ Quiz disponible sin límites semanales');
      setQuizAvailability({
        available: true,
        nextAvailable: new Date()
      });
      
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
        freeStudyCount,
        voiceRecognitionSessions
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
        )),
        // Voice recognition sessions (get docs to sum sessionScore)
        getDocs(query(
          collection(db, 'studySessions'),
          where('userId', '==', effectiveUserId),
          where('notebookId', '==', notebook.id),
          where('mode', '==', 'voice_recognition'),
          where('validated', '==', true),
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
      
      // Calculate total voice recognition sessions earned
      let voiceRecognitionSessionsEarned = 0;
      voiceRecognitionSessions.forEach((doc) => {
        const sessionData = doc.data();
        const sessionScore = sessionData.sessionScore || sessionData.finalSessionScore || 0;
        voiceRecognitionSessionsEarned += sessionScore;
      });
      setVoiceRecognitionCount(voiceRecognitionSessionsEarned);
      
      // Calculate accumulated study sessions from free study (0.1 per valid session)
      const freeStudySessionsEarned = freeStudyCount * 0.1;
      setFreeStudySessionsEarned(freeStudySessionsEarned);
      
      // Calculate final score with new formula:
      // (Estudio inteligente + Estudio Activo + Estudio Libre) × (top score quiz + pts juegos + bonus racha)
      const streakBonus = studyStreakService.getStreakBonus(userStreak.currentStreak);
      
      // Total sesiones de estudio
      const totalStudySessions = smartStudyPoints + voiceRecognitionSessionsEarned + freeStudySessionsEarned;
      
      // Total puntos multiplicadores
      const totalMultiplierPoints = maxQuizScoreValue + gamePointsValue + streakBonus;
      
      // Score final
      const totalScore = totalStudySessions * totalMultiplierPoints;
      
      setNotebookScore({
        score: totalScore,
        level: Math.floor(totalScore / 50) + 1,
        progress: totalScore % 50
      });

      // Update score breakdown for modal
      setScoreBreakdown({
        totalStudySessions,
        smartStudyPoints,
        voiceRecognitionPoints: voiceRecognitionSessionsEarned,
        freeStudyPoints: freeStudySessionsEarned,
        totalMultiplierPoints,
        maxQuizScore: maxQuizScoreValue,
        gamePoints: gamePointsValue,
        streakBonus,
        finalScore: totalScore
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

  // Handle AI Chat
  const handleAIChat = () => {
    if (!selectedNotebook) return;
    // TODO: Implement AI chat navigation
    console.log('Opening AI Chat for notebook:', selectedNotebook.title);
  };

  // Handle AI Practice
  const handleAIPractice = () => {
    if (!selectedNotebook) return;
    // TODO: Implement AI practice navigation
    console.log('Opening AI Practice for notebook:', selectedNotebook.title);
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
    
    // Verificar si el cuaderno está congelado (excepto para profesores)
    if (selectedNotebook.isFrozen && !isTeacher) {
      alert('Este cuaderno está congelado. No puedes realizar actividades de estudio.');
      setSelectedNotebook(null); // Deseleccionar el cuaderno congelado
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
    
    // Guardar la selección antes de navegar
    studySessionPersistence.saveSelection(selectedNotebook, selectedMateria);
    
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
            {/* Dropdown with Score and Medal */}
            <div className="notebook-dropdown-wrapper">
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
                                  className={`dropdown-item notebook-item ${selectedNotebook?.id === notebook.id ? 'selected' : ''} ${notebook.isFrozen ? 'frozen' : ''} ${notebook.isFrozen && !isTeacher ? 'disabled' : ''}`}
                                  onClick={async () => {
                                    // Verificar el estado actual del notebook desde la base de datos
                                    try {
                                      const notebookDoc = await getDoc(doc(db, 'notebooks', notebook.id));
                                      if (notebookDoc.exists()) {
                                        const currentData = notebookDoc.data();
                                        const isCurrentlyFrozen = currentData.isFrozen || false;
                                        
                                        if (isCurrentlyFrozen && !isTeacher) {
                                          alert('Este cuaderno está congelado. No puedes realizar actividades de estudio.');
                                          setShowNotebookDropdown(false);
                                          return;
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error verificando estado del notebook:', error);
                                    }
                                    
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
                {selectedNotebook && (
                  <div className="score-info-icon">
                    <FontAwesomeIcon icon={faInfoCircle} />
                    <div className="score-tooltip">
                      <div className="tooltip-content">
                        <div>SESIONES × PUNTOS BASE</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Score Breakdown Module */}
            {selectedNotebook && (
              <div className="score-breakdown-module">
                <button 
                  className="score-breakdown-trigger"
                  onClick={() => setShowScoreBreakdown(true)}
                  title="Ver desglose detallado del score"
                >
                  <div className="breakdown-preview">
                    <span className="breakdown-title">Cálculo Score</span>
                    <span className="breakdown-formula">
                      {scoreBreakdown.totalStudySessions.toFixed(1)} × {scoreBreakdown.totalMultiplierPoints}
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

          {/* Daily Metrics */}
          <div className="daily-metrics">
            <div className="metric-card">
              <div className="metric-info-icon" data-tooltip="Días consecutivos de estudio">
                <i className="fas fa-info-circle"></i>
              </div>
              <FontAwesomeIcon icon={faFire} className="metric-icon fire" />
              <div className="metric-content">
                <span className="metric-label">Racha</span>
                <span className="metric-value">{streakData.days} días</span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-info-icon" data-tooltip="Puntos bonus acumulados por tu racha de estudio">
                <i className="fas fa-info-circle"></i>
              </div>
              <FontAwesomeIcon icon={faStar} className="metric-icon bonus" />
              <div className="metric-content">
                <span className="metric-label">Bonus</span>
                <span className="metric-value">{scoreBreakdown.streakBonus || 0} pts</span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-info-icon" data-tooltip="Estado de tu sesión de estudio del día de hoy">
                <i className="fas fa-info-circle"></i>
              </div>
              <FontAwesomeIcon icon={faPlay} className="metric-icon progress" />
              <div className="metric-content">
                <span className="metric-label">Estudio Hoy</span>
                <span className="metric-value" style={{ color: '#10b981', fontSize: '0.9rem' }}>
                  {streakData.days > 0 ? 'INICIADO' : 'PENDIENTE'}
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-info-icon" data-tooltip="Suma total de todas tus sesiones de estudio">
                <i className="fas fa-info-circle"></i>
              </div>
              <FontAwesomeIcon icon={faBook} className="metric-icon sessions" />
              <div className="metric-content">
                <span className="metric-label">Sesiones</span>
                <span className="metric-value">
                  {selectedNotebook ? scoreBreakdown.totalStudySessions.toFixed(1) : '0.0'}
                </span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-info-icon" data-tooltip="Score máximo quiz + juegos + bonus racha">
                <i className="fas fa-info-circle"></i>
              </div>
              <FontAwesomeIcon icon={faStar} className="metric-icon base-points" />
              <div className="metric-content">
                <span className="metric-label">Puntos Base</span>
                <span className="metric-value">
                  {selectedNotebook ? scoreBreakdown.totalMultiplierPoints.toLocaleString() : '0'}
                </span>
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
              <div className="function-info-icon" data-tooltip="Repasa conceptos con algoritmo adaptativo">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="function-icon">
                <FontAwesomeIcon icon={faBrain} />
              </div>
              <h3>Repaso Inteligente</h3>
              {!selectedNotebook ? (
                <p className="function-status">Selecciona un cuaderno</p>
              ) : studyAvailability.available ? (
                <>
                  <p className="function-status available">Sesiones: {smartStudyCount || 0}</p>
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
              className={`study-function-card ${!selectedNotebook ? 'disabled' : ''}`}
              onClick={() => selectedNotebook && navigate('/voice-recognition', {
                state: {
                  selectedNotebook: selectedNotebook,
                  skipNotebookSelection: true
                }
              })}
            >
              {selectedNotebook && (
                <div className="voice-recognition-badge">#{(voiceRecognitionCount || 0).toFixed(1)}</div>
              )}
              <div className="function-info-icon" data-tooltip="Practica definiciones con tu voz">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="function-icon">
                <FontAwesomeIcon icon={faMicrophone} />
              </div>
              <h3>Estudio Activo</h3>
              {!selectedNotebook ? (
                <p className="function-status">Selecciona un cuaderno</p>
              ) : (
                <>
                  <p className="function-status available">Sesiones: {(voiceRecognitionCount || 0).toFixed(1)}</p>
                  <button className="function-btn">
                    <FontAwesomeIcon icon={faPlay} /> Iniciar
                  </button>
                </>
              )}
            </div>

            <div 
              className={`study-function-card ${!selectedNotebook ? 'disabled' : ''}`}
              onClick={() => handleStudyMode('free')}
            >
              {selectedNotebook && (
                <div className="free-study-badge">#{freeStudySessionsEarned.toFixed(1)}</div>
              )}
              <div className="function-info-icon" data-tooltip="Practica a tu propio ritmo">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="function-icon">
                <FontAwesomeIcon icon={faBook} />
              </div>
              <h3>Estudio Libre</h3>
              {!selectedNotebook ? (
                <p className="function-status">Selecciona un cuaderno</p>
              ) : (
                <>
                  <p className="function-status available">Sesiones: {freeStudySessionsEarned.toFixed(1)}</p>
                  <button className="function-btn">
                    <FontAwesomeIcon icon={faPlay} /> Iniciar
                  </button>
                </>
              )}
            </div>

            <div className="study-function-card study-sessions-summary">
              <div className="function-info-icon" data-tooltip="Suma total de todas tus sesiones de estudio">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="function-icon sessions-number">
                {selectedNotebook ? scoreBreakdown.totalStudySessions.toFixed(1) : '0.0'}
              </div>
              <h3>Sesiones de Estudio</h3>
              {!selectedNotebook && (
                <p className="function-status">Selecciona un cuaderno</p>
              )}
            </div>

            <div 
              className={`study-function-card ${!selectedNotebook || !quizAvailability.available ? 'disabled' : ''}`}
              onClick={() => handleStudyMode('quiz')}
            >
              {selectedNotebook && maxQuizScore > 0 && (
                <div className="quiz-score-badge">Max: {maxQuizScore}</div>
              )}
              <div className="function-info-icon" data-tooltip="Evalúa tu conocimiento con preguntas">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="function-icon">
                <FontAwesomeIcon icon={faQuestion} />
              </div>
              <h3>Quiz</h3>
              {!selectedNotebook ? (
                <p className="function-status">Selecciona un cuaderno</p>
              ) : quizAvailability.available ? (
                <>
                  <p className="function-status available">Puntos Base: {maxQuizScore}</p>
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
              onClick={() => handleStudyMode('games')}
            >
              {selectedNotebook && (
                <div className="game-points-badge">Pts: {gamePoints || 0}</div>
              )}
              <div className="function-info-icon" data-tooltip="Aprende jugando de forma divertida">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="function-icon">
                <FontAwesomeIcon icon={faGamepad} />
              </div>
              <h3>Juegos</h3>
              {!selectedNotebook ? (
                <p className="function-status">Selecciona un cuaderno</p>
              ) : (
                <>
                  <p className="function-status available">Puntos Base: {gamePoints || 0}</p>
                  <button className="function-btn">
                    <FontAwesomeIcon icon={faPlay} /> Iniciar
                  </button>
                </>
              )}
            </div>

            <div className="study-function-card base-points-summary">
              <div className="function-info-icon" data-tooltip="Score máximo quiz + juegos + bonus racha">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="function-icon points-number">
                {selectedNotebook ? scoreBreakdown.totalMultiplierPoints : '0'}
              </div>
              <h3>Puntos Base</h3>
              {!selectedNotebook && (
                <p className="function-status">Selecciona un cuaderno</p>
              )}
            </div>
          </div>

          {/* AI-Powered Study Section - HIDDEN
          <div className="ai-study-section">
            <div className="ai-section-header">
              <div className="ai-badge">
                <span>Potenciado con IA</span>
              </div>
            </div>
            
            <div className="ai-study-functions">
              <div className="ai-function-card coming-soon">
                <div className="coming-soon-tag">Próximamente</div>
                <div className="function-info-icon" data-tooltip="Chat con IA especializada en tu material de estudio">
                  <i className="fas fa-info-circle"></i>
                </div>
                <div className="ai-function-icon">
                  <i className="fas fa-comments"></i>
                </div>
                <h3>Chat Inteligente</h3>
                <p className="function-status">IA lista para ayudarte</p>
              </div>

              <div className="ai-function-card coming-soon">
                <div className="coming-soon-tag">Próximamente</div>
                <div className="function-info-icon" data-tooltip="Práctica personalizada con ejercicios generados por IA">
                  <i className="fas fa-info-circle"></i>
                </div>
                <div className="ai-function-icon">
                  <i className="fas fa-flask"></i>
                </div>
                <h3>Práctica Adaptativa</h3>
                <p className="function-status">Ejercicios personalizados</p>
              </div>

              <div className="ai-function-card coming-soon">
                <div className="coming-soon-tag">Próximamente</div>
                <div className="function-info-icon" data-tooltip="Tutor IA que analiza tu progreso y crea planes de estudio">
                  <i className="fas fa-info-circle"></i>
                </div>
                <div className="ai-function-icon">
                  <i className="fas fa-graduation-cap"></i>
                </div>
                <h3>Tutor Personal IA</h3>
                <p className="function-status">Planes de estudio personalizados</p>
              </div>
            </div>
          </div>
          */}
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

      {/* Score Breakdown Modal */}
      {showScoreBreakdown && selectedNotebook && (
        <div className="modal-overlay" onClick={() => setShowScoreBreakdown(false)}>
          <div className="score-breakdown-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📊 Desglose Detallado del Score</h3>
              <button className="close-modal" onClick={() => setShowScoreBreakdown(false)}>
                ×
              </button>
            </div>
            
            <div className="score-breakdown-content">
              {/* Formula Display */}
              <div className="formula-display">
                <div className="formula-title">🧮 Fórmula de Cálculo</div>
                <div className="formula-equation">
                  <span className="sessions-part">(Sesiones de Estudio)</span>
                  <span className="multiply-symbol">×</span>
                  <span className="multipliers-part">(Puntos Multiplicadores)</span>
                </div>
              </div>

              {/* Sessions Breakdown */}
              <div className="breakdown-section sessions-section">
                <h4>📚 Sesiones de Estudio</h4>
                <div className="breakdown-items">
                  <div className="breakdown-item">
                    <span className="item-icon">🧠</span>
                    <span className="item-label">Estudio Inteligente</span>
                    <span className="item-value">{scoreBreakdown.smartStudyPoints.toFixed(1)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="item-icon">🎤</span>
                    <span className="item-label">Estudio Activo (Voz)</span>
                    <span className="item-value">{scoreBreakdown.voiceRecognitionPoints.toFixed(1)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="item-icon">📖</span>
                    <span className="item-label">Estudio Libre</span>
                    <span className="item-value">{scoreBreakdown.freeStudyPoints.toFixed(1)}</span>
                  </div>
                  <div className="breakdown-total">
                    <span className="total-label">Total Sesiones</span>
                    <span className="total-value">{scoreBreakdown.totalStudySessions.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Multipliers Breakdown */}
              <div className="breakdown-section multipliers-section">
                <h4>⚡ Puntos Multiplicadores</h4>
                <div className="breakdown-items">
                  <div className="breakdown-item">
                    <span className="item-icon">❓</span>
                    <span className="item-label">Mejor Score Quiz</span>
                    <span className="item-value">{scoreBreakdown.maxQuizScore}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="item-icon">🎮</span>
                    <span className="item-label">Puntos de Juegos</span>
                    <span className="item-value">{scoreBreakdown.gamePoints}</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="item-icon">🔥</span>
                    <span className="item-label">Bonus por Racha</span>
                    <span className="item-value">{scoreBreakdown.streakBonus}</span>
                  </div>
                  <div className="breakdown-total">
                    <span className="total-label">Total Multiplicadores</span>
                    <span className="total-value">{scoreBreakdown.totalMultiplierPoints}</span>
                  </div>
                </div>
              </div>

              {/* Final Calculation */}
              <div className="final-calculation">
                <div className="calculation-display">
                  <span className="sessions-value">{scoreBreakdown.totalStudySessions.toFixed(1)}</span>
                  <span className="multiply-symbol">×</span>
                  <span className="multipliers-value">{scoreBreakdown.totalMultiplierPoints}</span>
                  <span className="equals-symbol">=</span>
                  <span className="final-score">{Math.round(scoreBreakdown.finalScore).toLocaleString()}</span>
                </div>
                <div className="calculation-label">🎯 Score Final</div>
              </div>

              {/* Tips Section */}
              <div className="score-tips">
                <h4>💡 Consejos para Mejorar tu Score</h4>
                <div className="tips-grid">
                  <div className="tip-item">
                    <span className="tip-icon">📈</span>
                    <span>Completa más sesiones de estudio</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-icon">🏆</span>
                    <span>Mejora tu puntuación en Quiz</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-icon">🎯</span>
                    <span>Juega para ganar puntos extra</span>
                  </div>
                  <div className="tip-item">
                    <span className="tip-icon">🔥</span>
                    <span>Mantén tu racha diaria</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyModePage;