import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import CreateExamModal from '../components/CreateExamModal';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import '../styles/TeacherExamsPage.css';

interface Exam {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  idMateria: string;
  idProfesor: string;
  createdAt: any;
  percentageQuestions: number;
  timePerConcept: number;
  questions?: any[];
  materiaName?: string;
  scheduledDate?: any;
  endDate?: any;
  status?: 'draft' | 'scheduled' | 'active' | 'finished';
}

interface Materia {
  id: string;
  nombre: string;
  color?: string;
}

const TeacherExamsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const { isSchoolTeacher } = useUserType();
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  // Obtener filtro inicial desde navegación o usar 'all' por defecto
  const initialFilter = (location.state as any)?.filter || 'all';
  const [filter, setFilter] = useState<'all' | 'draft' | 'scheduled' | 'active' | 'finished'>(initialFilter);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'materia'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [stats, setStats] = useState({
    totalStudents: 0,
    upcomingExams: 0,
    recentActivity: ''
  });

  useEffect(() => {
    if (!user || !isSchoolTeacher) {
      navigate('/school/teacher');
      return;
    }
    loadTeacherData();
  }, [user, isSchoolTeacher, userProfile]);

  // Efecto para actualizar el filtro cuando llega desde navegación
  useEffect(() => {
    const navigationFilter = (location.state as any)?.filter;
    if (navigationFilter && navigationFilter !== filter) {
      console.log('🔍 [TeacherExams] Aplicando filtro desde navegación:', navigationFilter);
      setFilter(navigationFilter);
    }
  }, [location.state]);

  const determineExamStatus = (exam: any): 'draft' | 'scheduled' | 'active' | 'finished' => {
    const now = new Date();
    
    // Si no está activo en el sistema, es borrador
    if (!exam.isActive) {
      return 'draft';
    }
    
    // Si tiene fecha de finalización y ya pasó, está finalizado
    if (exam.endDate) {
      const endDate = exam.endDate.toDate ? exam.endDate.toDate() : new Date(exam.endDate);
      if (now > endDate) {
        return 'finished';
      }
    }
    
    // Si tiene fecha programada y aún no llega, está programado
    if (exam.scheduledDate) {
      const scheduledDate = exam.scheduledDate.toDate ? exam.scheduledDate.toDate() : new Date(exam.scheduledDate);
      if (now < scheduledDate) {
        return 'scheduled';
      }
    }
    
    // Si está activo y no tiene restricciones de fecha, está activo
    return 'active';
  };

  const loadTeacherData = async () => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      console.log('📝 [TeacherExams] Cargando datos del profesor...');
      
      // Cargar materias del profesor
      const materiasQuery = query(
        collection(db, 'schoolSubjects'),
        where('idProfesor', '==', userProfile.id || user.uid)
      );
      const materiasSnap = await getDocs(materiasQuery);
      
      const materiasData: Materia[] = [];
      materiasSnap.forEach(doc => {
        const data = doc.data();
        materiasData.push({
          id: doc.id,
          nombre: data.nombre,
          color: data.color || '#6147FF'
        });
      });
      
      console.log('📚 [TeacherExams] Materias encontradas:', materiasData.length);
      setMaterias(materiasData);
      
      // Cargar exámenes del profesor
      const examsQuery = query(
        collection(db, 'schoolExams'),
        where('idProfesor', '==', userProfile.id || user.uid)
      );
      const examsSnap = await getDocs(examsQuery);
      
      const examsData: Exam[] = [];
      examsSnap.forEach(doc => {
        const data = doc.data();
        const materia = materiasData.find(m => m.id === data.idMateria);
        const status = determineExamStatus(data);
        
        examsData.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          isActive: data.isActive,
          idMateria: data.idMateria,
          idProfesor: data.idProfesor,
          createdAt: data.createdAt,
          percentageQuestions: data.percentageQuestions || 50,
          timePerConcept: data.timePerConcept || 60,
          questions: data.questions || [],
          materiaName: materia?.nombre || 'Materia no encontrada',
          scheduledDate: data.scheduledDate,
          endDate: data.endDate,
          status: status
        });
      });
      
      console.log('📝 [TeacherExams] Exámenes encontrados:', examsData.length);
      setExams(examsData);
      
      // Cargar estadísticas adicionales
      await loadStats(materiasData, examsData);
      
    } catch (error) {
      console.error('❌ [TeacherExams] Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (materiasData: Materia[], examsData: Exam[]) => {
    try {
      // Simular cálculo de estudiantes (en producción se haría una query real)
      const totalStudents = materiasData.length * 25; // Promedio estimado
      
      // Calcular exámenes activos y programados
      const activeExams = examsData.filter(exam => exam.status === 'active').length;
      const scheduledExams = examsData.filter(exam => exam.status === 'scheduled').length;
      const upcomingExams = activeExams + scheduledExams;
      
      // Actividad reciente
      let recentActivity = 'Sin actividad reciente';
      if (examsData.length > 0) {
        const lastExam = examsData.reduce((latest, exam) => {
          const examDate = exam.createdAt?.toDate?.() || new Date(exam.createdAt);
          const latestDate = latest.createdAt?.toDate?.() || new Date(latest.createdAt);
          return examDate > latestDate ? exam : latest;
        });
        
        const daysSinceLastExam = Math.floor((new Date().getTime() - (lastExam.createdAt?.toDate?.() || new Date(lastExam.createdAt)).getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastExam === 0) {
          recentActivity = 'Examen creado hoy';
        } else if (daysSinceLastExam === 1) {
          recentActivity = 'Examen creado ayer';
        } else if (daysSinceLastExam < 7) {
          recentActivity = `Último examen hace ${daysSinceLastExam} días`;
        } else {
          recentActivity = `Último examen hace más de una semana`;
        }
      }
      
      setStats({
        totalStudents,
        upcomingExams,
        recentActivity
      });
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCreateExam = () => {
    if (materias.length === 0) {
      alert('Necesitas tener materias asignadas para crear exámenes.');
      return;
    }
    setIsExamModalOpen(true);
  };

  const handleExamCreated = () => {
    setIsExamModalOpen(false);
    loadTeacherData(); // Recargar datos
  };

  const handleDeleteExam = async (examId: string, examTitle: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el examen "${examTitle}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'schoolExams', examId));
      console.log('🗑️ [TeacherExams] Examen eliminado:', examId);
      
      // Actualizar la lista local
      setExams(exams.filter(exam => exam.id !== examId));
      
      alert('Examen eliminado correctamente.');
    } catch (error) {
      console.error('❌ [TeacherExams] Error eliminando examen:', error);
      alert('Error al eliminar el examen. Inténtalo de nuevo.');
    }
  };

  const handleViewExam = (examId: string) => {
    navigate(`/exam/${examId}/dashboard`);
  };

  const handleDuplicateExam = (exam: Exam) => {
    // Crear una copia del examen con nuevo nombre
    const duplicatedExamData = {
      ...exam,
      title: `${exam.title} - Copia`,
      createdAt: new Date(),
      isActive: false // Los duplicados empiezan inactivos
    };
    
    // Aquí se abriría el modal de crear examen con los datos pre-llenados
    console.log('Duplicating exam:', duplicatedExamData);
    alert('Funcionalidad de duplicar examen - en desarrollo');
  };


  const getFilteredAndSortedExams = () => {
    let filteredExams = exams.filter(exam => {
      // Filtro por estado
      const statusMatch = (() => {
        switch (filter) {
          case 'draft':
            return exam.status === 'draft';
          case 'scheduled':
            return exam.status === 'scheduled';
          case 'active':
            return exam.status === 'active';
          case 'finished':
            return exam.status === 'finished';
          default:
            return true;
        }
      })();

      // Filtro por búsqueda
      const searchMatch = searchTerm === '' || 
        exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.materiaName?.toLowerCase().includes(searchTerm.toLowerCase());

      return statusMatch && searchMatch;
    });

    // Ordenamiento
    filteredExams.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'date':
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'materia':
          comparison = (a.materiaName || '').localeCompare(b.materiaName || '');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filteredExams;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return '#6b7280';
      case 'scheduled':
        return '#f59e0b';
      case 'active':
        return '#10b981';
      case 'finished':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Borrador';
      case 'scheduled':
        return 'Programado';
      case 'active':
        return 'Activo';
      case 'finished':
        return 'Finalizado';
      default:
        return 'Desconocido';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return 'fa-edit';
      case 'scheduled':
        return 'fa-clock';
      case 'active':
        return 'fa-play-circle';
      case 'finished':
        return 'fa-check-circle';
      default:
        return 'fa-question-circle';
    }
  };

  if (loading) {
    return (
      <div className="teacher-exams-loading">
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: '#6147FF' }}></i>
        <p>Cargando exámenes...</p>
      </div>
    );
  }

  const filteredExams = getFilteredAndSortedExams();

  return (
    <>
      <HeaderWithHamburger
        title="Mis exámenes"
        subtitle="Gestiona todos tus exámenes"
        themeColor="#6147FF"
      />
      <div className="teacher-exams-page">
        {/* Context info section */}
        <div className="context-info">
          <div className="context-stats">
            <div className="context-stat">
              <div className="context-stat-icon">
                <i className="fas fa-users"></i>
              </div>
              <div className="context-stat-content">
                <span className="context-stat-value">{stats.totalStudents}</span>
                <span className="context-stat-label">Estudiantes aprox.</span>
              </div>
            </div>
            
            <div className="context-stat">
              <div className="context-stat-icon upcoming">
                <i className="fas fa-calendar-check"></i>
              </div>
              <div className="context-stat-content">
                <span className="context-stat-value">{stats.upcomingExams}</span>
                <span className="context-stat-label">Exámenes activos</span>
              </div>
            </div>
            
            <div className="context-stat">
              <div className="context-stat-icon activity">
                <i className="fas fa-clock"></i>
              </div>
              <div className="context-stat-content">
                <span className="context-stat-value">{materias.length}</span>
                <span className="context-stat-label">Materias asignadas</span>
              </div>
            </div>
          </div>
          
          <div className="context-activity">
            <div className="activity-indicator">
              <i className="fas fa-info-circle"></i>
              <span>{stats.recentActivity}</span>
            </div>
            {materias.length === 0 && (
              <div className="context-warning">
                <i className="fas fa-exclamation-triangle"></i>
                <span>Necesitas materias asignadas para crear exámenes</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls section */}
        <div className="exams-controls">
          <div className="exams-controls-row">
            <button 
              className="create-exam-button-main"
              onClick={handleCreateExam}
              disabled={materias.length === 0}
              title={materias.length === 0 ? "Necesitas tener materias asignadas primero" : ""}
            >
              <i className="fas fa-plus"></i>
              <span>Crear nuevo examen</span>
            </button>
            
            <div className="exams-filters">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Todos ({exams.length})
              </button>
              <button
                className={`filter-btn draft ${filter === 'draft' ? 'active' : ''}`}
                onClick={() => setFilter('draft')}
                title="Exámenes en proceso de creación"
              >
                <i className="fas fa-edit"></i>
                Borradores ({exams.filter(e => e.status === 'draft').length})
              </button>
              <button
                className={`filter-btn scheduled ${filter === 'scheduled' ? 'active' : ''}`}
                onClick={() => setFilter('scheduled')}
                title="Exámenes programados para fecha futura"
              >
                <i className="fas fa-clock"></i>
                Programados ({exams.filter(e => e.status === 'scheduled').length})
              </button>
              <button
                className={`filter-btn active ${filter === 'active' ? 'active' : ''}`}
                onClick={() => setFilter('active')}
                title="Exámenes disponibles para estudiantes"
              >
                <i className="fas fa-play-circle"></i>
                Activos ({exams.filter(e => e.status === 'active').length})
              </button>
              <button
                className={`filter-btn finished ${filter === 'finished' ? 'active' : ''}`}
                onClick={() => setFilter('finished')}
                title="Exámenes ya finalizados"
              >
                <i className="fas fa-check-circle"></i>
                Finalizados ({exams.filter(e => e.status === 'finished').length})
              </button>
            </div>
          </div>

          <div className="exams-controls-row">
            <div className="search-container">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                placeholder="Buscar por nombre, descripción o materia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button
                  className="clear-search"
                  onClick={() => setSearchTerm('')}
                  title="Limpiar búsqueda"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            <div className="sort-controls">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'materia')}
                className="sort-select"
              >
                <option value="date">Ordenar por fecha</option>
                <option value="name">Ordenar por nombre</option>
                <option value="materia">Ordenar por materia</option>
              </select>
              <button
                className={`sort-order-btn ${sortOrder === 'desc' ? 'desc' : 'asc'}`}
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={sortOrder === 'asc' ? 'Cambiar a descendente' : 'Cambiar a ascendente'}
              >
                <i className={`fas ${sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}`}></i>
              </button>
            </div>
          </div>

        </div>

        {/* Exams grid */}
        {filteredExams.length > 0 ? (
          <div className="teacher-exams-grid">
            {filteredExams.map(exam => (
              <div 
                key={exam.id} 
                className={`teacher-exam-card ${exam.status}`}
              >
                <div className="exam-card-header">
                  <div className="exam-icon">
                    <i className="fas fa-file-alt"></i>
                  </div>
                  <div 
                    className="exam-status" 
                    style={{ backgroundColor: getStatusColor(exam.status || 'draft') }}
                  >
                    <i className={`fas ${getStatusIcon(exam.status || 'draft')}`}></i>
                    {getStatusText(exam.status || 'draft')}
                  </div>
                </div>
                
                <div className="exam-card-body">
                  <h3 className="exam-title">{exam.title}</h3>
                  {exam.description && (
                    <p className="exam-description">{exam.description}</p>
                  )}
                  
                  <div className="exam-meta">
                    <div className="exam-info-item">
                      <i className="fas fa-book"></i>
                      <span>{exam.materiaName}</span>
                    </div>
                    <div className="exam-info-item">
                      <i className="fas fa-percentage"></i>
                      <span>{exam.percentageQuestions}% preguntas</span>
                    </div>
                    <div className="exam-info-item">
                      <i className="fas fa-clock"></i>
                      <span>{exam.timePerConcept}s por concepto</span>
                    </div>
                  </div>
                  
                  <div className="exam-created">
                    <i className="fas fa-calendar"></i>
                    <span>
                      Creado {formatDistanceToNow(exam.createdAt.toDate(), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                </div>
                
                <div className="exam-card-actions">
                  <button 
                    className="exam-action-btn view-btn"
                    onClick={() => handleViewExam(exam.id)}
                    title="Ver dashboard del examen"
                  >
                    <i className="fas fa-chart-line"></i>
                    Dashboard
                  </button>
                  <button 
                    className="exam-action-btn duplicate-btn"
                    onClick={() => handleDuplicateExam(exam)}
                    title="Duplicar examen"
                  >
                    <i className="fas fa-copy"></i>
                    Duplicar
                  </button>
                  <button 
                    className="exam-action-btn delete-btn"
                    onClick={() => handleDeleteExam(exam.id, exam.title)}
                    title="Eliminar examen"
                  >
                    <i className="fas fa-trash"></i>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <i className="fas fa-file-alt" style={{ fontSize: '4rem', color: '#9ca3af', marginBottom: '1rem' }}></i>
            <h3>No hay exámenes {(() => {
              switch (filter) {
                case 'draft': return 'en borrador';
                case 'scheduled': return 'programados';
                case 'active': return 'activos';
                case 'finished': return 'finalizados';
                default: return '';
              }
            })()}</h3>
            <p>
              {filter === 'all' 
                ? materias.length === 0 
                  ? 'Necesitas tener materias asignadas para crear exámenes.'
                  : 'Aún no has creado ningún examen.'
                : filter === 'active'
                ? 'No tienes exámenes activos en este momento.'
                : 'No hay exámenes inactivos.'
              }
            </p>
            {filter !== 'all' && (
              <button 
                className="btn-secondary"
                onClick={() => setFilter('all')}
              >
                Ver todos los exámenes
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal para crear examen */}
      <CreateExamModal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        onExamCreated={handleExamCreated}
        materias={materias}
      />
    </>
  );
};

export default TeacherExamsPage;