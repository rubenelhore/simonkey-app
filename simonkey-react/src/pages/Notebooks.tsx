// src/pages/Notebooks.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotebooks } from '../hooks/useNotebooks';
import NotebookList from '../components/NotebookList';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import '../styles/Notebooks.css';
import { decodeMateriaName } from '../utils/urlUtils';
import StreakTracker from '../components/StreakTracker';
import { updateNotebook, updateNotebookColor } from '../services/notebookService';
import { useUserType } from '../hooks/useUserType';
import UserTypeBadge from '../components/UserTypeBadge';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import CategoryDropdown from '../components/CategoryDropdown';
import { UnifiedNotebookService } from '../services/unifiedNotebookService';
import { getDomainProgressForNotebook } from '../utils/domainProgress';
import { debugCompareDomainProgress } from '../utils/debugDomainProgress';

const Notebooks: React.FC = () => {
  const { materiaName } = useParams<{ materiaName: string }>();
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const { user, userProfile, loading: authLoading } = useAuth();
  const { notebooks, loading: notebooksLoading, error: notebooksError } = useNotebooks();
  const { schoolNotebooks, loading: schoolNotebooksLoading } = useSchoolStudentData();
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
  const { isSchoolUser, isSchoolTeacher, isSchoolStudent, isSchoolAdmin, isSuperAdmin, subscription } = useUserType();

  const isFreeUser = subscription === 'free';

  // Debug log para verificar el estado de isSuperAdmin
  console.log('Notebooks - isSuperAdmin:', isSuperAdmin);

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
  const [notebooksDomainProgress, setNotebooksDomainProgress] = useState<Map<string, any>>(new Map());
  const [notebookRefreshTrigger, setNotebookRefreshTrigger] = useState(0);

  // Effect to find materiaId by materiaName
  useEffect(() => {
    const findMateriaByName = async () => {
      if (!materiaName) {
        setMateriaId(null);
        return;
      }

      try {
        const decodedName = decodeMateriaName(materiaName);
        console.log('Buscando materia con nombre:', decodedName);

        if (isSchoolAdmin || isSchoolTeacher) {
          // For school admins and teachers, search in schoolSubjects
          const schoolSubjectsQuery = query(
            collection(db, 'schoolSubjects'),
            where('nombre', '==', decodedName)
          );
          const querySnapshot = await getDocs(schoolSubjectsQuery);
          
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            setMateriaId(doc.id);
            console.log('Materia escolar encontrada:', doc.id);
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
  }, [materiaName, isSchoolAdmin, isSchoolTeacher]);

  // Cargar datos de la materia
  useEffect(() => {
    const loadMateriaData = async () => {
      if (!materiaId) return;
      
      try {
        // Si es admin escolar o profesor, buscar en schoolSubjects
        if (isSchoolAdmin || isSchoolTeacher) {
          const materiaDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
          if (materiaDoc.exists()) {
            const data = materiaDoc.data();
            setMateriaData({ 
              id: materiaDoc.id, 
              title: data.nombre,
              color: data.color || '#6147FF',
              ...data 
            });
          }
        } else {
          // Para usuarios regulares, buscar en materias
          const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
          if (materiaDoc.exists()) {
            setMateriaData({ id: materiaDoc.id, ...materiaDoc.data() });
          }
        }
      } catch (error) {
        console.error('Error loading materia:', error);
      }
    };
    
    loadMateriaData();
  }, [materiaId, isSchoolAdmin, isSchoolTeacher]);

  // Cargar notebooks para admin escolar y profesores
  useEffect(() => {
    const loadAdminNotebooks = async () => {
      if ((!isSchoolAdmin && !isSchoolTeacher) || !materiaId) return;
      
      console.log('📚 loadAdminNotebooks - Iniciando carga');
      console.log('  - isSchoolAdmin:', isSchoolAdmin);
      console.log('  - isSchoolTeacher:', isSchoolTeacher);
      console.log('  - materiaId:', materiaId);
      
      setAdminNotebooksLoading(true);
      try {
        // Usar el servicio unificado para obtener notebooks del profesor/materia
        // Para profesores, pasar su ID para filtrar solo sus notebooks
        const teacherId = isSchoolTeacher ? user?.uid : undefined;
        const notebooksData = await UnifiedNotebookService.getTeacherNotebooks([materiaId], teacherId);
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
  }, [isSchoolAdmin, isSchoolTeacher, materiaId, user, notebookRefreshTrigger]);

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
  
  if (isSchoolAdmin || isSchoolTeacher) {
    // Para admin escolar y profesores, usar los notebooks cargados específicamente
    console.log('👨‍🏫 PROFESOR/ADMIN ESCOLAR - Notebooks cargados:', adminNotebooks.length);
    console.log('  - adminNotebooks:', adminNotebooks);
    console.log('  - materiaId:', materiaId);
    effectiveNotebooks = adminNotebooks.map(notebook => ({
      ...notebook,
      userId: notebook.userId || '',
      conceptCount: notebook.conceptCount || 0
    }));
    isLoading = adminNotebooksLoading;
  } else if (isSchoolStudent) {
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
  } else {
    // Para usuarios regulares
    effectiveNotebooks = notebooks || [];
    isLoading = notebooksLoading;
  }
    
  // Si estamos dentro de una materia, filtrar solo los notebooks de esa materia
  // TEMPORAL: Para estudiantes escolares NO filtrar, mostrar todos sus cuadernos
  // porque hay un problema con múltiples materias "Biología" con diferentes IDs
  // Los profesores escolares tampoco necesitan filtrado porque ya vienen filtrados del servicio
  if (materiaId && !isSchoolAdmin && !isSchoolTeacher && !isSchoolStudent) {
    console.log('🔍 FILTRANDO NOTEBOOKS POR MATERIA (solo usuarios free/pro)');
    console.log('  - Notebooks antes de filtrar:', effectiveNotebooks.length);
    console.log('  - materiaId buscado:', materiaId);
    console.log('  - isSchoolStudent:', isSchoolStudent);
    console.log('  - isSchoolTeacher:', isSchoolTeacher);
    
    effectiveNotebooks = effectiveNotebooks.filter(notebook => {
      // Para usuarios regulares es 'materiaId'
      const notebookMateriaId = notebook.materiaId;
      console.log(`  - Notebook ${notebook.id}: materiaId=${notebook.materiaId}, notebookMateriaId=${notebookMateriaId}`);
      return notebookMateriaId === materiaId;
    });
    
    console.log('  - Notebooks después de filtrar:', effectiveNotebooks.length);
  } else if (isSchoolStudent && materiaId) {
    console.log('📚 ESTUDIANTE ESCOLAR: Mostrando TODOS sus cuadernos sin filtrar por materia');
    console.log('  - Total cuadernos del estudiante:', effectiveNotebooks.length);
    console.log('  - Razón: Problema temporal con IDs de materias duplicadas');
    // NO filtrar para estudiantes escolares
  }

  // Ahora sí, calcula el domainProgress para todos los cuadernos
  useEffect(() => {
    const calculateAllDomainProgress = async () => {
      if (!effectiveNotebooks || effectiveNotebooks.length === 0) return;
      const progressMap = new Map();
      for (const notebook of effectiveNotebooks) {
        try {
          const progress = await getDomainProgressForNotebook(notebook.id);
          progressMap.set(notebook.id, progress);
        } catch (error) {
          console.error(`Error calculating progress for notebook ${notebook.id}:`, error);
        }
      }
      setNotebooksDomainProgress(progressMap);
    };
    calculateAllDomainProgress();
  }, [notebooks?.length, schoolNotebooks?.length, adminNotebooks?.length, user?.uid, materiaId]);
  
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
    console.log('🎯 handleCreate llamado con:', { title, color, user: user?.uid, materiaId, isSchoolTeacher, isSchoolAdmin });
    
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
      // Determinar si es un notebook escolar o regular
      if (isSchoolAdmin || isSchoolTeacher) {
        // Crear notebook escolar
        console.log('📝 Creando notebook escolar para profesor/admin');
        console.log('  - materiaId:', materiaId);
        console.log('  - userId:', user.uid);
        
        const newNotebook = {
          title,
          color,
          idMateria: materiaId,
          idProfesor: user.uid, // Importante: agregar idProfesor para profesores
          userId: user.uid,
          type: 'school', // Agregar type explícitamente
          conceptCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        console.log('📝 Datos del notebook a crear:', {
          ...newNotebook,
          createdAt: '[ServerTimestamp]',
          updatedAt: '[ServerTimestamp]'
        });
        
        const docRef = await addDoc(collection(db, 'schoolNotebooks'), newNotebook);
        console.log('✅ Notebook escolar creado con ID:', docRef.id);
        
        // Verificar que se creó correctamente
        const verifyDoc = await getDoc(doc(db, 'schoolNotebooks', docRef.id));
        if (verifyDoc.exists()) {
          const data = verifyDoc.data();
          console.log('✅ Verificación - Notebook creado con datos:', {
            id: docRef.id,
            idMateria: data.idMateria,
            idProfesor: data.idProfesor,
            title: data.title
          });
        } else {
          console.error('❌ Error: El notebook no se encontró después de crearlo');
        }
      } else {
        // Crear notebook regular
        await addDoc(collection(db, 'notebooks'), {
          title,
          color,
          materiaId: materiaId,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      console.log("Notebook created successfully");
      // Forzar actualización de categorías y notebooks
      setRefreshTrigger(prev => prev + 1);
      
      // Recargar notebooks de admin/profesor si es necesario
      if (isSchoolAdmin || isSchoolTeacher) {
        console.log('🔄 Recargando notebooks después de crear uno nuevo');
        
        // Pequeña espera para asegurar que Firestore indexe el documento
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const teacherId = isSchoolTeacher ? user.uid : undefined;
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

  const handleDelete = (id: string) => {
    console.log(`Notebook with id ${id} deleted successfully`);
    // Forzar actualización de categorías
    setRefreshTrigger(prev => prev + 1);
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

  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
  };

  const handleCreateCategory = () => {
    setShowCategoryModal(true);
  };

  const handleClearSelectedCategory = () => {
    setSelectedCategory(null);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando materias...</p>
      </div>
    );
  }

  if (!isSchoolStudent && notebooksError) {
    console.error('Error loading notebooks:', notebooksError);
    return (
      <div className="error-container">
        <h2>Error al cargar las materias</h2>
        <p>{notebooksError.message}</p>
      </div>
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
        <div className="notebooks-list-section notebooks-list-section-full">
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
              frozenAt: notebook.frozenAt
            }))} 
            onDeleteNotebook={isSchoolStudent ? undefined : handleDelete} 
            onEditNotebook={isSchoolStudent ? undefined : handleEdit}
            onColorChange={isSchoolStudent ? undefined : handleColorChange}
            onCreateNotebook={isSchoolStudent ? undefined : handleCreate}
            onAddConcept={isSchoolStudent ? undefined : handleAddConcept}
            showCreateButton={!isSchoolStudent}
            isSchoolTeacher={isSchoolTeacher} // Pasar el valor correcto para profesores
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
              
              <div className="upgrade-support-section">
                <h4>📧 ¿Necesitas ayuda para decidir?</h4>
                <p>Nuestro equipo de soporte está aquí para ayudarte:</p>
                <div className="support-contact">
                  <i className="fas fa-envelope"></i>
                  <span>soporte@simonkey.com</span>
                </div>
                <p className="support-note">
                  Te responderemos en menos de 24 horas con toda la información que necesites.
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