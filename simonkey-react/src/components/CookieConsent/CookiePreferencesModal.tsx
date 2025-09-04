import React, { useState, useEffect } from 'react';
import { useCookieConsent, CookiePreferences } from '../../hooks/useCookieConsent';
import './CookiePreferencesModal.css';

interface CookiePreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CookiePreferencesModal: React.FC<CookiePreferencesModalProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const { preferences, giveConsent, rejectAll } = useCookieConsent();
  const [localPreferences, setLocalPreferences] = useState<CookiePreferences>(preferences);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store current scroll position
      const scrollY = window.scrollY;
      
      // Add class to body to prevent scroll
      document.body.classList.add('cookie-modal-open');
      document.body.style.top = `-${scrollY}px`;
      
      return () => {
        // Restore everything
        document.body.classList.remove('cookie-modal-open');
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = (category: keyof CookiePreferences) => {
    if (category === 'essential') return; // No permitir cambiar esenciales
    
    setLocalPreferences(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSave = () => {
    giveConsent(localPreferences);
    onClose();
  };

  const handleRejectAll = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      preferences: false
    };
    setLocalPreferences(essentialOnly);
    rejectAll();
    onClose();
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: false, // Mantenemos false ya que no usamos marketing
      preferences: true
    };
    setLocalPreferences(allAccepted);
    giveConsent(allAccepted);
    onClose();
  };

  return (
    <div className="cookie-modal-overlay" onClick={onClose}>
      <div className="cookie-modal" onClick={e => e.stopPropagation()}>
        <div className="cookie-modal-header">
          <h2>Centro de Preferencias de Privacidad</h2>
          <button className="cookie-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="cookie-modal-content">
          <div className="cookie-modal-intro">
            <p>
              Gestiona tus preferencias de cookies. Puedes habilitar o deshabilitar 
              diferentes categorías de cookies según tus preferencias. Ten en cuenta 
              que deshabilitar algunas cookies puede afectar tu experiencia en el sitio.
            </p>
          </div>

          <div className="cookie-categories">
            {/* Cookies Esenciales */}
            <div className="cookie-category">
              <div className="cookie-category-header">
                <div className="cookie-category-info">
                  <h3>🔒 Cookies Esenciales</h3>
                  <p>Necesarias para el funcionamiento básico del sitio web</p>
                </div>
                <div className="cookie-toggle">
                  <input
                    type="checkbox"
                    id="essential"
                    checked={true}
                    disabled={true}
                    className="cookie-switch"
                  />
                  <label htmlFor="essential" className="cookie-switch-label">
                    <span className="cookie-switch-slider"></span>
                  </label>
                  <span className="cookie-status required">Siempre activo</span>
                </div>
              </div>
              <div className="cookie-category-details">
                <h4>¿Qué incluyen?</h4>
                <ul>
                  <li>Autenticación y sesión de usuario</li>
                  <li>Carrito de compras y configuración de la cuenta</li>
                  <li>Seguridad y prevención de fraude</li>
                  <li>Preferencias básicas de idioma y región</li>
                </ul>
                <div className="cookie-examples">
                  <strong>Ejemplos:</strong> firebaseAuth, session-id, csrf-token
                </div>
              </div>
            </div>

            {/* Cookies de Análisis */}
            <div className="cookie-category">
              <div className="cookie-category-header">
                <div className="cookie-category-info">
                  <h3>📊 Cookies de Análisis</h3>
                  <p>Nos ayudan a entender cómo los usuarios interactúan con nuestro sitio</p>
                </div>
                <div className="cookie-toggle">
                  <input
                    type="checkbox"
                    id="analytics"
                    checked={localPreferences.analytics}
                    onChange={() => handleToggle('analytics')}
                    className="cookie-switch"
                  />
                  <label htmlFor="analytics" className="cookie-switch-label">
                    <span className="cookie-switch-slider"></span>
                  </label>
                  <span className={`cookie-status ${localPreferences.analytics ? 'enabled' : 'disabled'}`}>
                    {localPreferences.analytics ? 'Habilitado' : 'Deshabilitado'}
                  </span>
                </div>
              </div>
              <div className="cookie-category-details">
                <h4>¿Para qué las usamos?</h4>
                <ul>
                  <li>Medir el rendimiento y uso de las páginas</li>
                  <li>Identificar errores y problemas técnicos</li>
                  <li>Mejorar la experiencia del usuario</li>
                  <li>Estadísticas de uso anónimas</li>
                </ul>
                <div className="cookie-examples">
                  <strong>Ejemplos:</strong> _ga, _gid, firebase-analytics
                </div>
              </div>
            </div>

            {/* Cookies de Preferencias */}
            <div className="cookie-category">
              <div className="cookie-category-header">
                <div className="cookie-category-info">
                  <h3>⚙️ Cookies de Preferencias</h3>
                  <p>Recordar tus configuraciones y personalizar tu experiencia</p>
                </div>
                <div className="cookie-toggle">
                  <input
                    type="checkbox"
                    id="preferences"
                    checked={localPreferences.preferences}
                    onChange={() => handleToggle('preferences')}
                    className="cookie-switch"
                  />
                  <label htmlFor="preferences" className="cookie-switch-label">
                    <span className="cookie-switch-slider"></span>
                  </label>
                  <span className={`cookie-status ${localPreferences.preferences ? 'enabled' : 'disabled'}`}>
                    {localPreferences.preferences ? 'Habilitado' : 'Deshabilitado'}
                  </span>
                </div>
              </div>
              <div className="cookie-category-details">
                <h4>¿Qué recordamos?</h4>
                <ul>
                  <li>Configuración de tema (claro/oscuro)</li>
                  <li>Preferencias de idioma</li>
                  <li>Configuraciones de audio y voz</li>
                  <li>Layout y disposición de la interfaz</li>
                </ul>
                <div className="cookie-examples">
                  <strong>Ejemplos:</strong> theme-preference, voice-settings, ui-layout
                </div>
              </div>
            </div>

            {/* Cookies de Marketing - Deshabilitadas */}
            <div className="cookie-category disabled">
              <div className="cookie-category-header">
                <div className="cookie-category-info">
                  <h3>📢 Cookies de Marketing</h3>
                  <p>Para publicidad personalizada y seguimiento de conversiones</p>
                </div>
                <div className="cookie-toggle">
                  <input
                    type="checkbox"
                    id="marketing"
                    checked={false}
                    disabled={true}
                    className="cookie-switch"
                  />
                  <label htmlFor="marketing" className="cookie-switch-label">
                    <span className="cookie-switch-slider"></span>
                  </label>
                  <span className="cookie-status disabled">No utilizado</span>
                </div>
              </div>
              <div className="cookie-category-details">
                <p className="not-used-notice">
                  ℹ️ Actualmente no utilizamos cookies de marketing o publicidad. 
                  Esta categoría existe para transparencia futura.
                </p>
              </div>
            </div>
          </div>

          <div className="cookie-modal-footer">
            <div className="cookie-modal-actions">
              <button 
                className="cookie-btn cookie-btn-tertiary"
                onClick={handleRejectAll}
              >
                Rechazar no esenciales
              </button>
              <button 
                className="cookie-btn cookie-btn-secondary"
                onClick={handleAcceptAll}
              >
                Aceptar todas
              </button>
              <button 
                className="cookie-btn cookie-btn-primary"
                onClick={handleSave}
              >
                Guardar preferencias
              </button>
            </div>
            
            <div className="cookie-modal-links">
              <a href="/privacy-policy" className="cookie-link">
                Leer Política de Privacidad
              </a>
              <span className="cookie-separator">|</span>
              <a href="/terms" className="cookie-link">
                Términos de Servicio
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePreferencesModal;