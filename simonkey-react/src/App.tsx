import React, { useEffect, useState, createContext } from 'react';
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
// Importaciones del sistema de cookies y privacidad
import CookieManager from './components/CookieConsent/CookieManager';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
// Importar el hook useAuth
import { useAuth } from './hooks/useAuth';
// Importar el guard de verificación de email
import EmailVerificationGuard from './components/EmailVerificationGuard';

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
    { id: 1, src: '/img/image1.jpg', alt: 'Image 1' },
    { id: 2, src: '/img/image2.jpg', alt: 'Image 2' },
    { id: 3, src: '/img/image3.jpg', alt: 'Image 3' },
    { id: 4, src: '/img/image4.jpg', alt: 'Image 4' },
    { id: 5, src: '/img/image5.jpg', alt: 'Image 5' },
    { id: 6, src: '/img/image6.jpg', alt: 'Image 6' },
    { id: 7, src: '/img/image7.jpg', alt: 'Image 7' },
    { id: 8, src: '/img/image8.jpg', alt: 'Image 8' },
    { id: 9, src: '/img/image9.jpg', alt: 'Image 9' },
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

// Componente envoltorio para la aplicación con rutas
const AppWrapper: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

// Componente principal que contiene la lógica de la aplicación
const AppContent: React.FC = () => {
  // Usar el hook useAuth en lugar del estado local
  const { user, isAuthenticated, isEmailVerified, loading, initializing } = useAuth();
  
  const navigate = useNavigate();

  // Estado para gestionar si el usuario ha completado el onboarding
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    // Check localStorage or user preferences from database
    return localStorage.getItem('hasCompletedOnboarding') === 'true';
  });

  // Efecto para redirigir usuarios no autenticados
  useEffect(() => {
    if (!loading && !initializing) {
      // Si no está autenticado y no está en una página pública, redirigir a login
      if (!isAuthenticated && !['/', '/login', '/signup', '/pricing', '/privacy-policy', '/terms'].includes(window.location.pathname)) {
        navigate('/login', { replace: true });
      }
      
      // Si está autenticado y verificado y está en login/signup, redirigir a notebooks
      if (isAuthenticated && isEmailVerified && ['/login', '/signup'].includes(window.location.pathname)) {
        navigate('/notebooks', { replace: true });
      }
    }
  }, [isAuthenticated, isEmailVerified, loading, initializing, navigate]);

  // Mostrar loading mientras se inicializa
  if (loading || initializing) {
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

  return (
    <UserContext.Provider value={{ user: user ? {
      id: user.uid,
      email: user.email || undefined,
      name: user.displayName || user.email?.split('@')[0] || undefined,
      photoURL: user.photoURL || undefined,
      isAuthenticated: true
    } : { isAuthenticated: false }, setUser: () => {} }}>
      <Routes>
        {/* Ruta principal: redirige a /notebooks si está autenticado */}
        <Route 
          path="/" 
          element={isAuthenticated && isEmailVerified ? <Navigate to="/notebooks" replace /> : <HomePage />} 
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
                <>
                  {!hasCompletedOnboarding && <OnboardingComponent onComplete={() => {
                    setHasCompletedOnboarding(true);
                    localStorage.setItem('hasCompletedOnboarding', 'true');
                  }} />}
                  <Notebooks />
                </>
              </EmailVerificationGuard>
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/notebooks/:id"
          element={isAuthenticated ? <EmailVerificationGuard><NotebookDetail /></EmailVerificationGuard> : <Navigate to="/login" replace />}
        />
        <Route
          path="/notebooks/:notebookId/concepto/:conceptoId/:index"
          element={isAuthenticated ? <EmailVerificationGuard><ConceptDetail /></EmailVerificationGuard> : <Navigate to="/login" replace />}
        />
        <Route
          path="/tools/explain/:type/:notebookId"
          element={isAuthenticated ? <EmailVerificationGuard><ExplainConceptPage /></EmailVerificationGuard> : <Navigate to="/login" replace />}
        />
        <Route path="/shared/:shareId" element={<SharedNotebook />} />
        
        {/* Nueva ruta para configuración de voz */}
        <Route
          path="/settings/voice"
          element={isAuthenticated ? <EmailVerificationGuard><VoiceSettingsPage /></EmailVerificationGuard> : <Navigate to="/login" replace />}
        />
        
        {/* Nueva ruta para estudio */}
        <Route
          path="/study"
          element={isAuthenticated ? <EmailVerificationGuard><StudyModePage /></EmailVerificationGuard> : <Navigate to="/login" replace />}
        />
        
        {/* Nueva ruta para progreso */}
        <Route
          path="/progress"
          element={isAuthenticated ? <EmailVerificationGuard><ProgressPage /></EmailVerificationGuard> : <Navigate to="/login" replace />}
        />
        
        {/* Nueva ruta para perfil */}
        <Route
          path="/profile"
          element={isAuthenticated ? <EmailVerificationGuard><ProfilePage /></EmailVerificationGuard> : <Navigate to="/login" replace />}
        />
        
        {/* Nueva ruta para quiz */}
        <Route
          path="/quiz"
          element={isAuthenticated ? <EmailVerificationGuard><QuizModePage /></EmailVerificationGuard> : <Navigate to="/login" replace />}
        />
        
        {/* Ruta para el panel de control del súper admin */}
        <Route
          path="/super-admin"
          element={
            (() => {
              console.log('App - Super Admin route accessed');
              console.log('App - isAuthenticated:', isAuthenticated);
              console.log('App - isEmailVerified:', isEmailVerified);
              if (isAuthenticated) {
                console.log('App - Rendering SuperAdminPage');
                return <EmailVerificationGuard><SuperAdminPage /></EmailVerificationGuard>;
              } else {
                console.log('App - Redirecting to login');
                return <Navigate to="/login" replace />;
              }
            })()
          }
        />
      </Routes>
      {isAuthenticated && isEmailVerified && <MobileNavigation />}
      {/* Sistema de gestión de cookies - siempre visible */}
      <CookieManager />
    </UserContext.Provider>
  );
};

// Componente principal exportado
const App: React.FC = () => <AppWrapper />;

export default App;