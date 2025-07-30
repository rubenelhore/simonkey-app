import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGamepad, faArrowLeft, faTicket, faClock, faTrophy, faSnowflake } from '@fortawesome/free-solid-svg-icons';
import MemoryGame from '../components/Games/MemoryGame';
import PuzzleGame from '../components/Games/PuzzleGame';
import RaceGame from '../components/Games/RaceGame';
import QuizBattle from '../components/Games/QuizBattle';
import TicketDisplay from '../components/TicketDisplay';
import { useTickets } from '../hooks/useTickets';
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
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [pendingGame, setPendingGame] = useState<string | null>(null);
  const [isNotebookFrozen, setIsNotebookFrozen] = useState(false);
  const [hasReviewedConcepts, setHasReviewedConcepts] = useState<boolean | null>(null);
  const [checkingConcepts, setCheckingConcepts] = useState(false);
  const { tickets, loading: ticketsLoading, consumeTicket } = useTickets(notebookId);
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
      
      console.log('🎮 GamesPage - Verificando conceptos repasados');
      console.log('🎮 userId:', userId);
      console.log('🎮 notebookId:', notebookId);
      
      // PRIMERA OPCIÓN: Verificar si hay sesiones de estudio completadas para este cuaderno
      const studySessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        where('notebookId', '==', notebookId),
        where('endTime', '!=', null)
      );
      
      const studySessionsSnapshot = await getDocs(studySessionsQuery);
      console.log('🎮 Sesiones de estudio completadas encontradas:', studySessionsSnapshot.size);
      
      if (studySessionsSnapshot.size > 0) {
        // Verificar que al menos una sesión tenga conceptos estudiados
        for (const doc of studySessionsSnapshot.docs) {
          const sessionData = doc.data();
          if (sessionData.metrics?.conceptsReviewed > 0 || sessionData.concepts?.length > 0) {
            console.log('✅ Se encontró sesión con conceptos estudiados');
            return true;
          }
        }
      }
      
      // SEGUNDA OPCIÓN: Buscar directamente en la colección learningData
      const learningData = await studyService.getLearningDataForNotebook(userId, notebookId);
      
      console.log('🎮 learningData encontrados (servicio):', learningData.length);
      
      if (learningData.length > 0) {
        console.log('✅ Se encontraron datos de aprendizaje');
        return true;
      }
      
      // TERCERA OPCIÓN: Buscar en la colección de conceptos del cuaderno para ver si hay alguno estudiado
      const collectionName = isSchoolStudent ? 'schoolConcepts' : 'conceptos';
      
      const conceptsQuery = query(
        collection(db, collectionName),
        where('cuadernoId', '==', notebookId)
      );
      
      const conceptDocs = await getDocs(conceptsQuery);
      console.log('🎮 Documentos de conceptos encontrados:', conceptDocs.size);
      
      // Obtener todos los IDs de conceptos del cuaderno
      const conceptIds: string[] = [];
      conceptDocs.forEach(doc => {
        const conceptosData = doc.data().conceptos || [];
        conceptosData.forEach((concepto: any, index: number) => {
          const conceptId = concepto.id || `${doc.id}-${index}`;
          conceptIds.push(conceptId);
        });
      });
      
      console.log('🎮 Total de conceptos en el cuaderno:', conceptIds.length);
      
      // Verificar si alguno de estos conceptos tiene datos de aprendizaje
      for (const conceptId of conceptIds.slice(0, 10)) { // Verificar solo los primeros 10 para evitar demasiadas consultas
        const learningRef = doc(db, 'users', userId, 'learningData', conceptId);
        const learningDoc = await getDoc(learningRef);
        
        if (learningDoc.exists()) {
          console.log('✅ Se encontró concepto con datos de aprendizaje:', conceptId);
          return true;
        }
      }
      
      // CUARTA OPCIÓN: Verificar mini quiz results para este cuaderno
      const miniQuizQuery = query(
        collection(db, 'users', userId, 'miniQuizResults'),
        where('notebookId', '==', notebookId)
      );
      
      const miniQuizSnapshot = await getDocs(miniQuizQuery);
      console.log('🎮 Mini quiz completados encontrados:', miniQuizSnapshot.size);
      
      if (miniQuizSnapshot.size > 0) {
        console.log('✅ Se encontraron mini quiz completados');
        return true;
      }
      
      console.log('❌ No se encontraron conceptos repasados');
      return false;
    } catch (error) {
      console.error('Error verificando conceptos repasados:', error);
      return false;
    }
  };

  const handleGameClick = async (gameId: string, gameName: string) => {
    if (!notebookId) return;
    
    // Verificar si el cuaderno está congelado
    if (isNotebookFrozen) {
      alert('Este cuaderno está congelado. No puedes jugar en este momento.');
      return;
    }
    
    // Primero verificar si hay conceptos repasados
    setCheckingConcepts(true);
    const hasReviewed = await checkReviewedConcepts();
    setCheckingConcepts(false);
    
    if (!hasReviewed) {
      alert('¡Primero necesitas estudiar! Para jugar, necesitas haber repasado algunos conceptos en el estudio inteligente.');
      return;
    }
    
    // Si no hay tickets disponibles, mostrar mensaje
    if (!tickets || tickets.availableTickets === 0) {
      setShowTicketModal(true);
      return;
    }
    
    // Mostrar modal de confirmación
    setPendingGame(gameId);
    setShowTicketModal(true);
  };

  const confirmUseTicket = async () => {
    if (!pendingGame || !tickets) return;
    
    const gameNames: Record<string, string> = {
      'memory': 'Memorama',
      'race': 'Carrera de Conceptos',
      'puzzle': 'Puzzle de Definiciones',
      'quiz': 'Quiz Battle'
    };
    
    const success = await consumeTicket(pendingGame, gameNames[pendingGame]);
    
    if (success) {
      setSelectedGame(pendingGame);
      setShowTicketModal(false);
      setPendingGame(null);
    } else {
      alert('Error al consumir el ticket. Por favor, intenta de nuevo.');
    }
  };

  if (selectedGame === 'memory' && notebookId) {
    return <MemoryGame notebookId={notebookId} notebookTitle={notebookTitle} onBack={() => setSelectedGame(null)} />;
  }

  if (selectedGame === 'puzzle' && notebookId) {
    return <PuzzleGame notebookId={notebookId} notebookTitle={notebookTitle} onBack={() => setSelectedGame(null)} />;
  }

  if (selectedGame === 'race' && notebookId) {
    return <RaceGame notebookId={notebookId} notebookTitle={notebookTitle} onBack={() => setSelectedGame(null)} />;
  }

  if (selectedGame === 'quiz' && notebookId) {
    return <QuizBattle notebookId={notebookId} notebookTitle={notebookTitle} onBack={() => setSelectedGame(null)} />;
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
            {tickets && !ticketsLoading && (
              <div className="header-tickets-display">
                <div className="header-ticket-count">
                  <FontAwesomeIcon icon={faTicket} className="header-ticket-icon" />
                  <span className="header-ticket-number">{tickets.availableTickets}</span>
                  <span className="header-ticket-total">/3</span>
                </div>
                {tickets.availableTickets === 0 && (
                  <p className="header-refresh-time">
                    Nuevos en: {tickets.timeUntilNextRefresh.hours}h {tickets.timeUntilNextRefresh.minutes}m
                  </p>
                )}
              </div>
            )}
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
            {notebookId && !checkingConcepts && (
              <div className="game-ticket-cost">
                <span>1</span>
                <FontAwesomeIcon icon={faTicket} />
              </div>
            )}
          </div>

          <div 
            className={`game-card ${notebookId && !checkingConcepts ? '' : 'disabled'}`}
            onClick={() => !checkingConcepts && handleGameClick('race', 'Carrera de Conceptos')}
          >
            <div className="game-icon">🏃‍♂️</div>
            <h3>Carrera de Conceptos</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
            {checkingConcepts && <p>Verificando...</p>}
            {notebookId && !checkingConcepts && (
              <div className="game-ticket-cost">
                <span>1</span>
                <FontAwesomeIcon icon={faTicket} />
              </div>
            )}
          </div>

          <div 
            className={`game-card ${notebookId && !checkingConcepts ? '' : 'disabled'}`}
            onClick={() => !checkingConcepts && handleGameClick('puzzle', 'Puzzle de Definiciones')}
          >
            <div className="game-icon">🧩</div>
            <h3>Puzzle de Definiciones</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
            {checkingConcepts && <p>Verificando...</p>}
            {notebookId && !checkingConcepts && (
              <div className="game-ticket-cost">
                <span>1</span>
                <FontAwesomeIcon icon={faTicket} />
              </div>
            )}
          </div>

          <div 
            className={`game-card ${notebookId && !checkingConcepts ? '' : 'disabled'}`}
            onClick={() => !checkingConcepts && handleGameClick('quiz', 'Quiz Battle')}
          >
            <div className="game-icon">⚔️</div>
            <h3>Quiz Battle</h3>
            {!notebookId && <p>Selecciona un cuaderno</p>}
            {checkingConcepts && <p>Verificando...</p>}
            {notebookId && !checkingConcepts && (
              <div className="game-ticket-cost">
                <span>1</span>
                <FontAwesomeIcon icon={faTicket} />
              </div>
            )}
          </div>
        </div>

        {/* Modal de tickets */}
        {showTicketModal && (
          <div className="ticket-modal-overlay" onClick={() => setShowTicketModal(false)}>
            <div className="ticket-modal" onClick={(e) => e.stopPropagation()}>
              {tickets && tickets.availableTickets > 0 ? (
                <>
                  <h3>¿Usar un ticket?</h3>
                  <p>Este juego requiere 1 ticket para jugar</p>
                  <div className="ticket-modal-info">
                    <FontAwesomeIcon icon={faTicket} className="modal-ticket-icon" />
                    <span className="tickets-remaining">
                      Te quedarán {tickets.availableTickets - 1} tickets
                    </span>
                  </div>
                  <div className="ticket-modal-buttons">
                    <button 
                      className="cancel-btn"
                      onClick={() => {
                        setShowTicketModal(false);
                        setPendingGame(null);
                      }}
                    >
                      Cancelar
                    </button>
                    <button 
                      className="confirm-btn"
                      onClick={confirmUseTicket}
                    >
                      Usar Ticket
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3>Sin tickets disponibles</h3>
                  <div className="no-tickets-modal-content">
                    <FontAwesomeIcon icon={faClock} className="modal-clock-icon" />
                    <p>Has usado todos tus tickets de hoy</p>
                    {tickets && (
                      <p className="next-tickets-time">
                        Nuevos tickets en: {tickets.timeUntilNextRefresh.hours}h {tickets.timeUntilNextRefresh.minutes}m
                      </p>
                    )}
                  </div>
                  <button 
                    className="close-btn"
                    onClick={() => setShowTicketModal(false)}
                  >
                    Entendido
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default GamesPage;