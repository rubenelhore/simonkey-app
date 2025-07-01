import { db } from '../services/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

/**
 * Corrige el mapeo de materias que están usando Firebase UID en lugar del Document ID
 */
export async function fixTeacherSubjectsMapping() {
  console.log('🔧 === CORRECCIÓN DE MAPEO DE MATERIAS ===');
  console.log('=========================================');
  
  const FIREBASE_UID = 'eLIAl0biR0fB01hKcgv1MH1CX2q1';
  const DOCUMENT_ID = 'school_1751333776472_ia0ly5vle';
  
  try {
    // 1. Buscar materias que usan el Firebase UID
    console.log('🔍 Buscando materias con Firebase UID...');
    const subjectsQuery = query(
      collection(db, 'schoolSubjects'),
      where('idProfesor', '==', FIREBASE_UID)
    );
    
    const subjectsSnapshot = await getDocs(subjectsQuery);
    console.log(`📊 Materias encontradas con Firebase UID: ${subjectsSnapshot.size}`);
    
    if (subjectsSnapshot.size === 0) {
      console.log('✅ No hay materias con Firebase UID. Verificando con Document ID...');
      
      // Verificar si ya están correctamente mapeadas
      const correctSubjectsQuery = query(
        collection(db, 'schoolSubjects'),
        where('idProfesor', '==', DOCUMENT_ID)
      );
      
      const correctSubjects = await getDocs(correctSubjectsQuery);
      console.log(`📊 Materias con Document ID correcto: ${correctSubjects.size}`);
      
      if (correctSubjects.size > 0) {
        console.log('✅ Las materias ya están correctamente configuradas');
        correctSubjects.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`   ${index + 1}. ${data.nombre} (ID: ${doc.id})`);
        });
      } else {
        console.log('⚠️ No hay materias asignadas al profesor');
        console.log('   El administrador debe asignar materias al profesor');
      }
      
      return;
    }
    
    // 2. Actualizar cada materia para usar el Document ID
    console.log('\n🔄 Actualizando materias...');
    const updatePromises = subjectsSnapshot.docs.map(async (subjectDoc) => {
      const data = subjectDoc.data();
      console.log(`   - Actualizando: ${data.nombre} (${subjectDoc.id})`);
      
      await updateDoc(doc(db, 'schoolSubjects', subjectDoc.id), {
        idProfesor: DOCUMENT_ID
      });
      
      return { id: subjectDoc.id, nombre: data.nombre };
    });
    
    const updatedSubjects = await Promise.all(updatePromises);
    
    console.log('\n✅ Materias actualizadas exitosamente:');
    updatedSubjects.forEach((subject, index) => {
      console.log(`   ${index + 1}. ${subject.nombre} (ID: ${subject.id})`);
    });
    
    console.log('\n🎯 Corrección completada');
    console.log('   Las materias ahora usan el Document ID correcto');
    console.log('   Recarga la página para ver los cambios');
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
  }
}

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).fixTeacherSubjectsMapping = fixTeacherSubjectsMapping;
}