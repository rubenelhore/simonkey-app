import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import VoicePracticeSession from '../components/VoicePracticeSession';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faArrowLeft, faVolumeUp, faCoffee, faChartLine, faRocket, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useUserType } from '../hooks/useUserType';
import { useStudyService } from '../hooks/useStudyService';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import '../styles/VoiceRecognition.css';

interface Notebook {
  id: string;
  title: string;
  subject?: string;
  conceptCount?: number;
  materiaId?: string;
  materiaName?: string;
  isEnrolled?: boolean;
  teacherId?: string;
}

interface VoiceConcept {
  id: string;
  concept: string;
  definition: string;
}

interface VoiceResult {
  concept: string;
  userResponse: string;
  isCorrect: boolean;
  score: number;
}

type VoiceStep = 'notebook-selection' | 'intensity-selection' | 'practice' | 'results';

type IntensityLevel = 'warmup' | 'progress' | 'rocket';

interface IntensityOption {
  id: IntensityLevel;
  name: string;
  conceptCount: number;
  icon: string;
  description: string;
}

const INTENSITY_OPTIONS: IntensityOption[] = [
  { id: 'warmup', name: 'Warm-Up', conceptCount: 5, icon: 'coffee', description: '5 conceptos' },
  { id: 'progress', name: 'Progreso', conceptCount: 10, icon: 'chart-line', description: '10 conceptos' },
  { id: 'rocket', name: 'Rocket', conceptCount: 20, icon: 'rocket', description: '20 conceptos' }
];

const VoiceRecognitionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedNotebook: passedNotebook, skipNotebookSelection } = location.state || {};
  
  const [currentStep, setCurrentStep] = useState<VoiceStep>(
    skipNotebookSelection ? 'intensity-selection' : 'notebook-selection'
  );
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [concepts, setConcepts] = useState<VoiceConcept[]>([]);
  const [allNotebookConcepts, setAllNotebookConcepts] = useState<VoiceConcept[]>([]);
  const [selectedIntensity, setSelectedIntensity] = useState<IntensityLevel>('warmup');
  const [currentConceptIndex, setCurrentConceptIndex] = useState(0);
  const [results, setResults] = useState<VoiceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsToLoadConcepts, setNeedsToLoadConcepts] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService(isSchoolStudent ? 'school' : 'premium');

  // Handle passed notebook from study page
  useEffect(() => {
    if (passedNotebook && skipNotebookSelection) {
      setSelectedNotebook(passedNotebook);
      setNeedsToLoadConcepts(true);
    }
  }, [passedNotebook, skipNotebookSelection]);

  // Cargar cuadernos del usuario
  useEffect(() => {
    if (!skipNotebookSelection) {
      loadUserNotebooks();
    }
  }, [skipNotebookSelection]);

  const loadUserNotebooks = async () => {
    if (!auth.currentUser?.uid) return;
    
    setLoading(true);
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      console.log('🔍 VoiceRecognition - Usuario actual:', auth.currentUser.uid);
      console.log('🔍 VoiceRecognition - Usuario efectivo:', userId);
      console.log('🔍 VoiceRecognition - Es estudiante escolar:', isSchoolStudent);
      
      let notebooksList: Notebook[] = [];
      
      if (isSchoolStudent) {
        // Cargar cuadernos escolares
        const schoolNotebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('studentId', '==', userId)
        );
        const schoolSnapshot = await getDocs(schoolNotebooksQuery);
        
        notebooksList = schoolSnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title || 'Sin título',
          subject: doc.data().subject || 'General',
          conceptCount: 0
        }));
      } else {
        console.log('🔍 VoiceRecognition - Entrando a búsqueda de cuadernos personales');
        // Cargar cuadernos personales (propios)
        const personalNotebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', userId)
        );
        const personalSnapshot = await getDocs(personalNotebooksQuery);
        console.log('🔍 VoiceRecognition - Cuadernos personales encontrados:', personalSnapshot.size);
        
        notebooksList = personalSnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title || 'Sin título',
          subject: doc.data().materiaName || doc.data().subject || 'Personal',
          conceptCount: 0,
          materiaId: doc.data().materiaId,
          materiaName: doc.data().materiaName
        }));
        
        // También cargar cuadernos de materias inscritas (del profesor)
        console.log('Buscando materias inscritas para userId:', userId);
        
        // Obtener inscripciones del usuario
        const enrollmentsQuery = query(
          collection(db, 'enrollments'),
          where('studentId', '==', userId)
        );
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        console.log('Inscripciones encontradas:', enrollmentsSnapshot.size);
        
        // Para cada inscripción, obtener la materia y sus cuadernos
        for (const enrollmentDoc of enrollmentsSnapshot.docs) {
          const enrollmentData = enrollmentDoc.data();
          const materiaId = enrollmentData.materiaId;
          
          // Obtener la materia
          const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
          if (!materiaDoc.exists()) continue;
          
          const materiaData = materiaDoc.data();
          const teacherId = materiaData.userId;
          console.log(`Materia: ${materiaData.name}, TeacherId: ${teacherId}`);
          
          // Obtener cuadernos del profesor para esta materia
          const teacherNotebooksQuery = query(
            collection(db, 'notebooks'),
            where('userId', '==', teacherId),
            where('materiaId', '==', materiaId)
          );
          const teacherSnapshot = await getDocs(teacherNotebooksQuery);
          console.log(`Cuadernos del profesor encontrados: ${teacherSnapshot.size}`);
          
          const teacherNotebooks = teacherSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title || 'Sin título',
            subject: `${materiaData.name} (Inscrito)`,
            conceptCount: 0,
            materiaId: materiaId,
            materiaName: materiaData.name,
            isEnrolled: true,
            teacherId: teacherId // Guardar el teacherId para poder obtener los conceptos
          }));
          
          notebooksList = [...notebooksList, ...teacherNotebooks];
        }
      }

      // Contar conceptos por cuaderno
      for (const notebook of notebooksList) {
        try {
          // Usar el teacherId si el notebook es de una materia inscrita, sino usar el userId
          const targetUserId = notebook.isEnrolled && notebook.teacherId ? notebook.teacherId : userId;
          const conceptsData = await studyService.getAllConceptsFromNotebook(targetUserId, notebook.id);
          notebook.conceptCount = conceptsData.length;
        } catch (error) {
          console.error(`Error cargando conceptos para ${notebook.id}:`, error);
          notebook.conceptCount = 0;
        }
      }

      // Filtrar solo cuadernos con al menos 5 conceptos
      console.log('Total de cuadernos antes de filtrar:', notebooksList.length);
      const validNotebooks = notebooksList.filter(notebook => (notebook.conceptCount || 0) >= 5);
      console.log('Cuadernos válidos (con 5+ conceptos):', validNotebooks.length);
      setNotebooks(validNotebooks);
      
    } catch (error) {
      console.error('Error cargando cuadernos:', error);
      setError('Error al cargar los cuadernos');
    } finally {
      setLoading(false);
    }
  };

  const handleNotebookSelect = async (notebook: Notebook) => {
    setSelectedNotebook(notebook);
    setLoading(true);
    
    try {
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser!.uid;
      
      // Usar el teacherId si el notebook es de una materia inscrita, sino usar el userId
      const targetUserId = notebook.isEnrolled && notebook.teacherId ? notebook.teacherId : userId;
      
      // Cargar todos los conceptos del cuaderno
      const allConcepts = await studyService.getAllConceptsFromNotebook(targetUserId, notebook.id);
      
      // Guardar todos los conceptos para poder seleccionar según la intensidad
      const voiceConcepts = allConcepts.map(concept => ({
        id: concept.id,
        concept: concept.término,
        definition: concept.definición
      }));
      
      setAllNotebookConcepts(voiceConcepts);
      setCurrentStep('intensity-selection');
      
    } catch (error) {
      console.error('Error cargando conceptos:', error);
      setError('Error al cargar los conceptos del cuaderno');
    } finally {
      setLoading(false);
    }
  };

  // Load concepts for passed notebook after handleNotebookSelect is available
  useEffect(() => {
    if (needsToLoadConcepts && selectedNotebook) {
      handleNotebookSelect(selectedNotebook);
      setNeedsToLoadConcepts(false);
    }
  }, [needsToLoadConcepts, selectedNotebook]);

  const handleIntensitySelect = (intensity: IntensityLevel) => {
    setSelectedIntensity(intensity);
    
    // Obtener el número de conceptos según la intensidad
    const intensityOption = INTENSITY_OPTIONS.find(opt => opt.id === intensity);
    const conceptCount = intensityOption?.conceptCount || 5;
    
    // Seleccionar conceptos aleatorios según la intensidad
    const shuffled = [...allNotebookConcepts].sort(() => 0.5 - Math.random());
    const selectedConcepts = shuffled.slice(0, Math.min(conceptCount, allNotebookConcepts.length));
    
    setConcepts(selectedConcepts);
    // Inicializar la sesión
    setCurrentConceptIndex(0);
    setResults([]);
    setQueuedCount(0); // Reset queue counter when starting new session
    setCurrentStep('practice');
  };

  const saveVoiceRecognitionSession = async (sessionResults: VoiceResult[]) => {
    try {
      if (!auth.currentUser || !selectedNotebook) return;

      const effectiveUserData = await getEffectiveUserId();
      const effectiveUserId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;

      // Calcular estadísticas de la sesión
      const correctAnswers = sessionResults.filter(r => r.isCorrect).length;
      const correctPercentage = (correctAnswers / sessionResults.length) * 100;
      const averageScore = sessionResults.reduce((sum, r) => sum + r.score, 0) / sessionResults.length;
      
      // Calcular si la sesión es válida (80% de respuestas correctas)
      const sessionValid = correctPercentage >= 80;
      
      // Calcular sesiones base según intensidad
      const baseSessionsMap = {
        'warmup': 1,
        'progress': 2,
        'rocket': 4
      };
      const baseSessions = baseSessionsMap[selectedIntensity];
      
      // Calcular multiplicador según promedio de score
      let scoreMultiplier = 1;
      if (averageScore >= 80) {
        scoreMultiplier = 2;
      } else if (averageScore >= 60) {
        scoreMultiplier = 1.4;
      } else if (averageScore >= 40) {
        scoreMultiplier = 1.2;
      }
      
      const finalSessionScore = sessionValid ? (baseSessions * scoreMultiplier) : 0;

      // Guardar sesión en Firestore
      const sessionData = {
        userId: effectiveUserId,
        notebookId: selectedNotebook.id,
        mode: 'voice_recognition',
        validated: sessionValid,
        intensity: selectedIntensity,
        conceptsCount: sessionResults.length,
        correctAnswers,
        correctPercentage,
        averageScore,
        baseSessions,
        scoreMultiplier,
        sessionScore: finalSessionScore,
        finalSessionScore: finalSessionScore, // Por compatibilidad
        results: sessionResults,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'studySessions'), sessionData);
      console.log('✅ Sesión de voice recognition guardada exitosamente');
      
    } catch (error) {
      console.error('❌ Error al guardar sesión de voice recognition:', error);
    }
  };

  const handleVoiceResult = async (result: VoiceResult) => {
    const newResults = [...results, result];
    setResults(newResults);
    
    // Si este era un concepto que estaba en cola (después del índice original), decrementar el contador
    const originalConceptCount = INTENSITY_OPTIONS.find(opt => opt.id === selectedIntensity)?.conceptCount || 5;
    
    if (currentConceptIndex >= originalConceptCount && queuedCount > 0) {
      setQueuedCount(prev => Math.max(0, prev - 1));
    }
    
    if (currentConceptIndex < concepts.length - 1) {
      setCurrentConceptIndex(currentConceptIndex + 1);
    } else {
      // Sesión completada, guardar en base de datos
      await saveVoiceRecognitionSession(newResults);
      setCurrentStep('results');
    }
  };

  const handleRetry = () => {
    // Mover el concepto actual al final de la cola
    const currentConcept = concepts[currentConceptIndex];
    const updatedConcepts = [
      ...concepts.slice(0, currentConceptIndex),
      ...concepts.slice(currentConceptIndex + 1),
      currentConcept
    ];
    setConcepts(updatedConcepts);
    
    // Incrementar el contador de elementos en cola
    setQueuedCount(prev => prev + 1);
    
    // Avanzar al siguiente concepto sin cambiar el índice (ya que removimos el actual)
    // Si era el último concepto, volver al índice 0
    if (currentConceptIndex >= updatedConcepts.length) {
      setCurrentConceptIndex(0);
    }
    // Si no era el último, el índice ya apunta al siguiente concepto automáticamente
  };

  const resetSession = () => {
    setCurrentStep('notebook-selection');
    setSelectedNotebook(null);
    setConcepts([]);
    setAllNotebookConcepts([]);
    setResults([]);
    setCurrentConceptIndex(0);
    setSelectedIntensity('warmup');
    setError(null);
  };

  const renderNotebookSelection = () => (
    <div className="voice-recognition-container">
      <div className="voice-header">
        <button className="back-button" onClick={() => navigate('/games')}>
          <FontAwesomeIcon icon={faArrowLeft} />
          Volver a Juegos
        </button>
        <div className="module-info">
          <span className="module-icon">🎤</span>
          <h1>Reconocimiento de Voz</h1>
          <p>Practica definiciones usando tu voz</p>
        </div>
      </div>

      <div className="notebook-selection">
        <h2>Selecciona un Cuaderno</h2>
        <p>Necesitas al menos 5 conceptos para practicar</p>
        
        {loading ? (
          <div className="loading-spinner">Cargando cuadernos...</div>
        ) : (
          <div className="notebooks-grid">
            {notebooks.map(notebook => (
              <div 
                key={notebook.id}
                className="notebook-card"
                onClick={() => handleNotebookSelect(notebook)}
              >
                <h3>{notebook.title}</h3>
                <p className="notebook-subject">{notebook.subject}</p>
                <div className="notebook-stats">
                  <span>{notebook.conceptCount} conceptos</span>
                </div>
              </div>
            ))}
            
            {notebooks.length === 0 && !loading && (
              <div className="no-notebooks">
                <p>No tienes cuadernos con suficientes conceptos para practicar.</p>
                <p>Necesitas al menos 5 conceptos por cuaderno.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderIntensitySelection = () => {
    const availableConcepts = allNotebookConcepts.length;
    
    return (
      <div className="voice-recognition-container">
        <div className="study-intro-modal">
          <div className="intro-header-compact">
            <div className="header-icon-compact">
              <FontAwesomeIcon icon={faMicrophone} />
            </div>
            <h2>Selecciona la Intensidad</h2>
          </div>
          
          <div className="intro-content-compact">
            <div className="explanation-compact">
              <div className="mini-summary">
                <h4>Cómo funciona:</h4>
                <ul>
                  <li>🎤 <strong>Di la definición</strong> de cada concepto en voz alta</li>
                  <li>🤖 <strong>La IA evalúa</strong> si tu respuesta es similar a la correcta</li>
                  <li>📊 <strong>Recibe retroalimentación</strong> detallada al final</li>
                </ul>
              </div>
            </div>
            
            <div className="intensity-section-compact">
              <h3 className="section-title-compact">Intensidad de Práctica</h3>
              
              {availableConcepts === 0 && (
                <div className="intensity-warning-compact">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span>No hay conceptos en este cuaderno.</span>
                </div>
              )}
              
              <div className="intensity-options-horizontal">
                {INTENSITY_OPTIONS.map((option) => {
                  const isDisabled = availableConcepts < option.conceptCount;
                  const isSelected = selectedIntensity === option.id;
                  
                  return (
                    <div
                      key={option.id}
                      className={`intensity-item-horizontal ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                      onClick={() => !isDisabled && setSelectedIntensity(option.id)}
                      title={isDisabled ? `Requiere ${option.conceptCount} conceptos (tienes ${availableConcepts})` : ''}
                    >
                      <FontAwesomeIcon icon={
                        option.id === 'warmup' ? faCoffee :
                        option.id === 'progress' ? faChartLine :
                        faRocket
                      } />
                      <div className="intensity-content">
                        <h4>{option.name}</h4>
                        <span>{option.description}</span>
                        {isDisabled && (
                          <div className="requirement-text">
                            Requiere {option.conceptCount}+ conceptos
                          </div>
                        )}
                      </div>
                      {isSelected && !isDisabled && (
                        <FontAwesomeIcon icon={faCheckCircle} className="check-icon" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="intro-actions-compact">
            <button 
              className="action-button-compact secondary"
              onClick={() => skipNotebookSelection ? navigate('/study', {
                state: {
                  selectedNotebook: selectedNotebook,
                  maintainSelection: true
                }
              }) : setCurrentStep('notebook-selection')}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Volver
            </button>
            <button 
              className="action-button-compact primary"
              onClick={() => handleIntensitySelect(selectedIntensity)}
              disabled={availableConcepts < (INTENSITY_OPTIONS.find(opt => opt.id === selectedIntensity)?.conceptCount || 0)}
            >
              <FontAwesomeIcon icon={faMicrophone} />
              Comenzar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    const correctAnswers = results.filter(r => r.isCorrect).length;
    const correctPercentage = (correctAnswers / results.length) * 100;
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    
    // Calcular si la sesión es válida (80% de respuestas correctas)
    const sessionValid = correctPercentage >= 80;
    
    // Calcular sesiones base según intensidad
    const baseSessionsMap = {
      'warmup': 1,
      'progress': 2,
      'rocket': 4
    };
    const baseSessions = baseSessionsMap[selectedIntensity];
    
    // Calcular multiplicador según promedio de score
    let scoreMultiplier = 1;
    if (averageScore >= 80) {
      scoreMultiplier = 2;
    } else if (averageScore >= 60) {
      scoreMultiplier = 1.4;
    } else if (averageScore >= 40) {
      scoreMultiplier = 1.2;
    }
    
    const finalSessionScore = sessionValid ? (baseSessions * scoreMultiplier) : 0;

    return (
      <div className="voice-results-centered">
        <div className="results-modal">
          {/* Header del modal */}
          <div className="modal-header">
            <h1 className="modal-title">Sesión Finalizada</h1>
          </div>
          
          {/* Resultado debajo del header */}
          <div className="results-text">
            <p>Obtuviste {correctPercentage.toFixed(0)}% de aciertos. Necesitas al menos 80% para validar</p>
          </div>

          {/* Contenido del modal */}
          <div className="modal-content">
            {/* Estadisticas principales */}
            <div className="main-stats">
              <div className="stat-box">
                <div className="stat-number">{correctAnswers}/{results.length}</div>
                <div className="stat-label">Respuestas Correctas</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">{averageScore.toFixed(0)}%</div>
                <div className="stat-label">Precisión Promedio</div>
              </div>
              <div className="stat-box bonus-box">
                <div className="stat-number">×{sessionValid ? scoreMultiplier : '0'}</div>
                <div className="stat-label">Bonus</div>
              </div>
              <div className="stat-box points-box">
                <div className="stat-number">{sessionValid ? (finalSessionScore * 1000).toFixed(0) : '0'}</div>
                <div className="stat-label">Puntos</div>
              </div>
            </div>

            {/* Desglose si es válida */}
            {sessionValid && (
              <div className="breakdown-section">
                <h3>Desglose de Puntuación</h3>
                <div className="breakdown-list">
                  <div className="breakdown-item">
                    <span>Intensidad {selectedIntensity.charAt(0).toUpperCase() + selectedIntensity.slice(1)}</span>
                    <span className="value">{(baseSessions * 1000).toFixed(0)} pts</span>
                  </div>
                  <div className="breakdown-item">
                    <span>Multiplicador ({averageScore.toFixed(0)}%)</span>
                    <span className="value">×{scoreMultiplier}</span>
                  </div>
                  <div className="breakdown-total">
                    <span>Total</span>
                    <span className="total-value">{(finalSessionScore * 1000).toFixed(0)} puntos</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer con botones */}
          <div className="modal-footer">
            <button 
              className="modal-btn secondary"
              onClick={() => skipNotebookSelection ? navigate('/study', {
                state: {
                  selectedNotebook: selectedNotebook,
                  maintainSelection: true
                }
              }) : resetSession()}
            >
              {skipNotebookSelection ? 'Volver al Estudio' : 'Otro Cuaderno'}
            </button>
            <button 
              className="modal-btn primary"
              onClick={() => handleNotebookSelect(selectedNotebook!)}
            >
              Repetir Sesión
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="voice-recognition-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={resetSession}>
            Intentar de Nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <HeaderWithHamburger title={selectedNotebook ? selectedNotebook.title : "Reconocimiento de Voz"} />
      <div className="main-content">
        {currentStep === 'notebook-selection' && renderNotebookSelection()}
        {currentStep === 'intensity-selection' && renderIntensitySelection()}
        {currentStep === 'practice' && (
          <VoicePracticeSession
            concepts={concepts}
            currentConceptIndex={currentConceptIndex}
            onResult={handleVoiceResult}
            onRetry={handleRetry}
            onBack={() => setCurrentStep('intensity-selection')}
            queuedCount={queuedCount}
          />
        )}
        {currentStep === 'results' && renderResults()}
      </div>
    </div>
  );
};

export default VoiceRecognitionPage;