import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useUserType } from '../hooks/useUserType';
import './HeaderWithHamburger.css';

interface HeaderWithHamburgerProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  children?: React.ReactNode;
}

const HeaderWithHamburger: React.FC<HeaderWithHamburgerProps> = ({
  title,
  subtitle,
  showBackButton = false,
  onBackClick,
  children
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFreeUser, isSuperAdmin } = useUserType();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleOpenUpgradeModal = () => {
    setIsUpgradeModalOpen(true);
    setMenuOpen(false);
  };

  const handleCloseUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  return (
    <div className={`header-with-hamburger-container ${menuOpen ? 'menu-open' : ''}`}>
      {/* Overlay para cerrar el menú */}
      {menuOpen && (
        <div className="menu-overlay" onClick={toggleMenu}></div>
      )}
      
      <header
        className="header-with-hamburger"
        style={{ opacity: 1, color: '#fff', zIndex: 9999, position: 'relative' }}
      >
        <div className="header-content">
          {/* Botón de retroceso si es necesario - ahora al inicio */}
          {showBackButton && (
            <button className="back-button" onClick={onBackClick}>
              <i className="fas fa-arrow-left"></i>
            </button>
          )}
          
          <div className="logo2-title-group">
            <img
              src="/img/favicon.svg"
              alt="Logo Simonkey"
              className="logo-img"
              width="24"
              height="24"
              style={{ filter: 'brightness(0) invert(1)' }}
            />  
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
              <span>Simon</span>
              <span>key</span>
            </h1>
          </div>
          
          {/* Título de la página */}
          <div className="page-title-section">
            <h2 className="page-title">{title}</h2>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
          
          <button className="notebooks-hamburger-btn" aria-label="Menú" onClick={toggleMenu}>
            <span className="notebooks-hamburger-line"></span>
            <span className="notebooks-hamburger-line"></span>
            <span className="notebooks-hamburger-line"></span>
          </button>
        </div>
      </header>
      
      {/* Menú lateral deslizante */}
      <div className={`side-menu ${menuOpen ? 'side-menu-open' : ''}`}>
        <div className="side-menu-header">
          <h3>Menú</h3>
          <button className="side-menu-close" onClick={toggleMenu}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="side-menu-content">
          <div className="user-section">
            <button className="side-menu-button personalization-button" onClick={() => navigate('/profile')}>
              <i className="fas fa-user-cog"></i> 
              <span>Mi perfil</span>
            </button>
            <button className="side-menu-button voice-settings-button" onClick={() => navigate('/settings/voice')}>
              <i className="fas fa-volume-up"></i> 
              <span>Configuración de voz</span>
            </button>
            {isFreeUser && (
              <button className="side-menu-button upgrade-pro-button" onClick={handleOpenUpgradeModal}>
                <i className="fas fa-star"></i>
                <span>Upgrade a Pro</span>
              </button>
            )}
            {isSuperAdmin && (
              <button className="side-menu-button super-admin-button" onClick={() => navigate('/super-admin')}>
                <i className="fas fa-crown"></i> 
                <span>Súper Admin</span>
              </button>
            )}
            <button className="side-menu-button logout-button" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i> 
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
      
      {isUpgradeModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="modal-header">
              <h2>Upgrade a Pro</h2>
              <button className="close-button" onClick={handleCloseUpgradeModal}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '1.1rem', margin: '2rem 0' }}>Contacta al equipo de Simonkey</p>
            </div>
          </div>
        </div>
      )}
      {/* Renderiza children debajo del header y menú */}
      {children}
    </div>
  );
};

export default HeaderWithHamburger; 