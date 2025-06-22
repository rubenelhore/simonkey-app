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
    { id: 1, src: '/img/image1.jpg', alt: 'Image 1' },
    { id: 2, src: '/img/image2.jpg', alt: 'Image 2' },
    { id: 3, src: '/img/image3.jpg', alt: 'Image 3' },
    { id: 4, src: '/img/image4.jpg', alt: 'Image 4' },
    { id: 5, src: '/img/image5.jpg', alt: 'Image 5' },
    { id: 6, src: '/img/image6.jpg', alt: 'Image 6' },
    { id: 7, src: '/img/image7.jpg', alt: 'Image 7' },
    { id: 8, src: '/img/image8.jpg', alt: 'Image 8' },
    { id: 9, src: '/img/image9.jpg', alt: 'Image 9' }
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