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
 * Script de migración para preparar la unificación de conceptos
 * Este script añade metadatos necesarios a los documentos de conceptos existentes
 */
export async function migrateConcepts() {
  console.log('🚀 Iniciando migración de conceptos...');
  
  try {
    // Migrar conceptos personales
    console.log('\n📚 Migrando conceptos personales...');
    const personalConcepts = await getDocs(collection(db, 'conceptos'));
    let personalCount = 0;
    
    const personalBatch = writeBatch(db);
    
    personalConcepts.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      
      // Añadir metadatos si no existen
      const updates: any = {};
      
      if (!data.conceptType) {
        updates.conceptType = 'personal';
      }
      
      if (!data.updatedAt) {
        updates.updatedAt = Timestamp.now();
      }
      
      if (Object.keys(updates).length > 0) {
        personalBatch.update(doc(db, 'conceptos', docSnapshot.id), updates);
        personalCount++;
      }
    });
    
    if (personalCount > 0) {
      await personalBatch.commit();
      console.log(`✅ Actualizados ${personalCount} documentos de conceptos personales`);
    } else {
      console.log('ℹ️  Todos los conceptos personales ya tienen los metadatos necesarios');
    }
    
    // Migrar school concepts
    console.log('\n🏫 Migrando conceptos escolares...');
    const schoolConcepts = await getDocs(collection(db, 'schoolConcepts'));
    let schoolCount = 0;
    
    const schoolBatch = writeBatch(db);
    
    schoolConcepts.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      
      // Añadir metadatos si no existen
      const updates: any = {};
      
      if (!data.conceptType) {
        updates.conceptType = 'school';
      }
      
      if (!data.updatedAt) {
        updates.updatedAt = Timestamp.now();
      }
      
      if (Object.keys(updates).length > 0) {
        schoolBatch.update(doc(db, 'schoolConcepts', docSnapshot.id), updates);
        schoolCount++;
      }
    });
    
    if (schoolCount > 0) {
      await schoolBatch.commit();
      console.log(`✅ Actualizados ${schoolCount} documentos de conceptos escolares`);
    } else {
      console.log('ℹ️  Todos los conceptos escolares ya tienen los metadatos necesarios');
    }
    
    // Resumen
    console.log('\n📊 Resumen de migración:');
    console.log(`- Documentos de conceptos personales actualizados: ${personalCount}`);
    console.log(`- Documentos de conceptos escolares actualizados: ${schoolCount}`);
    console.log(`- Total de documentos procesados: ${personalCount + schoolCount}`);
    
    console.log('\n✨ Migración de conceptos completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

/**
 * Script para verificar el estado de la migración de conceptos
 */
export async function verifyConceptsMigration() {
  console.log('🔍 Verificando estado de migración de conceptos...\n');
  
  try {
    // Verificar conceptos personales
    const personalConcepts = await getDocs(collection(db, 'conceptos'));
    let personalWithType = 0;
    let personalWithoutType = 0;
    let personalTotalConcepts = 0;
    
    personalConcepts.forEach((doc) => {
      const data = doc.data();
      if (data.conceptType) {
        personalWithType++;
      } else {
        personalWithoutType++;
      }
      personalTotalConcepts += data.conceptos?.length || 0;
    });
    
    console.log('📚 Conceptos personales:');
    console.log(`  📄 Documentos con conceptType: ${personalWithType}`);
    console.log(`  📄 Documentos sin conceptType: ${personalWithoutType}`);
    console.log(`  💡 Total de conceptos: ${personalTotalConcepts}`);
    
    // Verificar school concepts
    const schoolConcepts = await getDocs(collection(db, 'schoolConcepts'));
    let schoolWithType = 0;
    let schoolWithoutType = 0;
    let schoolTotalConcepts = 0;
    
    schoolConcepts.forEach((doc) => {
      const data = doc.data();
      if (data.conceptType) {
        schoolWithType++;
      } else {
        schoolWithoutType++;
      }
      schoolTotalConcepts += data.conceptos?.length || 0;
    });
    
    console.log('\n🏫 Conceptos escolares:');
    console.log(`  📄 Documentos con conceptType: ${schoolWithType}`);
    console.log(`  📄 Documentos sin conceptType: ${schoolWithoutType}`);
    console.log(`  💡 Total de conceptos: ${schoolTotalConcepts}`);
    
    const totalPending = personalWithoutType + schoolWithoutType;
    
    if (totalPending === 0) {
      console.log('\n✨ Todos los documentos de conceptos tienen los metadatos necesarios!');
    } else {
      console.log(`\n⚠️  Aún quedan ${totalPending} documentos sin migrar`);
    }
    
    console.log(`\n📈 Total general de conceptos en el sistema: ${personalTotalConcepts + schoolTotalConcepts}`);
    
  } catch (error) {
    console.error('❌ Error al verificar migración:', error);
    throw error;
  }
}

// Para ejecutar desde la consola del navegador:
// import { migrateConcepts, verifyConceptsMigration } from './scripts/migrateConcepts';
// await verifyConceptsMigration(); // Para ver el estado actual
// await migrateConcepts(); // Para ejecutar la migración