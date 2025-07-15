import React, { useEffect } from 'react';
import {
  useLocation
} from 'react-router-dom';
import Header from './Header';
import Hero from './Hero';
import Features from './Features';
import HowItWorks from './HowItWorks';
import CTA from './CTA';
import Footer from './Footer';
import SimonkeyCarousel from './SimonkeyCarousel';

const HomePage: React.FC = () => {
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
    { id: 9, src: '/img/image9.png', alt: 'Image 9' }
  ];

  useEffect(() => {
    // Handle scroll to section based on hash or localStorage
    const hash = location.hash.replace('#', '');
    const savedSection = localStorage.getItem('scrollTo');
    if (hash || savedSection) {
      const targetId = hash || savedSection || '';
      setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
        // Clean localStorage after use
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
      {/* Módulo pequeño de llamada a la acción */}
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '32px 0 24px 0',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
          borderRadius: 14,
          boxShadow: '0 2px 12px rgba(79,70,229,0.07)',
          border: '1.5px solid #e5e7eb',
          padding: '18px 36px',
          fontWeight: 700,
          fontSize: '1.35rem',
          color: '#111827', // negro para la primera parte
          textAlign: 'center',
          letterSpacing: 0.1,
          maxWidth: 480,
          width: '100%',
        }}>
          <span style={{ color: '#111827', fontWeight: 700 }}>Únete a Simonkey</span> <span style={{ color: '#4F46E5', fontWeight: 800 }}>y cambia tu futuro</span>
        </div>
      </div>
      {/* Frases motivacionales mejoradas visualmente */}
      <div style={{
        width: '100%',
        maxWidth: 1200,
        margin: '0 auto 36px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 0,
        fontWeight: 600,
        fontSize: '1.13rem',
        letterSpacing: 0.05,
        color: '#0ea5e9', // azul vibrante
        background: 'rgba(236, 245, 255, 0.85)',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(14,165,233,0.07)',
        padding: '18px 0',
      }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>Estudia a tu ritmo</div>
        <span style={{ color: '#b4b4b4', fontWeight: 400, margin: '0 12px', fontSize: '1.2em' }}>|</span>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>Convierte el esfuerzo en resultados</div>
        <span style={{ color: '#b4b4b4', fontWeight: 400, margin: '0 12px', fontSize: '1.2em' }}>|</span>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>Desbloquea tu potencial</div>
        <span style={{ color: '#b4b4b4', fontWeight: 400, margin: '0 12px', fontSize: '1.2em' }}>|</span>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>Aprende y disfruta el proceso</div>
      </div>
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

export default HomePage;