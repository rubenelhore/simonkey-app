import React, { useState, useEffect } from 'react';
import { teacherService } from '../services/teacherService';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import '../styles/TeacherManagement.css';

interface TeacherRequest {
  id: string;
  userId: string;
  email?: string;
  displayName?: string;
  bio?: string;
  institution?: string;
  specialties?: string[];
  requestedAt?: any;
  isActive: boolean;
}

interface ActiveTeacher {
  id: string;
  userId: string;
  email?: string;
  displayName?: string;
  bio?: string;
  institution?: string;
  isActive: boolean;
  approvedAt?: any;
  maxStudents?: number;
  maxMaterias?: number;
  currentStudents?: number;
  currentMaterias?: number;
}

const TeacherManagement: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<TeacherRequest[]>([]);
  const [activeTeachers, setActiveTeachers] = useState<ActiveTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending');
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [customLimits, setCustomLimits] = useState({ maxStudents: 30, maxMaterias: 5 });

  useEffect(() => {
    loadTeacherData();
  }, []);

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      // Cargar solicitudes pendientes
      const pending = await teacherService.getPendingTeacherRequests();
      
      // Enriquecer con datos del usuario
      const enrichedPending = await Promise.all(
        pending.map(async (request) => {
          const userDoc = await getDoc(doc(db, 'users', request.userId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          return {
            ...request,
            email: userData.email,
            displayName: userData.displayName || userData.nombre || 'Sin nombre',
            requestedAt: userData.teacherRequestedAt
          };
        })
      );
      
      setPendingRequests(enrichedPending);

      // Cargar profesores activos
      const active = await teacherService.getActiveTeachers();
      
      // Enriquecer con datos del usuario
      const enrichedActive = await Promise.all(
        active.map(async (teacher) => {
          const userDoc = await getDoc(doc(db, 'users', teacher.userId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          return {
            ...teacher,
            email: userData.email,
            displayName: userData.displayName || userData.nombre || 'Sin nombre'
          };
        })
      );
      
      setActiveTeachers(enrichedActive);
    } catch (error) {
      console.error('Error cargando datos de profesores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (teacherId: string) => {
    try {
      const currentUserId = 'superadmin'; // En producción, obtener del usuario actual
      await teacherService.approveTeacherRequest(
        teacherId,
        currentUserId,
        customLimits
      );
      
      alert('✅ Profesor aprobado exitosamente');
      await loadTeacherData();
    } catch (error) {
      console.error('Error aprobando profesor:', error);
      alert('❌ Error al aprobar profesor');
    }
  };

  const handleReject = async (teacherId: string) => {
    const reason = prompt('Razón del rechazo (opcional):');
    try {
      await teacherService.rejectTeacherRequest(teacherId, reason || undefined);
      alert('❌ Solicitud rechazada');
      await loadTeacherData();
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      alert('❌ Error al rechazar solicitud');
    }
  };

  const handleUpdateLimits = async (teacherId: string, newLimits: any) => {
    try {
      await teacherService.updateTeacherLimits(teacherId, newLimits);
      alert('✅ Límites actualizados');
      await loadTeacherData();
    } catch (error) {
      console.error('Error actualizando límites:', error);
      alert('❌ Error al actualizar límites');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="teacher-management-loading">
        <i className="fas fa-spinner fa-spin"></i> Cargando datos de profesores...
      </div>
    );
  }

  return (
    <div className="teacher-management">
      <div className="teacher-management-header">
        <h2>
          <i className="fas fa-chalkboard-teacher"></i> Gestión de Profesores
        </h2>
        <div className="teacher-stats">
          <div className="stat-card">
            <span className="stat-value">{pendingRequests.length}</span>
            <span className="stat-label">Solicitudes Pendientes</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{activeTeachers.length}</span>
            <span className="stat-label">Profesores Activos</span>
          </div>
        </div>
      </div>

      <div className="teacher-tabs">
        <button
          className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <i className="fas fa-clock"></i> Solicitudes Pendientes ({pendingRequests.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <i className="fas fa-check-circle"></i> Profesores Activos ({activeTeachers.length})
        </button>
      </div>

      <div className="teacher-content">
        {activeTab === 'pending' && (
          <div className="pending-requests">
            {pendingRequests.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-inbox"></i>
                <p>No hay solicitudes pendientes</p>
              </div>
            ) : (
              <div className="requests-grid">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="request-card">
                    <div className="request-header">
                      <div className="user-info">
                        <i className="fas fa-user-circle"></i>
                        <div>
                          <h4>{request.displayName}</h4>
                          <p className="email">{request.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="request-details">
                      {request.institution && (
                        <div className="detail-item">
                          <i className="fas fa-university"></i>
                          <span>{request.institution}</span>
                        </div>
                      )}
                      {request.bio && (
                        <div className="detail-item">
                          <i className="fas fa-info-circle"></i>
                          <span>{request.bio}</span>
                        </div>
                      )}
                      {request.specialties && request.specialties.length > 0 && (
                        <div className="detail-item">
                          <i className="fas fa-tags"></i>
                          <span>{request.specialties.join(', ')}</span>
                        </div>
                      )}
                      <div className="detail-item">
                        <i className="fas fa-calendar"></i>
                        <span>Solicitado: {formatDate(request.requestedAt)}</span>
                      </div>
                    </div>

                    <div className="request-limits">
                      <h5>Límites iniciales:</h5>
                      <div className="limits-inputs">
                        <div className="limit-input">
                          <label>Max. Estudiantes:</label>
                          <input
                            type="number"
                            value={selectedTeacher === request.id ? customLimits.maxStudents : 30}
                            onChange={(e) => {
                              setSelectedTeacher(request.id);
                              setCustomLimits({
                                ...customLimits,
                                maxStudents: parseInt(e.target.value)
                              });
                            }}
                          />
                        </div>
                        <div className="limit-input">
                          <label>Max. Materias:</label>
                          <input
                            type="number"
                            value={selectedTeacher === request.id ? customLimits.maxMaterias : 5}
                            onChange={(e) => {
                              setSelectedTeacher(request.id);
                              setCustomLimits({
                                ...customLimits,
                                maxMaterias: parseInt(e.target.value)
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="request-actions">
                      <button
                        className="approve-btn"
                        onClick={() => handleApprove(request.userId)}
                      >
                        <i className="fas fa-check"></i> Aprobar
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => handleReject(request.userId)}
                      >
                        <i className="fas fa-times"></i> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'active' && (
          <div className="active-teachers">
            {activeTeachers.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-users"></i>
                <p>No hay profesores activos</p>
              </div>
            ) : (
              <div className="teachers-table">
                <table>
                  <thead>
                    <tr>
                      <th>Profesor</th>
                      <th>Email</th>
                      <th>Institución</th>
                      <th>Estudiantes</th>
                      <th>Materias</th>
                      <th>Aprobado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTeachers.map((teacher) => (
                      <tr key={teacher.id}>
                        <td>
                          <div className="teacher-name">
                            <i className="fas fa-user-graduate"></i>
                            {teacher.displayName}
                          </div>
                        </td>
                        <td>{teacher.email}</td>
                        <td>{teacher.institution || 'N/A'}</td>
                        <td>
                          <span className="usage-badge">
                            {teacher.currentStudents || 0}/{teacher.maxStudents || 30}
                          </span>
                        </td>
                        <td>
                          <span className="usage-badge">
                            {teacher.currentMaterias || 0}/{teacher.maxMaterias || 5}
                          </span>
                        </td>
                        <td>{formatDate(teacher.approvedAt)}</td>
                        <td>
                          <button
                            className="edit-limits-btn"
                            onClick={() => {
                              const currentMaxStudents = teacher.maxStudents || 30;
                              const currentMaxMaterias = teacher.maxMaterias || 5;
                              const newMaxStudents = prompt(
                                `Nuevo límite de estudiantes (actual: ${currentMaxStudents}):`,
                                currentMaxStudents.toString()
                              );
                              const newMaxMaterias = prompt(
                                `Nuevo límite de materias (actual: ${currentMaxMaterias}):`,
                                currentMaxMaterias.toString()
                              );
                              
                              if (newMaxStudents && newMaxMaterias) {
                                handleUpdateLimits(teacher.userId, {
                                  maxStudents: parseInt(newMaxStudents),
                                  maxMaterias: parseInt(newMaxMaterias)
                                });
                              }
                            }}
                          >
                            <i className="fas fa-edit"></i> Editar Límites
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherManagement;