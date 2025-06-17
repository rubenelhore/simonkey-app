// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { signOut, updateProfile as updateFirebaseProfile, deleteUser } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { useUser } from '../hooks/useUser';
import { useUserType } from '../hooks/useUserType';
import UserTypeBadge from '../components/UserTypeBadge';
import '../styles/ProfilePage.css';

// Define interfaces for the component's props and state
interface UserData {
  name: string;
  email: string;
  photoURL: string;
  interests: string[];
  learningStyle: string;
  notificationsEnabled: boolean;
  apellidos?: string; // Añadir este campo
}

interface UserStats {
  totalConcepts: number;
  masteredConcepts: number;
  notebooks: number;
  studyTime: number;
}

interface LearningStyle {
  id: string;
  name: string;
  icon: string;
}

const ProfilePage: React.FC = () => {
  const { user, setUser } = useUser();
  const { userProfile, subscriptionLimits } = useUserType();
  const [userData, setUserData] = useState<UserData>({
    name: '',
    email: '',
    photoURL: '',
    interests: [],
    learningStyle: 'visual',
    notificationsEnabled: true,
    apellidos: ''
  });
  
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [newInterest, setNewInterest] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [stats, setStats] = useState<UserStats>({
    totalConcepts: 0,
    masteredConcepts: 0,
    notebooks: 0,
    studyTime: 0
  });
  
  // Estados para eliminación de cuenta
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>('');
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  
  const navigate = useNavigate();

  // Estilos de aprendizaje predefinidos
  const learningStyles: LearningStyle[] = [
    { id: 'visual', name: 'Visual', icon: 'fas fa-eye' },
    { id: 'auditory', name: 'Auditivo', icon: 'fas fa-headphones' },
    { id: 'reading', name: 'Lectura', icon: 'fas fa-book-reader' },
    { id: 'kinesthetic', name: 'Kinestésico', icon: 'fas fa-running' }
  ];

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }
      
      try {
        setLoading(true);
        
        // Obtener datos del usuario desde Firestore
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          setUserData({
            name: auth.currentUser.displayName || '',
            email: auth.currentUser.email || '',
            photoURL: auth.currentUser.photoURL || '',
            interests: data.intereses || data.interests || [], // Primero buscar en intereses, luego en interests
            learningStyle: data.tipoAprendizaje || data.learningStyle || 'visual', // Primero tipoAprendizaje, luego learningStyle
            notificationsEnabled: data.notificationsEnabled !== false,
            apellidos: data.apellidos || ''
          });
          
          // Establecer estadísticas del usuario
          setStats({
            totalConcepts: data.totalConcepts || 0,
            masteredConcepts: 0,
            notebooks: data.notebooksCount || 0,
            studyTime: data.studyTime || 0
          });
        } else {
          // Si el documento no existe, inicializamos con valores predeterminados
          setUserData({
            name: auth.currentUser.displayName || '',
            email: auth.currentUser.email || '',
            photoURL: auth.currentUser.photoURL || '',
            interests: [],
            learningStyle: 'visual',
            notificationsEnabled: true,
            apellidos: ''
          });
          
          // Crear documento de usuario si no existe
          await updateDoc(userDocRef, {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName || '',
            photoURL: auth.currentUser.photoURL || '',
            interests: [],
            learningStyle: 'visual',
            notificationsEnabled: true,
            createdAt: new Date()
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error al cargar datos del usuario:", error);
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [navigate]);

  // Manejar cambios en los campos del perfil
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setUserData({
      ...userData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // Manejar cambio de estilo de aprendizaje
  const handleLearningStyleChange = (styleId: string) => {
    setUserData({
      ...userData,
      learningStyle: styleId
    });
  };

  // Agregar nuevo interés
  const handleAddInterest = () => {
    if (newInterest.trim() && !userData.interests.includes(newInterest.trim())) {
      setUserData({
        ...userData,
        interests: [...userData.interests, newInterest.trim()]
      });
      setNewInterest('');
    }
  };

  // Eliminar interés
  const handleRemoveInterest = (interest: string) => {
    setUserData({
      ...userData,
      interests: userData.interests.filter(item => item !== interest)
    });
  };

  // Guardar cambios en el perfil
  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    
    try {
      setSaving(true);
      
      // Actualizar perfil en Firebase Auth (solo nombre)
      if (userData.name !== auth.currentUser.displayName) {
        await updateFirebaseProfile(auth.currentUser, {
          displayName: userData.name
        });
      }
      
      // Actualizar datos en Firestore
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, {
        displayName: userData.name,
        apellidos: userData.apellidos,
        intereses: userData.interests, // Cambiar "interests" por "intereses"
        tipoAprendizaje: userData.learningStyle, // Cambiar "learningStyle" por "tipoAprendizaje"
        notificationsEnabled: userData.notificationsEnabled,
        updatedAt: new Date()
      });
      
      // Actualizar estado global del usuario si es necesario
      if (setUser && user) {
        setUser({
          ...user,
          name: userData.name,
        });
      }
      
      setSaving(false);
      setIsEditing(false);
    } catch (error) {
      console.error("Error al guardar perfil:", error);
      setSaving(false);
    }
  };

  // Cerrar sesión
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // Eliminar cuenta del usuario
  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    
    if (deleteConfirmation !== 'eliminar') {
      alert('Por favor escribe "eliminar" para confirmar la eliminación de tu cuenta.');
      return;
    }
    
    try {
      setDeletingAccount(true);
      
      const userId = auth.currentUser.uid;
      
      // 1. Eliminar todos los notebooks del usuario
      const notebooksQuery = query(collection(db, 'notebooks'), where('userId', '==', userId));
      const notebooksSnapshot = await getDocs(notebooksQuery);
      
      for (const notebookDoc of notebooksSnapshot.docs) {
        // Eliminar conceptos del notebook
        const conceptsQuery = query(collection(db, 'concepts'), where('notebookId', '==', notebookDoc.id));
        const conceptsSnapshot = await getDocs(conceptsQuery);
        
        for (const conceptDoc of conceptsSnapshot.docs) {
          await deleteDoc(conceptDoc.ref);
        }
        
        // Eliminar el notebook
        await deleteDoc(notebookDoc.ref);
      }
      
      // 2. Eliminar datos del usuario de Firestore
      const userDocRef = doc(db, 'users', userId);
      await deleteDoc(userDocRef);
      
      // 3. Eliminar cuenta de Firebase Auth
      await deleteUser(auth.currentUser);
      
      // 4. Redirigir al login
      navigate('/login');
      
    } catch (error) {
      console.error("Error al eliminar cuenta:", error);
      alert('Error al eliminar la cuenta. Por favor, intenta de nuevo.');
      setDeletingAccount(false);
    }
  };

  // Formatear tiempo para mostrar
  const formatStudyTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="profile-page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page-container">
      <header className="profile-page-header">
        <div className="header-content">
          <button 
            className="back-button"
            onClick={() => navigate('/notebooks')}
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          
          <h1>Mi Perfil</h1>
          
          <button 
            className="edit-button"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? (
              <i className="fas fa-times"></i>
            ) : (
              <i className="fas fa-pencil-alt"></i>
            )}
          </button>
        </div>
      </header>
      
      <main className="profile-page-main">
        <section className="profile-header-section">
          <div className="profile-avatar">
            {userData.photoURL ? (
              <img src={userData.photoURL} alt="Foto de perfil" />
            ) : (
              <div className="default-avatar">
                {userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
          </div>
          
          {isEditing ? (
            <div className="profile-name-edit">
              <input
                type="text"
                name="name"
                value={userData.name}
                onChange={handleInputChange}
                placeholder="Tu nombre"
                maxLength={50}
                className="form-control"
              />
              <input
                type="text"
                name="apellidos"
                value={userData.apellidos || ''}
                onChange={handleInputChange}
                placeholder="Tus apellidos"
                maxLength={50}
                className="form-control"
                style={{ marginTop: '0.5rem' }}
              />
            </div>
          ) : (
            <div className="profile-name">
              <h2>{userData.name || 'Usuario'} {userData.apellidos || ''}</h2>
              <p>{userData.email}</p>
              {userProfile && (
                <div className="user-type-badge" style={{ marginTop: '0.5rem' }}>
                  <UserTypeBadge 
                    subscription={userProfile.subscription}
                    schoolRole={userProfile.schoolRole}
                  />
                </div>
              )}
            </div>
          )}
        </section>
        
        <section className="profile-stats-section">
          <div className="stats-card">
            <div className="stat-item">
              <div className="stat-icon">
                <i className="fas fa-book"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalConcepts}</div>
                <div className="stat-label">Conceptos</div>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon">
                <i className="fas fa-graduation-cap"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">
                  {stats.totalConcepts ? Math.round((stats.masteredConcepts / stats.totalConcepts) * 100) : 0}%
                </div>
                <div className="stat-label">Dominados</div>
              </div>
            </div>
            
            <div className="stat-item">
              <div className="stat-icon">
                <i className="fas fa-clock"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{formatStudyTime(stats.studyTime)}</div>
                <div className="stat-label">Tiempo</div>
              </div>
            </div>
          </div>
          
          <button 
            className="view-progress-button"
            onClick={() => navigate('/progress')}
          >
            Ver progreso detallado
            <i className="fas fa-chevron-right"></i>
          </button>
        </section>
        
        {isEditing ? (
          // Sección de edición de perfil
          <section className="profile-edit-section">
            <div className="form-section">
              <h3>Estilo de aprendizaje preferido</h3>
              <div className="learning-styles-options">
                {learningStyles.map(style => (
                  <div 
                    key={style.id}
                    className={`learning-style-item ${userData.learningStyle === style.id ? 'selected' : ''}`}
                    onClick={() => handleLearningStyleChange(style.id)}
                  >
                    <div className="style-icon">
                      <i className={style.icon}></i>
                    </div>
                    <div className="style-name">{style.name}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="form-section">
              <h3>Intereses</h3>
              <div className="interests-input">
                <input
                  type="text"
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  placeholder="Añadir interés (ej. Matemáticas, Historia)"
                  maxLength={30}
                />
                <button 
                  className="add-interest-button"
                  onClick={handleAddInterest}
                  disabled={!newInterest.trim()}
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>
              
              <div className="interests-list">
                {userData.interests.length > 0 ? (
                  userData.interests.map((interest, index) => (
                    <div key={index} className="interest-tag">
                      <span>{interest}</span>
                      <button 
                        className="remove-interest"
                        onClick={() => handleRemoveInterest(interest)}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="no-interests">Añade tus intereses para personalizar tu experiencia</p>
                )}
              </div>
            </div>
            
            <div className="form-section">
              <h3>Preferencias</h3>
              <div className="preference-item">
                <label htmlFor="notifications">Notificaciones de estudio</label>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id="notifications"
                    name="notificationsEnabled"
                    checked={userData.notificationsEnabled}
                    onChange={handleInputChange}
                  />
                  <span className="toggle-slider"></span>
                </div>
              </div>
            </div>
            
            <div className="edit-actions">
              <button 
                className="cancel-button"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </button>
              
              <button 
                className="save-button"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </section>
        ) : (
          // Sección de visualización de perfil
          <section className="profile-view-section">
            <div className="profile-card">
              <h3>Estilo de aprendizaje</h3>
              <div className="profile-info">
                {learningStyles.find(style => style.id === userData.learningStyle) && (
                  <div className="learning-style-display">
                    <div className="style-icon">
                      <i className={learningStyles.find(style => style.id === userData.learningStyle)?.icon || 'default-icon-class'}></i>
                    </div>
                    <div className="style-name">
                      <i className={learningStyles.find(style => style.id === userData.learningStyle)?.icon || 'default-icon-class'}></i>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="profile-card">
              <h3>Intereses</h3>
              <div className="profile-info">
                {userData.interests.length > 0 ? (
                  <div className="interests-display">
                    {userData.interests.map((interest, index) => (
                      <span key={index} className="interest-tag view-only">{interest}</span>
                    ))}
                  </div>
                ) : (
                  <p className="empty-info">No has añadido intereses</p>
                )}
              </div>
            </div>
            
            <div className="profile-card">
              <h3>Preferencias</h3>
              <div className="profile-info">
                <div className="preference-display">
                  <span>Notificaciones de estudio</span>
                  <span className={`preference-status ${userData.notificationsEnabled ? 'enabled' : 'disabled'}`}>
                    {userData.notificationsEnabled ? 'Activadas' : 'Desactivadas'}
                  </span>
                </div>
              </div>
            </div>
            
            <button 
              className="logout-button"
              onClick={handleSignOut}
            >
              <i className="fas fa-sign-out-alt"></i>
              Cerrar sesión
            </button>
            
            <button 
              className="delete-account-button"
              onClick={() => setShowDeleteModal(true)}
            >
              <i className="fas fa-trash-alt"></i>
              Eliminar cuenta
            </button>
          </section>
        )}
      </main>
      
      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <div className="delete-modal-header">
              <h3>⚠️ Eliminar cuenta</h3>
              <button 
                className="close-modal-button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="delete-modal-content">
              <div className="warning-message">
                <i className="fas fa-exclamation-triangle"></i>
                <p><strong>Esta acción es irreversible.</strong></p>
                <p>Se eliminarán permanentemente:</p>
                <ul>
                  <li>Tu cuenta de usuario</li>
                  <li>Todos tus notebooks</li>
                  <li>Todos tus conceptos</li>
                  <li>Tu progreso de estudio</li>
                </ul>
              </div>
              
              <div className="confirmation-input">
                <label htmlFor="deleteConfirmation">
                  Escribe <strong>"eliminar"</strong> para confirmar:
                </label>
                <input
                  type="text"
                  id="deleteConfirmation"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="eliminar"
                  className="form-control"
                />
              </div>
            </div>
            
            <div className="delete-modal-actions">
              <button 
                className="cancel-delete-button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
                disabled={deletingAccount}
              >
                Cancelar
              </button>
              
              <button 
                className="confirm-delete-button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation !== 'eliminar' || deletingAccount}
              >
                {deletingAccount ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash-alt"></i>
                    Eliminar cuenta
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