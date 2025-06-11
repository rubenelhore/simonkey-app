// src/components/FeedbackMessage.tsx
import React, { useEffect, useState } from 'react';
import '../styles/FeedbackMessage.css';

interface FeedbackMessageProps {
  type: 'success' | 'info' | 'warning';
  message: string;
  duration?: number; // duración en milisegundos
}

const FeedbackMessage: React.FC<FeedbackMessageProps> = ({ 
  type, 
  message, 
  duration = 2000 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Configurar temporizador para iniciar la animación de salida
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300); // Iniciar animación de salida 300ms antes

    // Configurar temporizador para ocultar completamente
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    // Limpiar temporizadores al desmontar
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [duration]);

  if (!isVisible) return null;

  return (
    <div className={`feedback-message ${type} ${isExiting ? 'exiting' : ''}`}>
      {type === 'success' && <i className="fas fa-check-circle"></i>}
      {type === 'info' && <i className="fas fa-info-circle"></i>}
      {type === 'warning' && <i className="fas fa-exclamation-circle"></i>}
      <span className="message-text">{message}</span>
    </div>
  );
};

export default FeedbackMessage;