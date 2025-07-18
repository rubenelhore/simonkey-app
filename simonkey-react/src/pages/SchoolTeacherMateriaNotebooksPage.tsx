import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotebookList from '../components/NotebookList';
import { db } from '../services/firebase';
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
}

const SchoolTeacherMateriaNotebooksPage: React.FC = () => {
  const navigate = useNavigate();
  const { materiaId } = useParams<{ materiaId: string }>();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [notebooks, setNotebooks] = useState<SchoolNotebook[]>([]);
  const [materia, setMateria] = useState<SchoolSubject | null>(null);
  const [loading, setLoading] = useState(true);
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
            color: materiaData.color || '#6147FF'
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
      const newNotebook = {
        title,
        color,
        type: 'school' as const,
        idMateria: materiaId,
        userId: user.uid,
        idProfesor: user.uid,
        idEscuela: userProfile?.idEscuela || userProfile?.schoolData?.idEscuela,
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
            />
        </div>
      </main>
      <footer className="notebooks-footer">
        <p>&copy; {new Date().getFullYear()} Simonkey - Sistema Escolar</p>
      </footer>
    </>
  );
};

export default SchoolTeacherMateriaNotebooksPage;