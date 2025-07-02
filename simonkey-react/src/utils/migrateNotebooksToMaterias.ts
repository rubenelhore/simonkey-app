import { db } from '../services/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, serverTimestamp, query, where, writeBatch } from 'firebase/firestore';

interface MigrationResult {
  userId: string;
  notebooksMigrated: number;
  materiaCreated: boolean;
  error?: string;
}

/**
 * Migra los notebooks existentes de un usuario a una materia por defecto
 */
export const migrateUserNotebooksToDefaultMateria = async (userId: string): Promise<MigrationResult> => {
  try {
    console.log(`🔄 Iniciando migración para usuario: ${userId}`);
    
    // 1. Obtener todos los notebooks del usuario
    const notebooksQuery = query(
      collection(db, 'notebooks'), 
      where('userId', '==', userId)
    );
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    // 2. Filtrar notebooks que no tienen materiaId
    const notebooksWithoutMateria = notebooksSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.materiaId;
    });
    
    if (notebooksWithoutMateria.length === 0) {
      console.log(`✅ Usuario ${userId} no tiene notebooks sin materia`);
      return {
        userId,
        notebooksMigrated: 0,
        materiaCreated: false
      };
    }
    
    console.log(`📚 Encontrados ${notebooksWithoutMateria.length} notebooks sin materia`);
    
    // 3. Verificar si el usuario ya tiene una materia "General"
    const materiasQuery = query(
      collection(db, 'materias'),
      where('userId', '==', userId),
      where('title', '==', 'General')
    );
    const materiasSnapshot = await getDocs(materiasQuery);
    
    let defaultMateriaId: string;
    let materiaCreated = false;
    
    if (materiasSnapshot.empty) {
      // 4. Crear materia "General" si no existe
      console.log(`📁 Creando materia "General" para usuario ${userId}`);
      const materiaRef = doc(collection(db, 'materias'));
      defaultMateriaId = materiaRef.id;
      
      await setDoc(materiaRef, {
        title: 'General',
        userId,
        color: '#6B7280', // Color gris neutro
        category: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        description: 'Materia por defecto para notebooks sin categorizar'
      });
      
      materiaCreated = true;
    } else {
      // Usar la materia "General" existente
      defaultMateriaId = materiasSnapshot.docs[0].id;
      console.log(`📁 Usando materia "General" existente: ${defaultMateriaId}`);
    }
    
    // 5. Actualizar notebooks en lotes para mejor rendimiento
    const batch = writeBatch(db);
    let updateCount = 0;
    
    for (const notebookDoc of notebooksWithoutMateria) {
      const notebookRef = doc(db, 'notebooks', notebookDoc.id);
      batch.update(notebookRef, {
        materiaId: defaultMateriaId,
        updatedAt: serverTimestamp()
      });
      updateCount++;
      
      // Firestore tiene un límite de 500 operaciones por lote
      if (updateCount % 500 === 0) {
        await batch.commit();
        console.log(`💾 Lote de ${updateCount} notebooks actualizado`);
      }
    }
    
    // Commit del último lote
    await batch.commit();
    console.log(`✅ Migración completada: ${updateCount} notebooks migrados`);
    
    return {
      userId,
      notebooksMigrated: updateCount,
      materiaCreated
    };
    
  } catch (error) {
    console.error(`❌ Error migrando notebooks del usuario ${userId}:`, error);
    return {
      userId,
      notebooksMigrated: 0,
      materiaCreated: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Migra todos los notebooks de todos los usuarios a materias por defecto
 */
export const migrateAllNotebooksToMaterias = async (): Promise<MigrationResult[]> => {
  console.log('🚀 Iniciando migración masiva de notebooks a materias');
  
  try {
    // 1. Obtener todos los usuarios únicos que tienen notebooks
    const notebooksSnapshot = await getDocs(collection(db, 'notebooks'));
    const uniqueUserIds = new Set<string>();
    
    notebooksSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId && !data.materiaId) {
        uniqueUserIds.add(data.userId);
      }
    });
    
    console.log(`👥 Encontrados ${uniqueUserIds.size} usuarios con notebooks sin materia`);
    
    // 2. Migrar notebooks de cada usuario
    const results: MigrationResult[] = [];
    
    for (const userId of uniqueUserIds) {
      const result = await migrateUserNotebooksToDefaultMateria(userId);
      results.push(result);
      
      // Pequeña pausa para no sobrecargar Firestore
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 3. Resumen de resultados
    const totalNotebooksMigrated = results.reduce((sum, r) => sum + r.notebooksMigrated, 0);
    const totalMateriasCreated = results.filter(r => r.materiaCreated).length;
    const errors = results.filter(r => r.error);
    
    console.log('📊 Resumen de migración:');
    console.log(`   - Usuarios procesados: ${results.length}`);
    console.log(`   - Notebooks migrados: ${totalNotebooksMigrated}`);
    console.log(`   - Materias creadas: ${totalMateriasCreated}`);
    console.log(`   - Errores: ${errors.length}`);
    
    if (errors.length > 0) {
      console.error('❌ Errores encontrados:', errors);
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Error en migración masiva:', error);
    throw error;
  }
};

/**
 * Verifica el estado de migración de un usuario específico
 */
export const checkUserMigrationStatus = async (userId: string): Promise<{
  needsMigration: boolean;
  notebooksWithoutMateria: number;
  hasDefaultMateria: boolean;
}> => {
  try {
    // Verificar notebooks sin materia
    const notebooksQuery = query(
      collection(db, 'notebooks'),
      where('userId', '==', userId)
    );
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    const notebooksWithoutMateria = notebooksSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.materiaId;
    }).length;
    
    // Verificar si tiene materia "General"
    const materiasQuery = query(
      collection(db, 'materias'),
      where('userId', '==', userId),
      where('title', '==', 'General')
    );
    const materiasSnapshot = await getDocs(materiasQuery);
    
    return {
      needsMigration: notebooksWithoutMateria > 0,
      notebooksWithoutMateria,
      hasDefaultMateria: !materiasSnapshot.empty
    };
    
  } catch (error) {
    console.error('❌ Error verificando estado de migración:', error);
    throw error;
  }
};