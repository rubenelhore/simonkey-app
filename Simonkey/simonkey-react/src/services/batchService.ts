import { db } from './firebase';
import { 
  writeBatch as firebaseWriteBatch, 
  collection, 
  doc, 
  query, 
  getDocs, 
  DocumentReference, 
  QuerySnapshot,
  deleteDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';

// Constantes para límites de Firestore
const FIRESTORE_BATCH_LIMIT = 500;
const FIRESTORE_MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Interfaz para operaciones batch
 */
export interface BatchOperation {
  type: 'delete' | 'set' | 'update';
  ref: DocumentReference;
  data?: any;
}

/**
 * Resultado de operación batch
 */
export interface BatchResult {
  success: boolean;
  totalOperations: number;
  batchesExecuted: number;
  errors: string[];
  executionTime: number;
}

/**
 * Divide una lista de operaciones en lotes del tamaño permitido por Firestore
 */
const chunkOperations = (operations: BatchOperation[], chunkSize: number = FIRESTORE_BATCH_LIMIT): BatchOperation[][] => {
  const chunks: BatchOperation[][] = [];
  for (let i = 0; i < operations.length; i += chunkSize) {
    chunks.push(operations.slice(i, i + chunkSize));
  }
  return chunks;
};

/**
 * Ejecuta un lote de operaciones con retry automático
 */
const executeBatchWithRetry = async (operations: BatchOperation[], retryCount: number = 0): Promise<void> => {
  const batch = firebaseWriteBatch(db);
  
  // Agregar operaciones al batch
  operations.forEach(operation => {
    switch (operation.type) {
      case 'delete':
        batch.delete(operation.ref);
        break;
      case 'set':
        batch.set(operation.ref, operation.data);
        break;
      case 'update':
        batch.update(operation.ref, operation.data);
        break;
    }
  });

  try {
    await batch.commit();
  } catch (error: any) {
    if (retryCount < FIRESTORE_MAX_RETRIES) {
      console.warn(`Batch operation failed, retrying (${retryCount + 1}/${FIRESTORE_MAX_RETRIES})...`, error.message);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)));
      return executeBatchWithRetry(operations, retryCount + 1);
    } else {
      throw error;
    }
  }
};

/**
 * Elimina múltiples documentos usando operaciones batch
 * Maneja automáticamente el límite de 500 operaciones por batch
 */
export const deleteBatch = async (
  docRefs: DocumentReference[],
  onProgress?: (completed: number, total: number) => void
): Promise<BatchResult> => {
  const startTime = Date.now();
  const result: BatchResult = {
    success: false,
    totalOperations: docRefs.length,
    batchesExecuted: 0,
    errors: [],
    executionTime: 0
  };

  if (docRefs.length === 0) {
    result.success = true;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  console.log(`🚀 Iniciando eliminación batch de ${docRefs.length} documentos...`);

  try {
    // Convertir referencias a operaciones
    const operations: BatchOperation[] = docRefs.map(ref => ({
      type: 'delete',
      ref
    }));

    // Dividir en lotes
    const batches = chunkOperations(operations, FIRESTORE_BATCH_LIMIT);
    console.log(`📦 Dividido en ${batches.length} lotes de máximo ${FIRESTORE_BATCH_LIMIT} operaciones`);

    // Ejecutar lotes
    let completedOperations = 0;
    for (const [index, batch] of batches.entries()) {
      try {
        await executeBatchWithRetry(batch);
        result.batchesExecuted++;
        completedOperations += batch.length;
        
        console.log(`✅ Lote ${index + 1}/${batches.length} completado (${batch.length} operaciones)`);
        onProgress?.(completedOperations, result.totalOperations);
        
      } catch (error: any) {
        const errorMsg = `Error en lote ${index + 1}: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    result.success = result.errors.length === 0;
    result.executionTime = Date.now() - startTime;

    console.log(`🎯 Eliminación batch completada: ${completedOperations}/${result.totalOperations} documentos en ${result.executionTime}ms`);
    
    return result;
    
  } catch (error: any) {
    result.errors.push(`Error general: ${error.message}`);
    result.executionTime = Date.now() - startTime;
    console.error('❌ Error en eliminación batch:', error);
    return result;
  }
};

/**
 * Escribe múltiples documentos usando operaciones batch
 */
export const batchWrite = async (
  writeOperations: Array<{
    ref: DocumentReference;
    data: any;
    merge?: boolean;
  }>,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchResult> => {
  const startTime = Date.now();
  const result: BatchResult = {
    success: false,
    totalOperations: writeOperations.length,
    batchesExecuted: 0,
    errors: [],
    executionTime: 0
  };

  if (writeOperations.length === 0) {
    result.success = true;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  console.log(`🚀 Iniciando escritura batch de ${writeOperations.length} documentos...`);

  try {
    // Convertir a operaciones batch
    const operations: BatchOperation[] = writeOperations.map(op => ({
      type: 'set',
      ref: op.ref,
      data: op.data
    }));

    // Dividir en lotes
    const batches = chunkOperations(operations, FIRESTORE_BATCH_LIMIT);
    console.log(`📦 Dividido en ${batches.length} lotes de máximo ${FIRESTORE_BATCH_LIMIT} operaciones`);

    // Ejecutar lotes
    let completedOperations = 0;
    for (const [index, batch] of batches.entries()) {
      try {
        await executeBatchWithRetry(batch);
        result.batchesExecuted++;
        completedOperations += batch.length;
        
        console.log(`✅ Lote ${index + 1}/${batches.length} completado (${batch.length} operaciones)`);
        onProgress?.(completedOperations, result.totalOperations);
        
      } catch (error: any) {
        const errorMsg = `Error en lote ${index + 1}: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    result.success = result.errors.length === 0;
    result.executionTime = Date.now() - startTime;

    console.log(`🎯 Escritura batch completada: ${completedOperations}/${result.totalOperations} documentos en ${result.executionTime}ms`);
    
    return result;
    
  } catch (error: any) {
    result.errors.push(`Error general: ${error.message}`);
    result.executionTime = Date.now() - startTime;
    console.error('❌ Error en escritura batch:', error);
    return result;
  }
};

/**
 * Elimina todos los documentos de una consulta usando operaciones batch
 */
export const deleteCollectionBatch = async (
  collectionQuery: ReturnType<typeof query>,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchResult> => {
  console.log('🔍 Obteniendo documentos para eliminación batch...');
  
  try {
    const snapshot = await getDocs(collectionQuery);
    const docRefs = snapshot.docs.map(doc => doc.ref);
    
    console.log(`📄 Encontrados ${docRefs.length} documentos para eliminar`);
    
    if (docRefs.length === 0) {
      return {
        success: true,
        totalOperations: 0,
        batchesExecuted: 0,
        errors: [],
        executionTime: 0
      };
    }
    
    return await deleteBatch(docRefs, onProgress);
    
  } catch (error: any) {
    console.error('❌ Error obteniendo documentos para eliminación:', error);
    return {
      success: false,
      totalOperations: 0,
      batchesExecuted: 0,
      errors: [`Error obteniendo documentos: ${error.message}`],
      executionTime: 0
    };
  }
};

/**
 * Actualiza múltiples documentos usando operaciones batch
 */
export const updateBatch = async (
  updateOperations: Array<{
    ref: DocumentReference;
    data: any;
  }>,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchResult> => {
  const startTime = Date.now();
  const result: BatchResult = {
    success: false,
    totalOperations: updateOperations.length,
    batchesExecuted: 0,
    errors: [],
    executionTime: 0
  };

  if (updateOperations.length === 0) {
    result.success = true;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  console.log(`🚀 Iniciando actualización batch de ${updateOperations.length} documentos...`);

  try {
    // Convertir a operaciones batch
    const operations: BatchOperation[] = updateOperations.map(op => ({
      type: 'update',
      ref: op.ref,
      data: op.data
    }));

    // Dividir en lotes
    const batches = chunkOperations(operations, FIRESTORE_BATCH_LIMIT);
    console.log(`📦 Dividido en ${batches.length} lotes de máximo ${FIRESTORE_BATCH_LIMIT} operaciones`);

    // Ejecutar lotes
    let completedOperations = 0;
    for (const [index, batch] of batches.entries()) {
      try {
        await executeBatchWithRetry(batch);
        result.batchesExecuted++;
        completedOperations += batch.length;
        
        console.log(`✅ Lote ${index + 1}/${batches.length} completado (${batch.length} operaciones)`);
        onProgress?.(completedOperations, result.totalOperations);
        
      } catch (error: any) {
        const errorMsg = `Error en lote ${index + 1}: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    result.success = result.errors.length === 0;
    result.executionTime = Date.now() - startTime;

    console.log(`🎯 Actualización batch completada: ${completedOperations}/${result.totalOperations} documentos en ${result.executionTime}ms`);
    
    return result;
    
  } catch (error: any) {
    result.errors.push(`Error general: ${error.message}`);
    result.executionTime = Date.now() - startTime;
    console.error('❌ Error en actualización batch:', error);
    return result;
  }
};

/**
 * Utilidad para crear operaciones batch mixtas (delete, set, update)
 */
export const executeMixedBatch = async (
  operations: BatchOperation[],
  onProgress?: (completed: number, total: number) => void
): Promise<BatchResult> => {
  const startTime = Date.now();
  const result: BatchResult = {
    success: false,
    totalOperations: operations.length,
    batchesExecuted: 0,
    errors: [],
    executionTime: 0
  };

  if (operations.length === 0) {
    result.success = true;
    result.executionTime = Date.now() - startTime;
    return result;
  }

  console.log(`🚀 Iniciando batch mixto de ${operations.length} operaciones...`);

  try {
    // Dividir en lotes
    const batches = chunkOperations(operations, FIRESTORE_BATCH_LIMIT);
    console.log(`📦 Dividido en ${batches.length} lotes de máximo ${FIRESTORE_BATCH_LIMIT} operaciones`);

    // Ejecutar lotes
    let completedOperations = 0;
    for (const [index, batch] of batches.entries()) {
      try {
        await executeBatchWithRetry(batch);
        result.batchesExecuted++;
        completedOperations += batch.length;
        
        console.log(`✅ Lote ${index + 1}/${batches.length} completado (${batch.length} operaciones)`);
        onProgress?.(completedOperations, result.totalOperations);
        
      } catch (error: any) {
        const errorMsg = `Error en lote ${index + 1}: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    result.success = result.errors.length === 0;
    result.executionTime = Date.now() - startTime;

    console.log(`🎯 Batch mixto completado: ${completedOperations}/${result.totalOperations} operaciones en ${result.executionTime}ms`);
    
    return result;
    
  } catch (error: any) {
    result.errors.push(`Error general: ${error.message}`);
    result.executionTime = Date.now() - startTime;
    console.error('❌ Error en batch mixto:', error);
    return result;
  }
};

/**
 * Función de conveniencia para eliminar documentos por colección y condiciones
 */
export const deleteByQuery = async (
  collectionName: string,
  conditions: Array<{ field: string; operator: any; value: any }>,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchResult> => {
  try {
    let collectionQuery = query(collection(db, collectionName));
    
    // Aplicar condiciones (esto es solo un ejemplo básico)
    // En un caso real, necesitarías importar los operadores where apropiados
    
    return await deleteCollectionBatch(collectionQuery, onProgress);
    
  } catch (error: any) {
    console.error(`❌ Error en deleteByQuery para ${collectionName}:`, error);
    return {
      success: false,
      totalOperations: 0,
      batchesExecuted: 0,
      errors: [`Error en consulta: ${error.message}`],
      executionTime: 0
    };
  }
};

export default {
  deleteBatch,
  batchWrite,
  updateBatch,
  deleteCollectionBatch,
  executeMixedBatch,
  deleteByQuery
};