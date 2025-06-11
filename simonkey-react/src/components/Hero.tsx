import React from 'react';
import './Hero.css'; // Estilos que crearemos a continuación

const Hero: React.FC = () => {
  return (
    <section className="hero" id="hero">
      <div className="container">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Tu estudio, tu ritmo con <span className="highlight">tu asistente IA</span>
            </h1>
            <p className="hero-subtitle">
              Con Simonkey, el estudio se adapta a ti, no tú al estudio.{' '}
              <span style={{ color: '#4F46E5', fontWeight: 600 }}>Aprende con mayor fluidez</span>, recuerda{' '}
              <span style={{ color: '#4F46E5', fontWeight: 600 }}>sin frustraciones</span> y domina cualquier tema{' '}
              <span style={{ color: '#4F46E5', fontWeight: 600 }}>a tu manera</span>.
            </p>
            <div className="hero-buttons">
              <a href="/signup" className="btn btn-primary">
                Comenzar Gratis
              </a>
              <a href="#how-it-works" className="btn btn-outline">
                Cómo Funciona
              </a>
            </div>
          </div>
            <div className="hero-image">
            <img
              src="/img/imagen.jpg"
              alt="Mascota Simio Simón estudiando"
              className="hero-img"
              style={{ width: '70%', height: 'auto' }}
            />
            </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;