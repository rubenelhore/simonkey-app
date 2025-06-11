// src/components/Mobile/MobileNavigation.jsx
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './MobileNavigation.css';

const MobileNavigation = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const location = useLocation();

  // Esconder la navegación al hacer scroll hacia abajo
  useEffect(() => {
    const handleScroll = () => {
      const st = window.pageYOffset || document.documentElement.scrollTop;
      if (st > lastScrollTop && st > 100) {
        // Scroll hacia abajo
        setIsVisible(false);
      } else {
        // Scroll hacia arriba
        setIsVisible(true);
      }
      setLastScrollTop(st <= 0 ? 0 : st);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollTop]);

  // Resetear el estado al cambiar de ruta
  useEffect(() => {
    setIsVisible(true);
    setLastScrollTop(0);
  }, [location.pathname]);

  // Ocultar navegación en ciertas rutas
  if (location.pathname === '/login' || location.pathname === '/signup' || location.pathname.includes('/shared/')) {
    return null;
  }

  return (
    <nav className={`mobile-navigation ${isVisible ? 'visible' : 'hidden'}`}>
      <NavLink to="/notebooks" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <i className="fas fa-book"></i>
        <span>Cuadernos</span>
      </NavLink>
      
      <NavLink to="/study" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <i className="fas fa-graduation-cap"></i>
        <span>Estudiar</span>
      </NavLink>
      
      <NavLink to="/progress" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <i className="fas fa-chart-line"></i>
        <span>Progreso</span>
      </NavLink>
      
      <NavLink to="/profile" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        <i className="fas fa-user"></i>
        <span>Perfil</span>
      </NavLink>
    </nav>
  );
};

export default MobileNavigation;