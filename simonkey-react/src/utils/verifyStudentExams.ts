import { auth, db } from '../services/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

export const verifyStudentExams = async () => {
  console.log('🔍 === VERIFICACIÓN COMPLETA DE EXÁMENES PARA ESTUDIANTE ===');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return { success: false, error: 'No authenticated user' };
    }

    console.log('👤 Usuario:', user.email);
    console.log('🆔 UID:', user.uid);

    // 1. Verificar el perfil del usuario
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      console.log('❌ No se encontró el perfil del usuario');
      return { success: false, error: 'User profile not found' };
    }

    const userData = userDoc.data();
    console.log('\n📋 PERFIL DEL USUARIO:');
    console.log('   - Nombre:', userData.nombre);
    console.log('   - Email:', userData.email);
    console.log('   - Subscription:', userData.subscription);
    console.log('   - School Role:', userData.schoolRole);
    console.log('   - ID Escuela:', userData.idEscuela || '❌ NO ASIGNADA');
    console.log('   - ID Admin:', userData.idAdmin || '❌ NO ASIGNADO');
    console.log('   - Subject IDs:', userData.subjectIds || []);

    // 2. Verificar si es estudiante escolar
    const isSchoolStudent = userData.subscription === 'school' && userData.schoolRole === 'student';
    
    if (!isSchoolStudent) {
      console.log('⚠️ El usuario no es un estudiante escolar');
      return { success: false, error: 'User is not a school student' };
    }

    // 3. Verificar si tiene escuela asignada
    if (!userData.idEscuela) {
      console.log('\n❌ PROBLEMA DETECTADO: El estudiante no tiene escuela asignada');
      console.log('💡 SOLUCIÓN: Ejecuta window.fixStudentSchoolId() para asignar automáticamente la escuela del admin');
      return { 
        success: false, 
        error: 'Student has no school assigned',
        solution: 'Run window.fixStudentSchoolId() to fix this'
      };
    }

    // 4. Verificar la escuela
    const schoolDoc = await getDoc(doc(db, 'institutions', userData.idEscuela));
    if (!schoolDoc.exists()) {
      console.log('❌ La escuela asignada no existe en la base de datos');
      return { success: false, error: 'School does not exist' };
    }

    console.log('\n🏫 ESCUELA:');
    console.log('   - Nombre:', schoolDoc.data().nombre);
    console.log('   - ID:', schoolDoc.id);

    // 5. Verificar materias asignadas
    console.log('\n📚 MATERIAS ASIGNADAS:');
    if (!userData.subjectIds || userData.subjectIds.length === 0) {
      console.log('❌ El estudiante no tiene materias asignadas');
      return { success: false, error: 'No subjects assigned' };
    }

    // 6. Para cada materia, buscar exámenes
    console.log('\n📝 BUSCANDO EXÁMENES POR MATERIA:');
    let totalExams = 0;
    
    for (const subjectId of userData.subjectIds) {
      // Obtener información de la materia
      const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
      if (!subjectDoc.exists()) {
        console.log(`❌ Materia ${subjectId} no encontrada`);
        continue;
      }
      
      const subjectData = subjectDoc.data();
      console.log(`\n📚 Materia: ${subjectData.nombre} (${subjectId})`);
      
      // Buscar exámenes para esta materia
      try {
        // Consulta simple primero
        const allExamsQuery = query(
          collection(db, 'schoolExams'),
          where('idMateria', '==', subjectId)
        );
        
        const allExamsSnapshot = await getDocs(allExamsQuery);
        console.log(`   - Total exámenes en la materia: ${allExamsSnapshot.size}`);
        
        // Filtrar manualmente
        const activeExamsForSchool = allExamsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isActive === true && data.idEscuela === userData.idEscuela;
        });
        
        console.log(`   - Exámenes activos para tu escuela: ${activeExamsForSchool.length}`);
        
        activeExamsForSchool.forEach(examDoc => {
          const examData = examDoc.data();
          console.log(`      ✅ "${examData.title}" (ID: ${examDoc.id})`);
          totalExams++;
        });
        
      } catch (error) {
        console.error(`   ❌ Error buscando exámenes:`, error);
      }
    }

    console.log(`\n📊 RESUMEN: ${totalExams} exámenes activos encontrados en total`);
    
    if (totalExams === 0) {
      console.log('\n💡 POSIBLES RAZONES POR LAS QUE NO VES EXÁMENES:');
      console.log('   1. Los profesores no han creado exámenes para tus materias');
      console.log('   2. Los exámenes existentes no están marcados como activos');
      console.log('   3. Los exámenes fueron creados para otra escuela');
      console.log('\n💡 Pide a tu profesor que cree un examen para tu materia');
    }

    return { 
      success: true, 
      totalExams,
      userData,
      schoolId: userData.idEscuela
    };

  } catch (error) {
    console.error('❌ Error en verificación:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// Función rápida para verificar el estado actual
export const checkStudentStatus = async () => {
  const user = auth.currentUser;
  if (!user) {
    console.log('❌ No autenticado');
    return;
  }

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.data();
  
  console.log('📊 ESTADO ACTUAL:');
  console.log(`   Email: ${user.email}`);
  console.log(`   Escuela: ${userData?.idEscuela || '❌ NO ASIGNADA'}`);
  console.log(`   Rol: ${userData?.schoolRole || 'N/A'}`);
  console.log(`   Materias: ${userData?.subjectIds?.length || 0}`);
  
  if (!userData?.idEscuela) {
    console.log('\n🔧 Ejecuta window.fixStudentSchoolId() para asignar escuela');
  }
};

// Registrar funciones globalmente
if (typeof window !== 'undefined') {
  (window as any).verifyStudentExams = verifyStudentExams;
  (window as any).checkStudentStatus = checkStudentStatus;
  console.log('🔧 Funciones disponibles:');
  console.log('   - verifyStudentExams() - Verificación completa de exámenes');
  console.log('   - checkStudentStatus() - Estado rápido del estudiante');
}