import { useState } from 'react';

// Tipos para el sistema de IA
export interface AIProcessingRequest {
  type: 'CONCEPT_EXTRACTION' | 'STORY_GENERATION' | 'SONG_GENERATION' | 'IMAGE_GENERATION' | 'QUIZ_GENERATION';
  userId: string;
  notebookId: string;
  conceptId?: string;
  data: any;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}

export interface AIProcessingResponse {
  success: boolean;
  requestId: string;
  message: string;
  estimatedProcessingTime: string;
}

export interface AIProcessingStatus {
  success: boolean;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  request: any;
  generatedContent: any[] | null;
}

// Funciones que utilizarán las Cloud Functions cuando estén disponibles
// Por ahora son placeholders que puedes reemplazar con las funciones reales
const processAIContent = async (request: AIProcessingRequest): Promise<{ data: AIProcessingResponse }> => {
  // Placeholder - implementar llamada real a Cloud Function
  console.log('Llamando a processAIContent:', request);
  return {
    data: {
      success: true,
      requestId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: `Procesamiento ${request.type} iniciado`,
      estimatedProcessingTime: '2-5 minutos'
    }
  };
};

const getAIProcessingStatus = async (params: {requestId: string, userId: string}): Promise<{ data: AIProcessingStatus }> => {
  // Placeholder - implementar llamada real a Cloud Function
  console.log('Obteniendo estado:', params);
  return {
    data: {
      success: true,
      status: 'COMPLETED',
      request: null,
      generatedContent: []
    }
  };
};

/**
 * Servicio para manejar el procesamiento de IA con Pub/Sub
 */
export class AIProcessingService {
  
  /**
   * Inicia el procesamiento de contenido con IA
   */
  static async startProcessing(request: AIProcessingRequest): Promise<AIProcessingResponse> {
    try {
      const result = await processAIContent(request);
      return result.data;
    } catch (error) {
      console.error('Error iniciando procesamiento de IA:', error);
      throw new Error('Error iniciando procesamiento de IA');
    }
  }

  /**
   * Obtiene el estado actual de un procesamiento
   */
  static async getStatus(requestId: string, userId: string): Promise<AIProcessingStatus> {
    try {
      const result = await getAIProcessingStatus({ requestId, userId });
      return result.data;
    } catch (error) {
      console.error('Error obteniendo estado de procesamiento:', error);
      throw new Error('Error obteniendo estado de procesamiento');
    }
  }

  /**
   * Extrae conceptos de un texto y genera contenido adicional automáticamente
   */
  static async extractConceptsWithFullContent(
    notebookId: string, 
    content: string, 
    userId: string,
    priority: 'LOW' | 'NORMAL' | 'HIGH' = 'NORMAL'
  ): Promise<AIProcessingResponse> {
    return this.startProcessing({
      type: 'CONCEPT_EXTRACTION',
      userId,
      notebookId,
      data: { content },
      priority
    });
  }

  /**
   * Genera solo una historia educativa
   */
  static async generateStory(
    notebookId: string,
    conceptId: string,
    concepts: any[],
    userId: string
  ): Promise<AIProcessingResponse> {
    return this.startProcessing({
      type: 'STORY_GENERATION',
      userId,
      notebookId,
      conceptId,
      data: { concepts }
    });
  }

  /**
   * Genera solo una canción mnemotécnica
   */
  static async generateSong(
    notebookId: string,
    conceptId: string,
    concepts: any[],
    userId: string
  ): Promise<AIProcessingResponse> {
    return this.startProcessing({
      type: 'SONG_GENERATION',
      userId,
      notebookId,
      conceptId,
      data: { concepts }
    });
  }

  /**
   * Genera solo una imagen mnemotécnica
   */
  static async generateImage(
    notebookId: string,
    conceptId: string,
    concepts: any[],
    userId: string
  ): Promise<AIProcessingResponse> {
    return this.startProcessing({
      type: 'IMAGE_GENERATION',
      userId,
      notebookId,
      conceptId,
      data: { concepts }
    });
  }

  /**
   * Polling para obtener el estado de un procesamiento hasta que termine
   */
  static async waitForCompletion(
    requestId: string,
    userId: string,
    onStatusUpdate?: (status: AIProcessingStatus) => void,
    pollInterval: number = 5000,
    maxWaitTime: number = 600000 // 10 minutos
  ): Promise<AIProcessingStatus> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getStatus(requestId, userId);
          
          if (onStatusUpdate) {
            onStatusUpdate(status);
          }

          if (status.status === 'COMPLETED') {
            resolve(status);
            return;
          }

          if (status.status === 'ERROR') {
            reject(new Error('Error en el procesamiento de IA'));
            return;
          }

          if (Date.now() - startTime > maxWaitTime) {
            reject(new Error('Timeout: El procesamiento tomó demasiado tiempo'));
            return;
          }

          // Continuar polling
          setTimeout(poll, pollInterval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Procesa un notebook completo con IA y espera a que termine
   */
  static async processNotebookComplete(
    notebookId: string,
    content: string,
    userId: string,
    onStatusUpdate?: (status: string, data?: any) => void
  ): Promise<{
    concepts: any[];
    story: any;
    song: any;
    image: any;
  }> {
    try {
      // 1. Iniciar procesamiento
      onStatusUpdate?.('Iniciando extracción de conceptos...');
      
      const processing = await this.extractConceptsWithFullContent(
        notebookId, 
        content, 
        userId, 
        'HIGH'
      );

      onStatusUpdate?.('Procesamiento iniciado', { requestId: processing.requestId });

      // 2. Esperar a que termine
      const result = await this.waitForCompletion(
        processing.requestId,
        userId,
        (status) => {
          const statusMessages = {
            'QUEUED': 'En cola de procesamiento...',
            'PROCESSING': 'Procesando con IA...',
            'COMPLETED': 'Procesamiento completado',
            'ERROR': 'Error en el procesamiento'
          };
          onStatusUpdate?.(statusMessages[status.status], status);
        }
      );

      // 3. Organizar el contenido generado
      const generatedContent = result.generatedContent || [];
      
      const concepts = generatedContent.find(c => c.type === 'CONCEPT')?.content || [];
      const story = generatedContent.find(c => c.type === 'STORY')?.content || null;
      const song = generatedContent.find(c => c.type === 'SONG')?.content || null;
      const image = generatedContent.find(c => c.type === 'IMAGE')?.content || null;

      onStatusUpdate?.('¡Procesamiento completado exitosamente!', {
        concepts,
        story,
        song,
        image
      });

      return {
        concepts,
        story,
        song,
        image
      };

    } catch (error) {
      onStatusUpdate?.('Error en el procesamiento', { error });
      throw error;
    }
  }

  /**
   * Obtiene todo el contenido educativo generado para un notebook
   */
  static async getGeneratedContent(notebookId: string, userId: string): Promise<any[]> {
    // Esta función sería para consultar directamente la base de datos
    // En un entorno real, podrías crear una Cloud Function específica para esto
    // Por ahora, se puede implementar consultando Firestore directamente
    
    // Placeholder - implementar según necesidades
    return [];
  }

  /**
   * Cancela un procesamiento en curso (si es posible)
   */
  static async cancelProcessing(requestId: string, userId: string): Promise<boolean> {
    // Implementar función de cancelación si es necesaria
    // Por ahora, solo retorna false ya que no está implementado
    console.warn('Cancelación de procesamiento no implementada');
    return false;
  }
}

// Hook personalizado para usar el servicio de IA
export const useAIProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingData, setProcessingData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const processContent = async (
    notebookId: string,
    content: string,
    userId: string
  ) => {
    try {
      setIsProcessing(true);
      setError(null);
      
      const result = await AIProcessingService.processNotebookComplete(
        notebookId,
        content,
        userId,
        (status, data) => {
          setProcessingStatus(status);
          setProcessingData(data);
        }
      );

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSpecificContent = async (
    type: 'STORY_GENERATION' | 'SONG_GENERATION' | 'IMAGE_GENERATION',
    notebookId: string,
    conceptId: string,
    concepts: any[],
    userId: string
  ) => {
    try {
      setIsProcessing(true);
      setError(null);
      setProcessingStatus(`Generando ${type.toLowerCase()}...`);

      let response: AIProcessingResponse;
      
      switch (type) {
        case 'STORY_GENERATION':
          response = await AIProcessingService.generateStory(notebookId, conceptId, concepts, userId);
          break;
        case 'SONG_GENERATION':
          response = await AIProcessingService.generateSong(notebookId, conceptId, concepts, userId);
          break;
        case 'IMAGE_GENERATION':
          response = await AIProcessingService.generateImage(notebookId, conceptId, concepts, userId);
          break;
      }

      const result = await AIProcessingService.waitForCompletion(
        response.requestId,
        userId,
        (status) => {
          setProcessingStatus(`${type}: ${status.status}`);
          setProcessingData(status);
        }
      );

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    processingStatus,
    processingData,
    error,
    processContent,
    generateSpecificContent
  };
};

// Hook para useState ya importado arriba