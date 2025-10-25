import { db, auth } from '../services/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

async function verifyNotebookIds() {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    console.log('❌ No hay usuario autenticado');
    return;
  }
  
  console.log(`\n🔍 Verificando IDs de cuadernos para usuario: ${userId}\n`);
  
  try {
    // 1. Obtener cuadernos del usuario
    console.log('1️⃣ Buscando cuadernos del usuario...');
    
    // Buscar por userId
    const notebooksQuery = query(
      collection(db, 'notebooks'),
      where('userId', '==', userId)
    );
    const notebooksSnap = await getDocs(notebooksQuery);
    
    console.log(`\n📚 Cuadernos encontrados por userId: ${notebooksSnap.size}`);
    const notebookMap = new Map<string, string>();
    
    notebooksSnap.forEach(doc => {
      const data = doc.data();
      const name = data.title || data.name || 'Sin nombre';
      notebookMap.set(doc.id, name);
      console.log(`   - ${doc.id}: ${name}`);
    });
    
    // 2. Obtener cuadernos asignados (idCuadernos)
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const idCuadernos = userData.idCuadernos || [];
      
      console.log(`\n📋 Cuadernos en idCuadernos: ${idCuadernos.length}`);
      for (const cuadernoId of idCuadernos) {
        const notebookDoc = await getDoc(doc(db, 'notebooks', cuadernoId));
        if (notebookDoc.exists()) {
          const data = notebookDoc.data();
          const name = data.title || data.name || 'Sin nombre';
          console.log(`   - ${cuadernoId}: ${name}`);
          notebookMap.set(cuadernoId, name);
        }
      }
    }
    
    // 3. Verificar qué cuaderno tiene el ID con juegos
    console.log(`\n🎮 Buscando cuaderno con ID: 81cT8Neg3UbL7jrWnbvg`);
    const targetDoc = await getDoc(doc(db, 'notebooks', '81cT8Neg3UbL7jrWnbvg'));
    if (targetDoc.exists()) {
      const data = targetDoc.data();
      console.log(`✅ Encontrado: ${data.title || data.name || 'Sin nombre'}`);
      console.log(`   - userId: ${data.userId}`);
      console.log(`   - Tu userId: ${userId}`);
      console.log(`   - ¿Coinciden?: ${data.userId === userId ? 'SÍ' : 'NO'}`);
    } else {
      console.log('❌ No se encontró este cuaderno');
    }
    
    // 4. Buscar todos los cuadernos que contengan "Cultura General"
    console.log(`\n🔍 Buscando cuadernos con "Cultura General"...`);
    for (const [id, name] of notebookMap) {
      if (name.toLowerCase().includes('cultura general')) {
        console.log(`   - ${id}: ${name}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Hacer la función disponible en la consola
(window as any).verifyNotebookIds = verifyNotebookIds;

console.log('🛠️ Script cargado. Ejecuta verifyNotebookIds() en la consola.');

export default verifyNotebookIds;