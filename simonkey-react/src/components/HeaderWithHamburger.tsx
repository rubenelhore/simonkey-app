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
import { 
  faBell, 
  faHome, 
  faBook, 
  faGraduationCap, 
  faChartLine, 
  faCalendarAlt, 
  faCrown,
  faExpand,
  faCompress,
  faUserCog,
  faVolumeUp,
  faQuestionCircle,
  faStar,
  faSignOutAlt,
  faEnvelope,
  faFileAlt,
  faKey,
  faBars
} from '@fortawesome/free-solid-svg-icons';

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
  const { isSuperAdmin, subscription, isSchoolAdmin, isSchoolTeacher, isSchoolTutor, isSchoolStudent, isUniversityUser } = useUserType();
  const [isSidebarExpanded, setSidebarExpanded] = useState(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);
  const [todayEvents, setTodayEvents] = useState<{ id: string; title: string; type: string }[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [smartEvents, setSmartEvents] = useState<{ id: string; title: string; notebookId: string }[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Detectar si estamos en la página de configuración de voz
  const isVoiceSettingsPage = location.pathname === '/settings/voice';
  
  // Detectar si estamos en la página de perfil
  const isProfilePage = location.pathname === '/profile';

  // Detectar si estamos en la página de calendario
  const isCalendarPage = location.pathname === '/calendar';
  
  // Detectar si estamos en la página de inicio
  const isHomePage = location.pathname === '/inicio';
  
  // Detectar si estamos en la página de ayuda/contacto
  const isHelpPage = location.pathname === '/contact';
  
  // Detectar otras páginas
  const isMateriasPage = location.pathname === '/materias';
  const isStudyPage = location.pathname === '/study';
  const isProgressPage = location.pathname === '/progress';
  const isExamsPage = location.pathname === '/exams';

  const isFreeUser = subscription === 'free';

  // Obtener la inicial del usuario
  const getUserInitial = () => {
    if (user?.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  // Asegurar que el sidebar siempre esté colapsado al cargar la página
  useEffect(() => {
    setSidebarExpanded(false);
  }, []);

  // Obtener el nombre completo del usuario
  const getUserFullName = () => {
    if (user?.displayName) {
      return user.displayName;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Usuario';
  };

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

  // Cargar notebooks del usuario (solo para estudiantes)
  useEffect(() => {
    if (!user) return;
    
    // No cargar notebooks para profesores o administradores escolares
    if (isSchoolTeacher || isSchoolAdmin) {
      setNotebooks([]);
      return;
    }
    
    const loadNotebooks = async () => {
      try {
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
      } catch (error) {
        console.error('Error cargando notebooks:', error);
        setNotebooks([]);
      }
    };
    loadNotebooks();
  }, [user, isSchoolTeacher, isSchoolAdmin]);

  // Buscar estudios inteligentes disponibles hoy
  useEffect(() => {
    async function fetchSmartEvents() {
      if (!user || notebooks.length === 0) return;
      
      // No buscar estudios inteligentes para profesores o administradores
      if (isSchoolTeacher || isSchoolAdmin) return;
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

  // Logs de depuración (comentados para reducir spam en consola)
  // useEffect(() => {
  //   console.log('🔍 HeaderWithHamburger - Estado actual:');
  //   console.log('  - user:', user);
  //   console.log('  - userProfile:', userProfile);
  //   console.log('  - isSuperAdmin:', isSuperAdmin);
  //   console.log('  - subscription:', subscription);
  // }, [user, userProfile, isSuperAdmin, subscription]);

  const handleSidebarMouseEnter = () => {
    setSidebarExpanded(true);
  };

  const handleSidebarMouseLeave = () => {
    setSidebarExpanded(false);
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
  };

  // Función helper para navegación en móvil
  const handleMobileNavigation = (path: string) => {
    setMobileSidebarOpen(false);
    navigate(path);
  };

  // Determinar si debe mostrar el texto del sidebar
  const showSidebarText = isSidebarExpanded || isMobileSidebarOpen;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
    }
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

  // Forzar reajuste de módulos cuando cambia el sidebar
  useEffect(() => {
    const forceResize = () => {
      // Disparar evento de resize para que los módulos se reajusten
      window.dispatchEvent(new Event('resize'));
      
      // Forzar reflow
      const contentWrapper = document.querySelector('.content-wrapper');
      if (contentWrapper) {
        // Aplicar estilos directamente via JavaScript
        const elements = contentWrapper.querySelectorAll('*');
        elements.forEach((el: any) => {
          if (el.style) {
            el.style.maxWidth = '100%';
            el.style.boxSizing = 'border-box';
          }
        });
        
        // Específicamente para dashboard-content
        const dashboardContent = contentWrapper.querySelector('.dashboard-content');
        if (dashboardContent) {
          (dashboardContent as HTMLElement).style.maxWidth = '100%';
          (dashboardContent as HTMLElement).style.margin = '0';
          (dashboardContent as HTMLElement).style.width = '100%';
        }
      }
    };

    // Pequeño delay para asegurar que las transiciones terminen
    const timeoutId = setTimeout(forceResize, 100);
    return () => clearTimeout(timeoutId);
  }, [isSidebarExpanded]);

  // Detectar cambios en el estado de pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // El cierre del popup ahora se maneja con el overlay onClick

  return (
    <div className={`header-with-hamburger-container ${isSidebarExpanded ? 'menu-open' : ''} ${isFullscreen ? 'fullscreen-mode' : ''} ${isMobileSidebarOpen ? 'mobile-sidebar-open' : ''}`}>
      
      {/* Header limitado */}
      <header className="limited-header">
        <div className="header-content-limited">
          {/* Sección izquierda: Botón hamburguesa y pantalla completa */}
          <div className="header-left-section">
            <button 
              className="hamburger-btn mobile-only"
              onClick={() => setMobileSidebarOpen(!isMobileSidebarOpen)}
              title="Menú"
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
            <button 
              className="fullscreen-btn desktop-only"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
            </button>
          </div>

          {/* Título de la página */}
          <div className="page-title-section-limited">
            <h2 className="page-title-limited">{title}</h2>
            {subtitle && <p className="page-subtitle-limited">{subtitle}</p>}
          </div>

          {/* Botón de notificaciones en esquina superior derecha */}
          <button 
            className={`notification-btn-header ${hasNotification && !showNotifications ? 'notification-highlight' : ''}`} 
            onClick={() => setShowNotifications((v) => !v)} 
            title="Notificaciones"
          >
            <FontAwesomeIcon icon={faBell} />
            {hasNotification && (
              <span className="notification-dot-header"></span>
            )}
          </button>
        </div>
      </header>
      
      {/* Overlay para móvil */}
      {isMobileSidebarOpen && (
        <div 
          className="mobile-overlay"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      
      {/* Nueva barra lateral fija */}
      <div 
        className={`sidebar-nav ${isSidebarExpanded ? 'sidebar-expanded' : ''} ${isMobileSidebarOpen ? 'mobile-open' : ''}`}
        onMouseEnter={window.innerWidth > 768 ? handleSidebarMouseEnter : undefined}
        onMouseLeave={window.innerWidth > 768 ? handleSidebarMouseLeave : undefined}
      >
        {/* Logo */}
        <div className="sidebar-header">
          <div className="sidebar-logo" onClick={() => {
            setMobileSidebarOpen(false);
            if (isUniversityUser) {
              navigate('/university');
            } else if (isSchoolAdmin) {
              navigate('/school/admin');
            } else if (isSchoolTeacher) {
              navigate('/teacher/home');
            } else if (isSchoolTutor) {
              navigate('/school/tutor');
            } else {
              navigate('/inicio');
            }
          }} title="Ir al inicio">
            <img
              src="/img/favicon.svg"
              alt="Logo Simonkey"
              width="32"
              height="32"
            />
            {showSidebarText && (
              <div className="sidebar-logo-text">
                <span>Simon</span><span>key</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Iconos de navegación */}
        <div className="sidebar-icons">
          {isUniversityUser ? (
            <>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/university/cursos' ? 'active' : ''}`} 
                onClick={() => navigate('/university/cursos')}
                title="Mis cursos"
              >
                <FontAwesomeIcon icon={faGraduationCap} />
                {showSidebarText && <span>Mis cursos</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/university/biblioteca' ? 'active' : ''}`} 
                onClick={() => navigate('/university/biblioteca')}
                title="Biblioteca"
              >
                <FontAwesomeIcon icon={faBook} />
                {showSidebarText && <span>Biblioteca</span>}
              </button>
            </>
          ) : isSchoolAdmin ? (
            <>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/materias' ? 'active' : ''}`} 
                onClick={() => navigate('/materias')}
                title="Materias"
              >
                <FontAwesomeIcon icon={faBook} />
                {showSidebarText && <span>Materias</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/school/admin' ? 'active' : ''}`} 
                onClick={() => navigate('/school/admin')}
                title="Analítica"
              >
                <FontAwesomeIcon icon={faChartLine} />
                {showSidebarText && <span>Analítica</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/school/admin/passwords' ? 'active' : ''}`} 
                onClick={() => navigate('/school/admin/passwords')}
                title="Contraseñas"
              >
                <FontAwesomeIcon icon={faKey} />
                {showSidebarText && <span>Contraseñas</span>}
              </button>
            </>
          ) : isSchoolTeacher ? (
            <>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/teacher/home' ? 'active' : ''}`} 
                onClick={() => navigate('/teacher/home')}
                title="Inicio"
              >
                <FontAwesomeIcon icon={faHome} />
                {showSidebarText && <span>Inicio</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/materias' || location.pathname.includes('/materias/') ? 'active' : ''}`} 
                onClick={() => navigate('/materias')}
                title="Materias"
              >
                <FontAwesomeIcon icon={faBook} />
                {showSidebarText && <span>Materias</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/school/teacher/exams' ? 'active' : ''}`} 
                onClick={() => navigate('/school/teacher/exams')}
                title="Mis exámenes"
              >
                <FontAwesomeIcon icon={faFileAlt} />
                {showSidebarText && <span>Mis exámenes</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/school/teacher/analytics' ? 'active' : ''}`} 
                onClick={() => navigate('/school/teacher/analytics')}
                title="Analítica"
              >
                <FontAwesomeIcon icon={faChartLine} />
                {showSidebarText && <span>Analítica</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/calendar' ? 'active' : ''}`} 
                onClick={() => navigate('/calendar')}
                title="Calendario"
              >
                <FontAwesomeIcon icon={faCalendarAlt} />
                {showSidebarText && <span>Calendario</span>}
              </button>
            </>
          ) : isSchoolTutor ? (
            <>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/school/tutor' ? 'active' : ''}`} 
                onClick={() => navigate('/school/tutor')}
                title="Analítica"
              >
                <FontAwesomeIcon icon={faChartLine} />
                {showSidebarText && <span>Analítica</span>}
              </button>
            </>
          ) : isSchoolStudent ? (
            <>
              <button 
                className={`sidebar-icon-btn ${isHomePage ? 'active' : ''}`} 
                onClick={() => handleMobileNavigation('/inicio')}
                title="Inicio"
              >
                <FontAwesomeIcon icon={faHome} />
                {showSidebarText && <span>Inicio</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${isMateriasPage ? 'active' : ''}`} 
                onClick={() => handleMobileNavigation('/materias')}
                title="Mis materias"
              >
                <FontAwesomeIcon icon={faBook} />
                {showSidebarText && <span>Mis materias</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${isStudyPage ? 'active' : ''}`} 
                onClick={() => handleMobileNavigation('/study')}
                title="Estudiar"
              >
                <FontAwesomeIcon icon={faGraduationCap} />
                {showSidebarText && <span>Estudiar</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${location.pathname === '/exams' ? 'active' : ''}`} 
                onClick={() => handleMobileNavigation('/exams')}
                title="Mis exámenes"
              >
                <FontAwesomeIcon icon={faFileAlt} />
                {showSidebarText && <span>Mis exámenes</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${isProgressPage ? 'active' : ''}`} 
                onClick={() => handleMobileNavigation('/progress')}
                title="Mi progreso"
              >
                <FontAwesomeIcon icon={faChartLine} />
                {showSidebarText && <span>Mi progreso</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${isCalendarPage ? 'active' : ''}`} 
                onClick={handleCalendarClick} 
                title="Calendario"
              >
                <FontAwesomeIcon icon={faCalendarAlt} />
                {showSidebarText && <span>Calendario</span>}
              </button>
            </>
          ) : (
            <>
              <button 
                className={`sidebar-icon-btn ${isHomePage ? 'active' : ''}`} 
                onClick={() => handleMobileNavigation('/inicio')}
                title="Inicio"
              >
                <FontAwesomeIcon icon={faHome} />
                {showSidebarText && <span>Inicio</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${isMateriasPage ? 'active' : ''}`} 
                onClick={() => handleMobileNavigation('/materias')}
                title="Mis materias"
              >
                <FontAwesomeIcon icon={faBook} />
                {showSidebarText && <span>Mis materias</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${isStudyPage ? 'active' : ''}`} 
                onClick={() => handleMobileNavigation('/study')}
                title="Estudiar"
              >
                <FontAwesomeIcon icon={faGraduationCap} />
                {showSidebarText && <span>Estudiar</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${isProgressPage ? 'active' : ''}`} 
                onClick={() => handleMobileNavigation('/progress')}
                title="Mi progreso"
              >
                <FontAwesomeIcon icon={faChartLine} />
                {showSidebarText && <span>Mi progreso</span>}
              </button>
              <button 
                className={`sidebar-icon-btn ${isCalendarPage ? 'active' : ''}`} 
                onClick={handleCalendarClick} 
                title="Calendario"
              >
                <FontAwesomeIcon icon={faCalendarAlt} />
                {showSidebarText && <span>Calendario</span>}
              </button>
            </>
          )}
          {isSuperAdmin && (
            <button 
              className="sidebar-icon-btn" 
              onClick={() => { setMobileSidebarOpen(false); handleSuperAdminClick(); }}
              title="Súper Admin"
            >
              <FontAwesomeIcon icon={faCrown} />
              <span>Súper Admin</span>
            </button>
          )}
        </div>
        
        {/* Sección de usuario al final */}
        <div className="sidebar-user-section">
          <div 
            className="user-avatar-container"
            onClick={() => {
              setMobileSidebarOpen(false);
              setIsUserMenuOpen(!isUserMenuOpen);
            }}
            title="Opciones de usuario"
          >
            <div className="user-avatar">
              {getUserInitial()}
            </div>
            {showSidebarText && (
              <div className="user-info">
                <span className="user-name">{getUserFullName()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Menú de notificaciones */}
      {showNotifications && (
        <div
          ref={notificationMenuRef}
          style={{
            position: 'fixed',
            top: '70px',
            right: '1rem',
            background: 'white',
            color: '#222',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            padding: 20,
            minWidth: 280,
            maxWidth: 320,
            zIndex: 10000,
          }}
        >
          <button
            onClick={() => setShowNotifications(false)}
            aria-label="Cerrar notificaciones"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'none',
              border: 'none',
              fontSize: 18,
              color: '#6b7280',
              cursor: 'pointer',
              padding: 4,
              borderRadius: '50%',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600, color: '#1f2937' }}>
            🔔 Notificaciones
          </h3>
          <div>
            {todayEvents.length > 0 || smartEvents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todayEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{ 
                      cursor: 'pointer', 
                      padding: '12px', 
                      backgroundColor: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      setShowNotifications(false);
                      navigate('/calendar');
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e2e8f0';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#6147FF' }}>
                      📅 {event.title}
                    </div>
                  </div>
                ))}
                {smartEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{ 
                      cursor: 'pointer', 
                      padding: '12px', 
                      backgroundColor: '#f0fdf4',
                      borderRadius: 8,
                      border: '1px solid #bbf7d0',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      setShowNotifications(false);
                      navigate('/study', { state: { selectedNotebookId: event.notebookId } });
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dcfce7';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f0fdf4';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#10b981' }}>
                      {event.title}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                color: '#6b7280', 
                fontSize: '0.9rem',
                padding: '20px 0'
              }}>
                📭 No tienes notificaciones nuevas
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Popup del menú de usuario fuera del sidebar */}
      {isUserMenuOpen && (
        <div 
          className="user-menu-popup-overlay"
          onClick={() => setIsUserMenuOpen(false)}
        >
          <div 
            className="user-menu-popup-external" 
            ref={userMenuRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="user-menu-header">
              <div className="user-avatar-large">
                {getUserInitial()}
              </div>
              <div className="user-details">
                <h4>{getUserFullName()}</h4>
                <p>{user?.email}</p>
              </div>
            </div>
            <div className="user-menu-options">
              <button 
                className={`user-menu-btn ${isProfilePage ? 'disabled' : ''}`}
                onClick={() => {
                  if (!isProfilePage) {
                    handleProfileClick();
                    setIsUserMenuOpen(false);
                  }
                }}
                disabled={isProfilePage}
              >
                <FontAwesomeIcon icon={faUserCog} />
                <span>Mi perfil</span>
              </button>
              <button 
                className={`user-menu-btn ${isVoiceSettingsPage ? 'disabled' : ''}`}
                onClick={() => {
                  if (!isVoiceSettingsPage) {
                    handleVoiceSettingsClick();
                    setIsUserMenuOpen(false);
                  }
                }}
                disabled={isVoiceSettingsPage}
              >
                <FontAwesomeIcon icon={faVolumeUp} />
                <span>Configuración de voz</span>
              </button>
              <button 
                className={`user-menu-btn ${isHelpPage ? 'disabled' : ''}`}
                onClick={() => {
                  if (!isHelpPage) {
                    handleHelpClick();
                    setIsUserMenuOpen(false);
                  }
                }}
                disabled={isHelpPage}
              >
                <FontAwesomeIcon icon={faQuestionCircle} />
                <span>Ayuda</span>
              </button>
              {isFreeUser && (
                <button 
                  className="user-menu-btn upgrade-btn"
                  onClick={() => {
                    handleOpenUpgradeModal();
                    setIsUserMenuOpen(false);
                  }}
                >
                  <FontAwesomeIcon icon={faStar} />
                  <span>Upgrade a Pro</span>
                </button>
              )}
              <div className="user-menu-divider"></div>
              <button 
                className="user-menu-btn logout-btn"
                onClick={() => {
                  handleLogout();
                  setIsUserMenuOpen(false);
                }}
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
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
                  <FontAwesomeIcon icon={faEnvelope} />
                  <span>ruben@simonkey.ai</span>
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
      <div 
        className="content-wrapper"
        style={{ 
          marginLeft: isSidebarExpanded ? '250px' : '60px', 
          paddingTop: '64px',
          width: isSidebarExpanded ? 'calc(100vw - 250px)' : 'calc(100vw - 60px)',
          maxWidth: isSidebarExpanded ? 'calc(100vw - 250px)' : 'calc(100vw - 60px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxSizing: 'border-box',
          overflow: 'hidden'
        } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
};

export default HeaderWithHamburger; 