import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import '../styles/VoiceSettings.css';

const VoiceSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [autoRead, setAutoRead] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [testText, setTestText] = useState<string>("Esto es una prueba de cómo sonará la voz seleccionada.");

  // Cargar configuraciones guardadas del usuario
  useEffect(() => {
    const loadUserSettings = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }

      try {
        // Usamos la ruta adecuada - la misma que usa la función loadVoiceSettings en otros componentes
        const userSettingsRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'voice');
        const settingsDoc = await getDoc(userSettingsRef);
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.voiceName) setSelectedVoice(data.voiceName);
          if (data.rate) setRate(data.rate);
          if (data.pitch) setPitch(data.pitch);
          if (data.volume) setVolume(data.volume);
          if (data.autoRead !== undefined) setAutoRead(data.autoRead);
        }
      } catch (error) {
        console.error("Error loading voice settings:", error);
        // También guardamos en localStorage como respaldo
        const localSettings = localStorage.getItem('voiceSettings');
        if (localSettings) {
          try {
            const data = JSON.parse(localSettings);
            if (data.voiceName) setSelectedVoice(data.voiceName);
            if (data.rate) setRate(data.rate);
            if (data.pitch) setPitch(data.pitch);
            if (data.volume) setVolume(data.volume);
            if (data.autoRead !== undefined) setAutoRead(data.autoRead);
          } catch (e) {
            console.error("Error parsing local voice settings:", e);
          }
        }
      }
    };

    loadUserSettings();
  }, [navigate]);

  // Cargar voces disponibles
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setIsLoading(false);
      return;
    }
    
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      
      // Si no hay voz seleccionada, intentar encontrar voz de español de España (Simón)
      if (!selectedVoice) {
        // Primero intentamos encontrar la voz de español de España (Google)
        const simonVoice = voices.find(voice => 
          voice.lang === 'es-ES' && 
          voice.name.includes('Google') && 
          !voice.name.includes('Microsoft')
        );
        
        // Si encontramos la voz de Simón, la seleccionamos
        if (simonVoice) {
          setSelectedVoice(simonVoice.name);
        } else {
          // Como respaldo, buscamos cualquier voz en español
          const spanishVoice = voices.find(voice => 
            voice.lang.includes('es') && 
            voice.name.includes('Google') && 
            !voice.name.includes('Microsoft')
          );
          
          if (spanishVoice) {
            setSelectedVoice(spanishVoice.name);
          } else if (voices.length > 0) {
            setSelectedVoice(voices[0].name);
          }
        }
      }
      
      setIsLoading(false);
    };
    
    // Cargar las voces inmediatamente
    loadVoices();
    
    // Compatibilidad con diferentes navegadores
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoice]);

  const saveSettings = async () => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    setIsSaving(true);
    
    const voiceSettings = {
      voiceName: selectedVoice,
      rate,
      pitch,
      volume,
      autoRead,
      updatedAt: new Date()
    };
    
    try {
      // Guardar en localStorage como respaldo
      localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
      
      // Usar la misma estructura que en ConceptDetail.tsx - loadVoiceSettings
      const userSettingsRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'voice');
      
      // Guardar configuraciones
      await setDoc(userSettingsRef, voiceSettings);
      
      setSaveSuccess(true);
      
      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error saving voice settings:", error);
      alert("La configuración se guardó localmente, pero hubo un error al guardar en la nube. Tus ajustes funcionarán en este dispositivo.");
    } finally {
      setIsSaving(false);
    }
  };

  const testVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    // Cancelar cualquier síntesis de voz anterior
    window.speechSynthesis.cancel();
    
    // Crear y configurar el objeto utterance para la prueba
    const utterance = new SpeechSynthesisUtterance(testText);
    
    // Buscar la voz seleccionada
    const voice = availableVoices.find(v => v.name === selectedVoice);
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    
    // Empezar a hablar
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVoice(e.target.value);
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value);
    setRate(newRate);
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPitch = parseFloat(e.target.value);
    setPitch(newPitch);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const handleAutoReadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoRead(e.target.checked);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando configuraciones de voz...</p>
      </div>
    );
  }

  return (
    <div className="voice-settings-container">
      <header className="voice-settings-header">
        <div className="header-content">
          <button 
            onClick={() => navigate('/notebooks')}
            className="back-button"
          >
            <i className="fas fa-arrow-left"></i> 
          </button>
          <h1>Configuración de Voz</h1>
        </div>
      </header>
      
      <main className="voice-settings-main">
        <div className="settings-card">
          <div className="settings-section">
            <h2>Voz y Pronunciación</h2>
            <p className="section-description">Personaliza cómo Simonkey lee tus conceptos y notas.</p>
            
            <div className="form-group">
              <label htmlFor="voice-select">Selecciona una voz:</label>
              <select 
                id="voice-select" 
                value={selectedVoice} 
                onChange={handleVoiceChange}
                className="voice-select"
              >
                {availableVoices
                  .filter(voice => voice.lang.includes('es') && voice.name.includes('Google') && !voice.name.includes('Microsoft'))
                  .map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.lang === 'es-ES' ? 'Simón' : 
                       voice.lang === 'es-US' ? 'Simona' : 
                       voice.name} {voice.default ? '(Default)' : ''}
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="rate-range">Velocidad: {rate.toFixed(1)}x</label>
              <input
                id="rate-range"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rate}
                onChange={handleRateChange}
                className="range-input"
              />
              <div className="range-labels">
                <span>Lento</span>
                <span>Normal</span>
                <span>Rápido</span>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="pitch-range">Tono: {pitch.toFixed(1)}</label>
              <input
                id="pitch-range"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={pitch}
                onChange={handlePitchChange}
                className="range-input"
              />
              <div className="range-labels">
                <span>Grave</span>
                <span>Normal</span>
                <span>Agudo</span>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="volume-range">Volumen: {(volume * 100).toFixed(0)}%</label>
              <input
                id="volume-range"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="range-input"
              />
              <div className="range-labels">
                <span>Bajo</span>
                <span>Medio</span>
                <span>Alto</span>
              </div>
            </div>
            
            <div className="form-group checkbox-group">
              <input
                id="auto-read"
                type="checkbox"
                checked={autoRead}
                onChange={handleAutoReadChange}
                className="checkbox-input"
              />
              <label htmlFor="auto-read">Leer automáticamente al abrir un concepto</label>
            </div>
          </div>
          
          <div className="settings-section">
            <h2>Probar configuración</h2>
            <p className="section-description">Escucha cómo sonará la voz con la configuración actual.</p>
            
            <div className="form-group">
              <label htmlFor="test-text">Texto de prueba:</label>
              <textarea
                id="test-text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={3}
                className="test-text-input"
              />
            </div>
            
            <button 
              onClick={testVoice}
              className="test-voice-button"
            >
              <i className="fas fa-volume-up"></i> Probar voz
            </button>
          </div>
          
          <div className="settings-actions">
            {saveSuccess && (
              <div className="save-success-message">
                <i className="fas fa-check-circle"></i> Configuración guardada correctamente
              </div>
            )}
            
            <div className="action-buttons">
              <button 
                onClick={() => navigate('/notebooks')}
                className="cancel-button"
              >
                <i className="fas fa-times"></i> Cancelar
              </button>
              
              <button 
                onClick={saveSettings}
                className="save-button"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="spinner-small"></div> Guardando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i> Guardar configuración
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VoiceSettingsPage;