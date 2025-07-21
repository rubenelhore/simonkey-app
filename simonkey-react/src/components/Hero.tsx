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
              Con Simonkey, estudiar es más <span style={{ color: '#4F46E5', fontWeight: 600 }}>efectivo y divertido</span>. 
              Recibe <span style={{ color: '#4F46E5', fontWeight: 600 }}>insights al instante</span> para mejorar tu rendimiento 
              y mantén la motivación <span style={{ color: '#4F46E5', fontWeight: 600 }}>compitiendo por el primer lugar</span> en tu grupo con nuestra tabla de desempeño.
            </p>
            <div className="hero-buttons">
              <a href="/signup" className="btn btn-primary" style={{ lineHeight: 1 }}>
                Comenzar Gratis
              </a>
              <a href="#how-it-works" className="btn btn-outline hero-btn-centered">
                Cómo Funciona
              </a>
            </div>
          </div>
            <div className="hero-image">
            <img
              src="/img/imagen.jpg"
              alt="Simio Simón estudiando"
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