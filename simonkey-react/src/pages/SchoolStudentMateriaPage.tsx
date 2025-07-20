import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

        // Cargar exámenes activos de la materia
        const examsQuery = query(
          collection(db, 'schoolExams'),
          where('idMateria', '==', materiaId),
          where('isActive', '==', true)
        );
        
        const examsSnapshot = await getDocs(examsQuery);
        const examsData = examsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Exam));
        
        setExams(examsData);
        console.log('📝 Exámenes disponibles:', examsData.length);
        
      } catch (err) {
        console.error('Error loading materia data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadMateriaData();
  }, [user, materiaId, isSchoolStudent]);

  const handleNotebookClick = (notebookId: string) => {
    navigate(`/school-notebook-concepts/${notebookId}`);
  };

  const handleExamClick = (examId: string) => {
    navigate(`/exam/${examId}`);
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
        subtitle="Vista de materia"
      />
      <div className="school-teacher-materia-page">
        <div className="materia-header" style={{ backgroundColor: materia.color }}>
          <div className="materia-header-content">
            <button 
              onClick={() => navigate('/materias')} 
              className="back-button-white"
            >
              <i className="fas fa-arrow-left"></i>
              Volver
            </button>
            <h1>{materia.nombre}</h1>
            {materia.descripcion && <p>{materia.descripcion}</p>}
          </div>
        </div>

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
                      onClick={() => handleNotebookClick(notebook.id)}
                      style={{ borderColor: notebook.color }}
                    >
                      <div className="notebook-card-header" style={{ backgroundColor: notebook.color }}>
                        <i className="fas fa-book"></i>
                      </div>
                      <div className="notebook-card-body">
                        <h3>{notebook.title}</h3>
                        {notebook.descripcion && (
                          <p className="notebook-description">{notebook.descripcion}</p>
                        )}
                        <div className="notebook-info">
                          <span className="notebook-concepts">
                            <i className="fas fa-lightbulb"></i>
                            {notebook.conceptCount || 0} conceptos
                          </span>
                          {notebook.isFrozen && (
                            <span className="notebook-frozen">
                              <i className="fas fa-lock"></i>
                              Congelado
                            </span>
                          )}
                        </div>
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
                  {exams.map(exam => (
                    <div 
                      key={exam.id} 
                      className="exam-card"
                      onClick={() => handleExamClick(exam.id)}
                    >
                      <div className="exam-card-header" style={{ backgroundColor: materia.color }}>
                        <i className="fas fa-file-alt"></i>
                      </div>
                      <div className="exam-card-body">
                        <h3>{exam.title}</h3>
                        {exam.description && (
                          <p className="exam-description">{exam.description}</p>
                        )}
                        <div className="exam-info">
                          <span className="exam-status active">
                            <i className="fas fa-check-circle"></i>
                            Disponible
                          </span>
                        </div>
                      </div>
                      <div className="exam-card-footer">
                        <button className="start-exam-button">
                          Comenzar examen
                          <i className="fas fa-arrow-right"></i>
                        </button>
                      </div>
                    </div>
                  ))}
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