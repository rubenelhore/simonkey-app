import React, { useEffect, useState } from 'react';
import './InactivityWarning.css';

interface InactivityWarningProps {
  timeRemaining: number; // Tiempo restante en segundos
  onExtendSession: () => void; // Función para extender la sesión
  onLogout: () => void; // Función para hacer logout manual
}

const InactivityWarning: React.FC<InactivityWarningProps> = ({
  timeRemaining,
  onExtendSession,
  onLogout
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState(timeRemaining);

  // Mostrar advertencia cuando hay tiempo restante
  useEffect(() => {
    setIsVisible(timeRemaining > 0);
  }, [timeRemaining]);

  // Actualizar countdown
  useEffect(() => {
    if (isVisible) {
      setCountdown(timeRemaining);
    }
  }, [timeRemaining, isVisible]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    return Math.max(0, (countdown / 60) * 100);
  };

  const getProgressColor = (): string => {
    if (countdown <= 10) return '#ff4444'; // Rojo
    if (countdown <= 30) return '#ffaa00'; // Naranja
    return '#44aa44'; // Verde
  };

  if (!isVisible) return null;

  return (
    <div className="inactivity-warning-overlay">
      <div className="inactivity-warning-modal">
        <div className="inactivity-warning-header">
          <div className="inactivity-warning-icon">⏰</div>
          <h3>Sesión por expirar</h3>
        </div>
        
        <div className="inactivity-warning-content">
          <p>
            Tu sesión expirará en <strong>{formatTime(countdown)}</strong> por inactividad.
          </p>
          
          <div className="inactivity-warning-progress">
            <div 
              className="inactivity-warning-progress-bar"
              style={{
                width: `${getProgressPercentage()}%`,
                backgroundColor: getProgressColor()
              }}
            />
          </div>
          
          <p className="inactivity-warning-message">
            ¿Deseas continuar con tu sesión?
          </p>
        </div>
        
        <div className="inactivity-warning-actions">
          <button 
            className="inactivity-warning-button extend"
            onClick={onExtendSession}
          >
            <span>🔄</span>
            Continuar sesión
          </button>
          
          <button 
            className="inactivity-warning-button logout"
            onClick={onLogout}
          >
            <span>🚪</span>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactivityWarning; 