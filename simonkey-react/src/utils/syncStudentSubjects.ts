import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

export async function syncStudentSubjects(studentId: string) {
  console.log('🔧 === SINCRONIZANDO MATERIAS DEL ESTUDIANTE ===');
  console.log('📌 ID del estudiante:', studentId);
  
  try {
    // 1. Obtener el usuario
    const userDoc = await getDoc(doc(db, 'users', studentId));
    if (!userDoc.exists()) {
      console.error('❌ Usuario no encontrado');
      return;
    }
    
    const userData = userDoc.data();
    const currentSubjectIds = userData.subjectIds || [];
    const notebookIds = userData.idCuadernos || [];
    
    console.log('\n📚 Estado actual:');
    console.log('- Cuadernos asignados:', notebookIds.length);
    console.log('- Materias en subjectIds:', currentSubjectIds.length);
    
    // 2. Obtener todas las materias de los cuadernos
    const materiasFromNotebooks = new Set<string>();
    
    for (const notebookId of notebookIds) {
      const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
      if (notebookDoc.exists()) {
        const notebookData = notebookDoc.data();
        if (notebookData.idMateria) {
          materiasFromNotebooks.add(notebookData.idMateria);
          console.log(`\n📓 Cuaderno: ${notebookData.title}`);
          console.log(`   - idMateria: ${notebookData.idMateria}`);
        }
      }
    }
    
    // 3. Identificar materias faltantes
    const materiasToAdd = Array.from(materiasFromNotebooks).filter(
      materiaId => !currentSubjectIds.includes(materiaId)
    );
    
    console.log('\n📊 Análisis:');
    console.log(`- Materias encontradas en cuadernos: ${materiasFromNotebooks.size}`);
    console.log(`- Materias ya en subjectIds: ${currentSubjectIds.length}`);
    console.log(`- Materias por agregar: ${materiasToAdd.length}`);
    
    if (materiasToAdd.length > 0) {
      console.log('\n📚 Materias a agregar:', materiasToAdd);
      
      // 4. Actualizar el usuario con las materias faltantes
      await updateDoc(doc(db, 'users', studentId), {
        subjectIds: arrayUnion(...materiasToAdd)
      });
      
      console.log('\n✅ Materias sincronizadas exitosamente');
      
      // 5. Verificar la actualización
      const updatedUserDoc = await getDoc(doc(db, 'users', studentId));
      if (updatedUserDoc.exists()) {
        const updatedData = updatedUserDoc.data();
        console.log('\n📋 Estado actualizado:');
        console.log('- subjectIds:', updatedData.subjectIds);
      }
    } else {
      console.log('\n✅ Las materias ya están sincronizadas correctamente');
    }
    
    // 6. Mostrar resumen final
    console.log('\n💡 SIGUIENTE PASO:');
    console.log('Ejecuta forceUpdateSchoolKPIs para regenerar los KPIs con las materias correctas:');
    console.log(`await forceUpdateSchoolKPIs('${studentId}')`);
    
  } catch (error) {
    console.error('❌ Error sincronizando materias:', error);
  }
}

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).syncStudentSubjects = syncStudentSubjects;
}