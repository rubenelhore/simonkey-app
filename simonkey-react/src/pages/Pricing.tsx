import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './Pricing.css'; // Estilos existentes

const Pricing: React.FC = () => {
  const [showAnnual, setShowAnnual] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);

  const togglePricing = () => {
    setShowAnnual(!showAnnual);
  };

  const toggleFAQ = (index: number) => {
    setActiveQuestion(activeQuestion === index ? null : index);
  };

  return (
    <div>
      <Header />
      {/* Pricing Hero Section */}
      <section className="pricing-hero">
        <div className="container">
          <h1 className="pricing-title">Planes simples, transparentes e <i>inteligentes</i></h1>
          <p className="pricing-subtitle">
            Elige el plan que mejor se adapte a tus necesidades de estudio. Sin sorpresas, sin complicaciones.
          </p>
          <div className="pricing-toggle">
            <span className={`toggle-label toggle-monthly ${!showAnnual ? 'active' : ''}`}>
              Mensual
            </span>
            <label className="toggle-switch">
              <input type="checkbox" id="billing-toggle" onChange={togglePricing} />
              <span className="toggle-slider"></span>
            </label>
            <span className={`toggle-label toggle-annually ${showAnnual ? 'active' : ''}`}>
              Anual
            </span>
            <span className="savings-badge">Ahorra 33%</span>
          </div>
        </div>
      </section>

      {/* Pricing Plans Section */}
      <section className="pricing-plans">
        <div className="container">
          <div className="plans-container">
            <div className="plan-card">
              <div className="plan-header">
                <h3 className="plan-name">Gratis</h3>
                <div className="plan-price">
                  <span className="plan-price-currency">$</span>
                  0
                  <span className="plan-price-period">/mes</span>
                </div>
                <p className="plan-description">Ideal para probar Simonkey y sus herramientas básicas.</p>
              </div>
              <div className="plan-features">
                <ul className="feature-list">
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text prominent">1 cuaderno personal</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Hasta 100 conceptos por cuaderno</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Extracción de conceptos con IA</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Tarjetas de estudio inteligente</span>
                  </li>
                </ul>
              </div>
              <div className="plan-footer">
                <a href="#" className="btn btn-outline btn-block">
                  Comenzar Gratis
                </a>
              </div>
            </div>
            <div className="plan-card popular">
              <div className="popular-badge">Más Popular</div>
                <div className="plan-header">
                  <h3 className="plan-name">Pro</h3>
                  <div className="plan-price">
                    <span className="plan-price-currency">$</span>
                    <span className={showAnnual ? 'annual-price' : 'monthly-price'}>
                    {showAnnual ? '1,199' : '149'}
                    </span>
                    <span className="plan-price-period">{showAnnual ? ' MXN/año' : ' MXN/mes'}</span>
                    {showAnnual && <span className="monthly-equivalent" style={{ fontSize: '0.40em', color: '#1DB173' }}>($99.9 MXN/mes)</span>}
                  </div>
                  <p className="plan-description">Ideal para estudiantes que quieren para maximizar el tiempo y eficiencia de estudio. </p>
                </div>
              <div className="plan-features">
                <ul className="feature-list">
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text prominent">Cuadernos personales ilimitados</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">100 conceptos por día por cuaderno</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Todo del plan Gratis</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Soporte 24/7</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Priorización de nuevas features</span>
                  </li>
                </ul>
              </div>
              <div className="plan-footer">
                <a href="#" className="btn btn-primary btn-block">
                  Elegir Pro
                </a>
              </div>
            </div>
            <div className="plan-card">
              <div className="plan-header">
                <h3 className="plan-name">Escolar</h3>
                <div className="plan-price">
                  <span style={{ fontSize: '1.5rem', fontWeight: '600' }}>Cotiza Simonkey para tu institución</span>
                </div>
                <p className="plan-description">Ideal para Instituciones. Precios a partir de 20 alumnos. Costo por alumno.</p>
              </div>
              <div className="plan-features">
                <ul className="feature-list">
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text prominent">Analítica avanzada para Instituciones</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Creación de perfiles de Profesor, Administrador y Tutor gratis</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Todo del plan Pro para los alumnos</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Creación de materias</span>
                  </li>
                  <li className="feature-item">
                    <span className="feature-icon">✔</span>
                    <span className="feature-text">Competencia de Score por materia</span>
                  </li>
                </ul>
              </div>
              <div className="plan-footer">
                <a href="#" className="btn btn-primary btn-block">
                  Solicitar Cotización
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="comparison">
        <div className="container">
          <h2 className="comparison-title">Compara nuestros planes</h2>
          <table className="comparison-table">
            <thead>
              <tr>
                <th></th>
                <th>Gratis</th>
                <th>Pro</th>
                <th>Escolar</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cuadernos personales</td>
                <td>1</td>
                <td>Ilimitados</td>
                <td>Ilimitados</td>
              </tr>
              <tr>
                <td>Conceptos por cuaderno</td>
                <td>Hasta 100</td>
                <td>100 por día</td>
                <td>100 por día</td>
              </tr>
              <tr>
                <td>Extracción de conceptos con IA</td>
                <td>✔</td>
                <td>✔</td>
                <td>✔</td>
              </tr>
              <tr>
                <td>Tarjetas de estudio inteligente</td>
                <td>✔</td>
                <td>✔</td>
                <td>✔</td>
              </tr>
              <tr>
                <td>Herramientas de Estudio</td>
                <td>Básicas</td>
                <td>Avanzadas</td>
                <td>Avanzadas</td>
              </tr>
              <tr>
                <td>Análisis de progreso</td>
                <td>-</td>
                <td>Detallado</td>
                <td>Detallado</td>
              </tr>
              <tr>
                <td>Creación de usuarios (Admin/Profesores)</td>
                <td>-</td>
                <td>-</td>
                <td>✔</td>
              </tr>
              <tr>
                <td>Creación de materias</td>
                <td>-</td>
                <td>-</td>
                <td>✔</td>
              </tr>
              <tr>
                <td>Competencia de Score por materia</td>
                <td>-</td>
                <td>-</td>
                <td>✔</td>
              </tr>
              <tr>
                <td>Analítica avanzada para Instituciones</td>
                <td>-</td>
                <td>-</td>
                <td>✔</td>
              </tr>
              <tr>
                <td>Priorización de nuevas features</td>
                <td>-</td>
                <td>✔</td>
                <td>✔</td>
              </tr>
              <tr>
                <td>Soporte</td>
                <td>Básico</td>
                <td>24/7</td>
                <td>24/7</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq">
        <div className="container">
          <h2 className="faq-title">Preguntas Frecuentes</h2>
          <div className="faq-list">

            <div className="faq-item">
              <div
                className="faq-question"
                onClick={() => toggleFAQ(0)}
              >
                <span className="faq-question-text">
                  ¿Cómo funciona la extracción de conceptos con IA?
                </span>
              </div>
              <div
                className="faq-answer"
                style={{ display: activeQuestion === 0 ? 'block' : 'none' }}
              >
                Nuestra IA analiza automáticamente el contenido que subas y extrae los conceptos más importantes, organizándolos de manera inteligente en tu cuaderno. Esto te ahorra tiempo y te ayuda a identificar los puntos clave de cualquier material de estudio.
              </div>
            </div>

            <div className="faq-item">
              <div
                className="faq-question"
                onClick={() => toggleFAQ(1)}
              >
                <span className="faq-question-text">
                  ¿Qué son las tarjetas de estudio inteligente?
                </span>
              </div>
              <div
                className="faq-answer"
                style={{ display: activeQuestion === 1 ? 'block' : 'none' }}
              >
                Las tarjetas de estudio inteligente se generan automáticamente a partir de tus conceptos, utilizando algoritmos de repetición espaciada para optimizar tu aprendizaje. Se adaptan a tu ritmo de estudio y te muestran el contenido en el momento más efectivo para la retención.
              </div>
            </div>
            
            <div className="faq-item">
              <div
                className="faq-question"
                onClick={() => toggleFAQ(2)}
              >
                <span className="faq-question-text">
                  ¿Puedo cambiar de plan en cualquier momento?
                </span>
              </div>
              <div
                className="faq-answer"
                style={{ display: activeQuestion === 2 ? 'block' : 'none' }}
              >
                Sí, puedes actualizar o cambiar tu plan en cualquier momento. Si actualizas a un plan superior, se te cobrará la diferencia prorrateada por el tiempo restante de tu suscripción actual. Si cambias a un plan inferior, el nuevo plan entrará en vigor al final de tu ciclo de facturación actual.
              </div>
            </div>
            
            <div className="faq-item">
              <div
                className="faq-question"
                onClick={() => toggleFAQ(3)}
              >
                <span className="faq-question-text">
                  ¿Cómo funciona el plan Escolar para instituciones?
                </span>
              </div>
              <div
                className="faq-answer"
                style={{ display: activeQuestion === 3 ? 'block' : 'none' }}
              >
                El plan Escolar está diseñado específicamente para instituciones educativas. Permite crear usuarios administradores y profesores, gestionar materias de clase, y fomentar la competencia sana entre estudiantes a través del sistema de scores. Incluye analíticas avanzadas para el seguimiento del progreso institucional.
              </div>
            </div>

            <div className="faq-item">
              <div
                className="faq-question"
                onClick={() => toggleFAQ(4)}
              >
                <span className="faq-question-text">
                  ¿Qué significa "100 conceptos por día" en el plan Pro?
                </span>
              </div>
              <div
                className="faq-answer"
                style={{ display: activeQuestion === 4 ? 'block' : 'none' }}
              >
                En el plan Pro, cada cuaderno puede contener hasta 100 conceptos nuevos por día. Esto significa que puedes agregar hasta 100 conceptos a cada uno de tus cuadernos ilimitados, permitiéndote un ritmo de estudio muy intensivo sin restricciones.
              </div>
            </div>

            <div className="faq-item">
              <div
                className="faq-question"
                onClick={() => toggleFAQ(5)}
              >
                <span className="faq-question-text">
                  ¿Qué métodos de pago aceptan?
                </span>
              </div>
              <div
                className="faq-answer"
                style={{ display: activeQuestion === 5 ? 'block' : 'none' }}
              >
                Aceptamos tarjetas de crédito y débito (Visa, Mastercard, American Express), PayPal y, en algunos países, opciones de pago locales como transferencia bancaria.
              </div>
            </div>

            <div className="faq-item">
              <div
                className="faq-question"
                onClick={() => toggleFAQ(6)}
              >
                <span className="faq-question-text">
                  ¿Puedo cancelar mi suscripción en cualquier momento?
                </span>
              </div>
              <div
                className="faq-answer"
                style={{ display: activeQuestion === 6 ? 'block' : 'none' }}
              >
                Sí, puedes cancelar tu suscripción en cualquier momento desde la configuración de tu cuenta. Si cancelas, mantendrás el acceso a las características de tu plan hasta el final del período de facturación actual.
              </div>
            </div>

            <div className="faq-item">
              <div
                className="faq-question"
                onClick={() => toggleFAQ(7)}
              >
                <span className="faq-question-text">
                  ¿Qué pasa con mis datos si cancelo mi suscripción?
                </span>
              </div>
              <div
                className="faq-answer"
                style={{ display: activeQuestion === 7 ? 'block' : 'none' }}
              >
                Si cancelas tu suscripción de pago, tu cuenta se convertirá automáticamente al plan Gratis. Podrás seguir accediendo a tus datos, aunque algunas funciones premium ya no estarán disponibles. Si deseas eliminar completamente tu cuenta y todos tus datos, puedes hacerlo desde la configuración de tu cuenta.
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Pricing;