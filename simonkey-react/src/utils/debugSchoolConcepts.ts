import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

async function debugSchoolConcepts() {
  console.log('🔍 === DEBUG SCHOOL CONCEPTS ===');
  
  const notebookId = 'E0tGPuHSBztnS5tRm0QZ'; // Un ID de ejemplo de la consola
  
  try {
    // 1. Verificar el notebook
    console.log('1️⃣ Verificando notebook:', notebookId);
    const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
    if (notebookDoc.exists()) {
      console.log('✅ Notebook encontrado:', notebookDoc.data());
    } else {
      console.log('❌ Notebook no encontrado en schoolNotebooks');
    }
    
    // 2. Buscar conceptos con notebookId
    console.log('\n2️⃣ Buscando conceptos con notebookId...');
    const q1 = query(
      collection(db, 'schoolConcepts'),
      where('notebookId', '==', notebookId)
    );
    const snapshot1 = await getDocs(q1);
    console.log(`Documentos encontrados con notebookId: ${snapshot1.size}`);
    
    // 3. Buscar conceptos con cuadernoId
    console.log('\n3️⃣ Buscando conceptos con cuadernoId...');
    const q2 = query(
      collection(db, 'schoolConcepts'),
      where('cuadernoId', '==', notebookId)
    );
    const snapshot2 = await getDocs(q2);
    console.log(`Documentos encontrados con cuadernoId: ${snapshot2.size}`);
    
    // 4. Obtener TODOS los documentos de schoolConcepts (limitado a 5)
    console.log('\n4️⃣ Obteniendo muestra de documentos en schoolConcepts...');
    const allDocsQuery = query(collection(db, 'schoolConcepts'));
    const allDocsSnapshot = await getDocs(allDocsQuery);
    console.log(`Total de documentos en schoolConcepts: ${allDocsSnapshot.size}`);
    
    // Mostrar estructura de los primeros 3 documentos
    let count = 0;
    allDocsSnapshot.forEach(doc => {
      if (count < 3) {
        console.log(`\n📄 Documento ${doc.id}:`);
        const data = doc.data();
        console.log('Campos:', Object.keys(data));
        console.log('Datos:', data);
        count++;
      }
    });
    
    // 5. Verificar si los conceptos están en el documento del notebook mismo
    console.log('\n5️⃣ Verificando si los conceptos están en el documento del notebook...');
    const notebookWithConcepts = await getDoc(doc(db, 'schoolNotebooks', notebookId));
    if (notebookWithConcepts.exists()) {
      const data = notebookWithConcepts.data();
      if (data.concepts || data.conceptos) {
        console.log('✅ Conceptos encontrados en el notebook:', {
          concepts: data.concepts?.length || 0,
          conceptos: data.conceptos?.length || 0
        });
      } else {
        console.log('❌ No hay conceptos en el documento del notebook');
      }
    }
    
    // 6. Buscar en la colección regular de conceptos
    console.log('\n6️⃣ Buscando en colección regular de conceptos...');
    const q3 = query(
      collection(db, 'conceptos'),
      where('cuadernoId', '==', notebookId)
    );
    const snapshot3 = await getDocs(q3);
    console.log(`Documentos encontrados en conceptos: ${snapshot3.size}`);
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  }
  
  console.log('\n🔍 === FIN DEBUG ===');
}

// Hacer la función disponible globalmente
(window as any).debugSchoolConcepts = debugSchoolConcepts;

console.log('🔧 Función debugSchoolConcepts() disponible en la consola');

export { debugSchoolConcepts };