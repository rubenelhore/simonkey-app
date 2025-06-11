import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { Concept } from '../types/interfaces';

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
  serverTimestamp 
} from 'firebase/firestore';
import { GoogleGenerativeAI} from '@google/generative-ai';
import '../styles/NotebookDetail.css';
import ReactDOM from 'react-dom';

// Add TypeScript declaration for window.env
declare global {
  interface Window {
    env?: {
      VITE_GEMINI_API_KEY?: string;
      [key: string]: any;
    };
  }
}

interface ConceptDoc {
  id: string;
  cuadernoId: string;
  usuarioId: string;
  conceptos: Concept[];
  creadoEn: Date;
}

// Function to convert Uint8Array to base64 string
function arrayBufferToBase64(buffer: Uint8Array | ArrayBuffer): string {
  // If buffer is ArrayBuffer, convert to Uint8Array
  const uint8Array = buffer instanceof ArrayBuffer 
    ? new Uint8Array(buffer) 
    : buffer;
  
  // Convert Uint8Array to a string of characters
  const binaryString = uint8Array.reduce(
    (data, byte) => data + String.fromCharCode(byte), 
    ''
  );
  
  // Convert binary string to base64
  return btoa(binaryString);
}

const NotebookDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cuaderno, setCuaderno] = useState<any>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [conceptosDocs, setConceptosDocs] = useState<ConceptDoc[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>("Cargando...");
  const [model, setModel] = useState<any>(null);
  const [apiKeyError, setApiKeyError] = useState<boolean>(false);
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
  
  // Añadir estos estados
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  // Initialize Gemini AI
  useEffect(() => {
    const initializeGemini = () => {
      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          console.error("Gemini API key is missing. Check your .env file.");
          setApiKeyError(true);
          return null;
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        // Importante: Usamos gemini-1.5-flash-latest para mejor soporte de archivos PDF
        const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
        setModel(geminiModel);
        return geminiModel;
      } catch (error) {
        console.error("Error initializing Gemini AI:", error);
        setApiKeyError(true);
        return null;
      }
    };

    initializeGemini();
  }, []);

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
        const docRef = doc(db, 'notebooks', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCuaderno({ id: docSnap.id, ...data });
        } else {
          console.error("No such notebook!");
          navigate('/notebooks');
          return;
        }
        
        // Fetch concept documents for this notebook
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
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchData();
  }, [id, navigate]);

  // Añadir al inicio del componente, después de cargar los datos del cuaderno
  useEffect(() => {
    if (cuaderno && cuaderno.color) {
      // Actualizar la variable CSS para que afecte a todos los elementos que la usan
      document.documentElement.style.setProperty('--notebook-color', cuaderno.color);
    } else {
      // Restaurar el valor predeterminado si no hay color personalizado
      document.documentElement.style.setProperty('--notebook-color', 'var(--primary-color)');
    }

    // Limpiar al desmontar el componente
    return () => {
      document.documentElement.style.setProperty('--notebook-color', 'var(--primary-color)');
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

  // Definimos una interfaz personalizada para nuestros archivos procesados
  interface ProcessedFile {
    mimeType: string;
    data: Uint8Array;
  }

  const fileToProcessedFile = async (file: File): Promise<ProcessedFile> => {
    const bytes = await file.arrayBuffer();
    return {
      mimeType: file.type,
      data: new Uint8Array(bytes)
    };
  };

  const generarConceptos = async () => {
    if (!model || !id || !auth.currentUser) {
      alert("No se pudo inicializar la IA o la sesión de usuario");
      return;
    }

    if (archivos.length === 0) {
      alert("Por favor selecciona al menos un archivo PDF");
      return;
    }

    setCargando(true);
    setLoadingText("Preparando archivos para análisis...");

    try {
      // Convertir archivos a nuestro formato personalizado de procesamiento
      const filePromises = archivos.map(file => fileToProcessedFile(file));
      const fileContents = await Promise.all(filePromises);
      
      setLoadingText("Generando conceptos con IA...");

      // Crear el prompt para Gemini
      const prompt = `
        Por favor, analiza estos archivos y extrae una lista de conceptos clave con sus definiciones.
        Devuelve el resultado como un array JSON con el siguiente formato:
        [
          {
            "término": "nombre del concepto",
            "definición": "explicación concisa del concepto (20-30 palabras)",
            "fuente": "nombre del documento"
          }
        ]
        Extrae al menos 10 conceptos importantes si el documento es lo suficientemente extenso.
        Asegúrate de que el resultado sea únicamente el array JSON, sin texto adicional.
      `;

      // Crear un contenido con partes para enviar a Gemini
      const result = await model.generateContent({
        contents: [{
          parts: [
            { text: prompt },
            ...fileContents.map(file => ({
              inlineData: {
                mimeType: file.mimeType,
                // Convertir el Uint8Array a base64 string como requiere la API de Gemini
                data: arrayBufferToBase64(file.data)
              }
            }))
          ]
        }],
      });

      const respuesta = result.response.text();
      
      // Parse the JSON response
      let conceptosExtraidos: Concept[] = [];
      try {
        // Clean the response: remove potential markdown backticks and trim whitespace
        let cleanedRespuesta = respuesta.trim();
        if (cleanedRespuesta.startsWith("```json")) {
          cleanedRespuesta = cleanedRespuesta.substring(7, cleanedRespuesta.length - 3).trim();
        } else if (cleanedRespuesta.startsWith("```")) { 
          cleanedRespuesta = cleanedRespuesta.substring(3, cleanedRespuesta.length - 3).trim();
        }

        // Directly parse the cleaned response
        conceptosExtraidos = JSON.parse(cleanedRespuesta);

      } catch (e) {
        console.error('Error parsing JSON response:', e);
        console.log('Raw response received:', respuesta); // Log original response for debugging
        alert('Error al interpretar la respuesta de la IA. Por favor intenta de nuevo.');
        setCargando(false);
        return;
      }

      // --- Check if the result is actually an array ---
      if (!Array.isArray(conceptosExtraidos)) {
        console.error('Parsed response is not an array:', conceptosExtraidos);
        console.log('Raw response received:', respuesta);
        alert('La respuesta de la IA no tuvo el formato esperado (array JSON). Intenta de nuevo.');
        setCargando(false);
        return;
      }

      if (!conceptosExtraidos.length) {
        alert('No se pudieron extraer conceptos del documento. Intenta con otro PDF.');
        setCargando(false);
        return;
      }

      setLoadingText("Guardando conceptos...");

      let updatedConceptosDoc: ConceptDoc | null = null;
      if (conceptosDocs.length > 0) {
        // Si existe al menos un documento para este cuaderno, actualizamos el primero
        const existingDoc = conceptosDocs.find(doc => doc.cuadernoId === id);
        if (existingDoc) {
          const conceptosRef = doc(db, 'conceptos', existingDoc.id);
          
          // IMPORTANTE: Usa el array completo en lugar de arrayUnion para evitar documentos duplicados
          await updateDoc(conceptosRef, {
            conceptos: [...existingDoc.conceptos, ...conceptosExtraidos]
          });
          
          updatedConceptosDoc = {
            ...existingDoc,
            conceptos: [...existingDoc.conceptos, ...conceptosExtraidos]
          };
          setConceptosDocs(prev =>
            prev.map(doc => (doc.id === existingDoc.id ? updatedConceptosDoc! : doc))
          );
        }
      }

      if (!updatedConceptosDoc) {
        // Si no existe ningún documento, creamos uno nuevo
        // IMPORTANTE: Genera un nuevo ID para el documento en lugar de usar el ID del cuaderno
        const newDocRef = doc(collection(db, 'conceptos'));
        const newDocId = newDocRef.id;
        
        await setDoc(newDocRef, {
          id: newDocId,
          cuadernoId: id,
          usuarioId: auth.currentUser?.uid || '',
          conceptos: conceptosExtraidos,
          creadoEn: serverTimestamp()
        });
        
        // Agregamos al estado local
        setConceptosDocs(prev => [
          ...prev,
          {
            id: newDocId,  // Usa el nuevo ID generado
            cuadernoId: id,
            usuarioId: auth.currentUser?.uid || '',
            conceptos: conceptosExtraidos,
            creadoEn: new Date()
          }
        ]);
      }

      // Clear file input
      setArchivos([]);
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Cerrar el modal después de generación exitosa
      setIsModalOpen(false);
      
      alert(`¡Se generaron ${conceptosExtraidos.length} conceptos exitosamente!`);
    } catch (error) {
      console.error('Error al generar conceptos:', error);
      alert('Error al procesar los materiales. Archivos aceptados: pdf, csv, txt');
    }
    
    setCargando(false);
  };

  // Función para eliminar el cuaderno y todos sus conceptos relacionados

  // Función para añadir concepto manualmente
  const agregarConceptoManual = async () => {
    if (!id || !auth.currentUser) {
      alert("No se pudo verificar la sesión de usuario");
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
        id: ''
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
          setConceptosDocs(prev =>
            prev.map(doc => (doc.id === existingDoc.id ? updatedConceptosDoc! : doc))
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
        
        setConceptosDocs(prev => [
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
    setActiveTab(tab);
    setIsModalOpen(true);
  };

  // Función para manejar el compartir
  const handleShareNotebook = async () => {
    if (!id || !cuaderno) return;
    
    try {
      // Verificar si el cuaderno ya tiene un shareId
      if (!cuaderno.shareId) {
        // Crear un shareId único
        const shareId = crypto.randomUUID();
        
        // Actualizar el documento del cuaderno con el shareId
        const notebookRef = doc(db, 'notebooks', id);
        await updateDoc(notebookRef, {
          shareId: shareId,
          isShared: true,
          sharedAt: serverTimestamp()
        });
        
        // Actualizar el estado local
        setCuaderno({...cuaderno, shareId, isShared: true});
        
        // Generar el enlace compartible
        const shareUrl = `${window.location.origin}/shared/${shareId}`;
        setShareLink(shareUrl);
      } else {
        // Usar el shareId existente
        const shareUrl = `${window.location.origin}/shared/${cuaderno.shareId}`;
        setShareLink(shareUrl);
      }
      
      // Abrir el modal de compartir
      setIsShareModalOpen(true);
    } catch (error) {
      console.error("Error al compartir cuaderno:", error);
      alert('Error al compartir el cuaderno. Por favor intenta nuevamente.');
    }
  };

  // Función para copiar el enlace al clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('Error al copiar: ', err);
      });
  };

  // Componentes del modal
  const renderModalContent = () => {
    return (
      <div className="modal-content" ref={modalRef}>
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
              {apiKeyError && (
                <div className="error-message">
                  <p>⚠️ No se pudo inicializar la IA. Verifica la clave API de Gemini en tu archivo .env.</p>
                </div>
              )}
              
              <input
                type="file"
                id="pdf-upload"
                multiple
                accept="*/*"
                onChange={handleFileChange}
                disabled={cargando}
                className="file-input"
              />
              <div className="selected-files">
                {archivos.length > 0 && (
                  <>
                    <p><strong>Archivos seleccionados:</strong></p>
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
                disabled={archivos.length === 0 || cargando || apiKeyError}
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
    );
  };

  // Muestra spinner de carga mientras se obtienen los datos
  if (!cuaderno) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando cuaderno...</p>
      </div>
    );
  }

  return (
    <div className="notebook-detail-container">
      <header className="notebook-detail-header">
        <div className="header-content">
          <button onClick={() => navigate('/notebooks')} className="back-button">
            <i className="fas fa-arrow-left"></i>
          </button>
          
          <div className="title-container">
            <h1>{cuaderno.title}</h1>
          </div>
          
          <div className="header-actions">
            <button onClick={handleShareNotebook} className="share-button" title="Compartir cuaderno">
              <i className="fas fa-share-alt"></i>
            </button>
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
                  onClick={() => openModalWithTab('upload')}
                >
                  <i className="fas fa-plus"></i> Añadir mi primer concepto
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
                        onClick={() => navigate(`/notebooks/${id}/concepto/${doc.id}/${conceptIndex}`)}
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
          {renderModalContent()}
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

      {/* Modal para compartir cuaderno */}
      {isShareModalOpen && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsShareModalOpen(false);
          }
        }}>
          <div className="modal-content share-modal">
            <div className="modal-header">
              <h2>Compartir Cuaderno</h2>
              <button className="close-modal-button" onClick={() => setIsShareModalOpen(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <p>Comparte este enlace para que otros usuarios puedan acceder a tu cuaderno:</p>
              
              <div className="share-link-container">
                <input 
                  type="text" 
                  value={shareLink} 
                  className="share-link-input" 
                  readOnly 
                />
                <button 
                  onClick={copyToClipboard} 
                  className="copy-button"
                >
                  {copySuccess ? <i className="fas fa-check"></i> : <i className="fas fa-copy"></i>}
                </button>
              </div>
              
              <div className="share-options">
                <h3>Compartir en:</h3>
                <div className="social-buttons">
                  <a 
                    href={`https://wa.me/?text=¡Mira este cuaderno de estudio en Simonkey! ${encodeURIComponent(shareLink)}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="social-button whatsapp"
                  >
                    <i className="fab fa-whatsapp"></i>
                  </a>
                  <a 
                    href={`mailto:?subject=Cuaderno compartido desde Simonkey&body=¡Hola! He compartido contigo un cuaderno de estudio en Simonkey. Puedes acceder a él aquí: ${encodeURIComponent(shareLink)}`} 
                    className="social-button email"
                  >
                    <i className="fas fa-envelope"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default NotebookDetail;