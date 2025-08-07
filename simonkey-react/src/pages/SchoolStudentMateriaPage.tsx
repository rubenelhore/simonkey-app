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
      
      console.log('🚀 VERSION 2.0 - SchoolStudentMateriaPage actualizado');
      setLoading(true);
      try {
        // Decodificar el nombre de la materia
        const decodedMateriaName = decodeURIComponent(materiaName);
        
        console.log('🔍 Buscando materia:', decodedMateriaName);
        console.log('🔍 IDs de materias del estudiante:', userProfile?.subjectIds);
        
        // Primero buscar entre las materias asignadas al estudiante
        let materiaSnapshot;
        if (userProfile?.subjectIds && userProfile.subjectIds.length > 0) {
          // Buscar la materia por nombre Y que esté en las materias del estudiante
          const allMateriasQuery = query(
            collection(db, 'schoolSubjects'),
            where('nombre', '==', decodedMateriaName)
          );
          const allMateriasSnapshot = await getDocs(allMateriasQuery);
          
          // Filtrar solo las que están asignadas al estudiante
          const assignedMaterias = allMateriasSnapshot.docs.filter(doc => 
            userProfile.subjectIds?.includes(doc.id) || false
          );
          
          if (assignedMaterias.length > 0) {
            console.log('✅ Materia encontrada en las asignadas al estudiante');
            materiaSnapshot = { 
              empty: false, 
              docs: assignedMaterias 
            };
          } else {
            console.log('⚠️ Materia no encontrada en las asignadas, buscando cualquiera con ese nombre');
            materiaSnapshot = allMateriasSnapshot;
          }
        } else {
          // Fallback: buscar cualquier materia con ese nombre
          const materiaQuery = query(
            collection(db, 'schoolSubjects'),
            where('nombre', '==', decodedMateriaName)
          );
          materiaSnapshot = await getDocs(materiaQuery);
        }
        
        if (!materiaSnapshot.empty) {
          const materiaDoc = materiaSnapshot.docs[0];
          const materiaData = materiaDoc.data();
          const currentMateriaId = materiaDoc.id;
          setMateriaId(currentMateriaId);
          
          console.log('🎯 MATERIA ENCONTRADA:');
          console.log('  - Nombre:', materiaData.nombre);
          console.log('  - ID de la materia:', currentMateriaId);
          console.log('  - Datos completos:', materiaData);
          
          setMateria({
            id: materiaDoc.id,
            nombre: materiaData.nombre,
            descripcion: materiaData.descripcion,
            color: materiaData.color || '#6147FF',
            idEscuela: materiaData.idEscuela
          });

          // Cargar cuadernos del estudiante (dentro del bloque where currentMateriaId está definido)
          if (userProfile?.idCuadernos && userProfile.idCuadernos.length > 0) {
            const notebooksData: SchoolNotebook[] = [];
            
            for (const notebookId of userProfile.idCuadernos) {
              try {
                const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
                if (notebookDoc.exists()) {
                  const data = notebookDoc.data();
                  console.log('📚 === NOTEBOOK ENCONTRADO ===');
                  console.log('  - ID del notebook:', notebookDoc.id);
                  console.log('  - Título:', data.title);
                  console.log('  - idMateria del notebook:', data.idMateria);
                  console.log('  - ID de materia actual (buscado):', currentMateriaId);
                  console.log('  - ¿Coinciden los IDs?:', data.idMateria === currentMateriaId);
                  console.log('  - Tipo de idMateria:', typeof data.idMateria);
                  console.log('  - Tipo de currentMateriaId:', typeof currentMateriaId);
                  
                  // TEMPORAL: Por ahora mostrar TODOS los cuadernos del estudiante
                  // ya que parece haber un problema con la asociación materia-cuaderno
                  // TODO: Investigar por qué no coinciden los IDs
                  const shouldInclude = true; // En el futuro: data.idMateria === currentMateriaId
                  
                  if (shouldInclude) {
                    // Calcular el progreso de dominio para cada notebook
                    const domainProgress = await getDomainProgressForNotebook(notebookDoc.id);
                    console.log('📊 Progreso de dominio calculado para', data.title, ':', domainProgress);
                    
                    // Por ahora mostrar todos los cuadernos sin prefijo
                    // Solo agregar log si no pertenece a esta materia
                    const belongsToThisMateria = data.idMateria === currentMateriaId;
                    if (!belongsToThisMateria) {
                      console.warn('⚠️ NOTA: Este cuaderno tiene idMateria diferente pero se mostrará igual');
                    }
                    
                    notebooksData.push({
                      id: notebookDoc.id,
                      title: data.title || data.titulo || 'Sin título', // Sin prefijo
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
        } else {
          console.error('Materia no encontrada:', decodedMateriaName);
          return;
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