import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMicrophone, 
  faStop, 
  faVolumeUp, 
  faArrowRight, 
  faCheckCircle, 
  faTimesCircle,
  faSpinner
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
}

type PracticeState = 'ready' | 'listening' | 'processing' | 'feedback';

const VoicePracticeSession: React.FC<VoicePracticeSessionProps> = ({
  concepts,
  currentConceptIndex,
  onResult,
  onRetry,
  onBack
}) => {
  const [practiceState, setPracticeState] = useState<PracticeState>('ready');
  const [userTranscript, setUserTranscript] = useState('');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [microphonePermission, setMicrophonePermission] = useState<boolean | null>(null);
  const [listeningTimer, setListeningTimer] = useState(0);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInputText, setManualInputText] = useState('');
  
  const currentConcept = concepts[currentConceptIndex];
  const isLastConcept = currentConceptIndex === concepts.length - 1;

  // Verificar permisos de micrófono al montar
  useEffect(() => {
    checkMicrophoneSetup();
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
      const utterance = new SpeechSynthesisUtterance(currentConcept.definition);
      utterance.lang = 'es-ES';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  const getListeningStatusText = () => {
    if (listeningTimer < 5) return 'Escuchando...';
    if (listeningTimer < 10) return 'Sigue hablando...';
    return 'Procesando respuesta...';
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
      <div className="practice-header">
        <div className="progress-info">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${((currentConceptIndex + 1) / concepts.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="concept-display">
        <div className="concept-header">
          <div className="concept-number">
            {currentConceptIndex + 1}/{concepts.length}
          </div>
          <h2 className="concept-title">
            <span className="concept-highlight">{currentConcept.concept}</span>
          </h2>
        </div>
        
        {practiceState === 'feedback' && (
          <div className="definition-section">
            <div className="definition-container">
              <p className="definition-text">{currentConcept.definition}</p>
              <button 
                className="speak-button"
                onClick={speakDefinition}
                title="Escuchar definición"
              >
                <FontAwesomeIcon icon={faVolumeUp} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="voice-interaction">
        {practiceState === 'ready' && (
          <div className="voice-ready">
            <h3>¡Tu turno!</h3>
            <p>Di la definición de este concepto</p>
            
            {!showManualInput ? (
              <>
                <button 
                  className="mic-button ready"
                  onClick={startListening}
                  disabled={!microphonePermission}
                >
                  <FontAwesomeIcon icon={faMicrophone} />
                  <span>Comenzar a Hablar</span>
                </button>
                
                <div className="alternative-input">
                  <p>¿No puedes usar el micrófono?</p>
                  <button 
                    className="btn btn-outline"
                    onClick={() => setShowManualInput(true)}
                  >
                    Escribir Respuesta
                  </button>
                </div>
              </>
            ) : (
              <div className="manual-input-section">
                <h4>Escribe la definición:</h4>
                <textarea
                  className="manual-input-textarea"
                  value={manualInputText}
                  onChange={(e) => setManualInputText(e.target.value)}
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

        {practiceState === 'listening' && (
          <div className="voice-listening">
            <div className="listening-animation">
              <div className="mic-icon-animated">
                <FontAwesomeIcon icon={faMicrophone} />
              </div>
              <div className="sound-waves">
                <div className="wave"></div>
                <div className="wave"></div>
                <div className="wave"></div>
              </div>
            </div>
            <p className="listening-status">{getListeningStatusText()}</p>
            <button 
              className="stop-button"
              onClick={stopListening}
            >
              <FontAwesomeIcon icon={faStop} />
              Detener
            </button>
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
                <span className="score-number">{comparisonResult.score}%</span>
                <span className="score-label">Puntuación</span>
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
                  // Reset local state
                  setPracticeState('ready');
                  setUserTranscript('');
                  setComparisonResult(null);
                  setError(null);
                  setShowManualInput(false);
                  setManualInputText('');
                  // Move concept to end of queue and go to next
                  onRetry();
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
        <div className="error-message">
          <p>{error}</p>
          <button 
            className="btn btn-outline"
            onClick={() => setError(null)}
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
};

export default VoicePracticeSession;