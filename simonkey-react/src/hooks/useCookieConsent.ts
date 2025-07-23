import { useState, useEffect, useCallback, useRef } from 'react';

export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

interface CookieConsentData {
  preferences: CookiePreferences;
  timestamp: number;
  version: string; // Para manejar cambios en la política
}

const COOKIE_CONSENT_KEY = 'simonkey_cookie_consent';
const CONSENT_VERSION = '1.0';

// Configuración por defecto
const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,    // Siempre necesarias
  analytics: false,   // Analytics de rendimiento
  marketing: false,   // Cookies de marketing (no usamos actualmente)
  preferences: false  // Recordar preferencias del usuario
};

export const useCookieConsent = () => {
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);
  const [hasConsent, setHasConsent] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  // Cargar preferencias guardadas al inicializar
  useEffect(() => {
    loadSavedPreferences();
  }, []);

  const loadSavedPreferences = useCallback(() => {
    try {
      const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (saved) {
        const consentData: CookieConsentData = JSON.parse(saved);
        
        // Verificar si la versión es actual
        if (consentData.version === CONSENT_VERSION) {
          setPreferences(consentData.preferences);
          setHasConsent(true);
          setIsVisible(false);
          
          // Aplicar las preferencias guardadas
          applyCookiePreferences(consentData.preferences);
        } else {
          // Nueva versión, mostrar banner nuevamente
          setIsVisible(true);
        }
      } else {
        // No hay consentimiento previo
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Error loading cookie preferences:', error);
      setIsVisible(true);
    }
  }, []);

  const savePreferences = useCallback((newPreferences: CookiePreferences) => {
    try {
      const consentData: CookieConsentData = {
        preferences: newPreferences,
        timestamp: Date.now(),
        version: CONSENT_VERSION
      };
      
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
      setPreferences(newPreferences);
      setHasConsent(true);
      setIsVisible(false);
      
      // Aplicar las nuevas preferencias
      applyCookiePreferences(newPreferences);
      
      // Disparar evento personalizado para otros componentes
      window.dispatchEvent(new CustomEvent('cookieConsentChanged', {
        detail: newPreferences
      }));
      
    } catch (error) {
      console.error('Error saving cookie preferences:', error);
    }
  }, []);

  const applyCookiePreferences = useCallback((prefs: CookiePreferences) => {
    // Limpiar cookies no esenciales si no están permitidas
    if (!prefs.analytics) {
      clearAnalyticsCookies();
    }
    
    if (!prefs.marketing) {
      clearMarketingCookies();
    }
    
    if (!prefs.preferences) {
      clearPreferenceCookies();
    }
    
    // Configurar servicios según las preferencias
    configureAnalytics(prefs.analytics);
    configureMarketing(prefs.marketing);
  }, []);

  const clearAnalyticsCookies = () => {
    // Limpiar cookies de analytics específicas
    const analyticsCookies = [
      '_ga', '_ga_*', '_gid', '_gat', '_gtag_*',
      'firebase-analytics-*'
    ];
    
    analyticsCookies.forEach(cookieName => {
      if (cookieName.includes('*')) {
        // Buscar cookies que coincidan con el patrón
        const pattern = cookieName.replace('*', '');
        document.cookie.split(';').forEach(cookie => {
          const name = cookie.trim().split('=')[0];
          if (name.startsWith(pattern)) {
            deleteCookie(name);
          }
        });
      } else {
        deleteCookie(cookieName);
      }
    });
  };

  const clearMarketingCookies = () => {
    // Limpiar cookies de marketing (Facebook, Google Ads, etc.)
    const marketingCookies = [
      '_fbp', '_fbc', 'fr', 'tr',
      'ads-id', 'google-ads-*'
    ];
    
    marketingCookies.forEach(cookieName => {
      if (cookieName.includes('*')) {
        const pattern = cookieName.replace('*', '');
        document.cookie.split(';').forEach(cookie => {
          const name = cookie.trim().split('=')[0];
          if (name.startsWith(pattern)) {
            deleteCookie(name);
          }
        });
      } else {
        deleteCookie(cookieName);
      }
    });
  };

  const clearPreferenceCookies = () => {
    // Limpiar cookies de preferencias no esenciales
    const preferenceCookies = [
      'user-theme', 'user-language', 'user-settings'
    ];
    
    preferenceCookies.forEach(deleteCookie);
  };

  const deleteCookie = (name: string) => {
    // Eliminar cookie en diferentes rutas y dominios
    const domains = ['', `.${window.location.hostname}`];
    const paths = ['/', '/notebooks', '/study'];
    
    domains.forEach(domain => {
      paths.forEach(path => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; domain=${domain}`;
      });
    });
  };

  // Cache para evitar logs repetidos
  const analyticsState = useRef<boolean | null>(null);
  
  const configureAnalytics = (enabled: boolean) => {
    // Solo configurar si el estado cambió
    if (analyticsState.current === enabled) {
      return;
    }
    analyticsState.current = enabled;
    
    // Configurar Google Analytics u otros servicios de análisis
    if (typeof window !== 'undefined') {
      if (enabled) {
        // Habilitar analytics silenciosamente
        // Aquí se habilitaría Google Analytics cuando se implemente
      } else {
        // Deshabilitar analytics
        // Deshabilitar tracking
        if (typeof (window as any).gtag === 'function') {
          (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        }
      }
    }
  };

  // Cache para evitar logs repetidos
  const marketingState = useRef<boolean | null>(null);
  
  const configureMarketing = (enabled: boolean) => {
    // Solo configurar si el estado cambió
    if (marketingState.current === enabled) {
      return;
    }
    marketingState.current = enabled;
    
    // Configurar servicios de marketing silenciosamente
    // Los logs se removieron para evitar spam
  };

  const giveConsent = useCallback((newPreferences: CookiePreferences) => {
    // Asegurar que las cookies esenciales siempre estén habilitadas
    const finalPreferences = {
      ...newPreferences,
      essential: true
    };
    
    savePreferences(finalPreferences);
  }, [savePreferences]);

  const revokeConsent = useCallback(() => {
    // Revocar todo excepto esenciales
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      preferences: false
    };
    
    savePreferences(essentialOnly);
  }, [savePreferences]);

  const rejectAll = useCallback(() => {
    revokeConsent();
  }, [revokeConsent]);

  const updatePreference = useCallback((category: keyof CookiePreferences, value: boolean) => {
    if (category === 'essential') {
      // No permitir deshabilitar cookies esenciales
      return;
    }
    
    const newPreferences = {
      ...preferences,
      [category]: value
    };
    
    savePreferences(newPreferences);
  }, [preferences, savePreferences]);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    setPreferences(DEFAULT_PREFERENCES);
    setHasConsent(false);
    setIsVisible(true);
    
    // Limpiar todas las cookies no esenciales
    clearAnalyticsCookies();
    clearMarketingCookies();
    clearPreferenceCookies();
  }, []);

  const getConsentData = useCallback(() => {
    try {
      const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  return {
    preferences,
    hasConsent,
    isVisible,
    giveConsent,
    revokeConsent,
    rejectAll,
    updatePreference,
    resetConsent,
    getConsentData,
    // Helpers
    isAnalyticsEnabled: preferences.analytics,
    isMarketingEnabled: preferences.marketing,
    isPreferencesEnabled: preferences.preferences
  };
};