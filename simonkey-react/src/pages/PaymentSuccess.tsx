import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles/PaymentSuccess.css';

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  useEffect(() => {
    // Redirigir a notebooks después de 5 segundos
    const timer = setTimeout(() => {
      navigate('/notebooks');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="payment-success-page">
      <Header />
      <div className="payment-success-container">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h1 className="success-title">¡Pago Exitoso!</h1>
          <p className="success-message">
            Bienvenido a <span className="pro-badge">Súper Simonkey</span>
          </p>
          <div className="success-details">
            <p>Tu suscripción ha sido activada exitosamente.</p>
            <p>Ahora tienes acceso a:</p>
            <ul className="benefits-list">
              <li>✓ Cuadernos personales ilimitados</li>
              <li>✓ 100 conceptos por día por cuaderno</li>
              <li>✓ Soporte prioritario 24/7</li>
              <li>✓ Priorización de nuevas características</li>
            </ul>
          </div>
          <p className="redirect-message">
            Serás redirigido a tus cuadernos en unos segundos...
          </p>
          <button
            onClick={() => navigate('/notebooks')}
            className="btn-primary-success"
          >
            Ir a Mis Cuadernos
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PaymentSuccess;
