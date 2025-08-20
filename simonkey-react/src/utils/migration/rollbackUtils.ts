import { collection, doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface BackupData {
  id: string;
  collection: string;
  data: any;
  timestamp: Timestamp;
  operation: 'create' | 'update' | 'delete';
}

interface MigrationCheckpoint {
  id: string;
  phase: string;
  status: 'started' | 'completed' | 'failed' | 'rolled_back';
  timestamp: Timestamp;
  affectedDocuments: number;
  backups: BackupData[];
  error?: string;
}

/**
 * Clase para manejar rollbacks de migración
 */
export class MigrationRollback {
  private checkpointId: string;
  private backups: BackupData[] = [];
  private phase: string;

  constructor(phase: string) {
    this.phase = phase;
    this.checkpointId = `migration_${phase}_${Date.now()}`;
  }

  /**
   * Hace backup de un documento antes de modificarlo
   */
  async backupDocument(collectionName: string, documentId: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnapshot = await getDoc(docRef);
      
      if (docSnapshot.exists()) {
        const backup: BackupData = {
          id: documentId,
          collection: collectionName,
          data: docSnapshot.data(),
          timestamp: Timestamp.now(),
          operation: 'update'
        };
        
        this.backups.push(backup);
        
        // Guardar backup en Firestore
        await setDoc(
          doc(db, 'migration_backups', `${this.checkpointId}_${documentId}`),
          backup
        );
        
        console.log(`✅ Backup creado para ${collectionName}/${documentId}`);
      }
    } catch (error) {
      console.error(`❌ Error creando backup para ${collectionName}/${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Hace backup antes de crear un nuevo documento
   */
  async backupNewDocument(collectionName: string, documentId: string): Promise<void> {
    const backup: BackupData = {
      id: documentId,
      collection: collectionName,
      data: null,
      timestamp: Timestamp.now(),
      operation: 'create'
    };
    
    this.backups.push(backup);
    
    // Guardar backup en Firestore
    await setDoc(
      doc(db, 'migration_backups', `${this.checkpointId}_${documentId}`),
      backup
    );
    
    console.log(`✅ Backup registrado para nuevo documento ${collectionName}/${documentId}`);
  }

  /**
   * Hace backup antes de eliminar un documento
   */
  async backupDeleteDocument(collectionName: string, documentId: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnapshot = await getDoc(docRef);
      
      if (docSnapshot.exists()) {
        const backup: BackupData = {
          id: documentId,
          collection: collectionName,
          data: docSnapshot.data(),
          timestamp: Timestamp.now(),
          operation: 'delete'
        };
        
        this.backups.push(backup);
        
        // Guardar backup en Firestore
        await setDoc(
          doc(db, 'migration_backups', `${this.checkpointId}_${documentId}`),
          backup
        );
        
        console.log(`✅ Backup creado para eliminación de ${collectionName}/${documentId}`);
      }
    } catch (error) {
      console.error(`❌ Error creando backup para eliminación:`, error);
      throw error;
    }
  }

  /**
   * Crea un checkpoint de la migración
   */
  async createCheckpoint(status: 'started' | 'completed' | 'failed' = 'started'): Promise<void> {
    const checkpoint: MigrationCheckpoint = {
      id: this.checkpointId,
      phase: this.phase,
      status: status,
      timestamp: Timestamp.now(),
      affectedDocuments: this.backups.length,
      backups: this.backups
    };
    
    await setDoc(
      doc(db, 'migration_checkpoints', this.checkpointId),
      checkpoint
    );
    
    console.log(`📍 Checkpoint creado: ${this.checkpointId}`);
  }

  /**
   * Realiza rollback de todos los cambios
   */
  async rollback(): Promise<void> {
    console.log(`🔄 Iniciando rollback para checkpoint ${this.checkpointId}...`);
    
    let successful = 0;
    let failed = 0;
    
    for (const backup of this.backups) {
      try {
        const docRef = doc(db, backup.collection, backup.id);
        
        switch (backup.operation) {
          case 'create':
            // Si se creó, eliminar
            await deleteDoc(docRef);
            console.log(`  ↩️ Eliminado documento creado: ${backup.collection}/${backup.id}`);
            break;
            
          case 'update':
            // Si se actualizó, restaurar datos originales
            await setDoc(docRef, backup.data);
            console.log(`  ↩️ Restaurado documento: ${backup.collection}/${backup.id}`);
            break;
            
          case 'delete':
            // Si se eliminó, recrear
            await setDoc(docRef, backup.data);
            console.log(`  ↩️ Recreado documento eliminado: ${backup.collection}/${backup.id}`);
            break;
        }
        
        successful++;
      } catch (error) {
        console.error(`  ❌ Error en rollback de ${backup.collection}/${backup.id}:`, error);
        failed++;
      }
    }
    
    // Actualizar checkpoint
    await setDoc(
      doc(db, 'migration_checkpoints', this.checkpointId),
      {
        status: 'rolled_back',
        rollbackTimestamp: Timestamp.now(),
        rollbackResults: {
          successful,
          failed,
          total: this.backups.length
        }
      },
      { merge: true }
    );
    
    console.log(`\n✅ Rollback completado:`);
    console.log(`   - Exitosos: ${successful}`);
    console.log(`   - Fallidos: ${failed}`);
    console.log(`   - Total: ${this.backups.length}`);
  }

  /**
   * Obtiene el ID del checkpoint
   */
  getCheckpointId(): string {
    return this.checkpointId;
  }
}

/**
 * Función para listar todos los checkpoints disponibles
 */
export async function listMigrationCheckpoints(): Promise<MigrationCheckpoint[]> {
  try {
    const checkpointsRef = collection(db, 'migration_checkpoints');
    const { getDocs } = await import('firebase/firestore');
    const snapshot = await getDocs(checkpointsRef);
    
    const checkpoints: MigrationCheckpoint[] = [];
    snapshot.forEach(doc => {
      checkpoints.push({ id: doc.id, ...doc.data() } as MigrationCheckpoint);
    });
    
    // Ordenar por timestamp descendente
    checkpoints.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    
    console.log(`\n📋 CHECKPOINTS DE MIGRACIÓN DISPONIBLES`);
    console.log(`=========================================`);
    checkpoints.forEach((cp, index) => {
      const date = cp.timestamp.toDate();
      console.log(`\n${index + 1}. ${cp.phase}`);
      console.log(`   - ID: ${cp.id}`);
      console.log(`   - Estado: ${cp.status}`);
      console.log(`   - Fecha: ${date.toLocaleString()}`);
      console.log(`   - Documentos afectados: ${cp.affectedDocuments}`);
      if (cp.error) {
        console.log(`   - Error: ${cp.error}`);
      }
    });
    
    return checkpoints;
  } catch (error) {
    console.error('Error listando checkpoints:', error);
    throw error;
  }
}

/**
 * Función para hacer rollback de un checkpoint específico
 */
export async function rollbackToCheckpoint(checkpointId: string): Promise<void> {
  try {
    const checkpointDoc = await getDoc(doc(db, 'migration_checkpoints', checkpointId));
    
    if (!checkpointDoc.exists()) {
      throw new Error(`Checkpoint ${checkpointId} no encontrado`);
    }
    
    const checkpoint = checkpointDoc.data() as MigrationCheckpoint;
    
    if (checkpoint.status === 'rolled_back') {
      console.log(`⚠️ Este checkpoint ya fue revertido`);
      return;
    }
    
    console.log(`🔄 Iniciando rollback del checkpoint ${checkpointId}...`);
    console.log(`   Fase: ${checkpoint.phase}`);
    console.log(`   Documentos a revertir: ${checkpoint.affectedDocuments}`);
    
    const rollback = new MigrationRollback(checkpoint.phase);
    rollback['checkpointId'] = checkpointId;
    rollback['backups'] = checkpoint.backups;
    
    await rollback.rollback();
    
  } catch (error) {
    console.error('Error haciendo rollback:', error);
    throw error;
  }
}

/**
 * Función para limpiar backups antiguos (más de 30 días)
 */
export async function cleanOldBackups(daysToKeep: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const checkpointsRef = collection(db, 'migration_checkpoints');
    const { getDocs, query, where } = await import('firebase/firestore');
    const oldCheckpoints = await getDocs(
      query(checkpointsRef, where('timestamp', '<', Timestamp.fromDate(cutoffDate)))
    );
    
    let deleted = 0;
    for (const doc of oldCheckpoints.docs) {
      await deleteDoc(doc.ref);
      deleted++;
    }
    
    console.log(`🧹 Limpieza completada: ${deleted} checkpoints antiguos eliminados`);
    
  } catch (error) {
    console.error('Error limpiando backups antiguos:', error);
    throw error;
  }
}

/**
 * Funciones para ejecutar desde la consola del navegador
 */
if (typeof window !== 'undefined') {
  (window as any).MigrationRollback = MigrationRollback;
  (window as any).listMigrationCheckpoints = listMigrationCheckpoints;
  (window as any).rollbackToCheckpoint = rollbackToCheckpoint;
  (window as any).cleanOldBackups = cleanOldBackups;
  
  console.log('💡 Funciones de rollback disponibles:');
  console.log('   - new window.MigrationRollback(phase)');
  console.log('   - window.listMigrationCheckpoints()');
  console.log('   - window.rollbackToCheckpoint(checkpointId)');
  console.log('   - window.cleanOldBackups(daysToKeep)');
}