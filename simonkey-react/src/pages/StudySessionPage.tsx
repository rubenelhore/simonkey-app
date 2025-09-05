// src/pages/StudySessionPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import SwipeableStudyCard from '../components/Mobile/SwipeableStudyCard';
import FeedbackMessage from '../components/FeedbackMessage';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import MiniQuiz from '../components/MiniQuiz';
import { useStudyService } from '../hooks/useStudyService';
import { Concept, ResponseQuality, StudyMode, StudyIntensity, StudySessionMetrics } from '../types/interfaces';
import '../styles/StudySessionPage.css';
// import Confetti from 'react-confetti'; // Deshabilitado por solicitud del usuario
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
  const [studyIntensity, setStudyIntensity] = useState<StudyIntensity>(StudyIntensity.WARM_UP);
  const [totalNotebookConcepts, setTotalNotebookConcepts] = useState<number>(0);
  const [availableSmartConcepts, setAvailableSmartConcepts] = useState<number>(6);
  const [loadingConceptsData, setLoadingConceptsData] = useState<boolean>(true);
  
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
  const [freeStudySessionValid, setFreeStudySessionValid] = useState<boolean>(false);
  const [freeStudySessionDuration, setFreeStudySessionDuration] = useState<number>(0);
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

  // First card instruction state
  const [isFirstCard, setIsFirstCard] = useState<boolean>(true);

  // Validate navigation state
  useEffect(() => {
    if (!notebookId || !mode) {
      navigate('/study');
    }
  }, [notebookId, mode, navigate]);

  // Set default values immediately to show the modal quickly
  useEffect(() => {
    // Show the modal immediately with default values
    setLoading(false);
    setLoadingConceptsData(true);
  }, []);

  // COMMENTED OUT THE PROBLEMATIC USEEFFECT
  /*
  useEffect(() => {
    let mounted = true;
    
    const loadNotebookInfo = async () => {
      if (!notebookId || !auth.currentUser || !mounted) return;
      
      try {
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        
        // Direct Firestore query to avoid dependency issues
        const collectionName = 'conceptos'; // Assume regular user for now
        const conceptsQuery = query(
          collection(db, collectionName),
          where('cuadernoId', '==', notebookId)
        );
        
        const conceptDocs = await getDocs(conceptsQuery);
        let totalConcepts = 0;
        
        conceptDocs.forEach(doc => {
          const conceptosData = doc.data().conceptos || [];
          totalConcepts += conceptosData.length;
        });
        
        if (!mounted) return;
        
        setTotalNotebookConcepts(totalConcepts);
        
        // Set appropriate default study intensity based on available concepts
        if (totalConcepts >= 20) {
          // Si tiene 20+ conceptos, puede usar cualquier modo, defaultear a Progress
          setStudyIntensity(StudyIntensity.PROGRESS);
        } else if (totalConcepts >= 10) {
          // Si tiene 10-19 conceptos, puede usar Warm-Up o Progress, defaultear a Progress
          setStudyIntensity(StudyIntensity.PROGRESS);
        } else if (totalConcepts >= 1) {
          // Si tiene 1-9 conceptos, solo puede usar Warm-Up
          setStudyIntensity(StudyIntensity.WARM_UP);
        } else {
          // Si tiene 0 conceptos, no puede estudiar
          setStudyIntensity(StudyIntensity.WARM_UP);
        }
      } catch (error) {
        console.error('Error loading notebook info:', error);
      }
    };
    
    loadNotebookInfo();
    
    return () => {
      mounted = false;
    };
  }, [notebookId]);
  */

  // Load available concepts for SMART mode - Now runs after modal is visible
  useEffect(() => {
    let mounted = true;
    
    const loadAvailableConceptsForMode = async () => {
      if (!notebookId || !auth.currentUser || !mounted) return;
      
      try {
        setLoadingConceptsData(true);
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        
        if (studyMode === StudyMode.SMART) {
          // For SMART mode, get concepts available for review
          const reviewableConcepts = await studyService.getReviewableConcepts(userKey, notebookId);
          const reviewableCount = reviewableConcepts.length;
          
          if (!mounted) return;
          
          setAvailableSmartConcepts(reviewableCount);
          console.log(`🎯 SMART MODE: ${reviewableCount} conceptos disponibles para repaso`);
          
          // Set appropriate default study intensity based on available concepts for SMART mode
          if (reviewableCount >= 20) {
            setStudyIntensity(StudyIntensity.PROGRESS);
          } else if (reviewableCount >= 10) {
            setStudyIntensity(StudyIntensity.PROGRESS);
          } else if (reviewableCount >= 1) {
            setStudyIntensity(StudyIntensity.WARM_UP);
          } else {
            setStudyIntensity(StudyIntensity.WARM_UP);
          }
        } else {
          // For FREE mode, count all concepts in notebook
          const collectionName = 'conceptos';
          const conceptsQuery = query(
            collection(db, collectionName),
            where('cuadernoId', '==', notebookId)
          );
          
          const conceptDocs = await getDocs(conceptsQuery);
          let totalConcepts = 0;
          
          conceptDocs.forEach(doc => {
            const conceptosData = doc.data().conceptos || [];
            totalConcepts += conceptosData.length;
          });
          
          if (!mounted) return;
          
          setTotalNotebookConcepts(totalConcepts);
          
          // Set appropriate default study intensity for FREE mode
          if (totalConcepts >= 20) {
            setStudyIntensity(StudyIntensity.PROGRESS);
          } else if (totalConcepts >= 10) {
            setStudyIntensity(StudyIntensity.PROGRESS);
          } else if (totalConcepts >= 1) {
            setStudyIntensity(StudyIntensity.WARM_UP);
          } else {
            setStudyIntensity(StudyIntensity.WARM_UP);
          }
        }
      } catch (error) {
        console.error('Error loading available concepts:', error);
      } finally {
        if (mounted) {
          setLoadingConceptsData(false);
        }
      }
    };
    
    // Delay the loading slightly to ensure modal is visible first
    const timer = setTimeout(() => {
      loadAvailableConceptsForMode();
    }, 100);
    
    return () => {
      clearTimeout(timer);
      mounted = false;
    };
  }, [notebookId, studyMode]);

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

  // Load real concepts - clean version
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
        studyMode,
        studyMode === StudyMode.SMART ? studyIntensity : undefined
      );
      setSessionId(session.id);
      
      // Get concepts based on study mode
      let allNotebookConcepts: Concept[] = [];
      
      if (studyMode === StudyMode.SMART) {
        // For SMART mode, get only concepts that are due for review according to SM-3
        allNotebookConcepts = await studyService.getReviewableConcepts(userKey, notebookId);
        console.log('🎯 SMART MODE: Conceptos listos para repaso según SM-3:', allNotebookConcepts.length);
      } else {
        // For FREE mode, get all concepts
        allNotebookConcepts = await studyService.getAllConceptsFromNotebook(userKey, notebookId);
        console.log('📚 FREE MODE: Todos los conceptos del cuaderno:', allNotebookConcepts.length);
      }
      
      // Apply intensity limit
      let conceptCount = 10;
      let multiplier = 1.5;
      
      // En modo FREE, SIEMPRE usar TODOS los conceptos disponibles
      if (studyMode === StudyMode.FREE) {
        conceptCount = allNotebookConcepts.length; // Usar todos los conceptos
        // El multiplicador sigue dependiendo de la intensidad
        switch (studyIntensity) {
          case StudyIntensity.WARM_UP:
            multiplier = 1;
            break;
          case StudyIntensity.PROGRESS:
            multiplier = 1.5;
            break;
          case StudyIntensity.ROCKET:
            multiplier = 2;
            break;
        }
      } else {
        // En modo SMART, aplicar límites según intensidad
        switch (studyIntensity) {
          case StudyIntensity.WARM_UP:
            conceptCount = Math.min(5, allNotebookConcepts.length);
            multiplier = 1;
            break;
          case StudyIntensity.PROGRESS:
            conceptCount = 10;
            multiplier = 1.5;
            break;
          case StudyIntensity.ROCKET:
            conceptCount = 20;
            multiplier = 2;
            break;
        }
      }
      
      // Limit the number of concepts based on intensity (or use all in FREE mode)
      const selectedConcepts = allNotebookConcepts.slice(0, conceptCount);
      const shuffledConcepts = selectedConcepts.sort(() => 0.5 - Math.random());
      
      setSessionMultiplier(multiplier);
      setAllConcepts(shuffledConcepts);
      setCurrentConcepts([...shuffledConcepts]);
      setSessionActive(true);
      setLoading(false);
      setSessionTimer(Date.now());
      
      // Initialize counters
      setUniqueConceptsCount(shuffledConcepts.length);
      setUniqueConceptIds(new Set(shuffledConcepts.map(c => c.id)));
      setSessionReviewQueue([]);
      setReviewedConceptIds(new Set());
      setMasteredConceptIds(new Set());
      setReviewingConceptIds(new Set());
      setConceptFinalResults(new Map());
      setConceptsFirstPass(new Set());
      setSessionReviewedConcepts([]);
      
      const modeText = studyMode === StudyMode.SMART ? 'inteligente' : 'libre';
      showFeedback('success', `Sesión iniciada con ${shuffledConcepts.length} conceptos`);
      
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      showFeedback('warning', 'Error al iniciar la sesión de estudio');
      setLoading(false);
      setShowIntro(true); // Show intro again on error
    }
  };

  // Handle concept response
  const handleConceptResponse = async (conceptId: string, quality: ResponseQuality) => {
    if (!auth.currentUser || !sessionId) return;
    
    // Mark that we're no longer on the first card
    if (isFirstCard) {
      setIsFirstCard(false);
    }
    
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
      
      // IMPORTANTE: Solo el estudio inteligente (SMART) actualiza SM-3
      // El estudio libre (FREE) NO modifica el algoritmo SM-3
      // Para SMART study, la actualización ocurre en handleMiniQuizComplete
      if (studyMode === StudyMode.SMART) {
        console.log('[STUDY] SM-3 se actualizará después del mini quiz (solo para estudio inteligente)');
        // La actualización real ocurre en handleMiniQuizComplete
      } else if (studyMode === StudyMode.FREE) {
        console.log('[STUDY] Estudio libre completado - NO se actualiza SM-3');
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
        // No establecer sessionComplete aquí para evitar mostrar la pantalla de completado
        return;
      }
      
      // Complete for free study
      if (studyMode === StudyMode.FREE) {
        const effectiveUserData = await getEffectiveUserId();
        const userKey = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
        
        // Check if session lasted at least 1 minute (60 seconds)
        const sessionDurationMinutes = metrics.timeSpent / 60;
        const sessionValid = sessionDurationMinutes >= 1;
        
        await studyService.logStudyActivity(
          userKey,
          'session_completed',
          `Sesión de estudio libre completada: ${reviewedConceptIds.size} conceptos revisados, duración: ${sessionDurationMinutes.toFixed(1)} minutos${sessionValid ? ' (válida)' : ' (muy corta)'}`
        );
        
        // Store session validation status for display
        setFreeStudySessionValid(sessionValid);
        setFreeStudySessionDuration(sessionDurationMinutes);
        
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
        // Actualizar SM-3 para todos los conceptos estudiados cuando se pasa el mini quiz
        console.log('[STUDY] Actualizando SM-3 para conceptos estudiados después de pasar mini quiz');
        for (const [conceptId, quality] of conceptFinalResults) {
          try {
            console.log(`[STUDY] Actualizando concepto ${conceptId} con calidad ${quality}`);
            await studyService.updateConceptResponse(userKey, conceptId, quality);
          } catch (error) {
            console.error(`Error updating SM-3 for concept ${conceptId}:`, error);
          }
        }
        
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
      
      // Mostrar pantalla de completado
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

  // Efecto de confetti deshabilitado
  // const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  // useEffect(() => {
  //   const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
  //   window.addEventListener('resize', handleResize);
  //   return () => window.removeEventListener('resize', handleResize);
  // }, []);

  // Render intro screen
  const renderIntroScreen = () => {
    if (studyMode === StudyMode.SMART) {
      return (
        <div className="study-intro-overlay">
          <div className="study-intro-modal">
            {/* Compact Header */}
            <div className="intro-header-compact">
              <div className="header-icon-compact">
                <i className="fas fa-brain"></i>
              </div>
              <h2>Repaso Inteligente</h2>
            </div>
            
            <div className="intro-content-compact">
              {/* Compact Explanation */}
              <div className="explanation-compact">
                <p>El algoritmo SM-3 selecciona los conceptos que necesitas repasar hoy.</p>
                <div className="benefits-inline">
                  <span><i className="fas fa-check"></i> Adaptativo</span>
                  <span><i className="fas fa-check"></i> Eficiente</span>
                  <span><i className="fas fa-check"></i> Personalizado</span>
                </div>
              </div>
              
              {/* Intensity Selector */}
              <div className="intensity-section-compact">
                <h3 className="section-title-compact">
                  Intensidad
                  {loadingConceptsData && (
                    <span style={{ marginLeft: '10px', fontSize: '0.8em', opacity: 0.7 }}>
                      <i className="fas fa-spinner fa-spin"></i>
                    </span>
                  )}
                </h3>
                
                {!loadingConceptsData && availableSmartConcepts < 1 && (
                  <div className="intensity-warning-compact">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>No tienes conceptos disponibles para repasar hoy.</span>
                  </div>
                )}
                
                <div className="intensity-options-horizontal" style={{ opacity: loadingConceptsData ? 0.6 : 1 }}>
                  <div 
                    className={`intensity-item-horizontal ${studyIntensity === StudyIntensity.WARM_UP ? 'selected' : ''} ${!loadingConceptsData && availableSmartConcepts < 1 ? 'disabled' : ''}`}
                    onClick={() => !loadingConceptsData && availableSmartConcepts >= 1 && setStudyIntensity(StudyIntensity.WARM_UP)}
                    title={!loadingConceptsData && availableSmartConcepts < 1 ? `No hay conceptos para repasar` : ''}
                  >
                    <i className="fas fa-coffee"></i>
                    <div className="intensity-content">
                      <h4>Warm-Up</h4>
                      <span>5 conceptos</span>
                      {!loadingConceptsData && availableSmartConcepts < 1 && (
                        <div className="requirement-text">Sin conceptos disponibles</div>
                      )}
                    </div>
                    {studyIntensity === StudyIntensity.WARM_UP && <i className="fas fa-check-circle check-icon"></i>}
                  </div>
                  
                  <div 
                    className={`intensity-item-horizontal ${studyIntensity === StudyIntensity.PROGRESS ? 'selected' : ''} ${!loadingConceptsData && availableSmartConcepts < 10 ? 'disabled' : ''}`}
                    onClick={() => !loadingConceptsData && availableSmartConcepts >= 10 && setStudyIntensity(StudyIntensity.PROGRESS)}
                    title={!loadingConceptsData && availableSmartConcepts < 10 ? `Requiere 10 conceptos (tienes ${availableSmartConcepts} disponibles)` : ''}
                  >
                    <i className="fas fa-chart-line"></i>
                    <div className="intensity-content">
                      <h4>Progreso</h4>
                      <span>10 conceptos</span>
                      {!loadingConceptsData && availableSmartConcepts < 10 && (
                        <div className="requirement-text">Requiere 10+ conceptos</div>
                      )}
                    </div>
                    {studyIntensity === StudyIntensity.PROGRESS && <i className="fas fa-check-circle check-icon"></i>}
                  </div>
                  
                  <div 
                    className={`intensity-item-horizontal ${studyIntensity === StudyIntensity.ROCKET ? 'selected' : ''} ${!loadingConceptsData && availableSmartConcepts < 20 ? 'disabled' : ''}`}
                    onClick={() => !loadingConceptsData && availableSmartConcepts >= 20 && setStudyIntensity(StudyIntensity.ROCKET)}
                    title={!loadingConceptsData && availableSmartConcepts < 20 ? `Requiere 20 conceptos (tienes ${availableSmartConcepts} disponibles)` : ''}
                  >
                    <i className="fas fa-rocket"></i>
                    <div className="intensity-content">
                      <h4>Rocket</h4>
                      <span>20 conceptos</span>
                      {!loadingConceptsData && availableSmartConcepts < 20 && (
                        <div className="requirement-text">Requiere 20+ conceptos</div>
                      )}
                    </div>
                    {studyIntensity === StudyIntensity.ROCKET && <i className="fas fa-check-circle check-icon"></i>}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Compact Actions */}
            <div className="intro-actions-compact">
              <button
                className="action-button-compact secondary"
                onClick={() => navigate('/study', { 
                  state: { 
                    maintainSelection: true 
                  } 
                })}
              >
                <i className="fas fa-arrow-left"></i>
                Volver
              </button>
              <button
                className="action-button-compact primary"
                onClick={beginStudySession}
                disabled={(!loadingConceptsData && availableSmartConcepts < 1) || loading}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Iniciando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-play"></i>
                    Comenzar
                  </>
                )}
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
                onClick={() => navigate('/study', { 
                  state: { 
                    maintainSelection: true 
                  } 
                })}
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
      {/* Mini Quiz integrado */}
      
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
                      <button 
                        className="back-button-study"
                        onClick={() => navigate('/study', { 
                          state: { 
                            maintainSelection: true 
                          } 
                        })}
                        title="Regresar a estudio"
                      >
                        <i className="fas fa-arrow-left"></i>
                      </button>
                      
                      {studyMode === StudyMode.SMART ? (
                        <div className="card-counter">
                          <span className="card-number">{currentIndex}</span>
                          <span className="card-divider">/</span>
                          <span className="card-total">{totalConcepts}</span>
                        </div>
                      ) : (
                        <div className="free-study-header">
                          <div className={`study-timer ${metrics.timeSpent >= 60 ? 'valid-time' : ''}`}>
                            <i className="fas fa-clock"></i>
                            <span className="timer-display">{formatStudyTime(metrics.timeSpent)}</span>
                          </div>
                          <div className="card-counter">
                            <span className="card-number">{currentIndex}</span>
                            <span className="card-divider">/</span>
                            <span className="card-total">{totalConcepts}</span>
                          </div>
                        </div>
                      )}
                      
                      {sessionReviewQueue.length > 0 && (
                        <div className="immediate-review-indicator">
                          <i className="fas fa-clock"></i>
                          <span>Repaso: {sessionReviewQueue.length}</span>
                        </div>
                      )}
                    </div>

                    {/* First card instruction message - only for smart mode */}
                    {isFirstCard && studyMode === StudyMode.SMART && (
                      <div className="first-card-instruction">
                        <div className="instruction-content">
                          <i className="fas fa-lightbulb instruction-icon"></i>
                          <p>Mientras se desbloquea la tarjeta, trata de decir la definición del concepto mentalmente</p>
                        </div>
                      </div>
                    )}

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
          
          {/* Mini Quiz */}
          {showMiniQuiz && notebookId && (
            <div className="session-content">
              <MiniQuiz
                notebookId={notebookId}
                notebookTitle={notebookTitle || ''}
                sessionConcepts={sessionReviewedConcepts}
                onComplete={handleMiniQuizComplete}
                onClose={() => setShowMiniQuiz(false)}
              />
            </div>
          )}
          
          {/* Session complete */}
          {sessionComplete && !showMiniQuiz && (
            <div className="session-complete-container">
              {/* <Confetti width={windowSize.width} height={windowSize.height} numberOfPieces={180} recycle={false} /> */}
              <div className="session-complete-card">
                <div className="session-complete-trophy">
                  <i className="fas fa-trophy"></i>
                </div>
                <div className="session-complete-title">
                  {studyMode === StudyMode.SMART && miniQuizPassed 
                    ? '¡Repaso Inteligente Validado!' 
                    : studyMode === StudyMode.SMART && !miniQuizPassed
                    ? 'Repaso Inteligente Completado'
                    : studyMode === StudyMode.FREE && freeStudySessionValid
                    ? '✅ ¡Estudio Libre Validado!'
                    : studyMode === StudyMode.FREE && !freeStudySessionValid
                    ? '❌ Estudio Libre Muy Corto'
                    : '¡Sesión completada!'
                  }
                </div>
                <div className="session-complete-subtitle">
                  {studyMode === StudyMode.SMART && miniQuizPassed 
                    ? `¡Excelente! Aprobaste con ${miniQuizScore}/10`
                    : studyMode === StudyMode.SMART && !miniQuizPassed
                    ? `Obtuviste ${miniQuizScore}/10. Necesitas 8/10 para validar.`
                    : studyMode === StudyMode.FREE && freeStudySessionValid
                    ? `¡Genial! Estudiaste ${freeStudySessionDuration.toFixed(1)} minutos y ganaste 0.1 sesiones de estudio`
                    : studyMode === StudyMode.FREE && !freeStudySessionValid
                    ? `Solo estudiaste ${freeStudySessionDuration.toFixed(1)} minutos. Necesitas al menos 1 minuto para ganar sesiones de estudio.`
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
                    <i className="fas fa-clock"></i>
                    <div className="stat-value">{formatStudyTime(metrics.timeSpent)}</div>
                    <div className="stat-label">Tiempo</div>
                  </div>
                  {/* Mostrar puntos ganados */}
                  {studyMode === StudyMode.SMART && miniQuizPassed && (
                    <div className="stat-card highlighted">
                      <i className="fas fa-star"></i>
                      <div className="stat-value">
                        +{studyIntensity === StudyIntensity.WARM_UP ? 500 : 
                           studyIntensity === StudyIntensity.PROGRESS ? 1000 : 2000}
                      </div>
                      <div className="stat-label">Puntos Ganados</div>
                    </div>
                  )}
                  {studyMode === StudyMode.FREE && freeStudySessionValid && (
                    <div className="stat-card highlighted">
                      <i className="fas fa-star"></i>
                      <div className="stat-value">+100</div>
                      <div className="stat-label">Puntos Ganados</div>
                    </div>
                  )}
                </div>
                <button
                  className="back-to-study-btn"
                  onClick={() => navigate('/study', { 
                    state: { 
                      maintainSelection: true 
                    } 
                  })}
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