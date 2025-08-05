import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/UniversityPages.css';

const UniversityCursos: React.FC = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  // Verificar si es usuario universitario
  React.useEffect(() => {
    if (!user || !userProfile) {
      navigate('/login');
      return;
    }

    if (userProfile.subscription !== 'university') {
      navigate('/app');
      return;
    }
  }, [user, userProfile, navigate]);

  return (
    <div className="university-page">
      <HeaderWithHamburger />
      <div className="university-content">
        <div className="page-header">
          <h1>Mis Cursos</h1>
          <p className="page-description">
            Gestiona y accede a todos tus cursos universitarios
          </p>
        </div>

        <div className="content-placeholder">
          <div className="placeholder-card">
            <h2>🎓 Cursos Disponibles</h2>
            <p>Esta sección estará disponible próximamente.</p>
            <p>Aquí podrás:</p>
            <ul>
              <li>Ver todos tus cursos activos</li>
              <li>Acceder a materiales de estudio</li>
              <li>Seguir tu progreso académico</li>
              <li>Interactuar con contenido educativo</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversityCursos;