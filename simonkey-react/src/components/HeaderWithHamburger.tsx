import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { useUserType } from '../hooks/useUserType';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import './HeaderWithHamburger.css';

interface HeaderWithHamburgerProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

const HeaderWithHamburger: React.FC<HeaderWithHamburgerProps> = ({
  title,
  subtitle,
  showBackButton = false,
  onBackClick
}) => {
  const navigate = useNavigate();
  const { isSuperAdmin, isFreeUser } = useUserType();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userData, setUserData] = useState({
    nombre: '',
    apellidos: '',
    tipoAprendizaje: 'Visual',
    intereses: ['tecnología']
  });
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const personalizationRef = useRef<HTMLDivElement>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollTop, setLastScrollTop] = useState(0);

  // Cargar datos del usuario
  useEffect(() => {
    const loadUserData = async () => {
      if (!auth.currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            nombre: data.nombre || '',
            apellidos: data.apellidos || '',
            tipoAprendizaje: data.tipoAprendizaje || 'Visual',
            intereses: data.intereses || ['tecnología']
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Ocultar header al hacer scroll hacia abajo, mostrar al subir
  useEffect(() => {
    const handleScroll = () => {
      const st = window.pageYOffset || document.documentElement.scrollTop;
      if (st > lastScrollTop && st > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollTop(st <= 0 ? 0 : st);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollTop]);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleOpenPersonalization = () => {
    setIsPersonalizationOpen(true);
    setMenuOpen(false);
  };

  const handleClosePersonalization = () => {
    setIsPersonalizationOpen(false);
    setSuccessMessage('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInterestChange = (index: number, value: string) => {
    const newIntereses = [...userData.intereses];
    newIntereses[index] = value;
    setUserData(prev => ({
      ...prev,
      intereses: newIntereses
    }));
  };

  const addInterest = () => {
    if (userData.intereses.length < 12) {
      setUserData(prev => ({
        ...prev,
        intereses: [...prev.intereses, '']
      }));
    }
  };

  const removeInterest = (index: number) => {
    if (userData.intereses.length > 1) {
      const newIntereses = userData.intereses.filter((_, i) => i !== index);
      setUserData(prev => ({
        ...prev,
        intereses: newIntereses
      }));
    }
  };

  const handleSavePersonalization = async () => {
    if (!auth.currentUser) return;

    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        nombre: userData.nombre,
        apellidos: userData.apellidos,
        tipoAprendizaje: userData.tipoAprendizaje,
        intereses: userData.intereses.filter(interes => interes.trim() !== ''),
        updatedAt: new Date()
      });

      setSuccessMessage('Datos guardados correctamente');
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error saving personalization:', error);
      setSuccessMessage('Error al guardar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUpgradeModal = () => {
    setIsUpgradeModalOpen(true);
    setMenuOpen(false);
  };

  const handleCloseUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  // Cerrar modal al hacer clic fuera
  useEffect(() => {
    if (!isPersonalizationOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (personalizationRef.current && !personalizationRef.current.contains(event.target as Node)) {
        handleClosePersonalization();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClosePersonalization();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPersonalizationOpen]);

  return (
    <div className={`header-with-hamburger-container ${menuOpen ? 'menu-open' : ''}`}>
      {/* Overlay para cerrar el menú */}
      {menuOpen && (
        <div className="menu-overlay" onClick={toggleMenu}></div>
      )}
      
      <header className={`header-with-hamburger${isVisible ? '' : ' header-hidden'}`}>
        <div className="header-content">
          {/* Botón de retroceso si es necesario - ahora al inicio */}
          {showBackButton && (
            <button className="back-button" onClick={onBackClick}>
              <i className="fas fa-arrow-left"></i>
            </button>
          )}
          
          <div className="logo-title-group">
            <img
              src="/img/favicon.svg"
              alt="Logo Simonkey"
              className="logo-img"
              width="24"
              height="24"
              style={{ filter: 'brightness(0) invert(1)' }}
            />  
            <h1>
              <span style={{ color: 'white' }}>Simon</span>
              <span style={{ color: 'white' }}>key</span>
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
            <button className="side-menu-button personalization-button" onClick={handleOpenPersonalization}>
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
      
      {/* Modal de personalización */}
      {isPersonalizationOpen && (
        <div className="modal-overlay">
          <div className="modal-content personalization-modal" ref={personalizationRef}>
            <div className="modal-header">
              <h2>Personalización</h2>
              <button className="close-button" onClick={handleClosePersonalization}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="nombre">Nombre</label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  value={userData.nombre}
                  onChange={handleInputChange}
                  placeholder="Tu nombre"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="apellidos">Apellido(s)</label>
                <input
                  type="text"
                  id="apellidos"
                  name="apellidos"
                  value={userData.apellidos}
                  onChange={handleInputChange}
                  placeholder="Tus apellidos"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="tipoAprendizaje">Tipo de aprendizaje predilecto</label>
                <select
                  id="tipoAprendizaje"
                  name="tipoAprendizaje"
                  value={userData.tipoAprendizaje}
                  onChange={handleInputChange}
                  className="form-control"
                >
                  <option value="Visual">Visual</option>
                  <option value="Auditivo">Auditivo</option>
                  <option value="Kinestésico">Kinestésico</option>
                </select>
              </div>
              <div className="form-group">
                <label>Intereses (máximo 12)</label>
                {userData.intereses.map((interes, index) => (
                  <div key={index} className="interest-input-group">
                    <input
                      type="text"
                      value={interes}
                      onChange={(e) => handleInterestChange(index, e.target.value)}
                      placeholder="Ej: cocina, deportes, tecnología"
                      className="form-control interest-input"
                    />
                    <button
                      type="button"
                      onClick={() => removeInterest(index)}
                      className="remove-interest-btn"
                      disabled={userData.intereses.length === 1}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
                {userData.intereses.length < 12 && (
                  <button
                    type="button"
                    onClick={addInterest}
                    className="add-interest-btn"
                  >
                    <i className="fas fa-plus"></i> Añadir interés
                  </button>
                )}
              </div>
              {successMessage && (
                <div className="success-message">
                  {successMessage}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="save-button"
                onClick={handleSavePersonalization}
                disabled={isLoading}
              >
                {isLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
    </div>
  );
};

export default HeaderWithHamburger; 