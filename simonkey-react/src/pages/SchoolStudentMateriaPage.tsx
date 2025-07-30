import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getDomainProgressForNotebook } from '../utils/domainProgress';
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
  domainProgress?: {
    total: number;
    dominated: number;
    learning: number;
    notStarted: number;
  };
}

interface SchoolSubject {
  id: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  idEscuela?: string;
}


const SchoolStudentMateriaPage: React.FC = () => {
  const navigate = useNavigate();
  const { materiaName } = useParams<{ materiaName: string }>();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { isSchoolStudent } = useUserType();
  
  const [notebooks, setNotebooks] = useState<SchoolNotebook[]>([]);
  const [materia, setMateria] = useState<SchoolSubject | null>(null);
  const [loading, setLoading] = useState(true);
  const [materiaId, setMateriaId] = useState<string | null>(null);

  useEffect(() => {
    const loadMateriaData = async () => {
      if (!user || !materiaName || !isSchoolStudent) return;
      
      setLoading(true);
      try {
        // Decodificar el nombre de la materia
        const decodedMateriaName = decodeURIComponent(materiaName);
        
        // Buscar la materia por nombre
        const materiaQuery = query(
          collection(db, 'schoolSubjects'),
          where('nombre', '==', decodedMateriaName)
        );
        const materiaSnapshot = await getDocs(materiaQuery);
        
        if (!materiaSnapshot.empty) {
          const materiaDoc = materiaSnapshot.docs[0];
          const materiaData = materiaDoc.data();
          const currentMateriaId = materiaDoc.id;
          setMateriaId(currentMateriaId);
          
          setMateria({
            id: materiaDoc.id,
            nombre: materiaData.nombre,
            descripcion: materiaData.descripcion,
            color: materiaData.color || '#6147FF',
            idEscuela: materiaData.idEscuela
          });
        } else {
          console.error('Materia no encontrada:', decodedMateriaName);
          return;
        }

        // Cargar cuadernos del estudiante
        if (userProfile?.idCuadernos && userProfile.idCuadernos.length > 0) {
          const notebooksData: SchoolNotebook[] = [];
          
          for (const notebookId of userProfile.idCuadernos) {
            try {
              const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
              if (notebookDoc.exists()) {
                const data = notebookDoc.data();
                console.log('📚 Notebook ID:', notebookDoc.id);
                console.log('📚 Título del notebook:', data.title);
                console.log('📚 Tipo del título:', typeof data.title);
                console.log('📚 Longitud del título:', data.title?.length);
                if (data.idMateria === currentMateriaId) {
                  // Calcular el progreso de dominio para cada notebook
                  const domainProgress = await getDomainProgressForNotebook(notebookDoc.id);
                  console.log('📊 Progreso de dominio calculado para', data.title, ':', domainProgress);
                  notebooksData.push({
                    id: notebookDoc.id,
                    title: data.title || data.titulo || 'Sin título',
                    descripcion: data.descripcion,
                    color: data.color || '#6147FF',
                    idMateria: data.idMateria,
                    userId: data.userId,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    conceptCount: data.conceptCount || 0,
                    isFrozen: data.isFrozen,
                    frozenScore: data.frozenScore,
                    frozenAt: data.frozenAt,
                    domainProgress: domainProgress
                  });
                }
              } else {
                console.log('❌ Notebook no encontrado en schoolNotebooks:', notebookId);
              }
            } catch (error) {
              console.error('Error loading notebook:', notebookId, error);
            }
          }
          
          console.log('📋 Notebooks finales cargados:', notebooksData);
          setNotebooks(notebooksData);
        } else {
          console.log('❌ No hay idCuadernos en userProfile:', userProfile);
        }
        
      } catch (err) {
        console.error('Error loading materia data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadMateriaData();
  }, [user, materiaName, isSchoolStudent, userProfile]);

  const handleNotebookClick = (notebookId: string) => {
    navigate(`/school/notebooks/${notebookId}`);
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
        subtitle={`Cuadernos disponibles`}
        showBackButton={true}
        onBackClick={() => navigate('/materias')}
        themeColor="#FF6B6B"
      />
      <div className="school-teacher-materia-page">
        {/* Cuadernos de la materia */}
        <div className="notebooks-section">
          {notebooks.length > 0 ? (
            <div className="notebooks-grid">
              {notebooks.map(notebook => {
                console.log('🎨 ID del notebook a renderizar:', notebook.id);
                console.log('🎨 Título a renderizar:', notebook.title);
                console.log('🎨 Tiene título:', !!notebook.title);
                console.log('🎨 Longitud del título:', notebook.title?.length || 0);
                return (
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
                      width: '100%',
                      color: '#1f2937'
                    }}>
                      <span style={{
                        flex: '1',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#1f2937'
                      }}>
                        {(() => {
                          const displayTitle = notebook.title || 'Sin título';
                          console.log('🖼️ Título que se va a mostrar:', displayTitle);
                          return displayTitle;
                        })()}
                      </span>
                      {notebook.domainProgress && notebook.domainProgress.total > 0 && (() => {
                        const percentage = Math.round((notebook.domainProgress.dominated / notebook.domainProgress.total) * 100);
                        console.log('📊 Mostrando porcentaje para', notebook.title, ':', percentage + '%', 'dominados:', notebook.domainProgress.dominated, 'total:', notebook.domainProgress.total);
                        return (
                          <span style={{ 
                            color: '#10b981', 
                            fontSize: '1.1rem', 
                            fontWeight: 'bold',
                            flexShrink: 0
                          }}>
                            {percentage}%
                          </span>
                        );
                      })()}
                    </h3>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <i className="fas fa-book" style={{ fontSize: '3rem', color: '#9ca3af' }}></i>
              <p>No hay cuadernos disponibles en esta materia</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SchoolStudentMateriaPage;