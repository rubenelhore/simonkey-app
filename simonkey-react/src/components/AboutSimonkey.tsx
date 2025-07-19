import React from 'react';
import './AboutSimonkey.css';

const AboutSimonkey: React.FC = () => {
  return (
    <section className="about-simonkey">
      <div className="about-container">
        <div className="about-image">
          <img 
            alt="Chango feliz" 
            src="/img/chango-feliz.jpg" 
            className="monkey-image"
          />
        </div>
        <div className="about-content">
          <div className="content-wrapper">
            <h2 className="about-title">¿Qué es Simonkey?</h2>
            <div className="about-subtitle">
              Tu compañero inteligente para aprender mejor cada día.
            </div>
            <p className="about-description">
              Simonkey es tu asistente inteligente de estudio, diseñado para adaptarse a tu ritmo y necesidades. 
              <span className="highlight"> Utiliza inteligencia artificial para ayudarte a aprender</span> de 
              manera más eficiente, organizar tus conceptos, practicar con quizzes personalizados y mantenerte 
              motivado en tu camino académico.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSimonkey;