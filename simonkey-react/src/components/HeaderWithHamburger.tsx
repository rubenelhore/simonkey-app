import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { UserSubscriptionType } from '../types/interfaces';
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
  const { user, logout, userProfile } = useAuth();
  const { isSuperAdmin, subscription } = useUserType();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isHelpSubmenuOpen, setIsHelpSubmenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isFreeUser = subscription === 'free';

  // Detectar si estamos en la página de configuración de voz
  const isVoiceSettingsPage = location.pathname === '/settings/voice';
  
  // Detectar si estamos en la página de perfil
  const isProfilePage = location.pathname === '/profile';

  // Función de depuración para verificar y actualizar superadmin
  const checkAndUpdateSuperAdmin = async () => {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.email === 'ruben.elhore@gmail.com') {
      try {
        console.log('🔍 Verificando usuario superadmin:', currentUser.email);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('📋 Datos actuales del usuario:', userData);
          if (userData.subscription !== UserSubscriptionType.SUPER_ADMIN) {
            console.log('⚠️ Usuario no tiene tipo SUPER_ADMIN, actualizando...');
            await updateDoc(doc(db, 'users', currentUser.uid), {
              subscription: UserSubscriptionType.SUPER_ADMIN,
              updatedAt: serverTimestamp()
            });
            console.log('✅ Usuario actualizado como SUPER_ADMIN');
            // Recargar la página para aplicar cambios
            window.location.reload();
          } else {
            console.log('✅ Usuario ya tiene tipo SUPER_ADMIN');
          }
        } else {
          console.log('❌ Documento de usuario no encontrado');
        }
      } catch (error) {
        console.error('❌ Error verificando/actualizando usuario:', error);
      }
    }
  };

  // Verificar superadmin al cargar el componente
  useEffect(() => {
    if (user && user.email === 'ruben.elhore@gmail.com') {
      checkAndUpdateSuperAdmin();
    }
  }, [user]);

  // Logs de depuración
  useEffect(() => {
    console.log('🔍 HeaderWithHamburger - Estado actual:');
    console.log('  - user:', user);
    console.log('  - userProfile:', userProfile);
    console.log('  - isSuperAdmin:', isSuperAdmin);
    console.log('  - subscription:', subscription);
  }, [user, userProfile, isSuperAdmin, subscription]);

  const toggleMenu = () => {
    setMobileMenuOpen(!isMobileMenuOpen);
    if (isMobileMenuOpen) {
      setIsHelpSubmenuOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsHelpSubmenuOpen(false);
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleOpenUpgradeModal = () => {
    setMobileMenuOpen(false);
    setIsHelpSubmenuOpen(false);
    setIsUpgradeModalOpen(true);
  };

  const handleCloseUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  const handleProfileClick = () => {
    setIsHelpSubmenuOpen(false);
    navigate('/profile');
  };

  const handleVoiceSettingsClick = () => {
    setIsHelpSubmenuOpen(false);
    navigate('/settings/voice');
  };

  const handleSuperAdminClick = () => {
    setIsHelpSubmenuOpen(false);
    navigate('/super-admin');
  };

  const handleCalendarClick = () => {
    setIsHelpSubmenuOpen(false);
    navigate('/calendar');
  };

  const toggleHelpSubmenu = () => {
    setIsHelpSubmenuOpen(!isHelpSubmenuOpen);
  };

  return (
    <div className={`header-with-hamburger-container ${isMobileMenuOpen ? 'menu-open' : ''}`}>
      {/* Overlay para cerrar el menú */}
      {isMobileMenuOpen && (
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
      <div className={`side-menu ${isMobileMenuOpen ? 'side-menu-open' : ''}`}>
        <div className="side-menu-header">
          <h3>Menú</h3>
          <button className="side-menu-close" onClick={toggleMenu}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="side-menu-content">
          <div className="user-section">
            <button 
              className={`side-menu-button personalization-button ${isProfilePage ? 'disabled' : ''}`} 
              onClick={isProfilePage ? undefined : handleProfileClick}
              disabled={isProfilePage}
            >
              <i className="fas fa-user-cog"></i> 
              <span>Mi perfil</span>
            </button>
            <button 
              className={`side-menu-button voice-settings-button ${isVoiceSettingsPage ? 'disabled' : ''}`} 
              onClick={isVoiceSettingsPage ? undefined : handleVoiceSettingsClick}
              disabled={isVoiceSettingsPage}
            >
              <i className="fas fa-volume-up"></i> 
              <span>Configuración de voz</span>
            </button>
            <button className="side-menu-button calendar-button">
              <i className="fas fa-calendar-alt"></i> 
              <span>Calendario</span>
            </button>
            <button className="side-menu-button help-button" onClick={toggleHelpSubmenu}>
              <i className="fas fa-question-circle"></i> 
              <span>Ayuda</span>
            </button>
            {isHelpSubmenuOpen && (
              <div className="help-submenu">
                <button className="side-menu-button submenu-button">
                  <i className="fas fa-headset"></i> 
                  <span>Soporte</span>
                </button>
                <button className="side-menu-button submenu-button">
                  <i className="fas fa-book"></i> 
                  <span>Guía de usuario</span>
                </button>
              </div>
            )}
            {isFreeUser && (
              <button className="side-menu-button upgrade-pro-button" onClick={handleOpenUpgradeModal}>
                <i className="fas fa-star"></i>
                <span>Upgrade a Pro</span>
              </button>
            )}
            {isSuperAdmin && (
              <button className="side-menu-button super-admin-button" onClick={handleSuperAdminClick}>
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