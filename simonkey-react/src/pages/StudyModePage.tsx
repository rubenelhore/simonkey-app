// src/pages/StudyModePage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
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

        // Calculate dominated concepts across all notebooks
        const totalDominatedConcepts = await calculateTotalDominatedConcepts(effectiveUserId);
        setConceptsLearned(totalDominatedConcepts);
        
        // Calculate division based on dominated concepts
        calculateDivision(totalDominatedConcepts);

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

  // Calculate total dominated concepts across all notebooks
  const calculateTotalDominatedConcepts = async (userId: string): Promise<number> => {
    try {
      console.log('🏅 Calculating total dominated concepts for user:', userId);
      
      // Get all notebooks for the user
      const notebooksQuery = query(
        collection(db, 'notebooks'),
        where('userId', '==', userId)
      );
      const notebooksSnapshot = await getDocs(notebooksQuery);
      
      let totalDominated = 0;
      
      // For each notebook, calculate dominated concepts
      for (const notebookDoc of notebooksSnapshot.docs) {
        const notebookId = notebookDoc.id;
        console.log(`📚 Checking notebook: ${notebookDoc.data().title} (${notebookId})`);
        
        // Get all learning data for this notebook
        const learningDataQuery = query(
          collection(db, 'users', userId, 'learningData'),
          where('notebookId', '==', notebookId)
        );
        const learningDataSnapshot = await getDocs(learningDataQuery);
        
        // Count concepts with repetitions >= 2 (green - dominated)
        const dominatedInNotebook = learningDataSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.repetitions >= 2; // 2 or more repetitions = green/dominated
        }).length;
        
        console.log(`✅ Dominated in ${notebookDoc.data().title}: ${dominatedInNotebook}`);
        totalDominated += dominatedInNotebook;
      }
      
      // Also check for school notebooks if user is a school student
      if (isSchoolStudent) {
        console.log('🎓 Checking school notebooks...');
        const schoolNotebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('assignedStudents', 'array-contains', userId)
        );
        const schoolNotebooksSnapshot = await getDocs(schoolNotebooksQuery);
        
        for (const notebookDoc of schoolNotebooksSnapshot.docs) {
          const notebookId = notebookDoc.id;
          console.log(`📚 Checking school notebook: ${notebookDoc.data().title} (${notebookId})`);
          
          // Get learning data for this school notebook
          const learningDataQuery = query(
            collection(db, 'users', userId, 'learningData'),
            where('notebookId', '==', notebookId)
          );
          const learningDataSnapshot = await getDocs(learningDataQuery);
          
          // Count dominated concepts
          const dominatedInNotebook = learningDataSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.repetitions >= 2;
          }).length;
          
          console.log(`✅ Dominated in school ${notebookDoc.data().title}: ${dominatedInNotebook}`);
          totalDominated += dominatedInNotebook;
        }
      }
      
      console.log('🏆 Total dominated concepts across all notebooks:', totalDominated);
      return totalDominated;
      
    } catch (error) {
      console.error('Error calculating total dominated concepts:', error);
      return 0;
    }
  };

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
      newSuggestions.push(`Estudia ${remaining} conceptos más y consigue la siguiente medalla`);
    }
    
    if (streakDays === 0) {
      newSuggestions.push('Inicia tu racha estudiando al menos 1 concepto hoy');
    } else if (streakDays < 7) {
      newSuggestions.push(`Mantén tu racha ${7 - streakDays} días más para el bonus semanal`);
    }
    
    // Generate daily challenges (2 options that change daily)
    const allChallenges = [
      { text: 'Completa un Estudio Inteligente en menos de 2 minutos', boost: '+50% XP' },
      { text: 'Domina 5 conceptos seguidos sin fallar ninguno', boost: '+25 puntos' },
      { text: 'Completa un Quiz con puntuación perfecta (10/10)', boost: '+100 puntos' },
      { text: 'Estudia durante 15 minutos sin parar', boost: '+30% XP' },
      { text: 'Aprende 3 conceptos nuevos en modo libre', boost: '+40 puntos' },
      { text: 'Mantén una racha de respuestas correctas de 8 seguidas', boost: '+60 puntos' },
      { text: 'Completa 2 sesiones de estudio en el mismo día', boost: '+75 puntos' },
      { text: 'Alcanza el 90% de precisión en un quiz', boost: '+35% XP' }
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
        
        // Score calculation based on mastery and study engagement
        const masteryScore = masteredConcepts * 10; // 10 points per mastered concept
        const studyScore = (studiedConcepts - masteredConcepts) * 3; // 3 points per studied concept
        const totalScore = masteryScore + studyScore;
        
        console.log('Total score calculated:', totalScore);
        
        setNotebookScore({
          score: totalScore,
          level: Math.floor(totalScore / 50) + 1, // Level up every 50 points
          progress: totalScore % 50
        });
      }
    } catch (error) {
      console.error('Error loading notebook stats:', error);
      // Set default score on error
      setNotebookScore({ score: 0, level: 1, progress: 0 });
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
      
      {/* Small Score Module - Upper Left Corner */}
      {selectedNotebook && (
        <div className="corner-score-module">
          <div className="corner-score-icon">
            <FontAwesomeIcon icon={faTrophy} />
          </div>
          <div className="corner-score-content">
            <div className="corner-score-value">{notebookScore.score}</div>
            <div className="corner-score-label">Pts</div>
          </div>
        </div>
      )}
      
      <main className="study-mode-main">

        {/* Main Study Module */}
        <div className="main-study-module">
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
            <p>Cada sesión de estudio te acerca más a tus metas. ¡Tú puedes lograrlo!</p>
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
                <div className="notebook-dropdown">
                  {materias.length === 0 ? (
                    <div className="dropdown-empty">No hay materias disponibles</div>
                  ) : (
                    <>
                      {/* Materias section */}
                      <div className="dropdown-section">
                        <div className="dropdown-section-title">Materias</div>
                        {materias.map(materia => (
                          <div 
                            key={materia.id}
                            className={`dropdown-item materia-item ${selectedMateria?.id === materia.id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedMateria(materia);
                              const lastMateriaKey = isSchoolStudent ? 
                                `student_${auth.currentUser?.uid}_lastStudyMateriaId` : 
                                'lastStudyMateriaId';
                              localStorage.setItem(lastMateriaKey, materia.id);
                            }}
                          >
                            {materia.nombre || materia.title}
                          </div>
                        ))}
                      </div>
                      
                      {/* Notebooks section */}
                      {selectedMateria && notebooks.length > 0 && (
                        <div className="dropdown-section">
                          <div className="dropdown-section-title">Cuadernos</div>
                          {notebooks.map(notebook => (
                            <div 
                              key={notebook.id}
                              className={`dropdown-item notebook-item ${selectedNotebook?.id === notebook.id ? 'selected' : ''} ${notebook.isFrozen ? 'frozen' : ''}`}
                              onClick={() => {
                                handleSelectNotebook(notebook);
                                setShowNotebookDropdown(false);
                              }}
                            >
                              <span>{notebook.title}</span>
                              {notebook.isFrozen && <FontAwesomeIcon icon={faSnowflake} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
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
              className="study-function-card"
              onClick={() => handleStudyMode('smart')}
            >
              <div className="function-icon">
                <FontAwesomeIcon icon={faBrain} />
              </div>
              <h3>Estudio Inteligente</h3>
              <p>Repasa los conceptos que necesitas según el algoritmo SM-3</p>
              <button className="function-btn">
                <FontAwesomeIcon icon={faPlay} /> Iniciar
              </button>
            </div>

            <div 
              className="study-function-card"
              onClick={() => handleStudyMode('quiz')}
            >
              <div className="function-icon">
                <FontAwesomeIcon icon={faQuestion} />
              </div>
              <h3>Quiz</h3>
              <p>Evalúa tu conocimiento con 10 preguntas aleatorias</p>
              <button className="function-btn">
                <FontAwesomeIcon icon={faPlay} /> Iniciar
              </button>
            </div>

            <div 
              className="study-function-card"
              onClick={() => handleStudyMode('free')}
            >
              <div className="function-icon">
                <FontAwesomeIcon icon={faBook} />
              </div>
              <h3>Estudio Libre</h3>
              <p>Repasa todos los conceptos del cuaderno sin restricciones</p>
              <button className="function-btn">
                <FontAwesomeIcon icon={faPlay} /> Iniciar
              </button>
            </div>

            <div 
              className="study-function-card"
              onClick={() => handleStudyMode('games')}
            >
              <div className="function-icon">
                <FontAwesomeIcon icon={faGamepad} />
              </div>
              <h3>Juegos</h3>
              <p>Aprende jugando con actividades interactivas</p>
              <button className="function-btn">
                <FontAwesomeIcon icon={faPlay} /> Iniciar
              </button>
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

            {/* Challenges Section - Two horizontal modules */}
            <div className="learning-module">
              <div className="section-header">
                <FontAwesomeIcon icon={faTrophy} />
                <h4>Reto del día</h4>
              </div>
              
              <div className="challenges-grid">
                {challenges.map((challenge, index) => (
                  <div 
                    key={index} 
                    className="challenge-module expanded"
                  >
                    <div className="challenge-full">
                      <div className="challenge-content">
                        <FontAwesomeIcon icon={faStar} />
                        <span className="challenge-text">{challenge.text}</span>
                      </div>
                      <div className="challenge-boost">
                        {challenge.boost}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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