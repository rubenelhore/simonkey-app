import { db } from '../services/firebase';
import { collection, getDocs, query, where, doc, getDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Limpia los notebooks huérfanos (que tienen materiaId pero la materia no existe)
 */
export const cleanOrphanNotebooks = async (userId: string) => {
  try {
    console.log('🧹 Iniciando limpieza de cuadernos huérfanos...');
    
    // 1. Obtener todos los notebooks del usuario
    const notebooksQuery = query(
      collection(db, 'notebooks'),
      where('userId', '==', userId)
    );
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    let orphanCount = 0;
    let cleanedCount = 0;
    
    // 2. Verificar cada notebook
    for (const notebookDoc of notebooksSnapshot.docs) {
      const notebookData = notebookDoc.data();
      
      // Si el notebook tiene materiaId, verificar si la materia existe
      if (notebookData.materiaId) {
        const materiaRef = doc(db, 'materias', notebookData.materiaId);
        const materiaDoc = await getDoc(materiaRef);
        
        if (!materiaDoc.exists()) {
          orphanCount++;
          console.log(`📓 Cuaderno huérfano encontrado: ${notebookData.title} (materiaId: ${notebookData.materiaId})`);
          
          // Opción 1: Eliminar el notebook huérfano
          // await deleteDoc(doc(db, 'notebooks', notebookDoc.id));
          // console.log(`❌ Cuaderno eliminado: ${notebookData.title}`);
          
          // Opción 2: Quitar el materiaId para que aparezca sin materia
          await updateDoc(doc(db, 'notebooks', notebookDoc.id), {
            materiaId: null,
            updatedAt: serverTimestamp()
          });
          console.log(`✅ Cuaderno desasociado de materia inexistente: ${notebookData.title}`);
          
          cleanedCount++;
        }
      }
    }
    
    console.log(`🧹 Limpieza completada:`);
    console.log(`   - Cuadernos huérfanos encontrados: ${orphanCount}`);
    console.log(`   - Cuadernos limpiados: ${cleanedCount}`);
    
    return {
      orphanCount,
      cleanedCount
    };
    
  } catch (error) {
    console.error('❌ Error en limpieza de cuadernos huérfanos:', error);
    throw error;
  }
};

/**
 * Función para ejecutar manualmente desde la consola
 */
export const runOrphanCleanup = async () => {
  const { auth } = await import('../services/firebase');
  const user = auth.currentUser;
  
  if (!user) {
    console.error('❌ No hay usuario autenticado');
    return;
  }
  
  console.log('🧹 Ejecutando limpieza de cuadernos huérfanos para usuario:', user.uid);
  
  try {
    const result = await cleanOrphanNotebooks(user.uid);
    
    if (result.cleanedCount > 0) {
      alert(`✅ Limpieza completada!\n\nCuadernos huérfanos limpiados: ${result.cleanedCount}`);
      window.location.reload();
    } else {
      alert('✅ No se encontraron cuadernos huérfanos');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error durante la limpieza. Revisa la consola para más detalles.');
  }
};

// Exponer función globalmente para uso en desarrollo
if (process.env.NODE_ENV === 'development') {
  (window as any).cleanOrphanNotebooks = runOrphanCleanup;
  console.log('💡 Función de limpieza disponible: window.cleanOrphanNotebooks()');
}