import React, { useState, useEffect, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import { doc, getDoc, updateDoc, deleteDoc, onSnapshot, query, collection, where } from 'firebase/firestore';
import '../styles/ConceptDetail.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import TextToSpeech from '../components/TextToSpeech';
import '../styles/TextToSpeech.css';
import { loadVoiceSettings } from '../hooks/voiceService';
import { Concept } from '../types/interfaces';

const ConceptDetail: React.FC = () => {
  const { notebookId, conceptoId, index } = useParams<{ 
    notebookId: string, 
    conceptoId: string, 
    index: string 
  }>();
  const navigate = useNavigate();
  const [concepto, setConcepto] = useState<Concept | null>(null);
  const [cuaderno, setCuaderno] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedConcept, setEditedConcept] = useState<Concept | null>(null);
  
  // Estados para las notas personales
  const [notasPersonales, setNotasPersonales] = useState<string>('');
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  
  // Navegación entre conceptos - SISTEMA GLOBAL
  const [totalConcepts, setTotalConcepts] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [globalIndex, setGlobalIndex] = useState<number>(0);
  const [allConcepts, setAllConcepts] = useState<{ conceptoId: string, localIndex: number, concepto: any }[]>([]);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Añade este estado
  const [conceptProgress, setConceptProgress] = useState<number>(0);

  // Añade este estado para almacenar conceptos precargados
  const [preloadedConcepts, setPreloadedConcepts] = useState<{[key: number]: Concept}>({});

  // Y modifica la inicialización del estado para cargar la preferencia guardada
  const [autoReadEnabled, setAutoReadEnabled] = useState<boolean>(() => {
    const savedPreference = localStorage.getItem('autoReadEnabled');
    return savedPreference ? JSON.parse(savedPreference) : true;
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!notebookId || !conceptoId || index === undefined) {
        setError("Información insuficiente para cargar el concepto");
        setLoading(false);
        return;
      }
  
      try {
        const cuadernoRef = doc(db, 'notebooks', notebookId);
        const conceptoRef = doc(db, 'conceptos', conceptoId);
        
        // Obtener los datos en paralelo
        const [cuadernoSnap, conceptoSnap] = await Promise.all([
          getDoc(cuadernoRef),
          getDoc(conceptoRef),
        ]);
        
        if (!cuadernoSnap.exists()) {
          setError("El cuaderno no existe");
          setLoading(false);
          return;
        }
        
        if (!conceptoSnap.exists()) {
          setError("El concepto no existe");
          setLoading(false);
          return;
        }
        
        setCuaderno({ id: cuadernoSnap.id, ...cuadernoSnap.data() });
        
        const conceptos = conceptoSnap.data().conceptos;
        const idx = parseInt(index);
        
        // IMPORTANTE: Actualizar el total de conceptos aquí
        setTotalConcepts(conceptos.length);
        
        if (idx < 0 || idx >= conceptos.length) {
          setError("Índice de concepto fuera de rango");
          setLoading(false);
          return;
        }
        
        const conceptoData = conceptos[idx];
        setConcepto(conceptoData);
        setCurrentIndex(idx);
        
        // Inicializar notas personales si existen
        if (conceptoData.notasPersonales) {
          setNotasPersonales(conceptoData.notasPersonales);
        }
        
        // Simular un progreso basado en visitas (esto es un ejemplo; 
        // idealmente se almacenaría en Firestore)
        if (concepto) {
          const progressKey = `progress_${notebookId}_${conceptoId}_${idx}`;
          let progress = parseInt(localStorage.getItem(progressKey) || "0");
          
          // Incrementar en 1 cada vez que se visita, hasta 100
          progress = Math.min(progress + 1, 100);
          localStorage.setItem(progressKey, progress.toString());
          
          setConceptProgress(progress);
        }

        setLoading(false);

        // IMPORTANTE: Implementación mejorada de autoRead
        if (auth.currentUser && autoReadEnabled) {
          try {
            // Cargar configuraciones de voz del usuario
            const voiceSettings = await loadVoiceSettings();
            
            // Verificar si autoRead está habilitado
            if (voiceSettings && voiceSettings.autoRead) {
              triggerAutoRead(1500);
            }
          } catch (error) {
            console.error("Error al cargar configuraciones de voz:", error);
            
            // Intentar cargar desde localStorage como respaldo
            try {
              const localSettings = localStorage.getItem('voiceSettings');
              if (localSettings) {
                const settings = JSON.parse(localSettings);
                if (settings.autoRead) {
                  triggerAutoRead(1500);
                }
              }
            } catch (e) {
              console.error("Error al cargar configuraciones desde localStorage:", e);
            }
          }
        }

        // Precargar conceptos cercanos
        preloadNearbyConcepts(idx);
      } catch (error) {
        console.error("Error cargando datos:", error);
        setError("Error al cargar los datos del concepto");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [notebookId, conceptoId, index, autoReadEnabled]);

  // Nuevo useEffect para actualizar totalConcepts cuando cambien los parámetros
  useEffect(() => {
    const updateTotalConcepts = async () => {
      if (!conceptoId) return;
      
      try {
        const conceptoRef = doc(db, 'conceptos', conceptoId);
        const conceptoSnap = await getDoc(conceptoRef);
        
        if (conceptoSnap.exists()) {
          const conceptos = conceptoSnap.data().conceptos;
          setTotalConcepts(conceptos.length);
        }
      } catch (error) {
        console.error("Error actualizando total de conceptos:", error);
      }
    };

    updateTotalConcepts();
  }, [conceptoId]);

  // Listener en tiempo real para detectar cambios en TODOS los documentos de conceptos del cuaderno
  useEffect(() => {
    if (!notebookId) return;

    console.log('🔍 Iniciando listener para TODOS los conceptos del cuaderno:', notebookId);
    
    // Crear query para todos los documentos de conceptos del cuaderno
    const conceptosQuery = query(
      collection(db, 'conceptos'),
      where('cuadernoId', '==', notebookId)
    );
    
    const unsubscribe = onSnapshot(conceptosQuery, (querySnapshot) => {
      let totalConceptos = 0;
      const conceptosArray: { conceptoId: string, localIndex: number, concepto: any }[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.conceptos && Array.isArray(data.conceptos)) {
          // Agregar cada concepto con su información de documento
          data.conceptos.forEach((concepto: any, localIndex: number) => {
            conceptosArray.push({
              conceptoId: doc.id,
              localIndex: localIndex,
              concepto: concepto
            });
          });
          totalConceptos += data.conceptos.length;
        }
      });
      
      console.log('📊 Listener detectó cambio - Total conceptos en cuaderno:', totalConceptos, 'Anterior:', totalConcepts);
      console.log('📋 Array de conceptos globales:', conceptosArray);
      
      setTotalConcepts(totalConceptos);
      setAllConcepts(conceptosArray);
    }, (error) => {
      console.error("Error en listener de conceptos:", error);
    });

    return () => {
      console.log('🔍 Desconectando listener para cuaderno:', notebookId);
      unsubscribe();
    };
  }, [notebookId]);

  useEffect(() => {
    if (cuaderno && cuaderno.color) {
      // Set the notebook color CSS variable
      document.documentElement.style.setProperty('--notebook-color', cuaderno.color);
    } else {
      // Reset to default if no color
      document.documentElement.style.setProperty('--notebook-color', 'var(--primary-color)');
    }

    // Cleanup function to reset the color when component unmounts
    return () => {
      document.documentElement.style.setProperty('--notebook-color', 'var(--primary-color)');
    };
  }, [cuaderno]);

  // Añade este effect para los atajos de teclado
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // No activar si estamos en un campo de texto
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (event.key === 'ArrowRight' && globalIndex < totalConcepts - 1) {
        navigateToNextConcept();
      } else if (event.key === 'ArrowLeft' && globalIndex > 0) {
        navigateToPreviousConcept();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [globalIndex, totalConcepts, conceptoId, notebookId]);

  // Sincronizar el globalIndex con la URL
  useEffect(() => {
    if (!allConcepts.length || !conceptoId || index === undefined) return;
    
    const idx = allConcepts.findIndex(
      item => item.conceptoId === conceptoId && item.localIndex === parseInt(index)
    );
    
    if (idx !== -1) {
      console.log('🔄 Sincronizando globalIndex:', idx, 'para concepto:', conceptoId, 'índice local:', index);
      setGlobalIndex(idx);
    }
  }, [allConcepts, conceptoId, index]);

  // Añade este efecto para persistir la preferencia de autolectura
  useEffect(() => {
    localStorage.setItem('autoReadEnabled', JSON.stringify(autoReadEnabled));
  }, [autoReadEnabled]);

  // Función para precargar conceptos cercanos (siguiente y anterior)
  const preloadNearbyConcepts = async (currentIdx: number) => {
    try {
      if (!conceptoId) return;
      
      const conceptoRef = doc(db, 'conceptos', conceptoId);
      const conceptoSnap = await getDoc(conceptoRef);
      
      if (!conceptoSnap.exists()) return;
      
      const allConcepts = conceptoSnap.data().conceptos;
      const preloadedData: {[key: number]: Concept} = {};
      
      // Precargar el concepto siguiente
      if (currentIdx + 1 < allConcepts.length) {
        preloadedData[currentIdx + 1] = allConcepts[currentIdx + 1];
      }
      
      // Precargar el concepto anterior
      if (currentIdx - 1 >= 0) {
        preloadedData[currentIdx - 1] = allConcepts[currentIdx - 1];
      }
      
      setPreloadedConcepts(preloadedData);
    } catch (error) {
      console.error("Error al precargar conceptos:", error);
    }
  };

  useEffect(() => {
    if (concepto && !loading) {
      // Precargar conceptos cercanos para navegación más fluida
      preloadNearbyConcepts(currentIndex);
    }
  }, [concepto, currentIndex, loading]);

  const handleDeleteConcept = async () => {
    if (!notebookId || !conceptoId || !concepto) return;
    
    if (window.confirm('¿Estás seguro de que deseas eliminar este concepto? Esta acción no se puede deshacer.')) {
      try {
        setDeleting(true);
        
        // Obtenemos la referencia al documento de conceptos
        const conceptoRef = doc(db, 'conceptos', conceptoId);
        const conceptoSnap = await getDoc(conceptoRef);
        
        if (!conceptoSnap.exists()) {
          throw new Error("El documento de conceptos no existe");
        }
        
        // Obtenemos todos los conceptos
        const allConceptos = conceptoSnap.data().conceptos;
        const idx = parseInt(index || '0');
        
        // Verificamos si es el único concepto en el grupo
        if (allConceptos.length === 1) {
          // Si es el único, eliminamos todo el documento
          await deleteDoc(conceptoRef);
        } else {
          // Si hay más conceptos, eliminamos solo este concepto del array
          // Creamos una nueva lista sin el concepto a eliminar
          const updatedConceptos = [
            ...allConceptos.slice(0, idx),
            ...allConceptos.slice(idx + 1)
          ];
          
          // Actualizamos el documento con la nueva lista de conceptos
          await updateDoc(conceptoRef, {
            conceptos: updatedConceptos
          });
        }
        
        // Redirigir al usuario de vuelta al cuaderno
        navigate(`/notebooks/${notebookId}`);
      } catch (error) {
        console.error("Error al eliminar el concepto:", error);
        alert("Ocurrió un error al eliminar el concepto. Por favor, inténtalo de nuevo.");
        setDeleting(false);
      }
    }
  };

  const handleEditConcept = () => {
    if (concepto) {
      setEditedConcept({ ...concepto } as Concept);
    }
    setIsEditing(true);
  };

  const handleSaveConcept = async () => {
    if (!editedConcept || !notebookId || !conceptoId) return;
    
    try {
      const conceptoRef = doc(db, 'conceptos', conceptoId);
      const conceptoSnap = await getDoc(conceptoRef);
      
      if (!conceptoSnap.exists()) {
        throw new Error("El documento de conceptos no existe");
      }
      
      const allConceptos = conceptoSnap.data().conceptos;
      const idx = parseInt(index || '0');
      
      const updatedConceptos = [...allConceptos];
      updatedConceptos[idx] = editedConcept;
      
      await updateDoc(conceptoRef, {
        conceptos: updatedConceptos
      });
      
      setConcepto(editedConcept);
      setIsEditing(false);
      
      alert("¡Concepto actualizado correctamente!");
    } catch (error) {
      console.error("Error al guardar el concepto:", error);
      alert("Ocurrió un error al guardar los cambios. Por favor, inténtalo de nuevo.");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedConcept(null);
  };

  const handleEditNotes = () => {
    setIsEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    if (!notebookId || !conceptoId || !concepto) return;
    
    try {
      setIsSavingNotes(true);
      
      // Obtenemos la referencia y datos actuales
      const conceptoRef = doc(db, 'conceptos', conceptoId);
      const conceptoSnap = await getDoc(conceptoRef);
      
      if (!conceptoSnap.exists()) {
        throw new Error("El documento de conceptos no existe");
      }
      
      // Obtenemos la lista completa de conceptos
      const allConceptos = conceptoSnap.data().conceptos;
      const idx = parseInt(index || '0');
      
      // Creamos una nueva lista con el concepto actualizado que incluye las notas
      const updatedConceptos = [...allConceptos];
      updatedConceptos[idx] = {
        ...updatedConceptos[idx],
        notasPersonales: notasPersonales
      };
      
      // Actualizamos el documento en Firebase
      await updateDoc(conceptoRef, {
        conceptos: updatedConceptos
      });
      
      // Actualizamos el estado local
      setConcepto({
        ...concepto,
        notasPersonales: notasPersonales
      });
      
      setIsEditingNotes(false);
      setIsSavingNotes(false);
      
    } catch (error) {
      console.error("Error al guardar las notas:", error);
      alert("Ocurrió un error al guardar las notas. Por favor, inténtalo de nuevo.");
      setIsSavingNotes(false);
    }
  };

  const handleCancelNotesEdit = () => {
    // Restaurar las notas originales
    if (concepto?.notasPersonales) {
      setNotasPersonales(concepto.notasPersonales);
    } else {
      setNotasPersonales('');
    }
    setIsEditingNotes(false);
  };

  // Funciones de navegación entre conceptos
  const navigateToNextConcept = () => {
    if (globalIndex < totalConcepts - 1) {
      setIsNavigating(true);
      const nextGlobalIndex = globalIndex + 1;
      setGlobalIndex(nextGlobalIndex);
      const next = allConcepts[nextGlobalIndex];
      
      console.log('➡️ Navegando al siguiente concepto global:', nextGlobalIndex, 'Documento:', next.conceptoId, 'Índice local:', next.localIndex);
      
      navigate(`/notebooks/${notebookId}/concepto/${next.conceptoId}/${next.localIndex}`);
    }
  };

  const navigateToPreviousConcept = () => {
    if (globalIndex > 0) {
      setIsNavigating(true);
      const prevGlobalIndex = globalIndex - 1;
      setGlobalIndex(prevGlobalIndex);
      const prev = allConcepts[prevGlobalIndex];
      
      console.log('⬅️ Navegando al concepto anterior global:', prevGlobalIndex, 'Documento:', prev.conceptoId, 'Índice local:', prev.localIndex);
      
      navigate(`/notebooks/${notebookId}/concepto/${prev.conceptoId}/${prev.localIndex}`);
    }
  };

  const loadConceptAtIndex = async (idx: number) => {
    try {
      setLoading(true);
      
      // Primero intentar usar un concepto precargado si está disponible
      if (preloadedConcepts[idx]) {
        const conceptoData = preloadedConcepts[idx];
        setConcepto(conceptoData);
        setCurrentIndex(idx);
        setNotasPersonales(conceptoData.notasPersonales || '');
        
        // Resetear estados
        setIsEditing(false);
        setIsEditingNotes(false);
        setEditedConcept(null);
        
        // Actualizar la URL sin recargar la página
        window.history.replaceState(
          null, 
          '', 
          `/notebooks/${notebookId}/concepto/${conceptoId}/${idx}`
        );
        
        // IMPORTANTE: Actualizar totalConcepts incluso cuando usamos conceptos precargados
        const conceptoRef = doc(db, 'conceptos', conceptoId as string);
        const conceptoSnap = await getDoc(conceptoRef);
        if (conceptoSnap.exists()) {
          const conceptos = conceptoSnap.data().conceptos;
          // ELIMINADO: setTotalConcepts(conceptos.length); // Esta línea sobrescribía el total correcto
        }
        
        // Autoread si está habilitado
        handleAutoRead();
        
        setLoading(false);
        return;
      }
      
      // Si no está precargado, cargarlo normalmente
      const conceptoRef = doc(db, 'conceptos', conceptoId as string);
      const conceptoSnap = await getDoc(conceptoRef);
      
      if (conceptoSnap.exists()) {
        const conceptos = conceptoSnap.data().conceptos;
        
        // ELIMINADO: setTotalConcepts(conceptos.length); // Esta línea sobrescribía el total correcto
        
        if (idx >= 0 && idx < conceptos.length) {
          const conceptoData = conceptos[idx];
          setConcepto(conceptoData);
          setCurrentIndex(idx);
          
          // Actualiza las notas personales
          setNotasPersonales(conceptoData.notasPersonales || '');
          
          // Resetea otros estados relacionados con la edición
          setIsEditing(false);
          setIsEditingNotes(false);
          setEditedConcept(null);
          
          // IMPORTANTE: Implementación mejorada para autoRead al navegar
          handleAutoRead();
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error cargando concepto:", error);
    } finally {
      setLoading(false);
      setIsNavigating(false);
    }
  };

  const handleAutoRead = async () => {
    // Verificar primero si autoReadEnabled está activado
    if (!autoReadEnabled) return;
    
    if (auth.currentUser) {
      try {
        const voiceSettings = await loadVoiceSettings();
        if (voiceSettings?.autoRead) {
          triggerAutoRead(800);
        }
      } catch (error) {
        console.error("Error al cargar configuraciones de voz:", error);
        fallbackToLocalStorage();
      }
    }
  };

  const fallbackToLocalStorage = () => {
    // Verificar primero si autoReadEnabled está activado
    if (!autoReadEnabled) return;
    
    try {
      const localSettings = localStorage.getItem('voiceSettings');
      if (localSettings) {
        const settings = JSON.parse(localSettings);
        if (settings.autoRead) {
          triggerAutoRead(800);
        }
      }
    } catch (e) {
      console.error("Error al cargar configuraciones desde localStorage:", e);
    }
  };

  const triggerAutoRead = (delay = 1000) => {
    setTimeout(() => {
      // Cancelar cualquier síntesis en curso primero
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      // Intentar encontrar el botón en diferentes selectores
      const selectors = [
        '.concept-definition .text-to-speech-button',
        '.notes-text .text-to-speech-button',
        '.text-to-speech-button'
      ];
      
      for (const selector of selectors) {
        const button = document.querySelector(selector);
        if (button instanceof HTMLButtonElement) {
          console.log(`Auto-reproducción activada (selector: ${selector})`);
          button.click();
          return true;
        }
      }
      
      console.warn("No se encontró ningún botón de reproducción");
      return false;
    }, delay);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando concepto...</p>
      </div>
    );
  }

  if (error || !concepto || !cuaderno) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error || "No se pudo cargar el concepto"}</p>
        <button 
          onClick={() => navigate(`/notebooks/${notebookId}`)}
          className="back-button"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
      </div>
    );
  }

  return (
    <div className="concept-detail-container">
      <header className="concept-detail-header">
        <div className="header-content">
          <div className="breadcrumb">
            <button 
              onClick={() => navigate(`/notebooks/${notebookId}`)}
              className="back-button"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <h1 className="centered-title">{cuaderno.title} - Conceptos</h1>
          </div>
        </div>
      </header>
      <main className="concept-detail-main">
        {/* Controles de navegación entre conceptos */}
        <div className="concept-navigation">
          <button 
            onClick={navigateToPreviousConcept}
            disabled={globalIndex === 0 || isNavigating}
            className={`concept-nav-button previous ${isNavigating ? 'navigating' : ''}`}
            aria-label="Concepto anterior"
            title="Concepto anterior"
          >
            {isNavigating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-chevron-left"></i>}
          </button>
          <div className="concept-pagination">
            {`${globalIndex + 1} / ${totalConcepts}`}
          </div>
          <button 
            onClick={navigateToNextConcept}
            disabled={globalIndex === totalConcepts - 1 || isNavigating}
            className={`concept-nav-button next ${isNavigating ? 'navigating' : ''}`}
            aria-label="Siguiente concepto"
            title="Siguiente concepto"
          >
            {isNavigating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-chevron-right"></i>}
          </button>
          <button 
            onClick={() => setAutoReadEnabled(!autoReadEnabled)}
            className="auto-read-toggle"
            title={autoReadEnabled ? "Desactivar lectura automática" : "Activar lectura automática"}
          >
            <i className={`fas ${autoReadEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
          </button>
        </div>
        
        <div className="concept-container">
          <div className="concept-card-detail">
            {!isEditing ? (
              // Modo de visualización
              <>
                <h2 className="concept-term">{concepto.término}</h2>
                <div className="concept-definition">
                  <h3>Definición:</h3>
                  <p>{concepto.definición}</p>
                  <TextToSpeech text={concepto.definición} buttonClassName="concept-tts-button" />
                </div>
                <div className="concept-source">
                  <h3>Fuente:</h3>
                  <cite>{concepto.fuente}</cite>
                </div>
                
                <div className="concept-actions">
                  <button 
                    className="edit-concept-button"
                    onClick={handleEditConcept}
                  >
                    <i className="fas fa-edit"></i> Editar concepto
                  </button>
                  <button 
                    style={{ marginLeft: '10px' }}
                    className="delete-concept-button"
                    onClick={handleDeleteConcept}
                    disabled={deleting}
                  >
                    <i className="fas fa-trash-alt"></i> Eliminar concepto
                  </button>
                </div>
              </>
            ) : (
              // Modo de edición
              <>
                <div className="edit-form">
                  <div className="form-group">
                    <label htmlFor="edit-term">Término:</label>
                    <input
                      id="edit-term"
                      type="text"
                      value={editedConcept?.término || ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setEditedConcept({
                        ...editedConcept as Concept,
                        término: e.target.value
                      })}
                      className="edit-input"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="edit-definition">Definición:</label>
                    <textarea
                      id="edit-definition"
                      value={editedConcept?.definición || ''}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEditedConcept({
                        ...editedConcept as Concept,
                        definición: e.target.value
                      })}
                      className="edit-textarea"
                      rows={6}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="edit-source">Fuente:</label>
                    <input
                      id="edit-source"
                      type="text"
                      value={editedConcept?.fuente || ''}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setEditedConcept({
                        ...editedConcept as Concept,
                        fuente: e.target.value
                      })}
                      className="edit-input"
                    />
                  </div>
                  
                  <div className="edit-actions">
                    <button 
                      className="save-button"
                      onClick={handleSaveConcept}
                    >
                      <i className="fas fa-save"></i> Guardar cambios
                    </button>
                    <button 
                      className="cancel-button"
                      onClick={handleCancelEdit}
                    >
                      <i className="fas fa-times"></i> Cancelar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sección de notas personales - TEMPORALMENTE OCULTA */}
          {/* 
          <div className="personal-notes-card">
            <div className="personal-notes-header">
              <h2>
                <i className="fas fa-sticky-note"></i>
                Mis notas personales
              </h2>
              {!isEditingNotes ? (
                <button 
                  className="edit-notes-button"
                  onClick={handleEditNotes}
                >
                  <i className="fas fa-pen"></i>
                  {notasPersonales ? 'Editar notas' : 'Añadir notas'}
                </button>
              ) : (
                <div className="notes-edit-actions">
                  <button 
                    className="save-notes-button"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                  >
                    <i className="fas fa-save"></i>
                    {isSavingNotes ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button 
                    className="cancel-notes-button"
                    onClick={handleCancelNotesEdit}
                    disabled={isSavingNotes}
                  >
                    <i className="fas fa-times"></i>
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="personal-notes-content">
              {!isEditingNotes ? (
                notasPersonales ? (
                  <div className="notes-text">
                    {notasPersonales.split('\n').map((line: string, i: number) => (
                      <p key={i}>{line}</p>
                    ))}
                    <TextToSpeech text={notasPersonales} buttonClassName="notes-tts-button" />
                  </div>
                ) : (
                  <div className="empty-notes">
                    <p>Aún no has añadido notas personales a este concepto.</p>
                    <p>Las notas te ayudan a personalizar tu aprendizaje y contextualizar el concepto a tu manera.</p>
                  </div>
                )
              ) : (
                <textarea
                  className="notes-textarea"
                  value={notasPersonales}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotasPersonales(e.target.value)}
                  placeholder="Escribe tus notas personales aquí. Puedes incluir ejemplos, asociaciones o cualquier cosa que te ayude a entender mejor este concepto."
                  rows={10}
                />
              )}
            </div>
          </div>
          */}
        </div>
      </main>
    </div>
  );
};

export default ConceptDetail;