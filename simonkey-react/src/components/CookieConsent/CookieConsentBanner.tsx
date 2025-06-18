import React, { useState, useEffect } from 'react';
import { useCookieConsent } from '../../hooks/useCookieConsent';
import './CookieConsentBanner.css';

interface CookieConsentBannerProps {
  onOpenPreferences: () => void;
}

const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onOpenPreferences }) => {
  const { 
    hasConsent, 
    preferences, 
    giveConsent, 
    rejectAll,
    isVisible 
  } = useCookieConsent();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const handleAcceptAll = () => {
    giveConsent({
      essential: true,
      analytics: true,
      marketing: false, // Por ahora no usamos marketing cookies
      preferences: true
    });
  };

  const handleRejectAll = () => {
    rejectAll();
  };

  return (
    <div className={`cookie-consent-banner ${isAnimating ? 'animate-in' : ''}`}>
      <div className="cookie-consent-content">
        <div className="cookie-consent-text">
          <h3 className="cookie-consent-title">
            🍪 Usamos cookies para mejorar tu experiencia
          </h3>
          <p className="cookie-consent-description">
            Utilizamos cookies esenciales para el funcionamiento de la aplicación y cookies analíticas 
            para mejorar nuestros servicios. Puedes gestionar tus preferencias en cualquier momento.
          </p>
        </div>
        
        <div className="cookie-consent-actions">
          <button 
            className="cookie-btn cookie-btn-secondary"
            onClick={onOpenPreferences}
          >
            Personalizar
          </button>
          <button 
            className="cookie-btn cookie-btn-tertiary"
            onClick={handleRejectAll}
          >
            Rechazar no esenciales
          </button>
          <button 
            className="cookie-btn cookie-btn-primary"
            onClick={handleAcceptAll}
          >
            Aceptar todas
          </button>
        </div>
      </div>
      
      <div className="cookie-consent-links">
        <a href="/privacy-policy" className="cookie-link">Política de Privacidad</a>
        <span className="cookie-separator">|</span>
        <a href="/terms" className="cookie-link">Términos de Servicio</a>
      </div>
    </div>
  );
};

export default CookieConsentBanner;