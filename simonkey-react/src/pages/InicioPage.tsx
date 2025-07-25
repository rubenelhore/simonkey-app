import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFire, faClock, faChartLine
} from '@fortawesome/free-solid-svg-icons';
import '../styles/InicioPage.css';

const InicioPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const userName = userProfile?.displayName || userProfile?.email?.split('@')[0] || 'Santiago';

  // Datos del dashboard
  const dailyStats = {
    streak: 7,
    todayMinutes: 0,
    weeklyProgress: '+20%'
  };

  return (
    <div className="dashboard-container">
      <HeaderWithHamburger title="" />
      
      <div className="dashboard-content">
        
        {/* 🟪 FILA 1: Bienvenida y resumen diario */}
        <section className="row-1">
          <div className="welcome-section">
            <h1 className="welcome-greeting">Hola, {userName} 👋</h1>
          </div>
          
          <div className="daily-metrics">
            <div className="metric-card">
              <FontAwesomeIcon icon={faFire} className="metric-icon fire" />
              <div className="metric-content">
                <span className="metric-label">Racha</span>
                <span className="metric-value">{dailyStats.streak} días</span>
              </div>
            </div>
            
            <div className="metric-card">
              <FontAwesomeIcon icon={faClock} className="metric-icon time" />
              <div className="metric-content">
                <span className="metric-label">Tiempo hoy</span>
                <span className="metric-value">{dailyStats.todayMinutes} min</span>
              </div>
            </div>
            
            <div className="metric-card">
              <FontAwesomeIcon icon={faChartLine} className="metric-icon progress" />
              <div className="metric-content">
                <span className="metric-label">Progreso semanal</span>
                <span className="metric-value">{dailyStats.weeklyProgress}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 🟦 FILA 2: Módulo principal de acceso rápido */}
        <section className="row-2">
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Contenido vacío por ahora */}
          </div>
        </section>
        
      </div>
    </div>
  );
};

export default InicioPage;