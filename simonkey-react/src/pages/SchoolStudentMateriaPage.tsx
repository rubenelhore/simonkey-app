import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ExamService } from '../services/examService';
import '../styles/SchoolSystem.css';
import '../styles/Notebooks.css';

interface SchoolNotebook {
  id: string;
  title: string;
  descripcion?: string;
  color: string;
  idMateria: string;
  userId?: string;
  createdAt: any;
  updatedAt: any;
  conceptCount?: number;
  isFrozen?: boolean;
  frozenScore?: number;
  frozenAt?: any;
}

interface SchoolSubject {
  id: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  idEscuela?: string;
}

interface Exam {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  idMateria: string;
  idProfesor: string;
  createdAt: any;
  questions?: any[];
}

const SchoolStudentMateriaPage: React.FC = () => {
  const navigate = useNavigate();
  const { materiaId } = useParams<{ materiaId: string }>();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { isSchoolStudent } = useUserType();
  
  const [notebooks, setNotebooks] = useState<SchoolNotebook[]>([]);
  const [materia, setMateria] = useState<SchoolSubject | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examAttempts, setExamAttempts] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'notebooks' | 'exams'>('notebooks');

  useEffect(() => {
    const loadMateriaData = async () => {
      if (!user || !materiaId || !isSchoolStudent) return;
      
      setLoading(true);
      try {
        // Cargar información de la materia
        const materiaDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
        if (materiaDoc.exists()) {
          const materiaData = materiaDoc.data();
          setMateria({
            id: materiaDoc.id,
            nombre: materiaData.nombre,
            descripcion: materiaData.descripcion,
            color: materiaData.color || '#6147FF',
            idEscuela: materiaData.idEscuela
          });
        }

        // Cargar cuadernos del estudiante
        if (userProfile?.idCuadernos && userProfile.idCuadernos.length > 0) {
          const notebooksData: SchoolNotebook[] = [];
          
          for (const notebookId of userProfile.idCuadernos) {
            try {
              const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
              if (notebookDoc.exists()) {
                const data = notebookDoc.data();
                if (data.idMateria === materiaId) {
                  notebooksData.push({
                    id: notebookDoc.id,
                    title: data.title,
                    descripcion: data.descripcion,
                    color: data.color || '#6147FF',
                    idMateria: data.idMateria,
                    userId: data.userId,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    conceptCount: data.conceptCount || 0,
                    isFrozen: data.isFrozen,
                    frozenScore: data.frozenScore,
                    frozenAt: data.frozenAt
                  });
                }
              }
            } catch (error) {
              console.error('Error loading notebook:', notebookId, error);
            }
          }
          
          setNotebooks(notebooksData);
        }

        // Cargar exámenes activos usando el servicio
        try {
          console.log('📝 Cargando exámenes para estudiante...');
          const activeExams = await ExamService.getActiveExamsForStudent(user.uid, materiaId);
          setExams(activeExams as any[]);
          console.log('📝 Exámenes disponibles:', activeExams.length);
          
          // Verificar si el estudiante ya ha tomado cada examen
          const attemptsMap = new Map<string, boolean>();
          for (const exam of activeExams) {
            const attemptsQuery = query(
              collection(db, 'examAttempts'),
              where('examId', '==', exam.id),
              where('studentId', '==', user.uid)
            );
            const attemptsSnapshot = await getDocs(attemptsQuery);
            attemptsMap.set(exam.id, !attemptsSnapshot.empty);
          }
          setExamAttempts(attemptsMap);
          console.log('📊 Intentos de examen cargados:', attemptsMap);
        } catch (error) {
          console.error('❌ Error cargando exámenes:', error);
          setExams([]);
        }
        
      } catch (err) {
        console.error('Error loading materia data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadMateriaData();
  }, [user, materiaId, isSchoolStudent, userProfile]);

  const handleNotebookClick = (notebookId: string) => {
    navigate(`/school/notebooks/${notebookId}`);
  };

  const handleExamClick = (examId: string) => {
    // Verificar si el estudiante ya tomó el examen
    if (examAttempts.get(examId)) {
      alert('Ya has completado este examen. Solo se permite un intento por examen.');
      return;
    }
    navigate(`/exam/${examId}`, { state: { materiaId } });
  };

  if (loading || authLoading) {
    return (
      <div className="loading-container">
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '3rem', color: '#6147FF' }}></i>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!materia) {
    return (
      <div className="error-container">
        <h2>Materia no encontrada</h2>
        <button onClick={() => navigate('/materias')} className="back-button">
          Volver a materias
        </button>
      </div>
    );
  }

  return (
    <>
      <HeaderWithHamburger
        title={materia.nombre}
        subtitle={`Cuadernos de ${materia.nombre}`}
        showBackButton={true}
        onBackClick={() => navigate('/materias')}
        themeColor="#FF6B6B"
      />
      <div className="school-teacher-materia-page">
        {/* Tabs para cuadernos y exámenes */}
        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'notebooks' ? 'active' : ''}`}
            onClick={() => setActiveTab('notebooks')}
          >
            <i className="fas fa-book"></i>
            Cuadernos ({notebooks.length})
          </button>
          <button
            className={`tab-button ${activeTab === 'exams' ? 'active' : ''}`}
            onClick={() => setActiveTab('exams')}
          >
            <i className="fas fa-file-alt"></i>
            Exámenes ({exams.length})
          </button>
        </div>

        {/* Contenido según tab activo */}
        <div className="tab-content">
          {activeTab === 'notebooks' && (
            <div className="notebooks-section">
              {notebooks.length > 0 ? (
                <div className="notebooks-grid">
                  {notebooks.map(notebook => (
                    <div 
                      key={notebook.id} 
                      className="notebook-card"
                    >
                      <div 
                        className="notebook-card-content"
                        onClick={() => handleNotebookClick(notebook.id)}
                        style={{ 
                          '--notebook-color': notebook.color,
                          cursor: 'pointer'
                        } as React.CSSProperties}
                      >
                        <h3 style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '0.5rem',
                          width: '100%'
                        }}>
                          <span style={{
                            flex: '1',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {notebook.title}
                          </span>
                          <span style={{ 
                            color: '#10b981', 
                            fontSize: '1.1rem', 
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            80%
                          </span>
                        </h3>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <i className="fas fa-book" style={{ fontSize: '3rem', color: '#9ca3af' }}></i>
                  <p>No hay cuadernos disponibles en esta materia</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="exams-section">
              {exams.length > 0 ? (
                <div className="exams-grid">
                  {exams.map(exam => {
                    const hasAttempted = examAttempts.get(exam.id) || false;
                    return (
                      <div 
                        key={exam.id} 
                        className={`exam-card ${hasAttempted ? 'completed' : ''}`}
                        onClick={() => handleExamClick(exam.id)}
                        style={{ cursor: hasAttempted ? 'not-allowed' : 'pointer' }}
                      >
                        <div className="exam-card-header" style={{ backgroundColor: hasAttempted ? '#9ca3af' : materia.color }}>
                          <i className="fas fa-file-alt"></i>
                        </div>
                        <div className="exam-card-body">
                          <h3>{exam.title}</h3>
                          {exam.description && (
                            <p className="exam-description">{exam.description}</p>
                          )}
                          <div className="exam-info">
                            <span className={`exam-status ${hasAttempted ? 'completed' : 'active'}`}>
                              <i className={`fas ${hasAttempted ? 'fa-check' : 'fa-check-circle'}`}></i>
                              {hasAttempted ? 'Completado' : 'Disponible'}
                            </span>
                          </div>
                        </div>
                        <div className="exam-card-footer">
                          <button 
                            className="start-exam-button"
                            disabled={hasAttempted}
                            style={{
                              backgroundColor: hasAttempted ? '#9ca3af' : '',
                              cursor: hasAttempted ? 'not-allowed' : 'pointer',
                              opacity: hasAttempted ? 0.7 : 1
                            }}
                          >
                            {hasAttempted ? 'No Disponible' : 'Comenzar examen'}
                            <i className={`fas ${hasAttempted ? 'fa-lock' : 'fa-arrow-right'}`}></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <i className="fas fa-file-alt" style={{ fontSize: '3rem', color: '#9ca3af' }}></i>
                  <p>No hay exámenes disponibles en esta materia</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SchoolStudentMateriaPage;