// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { SchoolRole, UserSubscriptionType } from '../types/interfaces';
import '../styles/ProfilePage.css';

interface ProfileStats {
  totalNotebooks: number;
  totalConcepts: number;
  studyStreak: number;
  totalStudyTime: number;
}

const ProfilePage: React.FC = () => {
  const { user, userProfile, loading: authLoading, logout } = useAuth();
  const { schoolRole, isSchoolUser, isSchoolStudent, isSuperAdmin, subscription } = useUserType();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    nombre: '',
    username: '',
    bio: '',
    interests: [] as string[],
    learningGoal: ''
  });
  const [stats, setStats] = useState<ProfileStats>({
    totalNotebooks: 0,
    totalConcepts: 0,
    studyStreak: 0,
    totalStudyTime: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setEditedProfile({
        nombre: userProfile.nombre || '',
        username: userProfile.username || '',
        bio: userProfile.bio || '',
        interests: userProfile.interests || [],
        learningGoal: userProfile.learningGoal || ''
      });
      
      // Simular estadísticas (en producción vendrían de Firebase)
      setStats({
        totalNotebooks: userProfile.notebookCount || 0,
        totalConcepts: userProfile.conceptCount || Math.floor(Math.random() * 100) + 50,
        studyStreak: userProfile.studyStreak || Math.floor(Math.random() * 30) + 1,
        totalStudyTime: userProfile.totalStudyTime || Math.floor(Math.random() * 50) + 10
      });
    }
  }, [userProfile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        nombre: editedProfile.nombre,
        username: editedProfile.username,
        bio: editedProfile.bio,
        interests: editedProfile.interests,
        learningGoal: editedProfile.learningGoal,
        updatedAt: new Date()
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const getSubscriptionBadge = () => {
    if (isSuperAdmin) return { text: 'Super Admin', color: '#6147FF', icon: 'fas fa-crown' };
    if (isSchoolUser) {
      if (schoolRole === SchoolRole.TEACHER) return { text: 'Profesor', color: '#10b981', icon: 'fas fa-chalkboard-teacher' };
      if (schoolRole === SchoolRole.STUDENT) return { text: 'Estudiante', color: '#3b82f6', icon: 'fas fa-user-graduate' };
    }
    if (subscription === UserSubscriptionType.PRO) return { text: 'Pro', color: '#f59e0b', icon: 'fas fa-star' };
    return { text: 'Free', color: '#6b7280', icon: 'fas fa-user' };
  };

  const subscriptionInfo = getSubscriptionBadge();

  if (authLoading) {
    return (
      <div className="profile-page-container">
        <HeaderWithHamburger title="Mi Perfil" />
        <div className="profile-loading">
          <div className="profile-skeleton">
            <div className="skeleton-header"></div>
            <div className="skeleton-content"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="profile-page-container">
        <HeaderWithHamburger title="Mi Perfil" />
        <div className="profile-error">
          <i className="fas fa-exclamation-circle"></i>
          <p>No se pudo cargar el perfil</p>
          <button onClick={() => navigate('/login')} className="profile-error-button">
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page-container">
      <HeaderWithHamburger title="Mi Perfil" />
      
      <div className="profile-hero-section">
        <div className="profile-hero-background"></div>
        <div className="profile-hero-content">
          <div className="profile-avatar-container">
            <div className="profile-avatar-large">
              {userProfile.photoURL ? (
                <img src={userProfile.photoURL} alt="Avatar" />
              ) : (
                <div className="profile-avatar-placeholder">
                  {userProfile.nombre?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className={`profile-subscription-badge ${subscriptionInfo.text.toLowerCase().replace(' ', '-')}`}>
              <i className={`badge-icon ${subscriptionInfo.icon}`}></i>
              <span className="badge-text">{subscriptionInfo.text}</span>
            </div>
          </div>
          
          {!isEditing ? (
            <div className="profile-hero-info">
              <h1 className="profile-name">{userProfile.nombre || 'Usuario'}</h1>
              <p className="profile-username">@{userProfile.username || user.email?.split('@')[0]}</p>
              <p className="profile-email">{user.email}</p>
              {userProfile.bio && <p className="profile-bio">{userProfile.bio}</p>}
            </div>
          ) : (
            <div className="profile-hero-edit">
              <input
                type="text"
                value={editedProfile.nombre}
                onChange={(e) => setEditedProfile({ ...editedProfile, nombre: e.target.value })}
                placeholder="Tu nombre"
                className="profile-input-modern"
              />
              <input
                type="text"
                value={editedProfile.username}
                onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                placeholder="Nombre de usuario"
                className="profile-input-modern"
              />
              <textarea
                value={editedProfile.bio}
                onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                placeholder="Cuéntanos sobre ti..."
                className="profile-textarea-modern"
                rows={3}
              />
            </div>
          )}
        </div>
      </div>

      <div className="profile-main-content">
        {/* Estadísticas */}
        <div className="profile-stats-grid">
          <div className="profile-stat-card">
            <div className="stat-icon-container notebooks">
              <i className="fas fa-book"></i>
            </div>
            <div className="stat-info">
              <h3>{stats.totalNotebooks}</h3>
              <p>Cuadernos</p>
            </div>
          </div>
          
          <div className="profile-stat-card">
            <div className="stat-icon-container concepts">
              <i className="fas fa-lightbulb"></i>
            </div>
            <div className="stat-info">
              <h3>{stats.totalConcepts}</h3>
              <p>Conceptos</p>
            </div>
          </div>
          
          <div className="profile-stat-card">
            <div className="stat-icon-container streak">
              <i className="fas fa-fire"></i>
            </div>
            <div className="stat-info">
              <h3>{stats.studyStreak}</h3>
              <p>Días seguidos</p>
            </div>
          </div>
          
          <div className="profile-stat-card">
            <div className="stat-icon-container time">
              <i className="fas fa-clock"></i>
            </div>
            <div className="stat-info">
              <h3>{stats.totalStudyTime}h</h3>
              <p>Tiempo estudio</p>
            </div>
          </div>
        </div>

        {/* Información adicional */}
        <div className="profile-sections">
          <div className="profile-section">
            <h2 className="section-title">
              <i className="fas fa-target"></i>
              Meta de aprendizaje
            </h2>
            {!isEditing ? (
              <div className="section-content">
                {userProfile.learningGoal ? (
                  <p className="learning-goal">{userProfile.learningGoal}</p>
                ) : (
                  <p className="empty-state">No has definido una meta aún</p>
                )}
              </div>
            ) : (
              <textarea
                value={editedProfile.learningGoal}
                onChange={(e) => setEditedProfile({ ...editedProfile, learningGoal: e.target.value })}
                placeholder="¿Qué quieres lograr con tu aprendizaje?"
                className="profile-textarea-modern"
                rows={2}
              />
            )}
          </div>

          <div className="profile-section">
            <h2 className="section-title">
              <i className="fas fa-heart"></i>
              Intereses
            </h2>
            {!isEditing ? (
              <div className="section-content">
                {userProfile.interests && userProfile.interests.length > 0 ? (
                  <div className="interests-list">
                    {userProfile.interests.map((interest, index) => (
                      <span key={index} className="interest-tag">
                        {interest}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">Agrega tus intereses</p>
                )}
              </div>
            ) : (
              <div className="interests-edit">
                <input
                  type="text"
                  placeholder="Agrega un interés y presiona Enter"
                  className="profile-input-modern"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      setEditedProfile({
                        ...editedProfile,
                        interests: [...editedProfile.interests, e.currentTarget.value.trim()]
                      });
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <div className="interests-list">
                  {editedProfile.interests.map((interest, index) => (
                    <span key={index} className="interest-tag editable">
                      {interest}
                      <button
                        onClick={() => {
                          setEditedProfile({
                            ...editedProfile,
                            interests: editedProfile.interests.filter((_, i) => i !== index)
                          });
                        }}
                        className="remove-interest"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="profile-quick-actions">
          <Link to="/progress" className="quick-action-card progress">
            <i className="fas fa-chart-line"></i>
            <span>Ver progreso</span>
          </Link>
          
          <Link to="/notebooks" className="quick-action-card notebooks">
            <i className="fas fa-book-open"></i>
            <span>Mis cuadernos</span>
          </Link>
          
          <Link to="/settings/voice" className="quick-action-card settings">
            <i className="fas fa-cog"></i>
            <span>Configuración</span>
          </Link>
          
          {isSuperAdmin && (
            <Link to="/super-admin" className="quick-action-card admin">
              <i className="fas fa-crown"></i>
              <span>Panel Admin</span>
            </Link>
          )}
        </div>

        {/* Botones de acción */}
        <div className="profile-actions">
          {!isEditing ? (
            <>
              <button onClick={() => setIsEditing(true)} className="profile-button primary">
                <i className="fas fa-edit"></i>
                Editar perfil
              </button>
              <button onClick={handleLogout} className="profile-button secondary">
                <i className="fas fa-sign-out-alt"></i>
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="profile-button primary"
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Guardando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i>
                    Guardar cambios
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedProfile({
                    nombre: userProfile.nombre || '',
                    username: userProfile.username || '',
                    bio: userProfile.bio || '',
                    interests: userProfile.interests || [],
                    learningGoal: userProfile.learningGoal || ''
                  });
                }}
                className="profile-button secondary"
              >
                <i className="fas fa-times"></i>
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;