import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Script de migración para agregar el campo 'type' a notebooks existentes
 * y preparar la unificación de colecciones
 */
export async function migrateNotebooks() {
  console.log('🚀 Iniciando migración de notebooks...');
  
  try {
    // Migrar notebooks personales
    console.log('\n📚 Migrando notebooks personales...');
    const personalNotebooks = await getDocs(collection(db, 'notebooks'));
    let personalCount = 0;
    
    const personalBatch = writeBatch(db);
    
    personalNotebooks.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      
      // Solo actualizar si no tiene el campo type
      if (!data.type) {
        personalBatch.update(doc(db, 'notebooks', docSnapshot.id), {
          type: 'personal',
          updatedAt: Timestamp.now()
        });
        personalCount++;
      }
    });
    
    if (personalCount > 0) {
      await personalBatch.commit();
      console.log(`✅ Actualizados ${personalCount} notebooks personales`);
    } else {
      console.log('ℹ️  Todos los notebooks personales ya tienen el campo type');
    }
    
    // Migrar school notebooks
    console.log('\n🏫 Migrando notebooks escolares...');
    const schoolNotebooks = await getDocs(collection(db, 'schoolNotebooks'));
    let schoolCount = 0;
    
    const schoolBatch = writeBatch(db);
    
    schoolNotebooks.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      
      // Solo actualizar si no tiene el campo type
      if (!data.type) {
        schoolBatch.update(doc(db, 'schoolNotebooks', docSnapshot.id), {
          type: 'school',
          updatedAt: Timestamp.now()
        });
        schoolCount++;
      }
    });
    
    if (schoolCount > 0) {
      await schoolBatch.commit();
      console.log(`✅ Actualizados ${schoolCount} notebooks escolares`);
    } else {
      console.log('ℹ️  Todos los notebooks escolares ya tienen el campo type');
    }
    
    // Resumen
    console.log('\n📊 Resumen de migración:');
    console.log(`- Notebooks personales actualizados: ${personalCount}`);
    console.log(`- Notebooks escolares actualizados: ${schoolCount}`);
    console.log(`- Total de notebooks procesados: ${personalCount + schoolCount}`);
    
    console.log('\n✨ Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

/**
 * Script para verificar el estado de la migración
 */
export async function verifyMigration() {
  console.log('🔍 Verificando estado de migración...\n');
  
  try {
    // Verificar notebooks personales
    const personalNotebooks = await getDocs(collection(db, 'notebooks'));
    let personalWithType = 0;
    let personalWithoutType = 0;
    
    personalNotebooks.forEach((doc) => {
      const data = doc.data();
      if (data.type) {
        personalWithType++;
      } else {
        personalWithoutType++;
      }
    });
    
    console.log('📚 Notebooks personales:');
    console.log(`  ✅ Con type: ${personalWithType}`);
    console.log(`  ❌ Sin type: ${personalWithoutType}`);
    
    // Verificar school notebooks
    const schoolNotebooks = await getDocs(collection(db, 'schoolNotebooks'));
    let schoolWithType = 0;
    let schoolWithoutType = 0;
    
    schoolNotebooks.forEach((doc) => {
      const data = doc.data();
      if (data.type) {
        schoolWithType++;
      } else {
        schoolWithoutType++;
      }
    });
    
    console.log('\n🏫 Notebooks escolares:');
    console.log(`  ✅ Con type: ${schoolWithType}`);
    console.log(`  ❌ Sin type: ${schoolWithoutType}`);
    
    const totalPending = personalWithoutType + schoolWithoutType;
    
    if (totalPending === 0) {
      console.log('\n✨ Todos los notebooks tienen el campo type!');
    } else {
      console.log(`\n⚠️  Aún quedan ${totalPending} notebooks sin migrar`);
    }
    
  } catch (error) {
    console.error('❌ Error al verificar migración:', error);
    throw error;
  }
}

// Para ejecutar desde la consola del navegador:
// import { migrateNotebooks, verifyMigration } from './scripts/migrateNotebooks';
// await verifyMigration(); // Para ver el estado actual
// await migrateNotebooks(); // Para ejecutar la migración