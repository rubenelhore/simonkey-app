import React from 'react';
import SimonkeyCarousel from './SimonkeyCarousel';

// Datos de ejemplo para el carrusel con imágenes placeholder 
// relacionadas con el concepto de Simonkey
const carouselImages = [
  {
    id: 1,
    src: '/api/placeholder/1200/500',
    alt: 'Estudiante utilizando Simonkey en su laptop',
    caption: 'Tu estudio, tu ritmo: Aprende conceptos con Simonkey'
  },
  {
    id: 2,
    src: '/api/placeholder/1200/500',
    alt: 'Interfaz de cuadernos de Simonkey',
    caption: 'Organiza tus conceptos en cuadernos digitales personalizados'
  },
  {
    id: 3,
    src: '/api/placeholder/1200/500',
    alt: 'Sistema de tarjetas de estudio',
    caption: 'Memoriza conceptos fácilmente con nuestro sistema de tarjetas didácticas'
  },
  {
    id: 4,
    src: '/api/placeholder/1200/500',
    alt: 'Extracción de conceptos con IA',
    caption: 'Nuestra IA extrae automáticamente los conceptos clave de tus documentos'
  },
  {
    id: 5,
    src: '/api/placeholder/1200/500',
    alt: 'Mascota Simio Simón',
    caption: 'Simón te acompaña en tu viaje de aprendizaje'
  },
  {
    id: 6,
    src: '/api/placeholder/1200/500',
    alt: 'Estudiantes utilizando historias mnemotécnicas',
    caption: 'Crea historias para recordar mejor tus conceptos'
  },
  {
    id: 7,
    src: '/api/placeholder/1200/500',
    alt: 'Aprendizaje con música',
    caption: 'Convierte tus conceptos en canciones para aprender más rápido'
  },
  {
    id: 8,
    src: '/api/placeholder/1200/500',
    alt: 'Estudiantes colaborando',
    caption: 'Comparte tus cuadernos y estudia en grupo'
  },
  {
    id: 9,
    src: '/api/placeholder/1200/500',
    alt: 'Simonkey en diferentes dispositivos',
    caption: 'Accede a tus cuadernos desde cualquier dispositivo'
  }
];

const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <header className="hero-section">
        <h1>Simonkey: Estudio personalizado con IA</h1>
        <p>Aprende a tu ritmo, memoriza más fácil, estudia más inteligente</p>
      </header>
      
      {/* Implementación del carrusel */}
      <section className="carousel-section">
        <h2>Descubre Simonkey</h2>
        <SimonkeyCarousel 
          images={carouselImages}
          autoPlay={true}
          autoPlayInterval={5000}
          showIndicators={true}
          showArrows={true}
          showCaption={true}
          slidesToShow={3}
        />
      </section>
      
      <section className="features-section">
        {/* Otras secciones de la página principal */}
      </section>
    </div>
  );
};

export default HomePage;