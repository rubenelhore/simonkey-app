import { db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

async function fixUserNotebooks(userId: string, notebookId: string) {
  console.log(`\n🔧 Reparando asignación de cuadernos para usuario: ${userId}\n`);
  
  try {
    // 1. Obtener datos actuales del usuario
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    const userData = userDoc.data();
    const currentNotebooks = userData.idCuadernos || [];
    const isSchoolUser = userData.subscription === 'school';
    
    console.log(`📚 Cuadernos actuales: ${currentNotebooks.length}`);
    console.log(`   IDs: ${currentNotebooks.join(', ') || 'Ninguno'}`);
    console.log(`   Tipo de usuario: ${isSchoolUser ? 'Escolar' : 'Regular'}`);
    
    // 2. Verificar si el cuaderno ya está asignado
    if (currentNotebooks.includes(notebookId)) {
      console.log(`✅ El cuaderno ${notebookId} ya está asignado al usuario`);
      return;
    }
    
    // 3. Verificar que el cuaderno existe en la colección correcta
    const collection = isSchoolUser ? 'schoolNotebooks' : 'notebooks';
    const notebookDoc = await getDoc(doc(db, collection, notebookId));
    
    if (!notebookDoc.exists()) {
      console.log(`❌ El cuaderno ${notebookId} no existe en la colección ${collection}`);
      // Intentar en la otra colección
      const altCollection = isSchoolUser ? 'notebooks' : 'schoolNotebooks';
      const altNotebookDoc = await getDoc(doc(db, altCollection, notebookId));
      
      if (altNotebookDoc.exists()) {
        console.log(`⚠️ El cuaderno existe en la colección ${altCollection} pero el usuario es de tipo ${isSchoolUser ? 'escolar' : 'regular'}`);
      }
      return;
    }
    
    const notebookData = notebookDoc.data();
    console.log(`📓 Cuaderno encontrado: ${notebookData.name || notebookData.title || 'Sin nombre'}`);
    
    // 4. Agregar el cuaderno al usuario
    const updatedNotebooks = [...currentNotebooks, notebookId];
    
    await updateDoc(doc(db, 'users', userId), {
      idCuadernos: updatedNotebooks
    });
    
    console.log(`\n✅ Cuaderno asignado exitosamente`);
    console.log(`📚 Cuadernos actualizados: ${updatedNotebooks.length}`);
    console.log(`   IDs: ${updatedNotebooks.join(', ')}`);
    
    // 5. Verificar la actualización
    const updatedUserDoc = await getDoc(doc(db, 'users', userId));
    const updatedUserData = updatedUserDoc.data();
    
    if (updatedUserData?.idCuadernos?.includes(notebookId)) {
      console.log(`\n✅ Verificación exitosa: El cuaderno está correctamente asignado`);
    } else {
      console.log(`\n❌ Error: La asignación no se guardó correctamente`);
    }
    
  } catch (error) {
    console.error('❌ Error durante la reparación:', error);
  }
}

// Función para asignar múltiples cuadernos
async function assignMultipleNotebooks(userId: string, notebookIds: string[]) {
  console.log(`\n🔧 Asignando ${notebookIds.length} cuadernos al usuario: ${userId}\n`);
  
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    const userData = userDoc.data();
    const currentNotebooks = userData.idCuadernos || [];
    
    // Combinar cuadernos existentes con nuevos (sin duplicados)
    const allNotebooks = Array.from(new Set([...currentNotebooks, ...notebookIds]));
    
    await updateDoc(doc(db, 'users', userId), {
      idCuadernos: allNotebooks
    });
    
    console.log(`✅ ${allNotebooks.length} cuadernos asignados en total`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Función para agregar los cuadernos de Cultura General que faltan
async function fixCulturaGeneralNotebooks() {
  const userId = 'dTjO1PRNgRgvmOYItXhHseqpOY72';
  const culturaGeneralIds = [
    '81cT8Neg3UbL7jrWnbvg', // Cultura General I (ya está)
    'AyP46N6kMcZZPZxDGKZn', // Cultura General III
    'GcxpxBoE8vK8L8OhibcV'  // Cultura General II
  ];
  
  console.log('🔧 Agregando cuadernos de Cultura General faltantes...');
  await assignMultipleNotebooks(userId, culturaGeneralIds);
}

// Hacer las funciones disponibles en la consola
(window as any).fixUserNotebooks = fixUserNotebooks;
(window as any).assignMultipleNotebooks = assignMultipleNotebooks;
(window as any).fixCulturaGeneralNotebooks = fixCulturaGeneralNotebooks;

console.log('🛠️ Funciones de reparación cargadas:');
console.log('- fixUserNotebooks(userId, notebookId)');
console.log('- assignMultipleNotebooks(userId, [notebookId1, notebookId2, ...])');
console.log('- fixCulturaGeneralNotebooks() - Agrega los 3 cuadernos de Cultura General');

export { fixUserNotebooks, assignMultipleNotebooks, fixCulturaGeneralNotebooks };