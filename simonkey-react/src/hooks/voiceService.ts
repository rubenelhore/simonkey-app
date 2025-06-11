import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Interfaz para las configuraciones de voz
export interface VoiceSettings {
  voiceName: string;
  rate: number;
  pitch: number;
  volume: number;
  autoRead: boolean;
}

// Configuraciones por defecto mejoradas
export const defaultVoiceSettings: VoiceSettings = {
  voiceName: '',  // Se asignará dinámicamente la primera voz española disponible
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoRead: false
};

// Caché en memoria para las configuraciones de voz - Corregido con tipo explícito
let voiceSettingsCache: VoiceSettings | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minuto de caché

/**
 * Carga las configuraciones de voz del usuario actual
 */
export const loadVoiceSettings = async (): Promise<VoiceSettings> => {
  // Si hay un usuario autenticado
  if (auth.currentUser) {
    const now = Date.now();
    
    // Si tenemos settings en caché y son recientes, usarlos
    if (voiceSettingsCache && now - lastFetchTime < CACHE_DURATION) {
      console.log("Using cached voice settings");
      return voiceSettingsCache;
    }
    
    try {
      // Obtener desde Firestore
      const userSettingsRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'voice');
      const settingsSnap = await getDoc(userSettingsRef);
      
      if (settingsSnap.exists()) {
        // Actualizar caché - Convertir DocumentData a VoiceSettings
        const data = settingsSnap.data();
        const typedSettings: VoiceSettings = {
          voiceName: data.voiceName || defaultVoiceSettings.voiceName,
          rate: data.rate ?? defaultVoiceSettings.rate,
          pitch: data.pitch ?? defaultVoiceSettings.pitch,
          volume: data.volume ?? defaultVoiceSettings.volume,
          autoRead: data.autoRead ?? defaultVoiceSettings.autoRead
        };
        
        voiceSettingsCache = typedSettings;
        lastFetchTime = now;
        return voiceSettingsCache;
      }
      
      // Si no existen en Firestore, intentar desde localStorage
      const localSettings = localStorage.getItem('voiceSettings');
      if (localSettings) {
        try {
          const parsedSettings = JSON.parse(localSettings);
          // Asegurar que el objeto tenga la estructura correcta
          const typedSettings: VoiceSettings = {
            voiceName: parsedSettings.voiceName || defaultVoiceSettings.voiceName,
            rate: parsedSettings.rate ?? defaultVoiceSettings.rate,
            pitch: parsedSettings.pitch ?? defaultVoiceSettings.pitch,
            volume: parsedSettings.volume ?? defaultVoiceSettings.volume,
            autoRead: parsedSettings.autoRead ?? defaultVoiceSettings.autoRead
          };
          
          voiceSettingsCache = typedSettings;
          lastFetchTime = now;
          return voiceSettingsCache;
        } catch (e) {
          console.error("Error parsing voice settings from localStorage:", e);
        }
      }
    } catch (error) {
      console.error("Error loading voice settings from Firestore:", error);
      
      // Intentar cargar desde localStorage como respaldo
      const localSettings = localStorage.getItem('voiceSettings');
      if (localSettings) {
        try {
          const parsedSettings = JSON.parse(localSettings);
          // Asegurar que el objeto tenga la estructura correcta
          const typedSettings: VoiceSettings = {
            voiceName: parsedSettings.voiceName || defaultVoiceSettings.voiceName,
            rate: parsedSettings.rate ?? defaultVoiceSettings.rate,
            pitch: parsedSettings.pitch ?? defaultVoiceSettings.pitch,
            volume: parsedSettings.volume ?? defaultVoiceSettings.volume,
            autoRead: parsedSettings.autoRead ?? defaultVoiceSettings.autoRead
          };
          
          voiceSettingsCache = typedSettings;
          lastFetchTime = now;
          return voiceSettingsCache;
        } catch (e) {
          console.error("Error parsing voice settings from localStorage:", e);
        }
      }
    }
  }
  
  // Devolver valores predeterminados si no hay datos en caché
  return { ...defaultVoiceSettings };
};

/**
 * Guarda las configuraciones de voz del usuario actual
 */
export const saveVoiceSettings = async (settings: VoiceSettings): Promise<boolean> => {
  // Siempre guardar en localStorage como respaldo
  try {
    localStorage.setItem('voiceSettings', JSON.stringify(settings));
  } catch (e) {
    console.error("Error saving to localStorage:", e);
  }
  
  // Verificar que haya un usuario autenticado
  if (!auth.currentUser) {
    console.error("No user authenticated");
    return false;
  }
  
  try {
    const userSettingsRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'voice');
    
    await setDoc(userSettingsRef, {
      ...settings,
      updatedAt: new Date()
    });
    
    // Actualizar la caché
    voiceSettingsCache = { ...settings };
    lastFetchTime = Date.now();
    
    return true;
  } catch (error) {
    console.error("Error saving voice settings:", error);
    return false;
  }
};

/**
 * Obtiene la mejor voz disponible según el idioma preferido
 */
export const getBestVoice = (preferredLanguage = 'es'): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return null;
  }
  
  const voices = window.speechSynthesis.getVoices();
  
  // Buscar voces que coincidan con el idioma preferido
  const matchingVoices = voices.filter(voice => 
    voice.lang.toLowerCase().startsWith(preferredLanguage.toLowerCase())
  );
  
  // Si hay voces que coinciden, priorizar la voz por defecto del sistema
  const defaultVoice = matchingVoices.find(voice => voice.default);
  if (defaultVoice) return defaultVoice;
  
  // Si no hay voz por defecto, usar la primera voz que coincide
  if (matchingVoices.length > 0) return matchingVoices[0];
  
  // Si no hay voces que coincidan, usar cualquier voz por defecto
  const anyDefaultVoice = voices.find(voice => voice.default);
  if (anyDefaultVoice) return anyDefaultVoice;
  
  // En último caso, usar la primera voz disponible
  return voices.length > 0 ? voices[0] : null;
};

/**
 * Limpiar la caché de configuraciones
 */
export const clearVoiceSettingsCache = (): void => {
  voiceSettingsCache = null;
  lastFetchTime = 0;
};

// Exportar todas las funciones y tipos
export default {
  loadVoiceSettings,
  saveVoiceSettings,
  getBestVoice,
  defaultVoiceSettings,
  clearVoiceSettingsCache
};