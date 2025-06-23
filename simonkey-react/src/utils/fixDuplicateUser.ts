import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  deleteDoc,
  doc,
  query,
  where 
} from 'firebase/firestore';

/**
 * Elimina el documento duplicado específico del usuario rubenelhore23@gmail.com
 * que se creó con el ID incorrecto en la colección users
 */
export const fixRubenelhoreDuplicate = async (): Promise<{
  success: boolean;
  message: string;
  deletedId?: string;
}> => {
  console.log('🔧 Iniciando corrección específica para rubenelhore23@gmail.com...');
  
  try {
    // Buscar todos los documentos en users con el email rubenelhore23@gmail.com
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', 'rubenelhore23@gmail.com')
    );
    const usersSnapshot = await getDocs(usersQuery);
    
    console.log(`📚 Encontrados ${usersSnapshot.size} documentos en users con email rubenelhore23@gmail.com`);
    
    if (usersSnapshot.size === 0) {
      return {
        success: false,
        message: 'No se encontraron documentos con el email rubenelhore23@gmail.com'
      };
    }
    
    if (usersSnapshot.size === 1) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      console.log('✅ Solo hay un documento, verificando si es el correcto...');
      console.log('📋 Datos del documento:', {
        id: userDoc.id,
        email: userData.email,
        subscription: userData.subscription,
        schoolRole: userData.schoolRole
      });
      
      // Verificar si es el documento correcto (debe tener subscription: 'school' y schoolRole: 'teacher')
      if (userData.subscription === 'school' && userData.schoolRole === 'teacher') {
        return {
          success: true,
          message: 'El documento único es correcto, no hay duplicados que eliminar'
        };
      } else {
        return {
          success: false,
          message: `El documento único no tiene los datos correctos. subscription: ${userData.subscription}, schoolRole: ${userData.schoolRole}`
        };
      }
    }
    
    // Si hay múltiples documentos, identificar cuál eliminar
    console.log('🔍 Múltiples documentos encontrados, analizando...');
    
    const documents = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));
    
    console.log('📋 Documentos encontrados:');
    documents.forEach((doc, index) => {
      console.log(`   ${index + 1}. ID: ${doc.id}`);
      console.log(`      - subscription: ${doc.data.subscription}`);
      console.log(`      - schoolRole: ${doc.data.schoolRole}`);
      console.log(`      - createdAt: ${doc.data.createdAt}`);
      console.log(`      - updatedAt: ${doc.data.updatedAt}`);
    });
    
    // Identificar el documento correcto (el que tiene subscription: 'school' y schoolRole: 'teacher')
    const correctDoc = documents.find(doc => 
      doc.data.subscription === 'school' && doc.data.schoolRole === 'teacher'
    );
    
    if (!correctDoc) {
      return {
        success: false,
        message: 'No se encontró un documento correcto con subscription: school y schoolRole: teacher'
      };
    }
    
    // Identificar documentos a eliminar (todos excepto el correcto)
    const docsToDelete = documents.filter(doc => doc.id !== correctDoc.id);
    
    console.log(`🗑️ Eliminando ${docsToDelete.length} documentos duplicados...`);
    
    for (const docToDelete of docsToDelete) {
      console.log(`🗑️ Eliminando documento: ${docToDelete.id}`);
      await deleteDoc(doc(db, 'users', docToDelete.id));
      console.log(`✅ Documento eliminado: ${docToDelete.id}`);
    }
    
    return {
      success: true,
      message: `Corrección completada. Se eliminaron ${docsToDelete.length} documentos duplicados. El documento correcto (${correctDoc.id}) se mantiene.`,
      deletedId: docsToDelete.map(d => d.id).join(', ')
    };
    
  } catch (error: any) {
    console.error('❌ Error corrigiendo duplicado:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
};

/**
 * Verifica el estado actual del usuario rubenelhore23@gmail.com
 */
export const checkRubenelhoreStatus = async () => {
  console.log('🔍 Verificando estado de rubenelhore23@gmail.com...');
  
  try {
    // Buscar en users
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', 'rubenelhore23@gmail.com')
    );
    const usersSnapshot = await getDocs(usersQuery);
    
    console.log(`📚 Documentos en users: ${usersSnapshot.size}`);
    usersSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   ${index + 1}. ID: ${doc.id}`);
      console.log(`      - subscription: ${data.subscription}`);
      console.log(`      - schoolRole: ${data.schoolRole}`);
      console.log(`      - createdAt: ${data.createdAt}`);
    });
    
    // Buscar en schoolTeachers
    const teachersQuery = query(
      collection(db, 'schoolTeachers'),
      where('email', '==', 'rubenelhore23@gmail.com')
    );
    const teachersSnapshot = await getDocs(teachersQuery);
    
    console.log(`👨‍🏫 Documentos en schoolTeachers: ${teachersSnapshot.size}`);
    teachersSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   ${index + 1}. ID: ${doc.id}`);
      console.log(`      - nombre: ${data.nombre}`);
      console.log(`      - subscription: ${data.subscription}`);
    });
    
  } catch (error) {
    console.error('❌ Error verificando estado:', error);
  }
}; 