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
import NotebookDetail from './pages/NotebookDetail';
import ConceptDetail from './pages/ConceptDetail';
import ExplainConceptPage from './pages/ExplainConceptPage';
import SharedNotebook from './pages/SharedNotebook';
import VoiceSettingsPage from './pages/VoiceSettingsPage';
import SuperAdminPage from './pages/SuperAdminPage';
// Nuevas importaciones
import OnboardingComponent from './components/Onboarding/OnboardingComponent';
import MobileNavigation from './components/Mobile/MobileNavigation';
// Importamos también las nuevas páginas referenciadas en las rutas
import StudyModePage from './pages/StudyModePage';
import QuizModePage from './pages/QuizModePage';
import ProgressPage from './pages/ProgressPage';
import ProfilePage from './pages/ProfilePage';
// Importaciones para el sistema escolar
import SchoolTeacherNotebooksPage from './pages/SchoolTeacherNotebooksPage';
import SchoolStudentStudyPage from './pages/SchoolStudentStudyPage';
// Importaciones del sistema de cookies y privacidad
import CookieManager from './components/CookieConsent/CookieManager';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
// Importar el nuevo AuthProvider y useAuth
import { AuthProvider, useAuth } from './contexts/AuthContext';
// Importar el hook useUserType para detectar usuarios escolares
import { useUserType } from './hooks/useUserType';
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
import AuthDiagnostic from './components/AuthDiagnostic';
import SchoolNotebookDetail from './pages/SchoolNotebookDetail';
import SchoolNotebookConcepts from './pages/SchoolNotebookConcepts';

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
    <div>
      <Header />
      <Hero />
      <SimonkeyCarousel images={images} />
      <div id="features">
        <Features />
      </div>
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <CTA />
      <Footer />
    </div>
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
  const { user, isAuthenticated, isEmailVerified, loading } = useAuth();
  const { isSchoolTeacher, isSchoolStudent, isSuperAdmin, loading: userTypeLoading } = useUserType();
  const navigate = useNavigate();
  const location = useLocation();

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
      if (!isAuthenticated && !['/', '/login', '/signup', '/pricing', '/privacy-policy', '/terms'].includes(window.location.pathname)) {
        navigate('/login', { replace: true });
      }
      
      // Si está autenticado, manejar redirecciones
      if (isAuthenticated) {
        const currentPath = window.location.pathname;
        
        // USUARIOS ESCOLARES: Redirigir desde login/signup a su módulo específico
        if ((isSchoolTeacher || isSchoolStudent) && ['/login', '/signup'].includes(currentPath)) {
          if (isSchoolTeacher) {
            console.log('🏫 App - Redirigiendo profesor escolar desde login a /school/teacher');
            navigate('/school/teacher', { replace: true });
          } else if (isSchoolStudent) {
            console.log('🎓 App - Redirigiendo estudiante escolar desde login a /school/student');
            navigate('/school/student', { replace: true });
          }
          return;
        }
        
        // USUARIOS NORMALES: Si está en login/signup y verificado, redirigir a notebooks
        if (!isSchoolTeacher && !isSchoolStudent && isEmailVerified && ['/login', '/signup'].includes(currentPath)) {
          navigate('/notebooks', { replace: true });
        }
      }
    }
  }, [isAuthenticated, isEmailVerified, loading, userTypeLoading, isSchoolTeacher, isSchoolStudent, navigate]);

  if (loading || userTypeLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e3e3e3',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ 
            color: '#636e72',
            margin: 0,
            fontSize: '14px'
          }}>
            Cargando...
          </p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }
  
  const showMobileNav = isAuthenticated && !location.pathname.startsWith('/school');

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
            if (isAuthenticated && isEmailVerified) {
              // Redirigir usuarios escolares a su módulo específico
              if (isSchoolTeacher) return <Navigate to="/school/teacher" replace />;
              if (isSchoolStudent) return <Navigate to="/school/student" replace />;
              // Usuarios normales van a notebooks
              return <Navigate to="/notebooks" replace />;
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
        
        {/* Rutas protegidas - requieren autenticación Y verificación de email */}
        <Route
          path="/notebooks"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                {isSuperAdmin ? (
                  <>
                    {!hasCompletedOnboarding && <OnboardingComponent onComplete={() => {
                      setHasCompletedOnboarding(true);
                      localStorage.setItem('hasCompletedOnboarding', 'true');
                    }} />}
                    <Notebooks />
                  </>
                ) : (
                  <SchoolUserGuard>
                    <>
                      {!hasCompletedOnboarding && <OnboardingComponent onComplete={() => {
                        setHasCompletedOnboarding(true);
                        localStorage.setItem('hasCompletedOnboarding', 'true');
                      }} />}
                      <Notebooks />
                    </>
                  </SchoolUserGuard>
                )}
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/notebooks/:id"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                {isSuperAdmin ? <NotebookDetail /> : <SchoolUserGuard><NotebookDetail /></SchoolUserGuard>}
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/notebooks/:notebookId/concepto/:conceptoId/:index"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                {isSuperAdmin ? <ConceptDetail /> : <SchoolUserGuard><ConceptDetail /></SchoolUserGuard>}
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/tools/explain/:type/:notebookId"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                {isSuperAdmin ? <ExplainConceptPage /> : <SchoolUserGuard><ExplainConceptPage /></SchoolUserGuard>}
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
                {isSuperAdmin ? <VoiceSettingsPage /> : <SchoolUserGuard><VoiceSettingsPage /></SchoolUserGuard>}
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
                {isSuperAdmin ? <StudyModePage /> : <SchoolUserGuard><StudyModePage /></SchoolUserGuard>}
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
                {isSuperAdmin ? <ProgressPage /> : <SchoolUserGuard><ProgressPage /></SchoolUserGuard>}
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
                {isSuperAdmin ? <ProfilePage /> : <SchoolUserGuard><ProfilePage /></SchoolUserGuard>}
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
                {isSuperAdmin ? <QuizModePage /> : <SchoolUserGuard><QuizModePage /></SchoolUserGuard>}
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
                <SchoolUserGuard>
                  <SchoolTeacherNotebooksPage />
                </SchoolUserGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/school/student"
          element={
            isAuthenticated ? (
              <EmailVerificationGuard>
                <SchoolUserGuard>
                  <SchoolStudentStudyPage />
                </SchoolUserGuard>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        
        {/* Ruta para el panel de control del súper admin */}
        <Route
          path="/super-admin"
          element={
            (() => {
              console.log('🔍 App - Super Admin route accessed');
              console.log('🔍 App - isAuthenticated:', isAuthenticated);
              console.log('🔍 App - isEmailVerified:', isEmailVerified);
              console.log('🔍 App - loading:', loading);
              console.log('🔍 App - current user email:', auth.currentUser?.email);
              console.log('🔍 App - current pathname:', window.location.pathname);
              
              if (isAuthenticated) {
                console.log('🔍 App - User is authenticated, checking if super admin...');
                // Verificar si realmente es super admin
                const userEmail = auth.currentUser?.email;
                const isSuperAdmin = userEmail === 'ruben.elhore@gmail.com';
                console.log('🔍 App - User email:', userEmail);
                console.log('🔍 App - Is super admin?', isSuperAdmin);
                
                if (isSuperAdmin) {
                  console.log('🔍 App - Rendering SuperAdminPage for super admin');
                  return <SuperAdminPage />;
                } else {
                  console.log('🔍 App - User is not super admin, redirecting to appropriate page');
                  // Redirigir a la página apropiada según el tipo de usuario
                  if (userEmail?.includes('@school.simonkey.com') || userEmail?.includes('@up.edu.mx')) {
                    console.log('🔍 App - Redirecting school user to /school/teacher');
                    return <Navigate to="/school/teacher" replace />;
                  } else {
                    console.log('🔍 App - Redirecting regular user to /notebooks');
                    return <Navigate to="/notebooks" replace />;
                  }
                }
              } else {
                console.log('🔍 App - User not authenticated, redirecting to login');
                return <Navigate to="/login" replace />;
              }
            })()
          }
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
      </Routes>
      {showMobileNav && <MobileNavigation />}
      {/* Sistema de gestión de cookies - siempre visible */}
      <CookieManager />
      <AuthDiagnostic />
    </UserContext.Provider>
  );
};

// Componente principal exportado
const App: React.FC = () => <AppWrapper />;

export default App;