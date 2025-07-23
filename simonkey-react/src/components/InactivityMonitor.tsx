import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import './InactivityWarning.css';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos en milisegundos
const WARNING_TIME = 60 * 1000; // 1 minuto de advertencia

const InactivityMonitor: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventListenersActiveRef = useRef(false);
  const [isPageVisible, setIsPageVisible] = useState(true);

  const handleLogout = async () => {
    try {
      console.log('🚪 Cerrando sesión por inactividad...');
      
      // Limpiar todos los timers
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      
      // Limpiar localStorage
      localStorage.removeItem('userSession');
      localStorage.removeItem('lastActivity');
      localStorage.removeItem('hasCompletedOnboarding');
      
      // Navegar primero al login para evitar errores de Firestore listeners
      navigate('/login', { replace: true });
      
      // Dar tiempo para que se limpien los listeners antes de cerrar sesión
      setTimeout(async () => {
        try {
          await signOut(auth);
        } catch (signOutError) {
          // Silenciar errores de signOut durante el logout automático
          console.warn('⚠️ Error durante signOut automático (esperado):', signOutError);
        }
      }, 100);
      
      // Mostrar alerta después de navegar
      setTimeout(() => {
        alert('Sesión cerrada por inactividad. Por favor, inicia sesión nuevamente.');
      }, 200);
      
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      navigate('/login', { replace: true });
    }
  };

  // Referencia para las funciones de event listener
  const handleActivityRef = useRef<((event: Event) => void) | null>(null);

  const removeEventListeners = () => {
    if (!eventListenersActiveRef.current || !handleActivityRef.current) return;
    
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.removeEventListener(event, handleActivityRef.current!, true);
    });
    
    eventListenersActiveRef.current = false;
  };

  const addEventListeners = () => {
    if (eventListenersActiveRef.current) return;
    
    // Solo eventos que indican interacción activa dentro de la plataforma
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Crear la función que valida si debe resetear el timer (más simple y eficiente)
    handleActivityRef.current = (event: Event) => {
      // Validación básica: solo si la página está visible
      if (document.hidden) {
        return;
      }
      
      // Resetear el timer sin logs excesivos
      resetTimer();
    };
    
    events.forEach(event => {
      document.addEventListener(event, handleActivityRef.current!, true);
    });
    
    eventListenersActiveRef.current = true;
  };

  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    // Evitar múltiples llamadas en rápida sucesión
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    
    resetTimerRef.current = setTimeout(() => {
      // Limpiar timers existentes
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      
      // Ocultar advertencia si está visible
      setShowWarning(false);
      setCountdown(60);
      
      if (!isAuthenticated) return;
      
      // Reactivar event listeners si no están activos
      addEventListeners();
      
      // Configurar timer de advertencia (2 minutos) - solo log cuando aparece la advertencia
      warningTimeoutRef.current = setTimeout(() => {
        console.log('⚠️ Sesión por expirar - mostrando advertencia');
        setShowWarning(true);
        
        // DESACTIVAR event listeners cuando aparece la advertencia
        removeEventListeners();
        
        // Iniciar countdown
        let seconds = 60;
        countdownIntervalRef.current = setInterval(() => {
          seconds--;
          setCountdown(seconds);
          
          if (seconds <= 0) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            handleLogout();
          }
        }, 1000);
      }, INACTIVITY_TIMEOUT - WARNING_TIME);
      
      // Configurar timer de logout (3 minutos)
      timeoutRef.current = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);
      
      resetTimerRef.current = null;
    }, 100); // Debounce de 100ms
  };

  const extendSession = () => {
    console.log('🔄 Extendiendo sesión');
    resetTimer();
  };

  // Configurar event listeners
  useEffect(() => {
    if (!isAuthenticated) {
      // Limpiar si no está autenticado
      removeEventListeners();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setShowWarning(false);
      return;
    }

    // Iniciar timer y event listeners
    resetTimer();

    // Cleanup
    return () => {
      removeEventListeners();
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isAuthenticated]);

  // Bloquear scroll y eventos del body cuando el modal esté visible
  useEffect(() => {
    if (showWarning) {
      // Bloquear scroll del body
      document.body.style.overflow = 'hidden';
      document.body.style.pointerEvents = 'none';
      
      // Permitir solo eventos del modal
      const modalElement = document.querySelector('.inactivity-warning-overlay');
      if (modalElement) {
        (modalElement as HTMLElement).style.pointerEvents = 'all';
      }
    } else {
      // Restaurar scroll y eventos
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }

    return () => {
      // Cleanup - siempre restaurar
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    };
  }, [showWarning]);

  // Monitorear visibilidad de la página (sin logs excesivos)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      
      if (isVisible) {
        // Cuando la página vuelve a ser visible, resetear el timer silenciosamente
        if (isAuthenticated && !showWarning) {
          resetTimer();
        }
      } else {
        // Cuando la página se oculta, pausar el timer silenciosamente
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, showWarning]);

  // Monitorear foco de la ventana (sin logs excesivos)
  useEffect(() => {
    const handleFocus = () => {
      if (isAuthenticated && !showWarning && isPageVisible) {
        resetTimer();
      }
    };

    const handleBlur = () => {
      // Simplemente no hacer nada cuando pierde el foco
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isAuthenticated, showWarning, isPageVisible]);

  // No mostrar nada si no hay advertencia
  if (!showWarning || !isAuthenticated) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    return Math.max(0, (countdown / 60) * 100);
  };

  const getProgressColor = (): string => {
    if (countdown <= 10) return '#ff4444';
    if (countdown <= 30) return '#ffaa00';
    return '#44aa44';
  };

  // Prevenir propagación de eventos del overlay
  const handleOverlayClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // No hacer nada - bloquear interacción
  };

  // Prevenir propagación de eventos del modal
  const handleModalClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      className="inactivity-warning-overlay"
      onClick={handleOverlayClick}
      onMouseDown={handleOverlayClick}
      onMouseUp={handleOverlayClick}
      onTouchStart={handleOverlayClick}
      onTouchEnd={handleOverlayClick}
      onKeyDown={(e) => e.preventDefault()}
    >
      <div 
        className="inactivity-warning-modal"
        onClick={handleModalClick}
        onMouseDown={handleModalClick}
        onMouseUp={handleModalClick}
      >
        <div className="inactivity-warning-header">
          <h2>⏰ Sesión por expirar</h2>
        </div>
        
        <div className="inactivity-warning-content">
          <p>Tu sesión se cerrará automáticamente por inactividad en:</p>
          
          <div className="inactivity-warning-countdown">
            <span className="countdown-time">{formatTime(countdown)}</span>
          </div>
          
          <div className="inactivity-warning-progress">
            <div 
              className="progress-bar" 
              style={{ 
                width: `${getProgressPercentage()}%`,
                backgroundColor: getProgressColor()
              }}
            />
          </div>
          
          <p className="inactivity-warning-message">
            ¿Deseas continuar trabajando?
          </p>
        </div>
        
        <div className="inactivity-warning-actions">
          <button 
            className="btn-extend-session"
            onClick={extendSession}
          >
            Continuar sesión
          </button>
          
          <button 
            className="btn-logout"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactivityMonitor;