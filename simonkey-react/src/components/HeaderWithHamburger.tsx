import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db, collection, query, where, getDocs } from '../services/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { UserSubscriptionType, Notebook } from '../types/interfaces';
import './HeaderWithHamburger.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';

interface HeaderWithHamburgerProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  children?: React.ReactNode;
  themeColor?: string;
}

const HeaderWithHamburger: React.FC<HeaderWithHamburgerProps> = ({
  title,
  subtitle,
  showBackButton = false,
  onBackClick,
  children,
  themeColor
}) => {
  const { user, logout, userProfile } = useAuth();
  const { isSuperAdmin, subscription } = useUserType();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);
  const [todayEvents, setTodayEvents] = useState<{ id: string; title: string; type: string }[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [smartEvents, setSmartEvents] = useState<{ id: string; title: string; notebookId: string }[]>([]);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Detectar si estamos en la página de configuración de voz
  const isVoiceSettingsPage = location.pathname === '/settings/voice';
  
  // Detectar si estamos en la página de perfil
  const isProfilePage = location.pathname === '/profile';

  // Detectar si estamos en la página de calendario
  const isCalendarPage = location.pathname === '/calendar';

  const isFreeUser = subscription === 'free';

  // Fetch today's calendar events
  useEffect(() => {
    async function fetchTodayEvents() {
      if (!user) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      // Buscar eventos personalizados
      const q = query(collection(db, 'calendarEvents'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const events: { id: string; title: string; type: string }[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const date = data.date && data.date.toDate ? data.date.toDate() : new Date(data.date);
        if (date >= today && date < tomorrow) {
          events.push({ id: docSnap.id, title: data.title, type: 'custom' });
        }
      });
      // Aquí podrías agregar lógica para eventos de estudio si lo deseas
      setTodayEvents(events);
      setHasNotification(events.length > 0);
    }
    fetchTodayEvents();
  }, [user]);

  // Cargar notebooks del usuario
  useEffect(() => {
    if (!user) return;
    const loadNotebooks = async () => {
      const userId = user.uid;
      const notebooksQuery = query(
        collection(db, 'notebooks'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(notebooksQuery);
      const userNotebooks: Notebook[] = [];
      snapshot.forEach(doc => {
        userNotebooks.push({ id: doc.id, ...doc.data() } as Notebook);
      });
      setNotebooks(userNotebooks);
    };
    loadNotebooks();
  }, [user]);

  // Buscar estudios inteligentes disponibles hoy
  useEffect(() => {
    async function fetchSmartEvents() {
      if (!user || notebooks.length === 0) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const userId = user.uid;
      const smartEventsList: { id: string; title: string; notebookId: string }[] = [];
      for (const notebook of notebooks) {
        // Buscar límites del notebook
        const notebookLimitsRef = doc(db, 'users', userId, 'notebookLimits', notebook.id);
        const notebookLimitsDoc = await getDoc(notebookLimitsRef);
        let smartAvailable = false;
        if (notebookLimitsDoc.exists()) {
          const limits = notebookLimitsDoc.data();
          // Verificar si ya se usó hoy
          if (limits.lastSmartStudyDate) {
            const lastSmart = limits.lastSmartStudyDate.toDate();
            lastSmart.setHours(0, 0, 0, 0);
            if (lastSmart.getTime() !== today.getTime()) {
              // No se ha usado hoy, verificar si hay conceptos para repasar
              const learningRef = collection(db, 'users', userId, 'learningData');
              const learningQuery = query(learningRef, where('notebookId', '==', notebook.id));
              const learningSnapshot = await getDocs(learningQuery);
              let hasConceptsToReview = false;
              learningSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.nextReviewDate) {
                  const reviewDate = data.nextReviewDate.toDate();
                  if (reviewDate <= new Date()) {
                    hasConceptsToReview = true;
                  }
                }
              });
              if (hasConceptsToReview) smartAvailable = true;
            }
          } else {
            // Nunca se ha usado, verificar si hay conceptos
            const learningRef = collection(db, 'users', userId, 'learningData');
            const learningQuery = query(learningRef, where('notebookId', '==', notebook.id));
            const learningSnapshot = await getDocs(learningQuery);
            if (!learningSnapshot.empty) smartAvailable = true;
          }
        }
        if (smartAvailable) {
          smartEventsList.push({
            id: notebook.id,
            title: `🧠 Estudio inteligente disponible: ${notebook.title}`,
            notebookId: notebook.id
          });
        }
      }
      setSmartEvents(smartEventsList);
      setHasNotification(todayEvents.length > 0 || smartEventsList.length > 0);
    }
    fetchSmartEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, notebooks, todayEvents]);

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
    }
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
    setMobileMenuOpen(false);
    setIsUpgradeModalOpen(true);
  };

  const handleCloseUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  const handleVoiceSettingsClick = () => {
    navigate('/settings/voice');
  };

  const handleSuperAdminClick = () => {
    navigate('/super-admin');
  };

  const handleCalendarClick = () => {
    navigate('/calendar');
  };

  const handleHelpClick = () => {
    navigate('/contact');
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!showNotifications) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  return (
    <div className={`header-with-hamburger-container ${isMobileMenuOpen ? 'menu-open' : ''}`}>
      {/* Overlay para cerrar el menú */}
      {isMobileMenuOpen && (
        <div className="menu-overlay" onClick={toggleMenu}></div>
      )}
      
      <header
        className="header-with-hamburger"
        style={{ 
          opacity: 1, 
          color: '#fff', 
          zIndex: 9999, 
          position: 'relative',
          backgroundColor: themeColor || undefined
        }}
      >
        <div className="header-content">
          {/* Botón de retroceso si es necesario - ahora al inicio */}
          {showBackButton && (
            <button 
              className="back-button" 
              onClick={onBackClick}
              style={{
                '--theme-color': themeColor || '#6147FF'
              } as React.CSSProperties}
            >
              <i className="fas fa-arrow-left"></i>
            </button>
          )}
          
          {/* Solo mostrar el logo si NO hay back button */}
          {!showBackButton && (
            <div className="logo2-title-group" style={{ cursor: 'pointer' }} onClick={() => navigate('/materias')}>
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
          )}
          
          {/* Título de la página */}
          <div className="page-title-section">
            <h2 className="page-title">{title}</h2>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
          
          {/* Botón de notificaciones */}
          <button
            className={`notification-btn${hasNotification && !showNotifications ? ' shake' : ''}`}
            aria-label="Notificaciones"
            onClick={() => setShowNotifications((v) => !v)}
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
          <button className="notebooks-hamburger-btn" aria-label="Menú" onClick={toggleMenu}>
            <span className="notebooks-hamburger-line"></span>
            <span className="notebooks-hamburger-line"></span>
            <span className="notebooks-hamburger-line"></span>
          </button>
          {/* Menú de notificaciones */}
          {showNotifications && (
            <div
              ref={notificationMenuRef}
              style={{
                position: 'absolute',
                top: 50,
                right: 20,
                background: 'white',
                color: '#222',
                border: '1px solid #eee',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                padding: 16,
                minWidth: 220,
                zIndex: 10000,
              }}
            >
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
                {todayEvents.length > 0 || smartEvents.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {todayEvents.map((event) => (
                      <li
                        key={event.id}
                        style={{ cursor: 'pointer', padding: '6px 0', color: '#6147FF', fontWeight: 500 }}
                        onClick={() => {
                          setShowNotifications(false);
                          navigate('/calendar');
                        }}
                      >
                        📅 {event.title}
                      </li>
                    ))}
                    {smartEvents.map((event) => (
                      <li
                        key={event.id}
                        style={{ cursor: 'pointer', padding: '6px 0', color: '#10b981', fontWeight: 500 }}
                        onClick={() => {
                          setShowNotifications(false);
                          navigate('/study', { state: { selectedNotebookId: event.notebookId } });
                        }}
                      >
                        {event.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>No tienes notificaciones nuevas.</div>
                )}
              </div>
            </div>
          )}
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
            <button className={`side-menu-button calendar-button${isCalendarPage ? ' disabled' : ''}`} onClick={isCalendarPage ? undefined : handleCalendarClick} disabled={isCalendarPage}>
              <i className="fas fa-calendar-alt"></i>
              <span>Calendario</span>
            </button>
            <button className="side-menu-button help-button" onClick={handleHelpClick}>
              <i className="fas fa-question-circle"></i> 
              <span>Ayuda</span>
            </button>
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
          <div className="upgrade-modal-content">
            <div className="modal-header">
              <h2>🚀 Upgrade a Pro</h2>
              <button className="close-button" onClick={handleCloseUpgradeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="upgrade-motivational-section">
                <h3>💡 Invierte en tu futuro y desarrollo</h3>
                <p className="motivational-text">
                  Al hacer el upgrade a Pro, no solo estás desbloqueando funcionalidades avanzadas, 
                  sino que estás invirtiendo en tu crecimiento personal y profesional. 
                  Cada concepto que aprendas, cada herramienta que utilices, 
                  te acerca un paso más a tus metas y objetivos.
                </p>
                <p className="motivational-text">
                  <strong>¡Tu desarrollo es nuestra prioridad!</strong> 
                  Descubre todo el potencial que Simonkey Pro tiene para ofrecerte.
                </p>
              </div>
              
              <div className="upgrade-support-section">
                <h4>📧 ¿Necesitas ayuda para decidir?</h4>
                <p>Nuestro equipo de soporte está aquí para ayudarte:</p>
                <div className="support-contact">
                  <i className="fas fa-envelope"></i>
                  <span>soporte@simonkey.com</span>
                </div>
                <p className="support-note">
                  Te responderemos en menos de 24 horas con toda la información que necesites.
                </p>
              </div>
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