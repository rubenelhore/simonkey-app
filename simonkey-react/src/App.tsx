import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
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
import EmailVerificationPage from './pages/EmailVerificationPage';
import Notebooks from './pages/Notebooks';
import NotebookDetailWrapper from './pages/NotebookDetailWrapper';
import ConceptDetail from './pages/ConceptDetail';
import ExplainConceptPage from './pages/ExplainConceptPage';
import SharedNotebook from './pages/SharedNotebook';
import VoiceSettingsPage from './pages/VoiceSettingsPage';
import SuperAdminPage from './pages/SuperAdminPage';
// Nuevas importaciones
import OnboardingComponent from './components/Onboarding/OnboardingComponent';
import MobileNavigation from './components/Mobile/MobileNavigation';
import TeacherMobileNavigation from './components/Mobile/TeacherMobileNavigation';
// Importamos también las nuevas páginas referenciadas en las rutas
import StudyModePage from './pages/StudyModePage';
import QuizModePage from './pages/QuizModePage';
import ProgressPage from './pages/ProgressPage';
import ProfilePage from './pages/ProfilePage';
// Importar utilidad para corregir tiempos de sesiones
import './utils/fixStudySessionsTime';
// Importar utilidad para debug de tiempos
import './utils/debugStudyTime';
// Importar utilidad para ajustar tiempos
import './utils/adjustStudyTimes';
// Importar utilidad de KPIs para depuración
import './utils/forceUpdateKPIs';
import ExamplesPage from './pages/ExamplesPage';
import FAQPage from './pages/FAQPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
// Importaciones para el sistema escolar
import SchoolTeacherNotebooksPage from './pages/SchoolTeacherNotebooksPage';
import SchoolTeacherMateriasPage from './pages/SchoolTeacherMateriasPage';
import SchoolTeacherMateriaNotebooksPage from './pages/SchoolTeacherMateriaNotebooksPage';
import SchoolTeacherAnalyticsPage from './pages/SchoolTeacherAnalyticsPage';
import SchoolStudentStudyPage from './pages/SchoolStudentStudyPage';
import SchoolAdminPage from './pages/SchoolAdminPage';
import SchoolTutorPage from './pages/SchoolTutorPage';
// Importaciones del sistema de cookies y privacidad
import CookieManager from './components/CookieConsent/CookieManager';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
// Importar el nuevo AuthProvider y useAuth
import { AuthProvider, useAuth } from './contexts/AuthContext';
// Importar el hook useUserType para detectar usuarios escolares
import { useUserType } from './hooks/useUserType';
// Importar el nuevo componente de cambio de contraseña
import ChangePasswordRequired from './pages/ChangePasswordRequired';
import PasswordChangeGuard from './components/Guards/PasswordChangeGuard';
// Importar el guard de verificación de email
import EmailVerificationGuard from './components/EmailVerificationGuard';
// Importar el guard para usuarios escolares
import SchoolUserGuard from './components/SchoolUserGuard';
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
import SchoolNotebookDetail from './pages/SchoolNotebookDetail';
import SchoolNotebookConcepts from './pages/SchoolNotebookConcepts';
import SuperAdminRoute from './pages/SuperAdminRoute';
// Importar utilidad para arreglar perfil de usuario (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  import('./utils/fixUserProfile');
}
// Importar funciones de debug para profesores
import './utils/browserDebugTeacher';
import './utils/fixTeacherSubjectsMapping';
import './utils/generateFirebaseCommands';
import './utils/debugCurrentUser';
import './utils/verifyFirebaseSetup';
import './utils/testGenerateConcepts';
import './utils/debugSchoolStudentStudy';
import './utils/debugSchoolQuiz';
import CalendarPage from './pages/CalendarPage';
import Materias from './pages/Materias';
// Importar utilidad de limpieza de notebooks huérfanos
import './utils/cleanOrphanNotebooks';

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
      {/* Sección completa de llamada a la acción */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          width: '100%',
          background: 'transparent',
          padding: '54px 0 70px 0', // reducido 30px arriba y abajo
          fontWeight: 700,
          fontSize: '2.1rem',
          color: '#111827',
          textAlign: 'center',
          letterSpacing: 0.1,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '100%',
            background: '#e5e7eb',
            padding: '22px 0 22px 0', // menos padding vertical
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 700, marginBottom: 24 }}>
              <span style={{ whiteSpace: 'nowrap', color: '#111827', fontWeight: 700 }}>Únete a Simonkey</span>&nbsp;
              <span style={{ whiteSpace: 'nowrap', color: '#111827', fontWeight: 700, fontSize: '1.2em' }}>→</span>&nbsp;
              <span style={{ whiteSpace: 'nowrap', color: '#4F46E5', fontWeight: 800 }}>cambia tu futuro</span>
            </div>
            <div style={{
              width: '100%',
              maxWidth: 1200,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 0,
              fontWeight: 500,
              fontSize: '1rem',
              letterSpacing: 0.03,
              color: '#111827',
              overflow: 'hidden',
              padding: '10px 0',
            }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', minWidth: 0 }}>Estudia a tu ritmo</div>
              <span style={{ color: '#b4b4b4', fontWeight: 400, margin: '0 12px', fontSize: '1.1em' }}>|</span>
              <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', minWidth: 0 }}>Convierte el repaso en hábito</div>
              <span style={{ color: '#b4b4b4', fontWeight: 400, margin: '0 12px', fontSize: '1.1em' }}>|</span>
              <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', minWidth: 0 }}>Desbloquea tu potencial</div>
              <span style={{ color: '#b4b4b4', fontWeight: 400, margin: '0 12px', fontSize: '1.1em' }}>|</span>
              <div style={{ flex: 1, textAlign: 'center', padding: '0 8px', minWidth: 0 }}>Aprende y disfruta el proceso</div>
            </div>
          </div>
        </div>
      </div>
      <section className="about-simonkey" style={{ width: '100%', background: '#f9fafb', padding: '0 0 0 0', textAlign: 'center', display: 'block', margin: 0, marginTop: '12px', marginBottom: '48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 48 }}>
          <div style={{ flex: '0 0 400px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
            <img src="/img/chango-feliz.png" alt="Chango feliz" style={{ width: 400, height: 400, borderRadius: '50%', objectFit: 'cover', marginLeft: 0 }} />
          </div>
          <div style={{ flex: 2, minWidth: 0, textAlign: 'left' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 700, color: '#111', margin: '0 0 10px', textAlign: 'center', letterSpacing: 0.1 }}>¿Qué es Simonkey?</h2>
              <div style={{ fontFamily: '"Segoe UI", "Arial", sans-serif', fontSize: '1rem', color: '#6366F1', marginBottom: 18, textAlign: 'center', fontStyle: 'italic', fontWeight: 400, letterSpacing: 0.05 }}>
                Tu compañero inteligente para aprender mejor cada día.
              </div>
              <p style={{ fontSize: '1.125rem', color: '#6B7280', marginBottom: 16, textAlign: 'center' }}>
                Simonkey es tu asistente inteligente de estudio, diseñado para adaptarse a tu ritmo y necesidades. <span style={{ color: '#4F46E5', fontWeight: 600 }}>Utiliza inteligencia artificial para ayudarte a aprender</span> de manera más eficiente, organizar tus conceptos, practicar con quizzes personalizados y mantenerte motivado en tu camino académico.
              </p>
            </div>
          </div>
        </div>
      </section>
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
  const { user, isAuthenticated, isEmailVerified, loading } = useAuth();
  const { isSchoolTeacher, isSchoolStudent, isSchoolAdmin, isSchoolTutor, isSuperAdmin, loading: userTypeLoading } = useUserType();
  const navigate = useNavigate();
  const { user: currentUser, setUser } = useContext(UserContext);

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return localStorage.getItem('hasCompletedOnboarding') === 'true';
  });

  // ENABLE MAINTENANCE MODE TO STOP FIREBASE OPERATIONS
  const MAINTENANCE_MODE = false;
  
  if (MAINTENANCE_MODE) {
    return <MaintenanceMode />;
  }

  // Mostrar mensaje de ayuda en consola
  useEffect(() => {
    console.log('🔧 === SIMONKEY - AYUDA DE DIAGNÓSTICO ===');
    console.log('💡 Si tienes problemas de autenticación, ejecuta en la consola:');
    console.log('   window.quickFix() - Solución rápida');
    console.log('   window.diagnoseAuthIssues() - Diagnóstico completo');
    console.log('   window.fixOrphanUser() - Arreglar usuario huérfano');
    console.log('==========================================');
  }, []);

  useEffect(() => {
    if (!loading && !userTypeLoading) {
      // Si no está autenticado y no está en una página pública, redirigir a login
      if (!isAuthenticated && !['/', '/login', '/signup', '/pricing', '/privacy-policy', '/terms', '/examples', '/faq', '/about', '/contact'].includes(window.location.pathname)) {
        navigate('/login', { replace: true });
      }
      
      // Si está autenticado, manejar redirecciones
      if (isAuthenticated) {
        const currentPath = window.location.pathname;
        
        // USUARIOS ESCOLARES: Redirigir a sus páginas específicas
        if (['/login', '/signup'].includes(currentPath)) {
          if (isSchoolTeacher) {
            console.log('🏫 App - Redirigiendo profesor escolar desde login a /school/teacher');
            navigate('/school/teacher', { replace: true });
            return;
          }
          if (isSchoolAdmin) {
            console.log('🏫 App - Redirigiendo admin escolar desde login a /school/admin');
            navigate('/school/admin', { replace: true });
            return;
          }
          if (isSchoolTutor) {
            console.log('🏫 App - Redirigiendo tutor escolar desde login a /school/tutor');
            navigate('/school/tutor', { replace: true });
            return;
          }
        }
        
        // TODOS LOS USUARIOS: Si está en login/signup y verificado, redirigir a materias
        if (isEmailVerified && ['/login', '/signup'].includes(currentPath)) {
          navigate('/materias', { replace: true });
        }
      }
    }
  }, [isAuthenticated, isEmailVerified, loading, userTypeLoading, isSchoolTeacher, isSchoolAdmin, isSchoolTutor, navigate]);

  if (loading) {
    return <div style={{width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#4F46E5'}}>Cargando...</div>;
  }
  
  // Show mobile navigation for all authenticated users except admin and tutor
  const showMobileNav = isAuthenticated && !isSchoolAdmin && !isSchoolTutor;
  const showTeacherNav = isAuthenticated && isSchoolTeacher && location.pathname.startsWith('/school/teacher');

  return (
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
              // Usuarios escolares van a sus módulos específicos (sin requerir verificación de email)
              if (isSchoolTeacher) return <Navigate to="/school/teacher" replace />;
              if (isSchoolAdmin) return <Navigate to="/school/admin" replace />;
              if (isSchoolTutor) return <Navigate to="/school/tutor" replace />;
              if (isSchoolStudent) return <Navigate to="/materias" replace />;
              // Usuarios regulares requieren verificación
              if (isEmailVerified) {
                return <Navigate to="/notebooks" replace />;
              }
            }
            // Usuarios no autenticados ven la página de inicio
            return <HomePage />;
          })()} 
        />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        
        {/* Rutas legales - disponibles para todos */}
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        
        {/* Ruta para cambio de contraseña obligatorio */}
        <Route
          path="/change-password-required"
          element={
            isAuthenticated ? (
              <ChangePasswordRequired />
            ) : <Navigate to="/login" replace />
          }
        />
        
        {/* Nuevas rutas informativas - disponibles para todos */}
        <Route path="/examples" element={<ExamplesPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        
        {/* Rutas protegidas - requieren autenticación Y verificación de email */}
        {/* Nueva ruta principal: Materias */}
        <Route
          path="/materias"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <PasswordChangeGuard>
                  <>
                    {!hasCompletedOnboarding && <OnboardingComponent onComplete={() => {
                      setHasCompletedOnboarding(true);
                      localStorage.setItem('hasCompletedOnboarding', 'true');
                    }} />}
                    <Materias />
                  </>
                </PasswordChangeGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        {/* Notebooks dentro de una materia */}
        <Route
          path="/materias/:materiaId/notebooks"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <Notebooks />
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/materias/:materiaId/notebooks/:id"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <NotebookDetailWrapper />
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/materias/:materiaId/notebooks/:notebookId/concepto/:conceptoId/:index"
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
              <EmailVerificationGuard>
                <>
                  {!hasCompletedOnboarding && <OnboardingComponent onComplete={() => {
                    setHasCompletedOnboarding(true);
                    localStorage.setItem('hasCompletedOnboarding', 'true');
                  }} />}
                  <Navigate to="/materias" replace />
                </>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/notebooks/:id"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <NotebookDetailWrapper />
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/notebooks/:notebookId/concepto/:conceptoId/:index"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <ConceptDetail />
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/tools/explain/:type/:notebookId"
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
        
        {/* Rutas para el sistema escolar */}
        <Route
          path="/school/teacher"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <PasswordChangeGuard>
                  <SchoolUserGuard>
                    <SchoolTeacherMateriasPage />
                  </SchoolUserGuard>
                </PasswordChangeGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/school/teacher/analytics"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <PasswordChangeGuard>
                  <SchoolUserGuard>
                    <SchoolTeacherAnalyticsPage />
                  </SchoolUserGuard>
                </PasswordChangeGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/school/teacher/materias/:materiaId/notebooks"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <PasswordChangeGuard>
                  <SchoolUserGuard>
                    <SchoolTeacherMateriaNotebooksPage />
                  </SchoolUserGuard>
                </PasswordChangeGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        {/* La ruta /school/student ya no es necesaria - los estudiantes usan las rutas normales */}
        <Route
          path="/school/student"
          element={<Navigate to="/materias" replace />}
        />
        
        {/* Ruta para el panel de administración escolar */}
        <Route
          path="/school/admin"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <PasswordChangeGuard>
                  <SchoolUserGuard>
                    <SchoolAdminPage />
                  </SchoolUserGuard>
                </PasswordChangeGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        
        {/* Ruta para el panel del tutor escolar */}
        <Route
          path="/school/tutor"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <PasswordChangeGuard>
                  <SchoolUserGuard>
                    <SchoolTutorPage />
                  </SchoolUserGuard>
                </PasswordChangeGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        
        {/* Ruta para el panel de control del súper admin */}
        <Route
          path="/super-admin"
          element={<SuperAdminRoute />}
        />
        <Route
          path="/school/notebooks/:id"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <SchoolUserGuard>
                  <SchoolNotebookDetail />
                </SchoolUserGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/school/notebooks/:notebookId/concepto/:conceptoId/:index"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <SchoolUserGuard>
                  <SchoolNotebookConcepts />
                </SchoolUserGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route path="/calendar" element={<CalendarPage />} />
      </Routes>
      {showTeacherNav ? <TeacherMobileNavigation /> : (showMobileNav && !location.pathname.startsWith('/school/teacher') && location.pathname !== '/super-admin' ? <MobileNavigation /> : null)}
      {/* Sistema de gestión de cookies - siempre visible */}
      <CookieManager />
      {/* <AuthDiagnostic /> */}
    </UserContext.Provider>
  );
};

// Componente principal exportado
const App: React.FC = () => <AppWrapper />;

export default App;