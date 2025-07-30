// src/pages/Materias.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import '../styles/Materias.css';
import '../styles/AdminMaterias.css';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import CategoryDropdown from '../components/CategoryDropdown';
import MateriaList from '../components/MateriaList';
import { useAutoMigration } from '../hooks/useAutoMigration';
import { useSchoolStudentData } from '../hooks/useSchoolStudentData';

interface Materia {
  id: string;
  title: string;
  color: string;
  category?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  notebookCount?: number;
}

const Materias: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  const { isSchoolUser, isSchoolStudent, isSchoolAdmin, isSchoolTeacher } = useUserType();
  const { migrationStatus, migrationMessage } = useAutoMigration();
  const { schoolSubjects, schoolNotebooks, loading: schoolLoading } = useSchoolStudentData();
  
  // Logs comentados para reducir ruido
  // console.log('📚 Materias.tsx - Estado actual:');
  // console.log('📚 user:', user);
  // console.log('📚 userProfile:', userProfile);
  // console.log('📚 isSchoolStudent:', isSchoolStudent);
  // console.log('📚 schoolSubjects:', schoolSubjects);
  // console.log('📚 schoolLoading:', schoolLoading);

  // Estados para el componente de personalización
  const [userData, setUserData] = useState({
    nombre: '',
    apellidos: '',
    tipoAprendizaje: 'Visual',
    intereses: ['tecnología']
  });

  // Estados para la vista de admin
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [adminMaterias, setAdminMaterias] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [examsByMateria, setExamsByMateria] = useState<Record<string, any[]>>({});
  const [newMateriaTitle, setNewMateriaTitle] = useState('');
  const [newMateriaColor, setNewMateriaColor] = useState('#6147FF');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [institutionName, setInstitutionName] = useState<string>('');
  
  // Color presets para las materias
  const colorPresets = [
    '#6147FF', '#FF6B6B', '#4CAF50', '#FFD700', '#FF8C00', '#9C27B0'
  ];

  // Cargar materias del usuario
  useEffect(() => {
    const loadMaterias = async () => {
      if (!user) return;
      if (isSchoolStudent) {
        // Para estudiantes escolares, no cargar materias regulares
        return;
      }
      setLoading(true);
      try {
        // Query optimizada: solo una lectura para materias
        const materiasQuery = query(
          collection(db, 'materias'),
          where('userId', '==', user.uid)
        );
        const materiasSnap = await getDocs(materiasQuery);
        const materiasData: Materia[] = materiasSnap.docs.map(docSnap => ({
          id: docSnap.id,
          title: docSnap.data().title,
          color: docSnap.data().color || '#6147FF',
          category: docSnap.data().category,
          userId: docSnap.data().userId,
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
          notebookCount: 0 // Will be calculated below
        }));

        // Calculate notebook count for each materia
        for (const materia of materiasData) {
          try {
            const notebooksQuery = query(
              collection(db, 'notebooks'),
              where('userId', '==', user.uid),
              where('materiaId', '==', materia.id)
            );
            const notebooksSnap = await getDocs(notebooksQuery);
            materia.notebookCount = notebooksSnap.size;
          } catch (error) {
            console.error(`Error counting notebooks for materia ${materia.id}:`, error);
            materia.notebookCount = 0;
          }
        }

        setMaterias(materiasData);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    loadMaterias();
  }, [user, refreshTrigger, isSchoolStudent]);

  // Función para cargar exámenes de estudiante
  const loadStudentExams = async () => {
    if (!user || !isSchoolStudent || !schoolSubjects || schoolSubjects.length === 0 || !userProfile) return;
    
    try {
      const examsData: Record<string, any[]> = {};
      
      // Obtener el ID de la escuela del estudiante
      const studentSchoolId = userProfile.idEscuela || userProfile.schoolData?.idEscuela;
      
      if (!studentSchoolId) {
        console.warn('⚠️ Estudiante sin escuela asignada, no se pueden cargar exámenes');
        return;
      }
      
      console.log('🏫 Cargando exámenes para escuela:', studentSchoolId);
      
      // Para cada materia, buscar exámenes activos
      for (const subject of schoolSubjects) {
        try {
          // Hacer la consulta más simple para evitar el error de índices
          const examsQuery = query(
            collection(db, 'schoolExams'),
            where('idMateria', '==', subject.id),
            where('isActive', '==', true)
          );
          
          const examsSnapshot = await getDocs(examsQuery);
          
          // Filtrar manualmente por escuela
          const materiaExams = examsSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .filter((exam: any) => exam.idEscuela === studentSchoolId);
          
          if (materiaExams.length > 0) {
            examsData[subject.id] = materiaExams;
          }
        } catch (queryError) {
          console.error(`Error consultando exámenes para materia ${subject.id}:`, queryError);
          // Continuar con la siguiente materia
        }
      }
      
      setExamsByMateria(examsData);
      console.log('📝 Exámenes cargados para estudiante:', examsData);
    } catch (error) {
      console.error('Error cargando exámenes del estudiante:', error);
    }
  };

  // Efecto específico para estudiantes escolares
  useEffect(() => {
    if (isSchoolStudent) {
      if (!schoolLoading) {
        if (schoolSubjects && schoolSubjects.length > 0) {
          const schoolMateriasData: Materia[] = schoolSubjects.map(subject => {
            const notebookCount = schoolNotebooks 
              ? schoolNotebooks.filter(notebook => notebook.idMateria === subject.id).length 
              : 0;
            
            return {
              id: subject.id,
              title: subject.nombre,
              color: subject.color || '#6147FF',
              category: '',
              userId: user?.uid || '',
              createdAt: subject.createdAt?.toDate() || new Date(),
              updatedAt: subject.createdAt?.toDate() || new Date(),
              notebookCount: notebookCount
            };
          });
          
          setMaterias(schoolMateriasData);
          // Cargar exámenes después de establecer las materias
          loadStudentExams();
        } else {
          // Si no hay materias, establecer un array vacío
          setMaterias([]);
        }
        // Siempre establecer loading a false cuando schoolLoading es false
        setLoading(false);
      }
    }
  }, [isSchoolStudent, schoolSubjects, schoolNotebooks, schoolLoading, user, userProfile]);

  // Cargar datos del usuario
  useEffect(() => {
    if (userProfile) {
      setUserData({
        nombre: userProfile.nombre || userProfile.displayName || '',
        apellidos: '',
        tipoAprendizaje: 'Visual',
        intereses: userProfile.interests || ['']
      });
    }
  }, [userProfile]);

  // Cargar información de la institución para estudiantes escolares
  useEffect(() => {
    const loadInstitutionInfo = async () => {
      if (!isSchoolStudent || !userProfile) return;
      
      try {
        // Buscar información del admin usando el idAdmin del estudiante
        if (userProfile.idAdmin) {
          const adminDoc = await getDoc(doc(db, 'users', userProfile.idAdmin));
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            // Buscar el nombre de la institución en el perfil del admin
            const institutionName = adminData.institutionName || adminData.schoolName || adminData.institucionName || adminData.nombre || 'Institución Educativa';
            setInstitutionName(institutionName);
          }
        }
      } catch (error) {
        console.error('Error loading institution info:', error);
        setInstitutionName('Institución Educativa');
      }
    };
    
    loadInstitutionInfo();
  }, [isSchoolStudent, userProfile]);

  // Cargar profesores y estudiantes para admin
  useEffect(() => {
    const loadAdminData = async () => {
      if (!isSchoolAdmin || !userProfile) return;
      
      try {
        const adminId = userProfile.id || user?.uid;
        
        // Cargar profesores asignados al admin
        const teachersQuery = query(
          collection(db, 'users'),
          where('subscription', '==', 'school'),
          where('schoolRole', '==', 'teacher'),
          where('idAdmin', '==', adminId)
        );
        
        const teachersSnapshot = await getDocs(teachersQuery);
        const teachersData = teachersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setTeachers(teachersData);
        
        // Cargar estudiantes asignados al admin
        const studentsQuery = query(
          collection(db, 'users'),
          where('subscription', '==', 'school'),
          where('schoolRole', '==', 'student'),
          where('idAdmin', '==', adminId)
        );
        
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsData = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setStudents(studentsData);
      } catch (error) {
        console.error('Error loading admin data:', error);
      }
    };
    
    loadAdminData();
  }, [isSchoolAdmin, userProfile, user]);

  // Cargar y filtrar materias según profesor y estudiantes seleccionados
  useEffect(() => {
    const loadFilteredMaterias = async () => {
      if (!isSchoolAdmin || !userProfile) return;
      
      try {
        const adminId = userProfile.id || user?.uid;
        let materiasQuery;
        
        // Si hay un profesor seleccionado, filtrar por profesor
        if (selectedTeacher) {
          materiasQuery = query(
            collection(db, 'schoolSubjects'),
            where('idProfesor', '==', selectedTeacher),
            where('idAdmin', '==', adminId)
          );
        } else {
          // Si no hay profesor seleccionado, mostrar todas las materias del admin
          materiasQuery = query(
            collection(db, 'schoolSubjects'),
            where('idAdmin', '==', adminId)
          );
        }
        
        const materiasSnapshot = await getDocs(materiasQuery);
        let materiasData = await Promise.all(
          materiasSnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            
            // Obtener todos los estudiantes que tienen esta materia
            const studentsWithMateriaQuery = query(
              collection(db, 'users'),
              where('subscription', '==', 'school'),
              where('schoolRole', '==', 'student'),
              where('subjectIds', 'array-contains', docSnap.id)
            );
            
            const studentsWithMateriaSnapshot = await getDocs(studentsWithMateriaQuery);
            const studentIds = studentsWithMateriaSnapshot.docs.map(doc => doc.id);
            
            // Contar cuántos de los estudiantes seleccionados tienen esta materia
            const matchingStudentCount = selectedStudents.filter(studentId => 
              studentIds.includes(studentId)
            ).length;
            
            // Obtener el nombre del profesor
            const teacherDoc = await getDoc(doc(db, 'users', data.idProfesor));
            const teacherName = teacherDoc.exists() ? teacherDoc.data().nombre : 'Sin profesor';
            
            return {
              id: docSnap.id,
              title: data.nombre,
              color: data.color || '#6147FF',
              teacherName,
              teacherId: data.idProfesor,
              studentCount: studentIds.length,
              matchingStudentCount,
              studentIds,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
              notebookCount: 0 // Para compatibilidad con MateriaItem
            };
          })
        );
        
        // Si hay estudiantes seleccionados, filtrar solo las materias que incluyan TODOS los estudiantes seleccionados
        if (selectedStudents.length > 0) {
          materiasData = materiasData.filter(materia => {
            // La materia debe incluir TODOS los estudiantes seleccionados
            return selectedStudents.every(studentId => materia.studentIds.includes(studentId));
          });
        }
        
        // Ordenar por fecha de creación descendente
        materiasData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setAdminMaterias(materiasData);
        // console.log('📊 Admin materias cargadas:', materiasData.length, 'materias');
        // console.log('📊 Admin materias detalle:', materiasData);
      } catch (error) {
        console.error('Error loading filtered materias:', error);
      }
    };
    
    loadFilteredMaterias();
  }, [isSchoolAdmin, userProfile, user, selectedTeacher, selectedStudents, refreshTrigger]);

  const handleCreate = async (title: string, color: string, category?: string) => {
    // Los estudiantes escolares no pueden crear materias
    if (isSchoolStudent) return;
    if (!user) return;
    
    try {
      if (isSchoolAdmin) {
        // Para admin: crear materia escolar y asignar a profesor/estudiantes
        if (!selectedTeacher) {
          alert('Por favor selecciona un profesor para la materia');
          return;
        }
        
        const adminId = userProfile?.id || user.uid;
        
        // Crear la materia escolar
        const materiaRef = await addDoc(collection(db, 'schoolSubjects'), {
          nombre: title,
          color,
          idProfesor: selectedTeacher,
          idAdmin: adminId,
          idEscuela: userProfile?.idInstitucion || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        // Asignar la materia a los estudiantes seleccionados
        if (selectedStudents.length > 0) {
          for (const studentId of selectedStudents) {
            const studentRef = doc(db, 'users', studentId);
            const studentDoc = await getDoc(studentRef);
            
            if (studentDoc.exists()) {
              const studentData = studentDoc.data();
              const currentSubjectIds = studentData.subjectIds || [];
              
              if (!currentSubjectIds.includes(materiaRef.id)) {
                await updateDoc(studentRef, {
                  subjectIds: [...currentSubjectIds, materiaRef.id],
                  updatedAt: serverTimestamp()
                });
              }
            }
          }
        }
        
        // Recargar datos del admin
        setRefreshTrigger(prev => prev + 1);
      } else {
        // Para usuarios regulares
        await addDoc(collection(db, 'materias'), {
          title,
          color,
          category: category || '',
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error creating materia:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    // Los estudiantes escolares no pueden eliminar materias
    if (isSchoolStudent) return;
    try {
      // Determinar la colección correcta según el tipo de usuario
      const isSchoolMateria = isSchoolAdmin || isSchoolTeacher;
      const materiaCollection = isSchoolMateria ? 'schoolSubjects' : 'materias';
      const notebooksCollection = isSchoolMateria ? 'schoolNotebooks' : 'notebooks';
      const notebookField = isSchoolMateria ? 'idMateria' : 'materiaId';
      
      // Verificar si hay notebooks en esta materia
      const notebooksQuery = query(
        collection(db, notebooksCollection),
        where(notebookField, '==', id)
      );
      const notebooksSnapshot = await getDocs(notebooksQuery);
      
      if (notebooksSnapshot.size > 0) {
        const message = `Esta materia contiene ${notebooksSnapshot.size} cuaderno(s).\n\n` +
                       `¿Qué deseas hacer?\n\n` +
                       `ACEPTAR: Eliminar la materia Y todos sus cuadernos\n` +
                       `CANCELAR: No eliminar nada`;
        
        if (!window.confirm(message)) {
          return;
        }
        
        // Si el usuario acepta, eliminar todos los cuadernos de esta materia
        console.log(`Eliminando ${notebooksSnapshot.size} cuadernos de la materia...`);
        for (const notebookDoc of notebooksSnapshot.docs) {
          await deleteDoc(doc(db, notebooksCollection, notebookDoc.id));
          console.log(`Cuaderno ${notebookDoc.id} eliminado`);
        }
      }
      
      // Si es admin escolar, también necesitamos eliminar la referencia de la materia de los estudiantes
      if (isSchoolAdmin) {
        console.log('🗑️ Eliminando referencias de materia de los estudiantes...');
        const studentsQuery = query(
          collection(db, 'users'),
          where('subjectIds', 'array-contains', id)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        for (const studentDoc of studentsSnapshot.docs) {
          const studentData = studentDoc.data();
          const updatedSubjectIds = (studentData.subjectIds || []).filter((subId: string) => subId !== id);
          await updateDoc(doc(db, 'users', studentDoc.id), {
            subjectIds: updatedSubjectIds
          });
          console.log(`Materia removida del estudiante ${studentDoc.id}`);
        }
      }
      
      // Eliminar la materia
      await deleteDoc(doc(db, materiaCollection, id));
      console.log(`Materia ${id} eliminada de la colección ${materiaCollection}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting materia:', error);
      alert('Error al eliminar la materia. Por favor, intenta de nuevo.');
    }
  };

  const handleEdit = async (id: string, newTitle: string) => {
    // Los estudiantes escolares no pueden editar materias
    if (isSchoolStudent) return;
    if (!user) return;
    
    try {
      if (isSchoolAdmin || isSchoolTeacher) {
        // Para admin escolar o profesor: actualizar materia escolar
        const adminId = userProfile?.idAdmin || userProfile?.id || user.uid;
        
        // Verificar si ya existe una materia escolar con ese nombre
        const materiasQuery = query(
          collection(db, 'schoolSubjects'),
          where('idAdmin', '==', adminId),
          where('nombre', '==', newTitle)
        );
        const snapshot = await getDocs(materiasQuery);
        
        if (!snapshot.empty && snapshot.docs[0].id !== id) {
          throw new Error('Ya existe una materia con ese nombre');
        }
        
        // Actualizar la materia escolar en la colección correcta
        await updateDoc(doc(db, 'schoolSubjects', id), {
          nombre: newTitle,
          updatedAt: serverTimestamp()
        });
      } else {
        // Para usuarios regulares: actualizar materia regular
        const materiasQuery = query(
          collection(db, 'materias'),
          where('userId', '==', user?.uid),
          where('title', '==', newTitle)
        );
        const snapshot = await getDocs(materiasQuery);
        
        if (!snapshot.empty && snapshot.docs[0].id !== id) {
          throw new Error('Ya existe una materia con ese nombre');
        }
        
        await updateDoc(doc(db, 'materias', id), {
          title: newTitle,
          updatedAt: serverTimestamp()
        });
      }
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error updating materia:', error);
      throw error;
    }
  };

  const handleColorChange = async (id: string, newColor: string) => {
    // Los estudiantes escolares no pueden cambiar colores
    if (isSchoolStudent) return;
    if (!user) return;
    
    try {
      const isSchoolMateria = isSchoolAdmin || isSchoolTeacher;
      const materiaCollection = isSchoolMateria ? 'schoolSubjects' : 'materias';
      
      await updateDoc(doc(db, materiaCollection, id), {
        color: newColor,
        updatedAt: serverTimestamp()
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error updating materia color:', error);
    }
  };

  const handleView = (materiaId: string) => {
    // Find the materia to get its name
    // Si es admin, buscar en adminMaterias, si no en materias
    const materiasList = isSchoolAdmin ? adminMaterias : materias;
    const materia = materiasList.find(m => m.id === materiaId);
    if (!materia) return;
    
    // Los estudiantes escolares van a una página especial que muestra tanto notebooks como exámenes
    if (isSchoolStudent) {
      const encodedName = encodeURIComponent(materia.title);
      navigate(`/school/student/materia/${encodedName}`);
    } else if (isSchoolAdmin) {
      // Los admin navegan a la vista de notebooks del profesor
      navigate(`/school/teacher/materias/${materiaId}/notebooks`);
    } else {
      // Los demás usuarios navegan a la ruta normal usando el nombre de la materia
      const encodedName = encodeURIComponent(materia.title || materia.nombre);
      navigate(`/materias/${encodedName}/notebooks`);
    }
  };

  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
  };

  const handleCreateCategory = () => {
    setShowCategoryModal(true);
  };

  const handleClearSelectedCategory = () => {
    setSelectedCategory(null);
  };

  // Funciones para el modal
  const handleCreateMateria = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMateriaTitle.trim()) {
      setErrorMessage('Por favor, ingresa un título para la materia.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await handleCreate(newMateriaTitle.trim(), newMateriaColor);
      
      setNewMateriaTitle('');
      setNewMateriaColor('#6147FF');
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating materia:", error);
      if (error instanceof Error && error.message.includes('Ya existe')) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Error al crear la materia. Por favor, intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateMateria(e as any);
    } else if (e.key === 'Escape') {
      setShowCreateModal(false);
      setNewMateriaTitle('');
      setErrorMessage('');
    }
  };



  // Efecto para bloquear el body cuando el modal está abierto
  useEffect(() => {
    if (showCreateModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    // Cleanup al desmontar el componente
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCreateModal]);

  if (loading || authLoading) {
    // console.log('🔄 Materias - Mostrando loading:', { loading, authLoading });
    return (
      <div className="loading-container" style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem'
      }}>
        <FontAwesomeIcon icon={faSpinner} spin size="3x" style={{ color: '#6b7280' }} />
        <p style={{ fontSize: '1.1rem', margin: 0, color: '#6b7280' }}>Cargando materias...</p>
      </div>
    );
  }

  if (error) {
    console.error('❌ Materias - Error:', error);
    return (
      <div className="error-container">
        <h2>Error al cargar las materias</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  if (isSchoolAdmin) {
    // console.log('🎯 Renderizando vista admin con adminMaterias:', adminMaterias.length);
    // Vista especial para admin
    return (
      <>
        <HeaderWithHamburger
          title="Gestión de Mis Materias"
        />
        <main className="materias-main admin-view">
          <div className="admin-controls-section">
            {/* Selector de profesor */}
            <div className="admin-control-group">
              <label className="admin-control-label">Seleccionar Profesor</label>
              <select 
                className="admin-select"
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
              >
                <option value="">-- Selecciona un profesor --</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.nombre} - {teacher.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de estudiantes con checkboxes */}
            <div className="admin-control-group">
              <label className="admin-control-label">Seleccionar Estudiantes</label>
              <div className="students-selection-grid">
                {students.length === 0 ? (
                  <p className="no-students-message">No hay estudiantes asignados</p>
                ) : (
                  <>
                    <div className="select-all-container">
                      <label className="student-checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedStudents.length === students.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudents(students.map(s => s.id));
                            } else {
                              setSelectedStudents([]);
                            }
                          }}
                        />
                        <span>Seleccionar todos ({students.length})</span>
                      </label>
                    </div>
                    <div className="students-checkbox-list">
                      {students.map(student => (
                        <label key={student.id} className="student-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudents([...selectedStudents, student.id]);
                              } else {
                                setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                              }
                            }}
                          />
                          <span className="student-info">
                            <span className="student-name">{student.nombre}</span>
                            <span className="student-email">{student.email}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {selectedStudents.length > 0 && (
                <p className="selected-count">{selectedStudents.length} estudiante(s) seleccionado(s)</p>
              )}
            </div>
          </div>

          {/* Lista de materias */}
          <div className="materias-list-section">
            <MateriaList 
              materias={adminMaterias}
              onDeleteMateria={handleDelete}
              onEditMateria={handleEdit}
              onColorChange={handleColorChange}
              onCreateMateria={handleCreate}
              onViewMateria={handleView}
              showCreateButton={!!selectedTeacher && selectedStudents.length > 0}
              selectedCategory={null}
              showCreateModal={showCreateModal}
              setShowCreateModal={setShowCreateModal}
              showCategoryModal={false}
              onCloseCategoryModal={() => {}}
              onClearSelectedCategory={() => {}}
              onRefreshCategories={() => setRefreshTrigger(prev => prev + 1)}
              isAdminView={true}
            />
            {selectedTeacher && selectedStudents.length > 0 && adminMaterias.length === 0 && (
              <div className="no-materias-message">
                <i className="fas fa-info-circle"></i>
                <p>No hay materias que incluyan al profesor seleccionado y todos los estudiantes seleccionados.</p>
                <p className="hint">Crea una nueva materia para asignarla a estos estudiantes.</p>
              </div>
            )}
          </div>
        </main>
      </>
    );
  }

  // Vista normal para usuarios regulares y estudiantes
  // console.log('🎨 Materias - Renderizando vista normal');
  // console.log('  - materias:', materias.length);
  // console.log('  - userData:', userData);
  // console.log('  - isSchoolStudent:', isSchoolStudent);
  // console.log('  - userProfile:', userProfile);
  
  return (
    <>
      <HeaderWithHamburger
        title="Mis Materias"
      />
      {/* Notificación de migración */}
      {migrationStatus && migrationMessage && (
        <div className={`migration-notification ${migrationStatus}`}>
          <div className="migration-notification-content">
            {migrationStatus === 'checking' && <span className="loading-spinner">⏳</span>}
            {migrationStatus === 'migrating' && <span className="loading-spinner">🔄</span>}
            {migrationStatus === 'completed' && <span className="icon">✅</span>}
            {migrationStatus === 'error' && <span className="icon">❌</span>}
            <span className="message">{migrationMessage}</span>
          </div>
        </div>
      )}
      <main className="materias-main">
        <div className="materias-list-section">
          {materias.length === 0 ? (
            <>
              <div className="empty-state-container enhanced">
                <div className="background-decoration">
                  <div className="circle circle-1"></div>
                  <div className="circle circle-2"></div>
                  <div className="circle circle-3"></div>
                </div>
                
                <div className="empty-state-illustration">
                  <div className="book-stack">
                    <div className="book book-1">
                      <div className="book-spine"></div>
                      <div className="book-pages"></div>
                    </div>
                    <div className="book book-2">
                      <div className="book-spine"></div>
                      <div className="book-pages"></div>
                    </div>
                    <div className="book book-3">
                      <div className="book-spine"></div>
                      <div className="book-pages"></div>
                    </div>
                    <div className="pencil">
                      <div className="pencil-body"></div>
                      <div className="pencil-tip"></div>
                    </div>
                  </div>
                </div>
                
                <div className="empty-state-content">
                  <div className="badge-new">¡Nuevo estudiante!</div>
                  <h2 className="empty-state-title gradient-text">
                    Organiza tu conocimiento,<br/>
                    <span className="highlight">domina tu aprendizaje</span>
                  </h2>
                  
                  <div className="empty-state-actions">
                    <button className="create-materia-button primary pulse" onClick={() => {
                      setShowCreateModal(true);
                    }}>
                      <div className="button-bg"></div>
                      <span className="button-content">
                        <i className="fas fa-plus"></i>
                        Crear mi primera materia
                      </span>
                    </button>
                    
                    <div className="quick-suggestions enhanced">
                      <span className="suggestions-label">
                        <i className="fas fa-lightbulb"></i>
                        Sugerencias de Mis Materias
                      </span>
                      <div className="suggestion-cards">
                        <button className="suggestion-card" onClick={() => {
                          setShowCreateModal(true);
                        }}>
                          <div className="card-bg" style={{background: 'linear-gradient(135deg, #6147FF, #8B5DFF)'}}></div>
                          <div className="card-content">
                            <span className="card-emoji">📐</span>
                            <span className="card-title">Cálculo Diferencial</span>
                            <span className="card-subtitle">Derivadas y límites</span>
                          </div>
                        </button>
                        
                        <button className="suggestion-card" onClick={() => {
                          setShowCreateModal(true);
                        }}>
                          <div className="card-bg" style={{background: 'linear-gradient(135deg, #4CAF50, #66BB6A)'}}></div>
                          <div className="card-content">
                            <span className="card-emoji">⚗️</span>
                            <span className="card-title">Química Orgánica</span>
                            <span className="card-subtitle">Compuestos y reacciones</span>
                          </div>
                        </button>
                        
                        <button className="suggestion-card" onClick={() => {
                          setShowCreateModal(true);
                        }}>
                          <div className="card-bg" style={{background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)'}}></div>
                          <div className="card-content">
                            <span className="card-emoji">🏛️</span>
                            <span className="card-title">Historia Universal</span>
                            <span className="card-subtitle">Civilizaciones y guerras</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <MateriaList 
              materias={materias}
              onDeleteMateria={isSchoolStudent ? undefined : handleDelete}
              onEditMateria={isSchoolStudent ? undefined : handleEdit}
              onColorChange={isSchoolStudent ? undefined : handleColorChange}
              onCreateMateria={isSchoolStudent ? undefined : handleCreate}
              onViewMateria={handleView}
              showCreateButton={!isSchoolStudent}
              selectedCategory={null}
              showCreateModal={showCreateModal}
              setShowCreateModal={setShowCreateModal}
              examsByMateria={examsByMateria}
              isSchoolStudent={isSchoolStudent}
              showCategoryModal={showCategoryModal}
              onCloseCategoryModal={() => setShowCategoryModal(false)}
              onClearSelectedCategory={handleClearSelectedCategory}
              onRefreshCategories={() => setRefreshTrigger(prev => prev + 1)}
            />
          )}
        </div>
      </main>
      
      {/* Modal para crear nueva materia */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content create-materia-modal-new" onClick={(e) => e.stopPropagation()}>
            {/* Header simplificado */}
            <div className="modal-header-simple">
              <button 
                className="close-button-simple" 
                onClick={() => {
                  setShowCreateModal(false);
                  setNewMateriaTitle('');
                  setErrorMessage('');
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            {/* Contenido principal */}
            <div className="modal-main-content">
              <div className="modal-icon">
                <i className="fas fa-book" style={{ color: '#6147FF', fontSize: '2.5rem' }}></i>
              </div>
              <h2 className="modal-title">Nueva Materia</h2>
              <p className="modal-subtitle">Crea una nueva materia para organizar tus estudios</p>
              
              <form onSubmit={handleCreateMateria} className="modal-form">
                <div className="input-group">
                  <input
                    id="materiaTitle"
                    type="text"
                    value={newMateriaTitle}
                    onChange={(e) => setNewMateriaTitle(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Nombre de la materia"
                    className="modal-input"
                    autoFocus
                    required
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="color-section">
                  <p className="color-label">Elige un color</p>
                  <div className="color-options">
                    {colorPresets.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`color-option ${newMateriaColor === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewMateriaColor(color)}
                      />
                    ))}
                  </div>
                </div>

                {errorMessage && (
                  <div className="error-message-new">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{errorMessage}</span>
                  </div>
                )}
                
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewMateriaTitle('');
                      setErrorMessage('');
                    }}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-create"
                    disabled={isSubmitting || !newMateriaTitle.trim()}
                  >
                    <i className="fas fa-plus"></i>
                    {isSubmitting ? 'Creando...' : 'Crear Materia'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Materias;