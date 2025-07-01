import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Función de debug para verificar el acceso del Quiz a conceptos escolares
 */
export async function debugSchoolQuiz(notebookId?: string) {
  console.log('🔍 === DEBUG: School Quiz Access ===');
  
  try {
    // 1. Obtener información del usuario actual
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario actual:', {
      uid: currentUser.uid,
      email: currentUser.email
    });
    
    // 2. Buscar el perfil del usuario correctamente
    // Primero buscar por email para usuarios escolares
    const { collection, query, where, getDocs: getDocsImport } = await import('firebase/firestore');
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', currentUser.email)
    );
    
    const usersSnapshot = await getDocsImport(usersQuery);
    let userProfile = null;
    let actualUserId = currentUser.uid;
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      userProfile = userDoc.data();
      actualUserId = userDoc.id;
      console.log('✅ Usuario encontrado por email:', {
        documentId: actualUserId,
        email: userProfile.email,
        subscription: userProfile.subscription,
        schoolRole: userProfile.schoolRole
      });
    } else {
      // Si no se encuentra por email, buscar por UID
      const { getUserProfile } = await import('../services/userService');
      userProfile = await getUserProfile(currentUser.uid);
      console.log('📋 Perfil de usuario (por UID):', {
        subscription: userProfile?.subscription,
        schoolRole: userProfile?.schoolRole
      });
    }
    
    const isSchoolStudent = userProfile?.subscription?.toLowerCase() === 'school';
    console.log('🎓 Es usuario escolar:', isSchoolStudent);
    
    // 3. Determinar la colección correcta
    const conceptsCollection = isSchoolStudent ? 'schoolConcepts' : 'conceptos';
    console.log('📚 Colección a usar:', conceptsCollection);
    
    // 4. Si se proporciona un notebookId, buscar conceptos
    if (notebookId) {
      console.log(`\\n🔍 Buscando conceptos para cuaderno: ${notebookId}`);
      
      const conceptsQuery = query(
        collection(db, conceptsCollection),
        where('cuadernoId', '==', notebookId)
      );
      
      const conceptDocs = await getDocs(conceptsQuery);
      console.log(`📄 Documentos encontrados: ${conceptDocs.size}`);
      
      let totalConcepts = 0;
      const allConcepts: any[] = [];
      
      conceptDocs.forEach(doc => {
        const data = doc.data();
        const conceptosData = data.conceptos || [];
        totalConcepts += conceptosData.length;
        
        console.log(`\\n📄 Documento ${doc.id}:`);
        console.log(`   - Número de conceptos: ${conceptosData.length}`);
        console.log(`   - Usuario ID: ${data.usuarioId}`);
        console.log(`   - Cuaderno ID: ${data.cuadernoId}`);
        
        // Agregar conceptos a la lista
        conceptosData.forEach((concepto: any, index: number) => {
          allConcepts.push({
            id: `${doc.id}-${index}`,
            término: concepto.término,
            definición: concepto.definición,
            fuente: concepto.fuente
          });
        });
      });
      
      console.log(`\\n📊 Total de conceptos: ${totalConcepts}`);
      
      if (totalConcepts < 4) {
        console.log('❌ Insuficientes conceptos para generar quiz (se necesitan al menos 4)');
      } else {
        console.log('✅ Suficientes conceptos para generar quiz');
        console.log('\\n🎯 Primeros 5 conceptos:');
        allConcepts.slice(0, 5).forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.término}: ${c.definición.substring(0, 50)}...`);
        });
      }
    } else {
      console.log('\\n💡 Ejecuta esta función con un notebookId para ver los conceptos específicos');
      console.log('   Ejemplo: window.debugSchoolQuiz("gdJ3RvTKUfnAHrC1lbWY")');
    }
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  }
  
  console.log('\\n===========================================');
}

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).debugSchoolQuiz = debugSchoolQuiz;
}