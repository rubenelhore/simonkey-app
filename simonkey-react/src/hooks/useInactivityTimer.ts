import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

interface UseInactivityTimerProps {
  timeoutMinutes?: number; // Tiempo en minutos antes del logout automático
  onTimeout?: () => void; // Callback opcional cuando se agota el tiempo
  enabled?: boolean; // Si el timer está habilitado
}

export const useInactivityTimer = ({
  timeoutMinutes = 3,
  onTimeout,
  enabled = true
}: UseInactivityTimerProps = {}) => {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gracePeriodRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isInGracePeriod, setIsInGracePeriod] = useState<boolean>(false);
  const [isFullyLoggedIn, setIsFullyLoggedIn] = useState<boolean>(false);
  const [isTimerInitialized, setIsTimerInitialized] = useState<boolean>(false);

  // Referencia para evitar agregar event listeners múltiples veces
  const eventListenersAddedRef = useRef(false);

  // Función para manejar el logout automático
  const handleAutoLogout = useCallback(async () => {
    try {
      console.log('🚪 === INICIANDO LOGOUT AUTOMÁTICO ===');
      console.log('⏰ Motivo: Inactividad del usuario');
      console.log('👤 Usuario actual:', auth.currentUser?.email);
      
      // Verificar si hay usuario autenticado
      if (!auth.currentUser) {
        console.log('⚠️ No hay usuario autenticado, redirigiendo a login');
        navigate('/login');
        return;
      }

      // Limpiar timers
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (gracePeriodRef.current) {
        clearTimeout(gracePeriodRef.current);
        gracePeriodRef.current = null;
      }
      setTimeRemaining(0);
      setIsInGracePeriod(false);
      
      // Limpiar localStorage
      localStorage.removeItem('userSession');
      localStorage.removeItem('lastActivity');
      localStorage.removeItem('hasCompletedOnboarding');
      
      console.log('🧹 LocalStorage limpiado');
      
      // Cerrar sesión en Firebase
      console.log('🔥 Cerrando sesión en Firebase...');
      await signOut(auth);
      console.log('✅ Sesión cerrada en Firebase');
      
      // Redirigir a la página de login
      console.log('🔄 Redirigiendo a login...');
      navigate('/login', { replace: true });
      
      // Mostrar mensaje al usuario
      setTimeout(() => {
        alert('Sesión cerrada automáticamente por inactividad. Por favor, inicia sesión nuevamente.');
      }, 100);
      
      console.log('✅ Logout automático completado exitosamente');
      
    } catch (error) {
      console.error('❌ Error durante logout automático:', error);
      
      // Limpiar localStorage de todas formas
      localStorage.removeItem('userSession');
      localStorage.removeItem('lastActivity');
      localStorage.removeItem('hasCompletedOnboarding');
      
      // Aún así redirigir a login
      navigate('/login', { replace: true });
      
      // Mostrar mensaje de error
      setTimeout(() => {
        alert('Error durante el logout automático. Por favor, inicia sesión nuevamente.');
      }, 100);
    }
  }, [navigate]);

  // Función para iniciar el timer principal (después del período de gracia)
  const startMainTimer = useCallback(() => {
    console.log('⏰ Iniciando timer principal de inactividad');
    
    // Limpiar timers existentes para evitar duplicados
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    
    // Configurar timer de advertencia (1 minuto antes del logout)
    const warningMs = (timeoutMinutes - 1) * 60 * 1000; // 1 minuto antes
    console.log(`⏰ Configurando advertencia en ${warningMs/1000} segundos`);
    
    warningTimeoutRef.current = setTimeout(() => {
      console.log('⚠️ Mostrando advertencia de inactividad - 1 minuto restante');
      setTimeRemaining(60); // 60 segundos restantes
    }, warningMs);

    // Configurar timer principal
    const timeoutMs = timeoutMinutes * 60 * 1000; // Tiempo total en milisegundos
    console.log(`⏰ Configurando timer principal en ${timeoutMs/1000} segundos`);
    
    timeoutRef.current = setTimeout(() => {
      console.log(`🕐 Timer de inactividad agotado (${timeoutMinutes} minutos totales)`);
      
      // Ejecutar callback personalizado si existe
      if (onTimeout) {
        onTimeout();
      }

      // Logout automático
      handleAutoLogout();
    }, timeoutMs);

    console.log(`🔄 Timer principal iniciado - ${timeoutMinutes} minutos totales`);
  }, [timeoutMinutes, onTimeout, handleAutoLogout]);

  // Función para resetear el timer - SOLO si el usuario está completamente logueado
  const resetTimer = useCallback(() => {
    if (!enabled || !isFullyLoggedIn) {
      console.log('⏸️ Timer no reseteado - Usuario no completamente logueado:', {
        enabled,
        isFullyLoggedIn
      });
      return;
    }

    // Limpiar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }

    // Actualizar última actividad
    lastActivityRef.current = new Date();

    // Marcar timer como inicializado
    setIsTimerInitialized(true);

    // Solo iniciar período de gracia si es la primera vez
    if (!isInGracePeriod && !gracePeriodRef.current) {
      console.log('🛡️ Iniciando período de gracia inicial de 10 segundos...');
      setIsInGracePeriod(true);
      
      gracePeriodRef.current = setTimeout(() => {
        console.log('🛡️ === PERÍODO DE GRACIA INICIAL TERMINANDO ===');
        setIsInGracePeriod(false);
        gracePeriodRef.current = null;
        console.log('✅ Período de gracia inicial completado, iniciando timer de inactividad');
        
        // Iniciar el timer principal después del período de gracia
        startMainTimer();
      }, 10000); // 10 segundos de gracia inicial
      
      console.log('🔄 Timer de inactividad iniciado con período de gracia inicial - 3 minutos totales');
      console.log('⏰ gracePeriodRef.current configurado:', gracePeriodRef.current);
    } else {
      // Si ya pasó el período de gracia inicial, solo resetear el timer principal
      console.log('🔄 Reseteando timer principal (sin período de gracia)');
      startMainTimer();
    }
  }, [timeoutMinutes, onTimeout, enabled, isFullyLoggedIn, handleAutoLogout, isInGracePeriod, startMainTimer]);

  // Función para pausar el timer
  const pauseTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (gracePeriodRef.current) {
      clearTimeout(gracePeriodRef.current);
      gracePeriodRef.current = null;
    }
    setTimeRemaining(0);
    setIsInGracePeriod(false);
    setIsTimerInitialized(false);
    console.log('⏸️ Timer de inactividad pausado (incluyendo período de gracia)');
  }, []);

  // Función para reanudar el timer
  const resumeTimer = useCallback(() => {
    if (enabled) {
      resetTimer();
    }
  }, [enabled, resetTimer]);

  // Función para obtener el tiempo restante
  const getTimeRemaining = useCallback(() => {
    return timeRemaining;
  }, [timeRemaining]);

  // Función para obtener el estado del período de gracia
  const getGracePeriodStatus = useCallback(() => {
    return isInGracePeriod;
  }, [isInGracePeriod]);

  // Función para obtener el estado de login completo
  const getLoginStatus = useCallback(() => {
    return isFullyLoggedIn;
  }, [isFullyLoggedIn]);

  // Countdown del tiempo restante cuando se muestra la advertencia
  useEffect(() => {
    if (timeRemaining <= 0) {
      console.log('⏸️ Countdown pausado - timeRemaining es 0 o menor');
      return;
    }

    console.log(`⏰ Iniciando countdown desde ${timeRemaining} segundos`);

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newValue = prev <= 1 ? 0 : prev - 1;
        console.log(`⏰ Countdown: ${prev} -> ${newValue} segundos restantes`);
        return newValue;
      });
    }, 1000);

    return () => {
      console.log('🧹 Limpiando countdown interval');
      clearInterval(interval);
    };
  }, [timeRemaining]);

  // Ejecutar logout automático cuando el countdown llega a 0
  useEffect(() => {
    console.log('🔍 Verificando condiciones para logout automático:', {
      timeRemaining,
      enabled,
      isFullyLoggedIn,
      isInGracePeriod,
      isTimerInitialized
    });

    if (timeRemaining === 0 && enabled && isFullyLoggedIn && !isInGracePeriod && isTimerInitialized) {
      // Verificar que haya pasado al menos 1 minuto desde la última actividad
      const timeSinceLastActivity = Date.now() - lastActivityRef.current.getTime();
      const minTimeRequired = 60 * 1000; // 1 minuto mínimo
      
      if (timeSinceLastActivity < minTimeRequired) {
        console.log('⏸️ Logout cancelado - No ha pasado suficiente tiempo desde la última actividad:', {
          timeSinceLastActivity: Math.round(timeSinceLastActivity / 1000) + 's',
          minTimeRequired: Math.round(minTimeRequired / 1000) + 's'
        });
        return;
      }
      
      console.log('⏰ Countdown llegó a 0 - ejecutando logout automático');
      console.log('⏰ Tiempo transcurrido desde última actividad:', Math.round(timeSinceLastActivity / 1000) + 's');
      
      // Ejecutar callback personalizado si existe
      if (onTimeout) {
        onTimeout();
      }

      // Ejecutar logout automático
      handleAutoLogout();
    } else if (timeRemaining === 0) {
      console.log('⏸️ Countdown en 0 pero condiciones no cumplidas para logout');
    }
  }, [timeRemaining, enabled, isFullyLoggedIn, isInGracePeriod, isTimerInitialized, onTimeout, handleAutoLogout]);

  // Eventos que resetean el timer - SOLO interacciones reales con la plataforma
  useEffect(() => {
    if (!enabled) {
      console.log('⏸️ Timer de inactividad pausado - Condiciones no cumplidas:', {
        enabled,
        isAuthenticated: (window as any).firebase?.auth?.currentUser ? true : false,
        pathname: window.location.pathname
      });
      pauseTimer();
      setIsFullyLoggedIn(false);
      eventListenersAddedRef.current = false;
      return;
    }

    console.log('🔄 Timer de inactividad habilitado - Condiciones cumplidas:', {
      enabled,
      pathname: window.location.pathname
    });

    // Marcar que el usuario está completamente logueado después de un retraso
    const loginDelay = setTimeout(() => {
      setIsFullyLoggedIn(true);
      console.log('✅ Usuario marcado como completamente logueado - Timer listo para activarse');
    }, 5000); // 5 segundos de retraso para asegurar estabilidad

    // Agregar un retraso adicional después del login para asegurar estabilidad
    const timerDelay = setTimeout(() => {
      console.log('⏰ Iniciando timer de inactividad después del retraso de login');
      
      // Verificar que el usuario esté completamente logueado antes de agregar event listeners
      if (!isFullyLoggedIn) {
        console.log('⏸️ Usuario no completamente logueado, no agregando event listeners');
        return;
      }

      // Evitar agregar event listeners múltiples veces
      if (eventListenersAddedRef.current) {
        console.log('⏸️ Event listeners ya agregados, saltando...');
        return;
      }
      
      // Solo eventos que indican interacción real con la plataforma
      const events = [
        'click',           // Clicks en botones, enlaces, etc.
        'submit',          // Envío de formularios
        'change',          // Cambios en inputs, selects, etc.
        'focus',           // Enfoque en elementos interactivos
        'scroll',          // Scroll en la página (indica lectura/navegación)
        'touchstart',      // Toques en dispositivos móviles
        'keydown'          // Solo teclas específicas (Enter, Tab, etc.)
      ];

      const handleActivity = (event: Event) => {
        // Verificar si el usuario está completamente logueado antes de procesar actividad
        if (!isFullyLoggedIn) {
          console.log('⏸️ Actividad ignorada - Usuario no completamente logueado');
          return;
        }

        // Verificar que el timer esté inicializado
        if (!isTimerInitialized) {
          console.log('⏸️ Actividad ignorada - Timer no inicializado');
          return;
        }

        // Verificar que el timer esté habilitado
        if (!enabled) {
          console.log('⏸️ Actividad ignorada - Timer deshabilitado');
          return;
        }

        // Verificar si el evento viene de un elemento interactivo de la plataforma
        const target = event.target as HTMLElement;
        
        // Si es un click, verificar que sea en un elemento interactivo
        if (event.type === 'click') {
          const isInteractive = target.tagName === 'BUTTON' || 
                               target.tagName === 'A' || 
                               target.tagName === 'INPUT' || 
                               target.tagName === 'SELECT' || 
                               target.tagName === 'TEXTAREA' ||
                               target.closest('button') ||
                               target.closest('a') ||
                               target.closest('[role="button"]') ||
                               target.closest('[data-interactive]');
          
          if (!isInteractive) {
            return; // No resetear por clicks en elementos no interactivos
          }
        }

        // Para keydown, solo resetear en teclas específicas
        if (event.type === 'keydown') {
          const keyboardEvent = event as KeyboardEvent;
          const importantKeys = [
            'Enter', 'Tab', 'Space', 'Escape', 'ArrowUp', 'ArrowDown', 
            'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'
          ];
          
          // Solo resetear si es una tecla importante
          if (!importantKeys.includes(keyboardEvent.key)) {
            return;
          }
        }

        // Para scroll, solo resetear si es scroll significativo
        if (event.type === 'scroll') {
          // Evitar resetear por scrolls muy pequeños
          const scrollEvent = event as Event;
          const target = scrollEvent.target as Element;
          if (target && target.scrollTop < 10) {
            return;
          }
        }

        // Para focus, solo resetear si es en elementos interactivos
        if (event.type === 'focus') {
          const isInteractive = target.tagName === 'INPUT' || 
                               target.tagName === 'SELECT' || 
                               target.tagName === 'TEXTAREA' ||
                               target.tagName === 'BUTTON' ||
                               target.contentEditable === 'true';
          
          if (!isInteractive) {
            return;
          }
        }

        console.log(`🔄 Actividad detectada: ${event.type} en ${target.tagName}`);
        resetTimer();
        setTimeRemaining(0); // Ocultar advertencia si está visible
      };

      // Limpiar event listeners existentes antes de agregar nuevos
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });

      // Agregar event listeners
      events.forEach(event => {
        document.addEventListener(event, handleActivity, true);
      });

      // Marcar que los event listeners han sido agregados
      eventListenersAddedRef.current = true;
      console.log('✅ Event listeners agregados correctamente');

      // Inicializar timer
      resetTimer();

      // Cleanup
      return () => {
        events.forEach(event => {
          document.removeEventListener(event, handleActivity, true);
        });
        eventListenersAddedRef.current = false;
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        if (warningTimeoutRef.current) {
          clearTimeout(warningTimeoutRef.current);
        }
      };
    }, 5000); // 5 segundos de retraso

    // Cleanup
    return () => {
      clearTimeout(loginDelay);
      clearTimeout(timerDelay);
      eventListenersAddedRef.current = false;
    };
  }, [enabled, resetTimer, pauseTimer, isFullyLoggedIn, isTimerInitialized]);

  // Guardar última actividad en localStorage para persistencia
  useEffect(() => {
    const saveActivity = () => {
      localStorage.setItem('lastActivity', new Date().toISOString());
    };

    const interval = setInterval(saveActivity, 30000); // Guardar cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  // Función para limpiar completamente el estado (usar cuando el usuario se desautentica)
  const clearState = useCallback(() => {
    console.log('🧹 Limpiando estado del timer de inactividad');
    
    // Limpiar timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (gracePeriodRef.current) {
      clearTimeout(gracePeriodRef.current);
      gracePeriodRef.current = null;
    }
    
    // Limpiar event listeners si existen
    const events = ['click', 'submit', 'change', 'focus', 'scroll', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.removeEventListener(event, () => {}, true);
    });
    
    // Resetear estado
    setTimeRemaining(0);
    setIsInGracePeriod(false);
    setIsTimerInitialized(false);
    lastActivityRef.current = new Date();
    
    console.log('✅ Estado del timer limpiado (incluyendo período de gracia)');
  }, []);

  // Función para registrar actividad manualmente desde componentes
  const recordActivity = useCallback((action: string = 'manual_activity') => {
    console.log(`🔄 Actividad manual registrada: ${action}`);
    resetTimer();
    setTimeRemaining(0);
    
    // Solo registrar actividades importantes para reducir costos
    const importantActions = ['page_view', 'navigation', 'login', 'logout', 'important_click'];
    if (importantActions.includes(action)) {
      // Usar setTimeout para evitar bloqueos
      setTimeout(() => {
        const user = auth.currentUser;
        if (user) {
          import('../services/activityService').then(({ recordUserActivity }) => {
            recordUserActivity(user.uid, window.location.pathname, action);
          });
        }
      }, 100);
    }
  }, [resetTimer]);

  return {
    resetTimer,
    pauseTimer,
    resumeTimer,
    getTimeRemaining,
    getGracePeriodStatus,
    getLoginStatus,
    getTimerInitializationStatus: () => isTimerInitialized,
    lastActivity: lastActivityRef.current,
    // Función para registrar actividad manualmente desde componentes
    recordActivity,
    // Función para testing del logout automático
    handleAutoLogout,
    // Función para limpiar estado
    clearState
  };
}; 