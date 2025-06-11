import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import '../styles/ExplainConcept.css';
import { useUser } from '../hooks/useUser'; // Importar el hook useUser
import { Concept } from '../types/interfaces';

// Interfaz para el formato de conceptos en Firebase
interface ConceptDoc {
  id: string;
  cuadernoId: string;
  usuarioId: string;
  conceptos: {
    término: string;
    definición: string;
    fuente: string;
    notasPersonales?: string;
  }[];
  creadoEn: Date;
}

interface ExplainConceptProps {
  notebookId?: string;
}

const ExplainConcept: React.FC<ExplainConceptProps> = ({ notebookId: propNotebookId }) => {
  // Estados
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [model, setModel] = useState<any>(null);
  const [apiKeyError, setApiKeyError] = useState<boolean>(false);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const { user } = useUser(); // Obtener el usuario actual

  // Usa el notebookId de props o de parámetros de URL
  const params = useParams<Record<string, string>>();
  const paramNotebookId = params.notebookId;
  const notebookId = propNotebookId || paramNotebookId;

  // Inicializar Gemini AI
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
        // Usando gemini-1.5-flash para respuestas rápidas
        const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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

  // Cargar los conceptos cuando el componente se monta
  useEffect(() => {
    const fetchConcepts = async () => {
      if (!notebookId) return;
      
      setIsLoading(true);
      try {
        // Consultar conceptos asociados a este cuaderno desde Firebase
        const q = query(
          collection(db, 'conceptos'),
          where('cuadernoId', '==', notebookId)
        );
        
        const querySnapshot = await getDocs(q);
        const conceptDocs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ConceptDoc[];
        
        // Transformar los documentos de conceptos al formato requerido por el componente
        let transformedConcepts: Concept[] = [];
        
        conceptDocs.forEach(doc => {
          // Cada documento puede contener múltiples conceptos
          doc.conceptos.forEach((concepto, index) => {
            return transformedConcepts.push({
              id: `${doc.id}-${index}`, // Crear un ID único combinando el ID del documento y el índice
              término: concepto.término,
              definición: concepto.definición,
              docId: doc.id, // Guardamos el ID del documento
              index: index,
              fuente: ''
            });
          });
        });
        
        setConcepts(transformedConcepts);
      } catch (error) {
        console.error('Error al cargar los conceptos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConcepts();
  }, [notebookId]);

  // Obtener intereses del usuario (versión mejorada)
  useEffect(() => {
    const fetchUserInterests = async () => {
      if (!user?.id) {
        console.log("No hay ID de usuario disponible");
        return;
      }
      
      console.log("Configurando listener para intereses de usuario ID:", user.id);
      
      // Referencia al documento del usuario - corregida a 'users' en lugar de 'usuarios'
      const userDocRef = doc(db, 'users', user.id);
      
      try {
        // Primero hacemos una lectura única para tener datos inmediatamente
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          console.log("Datos iniciales de usuario:", userData);
          
          if (userData.intereses && Array.isArray(userData.intereses)) {
            console.log("Intereses iniciales:", userData.intereses);
            const validInterests = userData.intereses.filter(interest => interest && interest.trim() !== '');
            setUserInterests(validInterests.length > 0 ? validInterests : ['']);
          } else if (userData.interests && Array.isArray(userData.interests)) {
            // También buscar en el campo "interests" para compatibilidad
            console.log("Intereses iniciales (campo alternativo):", userData.interests);
            const validInterests = userData.interests.filter(interest => interest && interest.trim() !== '');
            setUserInterests(validInterests.length > 0 ? validInterests : ['']);
          }
        }
      } catch (error) {
        console.error("Error obteniendo datos iniciales:", error);
      }
      
      // Configurar un listener en tiempo real para cambios FUTUROS
      const unsubscribe = onSnapshot(
        userDocRef, 
        { includeMetadataChanges: true },
        (userDocSnap) => {
          if (userDocSnap.exists() && !userDocSnap.metadata.fromCache) {
            const userData = userDocSnap.data();
            console.log("ACTUALIZACIÓN EN TIEMPO REAL - Datos de usuario:", userData);
            
            if (userData.intereses && Array.isArray(userData.intereses)) {
              console.log("ACTUALIZACIÓN EN TIEMPO REAL - Intereses:", userData.intereses);
              const validInterests = userData.intereses.filter(interest => interest && interest.trim() !== '');
              setUserInterests(validInterests.length > 0 ? validInterests : ['']);
            } else if (userData.interests && Array.isArray(userData.interests)) {
              console.log("ACTUALIZACIÓN EN TIEMPO REAL - Intereses (campo alternativo):", userData.interests);
              const validInterests = userData.interests.filter(interest => interest && interest.trim() !== '');
              setUserInterests(validInterests.length > 0 ? validInterests : ['']);
            } else {
              console.log("No se encontraron intereses en la actualización");
              setUserInterests(['']);
            }
          }
        },
        (error) => {
          console.error('Error en el listener de intereses:', error);
        }
      );
      
      return () => {
        console.log("Limpiando listener de intereses");
        unsubscribe();
      };
    };

    fetchUserInterests();
  }, [user?.id]);

  useEffect(() => {
    console.log("Estructura completa del objeto user:", user);
    // Resto del código...
  }, [user]);

  // Agregar esto antes del return para depuración
  useEffect(() => {
    console.log("ESTADO ACTUAL - userInterests:", userInterests);
  }, [userInterests]);

  // Función para generar explicaciones usando Gemini
  const generateExplanation = async (type: string) => {
    if (!selectedConcept) {
      alert('Por favor, selecciona un concepto primero');
      return;
    }
    
    if (!model) {
      alert('No se pudo inicializar el modelo de IA. Verifica tu API key.');
      return;
    }

    setIsLoading(true);
    setActiveButton(type);
    setSaveSuccess(false);
    
    const concept = concepts.find(c => c.id === selectedConcept);
    
    if (!concept) {
      setIsLoading(false);
      alert('Concepto no encontrado');
      return;
    }
    
    try {
      // Crear el prompt según el tipo de explicación
      let prompt = '';
      
      switch (type) {
        case 'simple':
          prompt = `Explica el siguiente concepto de manera sencilla, como si le hablaras a alguien sin conocimiento técnico. 
          Usa analogías cotidianas. Limita tu respuesta a 3-4 oraciones.
          
          Concepto: ${concept.término}
          Definición: ${concept.definición}`;
          break;
        case 'related':
          prompt = `Explica cómo el siguiente concepto se relaciona con otros conceptos del mismo campo. 
          Menciona 2-3 conceptos relacionados y explica brevemente sus conexiones.
          Limita tu respuesta a 3-4 oraciones.
          
          Concepto: ${concept.término}
          Definición: ${concept.definición}`;
          break;
        case 'interests':
          // Verificamos si hay intereses disponibles y filtramos los vacíos
          const filteredInterests = userInterests.filter(interest => interest.trim() !== '');
          
          if (filteredInterests.length > 0) {
            console.log("Usando intereses para el prompt:", filteredInterests.join(', '));
            prompt = `TAREA: Relacionar un concepto académico con los intereses personales de un estudiante.
            
            INTERESES DEL ESTUDIANTE: ${filteredInterests.join(', ')}.
            
            CONCEPTO A EXPLICAR: "${concept.término}"
            DEFINICIÓN: "${concept.definición}"
            
            INSTRUCCIONES:
            1. Explica de manera clara cómo este concepto académico se relaciona directamente con los intereses listados del estudiante.
            2. Proporciona 1-2 ejemplos específicos de cómo este concepto podría aplicarse o encontrarse en esos intereses.
            3. Tu respuesta debe ser breve (3-4 oraciones), concreta y dirigida al estudiante.
            4. NO menciones que eres un modelo de lenguaje ni uses metareferencias sobre tu naturaleza.`;
          } else {
            setExplanation('Para personalizar las explicaciones, añade tus intereses en la sección de "Personalización" accesible desde la página de cuadernos.');
            setIsLoading(false);
            return;
          }
          break;
        case 'mnemotecnia':
          prompt = `Crea una técnica mnemotécnica sencilla y práctica para recordar el siguiente concepto.
  
          TÉCNICA MNEMOTÉCNICA: [TÍTULO CORTO Y CLARO]
          
          Utiliza UNA de estas técnicas (elige la más adecuada para este concepto específico):
          - Acrónimo simple (máximo 5 letras)
          - Asociación visual concreta (una sola imagen potente)
          - Analogía cotidiana (comparación con algo familiar)
          - Historia mínima (máximo 3 elementos)
          - Rima breve y pegadiza
          
          Estructura tu respuesta así:
          Título de la mnemotecnia (en mayúsculas) seguida de ":"
          Descripción en 2-4 líneas máximo
          
          La mnemotecnia debe ser:
          - Memorable al primer contacto
          - Visualmente clara
          - Directamente relacionada con el concepto
          - Fácil de recordar sin esfuerzo

          PROHIBIDO usar: "*" ni siquiera para poner en negritas.
          
          Concepto: ${concept.término}
          Definición: ${concept.definición}`;
          break;
        default:
          prompt = `Explica el siguiente concepto brevemente:
          Concepto: ${concept.término}
          Definición: ${concept.definición}`;
      }
      
      // Llamar a la API de Gemini
      const result = await model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
      });
      
      const respuesta = result.response.text();
      setExplanation(respuesta);
      
    } catch (error) {
      console.error('Error al generar la explicación:', error);
      setExplanation('Ocurrió un error al generar la explicación. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Función para guardar la explicación en las notas personales del concepto
  const saveToNotes = async () => {
    if (!selectedConcept || !explanation) {
      alert('No hay explicación para guardar');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Encontrar el concepto seleccionado
      const concept = concepts.find(c => c.id === selectedConcept);
      if (!concept) {
        throw new Error('Concepto no encontrado');
      }

      // Verificar que concept.docId no es undefined
      if (!concept.docId) {
        throw new Error('ID de documento no disponible');
      }
      
      // Obtener el documento actual
      const conceptoRef = doc(db, 'conceptos', concept.docId);
      const conceptoSnap = await getDoc(conceptoRef);
      
      if (!conceptoSnap.exists()) {
        throw new Error("El documento de conceptos no existe");
      }
      
      // Obtener la lista completa de conceptos
      const allConceptos = conceptoSnap.data().conceptos;
      
      // Verificar que el índice existe
      if (concept.index === undefined) {
        throw new Error("Índice de concepto no definido");
      }
      
      // Obtener las notas actuales (si existen)
      const currentNotes = allConceptos[concept.index].notasPersonales || '';
      
      // Crear el texto de la explicación con formato
      const explanationTitle = activeButton === 'simple' 
        ? '--- Explicación sencilla ---' 
        : activeButton === 'related'
          ? '--- Relacionado con tus conceptos ---'
          : activeButton === 'interests'
            ? '--- Relacionado con tus intereses ---'
            : '--- Mnemotecnia ---';
      
      const formattedExplanation = `\n\n${explanationTitle}\n${explanation}`;
      
      // Combinar las notas existentes con la nueva explicación
      const updatedNotes = currentNotes + formattedExplanation;
      
      // Actualizar el objeto del concepto con las nuevas notas
      const updatedConceptos = [...allConceptos];
      updatedConceptos[concept.index] = {
        ...updatedConceptos[concept.index],
        notasPersonales: updatedNotes
      };
      
      // Actualizar el documento en Firebase
      await updateDoc(conceptoRef, {
        conceptos: updatedConceptos
      });
      
      // Mostrar mensaje de éxito
      setSaveSuccess(true);
      
    } catch (error) {
      console.error('Error al guardar en notas:', error);
      alert('Ocurrió un error al guardar la explicación en las notas. Por favor, intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  // Obtener la definición del concepto seleccionado
  const getSelectedConceptDefinition = () => {
    if (!selectedConcept) return null;
    
    const concept = concepts.find(c => c.id === selectedConcept);
    return concept?.definición || null;
  };

  // Create a document reference correctly
  const docRef = doc(db, "collection", "documentId");

  return (
    <div className="explain-concept-container">
      <h2>Explicar concepto</h2>
      
      {apiKeyError && (
        <div className="error-message">
          <p>⚠️ No se pudo inicializar la IA. Verifica la clave API de Gemini en tu archivo .env.</p>
        </div>
      )}
      
      <div className="concept-selector">
        <label htmlFor="concept-select">Selecciona un concepto:</label>
        <select 
          id="concept-select"
          value={selectedConcept}
          onChange={(e) => {
            setSelectedConcept(e.target.value);
            setExplanation(''); // Limpiar explicación al cambiar de concepto
            setActiveButton(null);
            setSaveSuccess(false);
          }}
          disabled={isLoading || isSaving}
        >
          <option value="">Selecciona un concepto</option>
          {concepts.map((concept) => (
            <option key={concept.id} value={concept.id}>
              {concept.término}
            </option>
          ))}
        </select>
      </div>

      {/* Mostrar definición del concepto seleccionado */}
      {selectedConcept && (
        <div className="concept-definition">
          <h3>Definición:</h3>
          <p>{getSelectedConceptDefinition()}</p>
        </div>
      )}

      <div className="explanation-buttons">
        <button 
          onClick={() => generateExplanation('simple')}
          disabled={isLoading || isSaving || !selectedConcept || apiKeyError}
          className={activeButton === 'simple' ? 'active' : ''}
        >
          <i className="fas fa-child"></i> Sencillamente
        </button>
        <button 
          onClick={() => generateExplanation('related')}
          disabled={isLoading || isSaving || !selectedConcept || apiKeyError}
          className={activeButton === 'related' ? 'active' : ''}
        >
          <i className="fas fa-project-diagram"></i> Relacionado con mis conceptos
        </button>
        <button 
          onClick={() => generateExplanation('interests')}
          disabled={isLoading || isSaving || !selectedConcept || apiKeyError}
          className={activeButton === 'interests' ? 'active' : ''}
        >
          <i className="fas fa-heart"></i> Relacionado con mis intereses
        </button>
        <button 
          onClick={() => generateExplanation('mnemotecnia')}
          disabled={isLoading || isSaving || !selectedConcept || apiKeyError}
          className={activeButton === 'mnemotecnia' ? 'active' : ''}
        >
          <i className="fas fa-brain"></i> Mnemotecnia
        </button>
      </div>

      {/* Botón para guardar en notas */}
      {explanation && (
        <div className="save-to-notes">
          <button 
            onClick={saveToNotes}
            disabled={isLoading || isSaving || !explanation}
            className="save-notes-button"
          >
            {isSaving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Guardando...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i> Guardar en notas
              </>
            )}
          </button>
          {saveSuccess && (
            <span className="save-success">
              <i className="fas fa-check-circle"></i> ¡Guardado correctamente!
            </span>
          )}
        </div>
      )}

      <div className="explanation-container">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-animation">
              <i className="fas fa-spinner fa-spin"></i>
            </div>
            <p>Simón está pensando...</p>
          </div>
        ) : explanation ? (
          <div className="explanation-content">
            <h3>
              {activeButton === 'simple' && 'Explicación sencilla'}
              {activeButton === 'related' && 'Relacionado con tus conceptos'}
              {activeButton === 'interests' && 'Relacionado con tus intereses'}
              {activeButton === 'mnemotecnia' && 'Técnica mnemotécnica'}
            </h3>
            <p>{explanation}</p>
          </div>
        ) : (
          <div className="empty-explanation">
            <p>Selecciona un concepto y haz clic en uno de los botones para generar una explicación.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplainConcept;