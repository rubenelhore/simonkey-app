import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export async function diagnoseAdminUsers() {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    console.log('🔍 Diagnosticando usuarios del admin...');
    console.log('👤 Admin actual:', currentUser.uid);

    // 1. Verificar el perfil del admin
    const adminDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const adminData = adminDoc.data();
    console.log('📋 Perfil del admin:', {
      id: currentUser.uid,
      email: adminData?.email,
      schoolRole: adminData?.schoolRole,
      idInstitucion: adminData?.idInstitucion,
      schoolName: adminData?.schoolName
    });

    if (adminData?.schoolRole !== 'admin') {
      console.error('❌ El usuario actual no es un admin escolar');
      return;
    }

    // 2. Buscar estudiantes con idAdmin
    console.log('\n📚 Buscando estudiantes con idAdmin...');
    const studentsWithAdminQuery = query(
      collection(db, 'users'),
      where('idAdmin', '==', currentUser.uid),
      where('schoolRole', '==', 'student')
    );
    const studentsWithAdmin = await getDocs(studentsWithAdminQuery);
    console.log(`✅ Estudiantes con idAdmin correcto: ${studentsWithAdmin.size}`);
    studentsWithAdmin.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.email} (${data.displayName || data.nombre})`);
    });

    // 3. Buscar estudiantes sin idAdmin pero con la misma institución
    console.log('\n🔍 Buscando estudiantes sin idAdmin...');
    const allStudentsQuery = query(
      collection(db, 'users'),
      where('schoolRole', '==', 'student'),
      where('idInstitucion', '==', adminData?.idInstitucion)
    );
    const allStudents = await getDocs(allStudentsQuery);
    
    const studentsWithoutAdmin: any[] = [];
    allStudents.forEach(doc => {
      const data = doc.data();
      if (!data.idAdmin || data.idAdmin !== currentUser.uid) {
        studentsWithoutAdmin.push({
          id: doc.id,
          email: data.email,
          name: data.displayName || data.nombre,
          currentIdAdmin: data.idAdmin || 'NO TIENE'
        });
      }
    });

    if (studentsWithoutAdmin.length > 0) {
      console.log(`⚠️ Estudiantes sin idAdmin correcto: ${studentsWithoutAdmin.length}`);
      studentsWithoutAdmin.forEach(student => {
        console.log(`  - ${student.email} (${student.name}) - idAdmin actual: ${student.currentIdAdmin}`);
      });
    }

    // 4. Buscar profesores
    console.log('\n👨‍🏫 Buscando profesores...');
    const teachersWithAdminQuery = query(
      collection(db, 'users'),
      where('idAdmin', '==', currentUser.uid),
      where('schoolRole', '==', 'teacher')
    );
    const teachersWithAdmin = await getDocs(teachersWithAdminQuery);
    console.log(`✅ Profesores con idAdmin correcto: ${teachersWithAdmin.size}`);
    teachersWithAdmin.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.email} (${data.displayName || data.nombre})`);
    });

    // Buscar profesores sin idAdmin
    const allTeachersQuery = query(
      collection(db, 'users'),
      where('schoolRole', '==', 'teacher'),
      where('idInstitucion', '==', adminData?.idInstitucion)
    );
    const allTeachers = await getDocs(allTeachersQuery);
    
    const teachersWithoutAdmin: any[] = [];
    allTeachers.forEach(doc => {
      const data = doc.data();
      if (!data.idAdmin || data.idAdmin !== currentUser.uid) {
        teachersWithoutAdmin.push({
          id: doc.id,
          email: data.email,
          name: data.displayName || data.nombre,
          currentIdAdmin: data.idAdmin || 'NO TIENE'
        });
      }
    });

    if (teachersWithoutAdmin.length > 0) {
      console.log(`⚠️ Profesores sin idAdmin correcto: ${teachersWithoutAdmin.length}`);
      teachersWithoutAdmin.forEach(teacher => {
        console.log(`  - ${teacher.email} (${teacher.name}) - idAdmin actual: ${teacher.currentIdAdmin}`);
      });
    }

    // Resumen
    console.log('\n📊 RESUMEN:');
    console.log(`  - Estudiantes con idAdmin correcto: ${studentsWithAdmin.size}`);
    console.log(`  - Estudiantes sin idAdmin correcto: ${studentsWithoutAdmin.length}`);
    console.log(`  - Profesores con idAdmin correcto: ${teachersWithAdmin.size}`);
    console.log(`  - Profesores sin idAdmin correcto: ${teachersWithoutAdmin.length}`);

    if (studentsWithoutAdmin.length > 0 || teachersWithoutAdmin.length > 0) {
      console.log('\n💡 Ejecuta window.fixAdminUsers() para asignar el idAdmin a estos usuarios');
    } else {
      console.log('\n✅ Todos los usuarios tienen el idAdmin configurado correctamente');
    }

  } catch (error) {
    console.error('❌ Error al diagnosticar usuarios:', error);
  }
}

export async function fixAdminUsers() {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    // Verificar que es admin
    const adminDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const adminData = adminDoc.data();
    
    if (adminData?.schoolRole !== 'admin') {
      console.error('❌ El usuario actual no es un admin escolar');
      return;
    }

    console.log('🔧 Arreglando idAdmin para usuarios de la institución...');
    console.log('👤 Admin ID:', currentUser.uid);
    console.log('🏫 Institución:', adminData.idInstitucion);

    let studentsFixed = 0;
    let teachersFixed = 0;

    // 1. Arreglar estudiantes
    const studentsQuery = query(
      collection(db, 'users'),
      where('schoolRole', '==', 'student'),
      where('idInstitucion', '==', adminData.idInstitucion)
    );
    const students = await getDocs(studentsQuery);
    
    for (const studentDoc of students.docs) {
      const studentData = studentDoc.data();
      if (!studentData.idAdmin || studentData.idAdmin !== currentUser.uid) {
        console.log(`  Actualizando estudiante: ${studentData.email}`);
        await updateDoc(doc(db, 'users', studentDoc.id), {
          idAdmin: currentUser.uid
        });
        studentsFixed++;
      }
    }

    // 2. Arreglar profesores
    const teachersQuery = query(
      collection(db, 'users'),
      where('schoolRole', '==', 'teacher'),
      where('idInstitucion', '==', adminData.idInstitucion)
    );
    const teachers = await getDocs(teachersQuery);
    
    for (const teacherDoc of teachers.docs) {
      const teacherData = teacherDoc.data();
      if (!teacherData.idAdmin || teacherData.idAdmin !== currentUser.uid) {
        console.log(`  Actualizando profesor: ${teacherData.email}`);
        await updateDoc(doc(db, 'users', teacherDoc.id), {
          idAdmin: currentUser.uid
        });
        teachersFixed++;
      }
    }

    console.log('\n✅ Actualización completada:');
    console.log(`  - Estudiantes actualizados: ${studentsFixed}`);
    console.log(`  - Profesores actualizados: ${teachersFixed}`);
    
    if (studentsFixed > 0 || teachersFixed > 0) {
      console.log('\n🔄 Recarga la página para ver los cambios');
    }

  } catch (error) {
    console.error('❌ Error al arreglar usuarios:', error);
  }
}

// Exportar para uso en consola
if (typeof window !== 'undefined') {
  (window as any).diagnoseAdminUsers = diagnoseAdminUsers;
  (window as any).fixAdminUsers = fixAdminUsers;
  
  console.log('🔧 Funciones de diagnóstico disponibles:');
  console.log('   - window.diagnoseAdminUsers() - Ver estado de usuarios');
  console.log('   - window.fixAdminUsers() - Asignar idAdmin a usuarios de la institución');
}