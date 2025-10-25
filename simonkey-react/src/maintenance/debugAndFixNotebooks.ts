import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';

async function debugAndFixNotebooks(userId: string = 'dTjO1PRNgRgvmOYItXhHseqpOY72') {
  console.log(`\n🔍 Analizando y reparando cuadernos para usuario: ${userId}\n`);
  
  try {
    // 1. Obtener datos del usuario
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    const userData = userDoc.data();
    const currentNotebooks = userData.idCuadernos || [];
    const isSchoolUser = userData.subscription === 'school';
    
    console.log(`👤 Usuario: ${userData.nombre || userData.email}`);
    console.log(`📚 Cuadernos actuales: ${currentNotebooks.length}`);
    console.log(`   IDs: ${currentNotebooks.join(', ') || 'Ninguno'}`);
    console.log(`   Tipo de usuario: ${isSchoolUser ? 'Escolar' : 'Regular'}`);
    
    // 2. Verificar datos de juegos
    const gamePointsDoc = await getDoc(doc(db, 'gamePoints', userId));
    
    if (gamePointsDoc.exists()) {
      const gameData = gamePointsDoc.data();
      const notebookPoints = gameData.notebookPoints || {};
      
      console.log(`\n🎮 Datos de juegos encontrados:`);
      console.log(`   Cuadernos con juegos: ${Object.keys(notebookPoints).length}`);
      
      for (const [notebookId, data] of Object.entries(notebookPoints)) {
        const pointsHistory = (data as any).pointsHistory || [];
        console.log(`   📓 ${notebookId}: ${pointsHistory.length} juegos`);
      }
    }
    
    // 3. Buscar cuadernos en ambas colecciones
    const notebooksToCheck = ['81cT8Neg3UbL7jrWnbvg', 'AyP46N6kMcZZPZxDGKZn', 'GcxpxBoE8vK8L8OhibcV'];
    
    console.log(`\n🔎 Verificando existencia de cuadernos...`);
    
    for (const notebookId of notebooksToCheck) {
      console.log(`\n📓 Verificando: ${notebookId}`);
      
      // Verificar en notebooks
      const regularNotebook = await getDoc(doc(db, 'notebooks', notebookId));
      if (regularNotebook.exists()) {
        const data = regularNotebook.data();
        console.log(`   ✅ Encontrado en 'notebooks': ${data.name || data.title || 'Sin nombre'}`);
      }
      
      // Verificar en schoolNotebooks
      const schoolNotebook = await getDoc(doc(db, 'schoolNotebooks', notebookId));
      if (schoolNotebook.exists()) {
        const data = schoolNotebook.data();
        console.log(`   ✅ Encontrado en 'schoolNotebooks': ${data.name || data.title || 'Sin nombre'}`);
      }
      
      if (!regularNotebook.exists() && !schoolNotebook.exists()) {
        console.log(`   ❌ No encontrado en ninguna colección`);
      }
    }
    
    // 4. Preguntar si se deben agregar los cuadernos
    console.log(`\n💡 Recomendación:`);
    if (currentNotebooks.length === 0 && isSchoolUser) {
      console.log(`   El usuario es escolar pero no tiene cuadernos asignados.`);
      console.log(`   Se recomienda agregar los cuadernos de Cultura General.`);
      console.log(`\n   Para agregar los cuadernos, ejecuta:`);
      console.log(`   window.addCulturaGeneralNotebooks()`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Función para agregar los cuadernos de Cultura General
async function addCulturaGeneralNotebooks(userId: string = 'dTjO1PRNgRgvmOYItXhHseqpOY72') {
  const culturaGeneralIds = [
    '81cT8Neg3UbL7jrWnbvg', // Cultura General I
    'AyP46N6kMcZZPZxDGKZn', // Cultura General III
    'GcxpxBoE8vK8L8OhibcV'  // Cultura General II
  ];
  
  console.log('🔧 Agregando cuadernos de Cultura General...');
  
  try {
    await updateDoc(doc(db, 'users', userId), {
      idCuadernos: culturaGeneralIds
    });
    
    console.log('✅ Cuadernos agregados exitosamente');
    
    // Verificar
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    console.log(`📚 Cuadernos actualizados: ${userData?.idCuadernos?.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Hacer las funciones disponibles en la consola
(window as any).debugAndFixNotebooks = debugAndFixNotebooks;
(window as any).addCulturaGeneralNotebooks = addCulturaGeneralNotebooks;

console.log('🛠️ Funciones de depuración cargadas:');
console.log('- debugAndFixNotebooks() - Analiza el estado actual');
console.log('- addCulturaGeneralNotebooks() - Agrega los 3 cuadernos de Cultura General');

export { debugAndFixNotebooks, addCulturaGeneralNotebooks };