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
 * Limpia documentos duplicados en schoolTeachers
 * Elimina documentos en schoolTeachers que correspondan a usuarios que ya existen en users
 */
export const cleanDuplicateSchoolTeachers = async (): Promise<{
  removed: number;
  errors: Array<{ id: string; error: string }>;
}> => {
  console.log('🧹 Iniciando limpieza de documentos duplicados en schoolTeachers...');
  
  const results = {
    removed: 0,
    errors: [] as Array<{ id: string; error: string }>
  };

  try {
    // Obtener todos los registros de schoolTeachers
    const teachersSnapshot = await getDocs(collection(db, 'schoolTeachers'));
    console.log(`📚 Encontrados ${teachersSnapshot.size} registros en schoolTeachers`);
    
    for (const teacherDoc of teachersSnapshot.docs) {
      const teacherData = teacherDoc.data();
      const teacherId = teacherDoc.id;
      
      try {
        console.log(`🔍 Verificando teacher: ${teacherData.nombre} (${teacherData.email})`);
        
        // Verificar si existe un usuario correspondiente en la colección users
        const userQuery = query(
          collection(db, 'users'),
          where('email', '==', teacherData.email)
        );
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          console.log(`✅ Usuario encontrado en users: ${teacherData.email}`);
          
          // Verificar si el usuario ya tiene schoolRole: 'teacher'
          const userData = userSnapshot.docs[0].data();
          if (userData.schoolRole === 'teacher') {
            console.log(`🗑️ Eliminando documento duplicado en schoolTeachers: ${teacherId}`);
            await deleteDoc(doc(db, 'schoolTeachers', teacherId));
            results.removed++;
            console.log(`✅ Documento eliminado: ${teacherId}`);
          } else {
            console.log(`⚠️ Usuario existe pero no tiene schoolRole: 'teacher': ${teacherData.email}`);
          }
        } else {
          console.log(`⚠️ No se encontró usuario correspondiente en users: ${teacherData.email}`);
        }
        
      } catch (error: any) {
        console.error(`❌ Error procesando teacher ${teacherId}:`, error);
        results.errors.push({
          id: teacherId,
          error: error.message
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error general en limpieza de schoolTeachers:', error);
  }
  
  console.log(`🎯 Limpieza completada: ${results.removed} documentos eliminados, ${results.errors.length} errores`);
  return results;
};

/**
 * Verifica el estado de las colecciones users y schoolTeachers
 */
export const checkCollectionsStatus = async () => {
  console.log('🔍 Verificando estado de las colecciones...');
  
  try {
    // Contar usuarios con schoolRole: 'teacher'
    const teacherUsersQuery = query(
      collection(db, 'users'),
      where('schoolRole', '==', 'teacher')
    );
    const teacherUsersSnapshot = await getDocs(teacherUsersQuery);
    console.log(`👨‍🏫 Usuarios con schoolRole: 'teacher': ${teacherUsersSnapshot.size}`);
    
    // Contar documentos en schoolTeachers
    const schoolTeachersSnapshot = await getDocs(collection(db, 'schoolTeachers'));
    console.log(`📚 Documentos en schoolTeachers: ${schoolTeachersSnapshot.size}`);
    
    // Mostrar detalles de usuarios con schoolRole: 'teacher'
    console.log('📋 Detalles de usuarios con schoolRole: teacher:');
    teacherUsersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.email}: ${data.nombre} (ID: ${doc.id})`);
    });
    
    // Mostrar detalles de schoolTeachers
    console.log('📋 Detalles de schoolTeachers:');
    schoolTeachersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.email}: ${data.nombre} (ID: ${doc.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error verificando colecciones:', error);
  }
}; 