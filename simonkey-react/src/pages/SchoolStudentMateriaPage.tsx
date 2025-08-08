import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import NotebookList from '../components/NotebookList';
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
                    
                    // Cargar el conteo real de conceptos desde la colección schoolConcepts
                    let actualConceptCount = 0;
                    try {
                      const conceptsQuery = query(
                        collection(db, 'schoolConcepts'),
                        where('notebookId', '==', notebookDoc.id)
                      );
                      const conceptsSnapshot = await getDocs(conceptsQuery);
                      actualConceptCount = conceptsSnapshot.size;
                      console.log(`📝 Conteo real de conceptos para ${data.title}: ${actualConceptCount}`);
                    } catch (error) {
                      console.error('Error contando conceptos:', error);
                      actualConceptCount = data.conceptCount || 0;
                    }
                    
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
                      conceptCount: actualConceptCount, // Usar el conteo real
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
    // Guardar información de la materia para poder volver
    if (materiaName && materia) {
      const materiaInfo = {
        materiaName: materiaName,
        materiaDisplayName: materia.nombre,
        materiaId: materiaId,
        timestamp: Date.now()
      };
      sessionStorage.setItem('schoolStudent_previousMateria', JSON.stringify(materiaInfo));
      console.log('💾 GUARDANDO información de materia para navegación:');
      console.log('  - materiaName:', materiaName);
      console.log('  - materiaDisplayName:', materia.nombre);
      console.log('  - materiaId:', materiaId);
      console.log('  - timestamp:', new Date(Date.now()).toLocaleString());
      console.log('  - Datos completos:', materiaInfo);
      
      // Verificar que se guardó correctamente
      const saved = sessionStorage.getItem('schoolStudent_previousMateria');
      console.log('✅ VERIFICACIÓN - Datos guardados en sessionStorage:', saved);
    } else {
      console.error('❌ ERROR: No se puede guardar - materiaName:', materiaName, 'materia:', materia);
    }
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

  // Convertir notebooks a formato compatible con NotebookList
  const formattedNotebooks = notebooks.map(notebook => ({
    id: notebook.id,
    title: notebook.title,
    color: notebook.color,
    category: '', // Los estudiantes no manejan categorías
    userId: user?.uid || '',
    createdAt: notebook.createdAt?.toDate ? notebook.createdAt.toDate() : new Date(notebook.createdAt),
    updatedAt: notebook.updatedAt?.toDate ? notebook.updatedAt.toDate() : new Date(notebook.updatedAt),
    conceptCount: notebook.conceptCount || 0,
    domainProgress: notebook.domainProgress,
    isStudent: true,
    isFrozen: notebook.isFrozen,
    frozenScore: notebook.frozenScore,
    frozenAt: notebook.frozenAt?.toDate ? notebook.frozenAt.toDate() : notebook.frozenAt
  }));

  return (
    <>
      <HeaderWithHamburger
        title={materia.nombre}
        subtitle={`Cuadernos disponibles`}
        showBackButton={true}
        onBackClick={() => navigate('/materias')}
        themeColor={materia.color || "#6147FF"}
      />
      
      {/* Usar el mismo layout que usuarios free/pro */}
      <main className="notebooks-main notebooks-main-no-sidebar">
        <div className="notebooks-list-section notebooks-list-section-full">
          <NotebookList 
            notebooks={formattedNotebooks}
            onDeleteNotebook={undefined} // Estudiantes no pueden eliminar
            onEditNotebook={undefined}   // Estudiantes no pueden editar
            onColorChange={undefined}    // Estudiantes no pueden cambiar color
            onCreateNotebook={undefined} // Estudiantes no pueden crear
            onAddConcept={undefined}     // Estudiantes no pueden añadir conceptos
            showCreateButton={false}     // No mostrar botón de crear
            isSchoolTeacher={false}
            isSchoolNotebook={true}      // Usar navegación de cuaderno escolar
            selectedCategory={null}
            showCategoryModal={false}
            materiaColor={materia.color || "#6147FF"}
            materiaId={materiaId || undefined}
          />
        </div>
      </main>
    </>
  );
};

export default SchoolStudentMateriaPage;