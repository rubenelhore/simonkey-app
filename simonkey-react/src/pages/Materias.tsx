// src/pages/Materias.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { cachedQuery, optimizedCount, batchedQuery } from '../utils/firebaseOptimizer';
import InviteCodeManager from '../components/InviteCodeManager';
import EnrolledStudentsManager from '../components/EnrolledStudentsManager';
import { useInviteCode } from '../services/invitationService';

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
  const { user, userProfile, loading: authLoading } = useAuth();
  const { isSchoolUser, isSchoolStudent, isSchoolAdmin, isTeacher } = useUserType();
  const [materias, setMaterias] = useState<Materia[]>([]);
  // Inicializar loading basado en el tipo de usuario
  const [loading, setLoading] = useState(true);
  const [materiasLoaded, setMateriasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [progressLoadingStates, setProgressLoadingStates] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { migrationStatus, migrationMessage } = useAutoMigration();
  // const { schoolSubjects, schoolNotebooks, loading: schoolLoading } = useSchoolStudentData(); // deprecated
  const schoolSubjects: any[] = [];
  const schoolNotebooks: any[] = [];
  const schoolLoading = false;
  
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
  
  // Estados para el modal de unirse a clase
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningClass, setJoiningClass] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  
  // Estados para el modal de confirmación de desenrolarse
  const [showUnenrollModal, setShowUnenrollModal] = useState(false);
  const [unenrollMateriaId, setUnenrollMateriaId] = useState<string>('');
  const [unenrollMateriaTitle, setUnenrollMateriaTitle] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMateriaForInvite, setSelectedMateriaForInvite] = useState<{id: string, title: string} | null>(null);
  
  // Color presets para las materias
  const colorPresets = [
    '#6147FF', '#FF6B6B', '#4CAF50', '#FFD700', '#FF8C00', '#9C27B0'
  ];

  // Función optimizada para cargar materias básicas rápidamente
  const loadBasicMaterias = useCallback(async () => {
    if (!user || authLoading) {
      console.log('  ❌ No hay usuario o aún cargando auth, saliendo');
      setLoading(false);
      return;
    }
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('  ❌ No hay currentUser en Firebase Auth, esperando...');
      setLoading(false);
      return;
    }

    // Verificar token
    try {
      await currentUser.getIdToken(false);
      console.log('  ✅ Token de usuario válido');
    } catch (error) {
      console.log('  ⚠️ Error verificando token, refrescando...', error);
      try {
        await currentUser.getIdToken(true);
        console.log('  ✅ Token refrescado exitosamente');
      } catch (refreshError) {
        console.log('  ❌ Error refrescando token:', refreshError);
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    try {
      // PASO 1: Cargar materias básicas sin datos pesados
      const [materiasSnap, enrollmentsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'materias'),
          where('userId', '==', user.uid)
        )),
        getDocs(query(
          collection(db, 'enrollments'),
          where('studentId', '==', user.uid),
          where('status', '==', 'active')
        ))
      ]);

      // Construir materias básicas sin conteos pesados
      const materiasData: Materia[] = materiasSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        title: docSnap.data().title,
        color: docSnap.data().color || '#6147FF',
        category: docSnap.data().category,
        userId: docSnap.data().userId,
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        notebookCount: 0, // Se actualizará después
        studentCount: 0,  // Se actualizará después
        isEnrolled: false
      }));

      // Agregar materias inscritas básicas
      for (const enrollmentDoc of enrollmentsSnap.docs) {
        const enrollmentData = enrollmentDoc.data();
        const materiaId = enrollmentData.materiaId;
        
        if (!materiasData.find(m => m.id === materiaId)) {
          try {
            const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
            if (materiaDoc.exists()) {
              const materiaData = materiaDoc.data();
              materiasData.push({
                id: materiaId,
                title: materiaData.title || enrollmentData.materiaName || 'Materia del profesor',
                color: materiaData.color || '#6147FF',
                category: materiaData.category || 'enrolled',
                userId: enrollmentData.teacherId,
                createdAt: materiaData.createdAt?.toDate() || enrollmentData.enrolledAt?.toDate() || new Date(),
                updatedAt: materiaData.updatedAt?.toDate() || enrollmentData.enrolledAt?.toDate() || new Date(),
                notebookCount: 0, // Se actualizará después
                conceptCount: 0,  // Se actualizará después
                teacherName: '', // Se actualizará después
                isEnrolled: true
              });
            }
          } catch (error) {
            console.error(`Error loading enrolled materia ${materiaId}:`, error);
          }
        }
      }

      // MOSTRAR MATERIAS INMEDIATAMENTE
      setMaterias(materiasData);
      setError(null);
      console.log('  ✅ Materias básicas cargadas:', materiasData.length);
      setMateriasLoaded(true);
      setLoading(false); // Quitar loading inmediatamente
      
      // PASO 2: Cargar datos adicionales en segundo plano
      loadAdditionalData(materiasData);
      
    } catch (err) {
      console.error('❌ Error cargando materias:', err);
      setError(err as Error);
      setLoading(false);
      setMateriasLoaded(true);
    }
  }, [user, authLoading, isTeacher]);

  // Función para cargar datos adicionales en segundo plano
  const loadAdditionalData = useCallback(async (currentMaterias: Materia[]) => {
    if (!user) return;
    
    try {
      // Cargar notebooks para materias propias
      const notebooksPromise = getDocs(query(
        collection(db, 'notebooks'),
        where('userId', '==', user.uid)
      )).then(notebooksSnap => {
        const notebookCountMap: Record<string, number> = {};
        notebooksSnap.docs.forEach(doc => {
          const materiaId = doc.data().materiaId;
          if (materiaId) {
            notebookCountMap[materiaId] = (notebookCountMap[materiaId] || 0) + 1;
          }
        });
        return notebookCountMap;
      });

      // Cargar conteos de estudiantes para profesores (optimizado)
      const studentCountsPromise = isTeacher ? batchedQuery(
        currentMaterias.filter(m => !m.isEnrolled),
        async (materia) => {
          try {
            const count = await optimizedCount('enrollments', [
              { field: 'teacherId', operator: '==', value: user.uid },
              { field: 'materiaId', operator: '==', value: materia.id },
              { field: 'status', operator: '==', value: 'active' }
            ]);
            return { id: materia.id, count };
          } catch (error) {
            console.error(`Error counting students for ${materia.id}:`, error);
            return { id: materia.id, count: 0 };
          }
        },
        3, // lotes de 3 materias
        150 // 150ms entre lotes
      ) : Promise.resolve([]);

      // Cargar información de profesores para materias inscritas (optimizado)
      const teacherInfoPromise = batchedQuery(
        currentMaterias.filter(m => m.isEnrolled),
        async (materia) => {
          try {
            const teacherDoc = await getDoc(doc(db, 'users', materia.userId));
            const teacherName = teacherDoc.exists() 
              ? (teacherDoc.data().displayName || teacherDoc.data().nombre || 'Profesor')
              : 'Profesor';
            return { id: materia.id, teacherName };
          } catch (error) {
            console.error(`Error loading teacher for ${materia.id}:`, error);
            return { id: materia.id, teacherName: 'Profesor' };
          }
        },
        5, // lotes de 5 profesores
        100 // 100ms entre lotes
      );

      // Ejecutar todas las promesas en paralelo
      const [notebookCounts, studentCounts, teacherInfo] = await Promise.all([
        notebooksPromise,
        studentCountsPromise,
        teacherInfoPromise
      ]);

      // Actualizar materias con los datos cargados
      setMaterias(prev => prev.map(materia => {
        const updates: Partial<Materia> = {};
        
        // Actualizar notebook count para materias propias
        if (!materia.isEnrolled) {
          updates.notebookCount = notebookCounts[materia.id] || 0;
        }
        
        // Actualizar student count para profesores
        if (isTeacher && !materia.isEnrolled) {
          const studentCount = studentCounts.find(sc => sc.id === materia.id);
          if (studentCount) {
            updates.studentCount = studentCount.count;
          }
        }
        
        // Actualizar teacher name para materias inscritas
        if (materia.isEnrolled) {
          const teacher = teacherInfo.find(ti => ti.id === materia.id);
          if (teacher) {
            updates.teacherName = teacher.teacherName;
          }
        }
        
        return { ...materia, ...updates };
      }));
      
      console.log('✅ Datos adicionales cargados');
      
    } catch (error) {
      console.error('Error loading additional data:', error);
    }
  }, [user, isTeacher]);

  // Función para calcular progreso de dominio bajo demanda
  const calculateDomainProgress = useCallback(async (materiaId: string) => {
    // Evitar cálculos duplicados
    if (progressLoadingStates[materiaId]) return;
    
    setProgressLoadingStates(prev => ({ ...prev, [materiaId]: true }));
    
    try {
      const domainProgress = await getDomainProgressForMateria(materiaId);
      
      setMaterias(prev => prev.map(materia => 
        materia.id === materiaId 
          ? { ...materia, domainProgress }
          : materia
      ));
      
      console.log(`✅ Progreso calculado para materia ${materiaId}`);
    } catch (error) {
      console.error(`Error calculating domain for materia ${materiaId}:`, error);
    } finally {
      setProgressLoadingStates(prev => ({ ...prev, [materiaId]: false }));
    }
  }, [progressLoadingStates]);

  // Efecto para calcular progreso de las primeras 3 materias después de cargar
  useEffect(() => {
    if (materiasLoaded && materias.length > 0 && !loading) {
      // Calcular progreso solo para las primeras 3 materias (las más visibles)
      const visibleMaterias = materias.slice(0, 3);
      
      // Retrasar ligeramente para no bloquear la UI
      setTimeout(() => {
        visibleMaterias.forEach(materia => {
          if (!materia.domainProgress) {
            calculateDomainProgress(materia.id);
          }
        });
      }, 500);
    }
  }, [materiasLoaded, materias, loading, calculateDomainProgress]);

  // Función para calcular progreso de todas las materias restantes
  const calculateAllRemainingProgress = useCallback(async () => {
    const materiasWithoutProgress = materias.filter(materia => !materia.domainProgress);
    
    if (materiasWithoutProgress.length === 0) {
      console.log('✅ Todas las materias ya tienen progreso calculado');
      return;
    }
    
    console.log(`🔄 Calculando progreso para ${materiasWithoutProgress.length} materias restantes...`);
    
    // Calcular en lotes de 2 para no saturar
    for (let i = 0; i < materiasWithoutProgress.length; i += 2) {
      const batch = materiasWithoutProgress.slice(i, i + 2);
      
      await Promise.all(
        batch.map(materia => calculateDomainProgress(materia.id))
      );
      
      // Pausa entre lotes
      if (i + 2 < materiasWithoutProgress.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log('✅ Progreso calculado para todas las materias');
  }, [materias, calculateDomainProgress]);

  // Función para manejar cuando una materia entra en el viewport
  const handleMateriaInView = useCallback((materiaId: string) => {
    const materia = materias.find(m => m.id === materiaId);
    if (materia && !materia.domainProgress && !progressLoadingStates[materiaId]) {
      console.log(`👁️ Materia ${materiaId} visible, calculando progreso...`);
      calculateDomainProgress(materiaId);
    }
  }, [materias, calculateDomainProgress, progressLoadingStates]);

  // Efecto principal para cargar materias
  useEffect(() => {
    loadBasicMaterias();
  }, [loadBasicMaterias, refreshTrigger]);

  // Memoizar materias filtradas para evitar re-renders
  const filteredMaterias = useMemo(() => {
    if (!selectedCategory) return materias;
    return materias.filter(materia => materia.category === selectedCategory);
  }, [materias, selectedCategory]);

  // Memoizar si debemos mostrar el botón crear
  const shouldShowCreateButton = useMemo(() => {
    if (isSchoolStudent) return false;
    if (isSchoolAdmin) return !!selectedTeacher && selectedStudents.length > 0;
    return true;
  }, [isSchoolStudent, isSchoolAdmin, selectedTeacher, selectedStudents.length]);


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

  // NOTA: useEffect para profesores escolares eliminado - sistema escolar deprecado

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

  const handleCreate = useCallback(async (title: string, color: string, category?: string) => {
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
  }, [isSchoolStudent, user, isSchoolAdmin, selectedTeacher, userProfile, selectedStudents]);

  const handleDelete = useCallback(async (id: string) => {
    // Los estudiantes escolares no pueden eliminar materias
    if (isSchoolStudent) return;
    try {
      // TODOS los usuarios (incluidos profesores) usan las colecciones regulares
      // Ya no usamos schoolSubjects/schoolNotebooks porque están deprecated
      const materiaCollection = 'materias';
      const notebooksCollection = 'notebooks';
      const notebookField = 'materiaId';
      
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
  }, [isSchoolStudent, isSchoolAdmin, userProfile, user]);

  // Función para mostrar el modal de confirmación
  const handleUnenrollClick = useCallback((materiaId: string, materiaTitle: string) => {
    setUnenrollMateriaId(materiaId);
    setUnenrollMateriaTitle(materiaTitle);
    setShowUnenrollModal(true);
  }, []);

  // Función para confirmar el desenrolamiento
  const confirmUnenroll = useCallback(async () => {
    if (!user || !unenrollMateriaId) return;
    
    try {
      // Buscar el enrollment activo del usuario en esta materia
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('studentId', '==', user.uid),
        where('materiaId', '==', unenrollMateriaId),
        where('status', '==', 'active')
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      
      if (enrollmentsSnapshot.empty) {
        setShowUnenrollModal(false);
        setToastMessage('No se encontró la inscripción en esta materia');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
      }
      
      // Actualizar el estado del enrollment a 'inactive'
      const enrollmentDoc = enrollmentsSnapshot.docs[0];
      await updateDoc(doc(db, 'enrollments', enrollmentDoc.id), {
        status: 'inactive',
        unenrolledAt: serverTimestamp()
      });
      
      console.log(`✅ Usuario desenrolado de la materia ${unenrollMateriaId}`);
      
      // Cerrar modal
      setShowUnenrollModal(false);
      setUnenrollMateriaId('');
      setUnenrollMateriaTitle('');
      
      // Refrescar la lista de materias
      setRefreshTrigger(prev => prev + 1);
      
      // Mostrar toast de éxito
      setToastMessage('Te has desenrolado exitosamente de la materia');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error desenrolando de la materia:', error);
      setShowUnenrollModal(false);
      setToastMessage('Error al desenrolarse de la materia. Por favor, intenta de nuevo.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }, [user, unenrollMateriaId]);

  const handleUnenroll = useCallback(async (materiaId: string) => {
    // Esta función ahora solo busca el título y llama a handleUnenrollClick
    const materia = materias.find(m => m.id === materiaId);
    const materiaTitle = materia?.title || 'esta materia';
    handleUnenrollClick(materiaId, materiaTitle);
  }, [materias, handleUnenrollClick]);

  const handleEdit = useCallback(async (id: string, newTitle: string) => {
    // Los estudiantes escolares no pueden editar materias
    if (isSchoolStudent) return;
    if (!user) return;
    
    try {
      // TODOS los usuarios (incluidos profesores) usan la colección regular 'materias'
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
  }, [isSchoolStudent, user]);

  const handleColorChange = useCallback(async (id: string, newColor: string) => {
    // Los estudiantes escolares no pueden cambiar colores
    if (isSchoolStudent) return;
    if (!user) return;
    
    try {
      // TODOS los usuarios (incluidos profesores) usan la colección regular 'materias'
      await updateDoc(doc(db, 'materias', id), {
        color: newColor,
        updatedAt: serverTimestamp()
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error updating materia color:', error);
    }
  }, [isSchoolStudent, user]);

  const handleView = useCallback((materiaId: string) => {
    // Calcular progreso antes de navegar si no existe
    const materia = materias.find(m => m.id === materiaId);
    if (materia && !materia.domainProgress && !progressLoadingStates[materiaId]) {
      calculateDomainProgress(materiaId);
    }
    
    // Find the materia to get its name
    // Si es admin, buscar en adminMaterias, si no en materias
    const materiasList = isSchoolAdmin ? adminMaterias : materias;
    const materiaToView = materiasList.find(m => m.id === materiaId);
    if (!materiaToView) return;
    
    // Los estudiantes escolares van a una página especial que muestra tanto notebooks como exámenes
    if (isSchoolStudent) {
      const encodedName = encodeURIComponent(materiaToView.title);
      navigate(`/school/student/materia/${encodedName}`);
    } else if (isSchoolAdmin) {
      // Los admin navegan a la vista de notebooks del profesor
      navigate(`/school/teacher/materias/${materiaId}/notebooks`);
    } else {
      // Los demás usuarios navegan a la ruta normal usando nombre-id de la materia
      const materiaName = materiaToView.title || materiaToView.nombre;
      const encodedNameWithId = encodeURIComponent(`${materiaName}-${materiaId}`);
      navigate(`/materias/${encodedNameWithId}/notebooks`);
    }
  }, [materias, adminMaterias, isSchoolAdmin, isSchoolStudent, navigate, calculateDomainProgress, progressLoadingStates]);

  const handleManageInvites = useCallback((materiaId: string, materiaTitle: string) => {
    setSelectedMateriaForInvite({ id: materiaId, title: materiaTitle });
    setShowInviteModal(true);
  }, []);

  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category);
  }, []);

  const handleCreateCategory = useCallback(() => {
    setShowCategoryModal(true);
  }, []);

  const handleClearSelectedCategory = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  // Funciones para el modal
  const handleCreateMateria = useCallback(async (e: React.FormEvent) => {
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
  }, [newMateriaTitle, isSubmitting, newMateriaColor, handleCreate]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateMateria(e as any);
    } else if (e.key === 'Escape') {
      setShowCreateModal(false);
      setNewMateriaTitle('');
      setErrorMessage('');
    }
  }, [handleCreateMateria]);

  // Funciones para unirse a clase
  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!joinCode.trim()) {
      setErrorMessage('Por favor, ingresa el código de la clase.');
      return;
    }

    if (joiningClass || !user) return;
    setJoiningClass(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Extraer código si es una URL
      const codeToUse = extractCodeFromUrl(joinCode.trim());
      
      // Usar el servicio de invitación para inscribirse directamente
      const result = await useInviteCode(
        codeToUse,
        user.uid,
        user.email || undefined,
        userProfile?.nombre || userProfile?.displayName || undefined
      );

      if (result.success && result.enrollment) {
        // Mostrar toast de éxito
        showSuccessToast(`¡Te has inscrito exitosamente en "${result.enrollment.materiaName}"!`);
        
        // Cerrar el modal inmediatamente
        setShowJoinModal(false);
        setJoinCode('');
        setErrorMessage('');
        setSuccessMessage('');
        
        // Refrescar la lista de materias para mostrar la nueva inscripción
        setRefreshTrigger(prev => prev + 1);
      } else {
        setErrorMessage(result.error || 'Error al unirse a la clase.');
      }
    } catch (error) {
      console.error('Error joining class:', error);
      setErrorMessage('Error al unirse a la clase. Por favor, intenta de nuevo.');
    } finally {
      setJoiningClass(false);
    }
  };

  const handleJoinKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoinClass(e as any);
    } else if (e.key === 'Escape') {
      setShowJoinModal(false);
      setJoinCode('');
      setErrorMessage('');
      setSuccessMessage('');
    }
  };

  // Función para mostrar toast de éxito
  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    
    // Auto-ocultar después de 4 segundos
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  // Función para extraer código de URL de Simonkey
  const extractCodeFromUrl = (url: string): string => {
    try {
      // Detectar si es una URL de Simonkey join
      const joinPattern = /(?:https?:\/\/)?(?:www\.)?simonkey\.ai\/join\/([A-Z0-9]{6,8})/i;
      const match = url.match(joinPattern);
      
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
      
      // Si no coincide con el patrón, pero contiene /join/, intentar extraer el código después del último /
      if (url.includes('/join/')) {
        const parts = url.split('/');
        const lastPart = parts[parts.length - 1];
        // Validar que sea un código válido (6-8 caracteres alfanuméricos)
        if (/^[A-Z0-9]{6,8}$/i.test(lastPart)) {
          return lastPart.toUpperCase();
        }
      }
    } catch (error) {
      console.log('Error extracting code from URL:', error);
    }
    
    return url; // Devolver la entrada original si no se puede extraer
  };



  // Efecto para bloquear el body cuando cualquier modal está abierto
  useEffect(() => {
    if (showCreateModal || showJoinModal || showUnenrollModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    // Cleanup al desmontar el componente
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCreateModal, showJoinModal, showUnenrollModal]);

  if (loading || authLoading) {
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
              onUnenrollMateria={handleUnenroll}
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
              isTeacher={isTeacher}
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

  // Vista normal para todos los usuarios
  
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
                  {isTeacher ? (
                    <>
                      <div className="badge-new">¡Bienvenido profesor!</div>
                      <h2 className="empty-state-title gradient-text">
                        Comienza a organizar tus clases<br/>
                        <span className="highlight">crea tu primera materia</span>
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
                    {!isSchoolStudent && (
                      <div className="create-buttons-container">
                        <button className="create-materia-button primary pulse" onClick={() => {
                          setShowCreateModal(true);
                        }}>
                          <div className="button-bg"></div>
                          <span className="button-content">
                            <i className="fas fa-plus"></i>
                            Crear mi primera materia
                          </span>
                        </button>
                        
                        <button className="join-class-button secondary" onClick={() => {
                          setShowJoinModal(true);
                        }}>
                          <div className="button-bg"></div>
                          <span className="button-content">
                            <i className="fas fa-users"></i>
                            Unirme a una clase
                          </span>
                        </button>
                      </div>
                    )}
                    
                    {isTeacher && (
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
                    
                    {!isTeacher && !isSchoolStudent && (
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
              materias={filteredMaterias}
              onDeleteMateria={handleDelete}
              onEditMateria={handleEdit}
              onUnenrollMateria={handleUnenroll}
              onColorChange={handleColorChange}
              onCreateMateria={handleCreate}
              onViewMateria={handleView}
              onManageInvites={handleManageInvites}
              showCreateButton={shouldShowCreateButton}
              selectedCategory={selectedCategory}
              onMateriaInView={handleMateriaInView}
              onCalculateAllProgress={calculateAllRemainingProgress}
              progressLoadingStates={progressLoadingStates}
              showCreateModal={showCreateModal}
              setShowCreateModal={setShowCreateModal}
              examsByMateria={examsByMateria}
              isSchoolStudent={isSchoolStudent}
              isTeacher={isTeacher}
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
      
      {/* Modal para unirse a clase */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => {
          setShowJoinModal(false);
          setJoinCode('');
          setErrorMessage('');
          setSuccessMessage('');
        }}>
          <div className="modal-content create-materia-modal-new" onClick={(e) => e.stopPropagation()}>
            {/* Header simplificado */}
            <div className="modal-header-simple">
              <button 
                className="close-button-simple" 
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinCode('');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            {/* Contenido principal */}
            <div className="modal-main-content">
              <div className="modal-icon">
                <i className="fas fa-users" style={{ color: '#6147FF', fontSize: '2.5rem' }}></i>
              </div>
              <h2 className="modal-title">Unirse a una Clase</h2>
              <p className="modal-subtitle">Ingresa el código de invitación o pega el enlace que te proporcionó tu profesor</p>
              
              <form onSubmit={handleJoinClass} className="modal-form">
                <div className="input-group">
                  <input
                    id="joinCode"
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      setJoinCode(inputValue);
                      // Limpiar mensaje de error al cambiar el input
                      if (errorMessage) setErrorMessage('');
                    }}
                    onPaste={() => {
                      // No hacer nada en el onPaste, dejar que el usuario vea lo que pegó
                    }}
                    onKeyDown={handleJoinKeyPress}
                    placeholder="Pega el enlace o escribe el código (ej: ABC123)"
                    className="modal-input"
                    autoFocus
                    required
                    disabled={joiningClass}
                    maxLength={200}
                    style={{ 
                      textTransform: 'uppercase', 
                      letterSpacing: joinCode.length <= 8 ? '2px' : '0.5px', 
                      textAlign: 'center', 
                      fontSize: joinCode.length > 8 ? '0.9rem' : '1.2rem',
                      transition: 'all 0.2s ease'
                    }}
                  />
                  {isProcessingUrl && (
                    <div className="url-processing-indicator">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span>Extrayendo código...</span>
                    </div>
                  )}
                </div>
                
                {errorMessage && (
                  <div className="error-message">
                    <i className="fas fa-exclamation-triangle"></i>
                    {errorMessage}
                  </div>
                )}
                
                {successMessage && (
                  <div className="success-message">
                    <i className="fas fa-check-circle"></i>
                    {successMessage}
                  </div>
                )}
                
                <div className="modal-actions">
                  <button 
                    type="submit" 
                    className="modal-button primary"
                    disabled={joiningClass || !joinCode.trim()}
                  >
                    <i className="fas fa-sign-in-alt"></i>
                    {joiningClass ? 'Uniéndose...' : 'Unirse a Clase'}
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
      
      {/* Modal de confirmación para desenrolarse */}
      {showUnenrollModal && (
        <div className="modal-overlay" onClick={() => setShowUnenrollModal(false)}>
          <div className="modal-content create-materia-modal-new" onClick={(e) => e.stopPropagation()}>
            {/* Header simplificado */}
            <div className="modal-header-simple">
              <button 
                className="close-button-simple" 
                onClick={() => setShowUnenrollModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-main-content">
              <div className="modal-icon">
                <i className="fas fa-user-times" style={{ color: '#dc3545', fontSize: '2.5rem' }}></i>
              </div>
              <h2 className="modal-title">Confirmar Desenrolamiento</h2>
              <p className="modal-subtitle">
                ¿Estás seguro de que quieres desenrolarte de la materia <strong>"{unenrollMateriaTitle}"</strong>?
              </p>
              
              <div className="confirmation-warning" style={{
                background: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '8px',
                padding: '16px',
                margin: '20px 0',
                color: '#856404'
              }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px', color: '#f39c12' }}></i>
                Esta acción no se puede deshacer. Perderás acceso a todos los contenidos de esta materia.
              </div>
              
              <div className="modal-actions" style={{ gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowUnenrollModal(false)}
                  className="btn-cancel"
                  style={{ flex: '1' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmUnenroll}
                  className="btn-create"
                  style={{ 
                    flex: '1',
                    background: '#dc3545',
                    borderColor: '#dc3545'
                  }}
                >
                  Desenrolarse
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast notification for success messages */}
      {showToast && (
        <div className="success-toast">
          <i className="fas fa-check-circle"></i>
          {toastMessage}
        </div>
      )}
    </>
  );
};

export default Materias;