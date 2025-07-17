import React, { useState } from 'react';
import './Footer.css'; // Estilos que crearemos a continuación
import { useCookieConsent } from '../hooks/useCookieConsent';
import CookiePreferencesModal from './CookieConsent/CookiePreferencesModal';

const Footer: React.FC = () => {
  const { resetConsent } = useCookieConsent();
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);

  const handleCookieSettings = () => {
    setIsPreferencesModalOpen(true);
  };

  const handleClosePreferences = () => {
    setIsPreferencesModalOpen(false);
  };
  return (
    <>
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-column">
              <div className="footer-logo">
                <a href="/" className="logo">
                  <span className="logo-text">
                    <span style={{ color: 'white' }}>Simon</span>
                    <span style={{ color: 'white' }}>key</span>
                  </span>
                  <img
                    src="/img/favicon.svg"
                    alt="Logo Simonkey"
                    className="logo-img"
                    width="24"
                    height="24"
                  />
                </a>
              </div>
              <p className="footer-description">
                Plataforma de educación personalizada potenciada por inteligencia artificial.
              </p>
            </div>
            <div className="footer-column">
              <h4 className="footer-column-title">Recursos</h4>
              <ul className="footer-links">
                <li className="footer-link"><a href="/examples">Ejemplos</a></li>
                <li className="footer-link"><a href="/faq">FAQ</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4 className="footer-column-title">Empresa</h4>
              <ul className="footer-links">
                <li className="footer-link"><a href="/about">Sobre nosotros</a></li>
                <li className="footer-link"><a href="/contact">Contacto</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4 className="footer-column-title">Legal y Privacidad</h4>
              <ul className="footer-links">
                <li className="footer-link"><a href="/terms">Términos de servicio</a></li>
                <li className="footer-link"><a href="/privacy-policy">Política de privacidad</a></li>
                <li className="footer-link">
                  <button 
                    onClick={handleCookieSettings}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.8)',
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left',
                      fontSize: 'inherit',
                      fontFamily: 'inherit',
                      fontWeight: 'normal',
                      textDecoration: 'none',
                      transition: 'color 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
                  >
                    Configuración de cookies
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="copyright">
            © 2025 Simonkey. Todos los derechos reservados. | 
            <span style={{ marginLeft: '0.5rem' }}>
              Comprometidos con tu privacidad y seguridad de datos.
            </span>
          </div>
        </div>
      </footer>

      {/* Modal de preferencias de cookies */}
      <CookiePreferencesModal 
        isOpen={isPreferencesModalOpen} 
        onClose={handleClosePreferences} 
      />
    </>
  );
};

export default Footer;