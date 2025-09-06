import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMicrophone, 
  faStop, 
  faVolumeUp, 
  faArrowRight, 
  faCheckCircle, 
  faTimesCircle,
  faSpinner,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import { voiceRecognitionService, VoiceRecognitionResult, ComparisonResult } from '../services/voiceRecognitionService';

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
  feedback: string;
}

interface VoicePracticeSessionProps {
  concepts: VoiceConcept[];
  currentConceptIndex: number;
  onResult: (result: VoiceResult) => void;
  onRetry: () => void;
  onBack: () => void;
  queuedCount?: number;
}

type PracticeState = 'ready' | 'listening' | 'processing' | 'feedback';

const VoicePracticeSession: React.FC<VoicePracticeSessionProps> = ({
  concepts,
  currentConceptIndex,
  onResult,
  onRetry,
  onBack,
  queuedCount = 0
}) => {
  const [practiceState, setPracticeState] = useState<PracticeState>('ready');
  const [userTranscript, setUserTranscript] = useState('');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [microphonePermission, setMicrophonePermission] = useState<boolean | null>(null);
  const [listeningTimer, setListeningTimer] = useState(0);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInputText, setManualInputText] = useState('');
  const [showDefinition, setShowDefinition] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const currentConcept = concepts[currentConceptIndex];
  const isLastConcept = currentConceptIndex === concepts.length - 1;

  // Verificar permisos de micrófono al montar
  useEffect(() => {
    checkMicrophoneSetup();
    
    // Cleanup: stop speech synthesis when component unmounts
    return () => {
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  // Timer para el estado de escucha
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (practiceState === 'listening') {
      interval = setInterval(() => {
        setListeningTimer(prev => prev + 1);
      }, 1000);
    } else {
      setListeningTimer(0);
    }
    return () => clearInterval(interval);
  }, [practiceState]);

  // Auto-cerrar error después de 4 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const checkMicrophoneSetup = async () => {
    try {
      if (!voiceRecognitionService.isSupported()) {
        setError('Tu navegador no soporta reconocimiento de voz. Intenta con Chrome o Edge.');
        return;
      }

      const hasPermission = await voiceRecognitionService.requestMicrophonePermission();
      setMicrophonePermission(hasPermission);
      
      if (!hasPermission) {
        setError('Necesitas dar permisos de micrófono para usar esta función.');
      }
    } catch (error) {
      console.error('Error checking microphone:', error);
      setError('Error al verificar el micrófono.');
    }
  };

  const startListening = useCallback(async () => {
    if (!microphonePermission) {
      await checkMicrophoneSetup();
      return;
    }

    try {
      setError(null);
      setPracticeState('listening');
      setUserTranscript('');
      
      const result: VoiceRecognitionResult = await voiceRecognitionService.startListening();
      
      setUserTranscript(result.transcript);
      setPracticeState('processing');
      
      // Comparar con la definición usando Gemini
      const comparison = await voiceRecognitionService.compareWithDefinition(
        currentConcept.concept,
        currentConcept.definition,
        result.transcript
      );
      
      setComparisonResult(comparison);
      setPracticeState('feedback');
      
    } catch (error) {
      console.error('Error in voice recognition:', error);
      setError(error instanceof Error ? error.message : 'Error al procesar el audio');
      setPracticeState('ready');
    }
  }, [currentConcept, microphonePermission]);

  const stopListening = () => {
    voiceRecognitionService.stopListening();
    setPracticeState('ready');
  };

  const handleNext = () => {
    if (!comparisonResult) return;
    
    const result: VoiceResult = {
      concept: currentConcept.concept,
      userResponse: userTranscript,
      isCorrect: comparisonResult.isCorrect,
      score: comparisonResult.score,
      feedback: comparisonResult.feedback
    };
    
    onResult(result);
    
    // Reset para el siguiente concepto
    setUserTranscript('');
    setComparisonResult(null);
    setPracticeState('ready');
    setError(null);
    setShowManualInput(false);
    setManualInputText('');
    setShowDefinition(false);
    setGaveUp(false);
    setIsSpeaking(false);
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  };

  const handleManualSubmit = async () => {
    if (!manualInputText.trim()) {
      setError('Por favor escribe una definición');
      return;
    }

    try {
      setError(null);
      setPracticeState('processing');
      setUserTranscript(manualInputText);
      
      // Comparar con la definición usando Gemini
      const comparison = await voiceRecognitionService.compareWithDefinition(
        currentConcept.concept,
        currentConcept.definition,
        manualInputText
      );
      
      setComparisonResult(comparison);
      setPracticeState('feedback');
      setShowManualInput(false);
      
    } catch (error) {
      console.error('Error processing manual input:', error);
      setError(error instanceof Error ? error.message : 'Error al procesar tu respuesta');
      setPracticeState('ready');
    }
  };

  const speakDefinition = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        // Stop speaking
        speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        // Start speaking
        speechSynthesis.cancel(); // Cancel any ongoing speech first
        const utterance = new SpeechSynthesisUtterance(currentConcept.definition);
        utterance.lang = 'es-ES';
        utterance.rate = 0.8;
        
        utterance.onstart = () => {
          setIsSpeaking(true);
        };
        
        utterance.onend = () => {
          setIsSpeaking(false);
        };
        
        utterance.onerror = () => {
          setIsSpeaking(false);
        };
        
        speechSynthesis.speak(utterance);
      }
    }
  };

  const getListeningStatusText = () => {
    if (listeningTimer < 3) return 'Escuchando...';
    if (listeningTimer < 8) return 'No te escucho';
    return 'Escuchando';
  };

  const handleTryAgain = () => {
    // Reset local state to try the same concept again (don't move to queue)
    setPracticeState('ready');
    setUserTranscript('');
    setComparisonResult(null);
    setError(null);
    setShowManualInput(false);
    setManualInputText('');
    setShowDefinition(false);
    setGaveUp(false);
    setIsSpeaking(false);
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  };

  if (error && !microphonePermission) {
    return (
      <div className="voice-practice-container">
        <div className="voice-error">
          <h2>🎤 Micrófono Requerido</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button className="btn btn-primary" onClick={checkMicrophoneSetup}>
              Verificar Permisos
            </button>
            <button className="btn btn-outline" onClick={onBack}>
              Volver Atrás
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-practice-container">
      <button 
        className="exit-button-voice"
        onClick={onBack}
        title="Salir de la práctica"
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
      <div className="practice-header">
        <div className="progress-info">
        </div>
      </div>

      <div className="concept-display">
        <div className="concept-header">
          <div className="concept-number">
            {currentConceptIndex + 1}/{concepts.length}
            {queuedCount > 0 && (
              <span className="queued-indicator"> (+{queuedCount} en cola)</span>
            )}
          </div>
          <h2 className="concept-title">
            <span className="concept-label">Concepto:</span>
            <span className="concept-highlight">{currentConcept.concept}</span>
          </h2>
        </div>
        
        {practiceState === 'feedback' && (
          <div className="definition-section">
            <div className="definition-label">Definición:</div>
            <div className="definition-container">
              <p className="definition-text">{currentConcept.definition}</p>
              <button 
                className={`speak-button ${isSpeaking ? 'speaking' : ''}`}
                onClick={speakDefinition}
                title={isSpeaking ? "Detener audio" : "Escuchar definición"}
              >
                <FontAwesomeIcon icon={isSpeaking ? faStop : faVolumeUp} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="voice-interaction">
        {(practiceState === 'ready' || practiceState === 'listening') && (
          <div className="voice-ready">
            <h3>{gaveUp ? '¡Recuerda esta definición!' : '¡Tu turno!'}</h3>
            {!showDefinition && <p>{practiceState === 'listening' ? getListeningStatusText() : 'Di la definición de este concepto'}</p>}
            
            {showDefinition && gaveUp && (
              <div className="definition-section">
                <div className="definition-label">Definición:</div>
                <div className="definition-container">
                  <p className="definition-text">{currentConcept.definition}</p>
                  <button 
                    className={`speak-button ${isSpeaking ? 'speaking' : ''}`}
                    onClick={speakDefinition}
                    title={isSpeaking ? "Detener audio" : "Escuchar definición"}
                  >
                    <FontAwesomeIcon icon={isSpeaking ? faStop : faVolumeUp} />
                  </button>
                </div>
                <p className="gave-up-text">Esta pregunta se moverá al final para que la intentes de nuevo</p>
                <div className="gave-up-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      // Move concept to end of queue
                      onRetry();
                      // Reset state for next concept
                      setShowDefinition(false);
                      setGaveUp(false);
                      setPracticeState('ready');
                      setUserTranscript('');
                      setComparisonResult(null);
                      setError(null);
                    }}
                  >
                    <FontAwesomeIcon icon={faArrowRight} />
                    Continuar
                  </button>
                </div>
              </div>
            )}
            
            {!showManualInput && !gaveUp && (
              <>
                <button 
                  className={`mic-button ${practiceState === 'listening' ? 'listening' : 'ready'}`}
                  onClick={practiceState === 'listening' ? stopListening : startListening}
                  disabled={!microphonePermission}
                >
                  <FontAwesomeIcon icon={practiceState === 'listening' ? faStop : faMicrophone} />
                  <span>{practiceState === 'listening' ? 'Escuchando...' : 'Comenzar a Hablar'}</span>
                </button>
                
                {practiceState !== 'listening' && (
                  <button 
                    className="btn btn-outline show-definition-btn"
                    onClick={() => {
                      setShowDefinition(true);
                      setGaveUp(true);
                    }}
                  >
                    No lo sé
                  </button>
                )}
                
                {practiceState !== 'listening' && (
                  <div className="alternative-input">
                    <p>¿No puedes usar el micrófono?</p>
                    <button 
                      className="btn btn-outline"
                      onClick={() => setShowManualInput(true)}
                    >
                      Escribir Respuesta
                    </button>
                  </div>
                )}
              </>
            )}
            
            {showManualInput && (
              <div className="manual-input-section">
                <h4>Escribe la definición:</h4>
                <textarea
                  className="manual-input-textarea"
                  value={manualInputText}
                  onChange={(e) => setManualInputText(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  placeholder="Escribe aquí la definición del concepto..."
                  rows={4}
                  autoFocus
                />
                <div className="manual-input-actions">
                  <button 
                    className="btn btn-outline"
                    onClick={() => {
                      setShowManualInput(false);
                      setManualInputText('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleManualSubmit}
                    disabled={!manualInputText.trim()}
                  >
                    Enviar Respuesta
                  </button>
                </div>
              </div>
            )}
          </div>
        )}


        {practiceState === 'processing' && (
          <div className="voice-processing">
            <div className="processing-icon">
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
            <p>Evaluando tu respuesta...</p>
            <p className="transcript-preview">
              <strong>Dijiste:</strong> "{userTranscript}"
            </p>
          </div>
        )}

        {practiceState === 'feedback' && comparisonResult && (
          <div className="voice-feedback">
            <div className={`feedback-result ${comparisonResult.isCorrect ? 'correct' : 'incorrect'}`}>
              <div className="result-icon">
                <FontAwesomeIcon 
                  icon={comparisonResult.isCorrect ? faCheckCircle : faTimesCircle} 
                />
              </div>
              <h3>{comparisonResult.isCorrect ? '¡Correcto!' : 'Incorrecto'}</h3>
              <div className="score-display">
                <span className="score-label">Similitud</span>
                <span className="score-number">{comparisonResult.score}%</span>
              </div>
            </div>

            <div className="feedback-details">
              <div className="user-response">
                <h4>Tu Respuesta:</h4>
                <p>"{userTranscript}"</p>
              </div>
            </div>

            <div className="feedback-actions">
              <button 
                className="btn btn-outline"
                onClick={() => {
                  // Move concept to end of queue (same as "No lo sé")
                  onRetry();
                  // Reset state for next concept
                  setShowDefinition(false);
                  setGaveUp(false);
                  setPracticeState('ready');
                  setUserTranscript('');
                  setComparisonResult(null);
                  setError(null);
                  setShowManualInput(false);
                  setManualInputText('');
                  setIsSpeaking(false);
                  if ('speechSynthesis' in window) {
                    speechSynthesis.cancel();
                  }
                }}
              >
                Intentar de Nuevo
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleNext}
              >
                <FontAwesomeIcon icon={faArrowRight} />
                {isLastConcept ? 'Ver Resultados' : 'Siguiente Concepto'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="error-toast">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoicePracticeSession;