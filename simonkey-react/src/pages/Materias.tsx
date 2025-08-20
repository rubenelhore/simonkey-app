// src/pages/Materias.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import '../styles/Materias.css';
import '../styles/AdminMaterias.css';
import '../styles/ModalOverride.css';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import CategoryDropdown from '../components/CategoryDropdown';
import MateriaList from '../components/MateriaList';
import { useAutoMigration } from '../hooks/useAutoMigration';
// import { useSchoolStudentData } from '../hooks/useSchoolStudentData'; // deprecated
import { getDomainProgressForMateria } from '../utils/domainProgress';
import InviteCodeManager from '../components/InviteCodeManager';
import EnrolledStudentsManager from '../components/EnrolledStudentsManager';

interface Materia {
  id: string;
  title: string;
  color: string;
  category?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  notebookCount?: number;
  conceptCount?: number;
  teacherName?: string;
  studentCount?: number;
  isEnrolled?: boolean;
  domainProgress?: {
    total: number;
    dominated: number;
    learning: number;
    notStarted: number;
  };
}

const Materias: React.FC = () => {
  console.log('🎯 MATERIAS COMPONENT MOUNTED - TEACHER VERSION');
  
  const { user, userProfile, loading: authLoading } = useAuth();
  const { isSchoolUser, isSchoolStudent, isSchoolAdmin, isSchoolTeacher } = useUserType();
  const [materias, setMaterias] = useState<Materia[]>([]);
  // Inicializar loading basado en el tipo de usuario
  const [loading, setLoading] = useState(() => {
    // Para profesores escolares, empezar con true ya que cargaremos sus materias
    if (isSchoolTeacher) return true;
    // Para otros usuarios también empezar con true
    return true;
  });
  
  // Log inmediato del estado de loading
  console.log('📌 Loading state actual:', loading);
  const [error, setError] = useState<Error | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  const { migrationStatus, migrationMessage } = useAutoMigration();
  // const { schoolSubjects, schoolNotebooks, loading: schoolLoading } = useSchoolStudentData(); // deprecated
  const schoolSubjects: any[] = [];
  const schoolNotebooks: any[] = [];
  const schoolLoading = false;
  
  console.log('📚 Materias.tsx - Estado actual:');
  console.log('  - isSchoolTeacher:', isSchoolTeacher);
  console.log('  - isSchoolStudent:', isSchoolStudent);
  console.log('  - user:', user?.uid);
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMateriaForInvite, setSelectedMateriaForInvite] = useState<{id: string, title: string} | null>(null);
  
  // Color presets para las materias
  const colorPresets = [
    '#6147FF', '#FF6B6B', '#4CAF50', '#FFD700', '#FF8C00', '#9C27B0'
  ];

  // Cargar materias del usuario
  useEffect(() => {
    const loadMaterias = async () => {
      console.log('📂 useEffect loadMaterias - Iniciando');
      console.log('  - user:', user?.uid);
      console.log('  - isSchoolTeacher:', isSchoolTeacher);
      console.log('  - isSchoolStudent:', isSchoolStudent);
      console.log('  - isSchoolAdmin:', isSchoolAdmin);
      
      if (!user) {
        console.log('  ❌ No hay usuario, saliendo');
        return;
      }
      // Ya no verificamos isSchoolStudent, isSchoolTeacher, isSchoolAdmin
      // porque el sistema escolar fue migrado
      
      console.log('  ✅ Cargando materias para usuario regular (no escolar)');
      setLoading(true);
      try {
        // Verificar si el usuario es profesor (tiene isTeacher = true)
        const isTeacher = userProfile?.isTeacher === true;
        
        // Cargar materias propias, notebooks y enrollments en paralelo
        const [materiasSnap, notebooksSnap, enrollmentsSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'materias'),
            where('userId', '==', user.uid)
          )),
          getDocs(query(
            collection(db, 'notebooks'),
            where('userId', '==', user.uid)
          )),
          // Cargar materias donde el usuario está inscrito como estudiante
          getDocs(query(
            collection(db, 'enrollments'),
            where('studentId', '==', user.uid),
            where('status', '==', 'active')
          ))
        ]);

        // Crear un mapa de conteo de notebooks por materiaId
        const notebookCountMap: Record<string, number> = {};
        notebooksSnap.docs.forEach(doc => {
          const materiaId = doc.data().materiaId;
          if (materiaId) {
            notebookCountMap[materiaId] = (notebookCountMap[materiaId] || 0) + 1;
          }
        });

        // Construir las materias propias con su conteo de notebooks
        const materiasData: Materia[] = await Promise.all(
          materiasSnap.docs.map(async (docSnap) => {
            const materiaData = {
              id: docSnap.id,
              title: docSnap.data().title,
              color: docSnap.data().color || '#6147FF',
              category: docSnap.data().category,
              userId: docSnap.data().userId,
              createdAt: docSnap.data().createdAt?.toDate() || new Date(),
              updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
              notebookCount: notebookCountMap[docSnap.id] || 0,
              studentCount: 0
            };
            
            // Si es profesor, contar estudiantes inscritos en esta materia
            if (isTeacher) {
              try {
                const enrollmentsQuery = query(
                  collection(db, 'enrollments'),
                  where('teacherId', '==', user.uid),
                  where('materiaId', '==', docSnap.id),
                  where('status', '==', 'active')
                );
                const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
                materiaData.studentCount = enrollmentsSnapshot.size;
              } catch (error) {
                console.error(`Error counting students for materia ${docSnap.id}:`, error);
              }
            }
            
            return materiaData;
          })
        );

        // Agregar materias donde el usuario está inscrito como estudiante
        for (const enrollmentDoc of enrollmentsSnap.docs) {
          const enrollmentData = enrollmentDoc.data();
          const materiaId = enrollmentData.materiaId;
          const materiaName = enrollmentData.materiaName;
          const teacherId = enrollmentData.teacherId;
          
          // No agregar si ya existe en las materias propias
          if (!materiasData.find(m => m.id === materiaId)) {
            try {
              // Obtener la información real de la materia del profesor
              const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
              
              // Obtener información del profesor
              let teacherName = '';
              try {
                const teacherDoc = await getDoc(doc(db, 'users', teacherId));
                if (teacherDoc.exists()) {
                  const teacherData = teacherDoc.data();
                  teacherName = teacherData.displayName || teacherData.nombre || 'Profesor';
                }
              } catch (error) {
                console.error(`Error loading teacher info for ${teacherId}:`, error);
              }
              
              // Contar notebooks del PROFESOR para esta materia (no del estudiante)
              const teacherNotebooksQuery = query(
                collection(db, 'notebooks'),
                where('userId', '==', teacherId),
                where('materiaId', '==', materiaId)
              );
              const teacherNotebooksSnap = await getDocs(teacherNotebooksQuery);
              
              if (materiaDoc.exists()) {
                const materiaData = materiaDoc.data();
                materiasData.push({
                  id: materiaId,
                  title: materiaData.title || materiaName || 'Materia del profesor',
                  color: materiaData.color || '#6147FF', // Usar el color real de la materia
                  category: materiaData.category || 'enrolled',
                  userId: teacherId, // El profesor es el dueño
                  createdAt: materiaData.createdAt?.toDate() || enrollmentData.enrolledAt?.toDate() || new Date(),
                  updatedAt: materiaData.updatedAt?.toDate() || enrollmentData.enrolledAt?.toDate() || new Date(),
                  notebookCount: teacherNotebooksSnap.size, // Cuadernos del profesor, no del estudiante
                  teacherName: teacherName, // Agregar nombre del profesor
                  isEnrolled: true // Marcar como materia inscrita
                });
              } else {
                // Si por alguna razón no existe la materia, usar datos del enrollment
                materiasData.push({
                  id: materiaId,
                  title: materiaName || 'Materia del profesor',
                  color: '#6147FF',
                  category: 'enrolled',
                  userId: teacherId,
                  createdAt: enrollmentData.enrolledAt?.toDate() || new Date(),
                  updatedAt: enrollmentData.enrolledAt?.toDate() || new Date(),
                  notebookCount: 0,
                  teacherName: teacherName, // Agregar nombre del profesor
                  isEnrolled: true // Marcar como materia inscrita
                });
              }
            } catch (error) {
              console.error(`Error loading enrolled materia ${materiaId}:`, error);
            }
          }
        }

        // Calcular el dominio para cada materia en paralelo
        const materiasWithProgress = await Promise.all(
          materiasData.map(async (materia) => {
            try {
              const domainProgress = await getDomainProgressForMateria(materia.id);
              return { ...materia, domainProgress };
            } catch (error) {
              console.error(`Error calculating domain for materia ${materia.id}:`, error);
              return materia;
            }
          })
        );

        setMaterias(materiasWithProgress);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        console.log('  ✅ Finalizando carga de materias, setLoading(false)');
        setLoading(false);
      }
    };
    loadMaterias();
  }, [user, refreshTrigger, isSchoolStudent, isSchoolTeacher, isSchoolAdmin]);

  // Log para debugging
  console.log('🔍 Materias - Estado actual del componente:', {
    loading,
    authLoading,
    schoolLoading,
    isSchoolTeacher,
    materiasLength: materias.length,
    isSchoolStudent,
    isSchoolAdmin
  });

  // Función para cargar exámenes de estudiante - OPTIMIZADA
  const loadStudentExams = async () => {
    if (!user || !isSchoolStudent || !schoolSubjects || schoolSubjects.length === 0 || !userProfile) return;
    
    try {
      const studentSchoolId = userProfile.idEscuela || userProfile.schoolData?.idEscuela;
      
      if (!studentSchoolId) {
        console.warn('⚠️ Estudiante sin escuela asignada, no se pueden cargar exámenes');
        return;
      }
      
      console.log('🏫 Cargando exámenes para escuela:', studentSchoolId);
      
      // Obtener todos los IDs de materias
      const subjectIds = schoolSubjects.map(subject => subject.id);
      
      // Hacer una sola consulta para todos los exámenes activos
      const examsQuery = query(
        collection(db, 'schoolExams'),
        where('idMateria', 'in', subjectIds),
        where('isActive', '==', true)
      );
      
      const examsSnapshot = await getDocs(examsQuery);
      
      // Agrupar exámenes por materia y filtrar por escuela
      const examsData: Record<string, any[]> = {};
      examsSnapshot.docs.forEach(doc => {
        const examData = {
          id: doc.id,
          ...doc.data()
        } as any;
        
        // Filtrar por escuela
        if (examData.idEscuela === studentSchoolId) {
          const materiaId = examData.idMateria;
          if (!examsData[materiaId]) {
            examsData[materiaId] = [];
          }
          examsData[materiaId].push(examData);
        }
      });
      
      setExamsByMateria(examsData);
      console.log('📝 Exámenes cargados para estudiante:', examsData);
    } catch (error) {
      console.error('Error cargando exámenes del estudiante:', error);
      // Si hay error (por ejemplo, por límite de 'in' con más de 10 items),
      // no cargar exámenes pero continuar con la página
      setExamsByMateria({});
    }
  };

  // Efecto específico para estudiantes escolares
  useEffect(() => {
    const loadStudentMateriasWithConcepts = async () => {
      if (!isSchoolStudent || schoolLoading) return;
      
      if (schoolSubjects && schoolSubjects.length > 0) {
        setLoading(true);
        try {
          const schoolMateriasData: Materia[] = await Promise.all(
            schoolSubjects.map(async (subject) => {
              const notebookCount = schoolNotebooks 
                ? schoolNotebooks.filter(notebook => notebook.idMateria === subject.id).length 
                : 0;
              
              // Calcular el conteo total de conceptos para esta materia
              let totalConceptCount = 0;
              if (schoolNotebooks) {
                const materiaNotebooks = schoolNotebooks.filter(notebook => notebook.idMateria === subject.id);
                console.log(`📚 Calculando conceptos para materia ${subject.nombre} (${subject.id})`);
                console.log(`  - Notebooks encontrados: ${materiaNotebooks.length}`);
                
                for (const notebook of materiaNotebooks) {
                  try {
                    // Los conceptos están en documentos que contienen arrays de conceptos
                    const conceptsQuery = query(
                      collection(db, 'schoolConcepts'),
                      where('cuadernoId', '==', notebook.id)
                    );
                    const conceptsSnapshot = await getDocs(conceptsQuery);
                    
                    // Contar todos los conceptos en todos los documentos
                    const notebookConceptCount = conceptsSnapshot.docs.reduce((total, doc) => {
                      const data = doc.data();
                      // Los conceptos están en un array llamado 'conceptos'
                      const conceptosArray = data.conceptos || [];
                      return total + conceptosArray.length;
                    }, 0);
                    
                    console.log(`    - Notebook ${notebook.id}: ${notebookConceptCount} conceptos`);
                    totalConceptCount += notebookConceptCount;
                  } catch (error) {
                    console.error(`Error counting concepts for notebook ${notebook.id}:`, error);
                  }
                }
                console.log(`  📊 Total de conceptos para ${subject.nombre}: ${totalConceptCount}`);
              }
              
              // Para estudiantes escolares, no calcular progreso de dominio
              // ya que no tienen notebooks personales y usan un sistema diferente
              const domainProgress = {
                total: totalConceptCount,
                dominated: 0,
                learning: 0,
                notStarted: totalConceptCount
              }
              
              return {
                id: subject.id,
                title: subject.nombre,
                color: subject.color || '#6147FF',
                category: '',
                userId: user?.uid || '',
                createdAt: subject.createdAt?.toDate() || new Date(),
                updatedAt: subject.createdAt?.toDate() || new Date(),
                notebookCount: notebookCount,
                conceptCount: totalConceptCount,
                domainProgress: domainProgress
              };
            })
          );
          
          console.log('📊 DATOS FINALES DE MATERIAS PARA ESTUDIANTE:', schoolMateriasData.map(m => ({
            title: m.title,
            notebookCount: m.notebookCount,
            conceptCount: m.conceptCount,
            domainProgress: m.domainProgress
          })));
          setMaterias(schoolMateriasData);
          // Cargar exámenes después de establecer las materias
          loadStudentExams();
        } catch (error) {
          console.error('Error loading student materias with concepts:', error);
          setMaterias([]);
        } finally {
          setLoading(false);
        }
      } else {
        // Si no hay materias, establecer un array vacío
        setMaterias([]);
        setLoading(false);
      }
    };
    
    loadStudentMateriasWithConcepts();
  }, [isSchoolStudent, schoolSubjects, schoolNotebooks, schoolLoading, user, userProfile]);

  // Efecto específico para profesores escolares
  useEffect(() => {
    const loadTeacherMaterias = async () => {
      if (!isSchoolTeacher || !user || !userProfile) return;
      
      console.log('👨‍🏫 Cargando materias para profesor escolar');
      setLoading(true);
      
      try {
        // Cargar materias asignadas al profesor
        const materiasQuery = query(
          collection(db, 'schoolSubjects'),
          where('idProfesor', '==', user.uid)
        );
        
        const materiasSnapshot = await getDocs(materiasQuery);
        
        // Cargar notebooks para contar cuántos hay por materia
        const notebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('idProfesor', '==', user.uid)
        );
        
        const notebooksSnapshot = await getDocs(notebooksQuery);
        console.log('📚 Total notebooks del profesor:', notebooksSnapshot.size);
        
        // Crear mapa de conteo de notebooks
        const notebookCountMap: Record<string, number> = {};
        notebooksSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const idMateria = data.idMateria;
          console.log(`  - Notebook ${doc.id}: idMateria=${idMateria}, title=${data.title}`);
          if (idMateria) {
            notebookCountMap[idMateria] = (notebookCountMap[idMateria] || 0) + 1;
          }
        });
        console.log('📊 Conteo de notebooks por materia:', notebookCountMap);
        
        // Construir las materias del profesor
        const teacherMaterias: Materia[] = materiasSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.nombre,
            color: data.color || '#6147FF',
            category: '',
            userId: user.uid,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            notebookCount: notebookCountMap[docSnap.id] || 0
          };
        });
        
        console.log('👨‍🏫 Materias del profesor cargadas:', teacherMaterias.length);
        setMaterias(teacherMaterias);
        setError(null);
        console.log('👨‍🏫 About to set loading to false');
        setLoading(false);
        console.log('👨‍🏫 Loading should now be false');
      } catch (error) {
        console.error('Error loading teacher materias:', error);
        setError(error as Error);
        setLoading(false);
      }
    };
    
    loadTeacherMaterias();
  }, [isSchoolTeacher, user, userProfile, refreshTrigger]);

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
        // Si el estudiante tiene idInstitucion, buscar en schoolInstitutions
        if (userProfile.idInstitucion) {
          const institutionDoc = await getDoc(doc(db, 'schoolInstitutions', userProfile.idInstitucion));
          if (institutionDoc.exists()) {
            const institutionData = institutionDoc.data();
            setInstitutionName(institutionData.name || institutionData.nombre || 'Institución Educativa');
          } else {
            setInstitutionName('Institución Educativa');
          }
        } else {
          // Si no tiene idInstitucion, usar el nombre genérico
          setInstitutionName('Institución Educativa');
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
        
        // Cargar profesores y estudiantes en paralelo - OPTIMIZADO
        const [teachersSnapshot, studentsSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'users'),
            where('subscription', '==', 'school'),
            where('schoolRole', '==', 'teacher'),
            where('idAdmin', '==', adminId)
          )),
          getDocs(query(
            collection(db, 'users'),
            where('subscription', '==', 'school'),
            where('schoolRole', '==', 'student'),
            where('idAdmin', '==', adminId)
          ))
        ]);
        
        const teachersData = teachersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const studentsData = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setTeachers(teachersData);
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
        // Obtener todos los estudiantes del admin
        const adminId = userProfile?.id || user?.uid;
        const studentsQuery = query(
          collection(db, 'users'),
          where('idAdmin', '==', adminId),
          where('schoolRole', '==', 'student')
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        // Filtrar localmente los que tienen esta materia
        for (const studentDoc of studentsSnapshot.docs) {
          const studentData = studentDoc.data();
          const subjectIds = studentData.subjectIds || [];
          
          // Solo actualizar si el estudiante tiene esta materia
          if (subjectIds.includes(id)) {
            const updatedSubjectIds = subjectIds.filter((subId: string) => subId !== id);
            await updateDoc(doc(db, 'users', studentDoc.id), {
              subjectIds: updatedSubjectIds
            });
            console.log(`Materia removida del estudiante ${studentDoc.id}`);
          }
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
      // Los demás usuarios navegan a la ruta normal usando nombre-id de la materia
      const materiaName = materia.title || materia.nombre;
      const encodedNameWithId = encodeURIComponent(`${materiaName}-${materiaId}`);
      navigate(`/materias/${encodedNameWithId}/notebooks`);
    }
  };

  const handleManageInvites = (materiaId: string, materiaTitle: string) => {
    setSelectedMateriaForInvite({ id: materiaId, title: materiaTitle });
    setShowInviteModal(true);
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

  if (loading || authLoading || (isSchoolStudent && schoolLoading)) {
    console.log('🔄 Materias - Mostrando loading:', { loading, authLoading, schoolLoading, isSchoolTeacher });
    return (
      <div className="materias-container">
        <HeaderWithHamburger title="Mis Materias" />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando...</p>
        </div>
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
              onManageInvites={!isSchoolStudent ? handleManageInvites : undefined}
              showCreateButton={!!selectedTeacher && selectedStudents.length > 0}
              selectedCategory={null}
              showCreateModal={showCreateModal}
              setShowCreateModal={setShowCreateModal}
              showCategoryModal={false}
              onCloseCategoryModal={() => {}}
              onClearSelectedCategory={() => {}}
              onRefreshCategories={() => setRefreshTrigger(prev => prev + 1)}
              isAdminView={true}
              isSchoolTeacher={isSchoolTeacher}
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
  console.log('🎨 Materias - Renderizando vista para profesor escolar');
  console.log('  - isSchoolTeacher:', isSchoolTeacher);
  console.log('  - materias:', materias.length);
  console.log('  - loading:', loading);
  console.log('  - authLoading:', authLoading);
  
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
                  {isSchoolTeacher ? (
                    <>
                      <div className="badge-new">¡Bienvenido profesor!</div>
                      <h2 className="empty-state-title gradient-text">
                        No tienes materias asignadas<br/>
                        <span className="highlight">contacta a tu administrador</span>
                      </h2>
                    </>
                  ) : (
                    <>
                      <div className="badge-new">¡Nuevo estudiante!</div>
                      <h2 className="empty-state-title gradient-text">
                        Organiza tu conocimiento,<br/>
                        <span className="highlight">domina tu aprendizaje</span>
                      </h2>
                    </>
                  )}
                  
                  <div className="empty-state-actions">
                    {!isSchoolStudent && !isSchoolTeacher && (
                      <button className="create-materia-button primary pulse" onClick={() => {
                        setShowCreateModal(true);
                      }}>
                        <div className="button-bg"></div>
                        <span className="button-content">
                          <i className="fas fa-plus"></i>
                          Crear mi primera materia
                        </span>
                      </button>
                    )}
                    
                    {isSchoolTeacher && (
                      <div className="teacher-welcome-message">
                        <div className="message-icon">
                          <i className="fas fa-chalkboard-teacher"></i>
                        </div>
                        <div className="message-content">
                          <p className="message-quote">
                            "La educación es el arma más poderosa que puedes usar para cambiar el mundo"
                          </p>
                          <p className="message-author">- Nelson Mandela</p>
                        </div>
                      </div>
                    )}
                    
                    {!isSchoolTeacher && (
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
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <MateriaList 
              materias={materias}
              onDeleteMateria={isSchoolStudent || isSchoolTeacher ? undefined : handleDelete}
              onEditMateria={isSchoolStudent || isSchoolTeacher ? undefined : handleEdit}
              onColorChange={isSchoolStudent || isSchoolTeacher ? undefined : handleColorChange}
              onCreateMateria={isSchoolStudent || isSchoolTeacher ? undefined : handleCreate}
              onViewMateria={handleView}
              onManageInvites={!isSchoolStudent ? handleManageInvites : undefined}
              showCreateButton={!isSchoolStudent && !isSchoolTeacher}
              selectedCategory={null}
              showCreateModal={showCreateModal}
              setShowCreateModal={setShowCreateModal}
              examsByMateria={examsByMateria}
              isSchoolStudent={isSchoolStudent}
              isSchoolTeacher={isSchoolTeacher}
              isTeacher={userProfile?.isTeacher === true}
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
      
      {/* Modal para gestionar invitaciones */}
      {showInviteModal && selectedMateriaForInvite && (
        <div className="modal-overlay" style={{ zIndex: 998 }} onClick={() => setShowInviteModal(false)}>
          <div className="modal-content invite-modal-content" style={{ maxWidth: '900px', width: '90%', maxHeight: '90vh', overflow: 'auto', position: 'relative', border: 'none' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-simple">
              <button 
                className="close-button-simple" 
                onClick={() => {
                  setShowInviteModal(false);
                  setSelectedMateriaForInvite(null);
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-main-content" style={{ padding: '20px' }}>
              <div className="modal-icon">
                <i className="fas fa-user-plus" style={{ color: '#6147FF', fontSize: '2.5rem' }}></i>
              </div>
              <h2 className="modal-title">Gestionar Invitaciones</h2>
              <p className="modal-subtitle">Materia: {selectedMateriaForInvite.title}</p>
              
              <div style={{ marginTop: '30px' }}>
                <div style={{ marginBottom: '40px' }}>
                  <h3 style={{ marginBottom: '20px', fontSize: '1.2rem', color: '#333' }}>
                    <i className="fas fa-link" style={{ marginRight: '8px', color: '#6147FF' }}></i>
                    Códigos de Invitación
                  </h3>
                  <InviteCodeManager 
                    materiaId={selectedMateriaForInvite.id}
                    materiaName={selectedMateriaForInvite.title}
                    showTitle={false}
                  />
                </div>
                
                <div style={{ borderTop: '2px solid #f0f0f0', paddingTop: '40px' }}>
                  <h3 style={{ marginBottom: '20px', fontSize: '1.2rem', color: '#333' }}>
                    <i className="fas fa-users" style={{ marginRight: '8px', color: '#6147FF' }}></i>
                    Estudiantes Inscritos
                  </h3>
                  <EnrolledStudentsManager 
                    materiaId={selectedMateriaForInvite.id}
                    showTitle={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Materias;