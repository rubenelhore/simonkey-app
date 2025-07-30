import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
}

interface Materia {
  id: string;
  nombre: string;
  color?: string;
}

const TeacherExamsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { isSchoolTeacher } = useUserType();
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (!user || !isSchoolTeacher) {
      navigate('/school/teacher');
      return;
    }
    loadTeacherData();
  }, [user, isSchoolTeacher, userProfile]);

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
          materiaName: materia?.nombre || 'Materia no encontrada'
        });
      });
      
      console.log('📝 [TeacherExams] Exámenes encontrados:', examsData.length);
      setExams(examsData);
      
    } catch (error) {
      console.error('❌ [TeacherExams] Error cargando datos:', error);
    } finally {
      setLoading(false);
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

  const getFilteredExams = () => {
    return exams.filter(exam => {
      switch (filter) {
        case 'active':
          return exam.isActive;
        case 'inactive':
          return !exam.isActive;
        default:
          return true;
      }
    });
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? '#10b981' : '#6b7280';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Activo' : 'Inactivo';
  };

  if (loading) {
    return (
      <div className="teacher-exams-loading">
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: '#6147FF' }}></i>
        <p>Cargando exámenes...</p>
      </div>
    );
  }

  const filteredExams = getFilteredExams();

  return (
    <>
      <HeaderWithHamburger
        title="Mis exámenes"
        subtitle="Gestiona todos tus exámenes"
        themeColor="#6147FF"
      />
      <div className="teacher-exams-page">
        {/* Controls section */}
        <div className="exams-controls">
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
              className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Activos ({exams.filter(e => e.isActive).length})
            </button>
            <button
              className={`filter-btn ${filter === 'inactive' ? 'active' : ''}`}
              onClick={() => setFilter('inactive')}
            >
              Inactivos ({exams.filter(e => !e.isActive).length})
            </button>
          </div>
        </div>

        {/* Exams grid */}
        {filteredExams.length > 0 ? (
          <div className="teacher-exams-grid">
            {filteredExams.map(exam => (
              <div 
                key={exam.id} 
                className={`teacher-exam-card ${exam.isActive ? 'active' : 'inactive'}`}
              >
                <div className="exam-card-header">
                  <div className="exam-icon">
                    <i className="fas fa-file-alt"></i>
                  </div>
                  <div 
                    className="exam-status" 
                    style={{ backgroundColor: getStatusColor(exam.isActive) }}
                  >
                    <i className={`fas ${exam.isActive ? 'fa-check-circle' : 'fa-pause-circle'}`}></i>
                    {getStatusText(exam.isActive)}
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
            <h3>No hay exámenes {filter === 'all' ? '' : filter === 'active' ? 'activos' : 'inactivos'}</h3>
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