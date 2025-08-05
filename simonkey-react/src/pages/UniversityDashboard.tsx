import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/UniversityDashboard.css';

const UniversityDashboard: React.FC = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !userProfile) {
      navigate('/login');
      return;
    }

    if (userProfile.subscription !== 'university') {
      navigate('/app');
      return;
    }

    setLoading(false);
  }, [user, userProfile, navigate]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="university-dashboard">
      <HeaderWithHamburger />
      <div className="university-content">
        <div className="welcome-section">
          <h1>Bienvenido, {userProfile?.displayName || 'Usuario Universidad'}</h1>
          <p className="welcome-message">
            Este es tu espacio exclusivo como usuario universitario de Simonkey AI.
          </p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card info-card">
            <h2>Información del Perfil</h2>
            <div className="info-item">
              <span className="info-label">Nombre:</span>
              <span className="info-value">{userProfile?.displayName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{userProfile?.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Tipo de cuenta:</span>
              <span className="info-value university-badge">Universidad</span>
            </div>
            <div className="info-item">
              <span className="info-label">Universidad:</span>
              <span className="info-value">{userProfile?.schoolName || 'No especificada'}</span>
            </div>
          </div>

          <div className="dashboard-card stats-card">
            <h2>Estadísticas</h2>
            <div className="stats-placeholder">
              <p>Las estadísticas estarán disponibles próximamente</p>
            </div>
          </div>

          <div className="dashboard-card resources-card">
            <h2>Recursos</h2>
            <div className="resources-placeholder">
              <p>Los recursos universitarios estarán disponibles próximamente</p>
            </div>
          </div>

          <div className="dashboard-card activities-card">
            <h2>Actividades Recientes</h2>
            <div className="activities-placeholder">
              <p>No hay actividades recientes para mostrar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversityDashboard;