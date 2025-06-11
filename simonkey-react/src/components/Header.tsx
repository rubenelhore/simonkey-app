import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Añadimos useLocation
import './Header.css';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
            <Link to="/" className="logo" onClick={(e) => {
            e.preventDefault();
            // If we're already on home page, scroll to top
            if (location.pathname === '/') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              // If we're on another page, navigate to home
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
              <span style={{ color: '#6147FF' }}>key</span>
            </span>
            </Link>
          <button className="hamburger-btn" aria-label="Menú" onClick={toggleMenu}>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
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
        </nav>
      </div>
    </header>
  );
};

export default Header;