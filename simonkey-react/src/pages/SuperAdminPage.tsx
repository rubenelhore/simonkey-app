import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';
import { db, auth } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';
import { deleteAllUserData } from '../services/userService';
import UserDataManagement from '../components/UserDataManagement';
import '../styles/SuperAdminPage.css';

interface User {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  subscription: UserSubscriptionType;
  schoolRole?: SchoolRole;
  schoolId?: string;
  createdAt: any;
  username?: string;
  displayName?: string;
  birthdate?: string;
  notebookCount?: number;
  maxNotebooks?: number;
}

interface Institution {
  id: string;
  name: string;
  email: string;
  adminId: string;
  createdAt: any;
}

interface Notebook {
  id: string;
  title: string;
  userId: string;
  color: string;
  concepts: any[];
  createdAt: any;
}

interface NewInstitution {
  name: string;
  email: string;
  adminId: string;
}

const SuperAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, user, userProfile, loading: userTypeLoading } = useUserType();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResults, setSqlResults] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [newInstitution, setNewInstitution] = useState<NewInstitution>({
    name: '',
    email: '',
    adminId: ''
  });
  const [showNewInstitutionModal, setShowNewInstitutionModal] = useState(false);

  console.log('SuperAdminPage - Component loaded - FULL VERSION');
  console.log('SuperAdminPage - isSuperAdmin:', isSuperAdmin);
  console.log('SuperAdminPage - userTypeLoading:', userTypeLoading);
  console.log('SuperAdminPage - userProfile:', userProfile);

  // Verificar si el usuario es súper admin
  useEffect(() => {
    console.log('SuperAdminPage - useEffect check - isSuperAdmin:', isSuperAdmin, 'userTypeLoading:', userTypeLoading);
    
    // Solo redirigir si ya terminó de cargar y NO es súper admin
    if (!userTypeLoading && !isSuperAdmin) {
      console.log('SuperAdminPage - Redirecting to /notebooks - not super admin');
      navigate('/notebooks');
    }
  }, [isSuperAdmin, userTypeLoading, navigate]);

  // Cargar datos
  useEffect(() => {
    if (isSuperAdmin && !userTypeLoading) {
      console.log('SuperAdminPage - Loading data...');
      loadData();
    }
  }, [isSuperAdmin, userTypeLoading]);

  const loadData = async () => {
    console.log('SuperAdminPage - loadData called');
    setLoading(true);
    try {
      // Cargar usuarios de la colección 'users' (principal)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      
      console.log('SuperAdminPage - Users from "users" collection:', usersData.length);
      console.log('SuperAdminPage - Users from "users" collection details:', usersData.map(u => ({
        id: u.id,
        email: u.email,
        nombre: u.nombre,
        displayName: u.displayName,
        username: u.username,
        apellidos: u.apellidos,
        subscription: u.subscription,
        birthdate: u.birthdate,
        notebookCount: u.notebookCount,
        maxNotebooks: u.maxNotebooks
      })));

      // Cargar usuarios de la colección 'usuarios' (español) si existe
      try {
        const usuariosSnapshot = await getDocs(collection(db, 'usuarios'));
        const usuariosData = usuariosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        
        console.log('SuperAdminPage - Users from "usuarios" collection:', usuariosData.length);
        console.log('SuperAdminPage - Users from "usuarios" collection details:', usuariosData.map(u => ({
          id: u.id,
          email: u.email,
          nombre: u.nombre,
          displayName: u.displayName,
          username: u.username,
          apellidos: u.apellidos,
          subscription: u.subscription,
          birthdate: u.birthdate,
          notebookCount: u.notebookCount,
          maxNotebooks: u.maxNotebooks
        })));

        // Combinar usuarios de ambas colecciones (evitando duplicados)
        const allUsers = [...usersData];
        usuariosData.forEach(usuario => {
          const exists = allUsers.find(u => u.id === usuario.id);
          if (!exists) {
            allUsers.push(usuario);
          }
        });

        setUsers(allUsers);
        console.log('SuperAdminPage - Total combined users:', allUsers.length);
      } catch (error) {
        console.log('SuperAdminPage - No "usuarios" collection found, using only "users"');
        setUsers(usersData);
      }

      // Cargar instituciones
      const institutionsSnapshot = await getDocs(collection(db, 'institutions'));
      const institutionsData = institutionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Institution[];
      setInstitutions(institutionsData);
      console.log('SuperAdminPage - Institutions loaded:', institutionsData.length);

      // Cargar cuadernos
      const notebooksSnapshot = await getDocs(collection(db, 'notebooks'));
      const notebooksData = notebooksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notebook[];
      setNotebooks(notebooksData);
      console.log('SuperAdminPage - Notebooks loaded:', notebooksData.length);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gestión de usuarios
  const updateUserSubscription = async (userId: string, subscription: UserSubscriptionType) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        subscription,
        updatedAt: serverTimestamp()
      });
      await loadData();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const updateUserSchoolRole = async (userId: string, schoolRole: SchoolRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        schoolRole,
        updatedAt: serverTimestamp()
      });
      await loadData();
    } catch (error) {
      console.error('Error updating user school role:', error);
    }
  };

  const deleteUser = async (userId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción eliminará TODOS sus datos incluyendo notebooks, conceptos, sesiones de estudio y estadísticas. Esta acción es irreversible.')) {
      try {
        console.log('🗑️ SuperAdmin eliminando usuario:', userId);
        
        // Usar la función utilitaria para eliminar todos los datos del usuario
        await deleteAllUserData(userId);
        
        console.log('✅ Usuario eliminado exitosamente por SuperAdmin');
        await loadData();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error al eliminar el usuario. Por favor, intenta de nuevo.');
      }
    }
  };

  // Gestión de instituciones
  const createInstitution = async (institutionData: NewInstitution) => {
    try {
      await addDoc(collection(db, 'institutions'), {
        ...institutionData,
        createdAt: serverTimestamp()
      });
      setNewInstitution({ name: '', email: '', adminId: '' });
      setShowNewInstitutionModal(false);
      await loadData();
    } catch (error) {
      console.error('Error creating institution:', error);
    }
  };

  const updateInstitution = async (institutionId: string, data: Partial<Institution>) => {
    try {
      await updateDoc(doc(db, 'institutions', institutionId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setEditingInstitution(null);
      await loadData();
    } catch (error) {
      console.error('Error updating institution:', error);
    }
  };

  const deleteInstitution = async (institutionId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta institución?')) {
      try {
        await deleteDoc(doc(db, 'institutions', institutionId));
        await loadData();
      } catch (error) {
        console.error('Error deleting institution:', error);
      }
    }
  };

  // Gestión de cuadernos
  const updateNotebook = async (notebookId: string, data: Partial<Notebook>) => {
    try {
      await updateDoc(doc(db, 'notebooks', notebookId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setEditingNotebook(null);
      await loadData();
    } catch (error) {
      console.error('Error updating notebook:', error);
    }
  };

  const deleteNotebook = async (notebookId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cuaderno?')) {
      try {
        await deleteDoc(doc(db, 'notebooks', notebookId));
        await loadData();
      } catch (error) {
        console.error('Error deleting notebook:', error);
      }
    }
  };

  // SQL Query executor (simplificado)
  const executeSqlQuery = async () => {
    try {
      setLoading(true);
      // Aquí implementarías la lógica para ejecutar consultas SQL
      // Por ahora, simulamos algunos resultados
      const results = [
        { id: 1, name: 'Ejemplo', value: 'Resultado' }
      ];
      setSqlResults(results);
    } catch (error) {
      console.error('Error executing SQL query:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para verificar usuarios huérfanos (en Auth pero no en Firestore)
  const checkOrphanUsers = async () => {
    try {
      console.log('SuperAdminPage - Checking for orphan users...');
      
      // Obtener todos los usuarios de Firestore
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const firestoreUserIds = usersSnapshot.docs.map(doc => doc.id);
      
      console.log('SuperAdminPage - Firestore user IDs:', firestoreUserIds);
      
      // Nota: No podemos listar todos los usuarios de Firebase Auth desde el cliente
      // por razones de seguridad, pero podemos verificar el usuario actual
      const currentUser = auth.currentUser;
      if (currentUser) {
        const isInFirestore = firestoreUserIds.includes(currentUser.uid);
        console.log('SuperAdminPage - Current user in Firestore:', isInFirestore);
        console.log('SuperAdminPage - Current user data:', {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL
        });
      }
      
      // Mostrar información sobre usuarios sin email o nombre
      const usersWithoutEmail = users.filter(u => !u.email);
      const usersWithoutName = users.filter(u => !u.nombre && !u.displayName && !u.username);
      
      console.log('SuperAdminPage - Users without email:', usersWithoutEmail.length);
      console.log('SuperAdminPage - Users without name:', usersWithoutName.length);
      
      if (usersWithoutEmail.length > 0) {
        console.log('SuperAdminPage - Users without email details:', usersWithoutEmail);
      }
      
      if (usersWithoutName.length > 0) {
        console.log('SuperAdminPage - Users without name details:', usersWithoutName);
      }
      
    } catch (error) {
      console.error('Error checking orphan users:', error);
    }
  };

  // Función para reparar usuarios con datos faltantes
  const repairUsers = async () => {
    try {
      console.log('SuperAdminPage - Starting user repair...');
      
      const usersToRepair = users.filter(u => !u.email || (!u.nombre && !u.displayName && !u.username));
      
      if (usersToRepair.length === 0) {
        console.log('SuperAdminPage - No users need repair');
        return;
      }
      
      console.log(`SuperAdminPage - Repairing ${usersToRepair.length} users...`);
      
      for (const user of usersToRepair) {
        try {
          const updates: any = {};
          
          // Si no tiene email, intentar obtenerlo del ID (si es un email)
          if (!user.email && user.id.includes('@')) {
            updates.email = user.id;
            console.log(`SuperAdminPage - Repaired email for user ${user.id}: ${user.id}`);
          }
          
          // Si no tiene nombre, usar el ID como fallback
          if (!user.nombre && !user.displayName && !user.username) {
            const fallbackName = user.id.includes('@') ? user.id.split('@')[0] : `Usuario_${user.id.slice(0, 8)}`;
            updates.nombre = fallbackName;
            updates.displayName = fallbackName;
            updates.username = fallbackName;
            console.log(`SuperAdminPage - Repaired name for user ${user.id}: ${fallbackName}`);
          }
          
          // Si no tiene suscripción, asignar FREE por defecto
          if (!user.subscription) {
            updates.subscription = UserSubscriptionType.FREE;
            updates.maxNotebooks = 4;
            updates.maxConceptsPerNotebook = 100;
            console.log(`SuperAdminPage - Repaired subscription for user ${user.id}: FREE`);
          }
          
          // Si no tiene fecha de creación, agregar una
          if (!user.createdAt) {
            updates.createdAt = serverTimestamp();
            console.log(`SuperAdminPage - Repaired createdAt for user ${user.id}`);
          }
          
          // Aplicar las actualizaciones si hay algo que reparar
          if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'users', user.id), {
              ...updates,
              updatedAt: serverTimestamp(),
              repaired: true
            });
            console.log(`SuperAdminPage - ✅ Repaired user ${user.id}`);
          }
          
        } catch (error) {
          console.error(`SuperAdminPage - ❌ Error repairing user ${user.id}:`, error);
        }
      }
      
      console.log('SuperAdminPage - User repair completed');
      
      // Recargar datos después de la reparación
      await loadData();
      
    } catch (error) {
      console.error('Error repairing users:', error);
    }
  };

  // Mostrar loading mientras se verifica el tipo de usuario
  if (userTypeLoading) {
    return (
      <div className="super-admin-container">
        <div className="loading-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="spinner"></div>
          <p>Verificando permisos de súper admin...</p>
        </div>
      </div>
    );
  }

  // Si no es súper admin, no mostrar nada (será redirigido)
  if (!isSuperAdmin) {
    console.log('SuperAdminPage - Not super admin, returning null');
    return null;
  }

  console.log('SuperAdminPage - Rendering full component');

  return (
    <div className="super-admin-container">
      <header className="super-admin-header">
        <div className="header-content">
          <h1>🛡️ Panel de Control - Súper Admin</h1>
          <button className="back-button" onClick={() => navigate('/notebooks')} title="Volver">
            <i className="fas fa-arrow-left"></i>
          </button>
        </div>
      </header>

      <div className="super-admin-content">
        <nav className="admin-tabs">
          <button 
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="fas fa-users"></i> Usuarios
          </button>
          <button 
            className={`tab-button ${activeTab === 'institutions' ? 'active' : ''}`}
            onClick={() => setActiveTab('institutions')}
          >
            <i className="fas fa-university"></i> Instituciones
          </button>
          <button 
            className={`tab-button ${activeTab === 'notebooks' ? 'active' : ''}`}
            onClick={() => setActiveTab('notebooks')}
          >
            <i className="fas fa-book"></i> Cuadernos
          </button>
          <button 
            className={`tab-button ${activeTab === 'sql' ? 'active' : ''}`}
            onClick={() => setActiveTab('sql')}
          >
            <i className="fas fa-database"></i> SQL Console
          </button>
          <button 
            className={`tab-button ${activeTab === 'userDataManagement' ? 'active' : ''}`}
            onClick={() => setActiveTab('userDataManagement')}
          >
            <i className="fas fa-database"></i>
            Gestión de Datos
          </button>
        </nav>

        <div className="tab-content">
          {loading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p>Cargando datos...</p>
            </div>
          )}

          {/* Tab de Usuarios */}
          {activeTab === 'users' && (
            <div className="users-tab">
              <div className="tab-header">
                <h2>Gestión de Usuarios ({users.length})</h2>
                <div className="header-actions">
                  <button className="repair-button" onClick={repairUsers} title="Reparar usuarios con datos faltantes">
                    <i className="fas fa-wrench"></i>
                  </button>
                  <button className="check-button" onClick={checkOrphanUsers} title="Verificar usuarios huérfanos">
                    <i className="fas fa-search"></i>
                  </button>
                  <button className="refresh-button" onClick={loadData} title="Actualizar datos">
                    <i className="fas fa-sync-alt"></i>
                  </button>
                </div>
              </div>
              
              <div className="users-grid">
                {users.map(user => (
                  <div key={user.id} className="user-card">
                    <div className="user-info">
                      <div className="user-header">
                        <h3>
                          {user.nombre || user.displayName || user.username || 'Sin nombre'}
                          {user.apellidos && ` ${user.apellidos}`}
                        </h3>
                        <span className={`badge ${user.subscription}`}>
                          {user.subscription === UserSubscriptionType.SUPER_ADMIN && '👑 Súper Admin'}
                          {user.subscription === UserSubscriptionType.FREE && '🆓 Gratis'}
                          {user.subscription === UserSubscriptionType.PRO && '⭐ Pro'}
                          {user.subscription === UserSubscriptionType.SCHOOL && `🏫 Escolar - ${user.schoolRole || 'Sin rol'}`}
                        </span>
                      </div>
                      
                      <div className="user-details">
                        <div className="detail-row">
                          <span className="detail-label">📧 Email:</span>
                          <span className="detail-value">{user.email || 'No disponible'}</span>
                        </div>
                        
                        <div className="detail-row">
                          <span className="detail-label">🆔 ID:</span>
                          <span className="detail-value user-id">{user.id}</span>
                        </div>

                        {/* Mostrar username si existe */}
                        {user.username && (
                          <div className="detail-row">
                            <span className="detail-label">👤 Username:</span>
                            <span className="detail-value">{user.username}</span>
                          </div>
                        )}

                        {/* Mostrar displayName si es diferente del nombre */}
                        {user.displayName && user.displayName !== user.nombre && (
                          <div className="detail-row">
                            <span className="detail-label">📝 Display Name:</span>
                            <span className="detail-value">{user.displayName}</span>
                          </div>
                        )}
                        
                        {user.schoolId && (
                          <div className="detail-row">
                            <span className="detail-label">🏫 Institución:</span>
                            <span className="detail-value">{user.schoolId}</span>
                          </div>
                        )}

                        {/* Mostrar fecha de nacimiento si existe */}
                        {user.birthdate && (
                          <div className="detail-row">
                            <span className="detail-label">🎂 Fecha nacimiento:</span>
                            <span className="detail-value">{user.birthdate}</span>
                          </div>
                        )}
                        
                        {user.createdAt && (
                          <div className="detail-row">
                            <span className="detail-label">📅 Creado:</span>
                            <span className="detail-value">
                              {user.createdAt.toDate ? 
                                user.createdAt.toDate().toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 
                                'Fecha no disponible'
                              }
                            </span>
                          </div>
                        )}

                        {/* Mostrar estadísticas si existen */}
                        {user.notebookCount !== undefined && (
                          <div className="detail-row">
                            <span className="detail-label">📚 Cuadernos:</span>
                            <span className="detail-value">{user.notebookCount}</span>
                          </div>
                        )}

                        {user.maxNotebooks !== undefined && (
                          <div className="detail-row">
                            <span className="detail-label">📊 Límite cuadernos:</span>
                            <span className="detail-value">{user.maxNotebooks === -1 ? '∞' : user.maxNotebooks}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="user-actions">
                      <div className="action-group">
                        <label className="action-label">Tipo de suscripción:</label>
                        <select 
                          value={user.subscription}
                          onChange={(e) => updateUserSubscription(user.id, e.target.value as UserSubscriptionType)}
                          className="subscription-select"
                        >
                          <option value={UserSubscriptionType.FREE}>🆓 Gratis</option>
                          <option value={UserSubscriptionType.PRO}>⭐ Pro</option>
                          <option value={UserSubscriptionType.SCHOOL}>🏫 Escolar</option>
                          <option value={UserSubscriptionType.SUPER_ADMIN}>👑 Súper Admin</option>
                        </select>
                      </div>
                      
                      {user.subscription === UserSubscriptionType.SCHOOL && (
                        <div className="action-group">
                          <label className="action-label">Rol escolar:</label>
                          <select 
                            value={user.schoolRole || ''}
                            onChange={(e) => updateUserSchoolRole(user.id, e.target.value as SchoolRole)}
                            className="role-select"
                          >
                            <option value={SchoolRole.ADMIN}>👨‍💼 Administrador</option>
                            <option value={SchoolRole.TEACHER}>👨‍🏫 Profesor</option>
                            <option value={SchoolRole.STUDENT}>👨‍🎓 Alumno</option>
                          </select>
                        </div>
                      )}
                      
                      <div className="action-buttons">
                        <button 
                          className="delete-button"
                          onClick={() => deleteUser(user.id)}
                          title="Eliminar usuario"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab de Instituciones */}
          {activeTab === 'institutions' && (
            <div className="institutions-tab">
              <div className="tab-header">
                <h2>Gestión de Instituciones ({institutions.length})</h2>
                <button className="add-button" onClick={() => setShowNewInstitutionModal(true)}>
                  <i className="fas fa-plus"></i> Nueva Institución
                </button>
              </div>
              
              <div className="institutions-grid">
                {institutions.map(institution => (
                  <div key={institution.id} className="institution-card">
                    <div className="institution-info">
                      <h3>{institution.name}</h3>
                      <p className="institution-email">{institution.email}</p>
                      <p className="institution-admin">Admin ID: {institution.adminId}</p>
                    </div>
                    
                    <div className="institution-actions">
                      <button 
                        className="edit-button"
                        onClick={() => setEditingInstitution(institution)}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button 
                        className="delete-button"
                        onClick={() => deleteInstitution(institution.id)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab de Cuadernos */}
          {activeTab === 'notebooks' && (
            <div className="notebooks-tab">
              <div className="tab-header">
                <h2>Gestión de Cuadernos ({notebooks.length})</h2>
                <button className="refresh-button" onClick={loadData} title="Actualizar datos">
                  <i className="fas fa-sync-alt"></i>
                </button>
              </div>
              
              <div className="notebooks-grid">
                {notebooks.map(notebook => (
                  <div key={notebook.id} className="notebook-card">
                    <div className="notebook-info">
                      <h3>{notebook.title}</h3>
                      <p className="notebook-user">Usuario: {notebook.userId}</p>
                      <p className="notebook-concepts">
                        Conceptos: {notebook.concepts?.length || 0}
                      </p>
                      <div 
                        className="notebook-color"
                        style={{ backgroundColor: notebook.color }}
                      ></div>
                    </div>
                    
                    <div className="notebook-actions">
                      <button 
                        className="edit-button"
                        onClick={() => setEditingNotebook(notebook)}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button 
                        className="delete-button"
                        onClick={() => deleteNotebook(notebook.id)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab de SQL Console */}
          {activeTab === 'sql' && (
            <div className="sql-tab">
              <div className="tab-header">
                <h2>SQL Console</h2>
                <button className="execute-button" onClick={executeSqlQuery}>
                  <i className="fas fa-play"></i> Ejecutar
                </button>
              </div>
              
              <div className="sql-editor">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="Escribe tu consulta SQL aquí..."
                  className="sql-textarea"
                />
              </div>
              
              <div className="sql-results">
                <h3>Resultados:</h3>
                <div className="results-table">
                  {sqlResults.map((result, index) => (
                    <div key={index} className="result-row">
                      {Object.entries(result).map(([key, value]) => (
                        <div key={key} className="result-cell">
                          <strong>{key}:</strong> {String(value)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab de Gestión de Datos de Usuario */}
          {activeTab === 'userDataManagement' && (
            <div className="user-data-management-tab">
              <div className="tab-header">
                <h2>Gestión de Datos de Usuario</h2>
                <p className="tab-description">
                  Herramientas para auditar y eliminar datos de usuario de manera segura.
                  Solo disponible para super administradores.
                </p>
              </div>
              
              <UserDataManagement />
            </div>
          )}
        </div>
      </div>

      {/* Modal para nueva institución */}
      {showNewInstitutionModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Nueva Institución</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              createInstitution(newInstitution);
            }}>
              <input
                type="text"
                placeholder="Nombre de la institución"
                value={newInstitution.name}
                onChange={(e) => setNewInstitution({...newInstitution, name: e.target.value})}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={newInstitution.email}
                onChange={(e) => setNewInstitution({...newInstitution, email: e.target.value})}
                required
              />
              <input
                type="text"
                placeholder="ID del administrador"
                value={newInstitution.adminId}
                onChange={(e) => setNewInstitution({...newInstitution, adminId: e.target.value})}
                required
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowNewInstitutionModal(false)}>
                  Cancelar
                </button>
                <button type="submit">Crear</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de edición de institución */}
      {editingInstitution && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Editar Institución</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              updateInstitution(editingInstitution.id, {
                name: formData.get('name') as string,
                email: formData.get('email') as string,
                adminId: formData.get('adminId') as string,
              });
            }}>
              <input
                name="name"
                type="text"
                placeholder="Nombre de la institución"
                defaultValue={editingInstitution.name}
                required
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                defaultValue={editingInstitution.email}
                required
              />
              <input
                name="adminId"
                type="text"
                placeholder="ID del administrador"
                defaultValue={editingInstitution.adminId}
                required
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingInstitution(null)}>
                  Cancelar
                </button>
                <button type="submit">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de edición de cuaderno */}
      {editingNotebook && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Editar Cuaderno</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              updateNotebook(editingNotebook.id, {
                title: formData.get('title') as string,
                color: formData.get('color') as string,
              });
            }}>
              <input
                name="title"
                type="text"
                placeholder="Título del cuaderno"
                defaultValue={editingNotebook.title}
                required
              />
              <input
                name="color"
                type="color"
                defaultValue={editingNotebook.color}
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingNotebook(null)}>
                  Cancelar
                </button>
                <button type="submit">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPage; 