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
import { deleteAllUserData, deleteUserCompletely } from '../services/userService';
import { deleteUserWithConfirmation, syncSchoolUsers, migrateUsers } from '../services/firebaseFunctions';
import SchoolLinking from '../components/SchoolLinking';
import SchoolCreation from '../components/SchoolCreation';
import '../styles/SuperAdminPage.css';

interface User {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  subscription: UserSubscriptionType;
  schoolRole?: SchoolRole;
  createdAt: any;
  username?: string;
  displayName?: string;
  birthdate?: string;
  notebookCount?: number;
  maxNotebooks?: number;
}

const SuperAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, userProfile, loading: userTypeLoading } = useUserType();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);

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

  const deleteUser = async (userId: string, userName: string) => {
    try {
      console.log('🗑️ SuperAdmin eliminando usuario con Firebase Function:', userId);
      
      // Usar la nueva función con Firebase Functions
      await deleteUserWithConfirmation(
        userId,
        userName,
        // onProgress callback
        (message) => {
          console.log('📊 Progreso de eliminación:', message);
          // Aquí podrías mostrar un toast o notificación
        },
        // onSuccess callback
        (result) => {
          console.log('✅ Usuario eliminado exitosamente:', result);
          alert(`✅ Usuario "${userName}" eliminado exitosamente!\n\n${result.message}`);
          loadData(); // Recargar la lista de usuarios
        },
        // onError callback
        (error) => {
          console.error('❌ Error eliminando usuario:', error);
          alert(`❌ Error eliminando usuario: ${error}`);
        }
      );
      
    } catch (error) {
      console.error('Error en deleteUser:', error);
      alert('Error al eliminar el usuario. Por favor, intenta de nuevo.');
    }
  };

  // Funciones de sincronización de usuarios escolares
  const handleSyncAllSchoolUsers = async () => {
    if (!window.confirm('¿Estás seguro de que quieres sincronizar TODOS los usuarios escolares? Esto creará usuarios reales en Firebase Auth para todos los schoolTeachers y schoolStudents.')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      console.log('🚀 Iniciando sincronización completa...');
      const results = await syncSchoolUsers('all');
      setSyncResults(results.results);
      
      console.log('🎉 Sincronización completada:', results);
      alert(`Sincronización completada: ${results.results.teachers.success + results.results.students.success} exitosos, ${results.results.teachers.errors.length + results.results.students.errors.length} errores`);
      loadData();
    } catch (error: any) {
      console.error('❌ Error en sincronización:', error);
      alert(`Error en sincronización: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncTeachers = async () => {
    if (!window.confirm('¿Estás seguro de que quieres sincronizar TODOS los profesores escolares?')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      const results = await syncSchoolUsers('teachers');
      setSyncResults({ teachers: results.results.teachers, students: { success: 0, errors: [] } });
      alert(`Sincronización de profesores completada: ${results.results.teachers.success} exitosos, ${results.results.teachers.errors.length} errores`);
      loadData();
    } catch (error: any) {
      console.error('❌ Error en sincronización de profesores:', error);
      alert(`Error en sincronización: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncStudents = async () => {
    if (!window.confirm('¿Estás seguro de que quieres sincronizar TODOS los estudiantes escolares?')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      const results = await syncSchoolUsers('students');
      setSyncResults({ teachers: { success: 0, errors: [] }, students: results.results.students });
      alert(`Sincronización de estudiantes completada: ${results.results.students.success} exitosos, ${results.results.students.errors.length} errores`);
      loadData();
    } catch (error: any) {
      console.error('❌ Error en sincronización de estudiantes:', error);
      alert(`Error en sincronización: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleMigrateExistingTeachers = async () => {
    if (!window.confirm('¿Estás seguro de que quieres migrar los profesores existentes?')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      const result = await migrateUsers();
      alert(`Migración completada: ${result.updatedCount} usuarios actualizados, ${result.errorCount} errores`);
      loadData();
    } catch (error: any) {
      console.error('❌ Error en migración:', error);
      alert(`Error en migración: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCheckTeacherStatus = async () => {
    const teacherId = prompt('Ingresa el ID del profesor a verificar:');
    if (!teacherId) return;
    
    try {
      const results = await syncSchoolUsers('specific', teacherId);
      const teacherResult = results.results.teachers;
      
      if (teacherResult.success > 0) {
        alert(`✅ Profesor encontrado y sincronizado correctamente`);
      } else if (teacherResult.errors.length > 0) {
        alert(`❌ Error con el profesor: ${teacherResult.errors[0].error}`);
      } else {
        alert(`ℹ️ Profesor no encontrado en la base de datos`);
      }
    } catch (error: any) {
      console.error('❌ Error verificando profesor:', error);
      alert(`Error verificando profesor: ${error.message}`);
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
            className={`tab-button ${activeTab === 'schoolLinking' ? 'active' : ''}`}
            onClick={() => setActiveTab('schoolLinking')}
          >
            <i className="fas fa-link"></i> Vinculación Escolar
          </button>
          <button 
            className={`tab-button ${activeTab === 'schoolCreation' ? 'active' : ''}`}
            onClick={() => setActiveTab('schoolCreation')}
          >
            <i className="fas fa-plus-circle"></i> Creación Escolar
          </button>
          <button 
            className={`tab-button ${activeTab === 'schoolSync' ? 'active' : ''}`}
            onClick={() => setActiveTab('schoolSync')}
          >
            <i className="fas fa-sync-alt"></i>
            Sync Escolar
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
                            <option value={SchoolRole.TUTOR}>👨‍👩‍👧‍👦 Tutor</option>
                          </select>
                        </div>
                      )}
                      
                      <div className="action-buttons">
                        <button 
                          className="delete-button"
                          onClick={() => deleteUser(user.id, user.nombre || '')}
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

          {/* Tab de Vinculación Escolar */}
          {activeTab === 'schoolLinking' && (
            <SchoolLinking onRefresh={loadData} />
          )}

          {/* Tab de Creación Escolar */}
          {activeTab === 'schoolCreation' && (
            <SchoolCreation onRefresh={loadData} />
          )}

          {/* Tab de Sincronización Escolar */}
          {activeTab === 'schoolSync' && (
            <div className="school-sync-tab">
              <div className="tab-header">
                <h2>🔄 Sincronización de Usuarios Escolares</h2>
                <p className="tab-description">
                  Sincroniza los usuarios de las colecciones schoolTeachers y schoolStudents 
                  para crear usuarios reales en Firebase Auth que puedan hacer login.
                </p>
              </div>

              {syncLoading && (
                <div className="loading-overlay">
                  <div className="spinner"></div>
                  <p>Sincronizando usuarios escolares...</p>
                </div>
              )}

              <div className="sync-actions">
                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🚀 Sincronización Completa</h3>
                    <p>Sincroniza TODOS los profesores y estudiantes escolares</p>
                  </div>
                  <button 
                    className="sync-button sync-all"
                    onClick={handleSyncAllSchoolUsers}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-sync-alt"></i>
                    Sincronizar Todo
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>👨‍🏫 Solo Profesores</h3>
                    <p>Sincroniza únicamente los schoolTeachers</p>
                  </div>
                  <button 
                    className="sync-button sync-teachers"
                    onClick={handleSyncTeachers}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-chalkboard-teacher"></i>
                    Sincronizar Profesores
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>👨‍🎓 Solo Estudiantes</h3>
                    <p>Sincroniza únicamente los schoolStudents</p>
                  </div>
                  <button 
                    className="sync-button sync-students"
                    onClick={handleSyncStudents}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-user-graduate"></i>
                    Sincronizar Estudiantes
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🔄 Migrar Profesores Existentes</h3>
                    <p>Migra usuarios con schoolRole: 'teacher' a schoolTeachers</p>
                  </div>
                  <button 
                    className="sync-button sync-migrate"
                    onClick={handleMigrateExistingTeachers}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-sync-alt"></i>
                    Migrar Profesores
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🔍 Verificar Estado de Profesor</h3>
                    <p>Verifica si un usuario existe en schoolTeachers</p>
                  </div>
                  <button 
                    className="sync-button sync-check"
                    onClick={handleCheckTeacherStatus}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-search"></i>
                    Verificar Estado
                  </button>
                </div>
              </div>

              {syncResults && (
                <div className="sync-results">
                  <h3>📊 Resultados de Sincronización</h3>
                  
                  {syncResults.teachers && (
                    <div className="result-section">
                      <h4>👨‍🏫 Profesores</h4>
                      <div className="result-stats">
                        <div className="stat-item success">
                          <span className="stat-number">{syncResults.teachers.success}</span>
                          <span className="stat-label">Exitosos</span>
                        </div>
                        <div className="stat-item error">
                          <span className="stat-number">{syncResults.teachers.errors.length}</span>
                          <span className="stat-label">Errores</span>
                        </div>
                      </div>
                      
                      {syncResults.teachers.errors.length > 0 && (
                        <div className="error-details">
                          <h5>Errores en Profesores:</h5>
                          {syncResults.teachers.errors.map((error: any, index: number) => (
                            <div key={index} className="error-item">
                              <strong>{error.email}:</strong> {error.error}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {syncResults.students && (
                    <div className="result-section">
                      <h4>👨‍🎓 Estudiantes</h4>
                      <div className="result-stats">
                        <div className="stat-item success">
                          <span className="stat-number">{syncResults.students.success}</span>
                          <span className="stat-label">Exitosos</span>
                        </div>
                        <div className="stat-item error">
                          <span className="stat-number">{syncResults.students.errors.length}</span>
                          <span className="stat-label">Errores</span>
                        </div>
                      </div>
                      
                      {syncResults.students.errors.length > 0 && (
                        <div className="error-details">
                          <h5>Errores en Estudiantes:</h5>
                          {syncResults.students.errors.map((error: any, index: number) => (
                            <div key={index} className="error-item">
                              <strong>{error.email}:</strong> {error.error}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="sync-info">
                <h3>ℹ️ Información Importante</h3>
                <ul>
                  <li>La sincronización crea usuarios reales en Firebase Auth con contraseña "1234"</li>
                  <li>Los usuarios sincronizados podrán hacer login en el sistema</li>
                  <li>Se mantienen los datos originales en las colecciones escolares</li>
                  <li>Los usuarios ya existentes solo se actualizarán en la colección users</li>
                  <li>Es recomendable hacer backup antes de ejecutar la sincronización masiva</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPage; 