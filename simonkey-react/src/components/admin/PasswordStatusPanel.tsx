import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { EmailService } from '../../services/emailService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faKey, faEnvelope, faCheck, faTimes, faSync, 
  faExclamationTriangle, faUserGraduate, faPaperPlane 
} from '@fortawesome/free-solid-svg-icons';
import './PasswordStatusPanel.css';

interface StudentCredential {
  userId: string;
  email: string;
  studentName: string;
  temporaryPassword: string;
  emailSent: boolean;
  firstLogin: boolean;
  createdAt: Date;
  requiresPasswordChange: boolean;
}

interface PasswordStatusPanelProps {
  schoolId: string;
}

const PasswordStatusPanel: React.FC<PasswordStatusPanelProps> = ({ schoolId }) => {
  const [students, setStudents] = useState<StudentCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmails, setSendingEmails] = useState<Set<string>>(new Set());
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'logged'>('all');

  useEffect(() => {
    loadStudentCredentials();
  }, [schoolId]);

  const loadStudentCredentials = async () => {
    setLoading(true);
    try {
      // Obtener estudiantes de la escuela
      const studentsQuery = query(
        collection(db, 'users'),
        where('idInstitucion', '==', schoolId),
        where('schoolRole', '==', 'student')
      );
      
      const studentsSnap = await getDocs(studentsQuery);
      const studentsList: StudentCredential[] = [];
      
      for (const studentDoc of studentsSnap.docs) {
        const studentData = studentDoc.data();
        
        // Buscar credenciales temporales
        const credDoc = await getDocs(
          query(
            collection(db, 'temporaryCredentials'),
            where('userId', '==', studentDoc.id)
          )
        );
        
        if (!credDoc.empty) {
          const credData = credDoc.docs[0].data();
          studentsList.push({
            userId: studentDoc.id,
            email: studentData.email,
            studentName: studentData.displayName || studentData.nombre,
            temporaryPassword: credData.temporaryPassword,
            emailSent: credData.emailSent || false,
            firstLogin: credData.firstLogin || false,
            createdAt: credData.createdAt?.toDate() || new Date(),
            requiresPasswordChange: studentData.requiresPasswordChange || false
          });
        } else if (studentData.requiresPasswordChange) {
          // Estudiante que necesita cambiar contraseña pero no tiene credenciales temporales
          studentsList.push({
            userId: studentDoc.id,
            email: studentData.email,
            studentName: studentData.displayName || studentData.nombre,
            temporaryPassword: '',
            emailSent: false,
            firstLogin: false,
            createdAt: studentData.createdAt?.toDate() || new Date(),
            requiresPasswordChange: true
          });
        }
      }
      
      setStudents(studentsList);
    } catch (error) {
      console.error('Error cargando credenciales:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendCredentialEmail = async (student: StudentCredential) => {
    setSendingEmails(prev => new Set(prev).add(student.userId));
    
    try {
      const success = await EmailService.sendStudentCredentials({
        to: student.email,
        studentName: student.studentName,
        email: student.email,
        password: student.temporaryPassword,
        schoolName: 'Tu Escuela', // TODO: Obtener nombre real de la escuela
        loginUrl: window.location.origin + '/login'
      });
      
      if (success) {
        // Actualizar estado en Firebase
        await updateDoc(doc(db, 'temporaryCredentials', student.userId), {
          emailSent: true,
          emailSentAt: new Date()
        });
        
        // Actualizar estado local
        setStudents(prev => prev.map(s => 
          s.userId === student.userId 
            ? { ...s, emailSent: true }
            : s
        ));
        
        alert('Email enviado exitosamente');
      } else {
        alert('Error al enviar el email');
      }
    } catch (error) {
      console.error('Error enviando email:', error);
      alert('Error al enviar el email');
    } finally {
      setSendingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(student.userId);
        return newSet;
      });
    }
  };

  const sendBulkEmails = async () => {
    const studentsToSend = students.filter(s => 
      selectedStudents.has(s.userId) && !s.emailSent && s.temporaryPassword
    );
    
    if (studentsToSend.length === 0) {
      alert('No hay estudiantes seleccionados para enviar');
      return;
    }
    
    if (!confirm(`¿Enviar credenciales a ${studentsToSend.length} estudiantes?`)) {
      return;
    }
    
    const credentials = studentsToSend.map(s => ({
      to: s.email,
      studentName: s.studentName,
      email: s.email,
      password: s.temporaryPassword,
      schoolName: 'Tu Escuela'
    }));
    
    const result = await EmailService.sendBulkCredentials(credentials);
    
    alert(`Enviados: ${result.sent.length}, Fallidos: ${result.failed.length}`);
    
    // Recargar datos
    await loadStudentCredentials();
  };

  const filteredStudents = students.filter(student => {
    switch (filter) {
      case 'pending':
        return !student.emailSent && student.temporaryPassword;
      case 'sent':
        return student.emailSent && !student.firstLogin;
      case 'logged':
        return student.firstLogin;
      default:
        return true;
    }
  });

  const getStatusIcon = (student: StudentCredential) => {
    if (student.firstLogin) {
      return <FontAwesomeIcon icon={faCheck} className="status-icon success" title="Ha iniciado sesión" />;
    }
    if (student.emailSent) {
      return <FontAwesomeIcon icon={faEnvelope} className="status-icon sent" title="Email enviado" />;
    }
    if (student.temporaryPassword) {
      return <FontAwesomeIcon icon={faExclamationTriangle} className="status-icon warning" title="Pendiente de envío" />;
    }
    return <FontAwesomeIcon icon={faTimes} className="status-icon error" title="Sin contraseña temporal" />;
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
          <FontAwesomeIcon icon={faKey} /> Estado de Contraseñas de Estudiantes
        </h3>
        <div className="panel-stats">
          <span className="stat">
            <FontAwesomeIcon icon={faUserGraduate} />
            {students.length} estudiantes
          </span>
          <span className="stat warning">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            {students.filter(s => !s.emailSent && s.temporaryPassword).length} pendientes
          </span>
          <span className="stat success">
            <FontAwesomeIcon icon={faCheck} />
            {students.filter(s => s.firstLogin).length} activos
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
        
        {selectedStudents.size > 0 && (
          <button className="bulk-send-btn" onClick={sendBulkEmails}>
            <FontAwesomeIcon icon={faPaperPlane} />
            Enviar a {selectedStudents.size} seleccionados
          </button>
        )}
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
                      setSelectedStudents(new Set(filteredStudents.map(s => s.userId)));
                    } else {
                      setSelectedStudents(new Set());
                    }
                  }}
                />
              </th>
              <th>Estado</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Contraseña Temporal</th>
              <th>Fecha Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map(student => (
              <tr key={student.userId} className={student.firstLogin ? 'logged-in' : ''}>
                <td>
                  <input 
                    type="checkbox"
                    checked={selectedStudents.has(student.userId)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedStudents);
                      if (e.target.checked) {
                        newSelected.add(student.userId);
                      } else {
                        newSelected.delete(student.userId);
                      }
                      setSelectedStudents(newSelected);
                    }}
                    disabled={student.emailSent || !student.temporaryPassword}
                  />
                </td>
                <td>{getStatusIcon(student)}</td>
                <td>{student.studentName}</td>
                <td>{student.email}</td>
                <td>
                  {student.temporaryPassword ? (
                    <span className="password-display">
                      {student.temporaryPassword.substring(0, 3)}****
                    </span>
                  ) : (
                    <span className="no-password">N/A</span>
                  )}
                </td>
                <td>{student.createdAt.toLocaleDateString('es-MX')}</td>
                <td>
                  {!student.emailSent && student.temporaryPassword && (
                    <button 
                      className="send-email-btn"
                      onClick={() => sendCredentialEmail(student)}
                      disabled={sendingEmails.has(student.userId)}
                    >
                      {sendingEmails.has(student.userId) ? (
                        <FontAwesomeIcon icon={faSync} spin />
                      ) : (
                        <FontAwesomeIcon icon={faPaperPlane} />
                      )}
                      Enviar
                    </button>
                  )}
                  {student.emailSent && !student.firstLogin && (
                    <span className="status-text">Email enviado</span>
                  )}
                  {student.firstLogin && (
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