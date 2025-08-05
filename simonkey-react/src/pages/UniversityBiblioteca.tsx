import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/UniversityPages.css';

const UniversityBiblioteca: React.FC = () => {
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
          <h1>Biblioteca</h1>
          <p className="page-description">
            Accede a recursos académicos y materiales de referencia
          </p>
        </div>

        <div className="content-placeholder">
          <div className="placeholder-card">
            <h2>📚 Biblioteca Digital</h2>
            <p>Esta sección estará disponible próximamente.</p>
            <p>Aquí podrás:</p>
            <ul>
              <li>Buscar libros y artículos académicos</li>
              <li>Acceder a bases de datos especializadas</li>
              <li>Consultar recursos de investigación</li>
              <li>Descargar materiales de estudio</li>
              <li>Gestionar tu biblioteca personal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversityBiblioteca;