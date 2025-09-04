// src/pages/Notebooks.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotebooks } from '../hooks/useNotebooks';
import NotebookList from '../components/NotebookList';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import '../styles/Notebooks.css';
import { decodeMateriaName, parseMateriaNameWithId } from '../utils/urlUtils';
import StreakTracker from '../components/StreakTracker';
import { updateNotebook, updateNotebookColor } from '../services/notebookService';
import { useUserType } from '../hooks/useUserType';
import UserTypeBadge from '../components/UserTypeBadge';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
// import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import CategoryDropdown from '../components/CategoryDropdown';
import { UnifiedNotebookService } from '../services/unifiedNotebookService';
import { getDomainProgressForNotebook } from '../utils/domainProgress';
import { debugCompareDomainProgress } from '../utils/debugDomainProgress';

const Notebooks: React.FC = () => {
  const { materiaName } = useParams<{ materiaName: string }>();
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const { user, userProfile, loading: authLoading } = useAuth();
  const { notebooks, loading: notebooksLoading, error: notebooksError } = useNotebooks();
  // const { schoolNotebooks, loading: schoolNotebooksLoading } = useSchoolStudentData(); // deprecated
  const schoolNotebooks: any[] = [];
  const schoolNotebooksLoading = false;
  const [adminNotebooks, setAdminNotebooks] = useState<any[]>([]);
  const [adminNotebooksLoading, setAdminNotebooksLoading] = useState(false);
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [newNotebookDescription, setNewNotebookDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [materiaData, setMateriaData] = useState<any>(null);
  const navigate = useNavigate();
  const { isSchoolUser, isTeacher, isSchoolStudent, isSchoolAdmin, isSuperAdmin, subscription } = useUserType();

  const isFreeUser = subscription === 'free';

  // Debug log para verificar el estado de isSuperAdmin
  // console.log('Notebooks - isSuperAdmin:', isSuperAdmin);

  // UNIFICADO: Ya no redirigimos a estudiantes escolares, usamos la misma vista
  // Los estudiantes escolares ahora usan la misma interfaz que usuarios free/pro
  // con las adaptaciones necesarias en effectiveNotebooks (líneas 300-307)

  // Función temporal para verificar y actualizar usuario como súper admin
  const checkAndUpdateSuperAdmin = async () => {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.email === 'ruben.elhore@gmail.com') {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Current user data:', userData);
          if (userData.subscription !== 'super_admin') {
            console.log('Updating user to super admin...');
            await updateDoc(doc(db, 'users', currentUser.uid), {
              subscription: 'super_admin',
              updatedAt: serverTimestamp()
            });
            console.log('User updated to super admin');
            // Recargar la página para aplicar cambios
            window.location.reload();
          }
        }
      } catch (error) {
        console.error('Error updating user:', error);
      }
    }
  };

  // Función de prueba para navegar directamente
  const testNavigation = () => {
    console.log('Testing direct navigation to /super-admin');
    window.location.href = '/super-admin';
  };

  // Estados para el componente de personalización
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [userData, setUserData] = useState({
    nombre: '',
    apellidos: '',
    tipoAprendizaje: 'Visual', // Valor por defecto
    intereses: ['tecnología']
  });
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const personalizationRef = useRef<HTMLDivElement>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [notebooksDomainProgress, setNotebooksDomainProgress] = useState<Map<string, any>>(new Map());
  const [notebookRefreshTrigger, setNotebookRefreshTrigger] = useState(0);
  const [enrolledMateriaNotebooks, setEnrolledMateriaNotebooks] = useState<any[]>([]);
  const [enrolledMateriaLoading, setEnrolledMateriaLoading] = useState(false);
  const [isEnrolledMateria, setIsEnrolledMateria] = useState(false);

  // Effect to find materiaId by materiaName
  useEffect(() => {
    const findMateriaByName = async () => {
      if (!materiaName) {
        setMateriaId(null);
        return;
      }

      try {
        // Parsear el nombre y el ID de la materia del URL
        const { name: decodedName, id: materiaIdFromUrl } = parseMateriaNameWithId(materiaName);
        console.log('Parseado de URL - Nombre:', decodedName, 'ID:', materiaIdFromUrl);

        // Si tenemos un ID desde el URL, usarlo directamente
        if (materiaIdFromUrl) {
          setMateriaId(materiaIdFromUrl);
          
          // Obtener datos de la materia usando el ID
          const materiaDoc = await getDoc(doc(db, 'materias', materiaIdFromUrl));
          if (materiaDoc.exists()) {
            setMateriaData(materiaDoc.data());
            console.log('Materia encontrada por ID:', materiaIdFromUrl);
          } else {
            console.log('No se encontró materia con ID:', materiaIdFromUrl);
          }
          return;
        }

        // Si no hay ID, buscar por nombre (compatibilidad con URLs antiguos)
        console.log('Buscando materia con nombre:', decodedName);

        if (isSchoolAdmin || isTeacher) {
          // For school admins and teachers, search in schoolSubjects
          // Get ALL subjects with this name that belong to the teacher
          let allMateriaIds: string[] = [];
          
          if (isTeacher && userProfile?.id) {
            // For teachers, find all subjects with this name where they are the teacher
            const teacherDocId = userProfile.id;
            const teacherUid = user?.uid;
            
            // Query by teacher document ID
            if (teacherDocId) {
              const query1 = query(
                collection(db, 'schoolSubjects'),
                where('nombre', '==', decodedName),
                where('idProfesor', '==', teacherDocId)
              );
              const snapshot1 = await getDocs(query1);
              snapshot1.docs.forEach(doc => {
                if (!allMateriaIds.includes(doc.id)) {
                  allMateriaIds.push(doc.id);
                }
              });
            }
            
            // Query by teacher UID
            if (teacherUid && teacherUid !== teacherDocId) {
              const query2 = query(
                collection(db, 'schoolSubjects'),
                where('nombre', '==', decodedName),
                where('idProfesor', '==', teacherUid)
              );
              const snapshot2 = await getDocs(query2);
              snapshot2.docs.forEach(doc => {
                if (!allMateriaIds.includes(doc.id)) {
                  allMateriaIds.push(doc.id);
                }
              });
            }
            
            console.log(`Encontradas ${allMateriaIds.length} materias con nombre "${decodedName}" para el profesor`);
            console.log('IDs de materias:', allMateriaIds);
          } else {
            // For admins, get all subjects with this name in their school
            const schoolSubjectsQuery = query(
              collection(db, 'schoolSubjects'),
              where('nombre', '==', decodedName)
            );
            const querySnapshot = await getDocs(schoolSubjectsQuery);
            allMateriaIds = querySnapshot.docs.map(doc => doc.id);
          }
          
          if (allMateriaIds.length > 0) {
            // Store all materia IDs for teachers to load notebooks from all of them
            setMateriaId(allMateriaIds.join(','));
            console.log('Materias escolares encontradas:', allMateriaIds);
          } else {
            console.error('No se encontró la materia escolar:', decodedName);
          }
        } else {
          // For regular users, search in materias collection
          const materiasQuery = query(
            collection(db, 'materias'),
            where('title', '==', decodedName)
          );
          const querySnapshot = await getDocs(materiasQuery);
          
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            setMateriaId(doc.id);
            console.log('Materia encontrada:', doc.id);
          } else {
            // Try searching by 'nombre' field as fallback
            const nombreQuery = query(
              collection(db, 'materias'),
              where('nombre', '==', decodedName)
            );
            const nombreSnapshot = await getDocs(nombreQuery);
            
            if (!nombreSnapshot.empty) {
              const doc = nombreSnapshot.docs[0];
              setMateriaId(doc.id);
              console.log('Materia encontrada por nombre:', doc.id);
            } else {
              console.error('No se encontró la materia:', decodedName);
            }
          }
        }
      } catch (error) {
        console.error('Error finding materia by name:', error);
      }
    };

    findMateriaByName();
  }, [materiaName, isSchoolAdmin, isTeacher]);

  // Cargar datos de la materia
  useEffect(() => {
    const loadMateriaData = async () => {
      if (!materiaId) return;
      
      try {
        // Para todos los usuarios, buscar en materias (schoolSubjects ya no existe)
        // Check if materiaId contains multiple IDs (comma-separated)
        const materiaIds = materiaId.split(',');
        if (materiaIds.length > 1) {
          // Multiple materias with same name - just use the first one for display
          console.log('Multiple materias detected, using first for display:', materiaIds[0]);
        }
        
        const firstMateriaId = materiaIds[0];
        const materiaDoc = await getDoc(doc(db, 'materias', firstMateriaId));
        if (materiaDoc.exists()) {
          const data = materiaDoc.data();
          setMateriaData({ 
            id: materiaDoc.id, 
            title: data.title || data.nombre, // Support both title and nombre fields
            color: data.color || '#6147FF',
            ...data 
          });
        } else {
          // Si no existe la materia, crear datos básicos para no bloquear la funcionalidad
          console.log(`Materia ${firstMateriaId} no encontrada, usando datos por defecto`);
          setMateriaData({ 
            id: firstMateriaId, 
            title: 'Materia', 
            color: '#6147FF'
          });
        }
      } catch (error) {
        console.error('Error loading materia:', error);
        // En caso de error de permisos, usar datos básicos
        setMateriaData({ 
          id: materiaId || '', 
          title: 'Materia', 
          color: '#6147FF'
        });
      }
    };
    
    loadMateriaData();
  }, [materiaId, isSchoolAdmin, isTeacher]);

  // Verificar si el usuario está inscrito en esta materia y cargar notebooks del profesor
  useEffect(() => {
    const checkEnrollmentAndLoadNotebooks = async () => {
      if (!materiaId || !user || isSchoolAdmin || isSchoolStudent) return;
      
      console.log('🔍 Verificando si el usuario está inscrito en la materia:', materiaId);
      setEnrolledMateriaLoading(true);
      
      try {
        // Verificar si existe un enrollment activo para este usuario y materia
        const enrollmentQuery = query(
          collection(db, 'enrollments'),
          where('studentId', '==', user.uid),
          where('materiaId', '==', materiaId),
          where('status', '==', 'active')
        );
        
        const enrollmentSnapshot = await getDocs(enrollmentQuery);
        
        if (!enrollmentSnapshot.empty) {
          console.log('✅ Usuario inscrito en la materia, cargando notebooks del profesor');
          setIsEnrolledMateria(true);
          
          const enrollmentData = enrollmentSnapshot.docs[0].data();
          const teacherId = enrollmentData.teacherId;
          
          // Cargar notebooks del profesor para esta materia
          const teacherNotebooksQuery = query(
            collection(db, 'notebooks'),
            where('userId', '==', teacherId),
            where('materiaId', '==', materiaId)
          );
          
          const notebooksSnapshot = await getDocs(teacherNotebooksQuery);
          
          const notebooksData = await Promise.all(
            notebooksSnapshot.docs.map(async (doc) => {
              const data = doc.data();
              
              // Contar conceptos del notebook
              let conceptCount = 0;
              try {
                // Buscar conceptos en la subcolección concepts del notebook
                const subCollectionQuery = collection(db, 'notebooks', doc.id, 'concepts');
                const subCollectionSnapshot = await getDocs(subCollectionQuery);
                conceptCount += subCollectionSnapshot.size;
                
                // También buscar en la colección conceptos (legacy)
                const conceptsQuery = query(
                  collection(db, 'conceptos'),
                  where('cuadernoId', '==', doc.id)
                );
                const conceptsSnapshot = await getDocs(conceptsQuery);
                
                // Los documentos de conceptos legacy pueden tener arrays de conceptos
                conceptsSnapshot.docs.forEach(conceptDoc => {
                  const conceptData = conceptDoc.data();
                  if (conceptData.conceptos && Array.isArray(conceptData.conceptos)) {
                    conceptCount += conceptData.conceptos.length;
                  } else {
                    // Si es un concepto individual
                    conceptCount += 1;
                  }
                });
              } catch (error) {
                console.error(`Error counting concepts for notebook ${doc.id}:`, error);
              }
              
              return {
                id: doc.id,
                ...data,
                conceptCount,
                isFromTeacher: true, // Marcar que es del profesor
                isEnrolled: true // Marcar como notebook de materia inscrita
              };
            })
          );
          
          console.log('📚 Notebooks del profesor cargados:', notebooksData.length);
          setEnrolledMateriaNotebooks(notebooksData);
        } else {
          console.log('❌ Usuario NO inscrito en la materia');
          setIsEnrolledMateria(false);
          setEnrolledMateriaNotebooks([]);
        }
      } catch (error) {
        console.error('Error checking enrollment:', error);
        setIsEnrolledMateria(false);
        setEnrolledMateriaNotebooks([]);
      } finally {
        setEnrolledMateriaLoading(false);
      }
    };
    
    checkEnrollmentAndLoadNotebooks();
  }, [materiaId, user, isSchoolAdmin, isTeacher, isSchoolStudent]);

  // Cargar notebooks para admin escolar y profesores
  useEffect(() => {
    const loadAdminNotebooks = async () => {
      if ((!isSchoolAdmin && !isTeacher) || !materiaId) return;
      
      console.log('📚 loadAdminNotebooks - Iniciando carga');
      console.log('  - isSchoolAdmin:', isSchoolAdmin);
      console.log('  - isTeacher:', isTeacher);
      console.log('  - materiaId:', materiaId);
      
      setAdminNotebooksLoading(true);
      try {
        // Usar el servicio unificado para obtener notebooks del profesor/materia
        // Los profesores deben ver TODOS los notebooks de la materia, no solo los suyos
        // Solo pasamos teacherId si NO es profesor (para admin escolar)
        const teacherId = undefined; // Profesores ven todos los notebooks de la materia
        
        // Check if materiaId contains multiple IDs (comma-separated)
        const materiaIds = materiaId.split(',').filter(id => id.trim());
        console.log('  - Processing materia IDs:', materiaIds);
        
        const notebooksData = await UnifiedNotebookService.getTeacherNotebooks(materiaIds, teacherId);
        console.log('📚 Notebooks recibidos del servicio:', notebooksData.length);
        console.log('  - Notebooks detalle:', notebooksData);
        
        // Contar conceptos para cada notebook
        for (const notebook of notebooksData) {
          try {
            const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebook.id);
            const conceptsSnapshot = await getDocs(
              query(collection(db, conceptsCollection), where('cuadernoId', '==', notebook.id))
            );
            notebook.conceptCount = conceptsSnapshot.docs.reduce((total, doc) => {
              const data = doc.data();
              return total + (data.conceptos?.length || 0);
            }, 0);
          } catch (error) {
            console.error(`Error counting concepts for notebook ${notebook.id}:`, error);
            notebook.conceptCount = 0;
          }
        }
        
        setAdminNotebooks(notebooksData);
      } catch (error) {
        console.error('Error loading admin notebooks:', error);
      } finally {
        setAdminNotebooksLoading(false);
      }
    };
    
    loadAdminNotebooks();
  }, [isSchoolAdmin, isTeacher, materiaId, user, notebookRefreshTrigger]);

  useEffect(() => {
    if (user) {
      setUserEmail(user.email);
    }
  }, [user]);

  // Cargar datos del usuario cuando se monta el componente
  useEffect(() => {
    const loadUserData = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Buscar el nombre en múltiples campos para mayor compatibilidad
            const userName = data.nombre || data.displayName || data.username || user.displayName || '';
            
            setUserData({
              nombre: userName,
              apellidos: data.apellidos || '',
              tipoAprendizaje: data.tipoAprendizaje || 'Visual',
              intereses: data.intereses && data.intereses.length > 0 ? data.intereses : ['']
            });
          } else {
            // Si no existe el documento, usar el displayName de Firebase Auth
            setUserData({
              nombre: user.displayName || '',
              apellidos: '',
              tipoAprendizaje: 'Visual',
              intereses: ['']
            });
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          // En caso de error, usar el displayName de Firebase Auth
          setUserData({
            nombre: user.displayName || '',
            apellidos: '',
            tipoAprendizaje: 'Visual',
            intereses: ['']
          });
        }
      }
    };
    
    loadUserData();
  }, [user]);

  // Determine which notebooks to use based on user type
  let effectiveNotebooks = [];
  let isLoading = false;
  
  if (isSchoolStudent) {
    // Para estudiantes escolares
    console.log('🎓 ESTUDIANTE ESCOLAR DETECTADO');
    console.log('  - schoolNotebooks:', schoolNotebooks);
    console.log('  - schoolNotebooksLoading:', schoolNotebooksLoading);
    console.log('  - materiaId:', materiaId);
    console.log('  - userProfile:', userProfile);
    
    effectiveNotebooks = (schoolNotebooks || []).map(notebook => ({
      ...notebook,
      userId: notebook.userId || user?.uid || '',
      conceptCount: notebook.conceptCount || 0
    }));
    isLoading = schoolNotebooksLoading;
  } else if (isEnrolledMateria && enrolledMateriaNotebooks.length > 0) {
    // Para cualquier usuario inscrito como estudiante (incluidos profesores)
    console.log('📚 Usuario inscrito como estudiante - Mostrando notebooks del profesor');
    effectiveNotebooks = enrolledMateriaNotebooks.map(notebook => ({
      ...notebook,
      userId: notebook.userId || '',
      conceptCount: notebook.conceptCount || 0
    }));
    isLoading = enrolledMateriaLoading;
  } else if (isSchoolAdmin || isTeacher) {
    // Para admin escolar y profesores (cuando NO están inscritos como estudiantes)
    console.log('👨‍🏫 PROFESOR/ADMIN ESCOLAR - Notebooks cargados:', adminNotebooks.length);
    console.log('  - adminNotebooks:', adminNotebooks);
    console.log('  - materiaId:', materiaId);
    effectiveNotebooks = adminNotebooks.map(notebook => ({
      ...notebook,
      userId: notebook.userId || '',
      conceptCount: notebook.conceptCount || 0
    }));
    isLoading = adminNotebooksLoading;
  } else {
    // Para usuarios regulares sin inscripción
    effectiveNotebooks = notebooks || [];
    isLoading = notebooksLoading;
  }
  
  // Efecto para manejar la carga inicial y evitar el flash de contenido vacío
  useEffect(() => {
    // Si estamos navegando a una materia y aún no tenemos el materiaId, esperar
    if (materiaName && !materiaId) {
      setInitialLoadComplete(false);
      return;
    }
    
    // Si tenemos materiaId y estamos cargando notebooks de admin/profesor
    if (materiaId && (isSchoolAdmin || isTeacher) && adminNotebooksLoading) {
      setInitialLoadComplete(false);
      return;
    }
    
    // Si estamos cargando notebooks de materia inscrita
    if (materiaId && enrolledMateriaLoading) {
      setInitialLoadComplete(false);
      return;
    }
    
    // Si tenemos materiaId pero aún no hemos cargado notebooks (para profesores/admins)
    if (materiaId && (isSchoolAdmin || isTeacher) && adminNotebooks.length === 0 && !adminNotebooksLoading) {
      // Esperar un poco por si los notebooks están por cargar
      const timer = setTimeout(() => {
        setInitialLoadComplete(true);
      }, 100);
      return () => clearTimeout(timer);
    }
    
    // Para otros casos, marcar como completo cuando termine de cargar
    if (!isLoading && !adminNotebooksLoading && !enrolledMateriaLoading) {
      setInitialLoadComplete(true);
    }
  }, [isLoading, materiaId, materiaName, adminNotebooksLoading, enrolledMateriaLoading, isSchoolAdmin, isTeacher, adminNotebooks.length]);
  
  // Mostrar loading si:
  // 1. Estamos cargando auth
  // 2. O estamos buscando materiaId pero aún no lo tenemos (y sí tenemos materiaName)
  // 3. O estamos cargando notebooks (regulares, admin o enrolled)
  // 4. O no hemos completado la carga inicial
  const shouldShowLoading = authLoading || 
    (materiaName && !materiaId) ||
    isLoading || 
    adminNotebooksLoading ||
    enrolledMateriaLoading ||
    !initialLoadComplete;
    
  // Si estamos dentro de una materia, filtrar solo los notebooks de esa materia
  // Los profesores escolares no necesitan filtrado porque ya vienen filtrados del servicio
  if (materiaId && !isSchoolAdmin && !isTeacher) {
    // console.log('🔍 FILTRANDO NOTEBOOKS POR MATERIA');
    // console.log('  - Notebooks antes de filtrar:', effectiveNotebooks.length);
    // console.log('  - materiaId buscado:', materiaId);
    // console.log('  - isSchoolStudent:', isSchoolStudent);
    
    effectiveNotebooks = effectiveNotebooks.filter(notebook => {
      // Para estudiantes escolares el campo es 'idMateria', para usuarios regulares es 'materiaId'
      const notebookMateriaId = isSchoolStudent ? notebook.idMateria : notebook.materiaId;
      // console.log(`  - Notebook ${notebook.id}: campo=${isSchoolStudent ? 'idMateria' : 'materiaId'}=${notebookMateriaId}, buscado=${materiaId}`);
      return notebookMateriaId === materiaId;
    });
    
    // console.log('  - Notebooks después de filtrar:', effectiveNotebooks.length);
    // console.log('  - Notebooks filtrados:', effectiveNotebooks.map(n => ({ id: n.id, title: n.title, idMateria: n.idMateria })));
  }

  // Calcular progreso bajo demanda para evitar bucles infinitos
  const calculateProgressForNotebook = async (notebookId: string) => {
    if (notebooksDomainProgress.has(notebookId)) return; // Ya calculado
    
    try {
      const progress = await getDomainProgressForNotebook(notebookId);
      setNotebooksDomainProgress(prev => new Map(prev).set(notebookId, progress));
    } catch (error) {
      console.error(`Error calculating progress for notebook ${notebookId}:`, error);
    }
  };

  // Calcular progreso de todos los notebooks en paralelo
  useEffect(() => {
    if (!effectiveNotebooks || effectiveNotebooks.length === 0) return;
    
    const timeoutId = setTimeout(async () => {
      // Calcular todos los progresos en paralelo
      const progressPromises = effectiveNotebooks.map(async (notebook) => {
        if (!notebooksDomainProgress.has(notebook.id)) {
          try {
            const progress = await getDomainProgressForNotebook(notebook.id);
            return { notebookId: notebook.id, progress };
          } catch (error) {
            console.error(`Error calculating progress for notebook ${notebook.id}:`, error);
            return null;
          }
        }
        return null;
      });

      // Esperar a que todos terminen
      const results = await Promise.all(progressPromises);
      
      // Actualizar todos los progresos al mismo tiempo
      if (results.some(result => result !== null)) {
        setNotebooksDomainProgress(prev => {
          const newMap = new Map(prev);
          results.forEach(result => {
            if (result) {
              newMap.set(result.notebookId, result.progress);
            }
          });
          return newMap;
        });
      }
    }, 500); // Esperar 500ms antes de calcular

    return () => clearTimeout(timeoutId);
  }, [effectiveNotebooks?.length]); // Solo depende de la longitud
  
  // Función temporal de debug
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugNotebookProgress = async (notebookId: string) => {
        console.log('🔍 Running domain progress debug...');
        await debugCompareDomainProgress(notebookId);
      };
      console.log('💡 Debug function available: window.debugNotebookProgress(notebookId)');
    }
  }, []);

  const handleCreate = async (title?: string, color?: string) => {
    console.log('🎯 handleCreate llamado con:', { title, color, user: user?.uid, materiaId, isTeacher, isSchoolAdmin });
    
    if (!user || !materiaId || !title || !color) {
      console.error('❌ Faltan parámetros requeridos:', { 
        hasUser: !!user, 
        hasMateriaId: !!materiaId, 
        hasTitle: !!title, 
        hasColor: !!color 
      });
      return;
    }
    
    try {
      // TODOS los usuarios (incluidos profesores) crean notebooks en la colección regular 'notebooks'
      // Ya no usamos schoolNotebooks porque está deprecated
      console.log('📝 Creando notebook para usuario:', user.uid);
      console.log('  - materiaId:', materiaId);
      console.log('  - isTeacher:', isTeacher);
      console.log('  - isSchoolAdmin:', isSchoolAdmin);
      
      const newNotebook = {
        title,
        color,
        materiaId: materiaId,
        userId: user.uid,
        // Agregar metadata adicional para profesores
        isTeacherNotebook: isTeacher || false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      console.log('📝 Datos del notebook a crear:', {
        ...newNotebook,
        createdAt: '[ServerTimestamp]',
        updatedAt: '[ServerTimestamp]'
      });
      
      const docRef = await addDoc(collection(db, 'notebooks'), newNotebook);
      console.log('✅ Notebook creado con ID:', docRef.id);
      
      // Verificar que se creó correctamente
      const verifyDoc = await getDoc(doc(db, 'notebooks', docRef.id));
      if (verifyDoc.exists()) {
        const data = verifyDoc.data();
        console.log('✅ Verificación - Notebook creado con datos:', {
          id: docRef.id,
          materiaId: data.materiaId,
          userId: data.userId,
          title: data.title,
          isTeacherNotebook: data.isTeacherNotebook
        });
      } else {
        console.error('❌ Error: El notebook no se encontró después de crearlo');
      }
      
      console.log("Notebook created successfully");
      // Forzar actualización de categorías y notebooks
      setRefreshTrigger(prev => prev + 1);
      
      // Recargar notebooks de admin/profesor si es necesario
      if (isSchoolAdmin || isTeacher) {
        console.log('🔄 Recargando notebooks después de crear uno nuevo');
        
        // Pequeña espera para asegurar que Firestore indexe el documento
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const teacherId = isTeacher ? user.uid : undefined;
        console.log('  - Buscando notebooks con teacherId:', teacherId);
        const notebooksData = await UnifiedNotebookService.getTeacherNotebooks([materiaId], teacherId);
        console.log('📚 Notebooks recargados:', notebooksData.length);
        console.log('  - Detalle de notebooks:', notebooksData.map(n => ({ 
          id: n.id, 
          title: n.title, 
          idProfesor: n.idProfesor 
        })));
        setAdminNotebooks(notebooksData);
        
        // Trigger useEffect para recargar notebooks
        setNotebookRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error creating notebook:", error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    console.log(`🗑️ Intentando eliminar notebook con id ${id}`);
    
    try {
      // TODOS los usuarios (incluidos profesores) eliminan de la colección regular 'notebooks'
      // Primero verificar que el notebook existe y pertenece al usuario
      const notebookDoc = await getDoc(doc(db, 'notebooks', id));
      
      if (notebookDoc.exists()) {
        const notebookData = notebookDoc.data();
        
        // Solo permitir eliminar si es el dueño del notebook o super admin
        if (notebookData.userId === user?.uid || isSchoolAdmin) {
          await deleteDoc(doc(db, 'notebooks', id));
          console.log(`✅ Notebook ${id} eliminado exitosamente`);
          
          // Recargar notebooks si es profesor
          if (isTeacher || isSchoolAdmin) {
            const teacherId = isTeacher ? user?.uid : undefined;
            const notebooksData = await UnifiedNotebookService.getTeacherNotebooks([materiaId!], teacherId);
            setAdminNotebooks(notebooksData);
          }
        } else {
          console.error('❌ No tienes permisos para eliminar este notebook');
          alert('No tienes permisos para eliminar este notebook');
        }
      } else {
        console.error('❌ Notebook no encontrado');
        alert('El notebook no existe o ya fue eliminado');
      }
      
      // Forzar actualización de categorías y notebooks
      setRefreshTrigger(prev => prev + 1);
      setNotebookRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('❌ Error eliminando notebook:', error);
      alert('Error al eliminar el cuaderno');
    }
  };

  const handleEdit = async (id: string, newTitle: string) => {
    console.log('handleEdit llamado con:', { id, newTitle, userId: user?.uid });
    if (!user?.uid) return;
    
    try {
      console.log('Llamando a updateNotebook...');
      await updateNotebook(id, newTitle, user.uid);
      console.log("Título actualizado en Firestore");
      // Forzar actualización de categorías
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error actualizando el título:", error);
      console.error("Tipo de error:", typeof error);
      console.error("Mensaje de error:", error instanceof Error ? error.message : 'Error desconocido');
      
      // Si es un error de nombre duplicado, solo lanzar la excepción
      if (error instanceof Error && error.message.includes('Ya existe una materia con ese nombre')) {
        console.log('Error de nombre duplicado detectado, lanzando excepción');
        // No mostrar alert, el error se muestra visualmente en el input
        throw error;
      } else {
        console.log('Error no es de nombre duplicado, mostrando alert genérico');
        throw error;
      }
    }
  };

  const handleColorChange = async (id: string, newColor: string) => {
    try {
      await updateNotebookColor(id, newColor);
    } catch (error) {
      console.error("Error updating notebook color:", error);
    }
  };

  const handleFreezeNotebook = async (id: string, type: 'now' | 'scheduled' = 'now', scheduledDate?: Date) => {
    try {
      console.log('🔄 Starting freeze/unfreeze for notebook:', id);
      const notebook = effectiveNotebooks.find(n => n.id === id);
      if (!notebook) {
        console.error('❌ Notebook not found in local state:', id);
        return;
      }

      console.log('📋 Notebook data:', {
        id: notebook.id,
        userId: notebook.userId,
        currentUserId: user?.uid,
        isOwner: notebook.userId === user?.uid,
        isFrozen: notebook.isFrozen
      });

      // Intentar primero un test simple de lectura
      console.log('🔍 Testing Firestore access...');
      console.log('📍 MateriaId:', materiaId);
      
      // Determinar la referencia correcta del documento
      let notebookRef;
      let docSnap;
      
      // Primero intentar en la colección notebooks normal
      notebookRef = doc(db, 'notebooks', id);
      console.log('📖 Attempting to read from notebooks collection...');
      docSnap = await getDoc(notebookRef);
      
      // Si no existe en notebooks, intentar en la subcolección de materias
      if (!docSnap.exists() && materiaId) {
        console.log('🔄 Not found in notebooks, trying materias subcollection...');
        notebookRef = doc(db, 'materias', materiaId, 'notebooks', id);
        docSnap = await getDoc(notebookRef);
      }
      
      // Si aún no existe, intentar en schoolNotebooks
      if (!docSnap.exists()) {
        console.log('🔄 Not found, trying schoolNotebooks collection...');
        notebookRef = doc(db, 'schoolNotebooks', id);
        docSnap = await getDoc(notebookRef);
      }
      
      if (!docSnap.exists()) {
        console.error('❌ Document does not exist in any collection');
        alert('El cuaderno no existe en la base de datos');
        return;
      }
      
      console.log('✅ Document found in:', notebookRef.path);
      
      const currentData = docSnap.data();
      console.log('📄 Current document data:', currentData);
      
      const newFrozenState = !notebook.isFrozen;
      const updateData: any = {
        isFrozen: newFrozenState
      };
      
      if (newFrozenState) {
        updateData.frozenAt = Timestamp.now();
      } else {
        updateData.frozenAt = null;
      }
      
      console.log('🔐 Attempting to update with:', updateData);
      console.log('📝 Updating document at path:', notebookRef.path);
      
      await updateDoc(notebookRef, updateData);
      
      console.log('✅ Notebook freeze state updated successfully');
      
      // Mostrar mensaje de éxito
      const message = newFrozenState 
        ? '🔒 Cuaderno congelado exitosamente' 
        : '🔓 Cuaderno descongelado exitosamente';
      alert(message);
      
      // Recargar la página para actualizar el estado
      window.location.reload();
    } catch (error) {
      console.error("❌ Error toggling freeze state:", error);
      alert("Error al cambiar el estado de congelación del cuaderno");
    }
  };

  const handleAddConcept = (notebookId: string) => {
    // Navegar a la página de detalles del cuaderno con parámetro para abrir modal automáticamente
    if (materiaName) {
      // Find the notebook to get its name for URL navigation
      const notebook = effectiveNotebooks.find(nb => nb.id === notebookId);
      if (notebook) {
        const encodedNotebookName = encodeURIComponent(notebook.title);
        navigate(`/materias/${materiaName}/notebooks/${encodedNotebookName}?openModal=true`);
      }
    } else {
      // For notebooks outside of materias, still use ID-based navigation
      navigate(`/notebooks/${notebookId}?openModal=true`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    // Añadir un pequeño delay antes de navegar
    setTimeout(() => {
      navigate('/');
    }, 100);
  };

  const toggleMenu = () => {
    setMenuOpen(prevState => !prevState);
    // Prevenir scroll cuando el menú está abierto
    if (!menuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('menu-open');
    } else {
      document.body.style.overflow = 'auto';
      document.body.classList.remove('menu-open');
    }
  };

  // Modificar el handler de personalización para navegar a ProfilePage
  const handleOpenPersonalization = () => {
    navigate('/profile');
  };

  const handleClosePersonalization = () => {
    setIsPersonalizationOpen(false);
  };

  // Efecto para cerrar el modal al hacer clic fuera de él
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (personalizationRef.current && !personalizationRef.current.contains(event.target as Node)) {
        setIsPersonalizationOpen(false);
      }
    }
    
    if (isPersonalizationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPersonalizationOpen]);

  // Efecto para limpiar el estado del body cuando el componente se desmonte
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
      document.body.classList.remove('menu-open');
    };
  }, []);

  // Efecto para cerrar el menú con la tecla Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) {
        toggleMenu();
      }
    };

    if (menuOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  // Manejar cambios en los campos de personalización
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  // Manejar cambios en los intereses
  const handleInterestChange = (index: number, value: string) => {
    const updatedInterests = [...userData.intereses];
    updatedInterests[index] = value;
    setUserData(prevData => ({
      ...prevData,
      intereses: updatedInterests
    }));
  };

  // Añadir un nuevo interés
  const addInterest = () => {
    if (userData.intereses.length < 12) {
      setUserData(prevData => ({
        ...prevData,
        intereses: [...prevData.intereses, '']
      }));
    }
  };

  // Eliminar un interés
  const removeInterest = (index: number) => {
    const updatedInterests = userData.intereses.filter((_, i) => i !== index);
    setUserData(prevData => ({
      ...prevData,
      intereses: updatedInterests.length ? updatedInterests : ['']
    }));
  };

  // Guardar datos de personalización
  const handleSavePersonalization = async () => {
    if (!user?.uid) return;
    
    setIsLoadingAction(true);
    
    try {
      // Filtrar intereses vacíos
      const filteredInterests = userData.intereses.filter(interest => interest.trim() !== '');
      
      // Crear objeto con datos del usuario
      const userDataToSave = {
        ...userData,
        intereses: filteredInterests,
        updatedAt: new Date()
      };
      
      // Guardar en Firestore
      await setDoc(doc(db, 'users', user.uid), userDataToSave, { merge: true });
      
      setSuccessMessage('¡Datos guardados correctamente!');
      setIsLoadingAction(false);
      
      // Opcional: cerrar modal después de un tiempo
      setTimeout(() => {
        setIsPersonalizationOpen(false);
        setSuccessMessage('');
      }, 2000);
    } catch (error) {
      console.error("Error saving user data:", error);
      setIsLoadingAction(false);
    }
  };

  const handleOpenUpgradeModal = () => {
    setIsUpgradeModalOpen(true);
    setMenuOpen(false);
  };

  const handleCloseUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  // Función para enviar solicitud Pro
  const handleRequestPro = async () => {
    if (!user || !userProfile) {
      alert('Error: No se pudo obtener la información del usuario');
      return;
    }

    try {
      const proRequestRef = doc(collection(db, 'proRequests'));
      await setDoc(proRequestRef, {
        userId: user.uid,
        userEmail: user.email,
        userName: userProfile.nombre || userProfile.displayName || user.displayName || 'Usuario',
        currentSubscription: subscription || 'FREE',
        status: 'pending',
        requestedAt: serverTimestamp(),
        reason: 'Solicitud desde modal de upgrade en Notebooks'
      });

      alert('¡Solicitud enviada correctamente! Te notificaremos cuando sea procesada.');
      setIsUpgradeModalOpen(false);
    } catch (error) {
      console.error('Error al enviar solicitud Pro:', error);
      alert('Error al enviar la solicitud. Por favor, inténtalo de nuevo.');
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

  if (shouldShowLoading) {
    return (
      <>
        <HeaderWithHamburger
          title={materiaData ? materiaData.title : ""}
          subtitle={materiaData ? `Cuadernos de ${materiaData.title}` : `Espacio Personal de ${userData.nombre || 'Simón'}`}
          showBackButton={!!materiaId}
          onBackClick={() => navigate('/materias')}
          themeColor={materiaData?.color}
        />
        <main className="notebooks-main notebooks-main-no-sidebar">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Cargando {materiaId ? 'cuadernos' : 'materias'}...</p>
          </div>
        </main>
      </>
    );
  }

  if (!isSchoolStudent && !isSchoolAdmin && !isTeacher && notebooksError) {
    console.error('Error loading notebooks:', notebooksError);
    return (
      <>
        <HeaderWithHamburger
          title=""
          subtitle="Error"
          showBackButton={!!materiaId}
          onBackClick={() => navigate('/materias')}
          themeColor={materiaData?.color}
        />
        <main className="notebooks-main notebooks-main-no-sidebar">
          <div className="error-container">
            <h2>Error al cargar las materias</h2>
            <p>{notebooksError.message}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <HeaderWithHamburger
        title={materiaData ? materiaData.title : ""}
        subtitle={materiaData ? `Cuadernos de ${materiaData.title}` : `Espacio Personal de ${userData.nombre || 'Simón'}`}
        showBackButton={!!materiaId}
        onBackClick={() => navigate('/materias')}
        themeColor={materiaData?.color}
      />
      {/* Overlay y menú lateral ya están dentro del header */}
      <main className="notebooks-main notebooks-main-no-sidebar">
        {isSchoolAdmin && (
          <div className="admin-info-message" style={{
            background: '#f0ebff',
            border: '1px solid #6147FF',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#4a5568'
          }}>
            <i className="fas fa-info-circle" style={{ marginRight: '0.5rem', color: '#6147FF' }}></i>
            <span>Como administrador, tienes acceso de solo lectura a los cuadernos y conceptos.</span>
          </div>
        )}
        {isSchoolStudent && effectiveNotebooks.length > 0 && (
          <div className="student-info-message" style={{
            background: '#e8f5e9',
            border: '1px solid #4caf50',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#2e7d32'
          }}>
            <i className="fas fa-book-reader" style={{ marginRight: '0.5rem', color: '#4caf50' }}></i>
            <span>Estos son los cuadernos de tu profesor para esta materia. Puedes ver y estudiar los conceptos.</span>
          </div>
        )}
        <div className="notebooks-list-section notebooks-list-section-full">
          {/* {console.log('🏫 Notebooks.tsx passing to NotebookList:', {
            isSchoolStudent,
            isSchoolAdmin, 
            isEnrolledMateria,
            isTeacher,
            effectiveNotebooksCount: effectiveNotebooks.length,
            shouldAllowEdit: !(isSchoolStudent || isEnrolledMateria)
          })} */}
          <NotebookList 
            notebooks={effectiveNotebooks.map(notebook => ({
              id: notebook.id,
              title: notebook.title,
              color: notebook.color,
              category: notebook.category,
              userId: notebook.userId || user?.uid || '',
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
              domainProgress: notebooksDomainProgress.get(notebook.id),
              isStudent: isSchoolStudent,
              isFrozen: notebook.isFrozen,
              frozenScore: notebook.frozenScore,
              frozenAt: notebook.frozenAt,
              isEnrolled: notebook.isEnrolled || false
            }))} 
            onDeleteNotebook={(isSchoolStudent || isEnrolledMateria) ? undefined : handleDelete} 
            onEditNotebook={(isSchoolStudent || isEnrolledMateria) ? undefined : handleEdit}
            onColorChange={(isSchoolStudent || isEnrolledMateria) ? undefined : handleColorChange}
            onCreateNotebook={(isSchoolStudent || isEnrolledMateria) ? undefined : handleCreate}
            onAddConcept={(isSchoolStudent || isEnrolledMateria) ? undefined : handleAddConcept}
            onFreezeNotebook={handleFreezeNotebook}
            showCreateButton={!isSchoolStudent && !isSchoolAdmin && !isEnrolledMateria}
            isSchoolTeacher={isTeacher} // Pasar el valor correcto para profesores
            isEnrolledMateria={isEnrolledMateria}
            isUserTeacher={isTeacher}
            selectedCategory={selectedCategory}
            showCategoryModal={showCategoryModal}
            onCloseCategoryModal={() => setShowCategoryModal(false)}
            onClearSelectedCategory={handleClearSelectedCategory}
            onRefreshCategories={() => setRefreshTrigger(prev => prev + 1)}
            materiaColor={materiaData?.color}
            materiaId={materiaId || undefined}
          />
        </div>
      </main>
      {/* Modal de personalización */}
      {isPersonalizationOpen && (
        <div className="modal-overlay">
          <div className="modal-content personalization-modal" ref={personalizationRef}>
            <div className="modal-header">
              <h2>Personalización</h2>
              <button className="close-button" onClick={handleClosePersonalization}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="nombre">Nombre</label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  value={userData.nombre}
                  onChange={handleInputChange}
                  placeholder="Tu nombre"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="apellidos">Apellido(s)</label>
                <input
                  type="text"
                  id="apellidos"
                  name="apellidos"
                  value={userData.apellidos}
                  onChange={handleInputChange}
                  placeholder="Tus apellidos"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="tipoAprendizaje">Tipo de aprendizaje predilecto</label>
                <select
                  id="tipoAprendizaje"
                  name="tipoAprendizaje"
                  value={userData.tipoAprendizaje}
                  onChange={handleInputChange}
                  className="form-control"
                >
                  <option value="Visual">Visual</option>
                  <option value="Auditivo">Auditivo</option>
                  <option value="Kinestésico">Kinestésico</option>
                </select>
              </div>
              <div className="form-group">
                <label>Intereses (máximo 12)</label>
                {userData.intereses.map((interes, index) => (
                  <div key={index} className="interest-input-group">
                    <input
                      type="text"
                      value={interes}
                      onChange={(e) => handleInterestChange(index, e.target.value)}
                      placeholder="Ej: cocina, deportes, tecnología"
                      className="form-control interest-input"
                    />
                    <button
                      type="button"
                      onClick={() => removeInterest(index)}
                      className="remove-interest-btn"
                      disabled={userData.intereses.length === 1}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
                {userData.intereses.length < 12 && (
                  <button
                    type="button"
                    onClick={addInterest}
                    className="add-interest-btn"
                  >
                    <i className="fas fa-plus"></i> Añadir interés
                  </button>
                )}
              </div>
              {successMessage && (
                <div className="success-message">
                  {successMessage}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="save-button"
                onClick={handleSavePersonalization}
                disabled={isLoadingAction}
              >
                {isLoadingAction ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isUpgradeModalOpen && (
        <div className="modal-overlay">
          <div className="upgrade-modal-content">
            <div className="modal-header">
              <h2>🚀 Upgrade a Pro</h2>
              <button className="close-button" onClick={handleCloseUpgradeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="upgrade-motivational-section">
                <h3>💡 Invierte en tu futuro y desarrollo</h3>
                <p className="motivational-text">
                  Al hacer el upgrade a Pro, no solo estás desbloqueando funcionalidades avanzadas, 
                  sino que estás invirtiendo en tu crecimiento personal y profesional. 
                  Cada concepto que aprendas, cada herramienta que utilices, 
                  te acerca un paso más a tus metas y objetivos.
                </p>
                <p className="motivational-text">
                  <strong>¡Tu desarrollo es nuestra prioridad!</strong> 
                  Descubre todo el potencial que Simonkey Pro tiene para ofrecerte.
                </p>
              </div>
              
              <div className="upgrade-action-section">
                <h4>🚀 ¿Listo para el siguiente nivel?</h4>
                <p>Envía tu solicitud para upgrade a Pro y nuestro equipo la revisará:</p>
                <button 
                  className="request-pro-btn"
                  onClick={handleRequestPro}
                >
                  <i className="fas fa-star"></i>
                  Solicitar Upgrade a Pro
                </button>
                <p className="request-note">
                  Revisaremos tu solicitud y te notificaremos el resultado en tu cuenta.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Notebooks;