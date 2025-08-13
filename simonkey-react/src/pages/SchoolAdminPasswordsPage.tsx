import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { Navigate } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import PasswordStatusPanel from '../components/admin/PasswordStatusPanel';
import './SchoolAdminPasswordsPage.css';

const SchoolAdminPasswordsPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { isSchoolAdmin } = useUserType();
  const [schoolId, setSchoolId] = useState<string>('');

  useEffect(() => {
    if (userProfile?.idInstitucion) {
      setSchoolId(userProfile.idInstitucion);
    }
  }, [userProfile]);

  if (!isSchoolAdmin) {
    return <Navigate to="/inicio" replace />;
  }

  if (!schoolId) {
    return (
      <div className="school-admin-passwords-page">
        <HeaderWithHamburger
          title="Dashboard de Contraseñas"
          subtitle="Gestión de credenciales de estudiantes"
        />
        <div className="loading-container">
          <p>Cargando información de la escuela...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="school-admin-passwords-page">
      <HeaderWithHamburger
        title="Dashboard de Contraseñas"
        subtitle="Gestión de credenciales de estudiantes"
      />
      <div className="passwords-content">
        <PasswordStatusPanel schoolId={schoolId} />
      </div>
    </div>
  );
};

export default SchoolAdminPasswordsPage;