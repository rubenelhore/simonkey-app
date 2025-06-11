import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../services/firebase';
import { loadVoiceSettings, VoiceSettings, defaultVoiceSettings } from '../hooks/voiceService';

interface TextToSpeechProps {
  text: string;
  language?: string;
  buttonClassName?: string;
  iconOnly?: boolean;
}

const TextToSpeech: React.FC<TextToSpeechProps> = ({
  text,
  language = 'es-MX',
  buttonClassName = '',
  iconOnly = false
}) => {
  // Estados
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechSynthesis, setSpeechSynthesis] = useState<SpeechSynthesis | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [userSettings, setUserSettings] = useState<VoiceSettings>(defaultVoiceSettings);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Referencias para evitar problemas de clausuras (closures)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const textRef = useRef(text);
  const isPlayingRef = useRef(isPlaying);
  const isPausedRef = useRef(isPaused);

  // Actualizar referencias cuando los estados cambian
  useEffect(() => {
    textRef.current = text;
    isPlayingRef.current = isPlaying;
    isPausedRef.current = isPaused;
  }, [text, isPlaying, isPaused]);

  // Cargar configuraciones de voz del usuario cuando el componente se monta
  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        if (auth.currentUser) {
          const settings = await loadVoiceSettings();
          console.log("Voice settings loaded:", settings);
          setUserSettings(settings);
        } else {
          console.log("Using default voice settings (no user)");
        }
        setSettingsLoaded(true);
      } catch (error) {
        console.error("Error loading voice settings:", error);
        setSettingsLoaded(true);
      }
    };

    fetchUserSettings();
  }, []);

  // Inicializar speech synthesis y evento para carga de voces
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setSpeechSynthesis(window.speechSynthesis);
      
      // Cargar voces iniciales
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log("Available voices:", voices.length);
        
        if (voices.length > 0) {
          setAvailableVoices(voices);
          setVoicesLoaded(true);
        }
      };
      
      // Intentar cargar inmediatamente
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        setVoicesLoaded(true);
      }
      
      // Y también suscribirse al evento onvoiceschanged
      window.speechSynthesis.onvoiceschanged = loadVoices;
      
      // Limpiar al desmontar
      return () => {
        window.speechSynthesis.cancel();
        // Limpiar el evento
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Función para encontrar la mejor voz disponible según preferencias
  const findBestVoice = (): SpeechSynthesisVoice | null => {
    if (!availableVoices.length) return null;
    
    // 1. Intentar encontrar la voz configurada por el usuario
    if (userSettings.voiceName) {
      const selectedVoice = availableVoices.find(voice => voice.name === userSettings.voiceName);
      if (selectedVoice) return selectedVoice;
    }
    
    // 2. Intentar encontrar una voz de español (España - Simón)
    const spanishVoice = availableVoices.find(voice => 
      voice.lang === 'es-ES' && 
      voice.name.includes('Google') && 
      !voice.name.includes('Microsoft')
    );
    if (spanishVoice) return spanishVoice;
    
    // 3. Buscar cualquier voz española
    const anySpanishVoice = availableVoices.find(voice => voice.lang.includes('es'));
    if (anySpanishVoice) return anySpanishVoice;
    
    // 4. Usar la primera voz disponible como último recurso
    return availableVoices[0];
  };

  // Crear un nuevo utterance cuando cambia el texto, las configuraciones o las voces disponibles
  useEffect(() => {
    // No proceder si no hay síntesis de voz o si las voces aún no están cargadas
    if (!speechSynthesis || !voicesLoaded || !settingsLoaded) {
      return;
    }
    
    // Cancelar cualquier utterance anterior
    if (utteranceRef.current && isPlayingRef.current) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
    
    // Crear nuevo utterance con el texto actual
    const newUtterance = new SpeechSynthesisUtterance(text);
    
    // Configurar con los ajustes del usuario
    newUtterance.rate = userSettings.rate;
    newUtterance.pitch = userSettings.pitch;
    newUtterance.volume = userSettings.volume;
    newUtterance.lang = language;
    
    // Encontrar la mejor voz disponible
    const bestVoice = findBestVoice();
    if (bestVoice) {
      newUtterance.voice = bestVoice;
      console.log("Using voice:", bestVoice.name);
    } else {
      console.warn("No suitable voice found");
    }
    
    // Configurar eventos para tracking del estado
    newUtterance.onend = () => {
      console.log("Speech ended");
      setIsPlaying(false);
      setIsPaused(false);
    };
    
    newUtterance.onpause = () => {
      console.log("Speech paused");
      setIsPaused(true);
    };
    
    newUtterance.onresume = () => {
      console.log("Speech resumed");
      setIsPaused(false);
    };
    
    // Guardar en la referencia
    utteranceRef.current = newUtterance;
    
    console.log("New utterance created with settings:", {
      rate: newUtterance.rate,
      pitch: newUtterance.pitch,
      volume: newUtterance.volume,
      voice: newUtterance.voice?.name || "No voice selected",
      lang: newUtterance.lang
    });
    
  }, [text, language, speechSynthesis, availableVoices, userSettings, voicesLoaded, settingsLoaded]);

  const toggleSpeech = () => {
    if (!speechSynthesis || !utteranceRef.current) {
      console.error("Speech synthesis not available or utterance not created");
      // Intentamos inicializar nuevamente si no está listo
      if (voicesLoaded && speechSynthesis) {
        const bestVoice = findBestVoice();
        const tempUtterance = new SpeechSynthesisUtterance(text);
        tempUtterance.rate = userSettings.rate;
        tempUtterance.pitch = userSettings.pitch;
        tempUtterance.volume = userSettings.volume;
        tempUtterance.lang = language;
        
        if (bestVoice) {
          tempUtterance.voice = bestVoice;
        }
        
        utteranceRef.current = tempUtterance;
        speechSynthesis.speak(tempUtterance);
        setIsPlaying(true);
      }
      return;
    }
    
    if (isPlaying) {
      if (isPaused) {
        console.log("Resuming speech");
        speechSynthesis.resume();
        setIsPaused(false);
      } else {
        console.log("Pausing speech");
        speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      // Cancelar cualquier síntesis de voz anterior
      speechSynthesis.cancel();
      
      console.log("Starting speech with settings:", {
        rate: utteranceRef.current.rate,
        pitch: utteranceRef.current.pitch,
        volume: utteranceRef.current.volume,
        voice: utteranceRef.current.voice?.name || "No voice selected"
      });
      
      // Comenzar a hablar
      speechSynthesis.speak(utteranceRef.current);
      setIsPlaying(true);
      setIsPaused(false);
    }
  };

  const stopSpeech = () => {
    if (!speechSynthesis) return;
    
    console.log("Stopping speech");
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  // Determinar el ícono a mostrar según el estado
  const renderIcon = () => {
    if (isPlaying && !isPaused) {
      return <i className="fas fa-pause"></i>;
    }
    if (isPlaying && isPaused) {
      return <i className="fas fa-play"></i>;
    }
    return <i className="fas fa-volume-up"></i>;
  };

  // Determinar el estado de habilitación del botón
  const isButtonDisabled = !voicesLoaded || !speechSynthesis;

  return (
    <div className="text-to-speech-controls">
      <button
        onClick={toggleSpeech}
        className={`text-to-speech-button ${buttonClassName} ${isPlaying ? 'playing' : ''}`}
        title={isButtonDisabled ? 'Cargando voces...' : (isPlaying ? (isPaused ? 'Continuar' : 'Pausar') : 'Leer en voz alta')}
        disabled={isButtonDisabled}
      >
        {renderIcon()}
        {!iconOnly && (
          <span className="button-text">
            {isButtonDisabled ? 'Cargando...' : (isPlaying ? (isPaused ? 'Continuar' : 'Pausar') : 'Leer')}
          </span>
        )}
      </button>
      
      {isPlaying && (
        <button
          onClick={stopSpeech}
          className="text-to-speech-stop"
          title="Detener"
        >
          <i className="fas fa-stop"></i>
        </button>
      )}
    </div>
  );
};

export default TextToSpeech;