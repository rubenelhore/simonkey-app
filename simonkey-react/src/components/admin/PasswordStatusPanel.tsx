import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { EmailService } from '../../services/emailService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faKey, faEnvelope, faCheck, faTimes, faSync, 
  faExclamationTriangle, faUserGraduate, faPaperPlane,
  faChalkboardTeacher, faUserTie, faUsers
} from '@fortawesome/free-solid-svg-icons';
import './PasswordStatusPanel.css';

interface UserCredential {
  userId: string;
  email: string;
  userName: string;
  userRole: 'student' | 'teacher' | 'tutor';
  temporaryPassword: string;
  emailSent: boolean;
  firstLogin: boolean;
  createdAt: Date;
}

interface PasswordStatusPanelProps {
  schoolId: string;
}

const PasswordStatusPanel: React.FC<PasswordStatusPanelProps> = ({ schoolId }) => {
  const [users, setUsers] = useState<UserCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmails, setSendingEmails] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'logged'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'tutor'>('all');

  useEffect(() => {
    loadUserCredentials();
  }, [schoolId]);

  const loadUserCredentials = async () => {
    setLoading(true);
    try {
      console.log('🔍 Cargando usuarios de la escuela:', schoolId);
      const usersList: UserCredential[] = [];
      
      // 1. Obtener estudiantes de la escuela
      const studentsQuery = query(
        collection(db, 'users'),
        where('idInstitucion', '==', schoolId),
        where('schoolRole', '==', 'student')
      );
      
      const studentsSnap = await getDocs(studentsQuery);
      console.log(`👥 Estudiantes encontrados: ${studentsSnap.size}`);
      
      for (const userDoc of studentsSnap.docs) {
        const userData = userDoc.data();
        usersList.push({
          userId: userDoc.id,
          email: userData.email,
          userName: userData.displayName || userData.nombre || 'Sin nombre',
          userRole: 'student',
          temporaryPassword: '',
          emailSent: false,
          firstLogin: userData.lastLogin ? true : false,
          createdAt: userData.createdAt?.toDate() || new Date()
        });
      }
      
      // 2. Obtener el admin de la escuela para buscar profesores
      const adminQuery = query(
        collection(db, 'users'),
        where('idInstitucion', '==', schoolId),
        where('schoolRole', '==', 'admin')
      );
      
      const adminSnap = await getDocs(adminQuery);
      
      if (!adminSnap.empty) {
        const adminId = adminSnap.docs[0].id;
        console.log(`👨‍💼 Admin encontrado: ${adminId}`);
        
        // 3. Obtener profesores (tienen idAdmin)
        const teachersQuery = query(
          collection(db, 'users'),
          where('idAdmin', '==', adminId),
          where('schoolRole', '==', 'teacher')
        );
        
        const teachersSnap = await getDocs(teachersQuery);
        console.log(`👨‍🏫 Profesores encontrados: ${teachersSnap.size}`);
        
        for (const teacherDoc of teachersSnap.docs) {
          const teacherData = teacherDoc.data();
          usersList.push({
            userId: teacherDoc.id,
            email: teacherData.email,
            userName: teacherData.displayName || teacherData.nombre || 'Sin nombre',
            userRole: 'teacher',
            temporaryPassword: '',
            emailSent: false,
            firstLogin: teacherData.lastLogin ? true : false,
            createdAt: teacherData.createdAt?.toDate() || new Date()
          });
        }
      }
      
      // 4. Obtener tutores (tienen idAlumnos array)
      const tutorsQuery = query(
        collection(db, 'users'),
        where('schoolRole', '==', 'tutor')
      );
      
      const tutorsSnap = await getDocs(tutorsQuery);
      const studentIds = new Set(studentsSnap.docs.map(doc => doc.id));
      let tutorCount = 0;
      
      for (const tutorDoc of tutorsSnap.docs) {
        const tutorData = tutorDoc.data();
        
        // Verificar si el tutor tiene alumnos de esta escuela
        if (tutorData.idAlumnos && Array.isArray(tutorData.idAlumnos)) {
          const belongsToSchool = tutorData.idAlumnos.some(studentId => 
            studentIds.has(studentId)
          );
          
          if (belongsToSchool) {
            tutorCount++;
            usersList.push({
              userId: tutorDoc.id,
              email: tutorData.email,
              userName: tutorData.displayName || tutorData.nombre || 'Sin nombre',
              userRole: 'tutor',
              temporaryPassword: '',
              emailSent: false,
              firstLogin: tutorData.lastLogin ? true : false,
              createdAt: tutorData.createdAt?.toDate() || new Date()
            });
          }
        }
      }
      
      console.log(`👨‍👩‍👧‍👦 Tutores encontrados: ${tutorCount}`);
      console.log(`✅ Total usuarios: ${usersList.length}`);
      
      setUsers(usersList);
    } catch (error) {
      console.error('Error cargando credenciales:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (user: UserCredential) => {
    setSendingEmails(prev => new Set(prev).add(user.userId));
    
    try {
      console.log('📧 Enviando email de reseteo de contraseña a:', user.email);
      await sendPasswordResetEmail(auth, user.email);
      
      // Guardar en colección passwordResets
      await setDoc(doc(db, 'passwordResets', user.userId), {
        userId: user.userId,
        email: user.email,
        sent: true,
        sentAt: new Date(),
        schoolId: schoolId
      });
      
      // Actualizar estado en Firebase
      await updateDoc(doc(db, 'temporaryCredentials', user.userId), {
        emailSent: true,
        emailSentAt: new Date()
      });
      
      // Actualizar estado local
      setUsers(prev => prev.map(u => 
        u.userId === user.userId 
          ? { ...u, emailSent: true }
          : u
      ));
      
      alert('✅ Email de reseteo de contraseña enviado exitosamente');
    } catch (error: any) {
      console.error('Error enviando email de reseteo:', error);
      if (error.code === 'auth/user-not-found') {
        alert('⚠️ Este usuario no existe en Firebase Auth. Puede que necesite ser creado primero.');
      } else {
        alert('❌ Error al enviar el email de reseteo: ' + error.message);
      }
    } finally {
      setSendingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(user.userId);
        return newSet;
      });
    }
  };

  const sendBulkPasswordResets = async () => {
    const usersToSend = users.filter(u => 
      selectedUsers.has(u.userId) && !u.firstLogin
    );
    
    if (usersToSend.length === 0) {
      alert('No hay usuarios seleccionados para enviar');
      return;
    }
    
    if (!confirm(`¿Enviar email de reseteo a ${usersToSend.length} usuarios?`)) {
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of usersToSend) {
      try {
        await sendPasswordReset(user);
        successCount++;
        // Pequeña pausa entre emails para evitar límites
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error enviando a ${user.email}:`, error);
        errorCount++;
      }
    }
    
    alert(`✅ Enviados: ${successCount}\n❌ Errores: ${errorCount}`);
    
    // Recargar datos
    await loadUserCredentials();
  };

  const getFilteredUsers = () => {
    let filtered = users;
    
    // Filtro por estado
    switch (filter) {
      case 'pending':
        filtered = filtered.filter(u => !u.emailSent && !u.firstLogin);
        break;
      case 'sent':
        filtered = filtered.filter(u => u.emailSent && !u.firstLogin);
        break;
      case 'logged':
        filtered = filtered.filter(u => u.firstLogin);
        break;
    }
    
    // Filtro por rol
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.userRole === roleFilter);
    }
    
    return filtered;
  };
  
  const filteredUsers = getFilteredUsers();

  const getStatusIcon = (user: UserCredential) => {
    if (user.firstLogin) {
      return <FontAwesomeIcon icon={faCheck} className="status-icon success" title="Ha iniciado sesión" />;
    }
    if (user.emailSent) {
      return <FontAwesomeIcon icon={faEnvelope} className="status-icon sent" title="Email enviado" />;
    }
    return <FontAwesomeIcon icon={faExclamationTriangle} className="status-icon warning" title="Pendiente" />;
  };
  
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'student':
        return <FontAwesomeIcon icon={faUserGraduate} />;
      case 'teacher':
        return <FontAwesomeIcon icon={faChalkboardTeacher} />;
      case 'tutor':
        return <FontAwesomeIcon icon={faUserTie} />;
      default:
        return <FontAwesomeIcon icon={faUsers} />;
    }
  };
  
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'student':
        return 'Estudiante';
      case 'teacher':
        return 'Profesor';
      case 'tutor':
        return 'Tutor';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="password-status-panel">
        <div className="loading">
          <FontAwesomeIcon icon={faSync} spin /> Cargando...
        </div>
      </div>
    );
  }

  return (
    <div className="password-status-panel">
      <div className="panel-header">
        <h3>
          <FontAwesomeIcon icon={faKey} /> Estado de Contraseñas
        </h3>
        <div className="panel-stats">
          <span className="stat">
            <FontAwesomeIcon icon={faUsers} />
            {users.length} usuarios
          </span>
          <span className="stat warning">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            {users.filter(u => !u.firstLogin).length} pendientes
          </span>
          <span className="stat success">
            <FontAwesomeIcon icon={faCheck} />
            {users.filter(u => u.firstLogin).length} activos
          </span>
        </div>
      </div>

      <div className="panel-controls">
        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button 
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Pendientes
          </button>
          <button 
            className={filter === 'sent' ? 'active' : ''}
            onClick={() => setFilter('sent')}
          >
            Enviados
          </button>
          <button 
            className={filter === 'logged' ? 'active' : ''}
            onClick={() => setFilter('logged')}
          >
            Activos
          </button>
        </div>
        
        <div className="filter-group" style={{ marginTop: '10px' }}>
          <label>Rol:</label>
          <select 
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value as any)}
          >
            <option value="all">Todos</option>
            <option value="student">Estudiantes</option>
            <option value="teacher">Profesores</option>
            <option value="tutor">Tutores</option>
          </select>
        </div>
        
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="select-all-btn"
            onClick={() => {
              const eligibleUsers = filteredUsers.filter(u => !u.firstLogin);
              setSelectedUsers(new Set(eligibleUsers.map(u => u.userId)));
            }}
            style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Seleccionar Todos
          </button>
          
          {selectedUsers.size > 0 && (
            <>
              <button 
                className="clear-selection-btn"
                onClick={() => setSelectedUsers(new Set())}
                style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Limpiar Selección
              </button>
              
              <button 
                className="bulk-send-btn" 
                onClick={sendBulkPasswordResets}
                style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <FontAwesomeIcon icon={faKey} />
                {' '}Resetear contraseña de {selectedUsers.size} seleccionados
              </button>
            </>
          )}
        </div>
      </div>

      <div className="students-table">
        <table>
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsers(new Set(filteredUsers.map(u => u.userId)));
                    } else {
                      setSelectedUsers(new Set());
                    }
                  }}
                />
              </th>
              <th>Estado</th>
              <th>Rol</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Fecha Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.userId} className={user.firstLogin ? 'logged-in' : ''}>
                <td>
                  <input 
                    type="checkbox"
                    checked={selectedUsers.has(user.userId)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedUsers);
                      if (e.target.checked) {
                        newSelected.add(user.userId);
                      } else {
                        newSelected.delete(user.userId);
                      }
                      setSelectedUsers(newSelected);
                    }}
                    disabled={user.firstLogin}
                  />
                </td>
                <td>{getStatusIcon(user)}</td>
                <td>
                  <span className="role-badge">
                    {getRoleIcon(user.userRole)} {getRoleLabel(user.userRole)}
                  </span>
                </td>
                <td>{user.userName}</td>
                <td>{user.email}</td>
                <td>{user.createdAt.toLocaleDateString('es-MX')}</td>
                <td>
                  {!user.firstLogin && (
                    <button 
                      className="send-email-btn"
                      onClick={() => sendPasswordReset(user)}
                      disabled={sendingEmails.has(user.userId)}
                    >
                      {sendingEmails.has(user.userId) ? (
                        <FontAwesomeIcon icon={faSync} spin />
                      ) : (
                        <FontAwesomeIcon icon={faKey} />
                      )}
                      Resetear Contraseña
                    </button>
                  )}
                  {user.firstLogin && (
                    <span className="status-text success">Activo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PasswordStatusPanel;