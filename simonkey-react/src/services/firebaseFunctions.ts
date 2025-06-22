import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp } from 'firebase/app';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC26QZw7297E_YOoF5OqR2Ck6x_bw5_Hic",
  authDomain: "simonkey-5c78f.firebaseapp.com",
  projectId: "simonkey-5c78f",
  storageBucket: "simonkey-5c78f.firebasestorage.app",
  messagingSenderId: "235501879490",
  appId: "1:235501879490:web:05fea6dae9c63b2a827b5b"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firebase Functions
const functions = getFunctions(app);

// Tipos para las funciones
interface DeleteUserDataRequest {
  userId: string;
  deletedBy?: string;
}

interface DeleteUserDataResponse {
  success: boolean;
  message: string;
  deletedItems: {
    notebooks: number;
    concepts: number;
    studySessions: number;
    userActivities: number;
    reviewConcepts: number;
    conceptStats: number;
    learningData: number;
    quizStats: number;
    quizResults: number;
    limits: number;
    notebookLimits: number;
    stats: number;
    settings: number;
    userDocument: boolean;
    authAccount: boolean;
  };
  errors?: string[];
}

interface CheckUserDeletionStatusRequest {
  userId: string;
}

interface CheckUserDeletionStatusResponse {
  userId: string;
  existsInFirestore: boolean;
  existsInAuth: boolean;
  deletionRecord: any;
  status: 'active' | 'deleted';
}

// ================================
// FUNCIONES DE USUARIOS
// ================================

export const deleteUserData = httpsCallable(functions, 'deleteUserData');
export const checkUserDeletionStatus = httpsCallable(functions, 'checkUserDeletionStatus');
export const calculateUserStats = httpsCallable(functions, 'calculateUserStats');
export const cleanupOldData = httpsCallable(functions, 'cleanupOldData');
export const exportUserData = httpsCallable(functions, 'exportUserData');

// ================================
// FUNCIONES DE USUARIOS ESCOLARES
// ================================

export const syncSchoolUsers = httpsCallable(functions, 'syncSchoolUsers');
export const createSchoolUser = httpsCallable(functions, 'createSchoolUser');
export const fixOrphanUsers = httpsCallable(functions, 'fixOrphanUsers');
export const migrateUsers = httpsCallable(functions, 'migrateUsers');

// ================================
// FUNCIONES DE IA INTENSIVA
// ================================

/**
 * Función para extraer conceptos de archivos usando IA en el servidor
 * Reemplaza el procesamiento local pesado
 */
export const processConceptExtraction = httpsCallable(functions, 'processConceptExtraction');

/**
 * Función para generar explicaciones de conceptos usando IA en el servidor
 * Reemplaza las llamadas locales a Gemini
 */
export const generateConceptExplanation = httpsCallable(functions, 'generateConceptExplanation');

/**
 * Función para encolar tareas pesadas de procesamiento de archivos
 * Implementa procesamiento asíncrono con Cloud Tasks
 */
export const enqueueConceptExtraction = httpsCallable(functions, 'enqueueConceptExtraction');

/**
 * Función para obtener el estado de una tarea de procesamiento
 */
export const getProcessingTaskStatus = httpsCallable(functions, 'getProcessingTaskStatus');

// ================================
// FUNCIONES AUXILIARES PARA IA
// ================================

/**
 * Convierte un archivo File a base64 para envío a Cloud Functions
 */
export const fileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64Data = result.split(',')[1]; // Remover el prefijo data:mime/type;base64,
        resolve({
          mimeType: file.type,
          data: base64Data
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

/**
 * Procesa múltiples archivos y los convierte a formato para Cloud Functions
 */
export const processFilesForCloudFunction = async (files: File[]): Promise<Array<{ mimeType: string; data: string; fileName: string }>> => {
  const processedFiles = [];
  
  for (const file of files) {
    const fileData = await fileToBase64(file);
    processedFiles.push({
      ...fileData,
      fileName: file.name
    });
  }
  
  return processedFiles;
};

/**
 * Maneja errores de Cloud Functions y proporciona mensajes amigables
 */
export const handleCloudFunctionError = (error: any): string => {
  console.error('Cloud Function Error:', error);
  
  if (error.code === 'unauthenticated') {
    return 'Necesitas iniciar sesión para realizar esta acción.';
  }
  
  if (error.code === 'permission-denied') {
    return 'No tienes permisos para realizar esta acción.';
  }
  
  if (error.code === 'failed-precondition') {
    return 'El servidor no está configurado correctamente. Por favor contacta al administrador.';
  }
  
  if (error.code === 'internal') {
    return error.message || 'Error interno del servidor. Por favor intenta de nuevo.';
  }
  
  if (error.code === 'not-found') {
    return 'El recurso solicitado no fue encontrado.';
  }
  
  return error.message || 'Error inesperado. Por favor intenta de nuevo.';
};

/**
 * Hook personalizado para manejar el estado de las tareas de procesamiento
 */
export const useProcessingTask = () => {
  const checkTaskStatus = async (taskId: string) => {
    try {
      const result = await getProcessingTaskStatus({ taskId });
      return result.data;
    } catch (error) {
      console.error('Error checking task status:', error);
      throw new Error(handleCloudFunctionError(error));
    }
  };

  const pollTaskStatus = (taskId: string, onUpdate: (status: any) => void, onComplete: (result: any) => void, onError: (error: string) => void) => {
    const poll = async () => {
      try {
        const status = await checkTaskStatus(taskId);
        onUpdate(status);

        if (status.task.status === 'completed') {
          onComplete(status.task.result);
          return;
        }

        if (status.task.status === 'failed' || status.task.status === 'error') {
          onError(status.task.error || 'Tarea falló');
          return;
        }

        // Continuar polling si la tarea está en progreso
        if (['queued', 'enqueued', 'processing', 'processing_direct'].includes(status.task.status)) {
          setTimeout(poll, 2000); // Revisar cada 2 segundos
        }
      } catch (error: any) {
        onError(handleCloudFunctionError(error));
      }
    };

    poll();
  };

  return { checkTaskStatus, pollTaskStatus };
};

/**
 * Eliminar completamente todos los datos de un usuario usando Firebase Functions
 * Esta función reemplaza la lógica compleja del cliente con operaciones optimizadas del servidor
 */
export const deleteUserDataWithFunction = async (
  userId: string, 
  deletedBy?: string
): Promise<DeleteUserDataResponse> => {
  try {
    console.log('🚀 Llamando Firebase Function para eliminar usuario:', userId);
    
    const deleteUserFunction = httpsCallable<DeleteUserDataRequest, DeleteUserDataResponse>(
      functions, 
      'deleteUserData'
    );
    
    const result = await deleteUserFunction({ userId, deletedBy });
    const data = result.data;
    
    console.log('✅ Función ejecutada exitosamente:', data);
    return data;
    
  } catch (error: any) {
    console.error('❌ Error llamando Firebase Function:', error);
    
    // Manejar errores específicos de Firebase Functions
    if (error.code === 'functions/unavailable') {
      throw new Error('La función no está disponible. Verifica que esté desplegada.');
    } else if (error.code === 'functions/unauthenticated') {
      throw new Error('Debes estar autenticado para usar esta función.');
    } else if (error.code === 'functions/permission-denied') {
      throw new Error('No tienes permisos para usar esta función.');
    } else if (error.code === 'functions/invalid-argument') {
      throw new Error('Argumentos inválidos proporcionados a la función.');
    } else if (error.code === 'functions/deadline-exceeded') {
      throw new Error('La función tardó demasiado en ejecutarse.');
    } else if (error.code === 'functions/resource-exhausted') {
      throw new Error('Recursos agotados. Intenta más tarde.');
    } else if (error.code === 'functions/failed-precondition') {
      throw new Error('Condición previa fallida.');
    } else if (error.code === 'functions/aborted') {
      throw new Error('La función fue abortada.');
    } else if (error.code === 'functions/out-of-range') {
      throw new Error('Valor fuera de rango.');
    } else if (error.code === 'functions/unimplemented') {
      throw new Error('La función no está implementada.');
    } else if (error.code === 'functions/internal') {
      throw new Error('Error interno del servidor.');
    } else if (error.code === 'functions/data-loss') {
      throw new Error('Pérdida de datos.');
    } else {
      throw new Error(`Error desconocido: ${error.message}`);
    }
  }
};

/**
 * Función de conveniencia para eliminar usuario con confirmación y feedback
 */
export const deleteUserWithConfirmation = async (
  userId: string,
  userName: string,
  onProgress?: (message: string) => void,
  onSuccess?: (result: DeleteUserDataResponse) => void,
  onError?: (error: string) => void
): Promise<void> => {
  try {
    // Confirmación
    const confirmed = window.confirm(
      `¿Estás seguro de que quieres eliminar completamente al usuario "${userName}"?\n\n` +
      `Esta acción eliminará TODOS sus datos incluyendo:\n` +
      `• Notebooks y conceptos\n` +
      `• Sesiones de estudio\n` +
      `• Estadísticas y progreso\n` +
      `• Cuenta de Firebase Auth\n\n` +
      `Esta acción es IRREVERSIBLE.`
    );
    
    if (!confirmed) {
      onProgress?.('Eliminación cancelada por el usuario');
      return;
    }
    
    onProgress?.('🚀 Iniciando eliminación con Firebase Functions...');
    
    // Llamar a la función
    const result = await deleteUserDataWithFunction(userId);
    
    if (result.success) {
      const totalDeleted = result.deletedItems.notebooks + result.deletedItems.concepts + 
                          result.deletedItems.studySessions + result.deletedItems.userActivities + 
                          result.deletedItems.reviewConcepts + result.deletedItems.conceptStats + 
                          result.deletedItems.learningData + result.deletedItems.quizStats + 
                          result.deletedItems.quizResults + result.deletedItems.limits + 
                          result.deletedItems.notebookLimits + result.deletedItems.stats + 
                          result.deletedItems.settings;
      
      onProgress?.(`✅ Usuario eliminado exitosamente!\n\n` +
        `📊 Resumen de eliminación:\n` +
        `• ${result.deletedItems.notebooks} notebooks\n` +
        `• ${result.deletedItems.concepts} conceptos\n` +
        `• ${result.deletedItems.studySessions} sesiones de estudio\n` +
        `• ${result.deletedItems.userActivities} actividades\n` +
        `• ${result.deletedItems.reviewConcepts} conceptos de repaso\n` +
        `• ${result.deletedItems.conceptStats} estadísticas\n` +
        `• ${result.deletedItems.learningData} datos de aprendizaje\n` +
        `• ${result.deletedItems.quizStats} estadísticas de quiz\n` +
        `• ${result.deletedItems.quizResults} resultados de quiz\n` +
        `• ${result.deletedItems.limits} límites\n` +
        `• ${result.deletedItems.notebookLimits} límites de notebooks\n` +
        `• ${result.deletedItems.stats} estadísticas\n` +
        `• ${result.deletedItems.settings} configuraciones\n` +
        `• Documento principal: ${result.deletedItems.userDocument ? 'Eliminado' : 'No encontrado'}\n` +
        `• Cuenta Auth: ${result.deletedItems.authAccount ? 'Eliminada' : 'No eliminada'}\n\n` +
        `Total: ${totalDeleted} elementos eliminados`
      );
      
      onSuccess?.(result);
    } else {
      onProgress?.(`❌ Error en la eliminación: ${result.message}`);
      onError?.(result.message);
    }
    
  } catch (error: any) {
    const errorMessage = `❌ Error eliminando usuario: ${error.message}`;
    onProgress?.(errorMessage);
    onError?.(errorMessage);
  }
}; 