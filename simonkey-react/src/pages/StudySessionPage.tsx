// src/pages/StudySessionPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import SwipeableStudyCard from '../components/Mobile/SwipeableStudyCard';
import FeedbackMessage from '../components/FeedbackMessage';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import MiniQuiz from '../components/MiniQuiz';
import { useStudyService } from '../hooks/useStudyService';
import { Concept, ResponseQuality, StudyMode, StudyIntensity, StudySessionMetrics } from '../types/interfaces';
import '../styles/StudySessionPage.css';
import Confetti from 'react-confetti';
import { useUserType } from '../hooks/useUserType';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { kpiService } from '../services/kpiService';
import { rankingUpdateService } from '../services/rankingUpdateService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

const StudySessionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscription } = useUserType();
  const studyService = useStudyService(subscription);
  
  // Get session info from navigation state
  const { mode, notebookId, notebookTitle } = location.state || {};
  const studyMode = mode === 'smart' ? StudyMode.SMART : StudyMode.FREE;
  
  // State for session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allConcepts, setAllConcepts] = useState<Concept[]>([]);
  const [currentConcepts, setCurrentConcepts] = useState<Concept[]>([]);
  const [sessionReviewQueue, setSessionReviewQueue] = useState<Concept[]>([]);
  const [sessionReviewedConcepts, setSessionReviewedConcepts] = useState<Concept[]>([]);
  const [sessionMultiplier, setSessionMultiplier] = useState<number>(1.5);
  const [studyIntensity, setStudyIntensity] = useState<StudyIntensity>(StudyIntensity.PROGRESS);
  const [totalNotebookConcepts, setTotalNotebookConcepts] = useState<number>(0);
  
  // State for metrics
  const [metrics, setMetrics] = useState<StudySessionMetrics>({
    totalConcepts: 0,
    conceptsReviewed: 0,
    mastered: 0,
    reviewing: 0,
    timeSpent: 0,
    startTime: new Date()
  });
  
  // State for tracking
  const [conceptFinalResults, setConceptFinalResults] = useState<Map<string, ResponseQuality>>(new Map());
  const [conceptsFirstPass, setConceptsFirstPass] = useState<Set<string>>(new Set());
  const [reviewedConceptIds, setReviewedConceptIds] = useState<Set<string>>(new Set());
  const [masteredConceptIds, setMasteredConceptIds] = useState<Set<string>>(new Set());
  const [reviewingConceptIds, setReviewingConceptIds] = useState<Set<string>>(new Set());
  const [uniqueConceptIds, setUniqueConceptIds] = useState<Set<string>>(new Set());
  const [uniqueConceptsCount, setUniqueConceptsCount] = useState<number>(0);
  
  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [sessionComplete, setSessionComplete] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  
  // Mini Quiz state
  const [showMiniQuiz, setShowMiniQuiz] = useState<boolean>(false);
  const [miniQuizPassed, setMiniQuizPassed] = useState<boolean>(false);
  const [miniQuizScore, setMiniQuizScore] = useState<number>(0);
  const [studySessionValidated, setStudySessionValidated] = useState<boolean>(false);
  
  // Timer
  const [sessionTimer, setSessionTimer] = useState<number | null>(null);

  // Validate navigation state
  useEffect(() => {
    if (!notebookId || !mode) {
      navigate('/study');
    }
  }, [notebookId, mode, navigate]);

  // Load notebook concepts count
  useEffect(() => {
    const loadNotebookInfo = async () => {
      if (!notebookId || !auth.currentUser) return;
      
      try {
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        
        const allConcepts = await studyService.getAllConceptsFromNotebook(userKey, notebookId);
        setTotalNotebookConcepts(allConcepts.length);
        
        // Set appropriate default study intensity based on available concepts
        if (allConcepts.length < 5) {
          // Not enough concepts for any mode
          setStudyIntensity(StudyIntensity.WARM_UP);
        } else if (allConcepts.length < 10) {
          // Can only do Warm-Up
          setStudyIntensity(StudyIntensity.WARM_UP);
        } else if (allConcepts.length < 20) {
          // Can do Warm-Up or Progress, default to Progress
          setStudyIntensity(StudyIntensity.PROGRESS);
        } else {
          // Can do any mode, keep default (Progress)
          setStudyIntensity(StudyIntensity.PROGRESS);
        }
      } catch (error) {
        console.error('Error loading notebook info:', error);
      }
    };
    
    loadNotebookInfo();
  }, [notebookId]);

  // Timer effect
  useEffect(() => {
    if (!sessionActive || !sessionTimer) return;
    
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - sessionTimer) / 1000);
      setMetrics(prev => ({
        ...prev,
        timeSpent: elapsedSeconds
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sessionActive, sessionTimer]);

  // Show feedback
  const showFeedback = (type: 'success' | 'info' | 'warning', message: string) => {
    setFeedback({
      visible: true,
      type,
      message
    });
    
    setTimeout(() => {
      setFeedback(prev => ({ ...prev, visible: false }));
    }, 2000);
  };

  // Begin study session
  const beginStudySession = async () => {
    setShowIntro(false);
    setLoading(true);
    
    if (!auth.currentUser || !notebookId) {
      showFeedback('warning', 'Error de sesión');
      navigate('/study');
      return;
    }
    
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      // Create session
      const session = await studyService.createStudySession(
        userKey, 
        notebookId,
        studyMode
      );
      
      setSessionId(session.id);
      
      // Load concepts
      let concepts: Concept[];
      
      if (studyMode === StudyMode.SMART) {
        // Smart study logic
        const allNotebookConcepts = await studyService.getAllConceptsFromNotebook(userKey, notebookId);
        const learningData = await studyService.getLearningDataForNotebook(userKey, notebookId);
        const reviewedConceptIds = new Set(learningData.map(data => data.conceptId));
        
        const neverReviewedConcepts = allNotebookConcepts.filter(concept => 
          !reviewedConceptIds.has(concept.id)
        );
        
        const conceptsDueForReview = await studyService.getReviewableConcepts(userKey, notebookId);
        
        concepts = [...neverReviewedConcepts, ...conceptsDueForReview];
        
        if (concepts.length === 0) {
          showFeedback('info', 'No tienes conceptos para repasar. ¡Excelente trabajo!');
          setLoading(false);
          navigate('/study');
          return;
        }
        
        // Apply intensity limit
        let conceptLimit = 10;
        let multiplier = 1.5;
        
        switch (studyIntensity) {
          case StudyIntensity.WARM_UP:
            conceptLimit = 5;
            multiplier = 1;
            break;
          case StudyIntensity.PROGRESS:
            conceptLimit = 10;
            multiplier = 1.5;
            break;
          case StudyIntensity.ROCKET:
            conceptLimit = 20;
            multiplier = 2;
            break;
        }
        
        setSessionMultiplier(multiplier);
        
        if (concepts.length > conceptLimit) {
          concepts = concepts.slice(0, conceptLimit);
        }
      } else {
        // Free study - all concepts
        concepts = await studyService.getAllConceptsFromNotebook(userKey, notebookId);
        
        if (concepts.length === 0) {
          showFeedback('warning', 'No hay conceptos en este cuaderno');
          setLoading(false);
          navigate('/study');
          return;
        }
      }
      
      // Shuffle concepts
      concepts = concepts.sort(() => 0.5 - Math.random());
      
      setAllConcepts(concepts);
      setCurrentConcepts([...concepts]);
      setSessionActive(true);
      setLoading(false);
      
      // Initialize counters
      setUniqueConceptsCount(concepts.length);
      setUniqueConceptIds(new Set(concepts.map(c => c.id)));
      setSessionReviewQueue([]);
      setReviewedConceptIds(new Set());
      setMasteredConceptIds(new Set());
      setReviewingConceptIds(new Set());
      setConceptFinalResults(new Map());
      setConceptsFirstPass(new Set());
      setSessionReviewedConcepts([]);
      
      // Start timer
      setSessionTimer(Date.now());
      
      const modeText = studyMode === StudyMode.SMART ? 'inteligente' : 'libre';
      showFeedback('success', `Sesión de estudio ${modeText} iniciada con ${concepts.length} conceptos`);
      
    } catch (error: any) {
      console.error("Error al iniciar sesión:", error);
      
      if (error.message === 'Ya has usado tu sesión de estudio libre hoy') {
        showFeedback('warning', 'Ya has usado tu sesión de estudio libre hoy. Puedes usar el estudio inteligente para repasar.');
      } else {
        showFeedback('warning', 'Error al iniciar la sesión de estudio');
      }
      
      setLoading(false);
      navigate('/study');
    }
  };

  // Handle concept response
  const handleConceptResponse = async (conceptId: string, quality: ResponseQuality) => {
    if (!auth.currentUser || !sessionId) return;
    
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      const isFirstPass = !conceptsFirstPass.has(conceptId);
      
      if (isFirstPass) {
        setConceptsFirstPass(prev => new Set(prev).add(conceptId));
        setConceptFinalResults(prev => {
          const newMap = new Map(prev);
          newMap.set(conceptId, quality);
          return newMap;
        });
      }
      
      // Update metrics
      setMetrics(prev => ({
        ...prev,
        conceptsReviewed: prev.conceptsReviewed + 1,
        mastered: quality === ResponseQuality.MASTERED ? prev.mastered + 1 : prev.mastered,
        reviewing: quality === ResponseQuality.REVIEW_LATER ? prev.reviewing + 1 : prev.reviewing
      }));
      
      // Update tracking sets
      setReviewedConceptIds(prev => new Set(Array.from(prev).concat([conceptId])));
      
      const currentConcept = currentConcepts.find(c => c.id === conceptId);
      if (currentConcept && isFirstPass) {
        setSessionReviewedConcepts(prev => [...prev, currentConcept]);
      }
      
      if (quality === ResponseQuality.MASTERED) {
        setMasteredConceptIds(prev => new Set(Array.from(prev).concat([conceptId])));
        setReviewingConceptIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(conceptId);
          return newSet;
        });
      } else {
        setReviewingConceptIds(prev => new Set(Array.from(prev).concat([conceptId])));
        setMasteredConceptIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(conceptId);
          return newSet;
        });
      }
      
      // Handle review queue
      const conceptForReview = currentConcepts.find(c => c.id === conceptId);
      const remainingConceptsAfterRemoval = currentConcepts.filter(c => c.id !== conceptId);
      setCurrentConcepts(remainingConceptsAfterRemoval);
      
      let newReviewQueue = [...sessionReviewQueue];
      
      if (quality === ResponseQuality.REVIEW_LATER && conceptForReview) {
        newReviewQueue = [...sessionReviewQueue, conceptForReview];
      } else if (quality === ResponseQuality.MASTERED && conceptForReview) {
        const wasInReviewQueue = sessionReviewQueue.some(c => c.id === conceptId);
        if (wasInReviewQueue) {
          newReviewQueue = sessionReviewQueue.filter(c => c.id !== conceptId);
          showFeedback('success', `¡Excelente! Dominaste "${conceptForReview.término}"`);
        }
      }
      
      setSessionReviewQueue(newReviewQueue);
      
      // Check if session is complete
      if (remainingConceptsAfterRemoval.length === 0) {
        if (newReviewQueue.length > 0) {
          continueWithImmediateReview(newReviewQueue);
        } else {
          await completeStudySession({
            updatedReviewedIds: new Set(Array.from(reviewedConceptIds).concat([conceptId])),
            updatedMasteredIds: quality === ResponseQuality.MASTERED 
              ? new Set(Array.from(masteredConceptIds).concat([conceptId]))
              : masteredConceptIds,
            updatedReviewingIds: quality === ResponseQuality.REVIEW_LATER
              ? new Set(Array.from(reviewingConceptIds).concat([conceptId]))
              : reviewingConceptIds,
            updatedConceptFinalResults: new Map(conceptFinalResults).set(conceptId, quality)
          });
        }
      }
      
    } catch (error) {
      console.error("Error al procesar respuesta:", error);
      showFeedback('warning', 'Error al guardar tu respuesta');
    }
  };

  // Continue with immediate review
  const continueWithImmediateReview = async (queue: Concept[]) => {
    if (queue.length === 0) {
      await completeStudySession();
      return;
    }
    
    const nextConcept = queue[0];
    const remainingQueue = queue.slice(1);
    
    setSessionReviewQueue(remainingQueue);
    setCurrentConcepts([nextConcept]);
  };

  // Complete study session
  const completeStudySession = async (updatedStates?: {
    updatedReviewedIds?: Set<string>;
    updatedMasteredIds?: Set<string>;
    updatedReviewingIds?: Set<string>;
    updatedConceptFinalResults?: Map<string, ResponseQuality>;
  }) => {
    const finalReviewedIds = updatedStates?.updatedReviewedIds || reviewedConceptIds;
    const finalMasteredIds = updatedStates?.updatedMasteredIds || masteredConceptIds;
    const finalReviewingIds = updatedStates?.updatedReviewingIds || reviewingConceptIds;
    const finalConceptResults = updatedStates?.updatedConceptFinalResults || conceptFinalResults;
    
    if (!sessionId || !auth.currentUser) return;
    
    // Stop timer
    if (sessionTimer) {
      clearInterval(sessionTimer);
      setSessionTimer(null);
    }
    
    const endTime = new Date();
    setMetrics(prev => ({
      ...prev,
      endTime
    }));
    
    try {
      // Prepare results
      const conceptsResults = Array.from(finalConceptResults.entries()).map(([conceptId, quality]) => ({
        conceptId,
        mastered: quality === ResponseQuality.MASTERED,
        quality
      }));
      
      const conceptsDominados = conceptsResults.filter(c => c.mastered).length;
      const conceptosNoDominados = conceptsResults.filter(c => !c.mastered).length;
      
      const metricsData = {
        ...metrics,
        conceptsReviewed: finalReviewedIds.size,
        mastered: finalMasteredIds.size,
        reviewing: finalReviewingIds.size
      };
      
      const detailedResultsData = {
        concepts: allConcepts || [],
        conceptsDominados: conceptsDominados || 0,
        conceptosNoDominados: conceptosNoDominados || 0,
        conceptsResults: conceptsResults || [],
        studyMode: studyMode,
        sessionMultiplier: studyMode === StudyMode.SMART ? sessionMultiplier : 1,
        studyIntensity: studyMode === StudyMode.SMART ? studyIntensity : null
      };
      
      // Save session
      await studyService.completeStudySession(
        sessionId,
        metricsData,
        detailedResultsData
      );
      
      // Update SM-3 for smart study only
      if (studyMode === StudyMode.SMART) {
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        
        for (const [conceptId, quality] of conceptFinalResults) {
          try {
            await studyService.updateConceptResponse(userKey, conceptId, quality);
          } catch (error) {
            console.error(`Error updating SM-3 for concept ${conceptId}:`, error);
          }
        }
      }
      
      // Update KPIs
      try {
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        await kpiService.updateUserKPIs(userKey);
        
        if (studyMode === StudyMode.SMART) {
          await rankingUpdateService.updateRankingsForStudent(userKey);
        }
      } catch (kpiError) {
        console.error('Error updating KPIs:', kpiError);
      }
      
      // Update usage limits
      if (studyMode === StudyMode.FREE && notebookId) {
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        await studyService.updateFreeStudyUsage(userKey, notebookId);
      }
      
      // Show mini quiz for smart study
      if (studyMode === StudyMode.SMART && notebookId) {
        setShowMiniQuiz(true);
        setSessionActive(false);
        setSessionComplete(true);
        return;
      }
      
      // Complete for free study
      if (studyMode === StudyMode.FREE) {
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        await studyService.logStudyActivity(
          userKey,
          'session_completed',
          `Sesión de estudio libre completada: ${reviewedConceptIds.size} conceptos revisados`
        );
        
        setSessionComplete(true);
        setSessionActive(false);
      }
      
    } catch (error) {
      console.error("Error completing session:", error);
      showFeedback('warning', 'Error al guardar estadísticas');
      setSessionComplete(true);
      setSessionActive(false);
    }
  };

  // Handle mini quiz complete
  const handleMiniQuizComplete = async (passed: boolean, score: number) => {
    setMiniQuizPassed(passed);
    setMiniQuizScore(score);
    setShowMiniQuiz(false);
    
    if (!auth.currentUser || !notebookId || !sessionId) return;
    
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      if (passed) {
        await studyService.updateSmartStudyUsage(userKey, notebookId, true);
        setStudySessionValidated(true);
        await studyService.markStudySessionAsValidated(sessionId);
        await studyService.logStudyActivity(
          userKey,
          'smart_study_validated',
          `Estudio inteligente validado con Mini Quiz: ${score}/10`
        );
      } else {
        setStudySessionValidated(false);
        await studyService.markStudySessionAsValidated(sessionId, false);
        await studyService.logStudyActivity(
          userKey,
          'smart_study_failed_validation',
          `Estudio inteligente falló validación: ${score}/10`
        );
        await studyService.updateSmartStudyUsage(userKey, notebookId, false);
      }
      
      setSessionComplete(true);
      setSessionActive(false);
      
    } catch (error) {
      console.error("Error processing mini quiz result:", error);
      showFeedback('warning', 'Error al procesar el resultado');
      setSessionComplete(true);
      setSessionActive(false);
    }
  };

  // Format time
  const formatStudyTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Get window size for confetti
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render intro screen
  const renderIntroScreen = () => {
    if (studyMode === StudyMode.SMART) {
      return (
        <div className="study-intro-overlay">
          <div className="study-intro-modal">
            <div className="intro-header">
              <i className="fas fa-brain"></i>
              <h2>Estudio Inteligente</h2>
            </div>
            
            <div className="intro-content">
              <div className="intro-section">
                <h3>¿Qué es el Estudio Inteligente?</h3>
                <p>
                  Utiliza el algoritmo SM-3 para mostrarte solo los conceptos que necesitas repasar hoy.
                </p>
              </div>
              
              <div className="intro-section">
                <h3>Elige tu intensidad:</h3>
                {totalNotebookConcepts < 5 && (
                  <div className="intensity-warning">
                    <i className="fas fa-exclamation-triangle"></i>
                    <p>Este cuaderno tiene solo {totalNotebookConcepts} conceptos. Necesitas al menos 5 conceptos para estudiar.</p>
                  </div>
                )}
                <div className="intensity-options">
                  <div 
                    className={`intensity-option ${studyIntensity === StudyIntensity.WARM_UP ? 'selected' : ''} ${totalNotebookConcepts < 5 ? 'disabled' : ''}`}
                    onClick={() => totalNotebookConcepts >= 5 && setStudyIntensity(StudyIntensity.WARM_UP)}
                  >
                    <i className="fas fa-coffee"></i>
                    <h4>Warm-Up</h4>
                    <p>5 conceptos</p>
                    {totalNotebookConcepts < 5 && (
                      <p className="intensity-requirement">Requiere 5+ conceptos</p>
                    )}
                    <p className="intensity-value">0.5 estudios inteligentes</p>
                  </div>
                  
                  <div 
                    className={`intensity-option ${studyIntensity === StudyIntensity.PROGRESS ? 'selected' : ''} ${totalNotebookConcepts < 10 ? 'disabled' : ''}`}
                    onClick={() => totalNotebookConcepts >= 10 && setStudyIntensity(StudyIntensity.PROGRESS)}
                  >
                    <i className="fas fa-chart-line"></i>
                    <h4>Progreso</h4>
                    <p>10 conceptos</p>
                    {totalNotebookConcepts < 10 && (
                      <p className="intensity-requirement">Requiere 10+ conceptos</p>
                    )}
                    <p className="intensity-value">1 estudio inteligente</p>
                  </div>
                  
                  <div 
                    className={`intensity-option ${studyIntensity === StudyIntensity.ROCKET ? 'selected' : ''} ${totalNotebookConcepts < 20 ? 'disabled' : ''}`}
                    onClick={() => totalNotebookConcepts >= 20 && setStudyIntensity(StudyIntensity.ROCKET)}
                  >
                    <i className="fas fa-rocket"></i>
                    <h4>Rocket</h4>
                    <p>20 conceptos</p>
                    {totalNotebookConcepts < 20 && (
                      <p className="intensity-requirement">Requiere 20+ conceptos</p>
                    )}
                    <p className="intensity-value">2 estudios inteligentes</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="intro-actions">
              <button
                className="action-button secondary"
                onClick={() => navigate('/study')}
              >
                <i className="fas fa-times"></i>
                Cancelar
              </button>
              <button
                className="action-button primary"
                onClick={beginStudySession}
                disabled={totalNotebookConcepts < 5}
              >
                <i className="fas fa-play"></i>
                {totalNotebookConcepts < 5 ? 'Conceptos insuficientes' : 'Iniciar'}
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="study-intro-overlay">
          <div className="study-intro-modal">
            <div className="intro-header">
              <i className="fas fa-book-open"></i>
              <h2>Estudio Libre</h2>
            </div>
            
            <div className="intro-content">
              <div className="intro-section">
                <h3>¿Qué es el Estudio Libre?</h3>
                <p>
                  Repasa todos los conceptos del cuaderno sin restricciones. Disponible una vez al día.
                </p>
              </div>
            </div>
            
            <div className="intro-actions">
              <button
                className="action-button secondary"
                onClick={() => navigate('/study')}
              >
                <i className="fas fa-times"></i>
                Cancelar
              </button>
              <button
                className="action-button primary"
                onClick={beginStudySession}
              >
                <i className="fas fa-play"></i>
                Iniciar
              </button>
            </div>
          </div>
        </div>
      );
    }
  };

  if (loading && !showIntro) {
    return (
      <div className="study-session-container">
        <HeaderWithHamburger title={notebookTitle || 'Sesión de estudio'} subtitle="" />
        <div className="loading-container">
          <FontAwesomeIcon icon={faSpinner} spin size="3x" />
          <p>Cargando conceptos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mini Quiz */}
      {showMiniQuiz && notebookId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          backgroundColor: '#f8f9fa'
        }}>
          <MiniQuiz
            notebookId={notebookId}
            notebookTitle={notebookTitle || ''}
            sessionConcepts={sessionReviewedConcepts}
            onComplete={handleMiniQuizComplete}
            onClose={() => setShowMiniQuiz(false)}
          />
        </div>
      )}
      
      {/* Intro screen */}
      {showIntro && renderIntroScreen()}
      
      {/* Main content */}
      <div className="study-session-container">
        <HeaderWithHamburger
          title={notebookTitle || 'Sesión de estudio'}
          subtitle=""
          showBackButton={true}
          onBackClick={() => {
            if (sessionActive) {
              if (window.confirm('¿Estás seguro de que quieres salir? Tu progreso se guardará.')) {
                navigate('/study');
              }
            } else {
              navigate('/study');
            }
          }}
        />
        
        <main className="study-session-main">
          {/* Feedback */}
          {feedback.visible && (
            <FeedbackMessage
              type={feedback.type}
              message={feedback.message}
            />
          )}
          
          {/* Active session */}
          {sessionActive && (
            <div className="session-content">
              {(() => {
                const currentIndex = allConcepts.length - currentConcepts.length + 1;
                const totalConcepts = allConcepts.length;
                const currentConcept = currentConcepts[0];

                if (!currentConcept) {
                  return (
                    <div className="loading-container">
                      <div className="loading-spinner"></div>
                      <p>Procesando...</p>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="session-header-minimal">
                      <div className="card-counter">
                        <span className="card-number">{currentIndex}</span>
                        <span className="card-divider">/</span>
                        <span className="card-total">{totalConcepts}</span>
                      </div>
                      
                      {sessionReviewQueue.length > 0 && (
                        <div className="immediate-review-indicator">
                          <i className="fas fa-clock"></i>
                          <span>Repaso: {sessionReviewQueue.length}</span>
                        </div>
                      )}
                    </div>

                    <SwipeableStudyCard
                      concept={currentConcept}
                      reviewMode={studyMode === StudyMode.SMART}
                      quizMode={false}
                      onResponse={(quality) => handleConceptResponse(currentConcept.id, quality)}
                      onLockComplete={() => {}}
                    />
                  </>
                );
              })()}
            </div>
          )}
          
          {/* Session complete */}
          {sessionComplete && !showMiniQuiz && (
            <div className="session-complete-container">
              <Confetti width={windowSize.width} height={windowSize.height} numberOfPieces={180} recycle={false} />
              <div className="session-complete-card">
                <div className="session-complete-trophy">
                  <i className="fas fa-trophy"></i>
                </div>
                <div className="session-complete-title">
                  {studyMode === StudyMode.SMART && miniQuizPassed 
                    ? '¡Estudio Inteligente Validado!' 
                    : studyMode === StudyMode.SMART && !miniQuizPassed
                    ? 'Estudio Inteligente Completado'
                    : '¡Sesión completada!'
                  }
                </div>
                <div className="session-complete-subtitle">
                  {studyMode === StudyMode.SMART && miniQuizPassed 
                    ? `¡Excelente! Aprobaste con ${miniQuizScore}/10`
                    : studyMode === StudyMode.SMART && !miniQuizPassed
                    ? `Obtuviste ${miniQuizScore}/10. Necesitas 8/10 para validar.`
                    : '¡Buen trabajo! Sigue así.'
                  }
                </div>
                <div className="session-complete-stats">
                  <div className="stat-card">
                    <i className="fas fa-book"></i>
                    <div className="stat-value">{conceptFinalResults.size}</div>
                    <div className="stat-label">Conceptos</div>
                  </div>
                  <div className="stat-card">
                    <i className="fas fa-star"></i>
                    <div className="stat-value">{Array.from(conceptFinalResults.values()).filter(q => q === ResponseQuality.MASTERED).length}</div>
                    <div className="stat-label">Dominados</div>
                  </div>
                  <div className="stat-card">
                    <i className="fas fa-clock"></i>
                    <div className="stat-value">{formatStudyTime(metrics.timeSpent)}</div>
                    <div className="stat-label">Tiempo</div>
                  </div>
                </div>
                <button
                  className="back-to-study-btn"
                  onClick={() => navigate('/study')}
                >
                  Volver al estudio
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default StudySessionPage;