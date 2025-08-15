// Script para asignar una materia a un estudiante
window.assignStudentToSubject = async function(subjectId) {
  console.log('🔧 Iniciando asignación de materia al estudiante...');
  
  try {
    const { auth, db } = window.firebaseServices || {};
    if (!auth || !db) {
      console.error('❌ Firebase no está inicializado');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    console.log('👤 Usuario actual:', user.uid);
    console.log('📚 Materia a asignar:', subjectId);

    // Si no se proporciona subjectId, mostrar las materias disponibles
    if (!subjectId) {
      console.log('📋 Buscando materias disponibles...');
      
      const { collection, getDocs } = await import('firebase/firestore');
      const subjectsSnapshot = await getDocs(collection(db, 'schoolSubjects'));
      
      console.log('📚 Materias disponibles:');
      subjectsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${doc.id}: ${data.nombre} (Profesor: ${data.idProfesor})`);
      });
      
      console.log('\n💡 Para asignar una materia, ejecuta:');
      console.log('   window.assignStudentToSubject("ID_DE_LA_MATERIA")');
      return;
    }

    // Actualizar el documento del estudiante
    const { doc, updateDoc, arrayUnion, getDoc } = await import('firebase/firestore');
    
    // Primero verificar el estado actual
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    
    console.log('📊 Estado actual del estudiante:', {
      email: userData.email,
      schoolRole: userData.schoolRole,
      idMaterias: userData.idMaterias || [],
      subjectIds: userData.subjectIds || [],
      idInstitucion: userData.idInstitucion,
      idEscuela: userData.idEscuela
    });

    // Obtener información de la materia para obtener la escuela
    const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
    if (!subjectDoc.exists()) {
      console.error('❌ La materia no existe');
      return;
    }
    
    const subjectData = subjectDoc.data();
    const schoolId = subjectData.idEscuela;
    
    console.log('🏫 Escuela de la materia:', schoolId);

    // Actualizar con la nueva materia Y la escuela
    const updateData = {
      idMaterias: arrayUnion(subjectId),
      subjectIds: arrayUnion(subjectId)  // Por compatibilidad
    };
    
    // Si el estudiante no tiene escuela, asignarla
    if (!userData.idInstitucion && !userData.idEscuela && schoolId) {
      updateData.idInstitucion = schoolId;
      updateData.idEscuela = schoolId;
      console.log('🏫 Asignando escuela al estudiante:', schoolId);
    }
    
    await updateDoc(doc(db, 'users', user.uid), updateData);

    console.log('✅ Materia asignada exitosamente');
    
    // Verificar el cambio
    const updatedDoc = await getDoc(doc(db, 'users', user.uid));
    const updatedData = updatedDoc.data();
    
    console.log('📊 Nuevo estado del estudiante:', {
      idMaterias: updatedData.idMaterias || [],
      subjectIds: updatedData.subjectIds || []
    });
    
    console.log('🎉 ¡Listo! Ahora deberías poder ver los exámenes de esta materia.');
    console.log('💡 Recarga la página para ver los cambios.');
    
  } catch (error) {
    console.error('❌ Error asignando materia:', error);
  }
};

window.listStudentSubjects = async function() {
  console.log('📋 Verificando materias del estudiante...');
  
  try {
    const { auth, db } = window.firebaseServices || {};
    if (!auth || !db) {
      console.error('❌ Firebase no está inicializado');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    const { doc, getDoc, collection, getDocs, where, query } = await import('firebase/firestore');
    
    // Obtener datos del estudiante
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    
    console.log('👤 Estudiante:', userData.email);
    console.log('📚 Materias asignadas (idMaterias):', userData.idMaterias || []);
    console.log('📚 Materias asignadas (subjectIds):', userData.subjectIds || []);
    
    // Si tiene materias, mostrar detalles
    const materias = userData.idMaterias || userData.subjectIds || [];
    if (materias.length > 0) {
      console.log('\n📖 Detalles de las materias:');
      for (const materiaId of materias) {
        try {
          const materiaDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
          if (materiaDoc.exists()) {
            const data = materiaDoc.data();
            console.log(`   - ${materiaId}: ${data.nombre}`);
          }
        } catch (e) {
          console.log(`   - ${materiaId}: [No se pudo obtener detalles]`);
        }
      }
    } else {
      console.log('\n⚠️ El estudiante no tiene materias asignadas');
      console.log('💡 Usa window.assignStudentToSubject() para ver las materias disponibles');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

window.fixStudentSchool = async function() {
  console.log('🏫 Arreglando escuela del estudiante...');
  
  try {
    const { auth, db } = window.firebaseServices || {};
    if (!auth || !db) {
      console.error('❌ Firebase no está inicializado');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    const { doc, updateDoc, getDoc } = await import('firebase/firestore');
    
    // Obtener datos del estudiante
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data();
    
    console.log('📊 Estado actual:', {
      email: userData.email,
      idInstitucion: userData.idInstitucion,
      idEscuela: userData.idEscuela,
      idMaterias: userData.idMaterias
    });
    
    // Si ya tiene escuela, no hacer nada
    if (userData.idInstitucion || userData.idEscuela) {
      console.log('✅ El estudiante ya tiene escuela asignada');
      return;
    }
    
    // Buscar la escuela desde las materias
    const materias = userData.idMaterias || userData.subjectIds || [];
    if (materias.length === 0) {
      console.error('❌ El estudiante no tiene materias asignadas');
      return;
    }
    
    // Obtener la primera materia y su escuela
    const firstMateriaId = materias[0];
    const materiaDoc = await getDoc(doc(db, 'schoolSubjects', firstMateriaId));
    
    if (!materiaDoc.exists()) {
      console.error('❌ No se pudo obtener información de la materia');
      return;
    }
    
    const materiaData = materiaDoc.data();
    const schoolId = materiaData.idEscuela;
    
    if (!schoolId) {
      console.error('❌ La materia no tiene escuela asignada');
      return;
    }
    
    console.log('🏫 Asignando escuela:', schoolId);
    
    // Actualizar el estudiante con la escuela
    await updateDoc(doc(db, 'users', user.uid), {
      idInstitucion: schoolId,
      idEscuela: schoolId
    });
    
    console.log('✅ Escuela asignada exitosamente');
    console.log('💡 Recarga la página para ver los cambios');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

console.log('🔧 Funciones disponibles:');
console.log('   - window.assignStudentToSubject() - Ver materias disponibles');
console.log('   - window.assignStudentToSubject("ID") - Asignar una materia específica');
console.log('   - window.listStudentSubjects() - Ver materias actuales del estudiante');
console.log('   - window.fixStudentSchool() - Asignar escuela automáticamente desde las materias');