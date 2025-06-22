import React, { useState } from 'react';
import { useAIProcessing, AIProcessingService } from '../services/aiProcessingService';

interface AIProcessingExampleProps {
  notebookId: string;
  userId: string;
}

/**
 * Componente de ejemplo para mostrar cómo usar el sistema Pub/Sub de IA
 */
export const AIProcessingExample: React.FC<AIProcessingExampleProps> = ({ 
  notebookId, 
  userId 
}) => {
  const [textContent, setTextContent] = useState('');
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [selectedConcepts, setSelectedConcepts] = useState<any[]>([]);
  
  const {
    isProcessing,
    processingStatus,
    processingData,
    error,
    processContent,
    generateSpecificContent
  } = useAIProcessing();

  // Ejemplo 1: Procesamiento completo (extracción + contenido paralelo)
  const handleFullProcessing = async () => {
    if (!textContent.trim()) {
      alert('Por favor ingresa texto para procesar');
      return;
    }

    try {
      const result = await processContent(notebookId, textContent, userId);
      setGeneratedContent(result);
      console.log('✅ Procesamiento completo exitoso:', result);
    } catch (err) {
      console.error('❌ Error en procesamiento completo:', err);
    }
  };

  // Ejemplo 2: Generación individual de historia
  const handleGenerateStory = async () => {
    if (selectedConcepts.length === 0) {
      alert('Selecciona conceptos para generar historia');
      return;
    }

    try {
      const result = await generateSpecificContent(
        'STORY_GENERATION',
        notebookId,
        'concept123', // ID del concepto
        selectedConcepts,
        userId
      );
      console.log('📚 Historia generada:', result);
    } catch (err) {
      console.error('❌ Error generando historia:', err);
    }
  };

  // Ejemplo 3: Generación individual de canción
  const handleGenerateSong = async () => {
    if (selectedConcepts.length === 0) {
      alert('Selecciona conceptos para generar canción');
      return;
    }

    try {
      const result = await generateSpecificContent(
        'SONG_GENERATION',
        notebookId,
        'concept123', // ID del concepto
        selectedConcepts,
        userId
      );
      console.log('🎵 Canción generada:', result);
    } catch (err) {
      console.error('❌ Error generando canción:', err);
    }
  };

  // Ejemplo 4: Generación individual de imagen
  const handleGenerateImage = async () => {
    if (selectedConcepts.length === 0) {
      alert('Selecciona conceptos para generar imagen');
      return;
    }

    try {
      const result = await generateSpecificContent(
        'IMAGE_GENERATION',
        notebookId,
        'concept123', // ID del concepto
        selectedConcepts,
        userId
      );
      console.log('🎨 Imagen generada:', result);
    } catch (err) {
      console.error('❌ Error generando imagen:', err);
    }
  };

  // Ejemplo 5: Consulta de estado manual
  const handleCheckStatus = async () => {
    if (!processingData?.requestId) {
      alert('No hay procesamiento activo');
      return;
    }

    try {
      const status = await AIProcessingService.getStatus(
        processingData.requestId, 
        userId
      );
      console.log('📊 Estado actual:', status);
      alert(`Estado: ${status.status}`);
    } catch (err) {
      console.error('❌ Error consultando estado:', err);
    }
  };

  return (
    <div className="ai-processing-example" style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>🚀 Sistema Pub/Sub de IA - Ejemplos de Uso</h2>
      
      {/* Área de texto para contenido */}
      <div style={{ marginBottom: '20px' }}>
        <label>
          <strong>Contenido para procesar:</strong>
        </label>
        <textarea
          style={{
            width: '100%',
            height: '120px',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginTop: '5px'
          }}
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder="Ingresa texto educativo para extraer conceptos y generar contenido automáticamente..."
        />
      </div>

      {/* Botones de acción */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleFullProcessing}
          disabled={isProcessing}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          🧠 Procesamiento Completo
        </button>

        <button
          onClick={handleGenerateStory}
          disabled={isProcessing}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          📚 Generar Historia
        </button>

        <button
          onClick={handleGenerateSong}
          disabled={isProcessing}
          style={{
            padding: '10px 20px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          🎵 Generar Canción
        </button>

        <button
          onClick={handleGenerateImage}
          disabled={isProcessing}
          style={{
            padding: '10px 20px',
            backgroundColor: '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          🎨 Generar Imagen
        </button>

        <button
          onClick={handleCheckStatus}
          disabled={!processingData?.requestId}
          style={{
            padding: '10px 20px',
            backgroundColor: '#607D8B',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !processingData?.requestId ? 'not-allowed' : 'pointer'
          }}
        >
          📊 Consultar Estado
        </button>
      </div>

      {/* Estado del procesamiento */}
      {(isProcessing || processingStatus) && (
        <div style={{
          padding: '15px',
          backgroundColor: isProcessing ? '#FFF3CD' : '#D4EDDA',
          border: `1px solid ${isProcessing ? '#FFC107' : '#28A745'}`,
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <h4>📡 Estado del Procesamiento</h4>
          <p><strong>Estado:</strong> {processingStatus}</p>
          {processingData?.requestId && (
            <p><strong>Request ID:</strong> {processingData.requestId}</p>
          )}
          {isProcessing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '3px solid #f3f3f3',
                borderTop: '3px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span>Procesando...</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#F8D7DA',
          border: '1px solid #F5C6CB',
          borderRadius: '4px',
          marginBottom: '20px',
          color: '#721C24'
        }}>
          <h4>❌ Error</h4>
          <p>{error}</p>
        </div>
      )}

      {/* Contenido generado */}
      {generatedContent && (
        <div style={{
          padding: '15px',
          backgroundColor: '#D1ECF1',
          border: '1px solid #BEE5EB',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <h4>✅ Contenido Generado</h4>
          
          {generatedContent.concepts && generatedContent.concepts.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <h5>🧠 Conceptos Extraídos:</h5>
              <ul>
                {generatedContent.concepts.map((concept: any, index: number) => (
                  <li key={index}>
                    <strong>{concept.concepto}</strong>: {concept.explicacion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {generatedContent.story && (
            <div style={{ marginBottom: '15px' }}>
              <h5>📚 Historia Generada:</h5>
              <p><strong>{generatedContent.story.title}</strong></p>
              <p>{generatedContent.story.content}</p>
            </div>
          )}

          {generatedContent.song && (
            <div style={{ marginBottom: '15px' }}>
              <h5>🎵 Canción Generada:</h5>
              <p><strong>{generatedContent.song.title}</strong></p>
              <div>
                {generatedContent.song.verses?.map((verse: string, index: number) => (
                  <p key={index} style={{ margin: '5px 0' }}>{verse}</p>
                ))}
              </div>
            </div>
          )}

          {generatedContent.image && (
            <div style={{ marginBottom: '15px' }}>
              <h5>🎨 Imagen Generada:</h5>
              <p><strong>URL:</strong> {generatedContent.image.url}</p>
              <p><strong>Descripción:</strong> {generatedContent.image.description}</p>
            </div>
          )}
        </div>
      )}

      {/* Información del sistema */}
      <div style={{
        padding: '15px',
        backgroundColor: '#F8F9FA',
        border: '1px solid #DEE2E6',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <h4>ℹ️ Información del Sistema</h4>
        <ul>
          <li><strong>Notebook ID:</strong> {notebookId}</li>
          <li><strong>User ID:</strong> {userId}</li>
          <li><strong>Procesamiento Activo:</strong> {isProcessing ? 'Sí' : 'No'}</li>
          <li><strong>Request ID Actual:</strong> {processingData?.requestId || 'Ninguno'}</li>
        </ul>
        
        <div style={{ marginTop: '10px' }}>
          <strong>🔧 Funcionalidades Disponibles:</strong>
          <ul style={{ marginTop: '5px' }}>
            <li>✅ Extracción de conceptos con IA</li>
            <li>✅ Generación automática de historia, canción e imagen</li>
            <li>✅ Procesamiento individual de cada tipo de contenido</li>
            <li>✅ Seguimiento en tiempo real del estado</li>
            <li>✅ Manejo de errores y timeouts</li>
          </ul>
        </div>
      </div>

      {/* CSS para animación */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AIProcessingExample;