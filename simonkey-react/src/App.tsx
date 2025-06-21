import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, useLocation, useNavigate } from 'react-router-dom';
import './App.css';

// Import components
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import CTA from './components/CTA';
import Footer from './components/Footer';
import SimonkeyCarousel from './components/SimonkeyCarousel';
import MobileNavigation from './components/Mobile/MobileNavigation';
import CookieManager from './components/CookieConsent/CookieManager';
import AppRoutes from './components/AppRoutes';

// Import context and hooks
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useUserType } from './hooks/useUserType';

// Component for HomePage content
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
    const hash = location.hash.replace('#', '');
    const savedSection = localStorage.getItem('scrollTo');
    
    if (hash || savedSection) {
      const targetId = hash || savedSection || '';
      setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
        if (savedSection) {
          localStorage.removeItem('scrollTo');
        }
      }, 100);
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

export const HomePage: React.FC = () => <HomePageContent />;

// Maintenance Mode Component
const MaintenanceMode: React.FC = () => (
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

// Loading component
const LoadingSpinner: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f8f9fa'
  }}>
    <div style={{ textAlign: 'center' }}>
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

// Main app wrapper component
const AppWrapper: React.FC = () => (
  <AuthProvider>
    <Router>
      <AppContent />
    </Router>
  </AuthProvider>
);

// Main app content component
const AppContent: React.FC = () => {
  const { isAuthenticated, isEmailVerified, loading } = useAuth();
  const { isSchoolTeacher, isSchoolStudent } = useUserType();
  const navigate = useNavigate();
  const location = useLocation();

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return localStorage.getItem('hasCompletedOnboarding') === 'true';
  });

  // Maintenance mode toggle
  const MAINTENANCE_MODE = false;
  
  if (MAINTENANCE_MODE) {
    return <MaintenanceMode />;
  }

  // Handle authentication redirects
  useEffect(() => {
    if (!loading) {
      const currentPath = window.location.pathname;
      const publicPaths = ['/', '/login', '/signup', '/pricing', '/privacy-policy', '/terms'];
      
      // Redirect unauthenticated users from protected routes
      if (!isAuthenticated && !publicPaths.includes(currentPath)) {
        navigate('/login', { replace: true });
        return;
      }
      
      // Handle authenticated user redirects
      if (isAuthenticated) {
        if ((isSchoolTeacher || isSchoolStudent) && ['/login', '/signup'].includes(currentPath)) {
          const redirectPath = isSchoolTeacher ? '/school/teacher' : '/school/student';
          navigate(redirectPath, { replace: true });
        } else if (!isSchoolTeacher && !isSchoolStudent && isEmailVerified && ['/login', '/signup'].includes(currentPath)) {
          navigate('/notebooks', { replace: true });
        }
      }
    }
  }, [isAuthenticated, isEmailVerified, loading, isSchoolTeacher, isSchoolStudent, navigate]);

  if (loading) {
    return <LoadingSpinner />;
  }
  
  const showMobileNav = isAuthenticated && !location.pathname.startsWith('/school');

  return (
    <div>
      <AppRoutes 
        hasCompletedOnboarding={hasCompletedOnboarding}
        setHasCompletedOnboarding={setHasCompletedOnboarding}
      />
      {showMobileNav && <MobileNavigation />}
      <CookieManager />
    </div>
  );
};

const App: React.FC = () => <AppWrapper />;

export default App;