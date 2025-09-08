import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import './App.css';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import CTA from './components/CTA';
import Footer from './components/Footer';
import Pricing from './pages/Pricing';
import SimonkeyCarousel from './components/SimonkeyCarousel';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PasswordActionPage from './pages/PasswordActionPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import Notebooks from './pages/Notebooks';
import NotebookDetailWrapper from './pages/NotebookDetailWrapper';
import ConceptDetail from './pages/ConceptDetail';
import ExplainConceptPage from './pages/ExplainConceptPage';
import SharedNotebook from './pages/SharedNotebook';
import VoiceSettingsPage from './pages/VoiceSettingsPage';
import SuperAdminPage from './pages/SuperAdminPage';
import DevelopmentPage from './pages/DevelopmentPage';
// Nuevas importaciones
import OnboardingComponent from './components/Onboarding/OnboardingComponent';
import ProfileCompletionModal from './components/ProfileCompletion/ProfileCompletionModal';
import MobileNavigation from './components/Mobile/MobileNavigation';
// Importamos también las nuevas páginas referenciadas en las rutas
import StudyModePage from './pages/StudyModePage';
import QuizModePage from './pages/QuizModePage';
import ProgressPage from './pages/ProgressPage';
import ClassAnalyticsPage from './pages/ClassAnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import GamesPage from './pages/GamesPage';
import VoiceRecognitionPage from './pages/VoiceRecognitionPage';
import FillInTheBlankPage from './pages/FillInTheBlankPage';
import UniversityDashboard from './pages/UniversityDashboard';
import UniversityCursos from './pages/UniversityCursos';
import UniversityBiblioteca from './pages/UniversityBiblioteca';
// Importar utilidad para corregir tiempos de sesiones
import './utils/fixStudySessionsTime';
// Importar utilidad para debug de tiempos
import './utils/debugStudyTime';
// Importar utilidad para ajustar tiempos
import './utils/adjustStudyTimes';
// Importar utilidad de KPIs para depuración
import './utils/forceUpdateKPIs';
// Importar utilidad para recalcular scores
import './utils/recalculateScores';
// Importar utilidad para arreglar perfil de estudiante
import './utils/fixStudentProfile';
// Importar utilidad para debug de materias de estudiante
import './utils/debugStudentMaterias';
import './utils/debugExams';
import './utils/verifyStudentExams';
import './utils/cleanStudentData';
import './utils/debugTeacherKpis';
import './utils/debugNotifications';
import ExamplesPage from './pages/ExamplesPage';
import FAQPage from './pages/FAQPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
// Importar el listener global de notificaciones
import { globalNotificationListener } from './services/globalNotificationListener';
import JoinSimonkeyBannerInline from './components/JoinSimonkeyBannerInline';
import AboutSimonkeyInline from './components/AboutSimonkeyInline';
// Sistema de profesores independientes
import TeacherMateriaRedirect from './components/TeacherMateriaRedirect';
import TeacherExamsPage from './pages/TeacherExamsPage';
import IndependentTeacherAnalyticsPage from './components/analytics/IndependentTeacherAnalyticsPage';
import CalendarPage from './pages/CalendarPage';
import StudentExamsPage from './pages/StudentExamsPage';
import ExamPage from './pages/ExamPage';
import ExamResultsPage from './pages/ExamResultsPage';
import ExamDashboardPage from './pages/ExamDashboardPage';
import JoinWithInvitePage from './pages/JoinWithInvitePage';
// Importaciones del sistema de cookies y privacidad
import CookieManager from './components/CookieConsent/CookieManager';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
// Importar el nuevo AuthProvider y useAuth
import { AuthProvider, useAuth } from './contexts/AuthContext';
// Importar el hook useUserType para detectar usuarios escolares
import { useUserType } from './hooks/useUserType';
import { useEnrollmentStatus } from './hooks/useEnrollmentStatus';
// DESHABILITADO: Ya no forzamos cambio de contraseña
// import ChangePasswordRequired from './pages/ChangePasswordRequired';
import PasswordChangeGuard from './components/Guards/PasswordChangeGuard';
// Importar el guard de verificación de email
import EmailVerificationGuard from './components/EmailVerificationGuard';
// Importar auth de firebase
import { auth } from './services/firebase';
// Importar ProtectedRoute
import ProtectedRoute from './components/ProtectedRoute';
// Importar CookieConsentBanner
import CookieConsentBanner from './components/CookieConsent/CookieConsentBanner';
// Importar AuthCleaner
import AuthCleaner from './components/AuthCleaner';
// Importar AuthUnlocker
import AuthUnlocker from './components/AuthUnlocker';
// Importar AuthDiagnostic
// import AuthDiagnostic from './components/AuthDiagnostic';
import SuperAdminRoute from './pages/SuperAdminRoute';
// Importar monitor de inactividad
import InactivityMonitor from './components/InactivityMonitor';
// Importar utilidad para arreglar perfil de usuario (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  import('./utils/fixUserProfile');
  import('./utils/setUserEnrolled');
}
// Importar funciones de debug para profesores
import './utils/browserDebugTeacher';
import './utils/fixTeacherSubjectsMapping';
import './utils/generateFirebaseCommands';
import './utils/debugCurrentUser';
import './utils/verifyFirebaseSetup';
import './utils/fixTeacherProfile';
import './utils/testGenerateConcepts';
import Materias from './pages/Materias';
import InicioPage from './pages/InicioPage';
import TeacherHomePage from './pages/TeacherHomePage';
// Importar utilidad de limpieza de notebooks huérfanos
import './utils/cleanOrphanNotebooks';
import './utils/forceUpdateStreak';
import './utils/fixStudentNotebooks';
import HelpWhatsAppButton from './components/HelpWhatsAppButton';
import StudySessionPage from './pages/StudySessionPage';
import ExamTestPage from './pages/ExamTestPage';

// Definir el tipo para el usuario
interface User {
  id?: string;
  name?: string;
  email?: string;
  photoURL?: string;
  isAuthenticated: boolean;
}

// Crear el contexto para el usuario
export const UserContext = createContext<{
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
}>({
  user: { isAuthenticated: false },
  setUser: () => {},
});

// Un componente wrapper que no usa hooks de React Router
const HomePage: React.FC = () => {
  return <HomePageContent />;
};

// Componente que usa los hooks de React Router
const HomePageContent: React.FC = () => {
  const location = useLocation();
  const images = [
    { id: 1, src: '/img/image1.png', alt: 'Image 1' },
    { id: 2, src: '/img/image2.png', alt: 'Image 2' },
    { id: 3, src: '/img/image3.png', alt: 'Image 3' },
    { id: 4, src: '/img/image4.png', alt: 'Image 4' },
    { id: 5, src: '/img/image5.png', alt: 'Image 5' },
    { id: 6, src: '/img/image6.png', alt: 'Image 6' },
    { id: 7, src: '/img/image7.png', alt: 'Image 7' },
    { id: 8, src: '/img/image8.png', alt: 'Image 8' },
    { id: 9, src: '/img/image9.png', alt: 'Image 9' },
  ];

  useEffect(() => {
    // Comprobar si hay un hash en la URL o un elemento guardado en localStorage
    const hash = location.hash.replace('#', '');
    const savedSection = localStorage.getItem('scrollTo');
    
    if (hash || savedSection) {
      const targetId = hash || savedSection || '';
      setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
        // Limpiar localStorage después de usar
        if (savedSection) {
          localStorage.removeItem('scrollTo');
        }
      }, 100); // Pequeño retraso para asegurar que los componentes estén renderizados
    }
  }, [location]);

  return (
    <div style={{ background: '#f9fafb' }}>
      <Header />
      <Hero />
      <JoinSimonkeyBannerInline />
      <AboutSimonkeyInline />
      <div id="how-it-works" style={{ marginBottom: '48px' }}>
        <HowItWorks />
      </div>
      {/* <SimonkeyCarousel images={images} autoPlayInterval={9000} /> */}
      <div id="features">
        <Features />
      </div>
      <CTA />
      <Footer />
    </div>
  );
};

// Componente animado para el título
const phrases = [
  { from: 'aburrido', to: 'divertido' },
  { from: 'difícil', to: 'fácil' },
  { from: 'estresante', to: 'motivante' },
  { from: 'confuso', to: 'claro' },
  { from: 'pesado', to: 'ligero' },
];

const AnimatedAprenderTitle: React.FC = () => {
  const [fromText, setFromText] = useState('');
  const [fromTachado, setFromTachado] = useState(false);
  const [toText, setToText] = useState('');
  const [cycle, setCycle] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCycle(t => t + 1);
      setPhraseIndex(i => (i + 1) % phrases.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setFromText('');
    setFromTachado(false);
    setToText('');
    let i = 0;
    let j = 0;
    let k = phrases[phraseIndex].from.length;
    // Escribe la palabra "from" letra por letra
    const escribirFrom = setInterval(() => {
      setFromText(phrases[phraseIndex].from.slice(0, i + 1));
      i++;
      if (i === phrases[phraseIndex].from.length) {
        clearInterval(escribirFrom);
        setTimeout(() => {
          setFromTachado(true);
          // Elimina la palabra from de derecha a izquierda
          const borrarFrom = setInterval(() => {
            k--;
            setFromText(phrases[phraseIndex].from.slice(0, k));
            if (k === 0) {
              clearInterval(borrarFrom);
              // Escribe la palabra "to" letra por letra
              const escribirTo = setInterval(() => {
                setToText(phrases[phraseIndex].to.slice(0, j + 1));
                j++;
                if (j === phrases[phraseIndex].to.length) clearInterval(escribirTo);
              }, 120);
            }
          }, 80);
        }, 400);
      }
    }, 120);
    return () => {
      clearInterval(escribirFrom);
    };
  }, [cycle, phraseIndex]);

  return (
    <h2 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: 20 }}>
      Estudiar con Simonkey es{' '}
      <span style={{ textDecoration: fromTachado ? 'line-through' : 'none', color: fromTachado ? '#e53935' : '#222', marginRight: 8, transition: 'all 0.5s' }}>{fromText}</span>
      <span style={{ color: '#4F46E5', fontWeight: 800 }}>{toText}</span>
    </h2>
  );
};

// Maintenance Mode Component
const MaintenanceMode: React.FC = () => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🚧 Mantenimiento</h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '1rem', maxWidth: '600px' }}>
        Estamos solucionando un problema técnico que está causando un bucle infinito en la aplicación.
      </p>
      <p style={{ fontSize: '1rem', marginBottom: '2rem', maxWidth: '600px' }}>
        Por favor, espera mientras resolvemos este problema. La aplicación estará disponible pronto.
      </p>
      <div style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.1)', 
        padding: '20px', 
        borderRadius: '10px',
        maxWidth: '500px'
      }}>
        <h3 style={{ marginBottom: '1rem' }}>Problema identificado:</h3>
        <ul style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <li>Bucle infinito en la autenticación</li>
          <li>Consumo excesivo de cuota de Firebase</li>
          <li>Múltiples listeners de autenticación</li>
        </ul>
      </div>
    </div>
  );
};

// Componente envoltorio para la aplicación con rutas
const AppWrapper: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

// Componente principal que contiene la lógica de la aplicación
const AppContent: React.FC = () => {
  const location = useLocation();
  const { user, userProfile, isAuthenticated, isEmailVerified, loading } = useAuth();
  const { isTeacher, isSuperAdmin, isUniversityUser, loading: userTypeLoading } = useUserType();
  const navigate = useNavigate();
  const { user: currentUser, setUser } = useContext(UserContext);
  
  // Hook para verificar y actualizar automáticamente el estado de inscripciones
  useEnrollmentStatus();

  // Inicializar listeners globales de notificaciones cuando el usuario esté autenticado
  useEffect(() => {
    if (isAuthenticated && user && !loading) {
      console.log('🔄 Usuario autenticado, asegurando que los listeners estén activos...');
      // Resetear y reinicializar para asegurar que siempre funcionen
      globalNotificationListener.reset();
      globalNotificationListener.initialize();
    }
  }, [isAuthenticated, user, loading]);

  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);



  // ENABLE MAINTENANCE MODE TO STOP FIREBASE OPERATIONS
  const MAINTENANCE_MODE = false;
  
  if (MAINTENANCE_MODE) {
    return <MaintenanceMode />;
  }

  // Mostrar mensaje de ayuda en consola
  useEffect(() => {
    // Función para mostrar el modal de completar perfil
    (window as any).showProfileModal = () => {
      console.log('📝 Mostrando modal de completar perfil...');
      setShowProfileCompletion(true);
    };
    
    // SIMONKEY - AYUDA DE DIAGNÓSTICO
    // Si tienes problemas de autenticación, ejecuta en la consola:
    console.log('   window.quickFix() - Solución rápida');
    console.log('   window.diagnoseAuthIssues() - Diagnóstico completo');
    console.log('   window.fixOrphanUser() - Arreglar usuario huérfano');
    console.log('   window.resetTutorial() - Resetear tutorial para testing');
    console.log('   window.showProfileModal() - Mostrar modal de completar perfil');
    console.log('==========================================');
  }, []);

  useEffect(() => {
    if (!loading && !userTypeLoading) {
      // Si no está autenticado y no está en una página pública, redirigir a login
      if (!isAuthenticated && !['/', '/login', '/signup', '/reset-password', '/pricing', '/privacy-policy', '/terms', '/examples', '/faq', '/about', '/contact'].includes(window.location.pathname)) {
        navigate('/login', { replace: true });
      }
      
      // Si está autenticado, manejar redirecciones
      if (isAuthenticated) {
        const currentPath = window.location.pathname;
        
        // Ya no redirigir profesores - todos usan las mismas rutas
        
        // TODOS LOS USUARIOS: Si está en login/signup y verificado, redirigir a inicio
        if (isEmailVerified && ['/login', '/signup'].includes(currentPath)) {
          navigate('/inicio', { replace: true });
        }
      }
    }
  }, [isAuthenticated, isEmailVerified, loading, userTypeLoading, isTeacher, navigate]);

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        backgroundColor: '#ffffff'
      }}>
        <FontAwesomeIcon icon={faSpinner} spin size="3x" style={{ color: '#6b7280' }} />
        <p style={{ fontSize: '1.1rem', margin: 0, color: '#6b7280' }}>Cargando Simonkey...</p>
      </div>
    );
  }
  
  // Show mobile navigation for all authenticated users except admin and tutor
  const showMobileNav = isAuthenticated;
  // const helpPages = [
  //   '/pricing',
  //   '/examples',
  //   '/faq',
  //   '/about',
  //   '/contact',
  //   '/terms',
  //   '/privacy-policy',
  // ];
  // const showHelpButton = helpPages.includes(location.pathname);

  // Ruta especial para reset-password sin wrappers
  const currentPath = location.pathname;
  console.log('Current path:', currentPath, 'Is reset-password?', currentPath === '/reset-password');
  
  if (currentPath === '/reset-password') {
    console.log('Rendering reset-password route directly');
    return (
      <UserContext.Provider value={{ user: user ? {
        id: user.uid,
        email: user.email || undefined,
        name: user.displayName || user.email?.split('@')[0] || undefined,
        photoURL: user.photoURL || undefined,
        isAuthenticated: true
      } : { isAuthenticated: false }, setUser: () => {} }}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<ResetPasswordPage />} />
        </Routes>
      </UserContext.Provider>
    );
  }

  return (
    <>
      {/* Monitor de inactividad - solo para usuarios autenticados */}
      <InactivityMonitor />
      
      <UserContext.Provider value={{ user: user ? {
        id: user.uid,
        email: user.email || undefined,
        name: user.displayName || user.email?.split('@')[0] || undefined,
        photoURL: user.photoURL || undefined,
        isAuthenticated: true
      } : { isAuthenticated: false }, setUser: () => {} }}>
        <Routes>
          {/* Ruta principal: redirige según el tipo de usuario */}
          <Route 
            path="/" 
            element={(() => {
              if (isAuthenticated) {
                // Usuarios universitarios van a sus cursos por defecto
                if (isUniversityUser) return <Navigate to="/university/cursos" replace />;
                // Usuarios escolares van a sus módulos específicos (sin requerir verificación de email)
                if (isTeacher) return <Navigate to="/teacher/home" replace />;
                // Usuarios regulares requieren verificación
                if (isEmailVerified) {
                  return <Navigate to="/inicio" replace />;
                }
              }
              // Usuarios no autenticados ven la página de inicio
              return <HomePage />;
            })()} 
          />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/password-action" element={<PasswordActionPage />} />
          <Route path="/verify-email" element={<EmailVerificationPage />} />
          <Route path="/join/:code" element={<JoinWithInvitePage />} />
          
          {/* Ruta legacy /app - redirige según el tipo de usuario */}
          <Route 
            path="/app" 
            element={(() => {
              if (isAuthenticated) {
                // Usuarios universitarios van a sus cursos por defecto
                if (isUniversityUser) return <Navigate to="/university/cursos" replace />;
                // Todos los usuarios autenticados van a inicio
                if (isEmailVerified) {
                  return <Navigate to="/inicio" replace />;
                }
                // Si no está verificado, ir a verificación
                return <Navigate to="/verify-email" replace />;
              }
              // Usuarios no autenticados van al login
              return <Navigate to="/login" replace />;
            })()} 
          />
          
          {/* Rutas legales - disponibles para todos */}
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          
          {/* DESHABILITADO: Ya no forzamos cambio de contraseña */}
          {/* <Route
            path="/change-password-required"
            element={
              isAuthenticated ? (
                <ChangePasswordRequired />
              ) : <Navigate to="/login" replace />
            }
          /> */}
          
          {/* Nuevas rutas informativas - disponibles para todos */}
          <Route path="/examples" element={<ExamplesPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          
          {/* Rutas protegidas - requieren autenticación Y verificación de email */}
          {/* Nueva ruta principal: Inicio */}
          <Route
            path="/inicio"
            element={
              isAuthenticated ? (
                // Redirigir usuarios universitarios a su dashboard
                isUniversityUser ? (
                  <Navigate to="/university" replace />
                ) : (
                  <EmailVerificationGuard>
                    <PasswordChangeGuard>
                      <InicioPage />
                    </PasswordChangeGuard>
                  </EmailVerificationGuard>
                )
              ) : <Navigate to="/login" replace />
            }
          />
          {/* Ruta de Materias */}
          <Route
            path="/materias"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <PasswordChangeGuard>
                    <Materias />
                  </PasswordChangeGuard>
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          {/* Notebooks dentro de una materia */}
          <Route
            path="/materias/:materiaName/notebooks"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <Notebooks />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/materias/:materiaName/notebooks/:notebookName/*"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <NotebookDetailWrapper />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/materias/:materiaName/notebooks/:notebookName/concepto/:conceptoId/:index"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <ConceptDetail />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          {/* Ruta legacy para notebooks (temporal, para compatibilidad) */}
          <Route
            path="/notebooks"
            element={
              isAuthenticated ? (
                <Navigate to="/inicio" replace />
              ) : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/notebooks/:notebookName/*"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <NotebookDetailWrapper />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/notebooks/:notebookName/concepto/:conceptoId/:index"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <ConceptDetail />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/tools/explain/:type/:notebookName"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <ExplainConceptPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          <Route path="/shared/:shareId" element={<SharedNotebook />} />
          
          {/* Nueva ruta para configuración de voz */}
          <Route
            path="/settings/voice"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <VoiceSettingsPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          {/* Nueva ruta para estudio */}
          <Route
            path="/study"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <StudyModePage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          {/* Nueva ruta para sesión de estudio */}
          <Route
            path="/study-session"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <StudySessionPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />

          <Route
            path="/exam-test"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <ExamTestPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          {/* Nueva ruta para progreso */}
          <Route
            path="/progress"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <ProgressPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          {/* Nueva ruta para analítica de clase */}
          <Route
            path="/classAnalytics"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <ClassAnalyticsPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          {/* Nueva ruta para perfil */}
          <Route
            path="/profile"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <ProfilePage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          {/* Nueva ruta para quiz */}
          <Route
            path="/quiz"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <QuizModePage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          {/* Nueva ruta para games */}
          <Route
            path="/games"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <GamesPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />

          {/* Ruta para reconocimiento de voz */}
          <Route
            path="/voice-recognition"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <VoiceRecognitionPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          <Route
            path="/fill-in-the-blank"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <FillInTheBlankPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          <Route
            path="/fill-in-the-blank/:subjectId"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <FillInTheBlankPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          
          {/* Rutas para usuarios universitarios */}
          <Route
            path="/university"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <PasswordChangeGuard>
                    <UniversityDashboard />
                  </PasswordChangeGuard>
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/university/cursos"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <PasswordChangeGuard>
                    <UniversityCursos />
                  </PasswordChangeGuard>
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/university/biblioteca"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <PasswordChangeGuard>
                    <UniversityBiblioteca />
                  </PasswordChangeGuard>
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          
          {/* Ruta /teacher/home ahora redirige a /inicio */}
          <Route
            path="/teacher/home"
            element={<Navigate to="/inicio" replace />}
          />
          {/* RUTAS DEL SISTEMA ESCOLAR ANTIGUO - DEPRECATED */}
          {/* Redirigir todas las rutas school a las nuevas rutas */}
          <Route
            path="/school/*"
            element={<Navigate to="/materias" replace />}
          />
          
          {/* Ruta para el panel de control del súper admin */}
          <Route
            path="/super-admin"
            element={<SuperAdminRoute />}
          />
          
          {/* Ruta para el área de desarrollo - Solo para developers y beta testers */}
          <Route
            path="/development"
            element={<DevelopmentPage />}
          />
          
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/exams" element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                {isTeacher ? <TeacherExamsPage /> : <StudentExamsPage />}
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          } />
          <Route path="/classAnalytics" element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <IndependentTeacherAnalyticsPage />
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          } />
          
          {/* Rutas para el sistema de exámenes */}
          <Route
            path="/exam/:examId"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <ExamPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/exam/:examId/results"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <ExamResultsPage />
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/exam/:examId/dashboard"
            element={
              isAuthenticated ? (
                <EmailVerificationGuard>
                  <PasswordChangeGuard>
                    <>
                      <ExamDashboardPage />
                    </>
                  </PasswordChangeGuard>
                </EmailVerificationGuard>
              ) : <Navigate to="/login" replace />
            }
          />
        </Routes>
        
        
        {showMobileNav && location.pathname !== '/super-admin' ? <MobileNavigation /> : null}
        {/* Sistema de gestión de cookies - siempre visible */}
        <CookieManager />
        {/* <AuthDiagnostic /> */}
      </UserContext.Provider>
      {!isAuthenticated && <HelpWhatsAppButton />}
    </>
  );
};

// Componente principal exportado
const App: React.FC = () => <AppWrapper />;

export default App;