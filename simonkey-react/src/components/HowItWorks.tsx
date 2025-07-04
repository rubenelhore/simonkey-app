import React from 'react';
import './HowItWorks.css'; // Estilos que crearemos a continuación

const HowItWorks: React.FC = () => {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="container">
        <h2 className="section-title how-it-works-title">Cómo funciona Simonkey</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3 className="step-title">Importa tus materiales</h3>
              <p className="step-description">
                Sube documentos, presentaciones e imágenes y pide a Simonkey que extraiga la información más relevante.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3 className="step-title">Estudia inteligentemente</h3>
              <p className="step-description">
                Estudia con nuestra IA que optimiza tus sesiones de estudio y te da insights y retroalimentación al momento.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3 className="step-title">Compite con tu salón de clase</h3>
              <p className="step-description">
                Tu constancia y habilidad al estudiar se verán reflejados en tu score. ¡Compite con tu salón para ser el mejor!
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;