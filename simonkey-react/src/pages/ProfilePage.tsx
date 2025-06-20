// src/pages/ProfilePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import Footer from '../components/Footer';
import UserDataManagement from '../components/UserDataManagement';
import UserTypeBadge from '../components/UserTypeBadge';
import '../styles/ProfilePage.css';

const ProfilePage: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { schoolRole, isSchoolUser, isSuperAdmin } = useUserType();

  if (authLoading) {
    return (
      <div className="profile-page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="profile-page-container">
        <div className="loading-container">
          <p>No se pudo cargar el perfil. Por favor, inicia sesión de nuevo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page-container">
      <HeaderWithHamburger title="Mi Perfil" />
      <div className="profile-content">
        <h1>Perfil de Usuario</h1>
        
        <div className="profile-details card">
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Nombre:</strong> {userProfile.nombre}</p>
          <p><strong>Usuario:</strong> {userProfile.username}</p>
          {isSchoolUser && <p><strong>Rol Escolar:</strong> {schoolRole}</p>}
          <UserTypeBadge subscription={userProfile.subscription} schoolRole={userProfile.schoolRole} />
        </div>
        
        <UserDataManagement />

        {isSuperAdmin && (
          <div className="super-admin-section card">
            <h2>Panel de Super Admin</h2>
            <Link to="/super-admin" className="admin-button">Ir al panel</Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ProfilePage;