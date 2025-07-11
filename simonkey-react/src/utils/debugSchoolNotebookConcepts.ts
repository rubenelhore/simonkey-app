import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function debugSchoolNotebookConcepts(notebookId: string) {
  console.log('🔍 === DEBUGGING CONCEPTOS EN CUADERNO ESCOLAR ===');
  console.log('📌 ID del cuaderno:', notebookId);
  
  try {
    // 1. Obtener el cuaderno
    const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
    
    if (!notebookDoc.exists()) {
      console.error('❌ Cuaderno no encontrado');
      return;
    }
    
    const notebookData = notebookDoc.data();
    console.log('\n📚 Datos del cuaderno:');
    console.log('- Título:', notebookData.title);
    console.log('- idMateria:', notebookData.idMateria);
    console.log('- conceptsCount:', notebookData.conceptsCount);
    console.log('- numeroConceptos:', notebookData.numeroConceptos);
    console.log('- totalConcepts:', notebookData.totalConcepts);
    console.log('- Todos los campos:', Object.keys(notebookData));
    
    // 2. Buscar en colección conceptos
    console.log('\n📚 Buscando en colección conceptos...');
    const conceptsQuery = query(
      collection(db, 'conceptos'),
      where('cuadernoId', '==', notebookId)
    );
    const conceptsSnap = await getDocs(conceptsQuery);
    console.log(`📊 Documentos encontrados en conceptos: ${conceptsSnap.size}`);
    
    let totalConceptsInCollection = 0;
    conceptsSnap.forEach(doc => {
      const data = doc.data();
      if (data.conceptos && Array.isArray(data.conceptos)) {
        totalConceptsInCollection += data.conceptos.length;
        console.log(`- Doc ${doc.id}: ${data.conceptos.length} conceptos`);
      }
    });
    console.log(`📊 Total de conceptos en colección: ${totalConceptsInCollection}`);
    
    // 3. Buscar en subcolección del cuaderno
    console.log('\n📚 Buscando en subcolección del cuaderno...');
    try {
      const notebookConceptsRef = collection(db, 'schoolNotebooks', notebookId, 'concepts');
      const notebookConceptsSnap = await getDocs(notebookConceptsRef);
      console.log(`📊 Documentos en subcolección: ${notebookConceptsSnap.size}`);
      
      notebookConceptsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`- Concepto ${doc.id}:`, {
          titulo: data.titulo || data.title,
          descripcion: data.descripcion?.substring(0, 50) + '...'
        });
      });
    } catch (error) {
      console.log('❌ No hay subcolección de conceptos o error al acceder');
    }
    
    // 4. Sugerencias
    console.log('\n💡 ANÁLISIS:');
    if (notebookData.conceptsCount) {
      console.log(`✅ El cuaderno tiene conceptsCount: ${notebookData.conceptsCount}`);
    } else if (totalConceptsInCollection > 0) {
      console.log(`⚠️ Hay ${totalConceptsInCollection} conceptos en la colección pero el cuaderno no tiene conceptsCount`);
    } else {
      console.log('❌ No se encontraron conceptos ni campo conceptsCount');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).debugSchoolNotebookConcepts = debugSchoolNotebookConcepts;
}