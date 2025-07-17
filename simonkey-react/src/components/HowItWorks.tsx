import React, { useRef, useLayoutEffect, useState } from 'react';
import './HowItWorks.css'; // Estilos que crearemos a continuación

const funcionalidades = [
  {
    title: 'Organiza tus conceptos fácilmente',
    description: 'Agrupa, edita y gestiona todos tus conceptos en un solo lugar de forma intuitiva.'
  },
  {
    title: 'Estudia inteligentemente',
    description: 'Usa el poder de la IA y la repetición espaciada para optimizar tu aprendizaje y retención.'
  },
  {
    title: 'Practica con quizzes personalizados',
    description: 'Genera quizzes adaptados a tu nivel y enfócate en los conceptos que más necesitas repasar.'
  },
  {
    title: 'Accede a estadísticas de tu progreso',
    description: 'Visualiza tu avance, identifica áreas de mejora y celebra tus logros de estudio.'
  },
  {
    title: 'Compite por ser el mejor en tu clase',
    description: 'Sube en el ranking, gana puntos y demuestra que eres el estudiante más dedicado.'
  },
  {
    title: 'Recordatorios inteligentes',
    description: 'Simonkey te avisa cuándo es el mejor momento para repasar y no olvidar lo aprendido.'
  },
];

const imagenes = [
  '/img/image1.png',
  '/img/image2.png',
  '/img/image3.png',
  '/img/image4.png',
  '/img/image5.png',
  '/img/image6.png',
];

const BulletModule = ({ title, description, active, onClick }: { title: string, description: string, active: boolean, onClick: () => void }) => {
  const [hover, setHover] = React.useState(false);
  const isActive = hover || active;
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        background: '#fff',
        color: '#111',
        borderRadius: 10,
        border: 'none',
        boxShadow: isActive ? '0 4px 16px rgba(79,70,229,0.07)' : '0 2px 8px rgba(0,0,0,0.03)',
        padding: '16px 24px',
        fontWeight: 500,
        fontSize: '1.1rem',
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(.4,0,.2,1)',
        marginLeft: 0,
        marginBottom: 16,
        listStyle: 'none',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      {active && (
        <div style={{
          width: 6,
          height: '70%',
          background: '#4F46E5',
          borderRadius: 4,
          position: 'absolute',
          left: 8,
          top: '15%',
          boxShadow: '0 2px 8px rgba(79,70,229,0.10)'
        }} />
      )}
      <div style={{ flex: 1, paddingLeft: 18 }}>
        <div style={{
          fontWeight: 700,
          fontSize: active ? '1.05rem' : '1.05rem',
          marginBottom: 2,
          letterSpacing: 0.1,
          color: active ? '#4F46E5' : '#111',
          transition: 'all 0.22s cubic-bezier(.4,0,.2,1)'
        }}>{title}</div>
        <div style={{
          fontWeight: 400,
          fontSize: '0.93rem',
          color: active ? '#444' : '#b4b4b4',
          lineHeight: 1.5,
          marginTop: 2,
          transition: 'all 0.22s cubic-bezier(.4,0,.2,1)'
        }}>{description}</div>
      </div>
    </li>
  );
};

const HowItWorks: React.FC = () => {
  const [selected, setSelected] = useState(0);
  // Eliminar refs y estados de altura

  return (
    <>
      {/* Sección Funcionalidades de Simonkey */}
      <section id="funcionalidades-de-simonkey" style={{ width: '100%', backgroundColor: 'rgb(249, 250, 251)', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 40, marginBottom: 60 }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 700, color: '#111', margin: '0 0 10px', textAlign: 'center', letterSpacing: 0.1, fontFamily: '"Segoe UI", "Arial", sans-serif' }}>
          Descubre nuestras <span style={{ color: '#4F46E5', fontWeight: 700 }}>Funcionalidades</span>
        </h2>
        <div style={{ fontFamily: '"Segoe UI", "Arial", sans-serif', fontSize: '1rem', color: '#6366F1', marginBottom: 18, textAlign: 'center', fontStyle: 'italic', fontWeight: 400, letterSpacing: 0.05 }}>
          Descubre todo lo que puedes hacer con Simonkey.
        </div>
        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', gap: 48 }}>
          <div style={{ flex: '0 0 50%', maxWidth: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24, alignItems: 'flex-start', paddingLeft: 0 }}>
            <ul style={{ fontSize: '1.25rem', color: 'rgb(34, 34, 34)', listStyle: 'none', padding: 0, margin: 0, width: '100%' }}>
              {funcionalidades.map((f, i) => (
                <BulletModule key={i} title={f.title} description={f.description} active={selected === i} onClick={() => setSelected(i)} />
              ))}
            </ul>
          </div>
          <div style={{ flex: '0 0 50%', maxWidth: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
            <img
              src={imagenes[selected]}
              alt={funcionalidades[selected].title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,0.10)' }}
            />
          </div>
        </div>
      </section>

      {/* Sección Cómo funciona Simonkey */}
      <section className="how-it-works" id="how-it-works">
        <div className="container">
          <h2 className="section-title how-it-works-title">Cómo funciona Simonkey</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3 className="step-title two-line-title up">Sube tus archivos</h3>
                <div style={{width: '32px', height: '2px', background: '#4F46E5', margin: '10px auto 16px auto', borderRadius: 2}} />
                <p className="step-description">
                  Carga tus documentos (PDF, Word, PPT, etc.) y deja que Simonkey te ayude extrayendo la información clave para que estudies más fácil.
                </p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3 className="step-title two-line-title">Estudia de forma más inteligente</h3>
                <div style={{width: '32px', height: '2px', background: '#4F46E5', margin: '10px auto 16px auto', borderRadius: 2}} />
                <p className="step-description">
                  Usa sesiones personalizadas, quizzes y consejos de la IA para aprender mejor y más rápido.
                </p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3 className="step-title two-line-title up">Mide tu progreso</h3>
                <div style={{width: '32px', height: '2px', background: '#4F46E5', margin: '10px auto 16px auto', borderRadius: 2}} />
                <p className="step-description">
                  Consulta tus avances, pon metas claras y recibe recomendaciones para mejorar cada día.
                </p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-content">
                <h3 className="step-title two-line-title">Compite por el primer puesto</h3>
                <div style={{width: '32px', height: '2px', background: '#4F46E5', margin: '10px auto 16px auto', borderRadius: 2}} />
                <p className="step-description">
                  Reta a tus compañeros, sube en el ranking y demuestra que puedes ser el mejor de la clase.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default HowItWorks;