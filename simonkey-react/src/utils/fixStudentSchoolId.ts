import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';

export const fixStudentSchoolId = async () => {
  console.log('🔧 === ARREGLAR ID ESCUELA DEL ESTUDIANTE ===');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }

    console.log('👤 Usuario:', user.email);
    console.log('🆔 UID:', user.uid);

    // 1. Obtener el perfil del usuario
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      console.log('❌ No se encontró el perfil del usuario');
      return;
    }

    const userData = userDoc.data();
    console.log('\n📋 Datos actuales del usuario:');
    console.log('   - Nombre:', userData.nombre);
    console.log('   - Subscription:', userData.subscription);
    console.log('   - School Role:', userData.schoolRole);
    console.log('   - ID Escuela:', userData.idEscuela || 'NO TIENE ⚠️');
    console.log('   - ID Admin:', userData.idAdmin || 'NO TIENE');

    // 2. Verificar si es estudiante escolar
    if (userData.subscription !== 'school' || userData.schoolRole !== 'student') {
      console.log('⚠️ El usuario no es un estudiante escolar');
      return;
    }

    // 3. Si ya tiene idEscuela, mostrar información
    if (userData.idEscuela) {
      console.log('✅ El estudiante ya tiene una escuela asignada:', userData.idEscuela);
      
      // Verificar que la escuela existe
      const schoolDoc = await getDoc(doc(db, 'institutions', userData.idEscuela));
      if (schoolDoc.exists()) {
        console.log('✅ La escuela existe:', schoolDoc.data().nombre);
      } else {
        console.log('❌ La escuela NO existe en la base de datos');
      }
      return;
    }

    // 4. Si no tiene idEscuela, intentar obtenerla del admin
    console.log('\n🔍 Buscando escuela del administrador...');
    
    if (!userData.idAdmin) {
      console.log('❌ El estudiante no tiene un administrador asignado');
      console.log('💡 Solución: Un administrador debe asignar al estudiante');
      return;
    }

    // Obtener datos del admin
    const adminDoc = await getDoc(doc(db, 'users', userData.idAdmin));
    if (!adminDoc.exists()) {
      console.log('❌ No se encontró el administrador');
      return;
    }

    const adminData = adminDoc.data();
    console.log('\n📋 Datos del administrador:');
    console.log('   - Nombre:', adminData.nombre);
    console.log('   - ID Institución:', adminData.idInstitucion || 'NO TIENE');

    if (!adminData.idInstitucion) {
      console.log('❌ El administrador no tiene una institución asignada');
      return;
    }

    // 5. Asignar la escuela del admin al estudiante
    console.log('\n🔧 Asignando escuela al estudiante...');
    await updateDoc(doc(db, 'users', user.uid), {
      idEscuela: adminData.idInstitucion
    });

    console.log('✅ Escuela asignada exitosamente:', adminData.idInstitucion);

    // 6. Verificar la asignación
    const updatedUserDoc = await getDoc(doc(db, 'users', user.uid));
    const updatedUserData = updatedUserDoc.data();
    console.log('\n📋 Datos actualizados del estudiante:');
    console.log('   - ID Escuela:', updatedUserData?.idEscuela);

    console.log('\n✅ Proceso completado. Recarga la página para ver los cambios.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// Función para buscar y listar todas las escuelas disponibles
export const listAvailableSchools = async () => {
  console.log('🏫 === ESCUELAS DISPONIBLES ===');
  
  try {
    const schoolsSnapshot = await getDocs(collection(db, 'institutions'));
    
    console.log(`📊 Total de escuelas encontradas: ${schoolsSnapshot.size}`);
    
    schoolsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. ${data.nombre}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   País: ${data.country || 'No especificado'}`);
      console.log(`   Estado: ${data.state || 'No especificado'}`);
    });
    
  } catch (error) {
    console.error('❌ Error listando escuelas:', error);
  }
};

// Registrar funciones globalmente
if (typeof window !== 'undefined') {
  (window as any).fixStudentSchoolId = fixStudentSchoolId;
  (window as any).listAvailableSchools = listAvailableSchools;
  console.log('🔧 Funciones disponibles en la consola:');
  console.log('   - fixStudentSchoolId() - Asigna automáticamente la escuela del admin al estudiante');
  console.log('   - listAvailableSchools() - Lista todas las escuelas disponibles');
}