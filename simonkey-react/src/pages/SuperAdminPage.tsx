import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';
import '../styles/SuperAdminPage.css';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { getAuth, listUsers } from 'firebase/auth';

interface User {
  id: string;
  nombre?: string;
  displayName?: string;
  email?: string;
  subscription?: string;
  schoolRole?: string;
  createdAt?: any;
  lastLoginAt?: any;
  lastLogin?: any;
  lastSignIn?: any;
  lastLogoutAt?: any;
  lastLogout?: any;
  lastSignOut?: any;
  updatedAt?: any;
  notebookCount?: number;
  conceptsCreatedThisWeek?: number;
  notebooksCreatedThisWeek?: number;
}

const SuperAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: userTypeLoading } = useUserType();
  const [activeTab, setActiveTab] = useState('usuarios');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    nombre: '',
    email: '',
    subscription: '',
    role: '',
    fechaCreacion: '',
    ultimaSesion: ''
  });

  // Verificar si el usuario es súper admin
  React.useEffect(() => {
    if (!userTypeLoading && !isSuperAdmin) {
      navigate('/notebooks');
    }
  }, [isSuperAdmin, userTypeLoading, navigate]);

  // Cargar usuarios cuando se selecciona la pestaña
  useEffect(() => {
    if (activeTab === 'usuarios') {
      loadUsers();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: User[] = [];
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        usersData.push({
          id: doc.id,
          ...userData
        });
      });
      
      console.log(`Total users loaded: ${usersData.length}`);
      
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para filtrar usuarios
  const filterUsers = () => {
    let filtered = users.filter(user => {
      const nombre = (user.displayName || user.nombre || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const subscription = (user.subscription || 'free').toLowerCase();
      const role = (user.schoolRole || 'individual').toLowerCase();
      
      return nombre.includes(filters.nombre.toLowerCase()) &&
             email.includes(filters.email.toLowerCase()) &&
             subscription.includes(filters.subscription.toLowerCase()) &&
             role.includes(filters.role.toLowerCase());
    });
    setFilteredUsers(filtered);
  };

  // Ejecutar filtros cuando cambien
  React.useEffect(() => {
    filterUsers();
  }, [filters, users]);

  // Mostrar loading mientras se verifica el tipo de usuario
  if (userTypeLoading) {
    return (
      <div className="super-admin-container">
        <div className="loading-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="loading-spinner"></div>
          <p>Verificando permisos de súper admin...</p>
        </div>
      </div>
    );
  }

  // Si no es súper admin, no mostrar nada (será redirigido)
  if (!isSuperAdmin) {
    return null;
  }

  const renderUsersTab = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando usuarios...</p>
        </div>
      );
    }

    return (
      <div className="users-section">
        <h2>👥 Usuarios ({filteredUsers.length} de {users.length})</h2>
        <div className="simple-table-container">
          <table className="simple-users-table">
            <thead>
              <tr>
                <th style={{ width: '16%', textAlign: 'center' }}>
                  Nombre
                  <div className="filter-input">
                    <input
                      type="text"
                      placeholder="Filtrar nombre..."
                      value={filters.nombre}
                      onChange={(e) => setFilters({...filters, nombre: e.target.value})}
                      className="header-filter"
                    />
                  </div>
                </th>
                <th style={{ width: '20%', textAlign: 'center' }}>
                  Email
                  <div className="filter-input">
                    <input
                      type="text"
                      placeholder="Filtrar email..."
                      value={filters.email}
                      onChange={(e) => setFilters({...filters, email: e.target.value})}
                      className="header-filter"
                    />
                  </div>
                </th>
                <th style={{ width: '10%', textAlign: 'center' }}>
                  Suscripción
                  <div className="filter-input">
                    <select
                      value={filters.subscription}
                      onChange={(e) => setFilters({...filters, subscription: e.target.value})}
                      className="header-filter"
                    >
                      <option value="">Todas</option>
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="school">School</option>
                      <option value="university">University</option>
                    </select>
                  </div>
                </th>
                <th style={{ width: '14%', textAlign: 'center' }}>
                  Rol
                  <div className="filter-input">
                    <select
                      value={filters.role}
                      onChange={(e) => setFilters({...filters, role: e.target.value})}
                      className="header-filter"
                    >
                      <option value="">Todos</option>
                      <option value="individual">Individual</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </th>
                <th style={{ width: '14%', textAlign: 'center' }}>Fecha Creación</th>
                <th style={{ width: '14%', textAlign: 'center' }}>Última Sesión</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Duración Sesión</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td style={{ width: '16%' }}>
                    {user.displayName || user.nombre || 'Sin nombre'}
                  </td>
                  <td style={{ width: '20%' }}>
                    {user.email || 'Sin email'}
                  </td>
                  <td style={{ width: '10%' }}>
                    <span className={`sub-badge ${user.subscription || 'free'}`}>
                      {user.subscription || 'free'}
                    </span>
                  </td>
                  <td style={{ width: '14%' }}>
                    {user.schoolRole || 'individual'}
                  </td>
                  <td style={{ width: '14%' }}>
                    {user.createdAt ? 
                      new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 
                      'No disponible'
                    }
                  </td>
                  <td style={{ width: '14%' }}>
                    {(() => {
                      // Buscar diferentes campos que podrían contener la fecha de último login
                      const lastLogin = user.lastLoginAt || user.lastLogin || user.lastSignIn || user.updatedAt;
                      if (lastLogin && lastLogin.seconds) {
                        return new Date(lastLogin.seconds * 1000).toLocaleDateString();
                      } else if (lastLogin && typeof lastLogin === 'string') {
                        return new Date(lastLogin).toLocaleDateString();
                      } else if (lastLogin && lastLogin.toDate) {
                        return lastLogin.toDate().toLocaleDateString();
                      }
                      return 'Nunca';
                    })()}
                  </td>
                  <td style={{ width: '12%' }}>
                    {(() => {
                      // Solo mostrar datos reales de duración de sesión
                      const realDuration = user.sessionDuration || user.lastSessionDuration || user.sessionTime || 
                                         user.totalSessionTime || user.activeTime || user.timeSpent;
                      
                      if (realDuration && typeof realDuration === 'number') {
                        // Convertir a minutos si está en segundos o milisegundos
                        let minutes = realDuration;
                        if (realDuration > 1000) {
                          minutes = Math.floor(realDuration / (1000 * 60)); // De milisegundos a minutos
                        } else if (realDuration > 300) {
                          minutes = Math.floor(realDuration / 60); // De segundos a minutos
                        }
                        
                        if (minutes > 0) {
                          if (minutes > 60) {
                            const hours = Math.floor(minutes / 60);
                            const mins = minutes % 60;
                            return `${hours}h ${mins}m`;
                          }
                          return `${minutes}m`;
                        }
                      }
                      
                      // Si tenemos campos de login y logout reales, calcular la diferencia
                      const loginTime = user.lastLoginAt || user.lastLogin || user.lastSignIn;
                      const logoutTime = user.lastLogoutAt || user.lastLogout || user.lastSignOut;
                      
                      if (loginTime && logoutTime) {
                        try {
                          const loginDate = loginTime.seconds ? new Date(loginTime.seconds * 1000) : new Date(loginTime);
                          const logoutDate = logoutTime.seconds ? new Date(logoutTime.seconds * 1000) : new Date(logoutTime);
                          const diffMs = logoutDate.getTime() - loginDate.getTime();
                          const minutes = Math.floor(diffMs / (1000 * 60));
                          if (minutes > 0) {
                            if (minutes > 60) {
                              const hours = Math.floor(minutes / 60);
                              const mins = minutes % 60;
                              return `${hours}h ${mins}m`;
                            }
                            return `${minutes}m`;
                          }
                        } catch (error) {
                          console.error('Error calculating session duration:', error);
                        }
                      }
                      
                      return 'Sin datos';
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && users.length > 0 && (
            <div className="no-users">
              <p>No se encontraron usuarios con los filtros aplicados</p>
            </div>
          )}
          
          {users.length === 0 && (
            <div className="no-users">
              <p>No se encontraron usuarios</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <HeaderWithHamburger title="🛡️ Panel de Control - Súper Admin" />
      <div className="super-admin-container with-header-sidebar">
        <div className="admin-content">
          <div className="welcome-section">
            <h1>Panel de Súper Admin</h1>
            <p>Bienvenido al panel de control de súper administrador.</p>
          </div>
          
          <div className="admin-tabs">
            <button 
              className={`tab-button ${activeTab === 'usuarios' ? 'active' : ''}`}
              onClick={() => setActiveTab('usuarios')}
            >
              👥 Usuarios
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'usuarios' && renderUsersTab()}
          </div>
        </div>
      </div>
    </>
  );
};

export default SuperAdminPage;