import { auth, db } from '../services/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

export const debugStudentMaterias = async () => {
  console.log('🔍 === DIAGNÓSTICO DE MATERIAS Y EXÁMENES PARA ESTUDIANTE ===');
  
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
    console.log('   - ID Escuela:', userData.idEscuela || userData.schoolData?.idEscuela || 'NO TIENE ESCUELA ASIGNADA ⚠️');
    console.log('   - ID Institución:', userData.idInstitucion || 'NO TIENE');
    console.log('   - ID Admin:', userData.idAdmin || 'NO TIENE');

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

    // 7. Verificar exámenes para cada materia
    console.log('\n📝 VERIFICANDO EXÁMENES POR MATERIA:');
    const studentSchoolId = userData.idEscuela || userData.schoolData?.idEscuela;
    
    if (!studentSchoolId) {
      console.log('❌ No se pueden buscar exámenes: el estudiante no tiene escuela asignada');
      console.log('💡 Solución: Un administrador debe asignar la escuela al estudiante (campo idEscuela)');
    } else if (userData.subjectIds && userData.subjectIds.length > 0) {
      for (const subjectId of userData.subjectIds) {
        try {
          // Buscar exámenes para esta materia
          console.log(`\n🔍 Buscando exámenes para materia ${subjectId}:`);
          
          // Primero verificar si la materia existe
          const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
          if (!subjectDoc.exists()) {
            console.log(`   ❌ La materia ${subjectId} no existe`);
            continue;
          }
          
          const subjectData = subjectDoc.data();
          console.log(`   📚 Materia: ${subjectData.nombre}`);
          
          // Buscar exámenes activos
          const examsQuery = query(
            collection(db, 'schoolExams'),
            where('idMateria', '==', subjectId),
            where('idEscuela', '==', studentSchoolId),
            where('isActive', '==', true)
          );
          
          console.log(`   🔍 Consultando con filtros:`);
          console.log(`      - idMateria: ${subjectId}`);
          console.log(`      - idEscuela: ${studentSchoolId}`);
          console.log(`      - isActive: true`);
          
          const examsSnapshot = await getDocs(examsQuery);
          console.log(`   📊 Exámenes encontrados: ${examsSnapshot.size}`);
          
          if (examsSnapshot.size > 0) {
            examsSnapshot.docs.forEach(examDoc => {
              const examData = examDoc.data();
              console.log(`      ✅ Examen: ${examData.title} (ID: ${examDoc.id})`);
              console.log(`         - Profesor: ${examData.idProfesor}`);
              console.log(`         - Creado: ${examData.createdAt?.toDate?.()?.toLocaleString() || 'Sin fecha'}`);
            });
          }
        } catch (error: any) {
          console.log(`   ❌ Error buscando exámenes para ${subjectId}:`, error.message);
          if (error.code === 'failed-precondition') {
            console.log('   🔧 Se requiere crear un índice compuesto en Firestore');
            console.log('   🔧 Campos: idMateria, idEscuela, isActive, createdAt');
          }
        }
      }
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