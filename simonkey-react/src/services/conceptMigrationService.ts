import { db } from './firebase';
import { 
  collection, 
  doc, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  deleteDoc,
  serverTimestamp,
  DocumentReference 
} from 'firebase/firestore';
import { batchWrite, deleteBatch, BatchResult } from './batchService';

/**
 * Interfaz para concepto individual
 */
export interface IndividualConcept {
  id: string;
  término: string;
  definición: string;
  fuente: string;
  cuadernoId: string;
  usuarioId: string;
  índice: number;
  notasPersonales?: string;
  reviewId?: string;
  dominado?: boolean;
  createdAt: any;
  updatedAt: any;
}

/**
 * Resultado de migración
 */
export interface MigrationResult {
  success: boolean;
  processedNotebooks: number;
  migratedConcepts: number;
  deletedOldDocs: number;
  errors: string[];
  executionTime: number;
}

/**
 * Migra la estructura de conceptos de arrays a documentos individuales
 * para un usuario específico
 */
export const migrateUserConcepts = async (
  userId: string,
  onProgress?: (step: string, completed: number, total: number) => void
): Promise<MigrationResult> => {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: false,
    processedNotebooks: 0,
    migratedConcepts: 0,
    deletedOldDocs: 0,
    errors: [],
    executionTime: 0
  };

  try {
    console.log(`🔄 Iniciando migración de conceptos para usuario: ${userId}`);
    onProgress?.('Iniciando migración', 0, 100);

    // 1. Obtener todos los documentos de conceptos del usuario
    const conceptosQuery = query(
      collection(db, 'conceptos'), 
      where('usuarioId', '==', userId)
    );
    const conceptosSnapshot = await getDocs(conceptosQuery);
    
    if (conceptosSnapshot.empty) {
      console.log('📭 No se encontraron conceptos para migrar');
      result.success = true;
      result.executionTime = Date.now() - startTime;
      return result;
    }

    console.log(`📄 Encontrados ${conceptosSnapshot.docs.length} documentos de conceptos para migrar`);
    onProgress?.('Analizando documentos', 20, 100);

    // 2. Procesar cada documento de conceptos
    const newConceptRefs: Array<{ ref: DocumentReference; data: IndividualConcept }> = [];
    const oldDocRefs: DocumentReference[] = [];

    for (const conceptDoc of conceptosSnapshot.docs) {
      const conceptData = conceptDoc.data();
      const conceptosArray = conceptData.conceptos || [];
      
      if (conceptosArray.length === 0) {
        console.log(`⚠️ Documento ${conceptDoc.id} no tiene conceptos, marcando para eliminación`);
        oldDocRefs.push(conceptDoc.ref);
        continue;
      }

      console.log(`📋 Procesando ${conceptosArray.length} conceptos del documento ${conceptDoc.id}`);
      
      // Convertir cada concepto del array a documento individual
      conceptosArray.forEach((concepto: any, índice: number) => {
        const conceptId = concepto.id || `${conceptData.cuadernoId}_${índice}_${Date.now()}`;
        
        const individualConcept: IndividualConcept = {
          id: conceptId,
          término: concepto.término,
          definición: concepto.definición,
          fuente: concepto.fuente || 'Migrado',
          cuadernoId: conceptData.cuadernoId,
          usuarioId: userId,
          índice: índice,
          notasPersonales: concepto.notasPersonales,
          reviewId: concepto.reviewId,
          dominado: concepto.dominado || false,
          createdAt: conceptData.creadoEn || serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const newDocRef = doc(collection(db, 'concepts_individual'), conceptId);
        newConceptRefs.push({
          ref: newDocRef,
          data: individualConcept
        });
      });

      // Marcar documento original para eliminación
      oldDocRefs.push(conceptDoc.ref);
      result.processedNotebooks++;
      result.migratedConcepts += conceptosArray.length;
    }

    console.log(`📊 Preparados ${newConceptRefs.length} conceptos individuales para crear`);
    onProgress?.('Creando conceptos individuales', 40, 100);

    // 3. Crear conceptos individuales en lotes
    if (newConceptRefs.length > 0) {
      const writeOperations = newConceptRefs.map(({ ref, data }) => ({
        ref,
        data
      }));

      const writeResult = await batchWrite(writeOperations, (completed: number, total: number) => {
        const progressPercent = 40 + Math.round((completed / total) * 30);
        onProgress?.('Creando conceptos individuales', progressPercent, 100);
      });

      if (!writeResult.success) {
        result.errors.push(...writeResult.errors);
        console.error('❌ Error creando conceptos individuales:', writeResult.errors);
      } else {
        console.log(`✅ Creados ${writeResult.totalOperations} conceptos individuales en ${writeResult.executionTime}ms`);
      }
    }

    onProgress?.('Eliminando documentos antiguos', 80, 100);

    // 4. Eliminar documentos antiguos en lotes
    if (oldDocRefs.length > 0) {
      const deleteResult = await deleteBatch(oldDocRefs, (completed: number, total: number) => {
        const progressPercent = 80 + Math.round((completed / total) * 15);
        onProgress?.('Eliminando documentos antiguos', progressPercent, 100);
      });

      if (!deleteResult.success) {
        result.errors.push(...deleteResult.errors);
        console.error('❌ Error eliminando documentos antiguos:', deleteResult.errors);
      } else {
        result.deletedOldDocs = deleteResult.totalOperations;
        console.log(`✅ Eliminados ${deleteResult.totalOperations} documentos antiguos en ${deleteResult.executionTime}ms`);
      }
    }

    result.success = result.errors.length === 0;
    result.executionTime = Date.now() - startTime;

    if (result.success) {
      console.log(`🎯 ✅ Migración completada exitosamente:`);
      console.log(`   📚 Notebooks procesados: ${result.processedNotebooks}`);
      console.log(`   📝 Conceptos migrados: ${result.migratedConcepts}`);
      console.log(`   🗑️ Documentos antiguos eliminados: ${result.deletedOldDocs}`);
      console.log(`   ⏱️ Tiempo total: ${result.executionTime}ms`);
    } else {
      console.log(`⚠️ Migración completada con ${result.errors.length} errores`);
      result.errors.forEach(error => console.error('❌', error));
    }

    onProgress?.('Migración completada', 100, 100);
    return result;

  } catch (error: any) {
    result.errors.push(`Error crítico en migración: ${error.message}`);
    result.executionTime = Date.now() - startTime;
    console.error('❌ Error crítico durante migración:', error);
    return result;
  }
};

/**
 * Verifica si un usuario necesita migración
 */
export const checkIfUserNeedsMigration = async (userId: string): Promise<{
  needsMigration: boolean;
  oldDocsCount: number;
  individualDocsCount: number;
}> => {
  try {
    // Verificar documentos antiguos (con arrays)
    const oldConceptsQuery = query(
      collection(db, 'conceptos'), 
      where('usuarioId', '==', userId)
    );
    const oldConceptsSnapshot = await getDocs(oldConceptsQuery);

    // Verificar documentos nuevos (individuales)
    const newConceptsQuery = query(
      collection(db, 'concepts_individual'), 
      where('usuarioId', '==', userId)
    );
    const newConceptsSnapshot = await getDocs(newConceptsQuery);

    const needsMigration = oldConceptsSnapshot.docs.length > 0;

    return {
      needsMigration,
      oldDocsCount: oldConceptsSnapshot.docs.length,
      individualDocsCount: newConceptsSnapshot.docs.length
    };

  } catch (error) {
    console.error('Error verificando necesidad de migración:', error);
    return {
      needsMigration: false,
      oldDocsCount: 0,
      individualDocsCount: 0
    };
  }
};

/**
 * Migra conceptos de todos los usuarios de manera progresiva
 */
export const migrateAllUsersConcepts = async (
  onProgress?: (currentUser: string, userIndex: number, totalUsers: number) => void
): Promise<{
  totalUsers: number;
  successfulMigrations: number;
  failedMigrations: number;
  totalConceptsMigrated: number;
  errors: Array<{ userId: string; error: string }>;
}> => {
  const result = {
    totalUsers: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    totalConceptsMigrated: 0,
    errors: [] as Array<{ userId: string; error: string }>
  };

  try {
    console.log('🌍 Iniciando migración masiva de conceptos...');

    // Obtener todos los usuarios únicos que tienen conceptos
    const allConceptsQuery = query(collection(db, 'conceptos'));
    const allConceptsSnapshot = await getDocs(allConceptsQuery);
    
    const userIds = new Set<string>();
    allConceptsSnapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      if (data.usuarioId) {
        userIds.add(data.usuarioId);
      }
    });

    const uniqueUserIds = Array.from(userIds);
    result.totalUsers = uniqueUserIds.length;

    console.log(`👥 Encontrados ${result.totalUsers} usuarios con conceptos para migrar`);

    // Migrar usuario por usuario
    for (let i = 0; i < uniqueUserIds.length; i++) {
      const userId = uniqueUserIds[i];
      onProgress?.(userId, i + 1, result.totalUsers);

      try {
        console.log(`🔄 Migrando usuario ${i + 1}/${result.totalUsers}: ${userId}`);
        
        const migrationResult = await migrateUserConcepts(userId);
        
        if (migrationResult.success) {
          result.successfulMigrations++;
          result.totalConceptsMigrated += migrationResult.migratedConcepts;
          console.log(`✅ Usuario ${userId} migrado exitosamente`);
        } else {
          result.failedMigrations++;
          result.errors.push({
            userId,
            error: migrationResult.errors.join('; ')
          });
          console.log(`❌ Error migrando usuario ${userId}`);
        }

        // Pausa pequeña entre migraciones para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        result.failedMigrations++;
        result.errors.push({
          userId,
          error: error.message
        });
        console.error(`❌ Error crítico migrando usuario ${userId}:`, error);
      }
    }

    console.log('🎯 Migración masiva completada:');
    console.log(`   👥 Total usuarios: ${result.totalUsers}`);
    console.log(`   ✅ Migraciones exitosas: ${result.successfulMigrations}`);
    console.log(`   ❌ Migraciones fallidas: ${result.failedMigrations}`);
    console.log(`   📝 Total conceptos migrados: ${result.totalConceptsMigrated}`);

    return result;

  } catch (error: any) {
    console.error('❌ Error crítico en migración masiva:', error);
    throw error;
  }
};

/**
 * Revierte la migración (vuelve a la estructura anterior)
 * USAR SOLO EN EMERGENCIAS
 */
export const revertMigration = async (
  userId: string,
  onProgress?: (step: string, completed: number, total: number) => void
): Promise<MigrationResult> => {
  console.log(`⚠️ REVERTIENDO migración para usuario: ${userId}`);
  onProgress?.('Iniciando reversión', 0, 100);

  // Esta función sería para casos de emergencia donde necesitemos volver atrás
  // Por ahora solo logging - implementar si es necesario
  console.log('⚠️ Función de reversión no implementada - contactar administrador');
  
  return {
    success: false,
    processedNotebooks: 0,
    migratedConcepts: 0,
    deletedOldDocs: 0,
    errors: ['Función de reversión no implementada'],
    executionTime: 0
  };
};

export default {
  migrateUserConcepts,
  checkIfUserNeedsMigration,
  migrateAllUsersConcepts,
  revertMigration
};