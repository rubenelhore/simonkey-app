import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad, faArrowLeft, faTrophy, faSnowflake } from '@fortawesome/free-solid-svg-icons';
import MemoryGame from '../components/Games/MemoryGame';
import PuzzleGame from '../components/Games/PuzzleGame';
import RaceGame from '../components/Games/RaceGame';
import QuizBattle from '../components/Games/QuizBattle';
import { useGamePoints } from '../hooks/useGamePoints';
import { db, auth } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useUserType } from '../hooks/useUserType';
import { useStudyService } from '../hooks/useStudyService';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import '../styles/GamesPage.css';

const GamesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notebookId, notebookTitle } = location.state || {};
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [isNotebookFrozen, setIsNotebookFrozen] = useState(false);
  const [hasReviewedConcepts, setHasReviewedConcepts] = useState<boolean | null>(null);
  const [checkingConcepts, setCheckingConcepts] = useState(false);
  const [cachedConcepts, setCachedConcepts] = useState<any[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [cachedLearningData, setCachedLearningData] = useState<any[]>([]);
  const [learningDataLoaded, setLearningDataLoaded] = useState(false);
  const { points, loading: pointsLoading, refresh: refreshPoints } = useGamePoints(notebookId);
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService();

  // Verificar si el cuaderno está congelado
  useEffect(() => {
    const checkNotebookFrozen = async () => {
      if (!notebookId || !isSchoolStudent) return;
      
      try {
        const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
        if (notebookDoc.exists() && notebookDoc.data().isFrozen) {
          setIsNotebookFrozen(true);
        }
      } catch (error) {
        console.error('Error al verificar estado del cuaderno:', error);
      }
    };
    
    checkNotebookFrozen();
  }, [notebookId, isSchoolStudent]);
  
  // Recargar puntos cuando se regrese de un juego
  useEffect(() => {
    if (!selectedGame) {
      refreshPoints();
    }
  }, [selectedGame]);

  // Verificar si hay conceptos repasados
  const checkReviewedConcepts = async () => {
    if (!auth.currentUser || !notebookId) return false;
    
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      console.log('🎮 GamesPage - Verificando conceptos repasados y cargando conceptos');
      console.log('🎮 userId:', userId);
      console.log('🎮 notebookId:', notebookId);
      
      // Cargar conceptos y datos de aprendizaje una sola vez para usar en todos los juegos
      if (cachedConcepts.length === 0) {
        setConceptsLoading(true);
        try {
          const concepts = await studyService.getAllConceptsFromNotebook(userId, notebookId);
          console.log('🎮 Conceptos cargados y guardados en cache:', concepts.length);
          setCachedConcepts(concepts);
        } catch (error) {
          console.error('Error cargando conceptos:', error);
        } finally {
          setConceptsLoading(false);
        }
      }

      // Cargar datos de aprendizaje una sola vez
      if (!learningDataLoaded) {
        try {
          const learningData = await studyService.getLearningDataForNotebook(userId, notebookId);
          console.log('🎮 Datos de aprendizaje cargados y guardados en cache:', learningData.length);
          setCachedLearningData(learningData);
          setLearningDataLoaded(true);
        } catch (error) {
          console.error('Error cargando datos de aprendizaje:', error);
          setLearningDataLoaded(true); // Evitar intentos infinitos
        }
      }
      
      // PRIMERA OPCIÓN: Verificar si hay CUALQUIER sesión de estudio para este cuaderno
      // Incluye sesiones completadas Y sesiones en progreso con al menos un concepto
      const studySessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        where('notebookId', '==', notebookId),
        limit(10) // Aumentar límite para no perder sesiones
      );
      
      const studySessionsSnapshot = await getDocs(studySessionsQuery);
      console.log('🎮 Total sesiones de estudio encontradas:', studySessionsSnapshot.size);
      
      // Verificar si alguna sesión tiene endTime o concepts
      let hasValidSession = false;
      studySessionsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log('📋 Sesión:', doc.id, {
          endTime: !!data.endTime,
          hasConceptsArray: !!data.concepts,
          conceptsLength: data.concepts?.length || 0,
          mode: data.mode,
          metrics: data.metrics
        });
        
        // Una sesión es válida si:
        // 1. Tiene endTime (está completada) O
        // 2. Tiene array de concepts con al menos un elemento O
        // 3. Tiene métricas que indican que se estudiaron conceptos
        if (data.endTime || 
            (data.concepts && data.concepts.length > 0) ||
            (data.metrics && (data.metrics.conceptsReviewed > 0 || data.metrics.totalConcepts > 0))) {
          hasValidSession = true;
        }
      });
      
      if (hasValidSession) {
        console.log('✅ Se encontró al menos una sesión válida');
        return true;
      }
      
      // SEGUNDA OPCIÓN: Verificar si hay datos de aprendizaje (sin importar notebookId en el documento)
      const learningData = await studyService.getLearningDataForNotebook(userId, notebookId);
      
      console.log('🎮 learningData encontrados (servicio):', learningData.length);
      
      if (learningData.length > 0) {
        console.log('✅ Se encontraron datos de aprendizaje');
        return true;
      }
      
      // TERCERA OPCIÓN: Buscar CUALQUIER documento en learningData del usuario
      // Esto es más permisivo para casos edge
      const anyLearningQuery = query(
        collection(db, 'users', userId, 'learningData'),
        limit(50) // Buscar en los primeros 50 documentos
      );
      
      const anyLearningSnapshot = await getDocs(anyLearningQuery);
      console.log('🎮 Total documentos de learningData:', anyLearningSnapshot.size);
      
      // Verificar si alguno pertenece a este notebook verificando los conceptos
      if (anyLearningSnapshot.size > 0 && learningData.length === 0) {
        console.log('⚠️ Hay datos de aprendizaje pero no se pudieron asociar al notebook');
        // En este caso, permitir jugar si hay al menos algunos datos
        if (anyLearningSnapshot.size >= 1) {
          console.log('✅ Permitiendo jugar por tener datos de aprendizaje generales');
          return true;
        }
      }
      
      console.log('❌ No se encontraron conceptos repasados');
      return false;
    } catch (error) {
      console.error('Error verificando conceptos repasados:', error);
      // En caso de error, ser permisivo
      return true;
    }
  };

  const handleGameClick = async (gameId: string, gameName: string) => {
    if (!notebookId) return;
    
    // Verificar si el cuaderno está congelado
    if (isNotebookFrozen) {
      alert('Este cuaderno está congelado. No puedes jugar en este momento.');
      return;
    }
    
    // Para el puzzle game, ir directamente sin validaciones
    if (gameId === 'puzzle') {
      setSelectedGame(gameId);
      return;
    }
    
    // Cargar conceptos y datos de aprendizaje si no están cargados (solo para otros juegos)
    if (cachedConcepts.length === 0) {
      setCheckingConcepts(true);
      await checkReviewedConcepts();
      setCheckingConcepts(false);
    }
    
    // Ir directamente al juego sin restricciones
    setSelectedGame(gameId);
  };


  if (selectedGame === 'memory' && notebookId) {
    return <MemoryGame 
      notebookId={notebookId} 
      notebookTitle={notebookTitle} 
      onBack={() => setSelectedGame(null)}
      cachedConcepts={cachedConcepts}
      cachedLearningData={cachedLearningData}
    />;
  }

  if (selectedGame === 'puzzle' && notebookId) {
    return <PuzzleGame 
      notebookId={notebookId} 
      notebookTitle={notebookTitle} 
      onBack={() => setSelectedGame(null)}
      cachedConcepts={cachedConcepts}
      cachedLearningData={cachedLearningData}
    />;
  }

  if (selectedGame === 'race' && notebookId) {
    return <RaceGame 
      notebookId={notebookId} 
      notebookTitle={notebookTitle} 
      onBack={() => setSelectedGame(null)}
      cachedConcepts={cachedConcepts}
      cachedLearningData={cachedLearningData}
    />;
  }

  if (selectedGame === 'quiz' && notebookId) {
    return <QuizBattle 
      notebookId={notebookId} 
      notebookTitle={notebookTitle} 
      onBack={() => setSelectedGame(null)}
      cachedConcepts={cachedConcepts}
      cachedLearningData={cachedLearningData}
    />;
  }

  return (
    <div className="games-page">
      <HeaderWithHamburger 
        title="Juegos" 
        showBackButton={true}
        onBackClick={() => navigate(-1)}
      />
      
      <div className="games-container">

        <div className="games-header">
          <div className="games-header-section left">
            <button 
              className="games-back-button" 
              onClick={() => {
                sessionStorage.setItem('returning-from-games', 'true');
                navigate(-1);
              }}
              title="Regresar al estudio"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            {!pointsLoading && (
              <div className="header-points-display">
                <div className="header-points-icon">
                  <FontAwesomeIcon icon={faTrophy} />
                </div>
                <div className="header-points-info">
                  <div className="header-points-total">
                    {points?.totalPoints?.toLocaleString() || '0'}
                  </div>
                  <div className="header-points-label">puntos del cuaderno</div>
                </div>
              </div>
            )}
          </div>
          
          <div className="games-header-section center">
            <FontAwesomeIcon icon={faGamepad} className="games-icon" />
            <h1>Juegos</h1>
            <p className="games-subtitle">
              {notebookTitle ? `Cuaderno: ${notebookTitle}` : 'Aprende jugando con tus conceptos'}
            </p>
          </div>
          
          <div className="games-header-section right">
            {/* Espacio para futuros elementos del header */}
          </div>
        </div>

        {!notebookId && (
          <div className="no-notebook-warning">
            <p>⚠️ Debes seleccionar un cuaderno desde la página de estudio para jugar</p>
            <button onClick={() => navigate('/notebooks')} className="select-notebook-btn">
              Seleccionar Cuaderno
            </button>
          </div>
        )}
        
        {notebookId && isNotebookFrozen && (
          <div className="frozen-notebook-warning">
            <FontAwesomeIcon icon={faSnowflake} className="frozen-icon" />
            <h3>Cuaderno Congelado</h3>
            <p>Este cuaderno está congelado por el profesor. No puedes jugar en este momento.</p>
          </div>
        )}

        <div className="games-grid">
          <div 
            className={`game-card ${notebookId && !checkingConcepts ? '' : 'disabled'}`}
            onClick={() => !checkingConcepts && handleGameClick('memory', 'Memorama')}
          >
            <div className="game-icon">🎯</div>
            <h3>Memorama</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
            {checkingConcepts && <p>Verificando...</p>}
          </div>

          <div 
            className={`game-card ${notebookId && !checkingConcepts ? '' : 'disabled'}`}
            onClick={() => !checkingConcepts && handleGameClick('race', 'Carrera de Conceptos')}
          >
            <div className="game-icon">🏃‍♂️</div>
            <h3>Carrera de Conceptos</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
            {checkingConcepts && <p>Verificando...</p>}
          </div>

          <div 
            className={`game-card ${notebookId && !checkingConcepts ? '' : 'disabled'}`}
            onClick={() => !checkingConcepts && handleGameClick('puzzle', 'Puzzle de Definiciones')}
          >
            <div className="game-icon">🧩</div>
            <h3>Puzzle de Definiciones</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
            {checkingConcepts && <p>Verificando...</p>}
          </div>

          <div 
            className={`game-card ${notebookId && !checkingConcepts ? '' : 'disabled'}`}
            onClick={() => !checkingConcepts && handleGameClick('quiz', 'Quiz Battle')}
          >
            <div className="game-icon">⚔️</div>
            <h3>Quiz Battle</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
            {checkingConcepts && <p>Verificando...</p>}
          </div>
        </div>


      </div>
    </div>
  );
};

export default GamesPage;