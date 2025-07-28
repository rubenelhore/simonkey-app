import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Añadimos useLocation
import './Header.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false); // Added for notifications menu
  const [hasNotification] = useState(false); // Placeholder, replace with real logic if needed
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    // Cargar estado del sidebar desde localStorage
    const savedState = localStorage.getItem('headerSidebarPinned');
    return savedState === 'true';
  });
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    const savedState = localStorage.getItem('headerSidebarPinned');
    return savedState === 'true';
  });
  const location = useLocation(); // Usamos el hook useLocation para acceder a la ubicación actual

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleSidebarPin = () => {
    const newPinnedState = !isSidebarPinned;
    setIsSidebarPinned(newPinnedState);
    setIsSidebarExpanded(newPinnedState);
    // Guardar estado en localStorage
    localStorage.setItem('headerSidebarPinned', newPinnedState.toString());
  };

  const handleSidebarMouseEnter = () => {
    if (!isSidebarPinned) {
      setIsSidebarExpanded(true);
    }
  };

  const handleSidebarMouseLeave = () => {
    if (!isSidebarPinned) {
      setIsSidebarExpanded(false);
    }
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

  // Hide sidebar on homepage
  const isHomePage = location.pathname === '/';
  const shouldShowSidebar = !isHomePage;

  return (
    <>
      {/* Sidebar - Only show if not on homepage */}
      {shouldShowSidebar && (
        <div 
          className={`sidebar-nav ${(isSidebarExpanded || isSidebarPinned) ? 'sidebar-expanded' : ''} ${isSidebarPinned ? 'sidebar-pinned' : ''}`}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
        >
        {/* Contenido del sidebar */}
        <div className="sidebar-content">
          <div className="sidebar-menu-items">
            <Link 
              to="/"
              className="sidebar-link"
              onClick={() => scrollToSection('features')}
            >
              <i className="fas fa-star"></i>
              {(isSidebarExpanded || isSidebarPinned) && <span>Características</span>}
            </Link>
            <Link 
              to="/"
              className="sidebar-link"
              onClick={() => scrollToSection('how-it-works')}
            >
              <i className="fas fa-cogs"></i>
              {(isSidebarExpanded || isSidebarPinned) && <span>Cómo funciona</span>}
            </Link>
            <Link 
              to="/pricing"
              className="sidebar-link"
            >
              <i className="fas fa-tag"></i>
              {(isSidebarExpanded || isSidebarPinned) && <span>Precios</span>}
            </Link>
            <div className="sidebar-divider"></div>
            <Link 
              to="/login"
              className="sidebar-link"
            >
              <i className="fas fa-sign-in-alt"></i>
              {(isSidebarExpanded || isSidebarPinned) && <span>Iniciar Sesión</span>}
            </Link>
            <Link 
              to="/signup"
              className="sidebar-link"
            >
              <i className="fas fa-user-plus"></i>
              {(isSidebarExpanded || isSidebarPinned) && <span>Registrarse</span>}
            </Link>
          </div>
        </div>
      </div>
      )}
      
      <header className="header" style={{ marginLeft: shouldShowSidebar && isSidebarPinned ? '250px' : '0', transition: 'margin-left 0.3s ease' }}>
      <div className="header-container">
        <nav className={`nav ${isMenuOpen ? 'menu-open' : ''}`}>
          <div className="nav-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Botón hamburguesa donde estaba el logo */}
            <button 
              className="hamburger-btn"
              onClick={toggleSidebarPin}
              title={isSidebarPinned ? "Cerrar menú" : "Abrir menú"}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                position: 'static'
              }}
            >
              <div className="hamburger-icon">
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
              </div>
            </button>
          </div>
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
              overflow: 'visible',
            }}>
              <button
                onClick={() => setShowNotifications(false)}
                aria-label="Cerrar notificaciones"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  color: '#888',
                  cursor: 'pointer',
                  padding: 4,
                  zIndex: 2
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <strong>Notificaciones</strong>
              <div style={{ marginTop: 8 }}>
                {hasNotification ? (
                  <div>¡Tienes un evento en el calendario!</div>
                ) : (
                  <div>No tienes notificaciones nuevas.</div>
                )}
              </div>
            </div>
          )}
          
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
    </>
  );
};

export default Header;