import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';
import '../styles/SuperAdminPage.css';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import TeacherManagementImproved from '../components/TeacherManagementImproved';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, getDoc, limit } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

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
  sessionDuration?: any;
  lastSessionDuration?: any;
  sessionTime?: any;
  totalSessionTime?: any;
  activeTime?: any;
  timeSpent?: any;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: any;
  userId?: string;
  status?: string;
}

const SuperAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: userTypeLoading } = useUserType();
  const [activeTab, setActiveTab] = useState('usuarios');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    nombre: '',
    email: '',
    subscription: '',
    role: '',
    fechaCreacion: '',
    ultimaSesion: ''
  });
  const [messageFilters, setMessageFilters] = useState({
    search: '',
    status: ''
  });

  // Verificar si el usuario es súper admin
  React.useEffect(() => {
    if (!userTypeLoading && !isSuperAdmin) {
      navigate('/notebooks');
    } else if (!userTypeLoading && isSuperAdmin) {
      // Track super admin access
      if (typeof window !== 'undefined' && window.amplitude) {
        try {
          const amplitudeInstance = window.amplitude.getInstance();
          amplitudeInstance.logEvent('Super Admin Access', {
            page: 'SuperAdminPage',
            timestamp: new Date().toISOString()
          });
          console.log('✅ Amplitude: Super Admin access tracked');
        } catch (error) {
          console.warn('⚠️ Error tracking Super Admin access:', error);
        }
      }
    }
  }, [isSuperAdmin, userTypeLoading, navigate]);

  // Cargar datos cuando se selecciona la pestaña
  useEffect(() => {
    if (activeTab === 'usuarios') {
      loadUsers();
    } else if (activeTab === 'mensajes') {
      loadMessages();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Iniciando carga de usuarios...');
      console.log('🔐 Usuario actual:', {
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        isSuperAdmin: isSuperAdmin
      });
      
      // Usar query sin límites para asegurar que se traigan todos los usuarios
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      console.log(`📦 Snapshot size: ${usersSnapshot.size} documentos`);
      console.log(`📦 Snapshot empty: ${usersSnapshot.empty}`);
      
      const usersData: User[] = [];
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        console.log(`👤 Cargando usuario: ${userData.email || userData.displayName || doc.id}`);
        usersData.push({
          id: doc.id,
          ...userData
        });
      });
      
      console.log(`📊 TOTAL USUARIOS CARGADOS: ${usersData.length} (esperados: 65)`);
      console.log(`📄 Primeros 5 usuarios:`, usersData.slice(0, 5).map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        nombre: u.nombre
      })));
      
      if (usersData.length < 65) {
        console.warn(`⚠️ PROBLEMA: Solo se cargaron ${usersData.length} usuarios de los 65 esperados`);
        console.warn(`❌ FALTAN ${65 - usersData.length} usuarios`);
        
        // Intentar una segunda consulta para debug
        console.log('🔄 Intentando segunda consulta para debug...');
        const secondSnapshot = await getDocs(collection(db, 'users'));
        console.log(`🔍 Segunda consulta size: ${secondSnapshot.size}`);
        
        // También intentar contar todos los documentos con Firebase Admin
        console.log('🔍 Intentando consulta directa con límite alto...');
        try {
          const highLimitQuery = query(collection(db, 'users'), limit(1000));
          const highLimitSnapshot = await getDocs(highLimitQuery);
          console.log(`🔍 Consulta con límite 1000: ${highLimitSnapshot.size} documentos`);
          
          // Log de cada documento para ver cuáles faltan
          const loadedEmails = new Set(usersData.map(u => u.email).filter(Boolean));
          const loadedIds = new Set(usersData.map(u => u.id));
          
          console.log(`📧 Total emails válidos cargados: ${loadedEmails.size}`);
          console.log(`🆔 Total IDs cargados: ${loadedIds.size}`);
          console.log(`📧 Primeros 10 emails:`, Array.from(loadedEmails).slice(0, 10).sort());
          
          // Intentar crear una consulta de solo lectura directamente
          console.log('🔍 Verificando si el problema son las reglas de Firestore...');
          
          // Log de usuarios con datos incompletos
          const usersWithoutEmail = usersData.filter(u => !u.email);
          const usersWithoutDisplayName = usersData.filter(u => !u.displayName && !u.nombre);
          
          console.log(`❌ Usuarios sin email: ${usersWithoutEmail.length}`);
          console.log(`❌ Usuarios sin nombre: ${usersWithoutDisplayName.length}`);
          
          if (usersWithoutEmail.length > 0) {
            console.log('👤 Usuarios sin email:', usersWithoutEmail.map(u => u.id));
          }
          
        } catch (error) {
          console.error('❌ Error en consulta con límite alto:', error);
        }
      }
      
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error('❌ Error loading users:', error);
      console.error('❌ Error details:', error);
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

  const loadMessages = async () => {
    try {
      setLoading(true);
      const messagesQuery = query(
        collection(db, 'contactMessages'),
        orderBy('timestamp', 'desc')
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messagesData: ContactMessage[] = [];
      
      messagesSnapshot.forEach((doc) => {
        const messageData = doc.data();
        messagesData.push({
          id: doc.id,
          ...messageData
        });
      });
      
      console.log(`Total messages loaded: ${messagesData.length}`);
      
      setMessages(messagesData);
      setFilteredMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMessages = () => {
    let filtered = messages.filter(message => {
      const matchesSearch = !messageFilters.search || 
        message.name.toLowerCase().includes(messageFilters.search.toLowerCase()) ||
        message.email.toLowerCase().includes(messageFilters.search.toLowerCase()) ||
        message.subject.toLowerCase().includes(messageFilters.search.toLowerCase()) ||
        message.message.toLowerCase().includes(messageFilters.search.toLowerCase());
      
      const matchesStatus = !messageFilters.status || message.status === messageFilters.status;
      
      return matchesSearch && matchesStatus;
    });
    setFilteredMessages(filtered);
  };

  // Ejecutar filtros cuando cambien
  React.useEffect(() => {
    filterUsers();
  }, [filters, users]);

  React.useEffect(() => {
    filterMessages();
  }, [messageFilters, messages]);

  // Función para corregir usuarios sin lastLoginAt
  const fixUsersWithoutLastLogin = async () => {
    if (!window.confirm('¿Estás seguro de que quieres corregir los usuarios sin lastLoginAt? Esto usará la fecha de creación o última actualización como referencia.')) {
      return;
    }

    try {
      setLoading(true);
      let fixedCount = 0;
      let errorCount = 0;

      for (const user of users) {
        // Verificar si el usuario no tiene lastLoginAt o lastLogin
        if (!user.lastLoginAt && !user.lastLogin) {
          try {
            // Usar la fecha de creación o última actualización como fallback
            let fallbackDate = user.createdAt || user.updatedAt;
            
            // Si no hay fecha de creación ni actualización, usar la fecha actual
            if (!fallbackDate) {
              fallbackDate = serverTimestamp();
            }

            await updateDoc(doc(db, 'users', user.id), {
              lastLoginAt: fallbackDate,
              lastLogin: fallbackDate,
              updatedAt: serverTimestamp()
            });
            
            fixedCount++;
            console.log(`✅ Fixed user ${user.email || user.id}`);
          } catch (error) {
            console.error(`❌ Error fixing user ${user.email || user.id}:`, error);
            errorCount++;
          }
        }
      }

      alert(`Proceso completado:\n✅ Usuarios corregidos: ${fixedCount}\n❌ Errores: ${errorCount}`);
      
      // Recargar usuarios para ver los cambios
      if (fixedCount > 0) {
        loadUsers();
      }
    } catch (error) {
      console.error('Error en el proceso de corrección:', error);
      alert('Error durante la corrección. Ver consola para detalles.');
    } finally {
      setLoading(false);
    }
  };

  // Función para debuggear datos de login de un usuario específico
  const debugUserLogin = async () => {
    const email = prompt('Ingresa el email del usuario a debuggear:');
    if (!email) return;

    try {
      setLoading(true);
      const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!targetUser) {
        alert('Usuario no encontrado en la lista cargada.');
        return;
      }

      // Obtener datos frescos del usuario desde Firestore
      const userDocRef = doc(db, 'users', targetUser.id);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        alert('Usuario no encontrado en Firestore.');
        return;
      }

      const freshUserData = userDocSnap.data();
      
      const debugInfo = {
        'Email': freshUserData.email || 'N/A',
        'User ID': targetUser.id,
        'lastLoginAt': freshUserData.lastLoginAt || 'No existe',
        'lastLogin': freshUserData.lastLogin || 'No existe', 
        'lastActivity': freshUserData.lastActivity || 'No existe',
        'updatedAt': freshUserData.updatedAt || 'No existe',
        'createdAt': freshUserData.createdAt || 'No existe',
        'lastAuthProvider': freshUserData.lastAuthProvider || 'No existe'
      };

      console.log('🔍 DEBUG USUARIO:', email);
      console.table(debugInfo);

      // Mostrar en alert también
      let alertMessage = `DEBUG USUARIO: ${email}\n\n`;
      Object.entries(debugInfo).forEach(([key, value]) => {
        let displayValue = value;
        if (value && typeof value === 'object' && value.seconds) {
          displayValue = new Date(value.seconds * 1000).toLocaleString('es-ES');
        } else if (value && typeof value === 'object' && value.toDate) {
          displayValue = value.toDate().toLocaleString('es-ES');
        }
        alertMessage += `${key}: ${displayValue}\n`;
      });

      alert(alertMessage);
      
    } catch (error) {
      console.error('Error debugging user:', error);
      alert('Error obteniendo datos del usuario. Ver consola para detalles.');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="section-header">
          <h2>👥 Usuarios ({filteredUsers.length} de {users.length})</h2>
          <div className="action-buttons">
            <button 
              className="clear-filters-btn"
              onClick={() => setFilters({
                nombre: '',
                email: '',
                subscription: '',
                role: '',
                fechaCreacion: '',
                ultimaSesion: ''
              })}
              disabled={loading}
            >
              🗑️ Limpiar Filtros
            </button>
            <button 
              className="refresh-btn"
              onClick={loadUsers}
              disabled={loading}
            >
              🔄 Actualizar
            </button>
          </div>
        </div>
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
                <th style={{ width: '18%', textAlign: 'center' }}>Última Sesión</th>
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
                  <td style={{ width: '18%' }}>
                    {(() => {
                      // Recopilar TODAS las posibles fechas de login/actividad
                      const dates = [];
                      
                      // Campos principales de login
                      if (user.lastLoginAt) dates.push({ field: 'lastLoginAt', value: user.lastLoginAt, priority: 1 });
                      if (user.lastLogin) dates.push({ field: 'lastLogin', value: user.lastLogin, priority: 1 });
                      
                      // Campos de actividad
                      if (user.lastActivity) dates.push({ field: 'lastActivity', value: user.lastActivity, priority: 2 });
                      if (user.updatedAt) dates.push({ field: 'updatedAt', value: user.updatedAt, priority: 3 });
                      
                      // Campos legacy
                      if (user.lastSignIn) dates.push({ field: 'lastSignIn', value: user.lastSignIn, priority: 4 });
                      if (user.createdAt) dates.push({ field: 'createdAt', value: user.createdAt, priority: 5 });
                      
                      // Convertir fechas y ordenar por más reciente
                      const processedDates = dates.map(item => {
                        let date = null;
                        let timestamp = 0;
                        
                        if (item.value && item.value.seconds) {
                          date = new Date(item.value.seconds * 1000);
                          timestamp = item.value.seconds;
                        } else if (item.value && item.value.toDate) {
                          date = item.value.toDate();
                          timestamp = date.getTime() / 1000;
                        } else if (typeof item.value === 'string') {
                          date = new Date(item.value);
                          timestamp = date.getTime() / 1000;
                        } else if (item.value instanceof Date) {
                          date = item.value;
                          timestamp = date.getTime() / 1000;
                        }
                        
                        return {
                          ...item,
                          date,
                          timestamp,
                          isValid: date && !isNaN(date.getTime())
                        };
                      }).filter(item => item.isValid);
                      
                      // Ordenar por timestamp más reciente, pero priorizando campos importantes
                      processedDates.sort((a, b) => {
                        // Si tienen la misma prioridad, ordenar por fecha
                        if (a.priority === b.priority) {
                          return b.timestamp - a.timestamp;
                        }
                        // Sino, ordenar por prioridad (menor número = mayor prioridad)
                        return a.priority - b.priority;
                      });
                      
                      if (processedDates.length === 0) {
                        return <span style={{ color: '#dc2626', fontStyle: 'italic' }}>Sin datos</span>;
                      }
                      
                      const mostRecent = processedDates[0];
                      const now = new Date();
                      const diffHours = (now.getTime() - mostRecent.date.getTime()) / (1000 * 60 * 60);
                      
                      const dateString = mostRecent.date.toLocaleString('es-ES', {
                        year: '2-digit',
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      
                      // Mostrar fuente y estado
                      let sourceIndicator = '';
                      if (mostRecent.field === 'lastLoginAt' || mostRecent.field === 'lastLogin') {
                        sourceIndicator = '🔐'; // Login real
                      } else if (mostRecent.field === 'lastActivity') {
                        sourceIndicator = '⚡'; // Actividad
                      } else if (mostRecent.field === 'updatedAt') {
                        sourceIndicator = '📝'; // Actualización
                      } else {
                        sourceIndicator = '📅'; // Otro
                      }
                      
                      // Color según recencia
                      let color = '#374151'; // default
                      if (diffHours < 1) color = '#10b981'; // verde
                      else if (diffHours < 24) color = '#3b82f6'; // azul
                      else if (diffHours > 168) color = '#6b7280'; // gris
                      
                      return (
                        <div style={{ fontSize: '0.85rem' }}>
                          <span style={{ color, fontWeight: diffHours < 24 ? 'bold' : 'normal' }}>
                            {sourceIndicator} {dateString}
                          </span>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                            {mostRecent.field}
                            {diffHours < 1 && ' (online)'}
                            {diffHours >= 1 && diffHours < 24 && ' (hoy)'}
                            {diffHours >= 24 && diffHours < 168 && ` (${Math.floor(diffHours/24)}d)`}
                            {diffHours >= 168 && ` (${Math.floor(diffHours/168)}sem)`}
                          </div>
                        </div>
                      );
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

  const renderTeachersTab = () => {
    return (
      <div className="teachers-section">
        <TeacherManagementImproved />
      </div>
    );
  };

  const renderMessagesTab = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando mensajes...</p>
        </div>
      );
    }

    return (
      <div className="messages-section">
        <h2>📬 Mensajes de Contacto ({filteredMessages.length} de {messages.length})</h2>
        
        <div className="message-filters">
          <input
            type="text"
            placeholder="Buscar mensajes..."
            value={messageFilters.search}
            onChange={(e) => setMessageFilters({...messageFilters, search: e.target.value})}
            className="search-input"
          />
          
          <select
            value={messageFilters.status}
            onChange={(e) => setMessageFilters({...messageFilters, status: e.target.value})}
            className="status-filter"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="responded">Respondido</option>
            <option value="resolved">Resuelto</option>
          </select>
        </div>

        <div className="simple-table-container">
          <table className="simple-messages-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Nombre</th>
                <th style={{ width: '20%' }}>Email</th>
                <th style={{ width: '20%' }}>Asunto</th>
                <th style={{ width: '30%' }}>Mensaje</th>
                <th style={{ width: '10%' }}>Estado</th>
                <th style={{ width: '15%' }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((message) => (
                <tr key={message.id}>
                  <td>{message.name}</td>
                  <td>{message.email}</td>
                  <td>{message.subject}</td>
                  <td>
                    <div className="message-preview">
                      {message.message.length > 100 
                        ? `${message.message.substring(0, 100)}...` 
                        : message.message}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${message.status || 'pending'}`}>
                      {message.status === 'responded' ? 'Respondido' : 
                       message.status === 'resolved' ? 'Resuelto' : 'Pendiente'}
                    </span>
                  </td>
                  <td>
                    {message.timestamp ? 
                      new Date(message.timestamp.seconds * 1000).toLocaleDateString() : 
                      'No disponible'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredMessages.length === 0 && messages.length > 0 && (
            <div className="no-messages">
              <p>No se encontraron mensajes con los filtros aplicados</p>
            </div>
          )}
          
          {messages.length === 0 && (
            <div className="no-messages">
              <p>No se encontraron mensajes</p>
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
            <button 
              className={`tab-button ${activeTab === 'profesores' ? 'active' : ''}`}
              onClick={() => setActiveTab('profesores')}
            >
              👩‍🏫 Profesores
            </button>
            <button 
              className={`tab-button ${activeTab === 'mensajes' ? 'active' : ''}`}
              onClick={() => setActiveTab('mensajes')}
            >
              📬 Mensajes
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'usuarios' && renderUsersTab()}
            {activeTab === 'profesores' && renderTeachersTab()}
            {activeTab === 'mensajes' && renderMessagesTab()}
          </div>
        </div>
      </div>
    </>
  );
};

export default SuperAdminPage;