import React from 'react';
import './ExamplesPage.css';
import Header from '../components/Header';
import Footer from '../components/Footer';

const ExamplesPage: React.FC = () => {
  const examples = [
    {
      title: "Matemáticas Avanzadas",
      subject: "Cálculo Diferencial",
      description: "María mejoró sus calificaciones de 6 a 9 en solo 2 meses usando Simonkey para practicar derivadas e integrales.",
      highlights: ["Práctica diaria de 30 min", "Retroalimentación instantánea", "Progreso medible"],
      color: "#4F46E5"
    },
    {
      title: "Preparación Universitaria",
      subject: "Examen de Admisión",
      description: "Carlos utilizó Simonkey para preparar su examen de admisión, logrando entrar a su universidad deseada.",
      highlights: ["Plan de estudio personalizado", "Simulacros de examen", "Análisis de áreas débiles"],
      color: "#10B981"
    },
    {
      title: "Idiomas",
      subject: "Inglés B2",
      description: "Ana pasó de nivel A2 a B2 en inglés en 6 meses con sesiones diarias en Simonkey.",
      highlights: ["Vocabulario contextualizado", "Práctica de gramática", "Ejercicios interactivos"],
      color: "#F59E0B"
    }
  ];

  return (
    <>
      <Header />
      <div className="examples-page">
        <div className="examples-hero">
          <div className="container">
            <h1 className="examples-title">Casos Hipotéticos de Uso y Éxito con Simonkey</h1>
            <p className="examples-subtitle">
              Éstos son algunos ejemplos de cómo pensamos que puede aprovecharse Simonkey
            </p>
          </div>
        </div>

        <div className="container">
          <div className="examples-grid">
            {examples.map((example, index) => (
              <div key={index} className="example-card">
                <div className="example-header" style={{ backgroundColor: example.color }}>
                  <h3 className="example-subject">{example.subject}</h3>
                </div>
                <div className="example-content">
                  <h2 className="example-title">{example.title}</h2>
                  <p className="example-description">{example.description}</p>
                  <div className="example-highlights">
                    <h4>Claves del éxito:</h4>
                    <ul>
                      {example.highlights.map((highlight, idx) => (
                        <li key={idx}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="examples-cta">
            <h2>¿Listo para escribir tu propia historia de éxito?</h2>
            <p>Únete a miles de estudiantes que ya están mejorando sus calificaciones con Simonkey</p>
            <a href="/signup" className="btn btn-primary">Comenzar Gratis</a>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ExamplesPage;