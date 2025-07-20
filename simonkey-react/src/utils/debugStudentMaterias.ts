import { auth, db } from '../services/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

export const debugStudentMaterias = async () => {
  console.log('🔍 === DIAGNÓSTICO DE MATERIAS PARA ESTUDIANTE ===');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }

    console.log('👤 Usuario:', user.email);
    console.log('🆔 UID:', user.uid);

    // 1. Verificar el perfil del usuario
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      console.log('❌ No se encontró el perfil del usuario');
      return;
    }

    const userData = userDoc.data();
    console.log('\n📋 Datos del perfil:');
    console.log('   - Nombre:', userData.nombre);
    console.log('   - Subscription:', userData.subscription);
    console.log('   - School Role:', userData.schoolRole);
    console.log('   - Subject IDs:', userData.subjectIds);
    console.log('   - ID Cuadernos:', userData.idCuadernos);

    // 2. Verificar si es estudiante escolar
    if (userData.subscription !== 'school' || userData.schoolRole !== 'student') {
      console.log('⚠️ El usuario no es un estudiante escolar');
      return;
    }

    // 3. Verificar las materias asignadas
    console.log('\n📚 VERIFICANDO MATERIAS ASIGNADAS:');
    if (!userData.subjectIds || userData.subjectIds.length === 0) {
      console.log('❌ El estudiante no tiene materias asignadas (subjectIds vacío)');
      console.log('💡 Solución: Un administrador debe asignar materias al estudiante');
      return;
    }

    console.log(`✅ El estudiante tiene ${userData.subjectIds.length} materias asignadas`);

    // 4. Intentar cargar cada materia
    console.log('\n🔍 Verificando cada materia:');
    for (const subjectId of userData.subjectIds) {
      try {
        const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
        if (subjectDoc.exists()) {
          const subjectData = subjectDoc.data();
          console.log(`   ✅ ${subjectId}: ${subjectData.nombre} (${subjectData.color || '#6147FF'})`);
        } else {
          console.log(`   ❌ ${subjectId}: No encontrada en schoolSubjects`);
        }
      } catch (error) {
        console.log(`   ❌ ${subjectId}: Error al cargar - ${error}`);
      }
    }

    // 5. Verificar los cuadernos asignados
    console.log('\n📖 VERIFICANDO CUADERNOS ASIGNADOS:');
    if (!userData.idCuadernos || userData.idCuadernos.length === 0) {
      console.log('⚠️ El estudiante no tiene cuadernos asignados (idCuadernos vacío)');
    } else {
      console.log(`✅ El estudiante tiene ${userData.idCuadernos.length} cuadernos asignados`);
      
      for (const notebookId of userData.idCuadernos) {
        try {
          const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
          if (notebookDoc.exists()) {
            const notebookData = notebookDoc.data();
            console.log(`   ✅ ${notebookId}: ${notebookData.title}`);
          } else {
            console.log(`   ❌ ${notebookId}: No encontrado en schoolNotebooks`);
          }
        } catch (error) {
          console.log(`   ❌ ${notebookId}: Error al cargar - ${error}`);
        }
      }
    }

    // 6. Verificar permisos de Firebase
    console.log('\n🔐 VERIFICANDO PERMISOS:');
    try {
      // Intentar leer la colección schoolSubjects
      const subjectsSnapshot = await getDocs(collection(db, 'schoolSubjects'));
      console.log(`   ✅ Puede leer schoolSubjects (${subjectsSnapshot.size} documentos)`);
    } catch (error) {
      console.log('   ❌ No puede leer schoolSubjects:', error);
    }

    try {
      // Intentar leer la colección schoolNotebooks
      const notebooksSnapshot = await getDocs(collection(db, 'schoolNotebooks'));
      console.log(`   ✅ Puede leer schoolNotebooks (${notebooksSnapshot.size} documentos)`);
    } catch (error) {
      console.log('   ❌ No puede leer schoolNotebooks:', error);
    }

    console.log('\n✅ Diagnóstico completado');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
};

// Registrar función globalmente
if (typeof window !== 'undefined') {
  (window as any).debugStudentMaterias = debugStudentMaterias;
  console.log('🔧 Función debugStudentMaterias() disponible en la consola');
}