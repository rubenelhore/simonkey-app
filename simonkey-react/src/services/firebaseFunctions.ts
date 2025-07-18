import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

// Obtener la instancia de Firebase ya inicializada desde firebase.ts
// Esto asegura que usamos la misma configuración y la base de datos correcta
const app = getApp();

// Inicializar Firebase Functions con la app existente
// Especificar la región para funciones v2
const functions = getFunctions(app, 'us-central1');

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
// FUNCIONES SEGURAS DE GEMINI API
// ================================

/**
 * Genera conceptos a partir de un archivo usando IA segura
 * Reemplaza las llamadas directas a Gemini API desde el frontend
 */
export const generateConceptsFromFile = httpsCallable(functions, 'generateConceptsFromFile');

/**
 * Función para subir materiales a Firebase Storage desde Cloud Functions
 * Evita problemas de CORS al subir desde el servidor
 */
export const uploadMaterialToStorage = httpsCallable(functions, 'uploadMaterialToStorage');

/**
 * Genera conceptos a partir de múltiples archivos usando IA segura
 * Función específica para manejar múltiples archivos
 */
export const generateConceptsFromMultipleFiles = async (
  files: Array<{ fileName: string; content: string; isSchoolNotebook: boolean; fileType?: string; materialId?: string }>,
  notebookId: string
) => {
  console.log('🔧 generateConceptsFromMultipleFiles iniciado:', {
    filesCount: files.length,
    notebookId,
    firstFileName: files[0]?.fileName
  });
  
  const results = [];
  
  for (const file of files) {
    try {
      console.log('📄 Procesando archivo:', file.fileName);
      
      const result = await generateConceptsFromFile({
        fileContent: file.content,
        notebookId,
        fileName: file.fileName,
        isSchoolNotebook: file.isSchoolNotebook,
        fileType: file.fileType || 'file', // Por defecto usar 'file' para procesar con Gemini
        materialId: file.materialId // Pasar el ID del material si existe
      });
      
      console.log('✅ Archivo procesado exitosamente:', file.fileName);
      results.push(result);
    } catch (error) {
      console.error(`❌ Error procesando archivo ${file.fileName}:`, error);
      throw error;
    }
  }
  
  console.log('🎉 generateConceptsFromMultipleFiles completado, resultados:', results.length);
  return results;
};

/**
 * Alias para mantener compatibilidad con código existente
 * Genera conceptos a partir de archivos usando IA segura
 */
export const generateConcepts = generateConceptsFromMultipleFiles;

/**
 * Prepara archivos para generación de conceptos
 * Función auxiliar para procesar archivos antes de enviarlos a Cloud Functions
 * Ahora convierte archivos a base64 para procesamiento directo con Gemini
 */
export const prepareFilesForGeneration = async (
  files: File[], 
  isSchoolNotebook: boolean = false,
  uploadedMaterials?: Array<{ id: string; name: string }>
): Promise<Array<{ fileName: string; content: string; isSchoolNotebook: boolean; fileType: string; materialId?: string }>> => {
  const processedFiles = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      // Convertir archivo a base64 para procesamiento directo con Gemini
      const base64Data = await fileToBase64(file);
      
      // Buscar el material correspondiente por nombre
      const material = uploadedMaterials?.find(m => m.name === file.name);
      
      processedFiles.push({
        fileName: file.name,
        content: base64Data.data, // Usar el contenido base64
        isSchoolNotebook,
        fileType: 'file', // Indicar que es un archivo para procesar con Gemini
        materialId: material?.id // Asociar el ID del material si existe
      });
      
      console.log(`✅ Archivo ${file.name} convertido a base64 (${base64Data.data.length} caracteres)${material ? ` con materialId: ${material.id}` : ''}`);
    } catch (error) {
      console.error(`❌ Error procesando archivo ${file.name}:`, error);
      throw new Error(`Error procesando archivo ${file.name}: ${error}`);
    }
  }
  
  return processedFiles;
};

/**
 * Explica un concepto específico usando IA segura
 * Reemplaza las llamadas directas a Gemini API desde el frontend
 */
export const explainConcept = httpsCallable(functions, 'explainConcept');

/**
 * Genera contenido general usando IA segura
 * Reemplaza las llamadas directas a Gemini API desde el frontend
 */
export const generateContent = httpsCallable(functions, 'generateContent');

/**
 * Convierte un archivo a base64
 * @param file El archivo a convertir
 * @returns Promesa con el archivo en base64
 */
const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Extraer solo la parte base64 (remover el prefijo data:mime/type;base64,)
      const base64 = result.split(',')[1];
      resolve({
        data: base64,
        mimeType: file.type
      });
    };
    reader.onerror = error => reject(error);
  });
};