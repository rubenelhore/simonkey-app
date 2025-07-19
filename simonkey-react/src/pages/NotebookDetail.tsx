import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { Concept, Notebook, Material } from '../types/interfaces';
import { useStudyService } from '../hooks/useStudyService';
import { useUserType } from '../hooks/useUserType';
import { UnifiedNotebookService } from '../services/unifiedNotebookService';

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
import { MaterialService } from '../services/materialService';
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
  const [cuaderno, setCuaderno] = useState<Notebook | null>(null);
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
  
  // Estado para el filtro de dominio
  const [dominioFilter, setDominioFilter] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  
  // Estado para la previsualización de archivos
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  
  // Estado para los materiales del notebook
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [loadingMaterials, setLoadingMaterials] = useState<boolean>(false);
  const [showMaterialsList, setShowMaterialsList] = useState<boolean>(false);
  
  // Referencia para el modal
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Usar el hook de estudio
  const studyService = useStudyService();
  
  // Usar el hook para detectar el tipo de usuario
  const { isSchoolStudent, isSchoolAdmin, isSchoolTeacher } = useUserType();
  
  // Log para debug - comentado para evitar spam en consola
  // console.log('🎓 NotebookDetail - isSchoolStudent:', isSchoolStudent);
  
  // Función para obtener el color del semáforo según las repeticiones
  const getTrafficLightColor = (conceptId: string): string => {
    const repetitions = learningDataMap.get(conceptId) || 0;
    
    if (repetitions === 0) {
      return 'red'; // Rojo - Concepto nuevo, nunca estudiado
    } else if (repetitions === 1) {
      return 'yellow'; // Amarillo - Estudiado una vez
    } else {
      return 'green'; // Verde - Estudiado 2 o más veces
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
        // Fetch notebook using unified service
        const notebook = await UnifiedNotebookService.getNotebook(id);
        
        if (notebook) {
          setCuaderno(notebook);
          // Guardar el materiaId si existe
          if (notebook.idMateria) {
            setMateriaId(notebook.idMateria || null);
          }
        } else {
          console.error("No such notebook!");
          navigate('/notebooks');
          return;
        }
        
        // Fetch concept documents for this notebook
        // Determine concepts collection based on notebook type
        const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(id!);
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
                  // Usar las repeticiones del algoritmo SM-3
                  learningMap.set(conceptId, data.repetitions || 0);
                } else {
                  // Si no existe, es un concepto nuevo (0 repeticiones)
                  learningMap.set(conceptId, 0);
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
        
        // Cargar materiales del notebook
        try {
          setLoadingMaterials(true);
          const notebookMaterials = await MaterialService.getNotebookMaterials(id);
          setMaterials(notebookMaterials);
          console.log('📚 Materiales cargados:', notebookMaterials.length);
        } catch (materialsError) {
          console.warn('⚠️ Error cargando materiales:', materialsError);
          setMaterials([]);
        } finally {
          setLoadingMaterials(false);
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
        if (isPreviewOpen) {
          setIsPreviewOpen(false);
          setPreviewFile(null);
        } else if (isModalOpen) {
          setIsModalOpen(false);
        }
      }
    }
    
    if (isModalOpen || isPreviewOpen) {
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, isPreviewOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setArchivos(Array.from(e.target.files));
    }
  };

  // Componente para previsualizar archivos de texto
  const TextFilePreview = ({ file }: { file: File }) => {
    const [textContent, setTextContent] = useState<string>('Cargando...');
    
    useEffect(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTextContent(e.target?.result as string);
      };
      reader.onerror = () => {
        setTextContent('Error al leer el archivo');
      };
      reader.readAsText(file);
    }, [file]);

    return (
      <pre style={{ 
        maxHeight: '80vh', 
        overflow: 'auto', 
        backgroundColor: '#f5f5f5', 
        padding: '1rem',
        borderRadius: '4px',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word'
      }}>
        {textContent}
      </pre>
    );
  };

  // Componente para previsualizar archivos con URL
  const FilePreviewWithURL = ({ file }: { file: File }) => {
    const [fileURL, setFileURL] = useState<string | null>(null);

    useEffect(() => {
      if (!file) {
        setFileURL(null);
        return;
      }
      
      const url = URL.createObjectURL(file);
      setFileURL(url);

      return () => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      };
    }, [file]);

    const fileType = file.type;

    if (!fileURL) {
      return <div>Cargando...</div>;
    }

    if (fileType.startsWith('image/')) {
      return (
        <div style={{ textAlign: 'center', padding: '1rem', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={fileURL} alt={file.name} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
        </div>
      );
    } else if (fileType === 'application/pdf') {
      return (
        <div style={{ height: '80vh' }}>
          <iframe
            src={fileURL}
            title={file.name}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      );
    } else {
      return null;
    }
  };

  // Función para renderizar la previsualización según el tipo de archivo
  const renderFilePreview = () => {
    if (!previewFile) return null;

    const fileType = previewFile.type;

    if (fileType.startsWith('image/') || fileType === 'application/pdf') {
      return <FilePreviewWithURL file={previewFile} />;
    } else if (fileType.startsWith('text/') || fileType === 'application/json' || fileType === 'application/javascript' || !fileType) {
      return <TextFilePreview file={previewFile} />;
    } else {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <i className="fas fa-file" style={{ fontSize: '4rem', color: '#ccc', marginBottom: '1rem' }}></i>
          <p>No se puede previsualizar este tipo de archivo</p>
          <p style={{ fontSize: '0.9rem', color: '#666' }}>Tipo: {fileType || 'Desconocido'}</p>
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>Nombre: {previewFile.name}</p>
          <p style={{ fontSize: '0.85rem', color: '#666' }}>Tamaño: {(previewFile.size / 1024).toFixed(2)} KB</p>
        </div>
      );
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
      // Verificar que el cuaderno existe
      const notebook = await UnifiedNotebookService.getNotebook(id);
      
      if (!notebook) {
        throw new Error('El cuaderno no existe');
      }
      
      console.log('- Notebook data:', notebook);
      console.log('- Notebook type:', notebook.type);
      console.log('- Current user:', auth.currentUser.uid);
      
      // Verificar permisos según el tipo de notebook
      if (notebook.type === 'personal' && notebook.userId !== auth.currentUser.uid) {
        throw new Error('No tienes permisos para modificar este cuaderno');
      }
      
      // Para notebooks escolares, verificar que no sea estudiante
      if (notebook.type === 'school' && isSchoolStudent) {
        throw new Error('Los estudiantes no pueden añadir conceptos a cuadernos escolares');
      }

      // Primero subir los materiales (con URLs de marcador de posición)
      setLoadingText("Guardando materiales...");
      let uploadedMaterials: Material[] = [];
      try {
        uploadedMaterials = await MaterialService.uploadMultipleMaterials(archivos, id);
        console.log('📤 Materiales guardados:', uploadedMaterials.length);
        
        // Actualizar la lista de materiales en el UI
        setMaterials([...materials, ...uploadedMaterials]);
      } catch (uploadError) {
        console.error('⚠️ Error guardando materiales:', uploadError);
        // Continuar sin materiales, no es crítico
      }

      // Preparar archivos para el procesamiento, pasando los materiales subidos
      setLoadingText("Preparando archivos...");
      const processedFiles = await prepareFilesForGeneration(
        archivos, 
        notebook.type === 'school',
        uploadedMaterials.map(m => ({ id: m.id, name: m.name }))
      );
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
          // Usar la colección correcta según el tipo de notebook
          const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(id!);
          console.log('📚 Usando colección:', conceptsCollection);
          
          const q = query(
            collection(db, conceptsCollection),
            where('cuadernoId', '==', id)
          );
          const querySnapshot = await getDocs(q);
          const conceptosData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ConceptDoc[];
          setConceptosDocs(conceptosData);
          console.log('✅ Conceptos recargados exitosamente desde', conceptsCollection);
        } catch (reloadError: any) {
          console.warn('⚠️ No se pudieron recargar los conceptos, pero se generaron correctamente:', reloadError.message);
          // No fallar aquí, los conceptos ya se generaron en la Cloud Function
        }

        // Los materiales ya fueron subidos al principio, no necesitamos hacerlo de nuevo
        setLoadingText("Finalizando...");
        
        console.log('🎯 Punto de control: antes del alert de éxito');
        
        // Siempre mostrar éxito porque los conceptos se generaron
        alert(`¡Éxito! Se generaron ${totalConcepts} conceptos.`);
        
        console.log('🎯 Punto de control: después del alert, cerrando modal');
        setIsModalOpen(false);
        setArchivos([]);
        
        console.log('🎯 Punto de control: todo completado exitosamente');
      } else {
        alert("No se pudieron generar conceptos. Por favor, intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error generating concepts:", error);
      alert("Error al generar conceptos. Por favor, intenta de nuevo.");
    } finally {
      console.log('🏁 Finally block: desactivando cargando');
      setCargando(false);
      setLoadingText("Cargando...");
      console.log('🏁 Finally block: completado');
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
      const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(id!);
      const q = query(
        collection(db, conceptsCollection),
        where('cuadernoId', '==', id)
      );
      const querySnapshot = await getDocs(q);
      const conceptosToDelete = querySnapshot.docs.map(doc => doc.id);
      
      if (conceptosToDelete.length > 0) {
        await deleteDoc(doc(db, conceptsCollection, conceptosToDelete[0]));
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
    
    // También verificar para notebooks escolares
    if (cuaderno?.type === 'school' && isSchoolStudent) {
      alert('Los estudiantes no pueden añadir conceptos a cuadernos escolares.');
      return;
    }

    if (!nuevoConcepto.término || !nuevoConcepto.definición) {
      alert("Por favor completa todos los campos obligatorios");
      return;
    }

    setCargando(true);
    setLoadingText("Guardando concepto...");

    try {
      // Obtener la colección correcta
      const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(id!);
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
          const conceptosRef = doc(db, conceptsCollection, existingDoc.id);
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
        const newDocRef = doc(collection(db, conceptsCollection));
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
        const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(id!);
        const q = query(
          collection(db, conceptsCollection),
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
          const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(id!);
          const testQuery = query(collection(db, conceptsCollection), where('cuadernoId', '==', id));
          await getDocs(testQuery);
          console.log('✅ Permisos de lectura OK en colección:', conceptsCollection);
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
        {/* Sección de Materiales */}
        {materials.length > 0 && (
          <section className="materials-section">
            <div className="section-header">
              <h2>
                Materiales de Estudio
                <button 
                  className="toggle-materials-btn"
                  onClick={() => setShowMaterialsList(!showMaterialsList)}
                  title={showMaterialsList ? "Ocultar materiales" : "Mostrar materiales"}
                >
                  <i className={`fas fa-chevron-${showMaterialsList ? 'up' : 'down'}`}></i>
                </button>
              </h2>
              {selectedMaterialId && showMaterialsList && (
                <div className="material-actions">
                  <button
                    className="view-material-btn"
                    onClick={() => {
                      const selectedMaterial = materials.find(m => m.id === selectedMaterialId);
                      if (selectedMaterial) {
                        if (selectedMaterial.url.startsWith('placeholder://')) {
                          alert('Este material aún está siendo procesado. Por favor, intenta más tarde.');
                          return;
                        }
                        window.open(selectedMaterial.url, '_blank');
                      }
                    }}
                    title="Ver material"
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                  {materials.find(m => m.id === selectedMaterialId)?.url.startsWith('placeholder://') ? (
                    <button
                      className="download-material-btn pending"
                      disabled
                      title="Material siendo procesado"
                    >
                      <i className="fas fa-spinner fa-spin"></i>
                    </button>
                  ) : (
                    <a
                      href={materials.find(m => m.id === selectedMaterialId)?.url || '#'}
                      download={materials.find(m => m.id === selectedMaterialId)?.name}
                      className="download-material-btn"
                      title="Descargar"
                    >
                      <i className="fas fa-download"></i>
                    </a>
                  )}
                </div>
              )}
            </div>
            {showMaterialsList && (
              <div className="materials-list">
              {materials.map((material) => (
                <div 
                  key={material.id} 
                  className={`material-card ${selectedMaterialId === material.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedMaterialId(selectedMaterialId === material.id ? null : material.id);
                  }}
                >
                  <div className="material-info">
                    <i className={`fas ${
                      material.type.includes('pdf') ? 'fa-file-pdf' :
                      material.type.includes('image') ? 'fa-file-image' :
                      material.type.includes('text') ? 'fa-file-alt' :
                      'fa-file'
                    }`}></i>
                    <span className="material-name">{material.name}</span>
                    <span className="material-size">
                      {(material.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              ))}
              </div>
            )}
          </section>
        )}
        
        <section className="concepts-section">
          <div className="concepts-header">
            <h2>Conceptos del Cuaderno</h2>
            
            {/* Barra de progreso de dominio */}
            {((isSchoolStudent && !cuaderno.isFrozen) || 
              (!isSchoolStudent && !isSchoolAdmin && !isSchoolTeacher)) && 
              conceptosDocs.length > 0 && (
              <div className="dominio-progress-container">
                {(() => {
                  const allConcepts = conceptosDocs.flatMap(doc => doc.conceptos);
                  const totalConcepts = allConcepts.length;
                  
                  if (totalConcepts === 0) return null;
                  
                  const dominadoCount = allConcepts.filter(c => {
                    const color = getTrafficLightColor(c.id);
                    return color === 'green';
                  }).length;
                  
                  const aprendizCount = allConcepts.filter(c => {
                    const color = getTrafficLightColor(c.id);
                    return color === 'yellow';
                  }).length;
                  
                  const porDominarCount = allConcepts.filter(c => {
                    const color = getTrafficLightColor(c.id);
                    return color === 'red';
                  }).length;
                  
                  const dominadoPercentage = Math.round((dominadoCount / totalConcepts) * 100);
                  const aprendizPercentage = Math.round((aprendizCount / totalConcepts) * 100);
                  const porDominarPercentage = Math.round((porDominarCount / totalConcepts) * 100);
                  
                  return (
                    <>
                      <div className="dominio-progress-bar">
                        <div 
                          className="dominio-progress-segment green" 
                          style={{ width: `${dominadoPercentage}%` }}
                          title={`Dominado: ${dominadoCount} conceptos (${dominadoPercentage}%)`}
                        />
                        <div 
                          className="dominio-progress-segment yellow" 
                          style={{ width: `${aprendizPercentage}%` }}
                          title={`Aprendiz: ${aprendizCount} conceptos (${aprendizPercentage}%)`}
                        />
                        <div 
                          className="dominio-progress-segment red" 
                          style={{ width: `${porDominarPercentage}%` }}
                          title={`Por dominar: ${porDominarCount} conceptos (${porDominarPercentage}%)`}
                        />
                      </div>
                      <div className="dominio-progress-labels">
                        <button 
                          className={`progress-label-btn ${dominioFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setDominioFilter('all')}
                          title="Mostrar todos los conceptos"
                        >
                          <i className="fas fa-list"></i>
                          <span>Todos</span>
                        </button>
                        <button 
                          className={`progress-label-btn ${dominioFilter === 'green' ? 'active' : ''}`}
                          onClick={() => setDominioFilter('green')}
                          title={`${dominadoCount} conceptos dominados`}
                        >
                          <span className="label-dot green"></span>
                          <span>{dominadoPercentage}% Dominado</span>
                        </button>
                        <button 
                          className={`progress-label-btn ${dominioFilter === 'yellow' ? 'active' : ''}`}
                          onClick={() => setDominioFilter('yellow')}
                          title={`${aprendizCount} conceptos en aprendizaje`}
                        >
                          <span className="label-dot yellow"></span>
                          <span>{aprendizPercentage}% Aprendiz</span>
                        </button>
                        <button 
                          className={`progress-label-btn ${dominioFilter === 'red' ? 'active' : ''}`}
                          onClick={() => setDominioFilter('red')}
                          title={`${porDominarCount} conceptos por dominar`}
                        >
                          <span className="label-dot red"></span>
                          <span>{porDominarPercentage}% Por dominar</span>
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          
          <div className="concepts-list">
            {cuaderno.isFrozen && cuaderno.type === 'school' && isSchoolStudent ? (
              <div className="frozen-notebook-message">
                <i className="fas fa-snowflake"></i>
                <h3>Cuaderno Congelado</h3>
                <p>Este cuaderno ha sido congelado por tu profesor.</p>
                <p>No puedes estudiar ni ver los conceptos en este momento.</p>
                {cuaderno.frozenScore !== undefined && (
                  <div className="frozen-score-display">
                    <span>Tu puntuación al momento de congelar:</span>
                    <span className="score">{cuaderno.frozenScore}%</span>
                  </div>
                )}
              </div>
            ) : conceptosDocs.length === 0 ? (
              <div className="empty-state">
                <p>Aún no hay conceptos en este cuaderno.</p>
                {(!isSchoolStudent && !isSchoolAdmin) || isSchoolTeacher ? (
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
                      
                      // Filtrar según el filtro de dominio seleccionado
                      // Aplicar filtro para estudiantes escolares también si el notebook no está congelado
                      if (dominioFilter !== 'all' && trafficLightColor !== dominioFilter) {
                        return null;
                      }
                      
                      // Filtrar por material seleccionado
                      if (selectedMaterialId && concepto.materialId !== selectedMaterialId) {
                        return null;
                      }
                      
                      return (
                        <div 
                          key={`${doc.id}-${conceptIndex}`}
                          className={`concept-card ${!isSchoolTeacher ? `traffic-light-${trafficLightColor}` : ''}`}
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
                    }).filter(Boolean)
                  )}
                  
                  {/* Tarjeta para añadir nuevos conceptos - Para usuarios no escolares ni admin, y para profesores */}
                  {((!isSchoolStudent && !isSchoolAdmin) || isSchoolTeacher) &&
                   !cuaderno.isFrozen && (
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

      {/* Modal - Solo visible para usuarios con permisos (incluye profesores) */}
      {isModalOpen && (!isSchoolStudent || isSchoolTeacher) && ReactDOM.createPortal(
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
                            <li key={index}>
                              <span className="file-name">{file.name}</span>
                              <div className="file-actions">
                                <button 
                                  className="preview-button"
                                  onClick={() => {
                                    setPreviewFile(file);
                                    setIsPreviewOpen(true);
                                  }}
                                  title="Previsualizar"
                                >
                                  <i className="fas fa-eye"></i>
                                </button>
                                <button 
                                  className="remove-button"
                                  onClick={() => {
                                    setArchivos(archivos.filter((_, i) => i !== index));
                                  }}
                                  title="Eliminar"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </div>
                            </li>
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
      
      {/* Modal de previsualización */}
      {isPreviewOpen && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setIsPreviewOpen(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h3>{previewFile?.name}</h3>
              <button 
                className="close-preview-button"
                onClick={() => {
                  setIsPreviewOpen(false);
                  setPreviewFile(null);
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="preview-content">
              {renderFilePreview()}
            </div>
          </div>
        </div>,
        document.body
      )}
      
    </div>
  );
};

export default NotebookDetail;