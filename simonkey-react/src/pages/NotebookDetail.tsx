import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { Concept } from '../types/interfaces';
import { useStudyService } from '../hooks/useStudyService';
import { useUserType } from '../hooks/useUserType';

import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  setDoc,
  arrayUnion, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { generateConcepts, prepareFilesForGeneration } from '../services/firebaseFunctions';
import '../styles/NotebookDetail.css';
import ReactDOM from 'react-dom';

// TypeScript declarations no longer needed for Gemini API

interface ConceptDoc {
  id: string;
  cuadernoId: string;
  usuarioId: string;
  conceptos: Concept[];
  creadoEn: Date;
}

// arrayBufferToBase64 function no longer needed with Cloud Functions

const NotebookDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [cuaderno, setCuaderno] = useState<any>(null);
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [conceptosDocs, setConceptosDocs] = useState<ConceptDoc[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>("Cargando...");
  const [nuevoConcepto, setNuevoConcepto] = useState<Concept>({
    id:  '',
    término: '',
    definición: '',
    fuente: 'Manual'
  });
  
  // Estado para el modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  
  // Estado para los datos de aprendizaje (para el semáforo)
  const [learningDataMap, setLearningDataMap] = useState<Map<string, number>>(new Map());
  
  // Referencia para el modal
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Usar el hook de estudio
  const studyService = useStudyService();
  
  // Usar el hook para detectar el tipo de usuario
  const { isSchoolStudent, isSchoolAdmin, isSchoolTeacher } = useUserType();
  
  // Log para debug
  console.log('🎓 NotebookDetail - isSchoolStudent:', isSchoolStudent);
  
  // Función para obtener el color del semáforo según el interval
  const getTrafficLightColor = (conceptId: string): string => {
    const interval = learningDataMap.get(conceptId) || 1;
    
    if (interval === 1) {
      return 'red'; // Rojo - Necesita práctica urgente
    } else if (interval === 6) {
      return 'yellow'; // Amarillo - Dominio medio
    } else if (interval > 6) {
      return 'green'; // Verde - Bien dominado
    } else {
      return 'red'; // Por defecto rojo para intervals < 6
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      // Check authentication
      if (!auth.currentUser) {
        console.error("User not authenticated");
        navigate('/login');
        return;
      }
      
      try {
        // Fetch notebook details
        // Use schoolNotebooks collection for school students and admins
        const notebooksCollection = (isSchoolStudent || isSchoolAdmin) ? 'schoolNotebooks' : 'notebooks';
        const docRef = doc(db, notebooksCollection, id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCuaderno({ id: docSnap.id, ...data });
          // Guardar el materiaId si existe
          if (data.materiaId) {
            setMateriaId(data.materiaId);
          }
        } else {
          console.error("No such notebook!");
          navigate('/notebooks');
          return;
        }
        
        // Fetch concept documents for this notebook
        // Use schoolConcepts collection for school students and admins
        const conceptsCollection = (isSchoolStudent || isSchoolAdmin) ? 'schoolConcepts' : 'conceptos';
        const q = query(
          collection(db, conceptsCollection),
          where('cuadernoId', '==', id)
        );
        
        try {
          const querySnapshot = await getDocs(q);
          const conceptosData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ConceptDoc[];
          
          setConceptosDocs(conceptosData);
          console.log('✅ Conceptos cargados exitosamente:', conceptosData.length);
          
          // Cargar datos de aprendizaje para el semáforo
          if (auth.currentUser && conceptosData.length > 0) {
            const learningMap = new Map<string, number>();
            
            try {
              // Obtener todos los IDs de conceptos
              const allConceptIds = conceptosData.flatMap(doc => 
                doc.conceptos.map(c => c.id)
              );
              
              // Cargar datos de aprendizaje para cada concepto
              for (const conceptId of allConceptIds) {
                const learningDataRef = doc(db, 'users', auth.currentUser.uid, 'learningData', conceptId);
                const learningDataSnap = await getDoc(learningDataRef);
                
                if (learningDataSnap.exists()) {
                  const data = learningDataSnap.data();
                  // Usar el interval del algoritmo SM-3
                  learningMap.set(conceptId, data.interval || 1);
                } else {
                  // Si no existe, es un concepto nuevo (interval = 1)
                  learningMap.set(conceptId, 1);
                }
              }
              
              setLearningDataMap(learningMap);
              console.log('🚦 Datos de aprendizaje cargados para semáforo');
            } catch (error) {
              console.warn('⚠️ Error cargando datos de aprendizaje:', error);
            }
          }
        } catch (conceptsError: any) {
          console.warn('⚠️ Error cargando conceptos (continuando sin conceptos):', conceptsError.message);
          // No fallar completamente, solo mostrar un warning
          setConceptosDocs([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchData();
  }, [id, navigate, isSchoolStudent, isSchoolAdmin]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openModal') === 'true') {
      openModalWithTab('upload');
      // Limpiar el parámetro de la URL para evitar que se vuelva a abrir si el usuario navega
      navigate(`/notebooks/${id}`, { replace: true });
    }
  }, [location.search, id]);

  // Añadir al inicio del componente, después de cargar los datos del cuaderno
  useEffect(() => {
    if (cuaderno && cuaderno.color) {
      document.documentElement.style.setProperty('--notebook-color', cuaderno.color);
      // Forzar el color del título del header a blanco, ya que hereda el --notebook-color de forma extraña
      const headerTitle = document.querySelector('.notebook-detail-header .title-container h1');
      if (headerTitle) {
        (headerTitle as HTMLElement).style.color = 'white';
      }
    } else {
      document.documentElement.style.setProperty('--notebook-color', 'var(--primary-color)');
    }

    return () => {
      document.documentElement.style.setProperty('--notebook-color', 'var(--primary-color)');
      const headerTitle = document.querySelector('.notebook-detail-header .title-container h1');
      if (headerTitle) {
        (headerTitle as HTMLElement).style.color = ''; // Limpiar el estilo al desmontar
      }
    };
  }, [cuaderno]);

  // Efecto para manejar la tecla ESC
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
      }
    }
    
    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setArchivos(Array.from(e.target.files));
    }
  };

  // fileToProcessedFile function no longer needed with Cloud Functions

  // Función para crear datos de aprendizaje iniciales para nuevos conceptos
  const createInitialLearningDataForConcepts = async (conceptIds: string[], userId: string, notebookId: string) => {
    try {
      console.log('🚀 Creando datos de aprendizaje para conceptos:', conceptIds);
      
      const { createInitialLearningData } = await import('../utils/sm3Algorithm');
      
      for (const conceptId of conceptIds) {
        const initialData = createInitialLearningData(conceptId);
        
        console.log('📊 Datos iniciales para concepto', conceptId, ':', {
          nextReviewDate: initialData.nextReviewDate.toISOString(),
          easeFactor: initialData.easeFactor,
          interval: initialData.interval,
          repetitions: initialData.repetitions
        });
        
        // Guardar en la colección de datos de aprendizaje
        const learningDataRef = doc(db, 'users', userId, 'learningData', conceptId);
        await setDoc(learningDataRef, {
          ...initialData,
          notebookId,
          userId,
          createdAt: serverTimestamp()
        });
        
        console.log('✅ Datos guardados para concepto:', conceptId);
      }
      
      console.log(`✅ Datos de aprendizaje creados para ${conceptIds.length} conceptos`);
    } catch (error) {
      console.error('❌ Error creando datos de aprendizaje:', error);
      // No lanzar error para no interrumpir el flujo principal
    }
  };

  // Función para generar conceptos desde archivos usando Cloud Functions (seguro)
  const generarConceptos = async () => {
    if (!id || !auth.currentUser || archivos.length === 0) {
      alert("Por favor selecciona al menos un archivo");
      return;
    }
    
    // Prevent school students from adding concepts
    if (isSchoolStudent) {
      alert('Como estudiante escolar, no puedes añadir conceptos.');
      return;
    }

    // Debug logging
    console.log('🔍 Debug generarConceptos:');
    console.log('- User ID:', auth.currentUser.uid);
    console.log('- Notebook ID:', id);
    console.log('- Files count:', archivos.length);
    console.log('- Is school student:', isSchoolStudent);

    setCargando(true);
    setLoadingText("Procesando archivos...");

    try {
      // Verificar que el cuaderno existe y pertenece al usuario
      const notebookRef = doc(db, 'notebooks', id);
      const notebookDoc = await getDoc(notebookRef);
      
      if (!notebookDoc.exists()) {
        throw new Error('El cuaderno no existe');
      }
      
      const notebookData = notebookDoc.data();
      console.log('- Notebook data:', notebookData);
      console.log('- Notebook owner:', notebookData?.userId);
      console.log('- Current user:', auth.currentUser.uid);
      
      if (notebookData?.userId !== auth.currentUser.uid) {
        throw new Error('No tienes permisos para modificar este cuaderno');
      }

      // Preparar archivos para el procesamiento (indicar que NO es cuaderno escolar)
      const processedFiles = await prepareFilesForGeneration(archivos, false);
      console.log('📁 Archivos procesados:', processedFiles.length);
      setLoadingText("Generando conceptos con IA...");

      // Generar conceptos usando Cloud Functions
      console.log('🚀 Llamando a generateConcepts con:', {
        filesCount: processedFiles.length,
        notebookId: id,
        userId: auth.currentUser.uid
      });
      
      let results;
      try {
        results = await generateConcepts(processedFiles, id);
        console.log('✅ generateConcepts completado, resultados:', results);
        console.log('📊 Tipo de resultados:', typeof results);
        console.log('📊 Longitud de resultados:', Array.isArray(results) ? results.length : 'No es array');
      } catch (cloudFunctionError: any) {
        console.error('❌ Error en Cloud Function:', cloudFunctionError);
        
        // Mostrar información detallada del error
        if (cloudFunctionError.code) {
          console.error('Código de error:', cloudFunctionError.code);
        }
        if (cloudFunctionError.message) {
          console.error('Mensaje de error:', cloudFunctionError.message);
        }
        if (cloudFunctionError.details) {
          console.error('Detalles del error:', cloudFunctionError.details);
        }
        
        // Manejar errores específicos
        if (cloudFunctionError.code === 'functions/deadline-exceeded') {
          throw new Error('El archivo es muy grande y tardó demasiado en procesarse. Intenta con un archivo más pequeño (máximo 10MB recomendado).');
        } else if (cloudFunctionError.code === 'functions/invalid-argument') {
          throw new Error(cloudFunctionError.message || 'El archivo no es válido o es demasiado grande.');
        } else if (cloudFunctionError.code === 'functions/resource-exhausted') {
          throw new Error('Has alcanzado el límite diario de generación de conceptos. Intenta mañana o actualiza tu plan.');
        } else {
          throw new Error(`Error procesando archivo: ${cloudFunctionError.message || 'Error desconocido'}`);
        }
      }

      // Procesar resultados
      console.log('🔄 Procesando resultados...');
      let totalConcepts = 0;
      let conceptIds: string[] = [];
      
      for (const result of results) {
        console.log('📋 Procesando resultado:', result);
        const data = result.data as any;
        console.log('📋 Datos del resultado:', data);
        
        if (data?.success) {
          totalConcepts += data.conceptCount || 0;
          if (data.conceptIds) {
            conceptIds.push(...data.conceptIds);
          }
          console.log('✅ Resultado procesado exitosamente');
        } else {
          console.log('❌ Resultado no exitoso:', data);
        }
      }
      
      console.log('📊 Total de conceptos:', totalConcepts);
      console.log('📊 IDs de conceptos:', conceptIds);

      if (totalConcepts > 0) {
        setLoadingText("Creando datos de aprendizaje...");
        
        // Crear datos de aprendizaje para los nuevos conceptos
        if (conceptIds.length > 0) {
          await createInitialLearningDataForConcepts(conceptIds, auth.currentUser.uid, id);
        }

        // Intentar recargar los conceptos, pero no fallar si hay error de permisos
        try {
          console.log('🔄 Recargando conceptos...');
          const q = query(
            collection(db, 'conceptos'),
            where('cuadernoId', '==', id)
          );
          const querySnapshot = await getDocs(q);
          const conceptosData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ConceptDoc[];
          setConceptosDocs(conceptosData);
          console.log('✅ Conceptos recargados exitosamente');
        } catch (reloadError: any) {
          console.warn('⚠️ No se pudieron recargar los conceptos, pero se generaron correctamente:', reloadError.message);
          // No fallar aquí, los conceptos ya se generaron en la Cloud Function
        }

        alert(`¡Éxito! Se generaron ${totalConcepts} conceptos.`);
        setIsModalOpen(false);
        setArchivos([]);
      } else {
        alert("No se pudieron generar conceptos. Por favor, intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error generating concepts:", error);
      alert("Error al generar conceptos. Por favor, intenta de nuevo.");
    } finally {
      setCargando(false);
      setLoadingText("Cargando...");
    }
  };

  // Función para eliminar el cuaderno y todos sus conceptos relacionados
  const handleDeleteNotebook = async () => {
    if (!id || !auth.currentUser) {
      console.error("No se pudo verificar la sesión de usuario o el ID del cuaderno");
      return;
    }

    try {
      // Eliminar conceptos del cuaderno
      const q = query(
        collection(db, 'conceptos'),
        where('cuadernoId', '==', id)
      );
      const querySnapshot = await getDocs(q);
      const conceptosToDelete = querySnapshot.docs.map(doc => doc.id);
      
      if (conceptosToDelete.length > 0) {
        await deleteDoc(doc(db, 'conceptos', conceptosToDelete[0]));
        setConceptosDocs((prev: ConceptDoc[]) => prev.filter((doc: ConceptDoc) => !conceptosToDelete.includes(doc.id)));
      }

      // Eliminar el cuaderno
      await deleteDoc(doc(db, 'notebooks', id));

      // Redirigir al usuario a la lista de cuadernos
      navigate('/notebooks');
    } catch (error) {
      console.error("Error al eliminar el cuaderno:", error);
      alert('Error al eliminar el cuaderno. Por favor intenta nuevamente.');
    }
  };

  // Función para añadir concepto manualmente
  const agregarConceptoManual = async () => {
    if (!id || !auth.currentUser) {
      alert("No se pudo verificar la sesión de usuario");
      return;
    }

    // Prevent school students from adding concepts
    if (isSchoolStudent) {
      alert('Como estudiante escolar, no puedes añadir conceptos.');
      return;
    }

    if (!nuevoConcepto.término || !nuevoConcepto.definición) {
      alert("Por favor completa todos los campos obligatorios");
      return;
    }

    setCargando(true);
    setLoadingText("Guardando concepto...");

    try {
      const conceptoManual: Concept = {
        término: nuevoConcepto.término,
        definición: nuevoConcepto.definición,
        fuente: nuevoConcepto.fuente || 'Manual',
        id: crypto.randomUUID() // Generar ID único para el concepto
      };

      let updatedConceptosDoc: ConceptDoc | null = null;
      if (conceptosDocs.length > 0) {
        const existingDoc = conceptosDocs.find(doc => doc.cuadernoId === id);
        if (existingDoc) {
          const conceptosRef = doc(db, 'conceptos', existingDoc.id);
          await updateDoc(conceptosRef, {
            conceptos: arrayUnion(conceptoManual)
          });
          updatedConceptosDoc = {
            ...existingDoc,
            conceptos: [...existingDoc.conceptos, conceptoManual]
          };
          setConceptosDocs((prev: ConceptDoc[]) =>
            prev.map((doc: ConceptDoc) => (doc.id === existingDoc.id ? updatedConceptosDoc! : doc))
          );
        }
      }

      if (!updatedConceptosDoc) {
        // Si no existe un documento, crear uno nuevo usando un ID generado
        const newDocRef = doc(collection(db, 'conceptos'));
        const newDocId = newDocRef.id;
        
        await setDoc(newDocRef, {
          id: newDocId,
          cuadernoId: id,
          usuarioId: auth.currentUser.uid,
          conceptos: [conceptoManual],
          creadoEn: serverTimestamp()
        });
        
        setConceptosDocs((prev: ConceptDoc[]) => [
          ...prev,
          {
            id: newDocId,  // Usa el nuevo ID generado
            cuadernoId: id,
            usuarioId: auth.currentUser?.uid || '',
            conceptos: [conceptoManual],
            creadoEn: new Date()
          }
        ]);
      }

      // Crear datos de aprendizaje iniciales para el nuevo concepto
      await createInitialLearningDataForConcepts(
        [conceptoManual.id], 
        auth.currentUser?.uid || '', 
        id
      );

      // Limpiar el formulario
      setNuevoConcepto({
        id: '',
        término: '',
        definición: '',
        fuente: 'Manual'
      });
      
      // Cerrar el modal después de creación exitosa
      setIsModalOpen(false);
      
      alert("Concepto añadido exitosamente");
    } catch (error) {
      console.error('Error al guardar concepto manual:', error);
      alert('Error al guardar el concepto. Por favor intente nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  // Abrir modal con pestaña específica
  const openModalWithTab = (tab: 'upload' | 'manual') => {
    // Prevent school students from opening the add concepts modal
    if (isSchoolStudent) {
      alert('Como estudiante escolar, no puedes añadir conceptos.');
      return;
    }
    
    setActiveTab(tab);
    setIsModalOpen(true);
  };

  // Exponer funciones de diagnóstico en window para debugging
  useEffect(() => {
    (window as any).diagnosticarConceptos = async () => {
      console.log('🔍 DIAGNÓSTICO DE CONCEPTOS');
      console.log('========================');
      
      // 1. Verificar estado del componente
      console.log('1. Estado del componente:');
      console.log('- conceptosDocs:', conceptosDocs);
      console.log('- cuaderno:', cuaderno);
      console.log('- isSchoolStudent:', isSchoolStudent);
      console.log('- notebookId:', id);
      
      // 2. Verificar conceptos en Firestore
      console.log('\n2. Verificando conceptos en Firestore...');
      try {
        // Verificar en la colección normal
        const q = query(
          collection(db, 'conceptos'),
          where('cuadernoId', '==', id)
        );
        const querySnapshot = await getDocs(q);
        const conceptos = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ConceptDoc[];
        
        console.log('Conceptos encontrados en colección "conceptos":', conceptos.length);
        conceptos.forEach((doc, index) => {
          console.log(`Documento ${index + 1}:`, {
            id: doc.id,
            cuadernoId: doc.cuadernoId,
            usuarioId: doc.usuarioId,
            conceptosCount: doc.conceptos?.length || 0,
            conceptos: doc.conceptos?.slice(0, 3) // Mostrar solo los primeros 3 conceptos
          });
        });
        
        // Verificar en la colección escolar también
        const qSchool = query(
          collection(db, 'schoolConcepts'),
          where('cuadernoId', '==', id)
        );
        const querySnapshotSchool = await getDocs(qSchool);
        const conceptosSchool = querySnapshotSchool.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ConceptDoc[];
        
        console.log('Conceptos encontrados en colección "schoolConcepts":', conceptosSchool.length);
        
        // 3. Verificar documento específico mencionado en logs
        console.log('\n3. Verificando documento específico...');
        try {
          // Verificar el documento más reciente de los logs
          const docRef = doc(db, 'conceptos', 'C3Yw2kQVEDSVS3KuDwsv');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            console.log('✅ Documento C3Yw2kQVEDSVS3KuDwsv existe:', docSnap.data());
          } else {
            console.log('❌ Documento C3Yw2kQVEDSVS3KuDwsv no existe');
          }
          
          // Verificar también el documento anterior
          const docRef2 = doc(db, 'conceptos', '5eXXjwmiHKYaocMPpfBL');
          const docSnap2 = await getDoc(docRef2);
          if (docSnap2.exists()) {
            console.log('✅ Documento 5eXXjwmiHKYaocMPpfBL existe:', docSnap2.data());
          } else {
            console.log('❌ Documento 5eXXjwmiHKYaocMPpfBL no existe');
          }
        } catch (error) {
          console.log('❌ Error verificando documento específico:', error);
        }
        
        // 4. Forzar recarga
        console.log('\n4. Forzando recarga de conceptos...');
        const allConceptos = [...conceptos, ...conceptosSchool];
        setConceptosDocs(allConceptos);
        console.log('✅ Estado actualizado con', allConceptos.length, 'documentos');
        
        // 5. Verificar permisos
        console.log('\n5. Verificando permisos...');
        try {
          const testQuery = query(collection(db, 'conceptos'), where('cuadernoId', '==', id));
          await getDocs(testQuery);
          console.log('✅ Permisos de lectura OK');
        } catch (error) {
          console.log('❌ Error de permisos:', error);
        }
        
      } catch (error) {
        console.log('❌ Error general:', error);
      }
    };
    
    (window as any).setConceptosDocs = setConceptosDocs;
    (window as any).conceptosDocs = conceptosDocs;
    (window as any).cuaderno = cuaderno;
    
    return () => {
      delete (window as any).diagnosticarConceptos;
      delete (window as any).setConceptosDocs;
      delete (window as any).conceptosDocs;
      delete (window as any).cuaderno;
    };
  }, [conceptosDocs, cuaderno, id, isSchoolStudent]);

  // Muestra spinner de carga mientras se obtienen los datos
  if (!cuaderno) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando cuaderno...</p>
      </div>
    );
  }

  return (
    <div className="notebook-detail-container">
      <header className="notebook-detail-header">
        <div className="header-content">
          <button 
            onClick={() => {
              // Si es profesor escolar, ir a su página de notebooks
              if (isSchoolTeacher) {
                // Verificar si estamos en una ruta de profesor
                const teacherMateriaMatch = window.location.pathname.match(/\/school\/teacher\/materias\/([^\/]+)/);
                if (teacherMateriaMatch) {
                  const materiaId = teacherMateriaMatch[1];
                  navigate(`/school/teacher/materias/${materiaId}/notebooks`);
                } else {
                  // Si no hay materiaId, ir a la página principal del profesor
                  navigate('/school/teacher');
                }
                return;
              }
              
              // Para usuarios regulares, verificar si vienen de una materia
              const materiaMatch = window.location.pathname.match(/\/materias\/([^\/]+)/);
              if (materiaMatch) {
                const urlMateriaId = materiaMatch[1];
                navigate(`/materias/${urlMateriaId}/notebooks`);
              } else {
                // Si no hay materiaId en la URL, ir a /notebooks
                navigate('/notebooks');
              }
            }} 
            className="back-button"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          
          <div className="title-container">
            <h1>{cuaderno.title}</h1>
          </div>
        </div>
      </header>

      <main className="notebook-detail-main">
        <section className="concepts-section">
          <h2>Conceptos del Cuaderno</h2>
          
          <div className="concepts-list">
            {conceptosDocs.length === 0 ? (
              <div className="empty-state">
                <p>Aún no hay conceptos en este cuaderno.</p>
                {!isSchoolStudent && !isSchoolAdmin ? (
                  <button
                    className="add-first-concept-button"
                    onClick={() => openModalWithTab("upload")}
                    style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', width: '100%' }}
                  >
                    Añadir nuevos conceptos
                  </button>
                ) : isSchoolAdmin ? (
                  <p className="school-admin-info" style={{ 
                    background: '#f0ebff', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    color: '#4a5568',
                    textAlign: 'center'
                  }}>
                    <i className="fas fa-info-circle" style={{ marginRight: '0.5rem', color: '#6147FF' }}></i>
                    Como administrador, tienes acceso de solo lectura a los conceptos.
                  </p>
                ) : (
                  <p className="school-student-info">
                    <i className="fas fa-info-circle"></i>
                    Como estudiante escolar, tu profesor añadirá los conceptos a este cuaderno.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="concept-cards">
                  {conceptosDocs.flatMap((doc) => 
                    doc.conceptos.map((concepto, conceptIndex) => {
                      const trafficLightColor = getTrafficLightColor(concepto.id);
                      return (
                        <div 
                          key={`${doc.id}-${conceptIndex}`}
                          className={`concept-card traffic-light-${trafficLightColor}`}
                          onClick={() => {
                            // Mantener el contexto de materia si existe
                            const materiaMatch = window.location.pathname.match(/\/materias\/([^\/]+)/);
                            if (materiaMatch) {
                              const urlMateriaId = materiaMatch[1];
                              navigate(`/materias/${urlMateriaId}/notebooks/${id}/concepto/${doc.id}/${conceptIndex}`);
                            } else if (materiaId) {
                              navigate(`/materias/${materiaId}/notebooks/${id}/concepto/${doc.id}/${conceptIndex}`);
                            } else {
                              navigate(`/notebooks/${id}/concepto/${doc.id}/${conceptIndex}`);
                            }
                          }}
                        >
                          <h4>{concepto.término}</h4>
                        </div>
                      );
                    })
                  )}
                  
                  {/* Tarjeta para añadir nuevos conceptos - Solo para usuarios no escolares ni admin */}
                  {!isSchoolStudent && !isSchoolAdmin && (
                    <div 
                      className="add-concept-card" 
                      onClick={() => openModalWithTab('upload')}
                    >
                      <div className="add-icon">
                        <i className="fas fa-plus-circle"></i>
                      </div>
                      <h4>Añadir nuevos conceptos</h4>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Modal - Solo visible para usuarios no escolares */}
      {isModalOpen && !isSchoolStudent && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsModalOpen(false);
          }
        }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Añadir nuevos conceptos</h2>
              <button className="close-modal-button" onClick={() => setIsModalOpen(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-tabs">
              <button 
                className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                <i className="fas fa-file-upload"></i> Subir materiales
              </button>
              <button 
                className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`}
                onClick={() => setActiveTab('manual')}
              >
                <i className="fas fa-pencil-alt"></i> Añadir manualmente
              </button>
            </div>
            
            <div className="modal-body">
              {activeTab === 'upload' ? (
                <div className="upload-container">
                  <input
                    type="file"
                    id="pdf-upload"
                    multiple
                    accept="*/*"
                    onChange={handleFileChange}
                    disabled={cargando}
                    className="file-input"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="pdf-upload" className="file-input-label">
                    <div className="file-input-content">
                      <i className="fas fa-cloud-upload-alt"></i>
                      <p>Haz clic aquí para seleccionar archivos</p>
                      <span>o arrastra y suelta archivos aquí</span>
                    </div>
                  </label>
                  <div className="selected-files">
                    {archivos.length > 0 && (
                      <>
                        <p><strong>{archivos.length === 1 ? 'Archivo seleccionado:' : 'Archivos seleccionados:'}</strong></p>
                        <ul>
                          {archivos.map((file, index) => (
                            <li key={index}>{file.name}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                  <button 
                    onClick={generarConceptos} 
                    disabled={archivos.length === 0 || cargando}
                    className="generate-button"
                  >
                    {cargando ? loadingText : 'Generar Conceptos'}
                  </button>
                </div>
              ) : (
                <div className="concept-form">
                  <div className="form-group">
                    <label htmlFor="termino">Término *</label>
                    <input 
                      type="text" 
                      id="termino"
                      value={nuevoConcepto.término}
                      onChange={(e) => setNuevoConcepto({...nuevoConcepto, término: e.target.value})}
                      placeholder="Nombre del concepto"
                      disabled={cargando}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="definicion">Definición *</label>
                    <textarea 
                      id="definicion"
                      value={nuevoConcepto.definición}
                      onChange={(e) => setNuevoConcepto({...nuevoConcepto, definición: e.target.value})}
                      placeholder="Explica brevemente el concepto"
                      rows={4}
                      disabled={cargando}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="fuente">Fuente</label>
                    <input 
                      type="text" 
                      id="fuente"
                      value={nuevoConcepto.fuente}
                      onChange={(e) => setNuevoConcepto({...nuevoConcepto, fuente: e.target.value})}
                      placeholder="Fuente del concepto"
                      disabled={cargando}
                    />
                  </div>
                  
                  <button 
                    onClick={agregarConceptoManual} 
                    disabled={cargando || !nuevoConcepto.término || !nuevoConcepto.definición}
                    className="add-concept-button"
                  >
                    {cargando && loadingText === "Guardando concepto..." ? loadingText : 'Añadir Concepto'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      
    </div>
  );
};

export default NotebookDetail;