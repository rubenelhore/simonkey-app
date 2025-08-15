import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { ExamService } from '../services/examService';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import '../styles/StudentExamsPage.css';

interface Exam {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  idMateria: string;
  idProfesor: string;
  createdAt: any;
  materiaName?: string;
  questions?: any[];
}

interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  status: 'completed' | 'in_progress' | 'not_started';
  completedAt?: any;
  score?: number;
}

const StudentExamsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { isSchoolStudent } = useUserType();
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [examAttempts, setExamAttempts] = useState<Map<string, ExamAttempt>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'completed'>('all');

  useEffect(() => {
    if (!user || !isSchoolStudent) {
      navigate('/materias');
      return;
    }
    loadStudentExams();
  }, [user, isSchoolStudent, userProfile]);

  const loadStudentExams = async () => {
    if (!user || !userProfile) return;
    
    setLoading(true);
    try {
      console.log('📝 Cargando exámenes para estudiante...');
      console.log('👤 Perfil del estudiante:', {
        email: userProfile.email,
        idMaterias: userProfile.idMaterias,
        subjectIds: userProfile.subjectIds,
        idCuadernos: userProfile.idCuadernos,
        schoolRole: userProfile.schoolRole
      });
      
      // Get all subject IDs from student's profile
      const studentSubjectIds = new Set<string>();
      
      // Primero intentar con idMaterias directo del perfil
      if (userProfile.idMaterias && userProfile.idMaterias.length > 0) {
        console.log('📚 Usando idMaterias del perfil:', userProfile.idMaterias);
        userProfile.idMaterias.forEach((materiaId: string) => {
          studentSubjectIds.add(materiaId);
        });
      } 
      // Si no tiene idMaterias, intentar con subjectIds
      else if (userProfile.subjectIds && userProfile.subjectIds.length > 0) {
        console.log('📚 Usando subjectIds del perfil:', userProfile.subjectIds);
        userProfile.subjectIds.forEach((materiaId: string) => {
          studentSubjectIds.add(materiaId);
        });
      }
      // Como último recurso, obtener de los notebooks
      else if (userProfile.idCuadernos && userProfile.idCuadernos.length > 0) {
        console.log('📚 Obteniendo materias desde notebooks...');
        for (const notebookId of userProfile.idCuadernos) {
          try {
            const notebookDoc = await getDocs(
              query(collection(db, 'schoolNotebooks'), where('__name__', '==', notebookId))
            );
            notebookDoc.forEach(doc => {
              const data = doc.data();
              if (data.idMateria) {
                studentSubjectIds.add(data.idMateria);
              }
            });
          } catch (error) {
            console.error('Error loading notebook:', notebookId, error);
          }
        }
      }
      
      console.log('📚 Subject IDs del estudiante:', Array.from(studentSubjectIds));
      
      // Get exams for each subject
      const allExams: Exam[] = [];
      const subjectNames = new Map<string, string>();
      
      for (const subjectId of studentSubjectIds) {
        // Get subject name
        try {
          const subjectQuery = query(collection(db, 'schoolSubjects'), where('__name__', '==', subjectId));
          const subjectSnapshot = await getDocs(subjectQuery);
          subjectSnapshot.forEach(doc => {
            const subjectData = doc.data();
            subjectNames.set(subjectId, subjectData.nombre || 'Materia sin nombre');
          });
        } catch (error) {
          console.error('Error loading subject:', subjectId, error);
        }
        
        // Get active exams for this subject
        try {
          const subjectExams = await ExamService.getActiveExamsForStudent(user.uid, subjectId);
          subjectExams.forEach(exam => {
            allExams.push({
              ...exam,
              materiaName: subjectNames.get(subjectId) || 'Materia sin nombre'
            });
          });
        } catch (error) {
          console.error('Error loading exams for subject:', subjectId, error);
        }
      }
      
      console.log('📝 Total exámenes encontrados:', allExams.length);
      setExams(allExams);
      
      // Load exam attempts
      const attemptsMap = new Map<string, ExamAttempt>();
      for (const exam of allExams) {
        try {
          const attemptsQuery = query(
            collection(db, 'examAttempts'),
            where('examId', '==', exam.id),
            where('studentId', '==', user.uid)
          );
          const attemptsSnapshot = await getDocs(attemptsQuery);
          
          // Get the most recent attempt
          let latestAttempt: ExamAttempt | null = null;
          attemptsSnapshot.forEach(doc => {
            const attempt = { id: doc.id, ...doc.data() } as ExamAttempt;
            if (!latestAttempt || (attempt.completedAt && (!latestAttempt.completedAt || attempt.completedAt.toDate() > latestAttempt.completedAt.toDate()))) {
              latestAttempt = attempt;
            }
          });
          
          if (latestAttempt) {
            attemptsMap.set(exam.id, latestAttempt);
          }
        } catch (error) {
          console.error('Error loading attempts for exam:', exam.id, error);
        }
      }
      
      setExamAttempts(attemptsMap);
      console.log('📊 Intentos de examen cargados:', attemptsMap.size);
      
    } catch (error) {
      console.error('❌ Error cargando exámenes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExamClick = (examId: string) => {
    const attempt = examAttempts.get(examId);
    if (attempt && attempt.status === 'completed') {
      // Navigate to results page if already completed
      navigate(`/exam/${examId}/results`);
    } else {
      // Navigate to exam page to start/continue
      navigate(`/exam/${examId}`);
    }
  };

  const getFilteredExams = () => {
    return exams.filter(exam => {
      const attempt = examAttempts.get(exam.id);
      
      switch (filter) {
        case 'available':
          return !attempt || attempt.status !== 'completed';
        case 'completed':
          return attempt && attempt.status === 'completed';
        default:
          return true;
      }
    });
  };

  const getExamStatus = (examId: string) => {
    const attempt = examAttempts.get(examId);
    if (!attempt) return 'not_started';
    return attempt.status;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En progreso';
      default:
        return 'Disponible';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'fa-check-circle';
      case 'in_progress':
        return 'fa-clock';
      default:
        return 'fa-play-circle';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'completed';
      case 'in_progress':
        return 'in-progress';
      default:
        return 'available';
    }
  };

  if (loading) {
    return (
      <div className="student-exams-loading">
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: '#6147FF' }}></i>
        <p>Cargando exámenes...</p>
      </div>
    );
  }

  const filteredExams = getFilteredExams();

  return (
    <>
      <HeaderWithHamburger
        title="Exámenes"
        subtitle="Todos tus exámenes disponibles"
        themeColor="#FF6B6B"
      />
      <main className="notebooks-main notebooks-main-no-sidebar">
        <div className="notebooks-list-section notebooks-list-section-full">
          <div className="student-exams-page">
        {/* Filter controls */}
        <div className="exams-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <i className="fas fa-list"></i>
            Todos ({exams.length})
          </button>
          <button
            className={`filter-btn ${filter === 'available' ? 'active' : ''}`}
            onClick={() => setFilter('available')}
          >
            <i className="fas fa-play-circle"></i>
            Disponibles ({exams.filter(e => getExamStatus(e.id) !== 'completed').length})
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            <i className="fas fa-check-circle"></i>
            Completados ({exams.filter(e => getExamStatus(e.id) === 'completed').length})
          </button>
        </div>

        {/* Exams grid */}
        {filteredExams.length > 0 ? (
          <div className="exams-grid">
            {filteredExams.map(exam => {
              const status = getExamStatus(exam.id);
              const attempt = examAttempts.get(exam.id);
              
              return (
                <div 
                  key={exam.id} 
                  className={`exam-card ${getStatusClass(status)}`}
                  onClick={() => handleExamClick(exam.id)}
                >
                  <div className="exam-card-header">
                    <div className="exam-icon">
                      <i className="fas fa-file-alt"></i>
                    </div>
                    <div className={`exam-status ${getStatusClass(status)}`}>
                      <i className={`fas ${getStatusIcon(status)}`}></i>
                      {getStatusText(status)}
                    </div>
                  </div>
                  
                  <div className="exam-card-body">
                    <h3 className="exam-title">{exam.title}</h3>
                    {exam.description && (
                      <p className="exam-description">{exam.description}</p>
                    )}
                    <div className="exam-meta">
                      <span className="exam-subject">
                        <i className="fas fa-book"></i>
                        {exam.materiaName}
                      </span>
                      {attempt && attempt.status === 'completed' && attempt.score !== undefined && (
                        <span className="exam-score">
                          <i className="fas fa-star"></i>
                          {attempt.score} pts
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="exam-card-footer">
                    <button className={`exam-action-btn ${getStatusClass(status)}`}>
                      {status === 'completed' ? (
                        <>
                          <i className="fas fa-eye"></i>
                          Ver resultados
                        </>
                      ) : status === 'in_progress' ? (
                        <>
                          <i className="fas fa-play"></i>
                          Continuar
                        </>
                      ) : (
                        <>
                          <i className="fas fa-play"></i>
                          Comenzar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state-enhanced">
            <div className="empty-state-illustration">
              <div className="illustration-circle">
                <i className="fas fa-clipboard-list"></i>
              </div>
              <div className="decoration-dots">
                <span className="dot dot-1"></span>
                <span className="dot dot-2"></span>
                <span className="dot dot-3"></span>
              </div>
            </div>
            <h2 className="empty-state-title">
              {filter === 'all' 
                ? '¡Tu espacio de exámenes está listo!'
                : filter === 'available' 
                ? 'No hay exámenes disponibles' 
                : 'No hay exámenes completados'}
            </h2>
            <p className="empty-state-description">
              {filter === 'all' 
                ? 'Cuando tu profesor asigne nuevos exámenes, aparecerán aquí. Mientras tanto, puedes seguir estudiando en tus cuadernos.'
                : filter === 'available'
                ? 'No tienes exámenes pendientes por realizar en este momento. Los nuevos exámenes aparecerán aquí cuando tu profesor los publique.'
                : 'Aún no tienes exámenes completados. Una vez que realices tu primer examen, aparecerá aquí con tu calificación y podrás revisar tus resultados.'}
            </p>
            <div className="empty-state-actions">
              {filter === 'all' && (
                <button 
                  className="btn-primary-gradient"
                  onClick={() => navigate('/materias')}
                >
                  <i className="fas fa-book"></i>
                  Ir a mis materias
                </button>
              )}
            </div>
            <div className="empty-state-tips">
              <div className="tip-card">
                <i className="fas fa-lightbulb"></i>
                <span>
                  {filter === 'all' 
                    ? 'Tip: Revisa regularmente esta sección para no perderte ningún examen (No te preocupes nosotros te avisaremos)'
                    : filter === 'available'
                    ? 'Tip: ¡Mientras esperamos nuevos exámenes, es el momento perfecto para estudiar y brillar! 📚✨ (Tu futuro yo te lo agradecerá)'
                    : 'Tip: Practica en la zona de estudio para mejorar tus resultados en futuros exámenes (¡La práctica hace al maestro!)'}
                </span>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </main>
    </>
  );
};

export default StudentExamsPage;