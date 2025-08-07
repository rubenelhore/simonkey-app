// src/components/Mobile/TeacherMobileNavigation.tsx
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './MobileNavigation.css';

const TeacherMobileNavigation = () => {
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

  return (
    <nav className={`mobile-navigation ${isVisible ? 'visible' : 'hidden'}`}>
      <NavLink 
        to="/teacher/home" 
        className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
      >
        <i className="fas fa-home"></i>
        <span>Inicio</span>
      </NavLink>
      
      <NavLink 
        to="/school/teacher" 
        className={({ isActive }) => {
          // Considera activo solo si estamos en /school/teacher o en subrutas de materias
          const isMateriasRoute = location.pathname === '/school/teacher' || 
                                 location.pathname.includes('/school/teacher/materias/');
          return isMateriasRoute && !location.pathname.includes('/analytics') ? "nav-item active" : "nav-item";
        }}
      >
        <i className="fas fa-book"></i>
        <span>Materias</span>
      </NavLink>
      
      <NavLink 
        to="/school/teacher/analytics" 
        className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
      >
        <i className="fas fa-chart-line"></i>
        <span>Analítica</span>
      </NavLink>
      
      <NavLink 
        to="/calendar" 
        className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
      >
        <i className="fas fa-calendar-alt"></i>
        <span>Calendario</span>
      </NavLink>
    </nav>
  );
};

export default TeacherMobileNavigation;