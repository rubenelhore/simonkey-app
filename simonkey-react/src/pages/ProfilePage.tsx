// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { SchoolRole, UserSubscriptionType } from '../types/interfaces';
import '../styles/ProfilePage.css';

interface ProfileStats {
  totalNotebooks: number;
  totalConcepts: number;
  conceptsDominated: number;
  studyStreak: number;
  totalStudyTime: number;
  weeklyGoal: number;
  achievementsCount: number;
  averageSessionTime: number;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    studyReminders: boolean;
    achievements: boolean;
  };
  study: {
    dailyGoalMinutes: number;
    preferredTimes: string[];
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  };
  privacy: {
    profilePublic: boolean;
    showStats: boolean;
    showProgress: boolean;
  };
}

const ProfilePage: React.FC = () => {
  const { user, userProfile, loading: authLoading, logout } = useAuth();
  const { schoolRole, isSchoolUser, isSchoolStudent, isSuperAdmin, subscription } = useUserType();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'preferences' | 'security'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  
  const [editedProfile, setEditedProfile] = useState({
    nombre: '',
    username: '',
    bio: '',
    birthdate: '',
    location: '',
    interests: [] as string[],
    learningGoal: '',
    photoURL: ''
  });

  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'auto',
    language: 'es',
    notifications: {
      email: true,
      push: true,
      studyReminders: true,
      achievements: true
    },
    study: {
      dailyGoalMinutes: 30,
      preferredTimes: ['morning'],
      difficultyLevel: 'intermediate',
      learningStyle: 'mixed'
    },
    privacy: {
      profilePublic: false,
      showStats: true,
      showProgress: true
    }
  });
  
  const [stats, setStats] = useState<ProfileStats>({
    totalNotebooks: 0,
    totalConcepts: 0,
    conceptsDominated: 0,
    studyStreak: 0,
    totalStudyTime: 0,
    weeklyGoal: 210, // 30 min * 7 days
    achievementsCount: 0,
    averageSessionTime: 0
  });
  
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [pasteAttempted, setPasteAttempted] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setEditedProfile({
        nombre: userProfile.nombre || '',
        username: userProfile.username || '',
        bio: userProfile.bio || '',
        birthdate: userProfile.birthdate || '',
        location: userProfile.location || '',
        interests: userProfile.interests || [],
        learningGoal: userProfile.learningGoal || '',
        photoURL: userProfile.photoURL || ''
      });
      
      // Load preferences from userProfile
      if (userProfile.preferences) {
        setPreferences({
          ...preferences,
          ...userProfile.preferences
        });
      }
      
      // Load stats (in production these would come from Firebase/KPI service)
      setStats({
        totalNotebooks: userProfile.notebookCount || 0,
        totalConcepts: userProfile.conceptCount || Math.floor(Math.random() * 100) + 50,
        conceptsDominated: Math.floor((userProfile.conceptCount || 50) * 0.7),
        studyStreak: userProfile.studyStreak || Math.floor(Math.random() * 30) + 1,
        totalStudyTime: userProfile.totalStudyTime || Math.floor(Math.random() * 50) + 10,
        weeklyGoal: userProfile.weeklyGoal || 210,
        achievementsCount: userProfile.achievementsCount || Math.floor(Math.random() * 10) + 1,
        averageSessionTime: userProfile.averageSessionTime || 25
      });
    }
  }, [userProfile]);

  const handleSaveSection = async (section: string) => {
    if (!user) return;
    
    setSaving(true);
    try {
      let updateData: any = {};
      
      if (section === 'personal') {
        updateData = {
          nombre: editedProfile.nombre,
          username: editedProfile.username,
          bio: editedProfile.bio,
          birthdate: editedProfile.birthdate,
          location: editedProfile.location,
          interests: editedProfile.interests,
          learningGoal: editedProfile.learningGoal,
          photoURL: editedProfile.photoURL,
          updatedAt: new Date()
        };
      } else if (section === 'preferences') {
        updateData = {
          preferences: preferences,
          updatedAt: new Date()
        };
      }

      await updateDoc(doc(db, 'users', user.uid), updateData);
      setEditingSection(null);
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

  const validatePassword = (password: string) => {
    // Mínimo 8 caracteres
    if (password.length < 8) {
      return { isValid: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' };
    }
    
    // Al menos una letra
    if (!/[a-zA-Z]/.test(password)) {
      return { isValid: false, message: 'La nueva contraseña debe contener al menos una letra' };
    }
    
    // Al menos un número
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'La nueva contraseña debe contener al menos un número' };
    }
    
    // Al menos un símbolo especial
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      return { isValid: false, message: 'La nueva contraseña debe contener al menos un símbolo especial (!@#$%^&*()_+-=[]{}|;:,.<>?)' };
    }
    
    return { isValid: true, message: '' };
  };

  const getPasswordRequirements = (password: string) => {
    return [
      {
        text: 'Al menos 8 caracteres',
        valid: password.length >= 8
      },
      {
        text: 'Al menos una letra',
        valid: /[a-zA-Z]/.test(password)
      },
      {
        text: 'Al menos un número',
        valid: /[0-9]/.test(password)
      },
      {
        text: 'Al menos un símbolo (!@#$%^&*)',
        valid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
      }
    ];
  };

  // Función para prevenir pegado desde portapapeles
  const handlePreventPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setPasteAttempted(true);
    // Ocultar el mensaje después de 3 segundos
    setTimeout(() => setPasteAttempted(false), 3000);
  };

  // Función para prevenir arrastrar y soltar
  const handlePreventDrop = (e: React.DragEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordError('');
    setPasswordSuccess('');
    setFieldErrors({
      currentPassword: false,
      newPassword: false,  
      confirmPassword: false
    });
    setShowPasswords({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false
    });
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasteAttempted(false);
  };

  const handlePasswordChange = async () => {
    if (!user) return;

    setPasswordError('');
    setPasswordSuccess('');
    setFieldErrors({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false
    });

    // Validaciones
    if (!passwordData.currentPassword) {
      setFieldErrors(prev => ({ ...prev, currentPassword: true }));
      setPasswordError('Por favor ingresa tu contraseña actual para verificar tu identidad');
      return;
    }

    if (!passwordData.newPassword) {
      setFieldErrors(prev => ({ ...prev, newPassword: true }));
      setPasswordError('Por favor ingresa una nueva contraseña');
      return;
    }

    if (!passwordData.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: true }));
      setPasswordError('Por favor confirma tu nueva contraseña');
      return;
    }

    // Validar la nueva contraseña
    const passwordValidation = validatePassword(passwordData.newPassword);
    if (!passwordValidation.isValid) {
      setFieldErrors(prev => ({ ...prev, newPassword: true }));
      setPasswordError(passwordValidation.message);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, newPassword: true, confirmPassword: true }));
      setPasswordError('Las contraseñas no coinciden. Asegúrate de escribir la misma contraseña en ambos campos');
      return;
    }

    if (passwordData.newPassword === passwordData.currentPassword) {
      setFieldErrors(prev => ({ ...prev, newPassword: true }));
      setPasswordError('La nueva contraseña debe ser diferente a la actual por seguridad');
      return;
    }

    setSaving(true);

    try {
      // Reautenticar al usuario
      const credential = EmailAuthProvider.credential(user.email!, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Cambiar la contraseña
      await updatePassword(user, passwordData.newPassword);

      setPasswordSuccess('¡Contraseña cambiada exitosamente! Tu cuenta ahora está más segura.');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        handleClosePasswordModal();
      }, 2000);

    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
        setFieldErrors(prev => ({ ...prev, currentPassword: true }));
        setPasswordError('La contraseña actual es incorrecta. Por favor verifica que hayas escrito correctamente tu contraseña actual');
      } else if (error.code === 'auth/weak-password') {
        setFieldErrors(prev => ({ ...prev, newPassword: true }));
        setPasswordError('La nueva contraseña es muy débil. Debe tener al menos 8 caracteres con letras, números y símbolos especiales');
      } else if (error.code === 'auth/requires-recent-login') {
        setPasswordError('Por seguridad, necesitas iniciar sesión nuevamente antes de cambiar tu contraseña');
      } else if (error.code === 'auth/too-many-requests') {
        setPasswordError('Demasiados intentos fallidos. Por favor espera unos minutos antes de intentar de nuevo');
      } else if (error.code === 'auth/network-request-failed') {
        setPasswordError('Error de conexión. Por favor verifica tu conexión a internet e inténtalo de nuevo');
      } else if (error.code === 'auth/user-disabled') {
        setPasswordError('Tu cuenta ha sido deshabilitada. Contacta al soporte para más información');
      } else if (error.code === 'auth/user-not-found') {
        setPasswordError('Usuario no encontrado. Por favor inicia sesión nuevamente');
      } else {
        setPasswordError(`Error al cambiar la contraseña: ${error.message || 'Error desconocido'}. Por favor inténtalo de nuevo`);
      }
    } finally {
      setSaving(false);
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

  const calculateProgressPercentage = () => {
    if (stats.weeklyGoal === 0) return 0;
    const weeklyProgress = (stats.totalStudyTime * 60) % (stats.weeklyGoal * 7); // Convert hours to minutes
    return Math.min((weeklyProgress / stats.weeklyGoal) * 100, 100);
  };

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

  const renderOverviewTab = () => (
    <div className="profile-overview">
      {/* Hero Section */}
      <div className="profile-hero-modern">
        <div className="profile-hero-background">
          <div className="hero-pattern"></div>
        </div>
        
        <div className="profile-hero-content">
          <div className="profile-avatar-section">
            <div className="profile-avatar-large">
              {editedProfile.photoURL ? (
                <img src={editedProfile.photoURL} alt="Avatar" />
              ) : (
                <div className="profile-avatar-placeholder">
                  🐒
                </div>
              )}
              <button className="avatar-edit-btn" onClick={() => setEditingSection('avatar')}>
                <i className="fas fa-camera"></i>
              </button>
            </div>
            
            <div className={`profile-subscription-badge ${subscriptionInfo.text.toLowerCase().replace(' ', '-')}`}>
              <i className={`badge-icon ${subscriptionInfo.icon}`}></i>
              <span className="badge-text">{subscriptionInfo.text}</span>
            </div>
          </div>
          
          <div className="profile-info-section">
            <h1 className="profile-name">{editedProfile.nombre || 'Usuario'}</h1>
            <p className="profile-username">@{editedProfile.username || user.email?.split('@')[0]}</p>
            <p className="profile-email">{user.email}</p>
            {editedProfile.bio && (
              <p className="profile-bio">{editedProfile.bio}</p>
            )}
            {editedProfile.location && (
              <p className="profile-location">
                <i className="fas fa-map-marker-alt"></i>
                {editedProfile.location}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="profile-quick-stats">
        <div className="quick-stat-item">
          <div className="stat-value">{stats.studyStreak}</div>
          <div className="stat-label">Días seguidos</div>
          <div className="stat-icon streak">
            <i className="fas fa-fire"></i>
          </div>
        </div>
        
        <div className="quick-stat-item">
          <div className="stat-value">{stats.totalStudyTime}h</div>
          <div className="stat-label">Tiempo total</div>
          <div className="stat-icon time">
            <i className="fas fa-clock"></i>
          </div>
        </div>
        
        <div className="quick-stat-item">
          <div className="stat-value">{stats.conceptsDominated}</div>
          <div className="stat-label">Dominados</div>
          <div className="stat-icon concepts">
            <i className="fas fa-brain"></i>
          </div>
        </div>
        
        <div className="quick-stat-item">
          <div className="stat-value">{stats.achievementsCount}</div>
          <div className="stat-label">Logros</div>
          <div className="stat-icon achievements">
            <i className="fas fa-trophy"></i>
          </div>
        </div>
      </div>

      {/* Weekly Progress */}
      <div className="weekly-progress-card">
        <div className="progress-header">
          <h3>Progreso Semanal</h3>
          <span className="progress-percentage">{Math.round(calculateProgressPercentage())}%</span>
        </div>
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${calculateProgressPercentage()}%` }}
          ></div>
        </div>
        <div className="progress-details">
          <span>Meta: {preferences.study.dailyGoalMinutes} min/día</span>
          <span>{Math.round((stats.totalStudyTime * 60) / 7)} min promedio</span>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="profile-stats-detailed">
        <div className="stat-card">
          <div className="stat-card-header">
            <i className="fas fa-book"></i>
            <h4>Cuadernos</h4>
          </div>
          <div className="stat-card-value">{stats.totalNotebooks}</div>
          <div className="stat-card-trend">
            <i className="fas fa-arrow-up"></i>
            <span>+2 este mes</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <i className="fas fa-lightbulb"></i>
            <h4>Conceptos</h4>
          </div>
          <div className="stat-card-value">{stats.totalConcepts}</div>
          <div className="stat-card-progress">
            <div className="mini-progress">
              <div 
                className="mini-progress-fill" 
                style={{ width: `${(stats.conceptsDominated / stats.totalConcepts) * 100}%` }}
              ></div>
            </div>
            <span>{Math.round((stats.conceptsDominated / stats.totalConcepts) * 100)}% dominados</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <i className="fas fa-stopwatch"></i>
            <h4>Sesión promedio</h4>
          </div>
          <div className="stat-card-value">{stats.averageSessionTime}min</div>
          <div className="stat-card-trend positive">
            <i className="fas fa-arrow-up"></i>
            <span>+5 min vs mes anterior</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="profile-quick-actions">
        <Link to="/study" className="quick-action-card study">
          <div className="action-icon">
            <i className="fas fa-play"></i>
          </div>
          <div className="action-content">
            <h4>Continuar estudiando</h4>
            <p>Sigue con tu racha</p>
          </div>
        </Link>
        
        <Link to="/progress" className="quick-action-card progress">
          <div className="action-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="action-content">
            <h4>Ver progreso</h4>
            <p>Analiza tu rendimiento</p>
          </div>
        </Link>
        
        <Link to="/materias" className="quick-action-card materias">
          <div className="action-icon">
            <i className="fas fa-book-open"></i>
          </div>
          <div className="action-content">
            <h4>Mis materias</h4>
            <p>Explora tus cuadernos</p>
          </div>
        </Link>
      </div>
    </div>
  );

  const renderPersonalTab = () => (
    <div className="profile-personal">
      <div className="profile-section-card">
        <div className="section-header">
          <h3>Información Personal</h3>
          <button 
            className="edit-section-btn"
            onClick={() => setEditingSection(editingSection === 'personal' ? null : 'personal')}
          >
            <i className={`fas fa-${editingSection === 'personal' ? 'times' : 'edit'}`}></i>
          </button>
        </div>
        
        <div className="section-content">
          {editingSection === 'personal' ? (
            <div className="edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre completo</label>
                  <input
                    type="text"
                    value={editedProfile.nombre}
                    onChange={(e) => setEditedProfile({ ...editedProfile, nombre: e.target.value })}
                    placeholder="Tu nombre completo"
                  />
                </div>
                <div className="form-group">
                  <label>Nombre de usuario</label>
                  <input
                    type="text"
                    value={editedProfile.username}
                    onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                    placeholder="username"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={editedProfile.birthdate}
                    onChange={(e) => setEditedProfile({ ...editedProfile, birthdate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Ubicación</label>
                  <input
                    type="text"
                    value={editedProfile.location}
                    onChange={(e) => setEditedProfile({ ...editedProfile, location: e.target.value })}
                    placeholder="Ciudad, País"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Biografía</label>
                <textarea
                  value={editedProfile.bio}
                  onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                  placeholder="Cuéntanos sobre ti..."
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label>Meta de aprendizaje</label>
                <textarea
                  value={editedProfile.learningGoal}
                  onChange={(e) => setEditedProfile({ ...editedProfile, learningGoal: e.target.value })}
                  placeholder="¿Qué quieres lograr con tu aprendizaje?"
                  rows={2}
                />
              </div>
              
              <div className="form-actions">
                <button 
                  onClick={() => handleSaveSection('personal')}
                  disabled={saving}
                  className="btn-primary"
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
                  onClick={() => setEditingSection(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="info-display">
              <div className="info-item">
                <label>Nombre completo</label>
                <span>{editedProfile.nombre || 'No especificado'}</span>
              </div>
              <div className="info-item">
                <label>Nombre de usuario</label>
                <span>@{editedProfile.username || 'No especificado'}</span>
              </div>
              <div className="info-item">
                <label>Email</label>
                <span>{user.email}</span>
              </div>
              <div className="info-item">
                <label>Fecha de nacimiento</label>
                <span>{editedProfile.birthdate || 'No especificado'}</span>
              </div>
              <div className="info-item">
                <label>Ubicación</label>
                <span>{editedProfile.location || 'No especificado'}</span>
              </div>
              <div className="info-item">
                <label>Biografía</label>
                <span>{editedProfile.bio || 'No especificado'}</span>
              </div>
              <div className="info-item">
                <label>Meta de aprendizaje</label>
                <span>{editedProfile.learningGoal || 'No especificado'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interests Section */}
      <div className="profile-section-card">
        <div className="section-header">
          <h3>Intereses</h3>
          <button 
            className="edit-section-btn"
            onClick={() => setEditingSection(editingSection === 'interests' ? null : 'interests')}
          >
            <i className={`fas fa-${editingSection === 'interests' ? 'times' : 'edit'}`}></i>
          </button>
        </div>
        
        <div className="section-content">
          {editingSection === 'interests' ? (
            <div className="interests-edit">
              <input
                type="text"
                placeholder="Agrega un interés y presiona Enter"
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
              <div className="form-actions">
                <button 
                  onClick={() => handleSaveSection('personal')}
                  className="btn-primary"
                >
                  <i className="fas fa-save"></i>
                  Guardar intereses
                </button>
                <button 
                  onClick={() => setEditingSection(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="interests-display">
              {editedProfile.interests.length > 0 ? (
                <div className="interests-list">
                  {editedProfile.interests.map((interest, index) => (
                    <span key={index} className="interest-tag">
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Agrega tus intereses para personalizar tu experiencia</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="profile-preferences">
      {/* Study Preferences */}
      <div className="profile-section-card">
        <div className="section-header">
          <h3>Preferencias de Estudio</h3>
          <button 
            className="edit-section-btn"
            onClick={() => setEditingSection(editingSection === 'study' ? null : 'study')}
          >
            <i className={`fas fa-${editingSection === 'study' ? 'times' : 'edit'}`}></i>
          </button>
        </div>
        
        <div className="section-content">
          {editingSection === 'study' ? (
            <div className="preferences-edit">
              <div className="preferences-grid">
                <div className="preference-module">
                  <div className="form-group">
                    <label>Meta diaria (minutos)</label>
                    <input
                      type="number"
                      value={preferences.study.dailyGoalMinutes}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        study: { ...preferences.study, dailyGoalMinutes: parseInt(e.target.value) || 30 }
                      })}
                      min="15"
                      max="480"
                    />
                  </div>
                </div>
                
                <div className="preference-module">
                  <div className="form-group">
                    <label>Nivel de dificultad</label>
                    <select
                      value={preferences.study.difficultyLevel}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        study: { ...preferences.study, difficultyLevel: e.target.value as any }
                      })}
                    >
                      <option value="beginner">Principiante</option>
                      <option value="intermediate">Intermedio</option>
                      <option value="advanced">Avanzado</option>
                    </select>
                  </div>
                </div>
                
                <div className="preference-module">
                  <div className="form-group">
                    <label>Estilo de aprendizaje</label>
                    <select
                      value={preferences.study.learningStyle}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        study: { ...preferences.study, learningStyle: e.target.value as any }
                      })}
                    >
                      <option value="visual">Visual</option>
                      <option value="auditory">Auditivo</option>
                      <option value="kinesthetic">Kinestésico</option>
                      <option value="mixed">Mixto</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  onClick={() => handleSaveSection('preferences')}
                  className="btn-primary"
                >
                  <i className="fas fa-save"></i>
                  Guardar preferencias
                </button>
                <button 
                  onClick={() => setEditingSection(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="preferences-display">
              <div className="preferences-grid">
                <div className="preference-module">
                  <div className="preference-item">
                    <label>Meta diaria</label>
                    <span>{preferences.study.dailyGoalMinutes} minutos</span>
                  </div>
                </div>
                
                <div className="preference-module">
                  <div className="preference-item">
                    <label>Nivel de dificultad</label>
                    <span>{preferences.study.difficultyLevel === 'beginner' ? 'Principiante' : 
                          preferences.study.difficultyLevel === 'intermediate' ? 'Intermedio' : 'Avanzado'}</span>
                  </div>
                </div>
                
                <div className="preference-module">
                  <div className="preference-item">
                    <label>Estilo de aprendizaje</label>
                    <span>{preferences.study.learningStyle === 'visual' ? 'Visual' : 
                          preferences.study.learningStyle === 'auditory' ? 'Auditivo' : 
                          preferences.study.learningStyle === 'kinesthetic' ? 'Kinestésico' : 'Mixto'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="profile-section-card">
        <div className="section-header">
          <h3>Notificaciones</h3>
        </div>
        
        <div className="section-content">
          <div className="notifications-settings">
            <div className="setting-item">
              <div className="setting-info">
                <label>Notificaciones por email</label>
                <span>Recibe actualizaciones importantes</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.notifications.email}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notifications: { ...preferences.notifications, email: e.target.checked }
                  })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <label>Recordatorios de estudio</label>
                <span>Te ayudamos a mantener tu racha</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.notifications.studyReminders}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notifications: { ...preferences.notifications, studyReminders: e.target.checked }
                  })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <label>Notificaciones de logros</label>
                <span>Celebra tus achievements</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.notifications.achievements}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notifications: { ...preferences.notifications, achievements: e.target.checked }
                  })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          
          <div className="form-actions-centered">
            <button 
              onClick={() => handleSaveSection('preferences')}
              className="btn-primary btn-small"
            >
              <i className="fas fa-save"></i>
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="profile-section-card">
        <div className="section-header">
          <h3>Privacidad</h3>
        </div>
        
        <div className="section-content">
          <div className="privacy-settings">
            <div className="setting-item">
              <div className="setting-info">
                <label>Perfil público</label>
                <span>Otros usuarios pueden ver tu perfil</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.privacy.profilePublic}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    privacy: { ...preferences.privacy, profilePublic: e.target.checked }
                  })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            
            <div className="setting-item">
              <div className="setting-info">
                <label>Mostrar estadísticas</label>
                <span>Compartir tu progreso con otros</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.privacy.showStats}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    privacy: { ...preferences.privacy, showStats: e.target.checked }
                  })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          
          <div className="form-actions-centered">
            <button 
              onClick={() => handleSaveSection('preferences')}
              className="btn-primary btn-small"
            >
              <i className="fas fa-save"></i>
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="profile-security">
      <div className="profile-section-card">
        <div className="section-header">
          <h3>Seguridad de la cuenta</h3>
        </div>
        
        <div className="section-content">
          <div className="security-actions">
            <div className="security-item">
              <div className="security-info">
                <i className="fas fa-key"></i>
                <div>
                  <h4>Cambiar contraseña</h4>
                  <p>Actualiza tu contraseña regularmente</p>
                </div>
              </div>
              <button 
                className="btn-outline"
                onClick={() => setShowPasswordModal(true)}
              >
                Cambiar
              </button>
            </div>
            
            <div className="security-item">
              <div className="security-info">
                <i className="fas fa-shield-alt"></i>
                <div>
                  <h4>Autenticación de dos factores</h4>
                  <p>Añade una capa extra de seguridad</p>
                </div>
              </div>
              <button className="btn-outline">
                Configurar
              </button>
            </div>
            
            <div className="security-item">
              <div className="security-info">
                <i className="fas fa-mobile-alt"></i>
                <div>
                  <h4>Sesiones activas</h4>
                  <p>Gestiona tus dispositivos conectados</p>
                </div>
              </div>
              <button className="btn-outline">
                Ver sesiones
              </button>
            </div>
            
            <div className="security-item">
              <div className="security-info">
                <i className="fas fa-download"></i>
                <div>
                  <h4>Exportar datos</h4>
                  <p>Descarga una copia de tu información</p>
                </div>
              </div>
              <button className="btn-outline">
                Exportar
              </button>
            </div>
            
            <div className="security-item danger-item">
              <div className="security-info">
                <i className="fas fa-exclamation-triangle"></i>
                <div>
                  <h4>Eliminar cuenta</h4>
                  <p>Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button className="btn-danger">
                Eliminar cuenta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="profile-page-container modern">
      <HeaderWithHamburger title="Mi Perfil" />
      
      {/* Navigation Tabs */}
      <div className="profile-navigation">
        <button 
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fas fa-home"></i>
          <span>Resumen</span>
        </button>
        
        <button 
          className={`nav-tab ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          <i className="fas fa-user"></i>
          <span>Personal</span>
        </button>
        
        <button 
          className={`nav-tab ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          <i className="fas fa-cog"></i>
          <span>Configuración</span>
        </button>
        
        <button 
          className={`nav-tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <i className="fas fa-shield-alt"></i>
          <span>Seguridad</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="profile-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'personal' && renderPersonalTab()}
        {activeTab === 'preferences' && renderPreferencesTab()}
        {activeTab === 'security' && renderSecurityTab()}
      </div>

      {/* Logout Button - Always visible */}
      <div className="profile-footer">
        <button onClick={handleLogout} className="logout-btn">
          <i className="fas fa-sign-out-alt"></i>
          Cerrar sesión
        </button>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={handleClosePasswordModal}>
          <div className="password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fas fa-key"></i>
                Actualizar Contraseña
              </h3>
              <button 
                className="modal-close-btn"
                onClick={handleClosePasswordModal}
                title="Cerrar"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* Mensaje de intento de pegado */}
              {pasteAttempted && (
                <div className="paste-blocked-message">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>Por seguridad, no se permite pegar contraseñas. Escríbela manualmente.</span>
                </div>
              )}
              <div className="form-group">
                <label>Contraseña actual</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.currentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => {
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value
                      });
                      // Clear field error when user starts typing
                      if (fieldErrors.currentPassword) {
                        setFieldErrors(prev => ({ ...prev, currentPassword: false }));
                        setPasswordError('');
                      }
                    }}
                    onPaste={handlePreventPaste}
                    onDrop={handlePreventDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder="Ingresa tu contraseña actual"
                    className={fieldErrors.currentPassword ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPasswords(prev => ({ 
                      ...prev, 
                      currentPassword: !prev.currentPassword 
                    }))}
                    title={showPasswords.currentPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <i className={showPasswords.currentPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
              </div>
              
              <div className="form-group">
                <label>Nueva contraseña</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.newPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => {
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value
                      });
                      // Clear field error when user starts typing
                      if (fieldErrors.newPassword) {
                        setFieldErrors(prev => ({ ...prev, newPassword: false }));
                        setPasswordError('');
                      }
                    }}
                    onPaste={handlePreventPaste}
                    onDrop={handlePreventDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder="Ingresa tu nueva contraseña"
                    className={fieldErrors.newPassword ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPasswords(prev => ({ 
                      ...prev, 
                      newPassword: !prev.newPassword,
                      // Si mostramos nueva contraseña, ocultamos confirmación
                      confirmPassword: prev.newPassword ? prev.confirmPassword : false
                    }))}
                    title={showPasswords.newPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <i className={showPasswords.newPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
                
                {/* Mostrar requisitos de contraseña solo si hay texto */}
                {passwordData.newPassword && (
                  <div className="password-requirements">
                    {getPasswordRequirements(passwordData.newPassword).map((req, index) => (
                      <div key={index}>
                        <div className={`password-requirement ${req.valid ? 'valid' : 'invalid'}`}>
                          <i className={req.valid ? 'fas fa-check' : 'fas fa-times'}></i>
                          <span>{req.text}</span>
                        </div>
                        {/* Mostrar ejemplos de símbolos si es el requisito de símbolos y no es válido */}
                        {index === 3 && !req.valid && passwordData.newPassword && (
                          <div className="password-symbols-hint">
                            Ejemplo: ! @ # $ % ^ & * ( ) _ + - = [ ]
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label>Confirmar nueva contraseña</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.confirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => {
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value
                      });
                      // Clear field error when user starts typing
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors(prev => ({ ...prev, confirmPassword: false }));
                        setPasswordError('');
                      }
                    }}
                    onPaste={handlePreventPaste}
                    onDrop={handlePreventDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder="Confirma tu nueva contraseña"
                    className={fieldErrors.confirmPassword ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPasswords(prev => ({ 
                      ...prev, 
                      confirmPassword: !prev.confirmPassword,
                      // Si mostramos confirmación, ocultamos nueva contraseña
                      newPassword: prev.confirmPassword ? prev.newPassword : false
                    }))}
                    title={showPasswords.confirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <i className={showPasswords.confirmPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
              </div>
              
              {passwordError && (
                <div className="password-error">
                  <i className="fas fa-exclamation-circle"></i>
                  {passwordError}
                </div>
              )}
              
              {passwordSuccess && (
                <div className="password-success">
                  <i className="fas fa-check-circle"></i>
                  {passwordSuccess}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={handleClosePasswordModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handlePasswordChange}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Cambiando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i>
                    Cambiar Contraseña
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;