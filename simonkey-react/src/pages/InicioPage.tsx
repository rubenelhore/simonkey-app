import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFire, faClock, faChartLine, faGift, faMedal, faTrophy,
  faBook, faGraduationCap, faChartBar, faCalendarAlt
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
    weeklyProgress: '+20%',
    weeklyTimeChange: '+15%', // Cambio porcentual en tiempo semanal
    currentDivision: 'Madera',
    divisionIcon: '🪵',
    globalScore: 57891
  };

  return (
    <div className="dashboard-container">
      <HeaderWithHamburger title="" />
      
      <div className="dashboard-content">
        
        {/* 🟪 FILA 1: Bienvenida y resumen diario */}
        <section className="row-1">
          <div className="welcome-section">
            <h1 className="welcome-greeting">Hola, {userName}</h1>
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
              <FontAwesomeIcon icon={faGift} className="metric-icon bonus" />
              <div className="metric-content">
                <span className="metric-label">Bonus</span>
                <span className="metric-value">{dailyStats.streak * 200} pts</span>
              </div>
            </div>
            
            <div className="metric-card">
              <FontAwesomeIcon icon={faChartLine} className="metric-icon progress" />
              <div className="metric-content">
                <span className="metric-label">Progreso</span>
                <span className="metric-value">{dailyStats.weeklyProgress}</span>
              </div>
            </div>
            
            <div className="metric-card">
              <FontAwesomeIcon icon={faMedal} className="metric-icon division" />
              <div className="metric-content">
                <span className="metric-label">División</span>
                <span className="metric-value">{dailyStats.currentDivision}</span>
              </div>
            </div>
            
            <div className="metric-card">
              <FontAwesomeIcon icon={faTrophy} className="metric-icon score" />
              <div className="metric-content">
                <span className="metric-label">Score Global</span>
                <span className="metric-value">{dailyStats.globalScore.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 🟦 FILA 2: Módulo principal de acceso rápido */}
        <section className="row-2">
          <div className="quick-access-grid">
            <button className="quick-access-btn" onClick={() => navigate('/materias')}>
              <FontAwesomeIcon icon={faBook} className="quick-btn-icon" />
              <span className="quick-btn-label">Mis materias</span>
            </button>
            
            <button className="quick-access-btn" onClick={() => navigate('/study')}>
              <FontAwesomeIcon icon={faGraduationCap} className="quick-btn-icon" />
              <span className="quick-btn-label">Estudiar</span>
            </button>
            
            <button className="quick-access-btn" onClick={() => navigate('/progress')}>
              <FontAwesomeIcon icon={faChartBar} className="quick-btn-icon" />
              <span className="quick-btn-label">Mi progreso</span>
            </button>
            
            <button className="quick-access-btn" onClick={() => navigate('/calendar')}>
              <FontAwesomeIcon icon={faCalendarAlt} className="quick-btn-icon" />
              <span className="quick-btn-label">Calendario</span>
            </button>
          </div>
        </section>
        
      </div>
    </div>
  );
};

export default InicioPage;