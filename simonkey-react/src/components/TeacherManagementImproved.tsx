import React, { useState, useEffect } from 'react';
import { teacherService } from '../services/teacherService';
import { collection, getDocs, query, where, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import '../styles/TeacherManagementImproved.css';

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
  verifiedTeacher?: boolean;
}

interface TeacherDetails {
  teacher: ActiveTeacher | TeacherRequest;
  type: 'pending' | 'active';
}

const TeacherManagementImproved: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<TeacherRequest[]>([]);
  const [activeTeachers, setActiveTeachers] = useState<ActiveTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending');
  
  // Modal states
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showEditLimitsModal, setShowEditLimitsModal] = useState(false);
  
  // Form states
  const [customLimits, setCustomLimits] = useState({ maxStudents: 30, maxMaterias: 5 });
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState<string>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Statistics
  const [stats, setStats] = useState({
    totalPending: 0,
    totalActive: 0,
    totalStudents: 0,
    totalMaterias: 0,
    lastWeekRequests: 0,
    approvalRate: 0
  });

  useEffect(() => {
    loadTeacherData();
    calculateStatistics();
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
            displayName: userData.displayName || userData.nombre || userData.username || 'Sin nombre',
            requestedAt: userData.teacherRequestedAt
          };
        })
      );
      
      setPendingRequests(enrichedPending);

      // Cargar profesores activos
      const active = await teacherService.getActiveTeachers();
      
      // Enriquecer con datos del usuario y estadísticas
      const enrichedActive = await Promise.all(
        active.map(async (teacher) => {
          const userDoc = await getDoc(doc(db, 'users', teacher.userId));
          const userData = userDoc.exists() ? userDoc.data() : {};
          
          // Contar estudiantes actuales
          const enrollmentsQuery = query(
            collection(db, 'enrollments'),
            where('teacherId', '==', teacher.userId),
            where('status', '==', 'active')
          );
          const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
          
          // Contar materias actuales
          const materiasQuery = query(
            collection(db, 'materias'),
            where('userId', '==', teacher.userId)
          );
          const materiasSnapshot = await getDocs(materiasQuery);
          
          return {
            ...teacher,
            email: userData.email,
            displayName: userData.displayName || userData.nombre || userData.username || 'Sin nombre',
            currentStudents: enrollmentsSnapshot.size,
            currentMaterias: materiasSnapshot.size
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

  const calculateStatistics = async () => {
    try {
      // Calcular estadísticas de la última semana
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const recentRequests = pendingRequests.filter(req => {
        if (!req.requestedAt) return false;
        const requestDate = req.requestedAt.toDate ? req.requestedAt.toDate() : new Date(req.requestedAt);
        return requestDate > oneWeekAgo;
      });
      
      const totalStudents = activeTeachers.reduce((sum, teacher) => sum + (teacher.currentStudents || 0), 0);
      const totalMaterias = activeTeachers.reduce((sum, teacher) => sum + (teacher.currentMaterias || 0), 0);
      
      setStats({
        totalPending: pendingRequests.length,
        totalActive: activeTeachers.length,
        totalStudents,
        totalMaterias,
        lastWeekRequests: recentRequests.length,
        approvalRate: activeTeachers.length > 0 ? 
          Math.round((activeTeachers.length / (activeTeachers.length + pendingRequests.length)) * 100) : 0
      });
    } catch (error) {
      console.error('Error calculando estadísticas:', error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return format(date, 'dd MMM yyyy HH:mm', { locale: es });
  };

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInDays > 30) return `Hace ${Math.floor(diffInDays / 30)} meses`;
    if (diffInDays > 0) return `Hace ${diffInDays} días`;
    if (diffInHours > 0) return `Hace ${diffInHours} horas`;
    return 'Hace menos de 1 hora';
  };

  const handleApprove = async () => {
    if (!selectedTeacher || selectedTeacher.type !== 'pending') return;
    
    try {
      const currentUserId = auth.currentUser?.uid || 'superadmin';
      await teacherService.approveTeacherRequest(
        selectedTeacher.teacher.userId,
        currentUserId,
        customLimits
      );
      
      setShowApprovalModal(false);
      setSelectedTeacher(null);
      await loadTeacherData();
      await calculateStatistics();
    } catch (error) {
      console.error('Error aprobando profesor:', error);
    }
  };

  const handleReject = async () => {
    if (!selectedTeacher || selectedTeacher.type !== 'pending') return;
    
    try {
      await teacherService.rejectTeacherRequest(
        selectedTeacher.teacher.userId, 
        rejectionReason
      );
      
      setShowDetailsModal(false);
      setSelectedTeacher(null);
      setRejectionReason('');
      await loadTeacherData();
      await calculateStatistics();
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
    }
  };

  const handleUpdateLimits = async () => {
    if (!selectedTeacher || selectedTeacher.type !== 'active') return;
    
    try {
      await teacherService.updateTeacherLimits(selectedTeacher.teacher.userId, customLimits);
      setShowEditLimitsModal(false);
      setSelectedTeacher(null);
      await loadTeacherData();
    } catch (error) {
      console.error('Error actualizando límites:', error);
    }
  };

  // Filtrar y buscar
  const filterTeachers = (teachers: any[], isPending: boolean) => {
    return teachers.filter(teacher => {
      const matchesSearch = searchTerm === '' || 
        teacher.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.institution?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesInstitution = institutionFilter === 'all' || 
        (institutionFilter === 'none' && !teacher.institution) ||
        teacher.institution === institutionFilter;
      
      return matchesSearch && matchesInstitution;
    });
  };

  const filteredPending = filterTeachers(pendingRequests, true);
  const filteredActive = filterTeachers(activeTeachers, false);
  
  // Paginación
  const getCurrentPageData = (data: any[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const totalPages = activeTab === 'pending' 
    ? Math.ceil(filteredPending.length / itemsPerPage)
    : Math.ceil(filteredActive.length / itemsPerPage);

  // Obtener instituciones únicas para el filtro
  const institutions = [...new Set([
    ...pendingRequests.map(r => r.institution).filter(Boolean),
    ...activeTeachers.map(t => t.institution).filter(Boolean)
  ])];

  if (loading) {
    return (
      <div className="teacher-management-loading">
        <div className="spinner"></div>
        <p>Cargando datos de profesores...</p>
      </div>
    );
  }

  return (
    <div className="teacher-management-improved">
      {/* Header con estadísticas */}
      <div className="tm-header">
        <h2>
          <i className="fas fa-chalkboard-teacher"></i>
          Gestión de Profesores
        </h2>
        
        <div className="tm-stats-grid">
          <div className="tm-stat-card primary">
            <div className="stat-icon">
              <i className="fas fa-clock"></i>
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalPending}</span>
              <span className="stat-label">Solicitudes Pendientes</span>
            </div>
          </div>
          
          <div className="tm-stat-card success">
            <div className="stat-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalActive}</span>
              <span className="stat-label">Profesores Activos</span>
            </div>
          </div>
          
          <div className="tm-stat-card info">
            <div className="stat-icon">
              <i className="fas fa-users"></i>
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalStudents}</span>
              <span className="stat-label">Total Estudiantes</span>
            </div>
          </div>
          
          <div className="tm-stat-card warning">
            <div className="stat-icon">
              <i className="fas fa-percentage"></i>
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.approvalRate}%</span>
              <span className="stat-label">Tasa de Aprobación</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controles de búsqueda y filtros */}
      <div className="tm-controls">
        <div className="tm-search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Buscar por nombre, email o institución..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select 
          className="tm-filter"
          value={institutionFilter}
          onChange={(e) => setInstitutionFilter(e.target.value)}
        >
          <option value="all">Todas las instituciones</option>
          <option value="none">Sin institución</option>
          {institutions.map(inst => (
            <option key={inst} value={inst}>{inst}</option>
          ))}
        </select>
        
        <select 
          className="tm-filter"
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
        >
          <option value={5}>5 por página</option>
          <option value={10}>10 por página</option>
          <option value={25}>25 por página</option>
          <option value={50}>50 por página</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="tm-tabs">
        <button
          className={`tm-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('pending');
            setCurrentPage(1);
          }}
        >
          <i className="fas fa-clock"></i>
          Solicitudes Pendientes ({filteredPending.length})
        </button>
        <button
          className={`tm-tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('active');
            setCurrentPage(1);
          }}
        >
          <i className="fas fa-check-circle"></i>
          Profesores Activos ({filteredActive.length})
        </button>
      </div>

      {/* Contenido principal */}
      <div className="tm-content">
        {activeTab === 'pending' ? (
          // Vista de solicitudes pendientes
          filteredPending.length === 0 ? (
            <div className="tm-empty-state">
              <i className="fas fa-inbox"></i>
              <h3>No hay solicitudes pendientes</h3>
              <p>No se encontraron solicitudes que coincidan con los filtros aplicados</p>
            </div>
          ) : (
            <div className="tm-grid">
              {getCurrentPageData(filteredPending).map((request) => (
                <div key={request.id} className="tm-card pending">
                  <div className="tm-card-header">
                    <div className="tm-avatar">
                      {request.displayName[0].toUpperCase()}
                    </div>
                    <div className="tm-user-info">
                      <h4>{request.displayName}</h4>
                      <p>{request.email}</p>
                    </div>
                    <span className="tm-badge pending">Pendiente</span>
                  </div>
                  
                  <div className="tm-card-body">
                    {request.institution && (
                      <div className="tm-info-row">
                        <i className="fas fa-university"></i>
                        <span>{request.institution}</span>
                      </div>
                    )}
                    {request.bio && (
                      <div className="tm-info-row">
                        <i className="fas fa-info-circle"></i>
                        <span className="tm-bio">{request.bio}</span>
                      </div>
                    )}
                    <div className="tm-info-row">
                      <i className="fas fa-calendar"></i>
                      <span>Solicitado {formatRelativeTime(request.requestedAt)}</span>
                    </div>
                  </div>
                  
                  <div className="tm-card-actions">
                    <button
                      className="tm-btn primary"
                      onClick={() => {
                        setSelectedTeacher({ teacher: request, type: 'pending' });
                        setShowDetailsModal(true);
                      }}
                    >
                      <i className="fas fa-eye"></i> Ver Detalles
                    </button>
                    <button
                      className="tm-btn success"
                      onClick={() => {
                        setSelectedTeacher({ teacher: request, type: 'pending' });
                        setCustomLimits({ maxStudents: 30, maxMaterias: 5 });
                        setShowApprovalModal(true);
                      }}
                    >
                      <i className="fas fa-check"></i> Aprobar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Vista de profesores activos
          filteredActive.length === 0 ? (
            <div className="tm-empty-state">
              <i className="fas fa-users"></i>
              <h3>No hay profesores activos</h3>
              <p>No se encontraron profesores que coincidan con los filtros aplicados</p>
            </div>
          ) : (
            <div className="tm-table-container">
              <table className="tm-table">
                <thead>
                  <tr>
                    <th>Profesor</th>
                    <th>Email</th>
                    <th>Institución</th>
                    <th>Estudiantes</th>
                    <th>Materias</th>
                    <th>Aprobado</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {getCurrentPageData(filteredActive).map((teacher) => (
                    <tr key={teacher.id}>
                      <td>
                        <div className="tm-user-cell">
                          <div className="tm-avatar small">
                            {teacher.displayName[0].toUpperCase()}
                          </div>
                          <span>{teacher.displayName}</span>
                        </div>
                      </td>
                      <td>{teacher.email}</td>
                      <td>{teacher.institution || '-'}</td>
                      <td>
                        <div className="tm-progress-cell">
                          <span className="tm-progress-text">
                            {teacher.currentStudents || 0}/{teacher.maxStudents || 30}
                          </span>
                          <div className="tm-progress-bar">
                            <div 
                              className="tm-progress-fill"
                              style={{
                                width: `${((teacher.currentStudents || 0) / (teacher.maxStudents || 30)) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="tm-progress-cell">
                          <span className="tm-progress-text">
                            {teacher.currentMaterias || 0}/{teacher.maxMaterias || 5}
                          </span>
                          <div className="tm-progress-bar">
                            <div 
                              className="tm-progress-fill"
                              style={{
                                width: `${((teacher.currentMaterias || 0) / (teacher.maxMaterias || 5)) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>{formatDate(teacher.approvedAt)}</td>
                      <td>
                        <span className="tm-badge success">
                          {teacher.verifiedTeacher ? 'Verificado' : 'Activo'}
                        </span>
                      </td>
                      <td>
                        <div className="tm-action-buttons">
                          <button
                            className="tm-icon-btn"
                            title="Ver detalles"
                            onClick={() => {
                              setSelectedTeacher({ teacher, type: 'active' });
                              setShowDetailsModal(true);
                            }}
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button
                            className="tm-icon-btn"
                            title="Editar límites"
                            onClick={() => {
                              setSelectedTeacher({ teacher, type: 'active' });
                              setCustomLimits({
                                maxStudents: teacher.maxStudents || 30,
                                maxMaterias: teacher.maxMaterias || 5
                              });
                              setShowEditLimitsModal(true);
                            }}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        
        {/* Paginación */}
        {totalPages > 1 && (
          <div className="tm-pagination">
            <button
              className="tm-page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <i className="fas fa-angle-double-left"></i>
            </button>
            <button
              className="tm-page-btn"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <i className="fas fa-angle-left"></i>
            </button>
            
            <span className="tm-page-info">
              Página {currentPage} de {totalPages}
            </span>
            
            <button
              className="tm-page-btn"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <i className="fas fa-angle-right"></i>
            </button>
            <button
              className="tm-page-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <i className="fas fa-angle-double-right"></i>
            </button>
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      {showDetailsModal && selectedTeacher && (
        <div className="tm-modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tm-modal-header">
              <h3>Detalles del {selectedTeacher.type === 'pending' ? 'Solicitante' : 'Profesor'}</h3>
              <button 
                className="tm-modal-close"
                onClick={() => setShowDetailsModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="tm-modal-body">
              <div className="tm-detail-section">
                <div className="tm-detail-header">
                  <div className="tm-avatar large">
                    {selectedTeacher.teacher.displayName![0].toUpperCase()}
                  </div>
                  <div>
                    <h4>{selectedTeacher.teacher.displayName}</h4>
                    <p>{selectedTeacher.teacher.email}</p>
                  </div>
                </div>
                
                <div className="tm-detail-grid">
                  {selectedTeacher.teacher.institution && (
                    <div className="tm-detail-item">
                      <label>Institución:</label>
                      <span>{selectedTeacher.teacher.institution}</span>
                    </div>
                  )}
                  
                  {selectedTeacher.teacher.bio && (
                    <div className="tm-detail-item full-width">
                      <label>Biografía:</label>
                      <span>{selectedTeacher.teacher.bio}</span>
                    </div>
                  )}
                  
                  {selectedTeacher.type === 'pending' && (
                    <div className="tm-detail-item">
                      <label>Fecha de solicitud:</label>
                      <span>{formatDate((selectedTeacher.teacher as TeacherRequest).requestedAt)}</span>
                    </div>
                  )}
                  
                  {selectedTeacher.type === 'active' && (
                    <>
                      <div className="tm-detail-item">
                        <label>Fecha de aprobación:</label>
                        <span>{formatDate((selectedTeacher.teacher as ActiveTeacher).approvedAt)}</span>
                      </div>
                      <div className="tm-detail-item">
                        <label>Estudiantes:</label>
                        <span>
                          {(selectedTeacher.teacher as ActiveTeacher).currentStudents || 0} / 
                          {(selectedTeacher.teacher as ActiveTeacher).maxStudents || 30}
                        </span>
                      </div>
                      <div className="tm-detail-item">
                        <label>Materias:</label>
                        <span>
                          {(selectedTeacher.teacher as ActiveTeacher).currentMaterias || 0} / 
                          {(selectedTeacher.teacher as ActiveTeacher).maxMaterias || 5}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {selectedTeacher.type === 'pending' && (
                <div className="tm-rejection-section">
                  <label>Razón de rechazo (opcional):</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ingrese una razón para el rechazo..."
                    rows={3}
                  />
                </div>
              )}
            </div>
            
            <div className="tm-modal-footer">
              <button 
                className="tm-btn secondary"
                onClick={() => setShowDetailsModal(false)}
              >
                Cerrar
              </button>
              {selectedTeacher.type === 'pending' && (
                <button 
                  className="tm-btn danger"
                  onClick={handleReject}
                >
                  <i className="fas fa-times"></i> Rechazar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de aprobación */}
      {showApprovalModal && selectedTeacher && (
        <div className="tm-modal-overlay" onClick={() => setShowApprovalModal(false)}>
          <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tm-modal-header">
              <h3>Aprobar Solicitud de Profesor</h3>
              <button 
                className="tm-modal-close"
                onClick={() => setShowApprovalModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="tm-modal-body">
              <div className="tm-form-section">
                <h4>Configurar límites para: {selectedTeacher.teacher.displayName}</h4>
                
                <div className="tm-form-grid">
                  <div className="tm-form-group">
                    <label>Máximo de estudiantes:</label>
                    <input
                      type="number"
                      min="1"
                      value={customLimits.maxStudents}
                      onChange={(e) => setCustomLimits({
                        ...customLimits,
                        maxStudents: parseInt(e.target.value) || 30
                      })}
                    />
                    <small>Número máximo de estudiantes que puede tener</small>
                  </div>
                  
                  <div className="tm-form-group">
                    <label>Máximo de materias:</label>
                    <input
                      type="number"
                      min="1"
                      value={customLimits.maxMaterias}
                      onChange={(e) => setCustomLimits({
                        ...customLimits,
                        maxMaterias: parseInt(e.target.value) || 5
                      })}
                    />
                    <small>Número máximo de materias que puede crear</small>
                  </div>
                </div>
                
                <div className="tm-alert info">
                  <i className="fas fa-info-circle"></i>
                  <p>
                    Estos límites pueden ser modificados posteriormente. 
                    Los valores por defecto son 30 estudiantes y 5 materias.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="tm-modal-footer">
              <button 
                className="tm-btn secondary"
                onClick={() => setShowApprovalModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="tm-btn success"
                onClick={handleApprove}
              >
                <i className="fas fa-check"></i> Aprobar Profesor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición de límites */}
      {showEditLimitsModal && selectedTeacher && (
        <div className="tm-modal-overlay" onClick={() => setShowEditLimitsModal(false)}>
          <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tm-modal-header">
              <h3>Editar Límites</h3>
              <button 
                className="tm-modal-close"
                onClick={() => setShowEditLimitsModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="tm-modal-body">
              <div className="tm-form-section">
                <h4>Editando límites para: {selectedTeacher.teacher.displayName}</h4>
                
                <div className="tm-form-grid">
                  <div className="tm-form-group">
                    <label>Máximo de estudiantes:</label>
                    <input
                      type="number"
                      min="1"
                      value={customLimits.maxStudents}
                      onChange={(e) => setCustomLimits({
                        ...customLimits,
                        maxStudents: parseInt(e.target.value) || 30
                      })}
                    />
                    <small>
                      Actualmente: {(selectedTeacher.teacher as ActiveTeacher).currentStudents || 0} estudiantes
                    </small>
                  </div>
                  
                  <div className="tm-form-group">
                    <label>Máximo de materias:</label>
                    <input
                      type="number"
                      min="1"
                      value={customLimits.maxMaterias}
                      onChange={(e) => setCustomLimits({
                        ...customLimits,
                        maxMaterias: parseInt(e.target.value) || 5
                      })}
                    />
                    <small>
                      Actualmente: {(selectedTeacher.teacher as ActiveTeacher).currentMaterias || 0} materias
                    </small>
                  </div>
                </div>
                
                {((selectedTeacher.teacher as ActiveTeacher).currentStudents! > customLimits.maxStudents ||
                  (selectedTeacher.teacher as ActiveTeacher).currentMaterias! > customLimits.maxMaterias) && (
                  <div className="tm-alert warning">
                    <i className="fas fa-exclamation-triangle"></i>
                    <p>
                      Advertencia: Los nuevos límites son menores que los valores actuales. 
                      El profesor no podrá agregar más estudiantes/materias hasta estar por debajo del límite.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="tm-modal-footer">
              <button 
                className="tm-btn secondary"
                onClick={() => setShowEditLimitsModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="tm-btn primary"
                onClick={handleUpdateLimits}
              >
                <i className="fas fa-save"></i> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherManagementImproved;