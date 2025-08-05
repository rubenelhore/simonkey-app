import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { createUniversityUser, updateUserToUniversity } from '../services/userService';
import { UserSubscriptionType } from '../types/interfaces';
import './UniversityUsersTab.css';

interface UniversityUser {
  id: string;
  email: string;
  displayName: string;
  schoolName?: string;
  createdAt: any;
}

interface User {
  id: string;
  email: string;
  displayName: string;
  subscription: string;
}

const UniversityUsersTab: React.FC = () => {
  const [universityUsers, setUniversityUsers] = useState<UniversityUser[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    nombre: '',
    displayName: '',
    birthdate: '',
    schoolName: '',
    password: ''
  });

  // Load university users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Load university users
      const universityQuery = query(
        collection(db, 'users'),
        where('subscription', '==', UserSubscriptionType.UNIVERSITY)
      );
      const universitySnapshot = await getDocs(universityQuery);
      const universityData = universitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UniversityUser[];
      setUniversityUsers(universityData);

      // Load all users for conversion option
      const allUsersSnapshot = await getDocs(collection(db, 'users'));
      const allUsersData = allUsersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
      
      // Filter out university users
      const nonUniversityUsers = allUsersData.filter(
        user => user.subscription !== UserSubscriptionType.UNIVERSITY
      );
      setAllUsers(nonUniversityUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      showNotification('Error al cargar usuarios', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await createUniversityUser(formData);
      
      if (result.success) {
        showNotification('Usuario universitario creado exitosamente', 'success');
        setShowCreateForm(false);
        setFormData({
          email: '',
          username: '',
          nombre: '',
          displayName: '',
          birthdate: '',
          schoolName: '',
          password: ''
        });
        loadUsers();
      } else {
        showNotification(result.error || 'Error al crear usuario', 'error');
      }
    } catch (error) {
      showNotification('Error al crear usuario', 'error');
    }
  };

  const handleConvertUser = async () => {
    if (!selectedUserId) return;

    try {
      const schoolName = prompt('Ingrese el nombre de la universidad (opcional):');
      const result = await updateUserToUniversity(selectedUserId, schoolName || undefined);
      
      if (result.success) {
        showNotification('Usuario convertido a universitario exitosamente', 'success');
        setShowConvertModal(false);
        setSelectedUserId('');
        loadUsers();
      } else {
        showNotification(result.error || 'Error al convertir usuario', 'error');
      }
    } catch (error) {
      showNotification('Error al convertir usuario', 'error');
    }
  };

  const handleRemoveUniversity = async (userId: string) => {
    if (!confirm('¿Está seguro de remover el acceso universitario a este usuario?')) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        subscription: UserSubscriptionType.FREE
      });
      showNotification('Acceso universitario removido', 'success');
      loadUsers();
    } catch (error) {
      showNotification('Error al remover acceso universitario', 'error');
    }
  };

  if (loading) {
    return (
      <div className="university-tab">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <p>Cargando usuarios universitarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="university-tab">
      <div className="tab-header">
        <h2>🎓 Gestión de Usuarios Universitarios</h2>
        <p className="tab-description">
          Administra usuarios con acceso universitario especial
        </p>
      </div>

      <div className="actions-bar">
        <button 
          className="primary-button"
          onClick={() => setShowCreateForm(true)}
        >
          <i className="fas fa-plus"></i> Crear Usuario Universitario
        </button>
        <button 
          className="secondary-button"
          onClick={() => setShowConvertModal(true)}
        >
          <i className="fas fa-exchange-alt"></i> Convertir Usuario Existente
        </button>
        <button 
          className="refresh-button"
          onClick={loadUsers}
        >
          <i className="fas fa-sync-alt"></i> Actualizar
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Crear Usuario Universitario</h3>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nombre de Usuario *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nombre a Mostrar *</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Fecha de Nacimiento *</label>
                <input
                  type="date"
                  value={formData.birthdate}
                  onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Universidad</label>
                <input
                  type="text"
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  placeholder="Nombre de la universidad"
                />
              </div>
              <div className="form-group">
                <label>Contraseña Temporal</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Dejar vacío para requerir creación al iniciar sesión"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Crear Usuario
                </button>
                <button 
                  type="button" 
                  className="secondary-button"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert User Modal */}
      {showConvertModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Convertir Usuario a Universitario</h3>
            <div className="form-group">
              <label>Seleccionar Usuario</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">-- Seleccionar --</option>
                {allUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.displayName || user.email} ({user.subscription})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button 
                className="primary-button"
                onClick={handleConvertUser}
                disabled={!selectedUserId}
              >
                Convertir
              </button>
              <button 
                className="secondary-button"
                onClick={() => {
                  setShowConvertModal(false);
                  setSelectedUserId('');
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* University Users List */}
      <div className="university-users-section">
        <h3>Usuarios Universitarios Actuales ({universityUsers.length})</h3>
        {universityUsers.length === 0 ? (
          <div className="empty-state">
            <p>No hay usuarios universitarios registrados</p>
          </div>
        ) : (
          <div className="users-grid">
            {universityUsers.map(user => (
              <div key={user.id} className="university-user-card">
                <div className="user-info">
                  <h4>{user.displayName}</h4>
                  <p className="user-email">{user.email}</p>
                  {user.schoolName && (
                    <p className="user-school">
                      <i className="fas fa-university"></i> {user.schoolName}
                    </p>
                  )}
                  <p className="user-created">
                    <i className="fas fa-calendar"></i> Creado: {
                      user.createdAt?.toDate?.().toLocaleDateString('es-ES') || 'Fecha no disponible'
                    }
                  </p>
                  <p className="user-id">
                    <i className="fas fa-id-card"></i> ID: {user.id}
                  </p>
                </div>
                <div className="user-actions">
                  <button 
                    className="danger-button"
                    onClick={() => handleRemoveUniversity(user.id)}
                  >
                    <i className="fas fa-times"></i> Remover Acceso
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <div className="notification-content">
            <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversityUsersTab;