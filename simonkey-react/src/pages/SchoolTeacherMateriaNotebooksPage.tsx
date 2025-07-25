import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotebookList from '../components/NotebookList';
import CreateExamModal from '../components/CreateExamModal';
import { db, auth } from '../services/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, getDocs, query, where, collection, addDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';
import '../styles/Notebooks.css';
import '../styles/SchoolSystem.css';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useUserType } from '../hooks/useUserType';
import { UnifiedNotebookService } from '../services/unifiedNotebookService';
import { UnifiedConceptService } from '../services/unifiedConceptService';

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

const SchoolTeacherMateriaNotebooksPage: React.FC = () => {
  const navigate = useNavigate();
  const { materiaId } = useParams<{ materiaId: string }>();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [notebooks, setNotebooks] = useState<SchoolNotebook[]>([]);
  const [materia, setMateria] = useState<SchoolSubject | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [exams, setExams] = useState<any[]>([]);
  const [userData, setUserData] = useState({
    nombre: '',
    apellidos: '',
    tipoAprendizaje: 'Visual',
    intereses: ['educación']
  });
  const { isSchoolTeacher } = useUserType();
  
  // Debug logs
  console.log('🔍 SchoolTeacherMateriaNotebooksPage - Debug:', {
    isSchoolTeacher,
    user: user?.uid,
    userProfile,
    materiaId,
    notebooksCount: notebooks.length
  });

  // Función para cargar exámenes
  const loadExams = async () => {
    if (!user || !materiaId) return;
    
    try {
      console.log('🔍 Buscando exámenes con:', {
        idMateria: materiaId,
        idProfesor: user.uid,
        collection: 'schoolExams'
      });
      
      const examsQuery = query(
        collection(db, 'schoolExams'),
        where('idMateria', '==', materiaId),
        where('idProfesor', '==', user.uid)
      );
      
      const examsSnapshot = await getDocs(examsQuery);
      console.log(`📊 Exámenes encontrados: ${examsSnapshot.size}`);
      
      const examsData = examsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📋 Examen cargado:', {
          id: doc.id,
          title: data.title,
          isActive: data.isActive,
          fields: Object.keys(data)
        });
        return {
          id: doc.id,
          ...data
        };
      });
      
      setExams(examsData);
      console.log('📝 Exámenes cargados:', examsData.length, 'exámenes');
      
      // Log detallado si no se encuentran exámenes
      if (examsData.length === 0) {
        console.log('⚠️ No se encontraron exámenes. Verificando todos los exámenes de la materia...');
        // Query solo por materia para debug
        const allMateriaExamsQuery = query(
          collection(db, 'schoolExams'),
          where('idMateria', '==', materiaId)
        );
        const allExamsSnapshot = await getDocs(allMateriaExamsQuery);
        console.log(`📊 Total de exámenes en la materia ${materiaId}:`, allExamsSnapshot.size);
        
        allExamsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log('Examen encontrado:', {
            id: doc.id,
            title: data.title,
            idProfesor: data.idProfesor,
            idMateria: data.idMateria,
            isActive: data.isActive
          });
        });
      }
    } catch (error: any) {
      console.error('❌ Error cargando exámenes:', error);
      if (error?.code === 'failed-precondition') {
        console.error('🔧 Se requiere un índice compuesto en Firestore. Revisa la consola de Firebase.');
      }
    }
  };

  // Cargar datos de la materia y sus cuadernos
  useEffect(() => {
    const loadMateriaAndNotebooks = async () => {
      if (!user || !materiaId) return;
      
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

        // Cargar cuadernos de la materia usando el servicio unificado
        const unifiedNotebooks = await UnifiedNotebookService.getTeacherNotebooks([materiaId]);
        const notebooksData: SchoolNotebook[] = [];
        
        for (const notebook of unifiedNotebooks) {
          // Contar conceptos usando el servicio unificado
          const conceptCount = await UnifiedConceptService.getConceptCount(notebook.id);
          
          notebooksData.push({
            id: notebook.id,
            title: notebook.title,
            color: notebook.color || '#6147FF',
            idMateria: notebook.idMateria || materiaId,
            userId: notebook.userId,
            createdAt: notebook.createdAt,
            updatedAt: notebook.updatedAt,
            conceptCount: conceptCount,
            isFrozen: notebook.isFrozen,
            frozenScore: notebook.frozenScore,
            frozenAt: notebook.frozenAt
          });
        }
        
        // Ordenar por fecha de actualización
        notebooksData.sort((a, b) => {
          const aTime = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
          const bTime = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        
        setNotebooks(notebooksData);
        
        // Cargar exámenes también
        await loadExams();
      } catch (err) {
        console.error('Error loading materia and notebooks:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadMateriaAndNotebooks();
  }, [user, materiaId]);

  // Cargar datos del usuario
  useEffect(() => {
    const loadUserData = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userName = data.nombre || data.displayName || data.username || user.displayName || '';
            
            setUserData({
              nombre: userName,
              apellidos: data.apellidos || '',
              tipoAprendizaje: data.tipoAprendizaje || 'Visual',
              intereses: data.intereses && data.intereses.length > 0 ? data.intereses : ['educación']
            });
          }
        } catch (error) {
          console.error("Error loading user data:", error);
        }
      }
    };
    
    loadUserData();
  }, [user]);

  // Los profesores SÍ pueden crear cuadernos
  const handleCreate = async (title?: string, color?: string) => {
    if (!user || !materiaId || !title || !color) return;
    
    try {
      // Debug logging
      console.log("🔍 Debug handleCreate:");
      console.log("userProfile:", userProfile);
      console.log("userProfile?.idEscuela:", userProfile?.idEscuela);
      console.log("userProfile?.schoolData:", userProfile?.schoolData);
      
      // Verificar el token del usuario
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdTokenResult();
        console.log("🔐 Token claims:", token.claims);
        console.log("🔐 Token roles:", token.claims.roles);
        console.log("🔐 Token schoolRole:", token.claims.schoolRole);
      }
      
      // Obtener idEscuela del documento del usuario si no está en userProfile
      let idEscuela = userProfile?.idEscuela || userProfile?.schoolData?.idEscuela;
      
      if (!idEscuela && user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          idEscuela = userData.idEscuela || userData.schoolData?.idEscuela;
          console.log("📚 idEscuela desde usuario:", idEscuela);
        }
      }
      
      // Si aún no tenemos idEscuela, obtenerlo de la materia
      if (!idEscuela && materia) {
        idEscuela = materia.idEscuela;
        console.log("🏫 idEscuela desde materia:", idEscuela);
      }
      
      // Si todavía no lo tenemos, intentar obtenerlo directamente del documento de la materia
      if (!idEscuela && materiaId) {
        const materiaDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
        if (materiaDoc.exists()) {
          idEscuela = materiaDoc.data().idEscuela;
          console.log("📖 idEscuela desde documento materia:", idEscuela);
        }
      }
      
      if (!idEscuela) {
        console.error("❌ No se encontró idEscuela");
        alert("Error: No se pudo identificar la escuela. Por favor, contacte al administrador.");
        return;
      }
      
      const newNotebook = {
        title,
        color,
        type: 'school' as const,
        idMateria: materiaId,
        userId: user.uid,
        idProfesor: user.uid,
        idEscuela: idEscuela,
        descripcion: ''
      };
      
      const notebookId = await UnifiedNotebookService.createNotebook(newNotebook);
      console.log("Cuaderno escolar creado con ID:", notebookId);
      
      // SINCRONIZACIÓN AUTOMÁTICA: Asignar el cuaderno a todos los estudiantes de esta materia
      try {
        // Buscar todos los estudiantes que tienen esta materia en su array subjectIds
        const studentsQuery = query(
          collection(db, 'users'),
          where('subscription', '==', 'school'),
          where('schoolRole', '==', 'student'),
          where('subjectIds', 'array-contains', materiaId)
        );
        
        const studentsSnapshot = await getDocs(studentsQuery);
        console.log(`🎯 Encontrados ${studentsSnapshot.size} estudiantes en la materia`);
        
        // Actualizar cada estudiante agregando el nuevo cuaderno
        const updatePromises = studentsSnapshot.docs.map(async (studentDoc) => {
          const studentData = studentDoc.data();
          const currentNotebooks = studentData.idCuadernos || [];
          
          if (!currentNotebooks.includes(notebookId)) {
            currentNotebooks.push(notebookId);
            await updateDoc(doc(db, 'users', studentDoc.id), {
              idCuadernos: currentNotebooks,
              updatedAt: serverTimestamp()
            });
            console.log(`✅ Cuaderno asignado a estudiante: ${studentData.nombre}`);
          }
        });
        
        await Promise.all(updatePromises);
        console.log('📚 Sincronización completada: cuaderno asignado a todos los estudiantes');
      } catch (syncError) {
        console.error('⚠️ Error sincronizando con estudiantes:', syncError);
        // No interrumpir el flujo principal si falla la sincronización
      }
      
      // Recargar los cuadernos usando el servicio unificado
      const unifiedNotebooks = await UnifiedNotebookService.getTeacherNotebooks([materiaId]);
      const notebooksData: SchoolNotebook[] = [];
      
      for (const notebook of unifiedNotebooks) {
        // Contar conceptos usando el servicio unificado
        const conceptCount = await UnifiedConceptService.getConceptCount(notebook.id);
        
        notebooksData.push({
          id: notebook.id,
          title: notebook.title,
          color: notebook.color || '#6147FF',
          idMateria: notebook.idMateria || materiaId,
          userId: notebook.userId,
          createdAt: notebook.createdAt,
          updatedAt: notebook.updatedAt,
          conceptCount: conceptCount,
          isFrozen: notebook.isFrozen,
          frozenScore: notebook.frozenScore,
          frozenAt: notebook.frozenAt
        });
      }
      
      // Ordenar por fecha de actualización
      notebooksData.sort((a, b) => {
        const aTime = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
        const bTime = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      
      setNotebooks(notebooksData);
    } catch (error) {
      console.error("Error creando cuaderno escolar:", error);
      alert("Error al crear el cuaderno");
    }
  };

  // Los profesores SÍ pueden eliminar cuadernos
  const handleDelete = async (id: string) => {
    try {
      // SINCRONIZACIÓN AUTOMÁTICA: Primero remover el cuaderno de todos los estudiantes
      try {
        // Buscar todos los estudiantes que tienen este cuaderno
        const studentsQuery = query(
          collection(db, 'users'),
          where('subscription', '==', 'school'),
          where('schoolRole', '==', 'student'),
          where('idCuadernos', 'array-contains', id)
        );
        
        const studentsSnapshot = await getDocs(studentsQuery);
        console.log(`🎯 Encontrados ${studentsSnapshot.size} estudiantes con este cuaderno`);
        
        // Actualizar cada estudiante removiendo el cuaderno
        const updatePromises = studentsSnapshot.docs.map(async (studentDoc) => {
          const studentData = studentDoc.data();
          const currentNotebooks = studentData.idCuadernos || [];
          const updatedNotebooks = currentNotebooks.filter((nbId: string) => nbId !== id);
          
          await updateDoc(doc(db, 'users', studentDoc.id), {
            idCuadernos: updatedNotebooks,
            updatedAt: serverTimestamp()
          });
          console.log(`✅ Cuaderno removido de estudiante: ${studentData.nombre}`);
        });
        
        await Promise.all(updatePromises);
        console.log('📚 Sincronización completada: cuaderno removido de todos los estudiantes');
      } catch (syncError) {
        console.error('⚠️ Error sincronizando con estudiantes:', syncError);
        // No interrumpir el flujo principal si falla la sincronización
      }
      
      // Ahora eliminar todos los conceptos del cuaderno usando el servicio unificado
      const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(id);
      const conceptsQuery = query(
        collection(db, conceptsCollection),
        where('cuadernoId', '==', id)
      );
      const conceptsSnapshot = await getDocs(conceptsQuery);
      
      // Eliminar cada documento de conceptos
      for (const conceptDoc of conceptsSnapshot.docs) {
        await deleteDoc(doc(db, conceptsCollection, conceptDoc.id));
      }
      
      // Finalmente eliminar el cuaderno usando el servicio unificado
      await UnifiedNotebookService.deleteNotebook(id);
      console.log("Cuaderno escolar eliminado");
      
      // Actualizar el estado local
      setNotebooks(prevNotebooks => prevNotebooks.filter(nb => nb.id !== id));
    } catch (error) {
      console.error("Error eliminando cuaderno escolar:", error);
      alert("Error al eliminar el cuaderno");
    }
  };

  // Los profesores SÍ pueden editar el título del cuaderno
  const handleEdit = async (id: string, newTitle: string) => {
    try {
      await UnifiedNotebookService.updateNotebook(id, { 
        title: newTitle
      });
      console.log("Título del cuaderno escolar actualizado");
      
      // Actualizar el estado local
      setNotebooks(prevNotebooks => 
        prevNotebooks.map(nb => 
          nb.id === id ? { ...nb, title: newTitle } : nb
        )
      );
    } catch (error) {
      console.error("Error actualizando el título del cuaderno escolar:", error);
      alert("Error al actualizar el título del cuaderno");
    }
  };

  // Los profesores SÍ pueden cambiar el color del cuaderno
  const handleColorChange = async (id: string, newColor: string) => {
    try {
      await UnifiedNotebookService.updateNotebook(id, {
        color: newColor
      });
      console.log("Color del cuaderno escolar actualizado");
      
      // Actualizar el estado local
      setNotebooks(prevNotebooks => 
        prevNotebooks.map(nb => 
          nb.id === id ? { ...nb, color: newColor } : nb
        )
      );
    } catch (error) {
      console.error("Error updating school notebook color:", error);
      alert("Error al actualizar el color del cuaderno");
    }
  };

  const handleFreezeNotebook = async (id: string, type: 'now' | 'scheduled', scheduledDate?: Date) => {
    try {
      const notebook = notebooks.find(n => n.id === id);
      if (!notebook) return;

      let calculatedScore = 0; // Variable para el score calculado
      
      if (notebook.isFrozen) {
        // Descongelar
        if (type === 'now') {
          await UnifiedNotebookService.updateNotebook(id, {
            isFrozen: false,
            frozenScore: undefined,
            frozenAt: undefined,
            scheduledUnfreezeAt: undefined
          });
        } else if (type === 'scheduled' && scheduledDate) {
          // Programar descongelación
          await UnifiedNotebookService.updateNotebook(id, {
            scheduledUnfreezeAt: Timestamp.fromDate(scheduledDate)
          });
        }
      } else {
        // Congelar
        // Primero calcular el score actual de todos los estudiantes
        const studentsQuery = query(
          collection(db, 'learningData'),
          where('cuadernoId', '==', id)
        );
        
        const learningDataSnapshot = await getDocs(studentsQuery);
        let totalScore = 0;
        const studentScores = new Map<string, number>();
        
        learningDataSnapshot.forEach((doc) => {
          const data = doc.data();
          const score = data.efactor || 2.5; // Factor SM-3
          const userId = data.usuarioId;
          
          if (!studentScores.has(userId)) {
            studentScores.set(userId, 0);
          }
          studentScores.set(userId, studentScores.get(userId)! + score);
        });
        
        // Calcular promedio
        if (studentScores.size > 0) {
          studentScores.forEach(score => totalScore += score);
          totalScore = totalScore / studentScores.size;
        }
        
        calculatedScore = totalScore; // Guardar el score calculado
        
        if (type === 'now') {
          await UnifiedNotebookService.updateNotebook(id, {
            isFrozen: true,
            frozenScore: totalScore,
            frozenAt: Timestamp.now(),
            scheduledFreezeAt: undefined
          });
        } else if (type === 'scheduled' && scheduledDate) {
          // Programar congelación
          await UnifiedNotebookService.updateNotebook(id, {
            scheduledFreezeAt: Timestamp.fromDate(scheduledDate)
          });
        }
      }
      
      // Actualizar localmente
      setNotebooks(prev => prev.map(n => 
        n.id === id ? { 
          ...n, 
          isFrozen: !n.isFrozen,
          frozenScore: !n.isFrozen ? calculatedScore : undefined,
          frozenAt: !n.isFrozen ? new Date() : undefined
        } : n
      ));
      
      console.log('✅ Notebook freeze state updated successfully');
    } catch (error) {
      console.error("Error updating notebook freeze state:", error);
      alert('Error al actualizar el estado del cuaderno. Por favor, intenta de nuevo.');
    }
  };

  const handleBack = () => {
    navigate('/school/teacher');
  };

  if (loading || authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando cuadernos...</p>
      </div>
    );
  }

  if (!isSchoolTeacher) {
    navigate('/');
    return null;
  }

  return (
    <>
      <HeaderWithHamburger
        title={materia ? materia.nombre : "Cuadernos"}
        subtitle={`Cuadernos de la materia - ${userData.nombre || 'Profesor'}`}
        showBackButton={true}
        onBackClick={handleBack}
        themeColor={materia?.color}
      />
      <main className="notebooks-main-no-sidebar">
        <div className="notebooks-list-section-full">
          <NotebookList 
            notebooks={notebooks.map((notebook) => ({
                id: notebook.id,
                title: notebook.title,
                color: notebook.color,
                userId: notebook.userId || '',
                createdAt: notebook.createdAt instanceof Date ? 
                  notebook.createdAt : 
                  (notebook.createdAt && typeof notebook.createdAt.toDate === 'function' ? 
                    notebook.createdAt.toDate() : 
                    new Date()),
                updatedAt: notebook.updatedAt instanceof Date ? 
                  notebook.updatedAt : 
                  (notebook.updatedAt && typeof notebook.updatedAt.toDate === 'function' ? 
                    notebook.updatedAt.toDate() : 
                    new Date()),
                conceptCount: notebook.conceptCount || 0,
                isFrozen: notebook.isFrozen,
                frozenScore: notebook.frozenScore,
                frozenAt: notebook.frozenAt
              }))} 
              onDeleteNotebook={handleDelete} 
              onEditNotebook={handleEdit}
              onColorChange={handleColorChange}
              onCreateNotebook={handleCreate}
              showCreateButton={true}
              isSchoolTeacher={true}
              materiaColor={materia?.color}
              onFreezeNotebook={handleFreezeNotebook}
              showExamButton={true}
              onCreateExam={() => setIsExamModalOpen(true)}
              examButtonDisabled={notebooks.length === 0}
              examButtonTitle={notebooks.length === 0 ? "Necesitas crear cuadernos primero" : ""}
            />
            
            {/* Sección de Exámenes */}
            {exams.length > 0 && (
              <div className="exams-section" style={{ marginTop: '4rem', padding: '0 1rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
                  <i className="fas fa-file-alt" style={{ marginRight: '0.5rem', fontSize: '1rem' }}></i>
                  Exámenes Creados
                </h2>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                  gap: '1.5rem' 
                }}>
                  {exams.map(exam => (
                    <div 
                      key={exam.id} 
                      style={{
                        background: 'white',
                        border: '2px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = materia?.color || '#6147FF';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
                          {exam.title}
                        </h3>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: exam.isActive ? '#d1fae5' : '#fee2e2',
                          color: exam.isActive ? '#065f46' : '#dc2626'
                        }}>
                          {exam.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {exam.description && (
                        <p style={{ margin: '0.5rem 0', color: '#6b7280', fontSize: '0.95rem' }}>
                          {exam.description}
                        </p>
                      )}
                      <div style={{ 
                        display: 'flex', 
                        gap: '1rem', 
                        marginTop: '1rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        <span>
                          <i className="fas fa-question-circle" style={{ marginRight: '0.25rem' }}></i>
                          {exam.questionsPerStudent} preguntas
                        </span>
                        <span>
                          <i className="fas fa-clock" style={{ marginRight: '0.25rem' }}></i>
                          {exam.timePerConcept}s por pregunta
                        </span>
                      </div>
                      <button
                        style={{
                          marginTop: '1rem',
                          width: '100%',
                          padding: '0.75rem',
                          background: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('🚀 Navegando a dashboard del examen:', exam.id);
                          console.log('📍 Ruta completa:', `/exam/${exam.id}/dashboard`);
                          console.log('📊 Datos del examen:', exam);
                          try {
                            navigate(`/exam/${exam.id}/dashboard`);
                            console.log('✅ Navigate ejecutado');
                          } catch (error) {
                            console.error('❌ Error al navegar:', error);
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                      >
                        Ver Dashboard
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </main>
      
      {materiaId && (
        <CreateExamModal
          isOpen={isExamModalOpen}
          onClose={() => setIsExamModalOpen(false)}
          materiaId={materiaId}
          notebooks={notebooks.map(nb => ({
            id: nb.id,
            title: nb.title,
            conceptCount: nb.conceptCount || 0
          }))}
          onExamCreated={() => {
            console.log('Examen creado exitosamente');
            loadExams(); // Recargar la lista de exámenes
          }}
        />
      )}
    </>
  );
};

export default SchoolTeacherMateriaNotebooksPage;