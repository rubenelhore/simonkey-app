import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  deleteDoc,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Script para completar la migración y consolidar las colecciones
 * ADVERTENCIA: Este script debe ejecutarse solo después de verificar que
 * todos los notebooks y conceptos tienen los campos necesarios
 */
export async function completeMigration(dryRun: boolean = true) {
  console.log(`🚀 ${dryRun ? 'SIMULACIÓN' : 'EJECUTANDO'} migración completa...`);
  
  try {
    // 1. Migrar schoolNotebooks a notebooks
    console.log('\n📚 Migrando schoolNotebooks a notebooks...');
    const schoolNotebooks = await getDocs(collection(db, 'schoolNotebooks'));
    let notebooksMigrated = 0;
    
    for (const docSnapshot of schoolNotebooks.docs) {
      const data = docSnapshot.data();
      const notebookData = {
        ...data,
        type: 'school',
        updatedAt: Timestamp.now()
      };
      
      if (!dryRun) {
        // Crear en notebooks con el mismo ID
        await setDoc(doc(db, 'notebooks', docSnapshot.id), notebookData);
      }
      notebooksMigrated++;
      console.log(`  ${dryRun ? '[DRY RUN]' : '✅'} Notebook ${docSnapshot.id} migrado`);
    }
    
    console.log(`Total notebooks escolares a migrar: ${notebooksMigrated}`);
    
    // 2. Migrar schoolConcepts a conceptos
    console.log('\n📝 Migrando schoolConcepts a conceptos...');
    const schoolConcepts = await getDocs(collection(db, 'schoolConcepts'));
    let conceptsMigrated = 0;
    
    for (const docSnapshot of schoolConcepts.docs) {
      const data = docSnapshot.data();
      const conceptData = {
        ...data,
        conceptType: 'school',
        updatedAt: Timestamp.now()
      };
      
      if (!dryRun) {
        // Crear en conceptos con el mismo ID
        await setDoc(doc(db, 'conceptos', docSnapshot.id), conceptData);
      }
      conceptsMigrated++;
      console.log(`  ${dryRun ? '[DRY RUN]' : '✅'} Documento de conceptos ${docSnapshot.id} migrado`);
    }
    
    console.log(`Total documentos de conceptos escolares a migrar: ${conceptsMigrated}`);
    
    // 3. Actualizar referencias en usuarios
    console.log('\n👥 Actualizando referencias en usuarios...');
    const usuarios = await getDocs(collection(db, 'usuarios'));
    let usuariosActualizados = 0;
    
    for (const userDoc of usuarios.docs) {
      const userData = userDoc.data();
      
      // Solo actualizar si es un estudiante con notebooks asignados
      if (userData.schoolRole === 'student' && userData.idCuadernos?.length > 0) {
        if (!dryRun) {
          // Las referencias de IDs no cambian, solo informamos
          console.log(`  ℹ️  Usuario ${userDoc.id} mantiene referencias a ${userData.idCuadernos.length} notebooks`);
        }
        usuariosActualizados++;
      }
    }
    
    console.log(`Total usuarios escolares con notebooks: ${usuariosActualizados}`);
    
    // Resumen
    console.log('\n📊 Resumen de migración:');
    console.log(`- Notebooks escolares migrados: ${notebooksMigrated}`);
    console.log(`- Documentos de conceptos escolares migrados: ${conceptsMigrated}`);
    console.log(`- Usuarios escolares procesados: ${usuariosActualizados}`);
    
    if (dryRun) {
      console.log('\n⚠️  Esta fue una SIMULACIÓN. Para ejecutar la migración real, ejecuta:');
      console.log('await completeMigration(false)');
    } else {
      console.log('\n✨ Migración completada exitosamente!');
      console.log('\n⚠️  Próximos pasos:');
      console.log('1. Verificar que la aplicación funciona correctamente');
      console.log('2. Hacer backup de las colecciones legacy');
      console.log('3. Ejecutar cleanupLegacyCollections() para eliminar colecciones antiguas');
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

/**
 * Script para eliminar las colecciones legacy después de verificar la migración
 * ADVERTENCIA: Este script ELIMINA DATOS. Asegúrate de tener un backup.
 */
export async function cleanupLegacyCollections(confirmDelete: boolean = false) {
  if (!confirmDelete) {
    console.log('⚠️  ADVERTENCIA: Este script eliminará las colecciones legacy.');
    console.log('Para confirmar, ejecuta: cleanupLegacyCollections(true)');
    return;
  }
  
  console.log('🗑️  Eliminando colecciones legacy...');
  
  try {
    // Eliminar schoolNotebooks
    console.log('\n📚 Eliminando schoolNotebooks...');
    const schoolNotebooks = await getDocs(collection(db, 'schoolNotebooks'));
    let notebooksDeleted = 0;
    
    const notebookBatch = writeBatch(db);
    schoolNotebooks.forEach((docSnapshot) => {
      notebookBatch.delete(doc(db, 'schoolNotebooks', docSnapshot.id));
      notebooksDeleted++;
    });
    
    if (notebooksDeleted > 0) {
      await notebookBatch.commit();
      console.log(`✅ Eliminados ${notebooksDeleted} schoolNotebooks`);
    }
    
    // Eliminar schoolConcepts
    console.log('\n📝 Eliminando schoolConcepts...');
    const schoolConcepts = await getDocs(collection(db, 'schoolConcepts'));
    let conceptsDeleted = 0;
    
    const conceptBatch = writeBatch(db);
    schoolConcepts.forEach((docSnapshot) => {
      conceptBatch.delete(doc(db, 'schoolConcepts', docSnapshot.id));
      conceptsDeleted++;
    });
    
    if (conceptsDeleted > 0) {
      await conceptBatch.commit();
      console.log(`✅ Eliminados ${conceptsDeleted} schoolConcepts`);
    }
    
    console.log('\n✨ Limpieza completada!');
    console.log(`Total documentos eliminados: ${notebooksDeleted + conceptsDeleted}`);
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    throw error;
  }
}

/**
 * Función para verificar el estado actual de las colecciones
 */
export async function verifyCollections() {
  console.log('🔍 Verificando estado de las colecciones...\n');
  
  try {
    // Contar notebooks
    const notebooks = await getDocs(collection(db, 'notebooks'));
    const personalNotebooks = notebooks.docs.filter(doc => doc.data().type === 'personal');
    const schoolNotebooksInMain = notebooks.docs.filter(doc => doc.data().type === 'school');
    
    console.log('📚 Colección notebooks:');
    console.log(`  - Personales: ${personalNotebooks.length}`);
    console.log(`  - Escolares: ${schoolNotebooksInMain.length}`);
    console.log(`  - Total: ${notebooks.size}`);
    
    // Contar schoolNotebooks legacy
    const schoolNotebooksLegacy = await getDocs(collection(db, 'schoolNotebooks'));
    console.log(`\n🏫 Colección schoolNotebooks (legacy): ${schoolNotebooksLegacy.size}`);
    
    // Contar conceptos
    const conceptos = await getDocs(collection(db, 'conceptos'));
    const personalConcepts = conceptos.docs.filter(doc => !doc.data().conceptType || doc.data().conceptType === 'personal');
    const schoolConceptsInMain = conceptos.docs.filter(doc => doc.data().conceptType === 'school');
    
    console.log('\n📝 Colección conceptos:');
    console.log(`  - Personales: ${personalConcepts.length}`);
    console.log(`  - Escolares: ${schoolConceptsInMain.length}`);
    console.log(`  - Total: ${conceptos.size}`);
    
    // Contar schoolConcepts legacy
    const schoolConceptsLegacy = await getDocs(collection(db, 'schoolConcepts'));
    console.log(`\n🏫 Colección schoolConcepts (legacy): ${schoolConceptsLegacy.size}`);
    
    // Estado de migración
    console.log('\n📊 Estado de migración:');
    if (schoolNotebooksLegacy.size === 0 && schoolConceptsLegacy.size === 0) {
      console.log('✅ Migración completada - Las colecciones legacy están vacías');
    } else if (schoolNotebooksInMain.length > 0 || schoolConceptsInMain.length > 0) {
      console.log('⚠️  Migración parcial - Hay datos en ambas colecciones');
    } else {
      console.log('❌ Migración pendiente - Los datos escolares siguen en colecciones legacy');
    }
    
  } catch (error) {
    console.error('❌ Error al verificar colecciones:', error);
    throw error;
  }
}

// Para ejecutar desde la consola del navegador:
// import { completeMigration, cleanupLegacyCollections, verifyCollections } from './scripts/completeMigration';
// await verifyCollections(); // Ver estado actual
// await completeMigration(true); // Simulación
// await completeMigration(false); // Migración real
// await cleanupLegacyCollections(true); // Eliminar colecciones legacy