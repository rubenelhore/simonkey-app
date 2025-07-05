import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { Concept } from '../types/interfaces';
import { useStudyService } from '../hooks/useStudyService';

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
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { generateConcepts, prepareFilesForGeneration } from '../services/firebaseFunctions';
import '../styles/NotebookDetail.css';
import ReactDOM from 'react-dom';

interface ConceptDoc {
  id: string;
  cuadernoId: string;
  usuarioId: string;
  conceptos: Concept[];
  creadoEn: Date;
}

const SchoolNotebookDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cuaderno, setCuaderno] = useState<any>(null);
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
  
  // Referencia para el modal
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Usar el hook de estudio
  const studyService = useStudyService();

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
        // Fetch notebook details (COLECCIÓN ESCOLAR)
        const docRef = doc(db, 'schoolNotebooks', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCuaderno({ id: docSnap.id, ...data });
        } else {
          console.error("No such school notebook!");
          navigate('/school/teacher');
          return;
        }
        
        // Fetch concept documents for this notebook (COLECCIÓN ESCOLAR)
        const q = query(
          collection(db, 'schoolConcepts'),
          where('cuadernoId', '==', id)
        );
        
        const querySnapshot = await getDocs(q);
        const conceptosData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ConceptDoc[];
        
        setConceptosDocs(conceptosData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchData();
  }, [id, navigate]);

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

    setCargando(true);
    setLoadingText("Procesando archivos...");

    try {
      // Preparar archivos para el procesamiento (indicar que es cuaderno escolar)
      const processedFiles = await prepareFilesForGeneration(archivos, true);
      setLoadingText("Generando conceptos con IA...");

      // Generar conceptos usando Cloud Functions
      const results = await generateConcepts(processedFiles, id);
      
      // Procesar resultados
      let totalConcepts = 0;
      let conceptIds: string[] = [];
      
      for (const result of results) {
        const data = result.data as any;
        if (data?.success) {
          totalConcepts += data.conceptCount || 0;
          if (data.conceptIds) {
            conceptIds.push(...data.conceptIds);
          }
        }
      }

      if (totalConcepts > 0) {
        setLoadingText("Creando datos de aprendizaje...");
        
        // Crear datos de aprendizaje para los nuevos conceptos
        if (conceptIds.length > 0) {
          await createInitialLearningDataForConcepts(conceptIds, auth.currentUser.uid, id);
        }

        // Recargar los conceptos
        const q = query(
          collection(db, 'schoolConcepts'),
          where('cuadernoId', '==', id)
        );
        const querySnapshot = await getDocs(q);
        const conceptosData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ConceptDoc[];
        setConceptosDocs(conceptosData);

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

  const agregarConceptoManual = async () => {
    if (!id || !auth.currentUser || !nuevoConcepto.término || !nuevoConcepto.definición) {
      alert("Por favor completa todos los campos");
      return;
    }

    setCargando(true);
    setLoadingText("Guardando concepto...");

    try {
      // Generar ID único para el concepto
      const conceptoManual: Concept = {
        ...nuevoConcepto,
        id: `manual_${Date.now()}`
      };

      // Agregar a la colección escolar
      const conceptosRef = collection(db, 'schoolConcepts');
      await addDoc(conceptosRef, {
        cuadernoId: id,
        usuarioId: auth.currentUser.uid,
        conceptos: [conceptoManual],
        creadoEn: serverTimestamp()
      });

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
      
      // Recargar conceptos
      const q = query(
        collection(db, 'schoolConcepts'),
        where('cuadernoId', '==', id)
      );
      const querySnapshot = await getDocs(q);
      const conceptosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ConceptDoc[];
      setConceptosDocs(conceptosData);
      
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
    setActiveTab(tab);
    setIsModalOpen(true);
  };

  // Muestra spinner de carga mientras se obtienen los datos
  if (!cuaderno) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando cuaderno escolar...</p>
      </div>
    );
  }

  return (
    <div className="notebook-detail-container">
      <header className="notebook-detail-header">
        <div className="header-content">
          <button onClick={() => navigate('/school/teacher')} className="back-button">
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
                <button
                  className="add-first-concept-button"
                  onClick={() => openModalWithTab("upload")}
                >
                  Añadir mi primer concepto
                </button>
              </div>
            ) : (
              <>
                <div className="concept-cards">
                  {conceptosDocs.flatMap((doc) => 
                    doc.conceptos.map((concepto, conceptIndex) => (
                      <div 
                        key={`${doc.id}-${conceptIndex}`}
                        className="concept-card"
                        onClick={() => navigate(`/school/notebooks/${id}/concepto/${doc.id}/${conceptIndex}`)}
                      >
                        <h4>{concepto.término}</h4>
                      </div>
                    ))
                  )}
                  
                  {/* Tarjeta para añadir nuevos conceptos */}
                  <div 
                    className="add-concept-card" 
                    onClick={() => openModalWithTab('upload')}
                  >
                    <div className="add-icon">
                      <i className="fas fa-plus-circle"></i>
                    </div>
                    <h4>Añadir nuevos conceptos</h4>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Modal */}
      {isModalOpen && ReactDOM.createPortal(
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
      
      {/* Botón flotante para añadir conceptos (visible en móvil) */}
      <button 
        className="floating-add-button"
        onClick={() => openModalWithTab('upload')}
      >
        <i className="fas fa-plus"></i>
      </button>
    </div>
  );
};

export default SchoolNotebookDetail; 