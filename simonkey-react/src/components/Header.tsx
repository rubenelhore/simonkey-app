import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Añadimos useLocation
import './Header.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNotification, setHasNotification] = useState(true); // Simulado: true si hay evento en calendario
  const location = useLocation(); // Usamos el hook useLocation para acceder a la ubicación actual

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    if (isMenuOpen) setIsMenuOpen(false);
  };

  // Función para manejar el scroll a secciones específicas
  const scrollToSection = (sectionId: string) => {
    closeMenu();
    
    // Si estamos en la página principal
    if (location.pathname === '/') {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Si estamos en otra página, navegamos a la página principal y luego al elemento
      // Guardamos la sección objetivo en localStorage para usarla después de la navegación
      localStorage.setItem('scrollTo', sectionId);
      window.location.href = '/#' + sectionId;
    }
  };

  return (
    <header className="header">
      <div className="header-container">
        <nav className={`nav ${isMenuOpen ? 'menu-open' : ''}`}>
          <div className="nav-top">
            <Link to="/" className="logo" onClick={(e) => {
              e.preventDefault();
              if (location.pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                window.location.href = '/';
              }
              closeMenu();
            }}>
              <img
                src="/img/favicon.svg"
                alt="Logo Simonkey"
                className="logo-img"
                width="24"
                height="24"
              />
              <span className="logo-text">
                <span style={{ color: 'black' }}>Simon</span>
                <span style={{ color: 'black' }}>key</span>
              </span>
            </Link>
            {/* Botón de notificaciones */}
            <button
              className="notification-btn"
              aria-label="Notificaciones"
              onClick={() => setShowNotifications((v) => !v)}
              style={{ position: 'relative', marginRight: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faBell} size="lg" />
              {hasNotification && (
                <span style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 10,
                  height: 10,
                  background: 'red',
                  borderRadius: '50%',
                  border: '2px solid white',
                  display: 'inline-block',
                  zIndex: 2,
                }} />
              )}
            </button>
            {/* Botón hamburguesa */}
            <button className="hamburger-btn" aria-label="Menú" onClick={toggleMenu}>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
            {/* Menú de notificaciones */}
            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: 50,
                right: 20,
                background: 'white',
                border: '1px solid #eee',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                padding: 16,
                minWidth: 220,
                zIndex: 10,
              }}>
                <strong>Notificaciones</strong>
                <div style={{ marginTop: 8 }}>
                  {hasNotification ? (
                    <div>¡Tienes un evento en el calendario!</div>
                  ) : (
                    <div>No tienes notificaciones nuevas.</div>
                  )}
                </div>
                <button style={{ marginTop: 12 }} onClick={() => setShowNotifications(false)}>Cerrar</button>
              </div>
            )}
          </div>
          
          <div className="nav-menu">
            <div className="nav-links">
              {/* Usando Link con onClick para mantener consistencia de estilo */}
              <Link to="/#features" className="nav-link" onClick={(e) => {
                e.preventDefault();
                scrollToSection('features');
              }}>
                Características
              </Link>
              <Link to="/#how-it-works" className="nav-link" onClick={(e) => {
                e.preventDefault(); 
                scrollToSection('how-it-works');
              }}>
                Cómo funciona
              </Link>
              <Link to="/pricing" className="nav-link" onClick={(e) => {
                e.preventDefault();
                // Si estamos en la página de pricing, scroll hasta arriba
                if (location.pathname === '/pricing') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  // Si no, navega a pricing
                  window.location.href = '/pricing';
                }
                closeMenu();
              }}>
                Precios
              </Link>
            </div>
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline" onClick={closeMenu}>
                Iniciar Sesión
              </Link>
              <Link to="/signup" className="btn btn-primary" onClick={closeMenu}>
                Registrarse
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;