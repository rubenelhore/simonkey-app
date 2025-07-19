// src/pages/Materias.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import '../styles/Materias.css';
import '../styles/AdminMaterias.css';
import StreakTracker from '../components/StreakTracker';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import CategoryDropdown from '../components/CategoryDropdown';
import MateriaList from '../components/MateriaList';
import { useAutoMigration } from '../hooks/useAutoMigration';
import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import { studyStreakService } from '../services/studyStreakService';

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

  // Cargar materias del usuario
  useEffect(() => {
    const loadMateriasYStreak = async () => {
      if (!user) return;
      if (isSchoolStudent) return;
      setLoading(true);
      setLoadingStreak(true);
      try {
        // Query optimizada: solo una lectura para materias
        const materiasQuery = query(
          collection(db, 'materias'),
          where('userId', '==', user.uid)
        );
        // Query optimizada: solo una lectura para racha
        const streakDocRef = doc(db, 'users', user.uid, 'stats', 'studyStreak');
        const [materiasSnap, streakDoc] = await Promise.all([
          getDocs(materiasQuery),
          getDoc(streakDocRef)
        ]);
        const materiasData: Materia[] = materiasSnap.docs.map(docSnap => ({
          id: docSnap.id,
          title: docSnap.data().title,
          color: docSnap.data().color || '#6147FF',
          category: docSnap.data().category,
          userId: docSnap.data().userId,
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
          notebookCount: docSnap.data().notebookCount || 0
        }));
        setMaterias(materiasData);
        setError(null);
        // Racha optimizada
        const streakDataRaw = streakDoc.exists() ? streakDoc.data() : null;
        setStreakData(streakDataRaw ? {
          days: streakDataRaw.weekDays || {
            monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false
          },
          consecutiveDays: streakDataRaw.currentStreak || 0,
          streakBonus:  streakDataRaw.currentStreak ? (streakDataRaw.currentStreak * 200) : 0,
          hasStudiedToday: streakDataRaw.hasStudiedToday || false
        } : null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
        setLoadingStreak(false);
      }
    };
    loadMateriasYStreak();
  }, [user, refreshTrigger, isSchoolStudent]);

  // Efecto específico para estudiantes escolares
  useEffect(() => {
    if (isSchoolStudent && !schoolLoading && schoolSubjects) {
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
      setLoading(false);
    }
  }, [isSchoolStudent, schoolSubjects, schoolNotebooks, schoolLoading, user]);

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
    try {
      // Verificar si ya existe una materia con ese nombre
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
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error updating materia:', error);
      throw error;
    }
  };

  const handleColorChange = async (id: string, newColor: string) => {
    // Los estudiantes escolares no pueden cambiar colores
    if (isSchoolStudent) return;
    try {
      await updateDoc(doc(db, 'materias', id), {
        color: newColor,
        updatedAt: serverTimestamp()
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error updating materia color:', error);
    }
  };

  const handleView = (materiaId: string) => {
    // Todos los usuarios navegan a la misma ruta para ver notebooks de una materia
    navigate(`/materias/${materiaId}/notebooks`);
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

  const [newMateriaTitle, setNewMateriaTitle] = useState('');
  const [newMateriaColor, setNewMateriaColor] = useState('#6147FF');
  const colorPresets = [
    '#6147FF', '#FF6B6B', '#4CAF50', '#FFD700', '#FF8C00', '#9C27B0'
  ];

  const [streakData, setStreakData] = useState<any>(null);
  const [loadingStreak, setLoadingStreak] = useState(true);

  if (loading || authLoading || loadingStreak) {
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
          title="Gestión de Materias"
          subtitle={`Administrador: ${userData.nombre || 'Admin'}`}
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

        {/* Mobile Navigation */}
        <nav className="admin-mobile-nav">
          <button 
            className="nav-item active"
            onClick={() => navigate('/materias')}
          >
            <i className="fas fa-book"></i>
            <span>Materias</span>
          </button>
          <button 
            className="nav-item"
            onClick={() => navigate('/school/admin')}
          >
            <i className="fas fa-chart-line"></i>
            <span>Analítica</span>
          </button>
        </nav>
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
        title="Materias"
        subtitle={`Espacio Personal de ${userData.nombre || 'Simón'}`}
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
        <div className="left-column">
          <StreakTracker streakData={streakData} />
          {/* CategoryDropdown eliminado */}
        </div>
        <div className="materias-list-section">
          {materias.length === 0 ? (
            <>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '320px', background: '#fafafa', borderRadius: 16, border: '1.5px solid #e5e7eb',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '2.5rem 1.5rem', margin: '2rem 0'
              }}>
                <i className="fas fa-book-open" style={{ fontSize: 48, color: '#a78bfa', marginBottom: 16 }}></i>
                <h3 style={{ color: '#6147FF', marginBottom: 20 }}>¡Aún no tienes materias creadas!</h3>
                <button className="create-materia-button" onClick={() => {
                  setShowCreateModal(true);
                }}>
                  <i className="fas fa-plus"></i> Crear nueva materia
                </button>
              </div>
              {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                  <div className="modal-content create-materia-modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3>Crear nueva materia</h3>
                      <button className="close-button" onClick={() => setShowCreateModal(false)}>
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newMateriaTitle.trim()) return;
                      await handleCreate(newMateriaTitle.trim(), newMateriaColor);
                      setNewMateriaTitle('');
                      setNewMateriaColor('#6147FF');
                      setShowCreateModal(false);
                    }} className="modal-body">
                      <div className="form-group">
                        <label htmlFor="materiaTitle">Nombre de la materia</label>
                        <input
                          id="materiaTitle"
                          type="text"
                          value={newMateriaTitle}
                          onChange={e => setNewMateriaTitle(e.target.value)}
                          placeholder="Ej: Matemáticas, Historia, etc."
                          className="form-control"
                          autoFocus
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Color de la materia</label>
                        <div className="color-picker-grid">
                          {colorPresets.map(color => (
                            <button
                              key={color}
                              type="button"
                              className={`color-preset ${newMateriaColor === color ? 'selected' : ''}`}
                              style={{ backgroundColor: color }}
                              onClick={() => setNewMateriaColor(color)}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => setShowCreateModal(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="create-button"
                          disabled={!newMateriaTitle.trim()}
                        >
                          Crear materia
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
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
              showCategoryModal={showCategoryModal}
              onCloseCategoryModal={() => setShowCategoryModal(false)}
              onClearSelectedCategory={handleClearSelectedCategory}
              onRefreshCategories={() => setRefreshTrigger(prev => prev + 1)}
            />
          )}
        </div>
      </main>
      <footer className="materias-footer">
        <p>&copy; {new Date().getFullYear()} Simonkey - Todos los derechos reservados</p>
      </footer>
    </>
  );
};

export default Materias;