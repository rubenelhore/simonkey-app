import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Función de debug para verificar el acceso de estudiantes escolares a conceptos
 */
export async function debugSchoolStudentStudy() {
  console.log('🔍 === DEBUG: School Student Study Access ===');
  
  try {
    // 1. Obtener información del usuario actual
    const { auth } = await import('../services/firebase');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario actual:', {
      uid: currentUser.uid,
      email: currentUser.email
    });
    
    // 2. Obtener perfil del usuario
    const { getUserProfile } = await import('../services/userService');
    const userProfile = await getUserProfile(currentUser.uid);
    
    console.log('📋 Perfil de usuario:', {
      id: userProfile?.id,
      subscription: userProfile?.subscription,
      schoolRole: userProfile?.schoolRole,
      email: userProfile?.email
    });
    
    // 3. Verificar si es estudiante escolar
    const isSchoolStudent = userProfile?.subscription?.toLowerCase() === 'school' && 
                           userProfile?.schoolRole?.toLowerCase() === 'student';
    
    console.log('🎓 Es estudiante escolar:', isSchoolStudent);
    
    if (!isSchoolStudent) {
      console.log('⚠️ El usuario no es un estudiante escolar');
      return;
    }
    
    // 4. Buscar cuadernos asignados
    console.log('\\n📚 Buscando cuadernos asignados...');
    
    if (userProfile?.idCuadernos && userProfile.idCuadernos.length > 0) {
      console.log('✅ Cuadernos asignados:', userProfile.idCuadernos);
      
      // 5. Para cada cuaderno, buscar conceptos
      for (const notebookId of userProfile.idCuadernos) {
        console.log(`\\n🔍 Buscando conceptos para cuaderno: ${notebookId}`);
        
        // Buscar en schoolConcepts
        const conceptsQuery = query(
          collection(db, 'schoolConcepts'),
          where('cuadernoId', '==', notebookId)
        );
        
        const conceptsSnapshot = await getDocs(conceptsQuery);
        
        if (!conceptsSnapshot.empty) {
          console.log(`✅ Encontrados ${conceptsSnapshot.size} documentos de conceptos`);
          
          let totalConcepts = 0;
          conceptsSnapshot.forEach(doc => {
            const data = doc.data();
            const conceptCount = data.conceptos?.length || 0;
            totalConcepts += conceptCount;
            console.log(`   - Documento ${doc.id}: ${conceptCount} conceptos`);
          });
          
          console.log(`📊 Total de conceptos en el cuaderno: ${totalConcepts}`);
        } else {
          console.log('❌ No se encontraron conceptos para este cuaderno');
        }
      }
    } else {
      console.log('❌ No hay cuadernos asignados al estudiante');
    }
    
    // 6. Verificar hook useStudyService
    console.log('\\n🔧 Verificando hook useStudyService...');
    console.log('El hook debería detectar isSchoolStudent = true');
    console.log('Y buscar conceptos en la colección "schoolConcepts"');
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  }
  
  console.log('\\n===========================================');
}

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).debugSchoolStudentStudy = debugSchoolStudentStudy;
}