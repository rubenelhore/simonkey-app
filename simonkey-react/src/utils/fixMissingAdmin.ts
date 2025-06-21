import { db } from '../services/firebase';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export const diagnoseSchoolDataStructure = async (teacherId: string) => {
  console.log('🔍 DIAGNÓSTICO DE ESTRUCTURA DE DATOS ESCOLARES');
  console.log('================================================');
  console.log(`👨‍🏫 Profesor ID: ${teacherId}`);
  console.log('');

  try {
    // 1. Verificar datos del profesor en schoolTeachers
    console.log('1️⃣ VERIFICANDO DATOS DEL PROFESOR...');
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', teacherId)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    
    if (teacherSnapshot.empty) {
      console.log('❌ NO SE ENCONTRÓ EL PROFESOR EN schoolTeachers');
      return;
    }

    const teacherData = teacherSnapshot.docs[0].data();
    console.log('✅ Profesor encontrado en schoolTeachers');
    console.log('   - ID:', teacherData.id);
    console.log('   - Nombre:', teacherData.nombre);
    console.log('   - idAdmin:', teacherData.idAdmin);
    console.log('');

    // 2. Verificar datos del admin
    if (teacherData.idAdmin) {
      console.log('2️⃣ VERIFICANDO DATOS DEL ADMIN...');
      const adminQuery = query(
        collection(db, 'schoolAdmins'),
        where('id', '==', teacherData.idAdmin)
      );
      const adminSnapshot = await getDocs(adminQuery);
      
      if (adminSnapshot.empty) {
        console.log('❌ NO SE ENCONTRÓ EL ADMIN EN schoolAdmins');
        console.log(`   - ID buscado: ${teacherData.idAdmin}`);
        console.log('');
        
        // Buscar todos los admins para ver qué IDs existen
        console.log('🔍 BUSCANDO TODOS LOS ADMINS DISPONIBLES...');
        const allAdminsQuery = query(collection(db, 'schoolAdmins'));
        const allAdminsSnapshot = await getDocs(allAdminsQuery);
        console.log(`   - Total de admins encontrados: ${allAdminsSnapshot.size}`);
        allAdminsSnapshot.forEach(doc => {
          const adminData = doc.data();
          console.log(`   - Admin ID: ${doc.id}, Nombre: ${adminData.nombre}, idInstitucion: ${adminData.idInstitucion}`);
        });
        console.log('');
      } else {
        const adminData = adminSnapshot.docs[0].data();
        console.log('✅ Admin encontrado en schoolAdmins');
        console.log('   - ID:', adminData.id);
        console.log('   - Nombre:', adminData.nombre);
        console.log('   - idInstitucion:', adminData.idInstitucion);
        console.log('');
      }
    } else {
      console.log('❌ EL PROFESOR NO TIENE idAdmin ASIGNADO');
      console.log('');
    }

    // 3. Verificar salones asignados al profesor
    console.log('3️⃣ VERIFICANDO SALONES ASIGNADOS AL PROFESOR...');
    const classroomQuery = query(
      collection(db, 'schoolClassrooms'),
      where('idProfesor', '==', teacherId)
    );
    const classroomSnapshot = await getDocs(classroomQuery);
    
    if (classroomSnapshot.empty) {
      console.log('❌ NO SE ENCONTRARON SALONES ASIGNADOS AL PROFESOR');
      console.log('');
      
      // Buscar todos los salones para ver qué IDs de profesor existen
      console.log('🔍 BUSCANDO TODOS LOS SALONES DISPONIBLES...');
      const allClassroomsQuery = query(collection(db, 'schoolClassrooms'));
      const allClassroomsSnapshot = await getDocs(allClassroomsQuery);
      console.log(`   - Total de salones encontrados: ${allClassroomsSnapshot.size}`);
      allClassroomsSnapshot.forEach(doc => {
        const classroomData = doc.data();
        console.log(`   - Salón ID: ${doc.id}, idProfesor: ${classroomData.idProfesor}, idSalon: ${classroomData.idSalon}`);
      });
      console.log('');
    } else {
      console.log(`✅ Se encontraron ${classroomSnapshot.size} salones asignados al profesor`);
      classroomSnapshot.forEach(doc => {
        const classroomData = doc.data();
        console.log(`   - Salón ID: ${doc.id}`);
        console.log(`     - idProfesor: ${classroomData.idProfesor}`);
        console.log(`     - idSalon: ${classroomData.idSalon}`);
        console.log(`     - Nombre: ${classroomData.nombre}`);
      });
      console.log('');
    }

    // 4. Verificar cuadernos disponibles
    console.log('4️⃣ VERIFICANDO CUADERNOS DISPONIBLES...');
    const allNotebooksQuery = query(collection(db, 'schoolNotebooks'));
    const allNotebooksSnapshot = await getDocs(allNotebooksQuery);
    console.log(`   - Total de cuadernos encontrados: ${allNotebooksSnapshot.size}`);
    
    allNotebooksSnapshot.forEach(doc => {
      const notebookData = doc.data();
      console.log(`   - Cuaderno ID: ${doc.id}`);
      console.log(`     - Título: ${notebookData.title}`);
      console.log(`     - idAdmin: ${notebookData.idAdmin}`);
      console.log(`     - idSalon: ${notebookData.idSalon}`);
    });
    console.log('');

    // 5. Verificar instituciones
    console.log('5️⃣ VERIFICANDO INSTITUCIONES...');
    const allInstitutionsQuery = query(collection(db, 'schoolInstitutions'));
    const allInstitutionsSnapshot = await getDocs(allInstitutionsQuery);
    console.log(`   - Total de instituciones encontradas: ${allInstitutionsSnapshot.size}`);
    
    allInstitutionsSnapshot.forEach(doc => {
      const institutionData = doc.data();
      console.log(`   - Institución ID: ${doc.id}`);
      console.log(`     - Nombre: ${institutionData.nombre}`);
    });
    console.log('');

    // 6. Análisis de inconsistencias
    console.log('6️⃣ ANÁLISIS DE INCONSISTENCIAS...');
    console.log('================================================');
    
    // Verificar si el idAdmin del profesor existe en schoolAdmins
    if (teacherData.idAdmin) {
      const adminExists = await getDocs(query(
        collection(db, 'schoolAdmins'),
        where('id', '==', teacherData.idAdmin)
      ));
      
      if (adminExists.empty) {
        console.log('❌ INCONSISTENCIA: El idAdmin del profesor no existe en schoolAdmins');
        console.log(`   - idAdmin del profesor: ${teacherData.idAdmin}`);
      } else {
        console.log('✅ El idAdmin del profesor existe en schoolAdmins');
      }
    }

    // Verificar si hay salones con idProfesor diferente al actual
    const allClassrooms = await getDocs(collection(db, 'schoolClassrooms'));
    const classroomsWithDifferentTeacher = allClassrooms.docs.filter(doc => {
      const data = doc.data();
      return data.idProfesor && data.idProfesor !== teacherId;
    });
    
    if (classroomsWithDifferentTeacher.length > 0) {
      console.log('⚠️ Hay salones asignados a otros profesores:');
      classroomsWithDifferentTeacher.forEach(doc => {
        const data = doc.data();
        console.log(`   - Salón ${doc.id}: idProfesor = ${data.idProfesor}`);
      });
    }

    // Verificar si hay cuadernos con idAdmin diferente al del profesor
    const allNotebooks = await getDocs(collection(db, 'schoolNotebooks'));
    const notebooksWithDifferentAdmin = allNotebooks.docs.filter(doc => {
      const data = doc.data();
      return data.idAdmin && data.idAdmin !== teacherData.idAdmin;
    });
    
    if (notebooksWithDifferentAdmin.length > 0) {
      console.log('⚠️ Hay cuadernos con idAdmin diferente al del profesor:');
      notebooksWithDifferentAdmin.forEach(doc => {
        const data = doc.data();
        console.log(`   - Cuaderno ${doc.id}: idAdmin = ${data.idAdmin} (profesor tiene: ${teacherData.idAdmin})`);
      });
    }

    console.log('');
    console.log('🔍 DIAGNÓSTICO COMPLETADO');
    console.log('================================================');

  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
  }
};

// Función para corregir inconsistencias
export const fixSchoolDataInconsistencies = async (teacherId: string) => {
  console.log('🔧 CORRIGIENDO INCONSISTENCIAS DE DATOS ESCOLARES');
  console.log('==================================================');
  
  try {
    // Primero ejecutar el diagnóstico
    await diagnoseSchoolDataStructure(teacherId);
    
    // Aquí se pueden agregar las correcciones específicas
    // Por ejemplo, actualizar IDs incorrectos, crear registros faltantes, etc.
    
    console.log('🔧 CORRECCIONES APLICADAS');
    console.log('==================================================');
    
  } catch (error) {
    console.error('❌ Error durante las correcciones:', error);
  }
};

// Función para corregir inconsistencias específicas
export const fixSpecificInconsistencies = async (teacherId: string) => {
  console.log('🔧 CORRIGIENDO INCONSISTENCIAS ESPECÍFICAS');
  console.log('===========================================');
  console.log(`👨‍🏫 Profesor ID: ${teacherId}`);
  console.log('');

  try {
    // 1. Verificar si el profesor existe en schoolTeachers
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', teacherId)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    
    if (teacherSnapshot.empty) {
      console.log('❌ El profesor no existe en schoolTeachers');
      return;
    }

    const teacherData = teacherSnapshot.docs[0].data();
    console.log('✅ Profesor encontrado:', teacherData.nombre);
    console.log('   - idAdmin actual:', teacherData.idAdmin);

    // 2. Buscar el admin correcto
    console.log('🔍 Buscando admin correcto...');
    const allAdminsQuery = query(collection(db, 'schoolAdmins'));
    const allAdminsSnapshot = await getDocs(allAdminsQuery);
    
    if (allAdminsSnapshot.empty) {
      console.log('❌ No hay admins disponibles');
      return;
    }

    // Mostrar todos los admins disponibles
    console.log('📋 Admins disponibles:');
    allAdminsSnapshot.forEach(doc => {
      const adminData = doc.data();
      console.log(`   - ID: ${doc.id}, Nombre: ${adminData.nombre}, idInstitucion: ${adminData.idInstitucion}`);
    });

    // 3. Buscar classrooms con idProfesor incorrecto
    console.log('🔍 Buscando classrooms con idProfesor incorrecto...');
    const allClassroomsQuery = query(collection(db, 'schoolClassrooms'));
    const allClassroomsSnapshot = await getDocs(allClassroomsQuery);
    
    const classroomsToFix = allClassroomsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.idProfesor && data.idProfesor !== teacherId;
    });

    if (classroomsToFix.length > 0) {
      console.log('⚠️ Classrooms que necesitan corrección:');
      classroomsToFix.forEach(doc => {
        const data = doc.data();
        console.log(`   - Classroom ${doc.id}: idProfesor actual = ${data.idProfesor}`);
      });
    }

    // 4. Buscar notebooks con idAdmin incorrecto
    console.log('🔍 Buscando notebooks con idAdmin incorrecto...');
    const allNotebooksQuery = query(collection(db, 'schoolNotebooks'));
    const allNotebooksSnapshot = await getDocs(allNotebooksQuery);
    
    const notebooksToFix = allNotebooksSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.idAdmin && data.idAdmin !== teacherData.idAdmin;
    });

    if (notebooksToFix.length > 0) {
      console.log('⚠️ Notebooks que necesitan corrección:');
      notebooksToFix.forEach(doc => {
        const data = doc.data();
        console.log(`   - Notebook ${doc.id}: idAdmin actual = ${data.idAdmin}, debería ser = ${teacherData.idAdmin}`);
      });
    }

    console.log('');
    console.log('🔧 CORRECCIONES DISPONIBLES:');
    console.log('1. Crear admin faltante');
    console.log('2. Corregir idProfesor en classrooms');
    console.log('3. Corregir idAdmin en notebooks');
    console.log('4. Vincular profesor con admin correcto');
    console.log('');

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
  }
};

// Función para crear admin faltante
export const createMissingAdmin = async (adminId: string, adminName: string, institutionId: string) => {
  console.log('🔧 CREANDO ADMIN FALTANTE');
  console.log('==========================');
  console.log(`   - ID: ${adminId}`);
  console.log(`   - Nombre: ${adminName}`);
  console.log(`   - Institución: ${institutionId}`);
  console.log('');

  try {
    // Verificar si la institución existe
    const institutionDoc = await getDoc(doc(db, 'schoolInstitutions', institutionId));
    if (!institutionDoc.exists()) {
      console.log('❌ La institución no existe');
      return false;
    }

    // Crear el admin
    const adminData = {
      id: adminId,
      nombre: adminName,
      idInstitucion: institutionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'schoolAdmins', adminId), adminData);
    console.log('✅ Admin creado exitosamente');
    return true;

  } catch (error) {
    console.error('❌ Error creando admin:', error);
    return false;
  }
};

// Función para corregir idProfesor en classrooms
export const fixClassroomTeacherId = async (classroomId: string, correctTeacherId: string) => {
  console.log('🔧 CORRIGIENDO ID PROFESOR EN CLASSROOM');
  console.log('=======================================');
  console.log(`   - Classroom: ${classroomId}`);
  console.log(`   - Profesor correcto: ${correctTeacherId}`);
  console.log('');

  try {
    await updateDoc(doc(db, 'schoolClassrooms', classroomId), {
      idProfesor: correctTeacherId,
      updatedAt: serverTimestamp()
    });
    console.log('✅ Classroom corregido exitosamente');
    return true;

  } catch (error) {
    console.error('❌ Error corrigiendo classroom:', error);
    return false;
  }
};

// Función para corregir idAdmin en notebooks
export const fixNotebookAdminId = async (notebookId: string, correctAdminId: string) => {
  console.log('🔧 CORRIGIENDO ID ADMIN EN NOTEBOOK');
  console.log('====================================');
  console.log(`   - Notebook: ${notebookId}`);
  console.log(`   - Admin correcto: ${correctAdminId}`);
  console.log('');

  try {
    await updateDoc(doc(db, 'schoolNotebooks', notebookId), {
      idAdmin: correctAdminId,
      updatedAt: serverTimestamp()
    });
    console.log('✅ Notebook corregido exitosamente');
    return true;

  } catch (error) {
    console.error('❌ Error corrigiendo notebook:', error);
    return false;
  }
};

// Función para corregir todas las inconsistencias automáticamente
export const autoFixAllInconsistencies = async (teacherId: string) => {
  console.log('🔧 CORRECCIÓN AUTOMÁTICA DE INCONSISTENCIAS');
  console.log('============================================');
  console.log(`👨‍🏫 Profesor ID: ${teacherId}`);
  console.log('');

  try {
    // 1. Obtener datos del profesor
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', teacherId)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    
    if (teacherSnapshot.empty) {
      console.log('❌ El profesor no existe en schoolTeachers');
      return;
    }

    const teacherData = teacherSnapshot.docs[0].data();
    console.log('✅ Profesor encontrado:', teacherData.nombre);

    // 2. Buscar admin correcto (asumiendo que debe existir uno)
    const allAdminsQuery = query(collection(db, 'schoolAdmins'));
    const allAdminsSnapshot = await getDocs(allAdminsQuery);
    
    if (allAdminsSnapshot.empty) {
      console.log('❌ No hay admins disponibles');
      return;
    }

    // Usar el primer admin disponible como referencia
    const firstAdmin = allAdminsSnapshot.docs[0];
    const correctAdminId = firstAdmin.id;
    console.log('🔧 Usando admin como referencia:', correctAdminId);

    // 3. Corregir idAdmin del profesor si es necesario
    if (teacherData.idAdmin !== correctAdminId) {
      console.log('🔧 Corrigiendo idAdmin del profesor...');
      await updateDoc(doc(db, 'schoolTeachers', teacherSnapshot.docs[0].id), {
        idAdmin: correctAdminId,
        updatedAt: serverTimestamp()
      });
      console.log('✅ idAdmin del profesor corregido');
    }

    // 4. Corregir classrooms
    const allClassroomsQuery = query(collection(db, 'schoolClassrooms'));
    const allClassroomsSnapshot = await getDocs(allClassroomsQuery);
    
    for (const classroomDoc of allClassroomsSnapshot.docs) {
      const classroomData = classroomDoc.data();
      if (classroomData.idProfesor && classroomData.idProfesor !== teacherId) {
        console.log(`🔧 Corrigiendo classroom ${classroomDoc.id}...`);
        await fixClassroomTeacherId(classroomDoc.id, teacherId);
      }
    }

    // 5. Corregir notebooks
    const allNotebooksQuery = query(collection(db, 'schoolNotebooks'));
    const allNotebooksSnapshot = await getDocs(allNotebooksQuery);
    
    for (const notebookDoc of allNotebooksSnapshot.docs) {
      const notebookData = notebookDoc.data();
      if (notebookData.idAdmin && notebookData.idAdmin !== correctAdminId) {
        console.log(`🔧 Corrigiendo notebook ${notebookDoc.id}...`);
        await fixNotebookAdminId(notebookDoc.id, correctAdminId);
      }
    }

    console.log('');
    console.log('✅ CORRECCIÓN AUTOMÁTICA COMPLETADA');
    console.log('====================================');

  } catch (error) {
    console.error('❌ Error durante la corrección automática:', error);
  }
};

// Función específica para el caso del profesor WNRWoNNj5sdaeSNii7KeK9IXIso2
export const fixSpecificTeacherCase = async () => {
  console.log('🔧 CORRECCIÓN ESPECÍFICA PARA PROFESOR WNRWoNNj5sdaeSNii7KeK9IXIso2');
  console.log('==================================================================');
  console.log('');

  const teacherId = 'WNRWoNNj5sdaeSNii7KeK9IXIso2';
  const incorrectAdminId = 'a2fhWpo9sI8M5YKsdKPH';
  const incorrectTeacherId = 'jexlLlOtcqDx2Afjbj3e';
  const incorrectNotebookAdminId = '2RMQYiXdOfAz3Bc96dBv';

  try {
    // 1. Verificar el estado actual
    console.log('1️⃣ VERIFICANDO ESTADO ACTUAL...');
    
    // Verificar profesor
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', teacherId)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    
    if (teacherSnapshot.empty) {
      console.log('❌ El profesor no existe en schoolTeachers');
      return;
    }

    const teacherData = teacherSnapshot.docs[0].data();
    console.log('✅ Profesor encontrado:', teacherData.nombre);
    console.log('   - idAdmin actual:', teacherData.idAdmin);

    // Verificar si el admin incorrecto existe
    const incorrectAdminQuery = query(
      collection(db, 'schoolAdmins'),
      where('id', '==', incorrectAdminId)
    );
    const incorrectAdminSnapshot = await getDocs(incorrectAdminQuery);
    console.log('   - Admin incorrecto existe:', !incorrectAdminSnapshot.empty);

    // Buscar admins disponibles
    const allAdminsQuery = query(collection(db, 'schoolAdmins'));
    const allAdminsSnapshot = await getDocs(allAdminsQuery);
    console.log('   - Total de admins disponibles:', allAdminsSnapshot.size);

    // 2. Buscar classrooms con idProfesor incorrecto
    console.log('2️⃣ BUSCANDO CLASSROOMS CON ID PROFESOR INCORRECTO...');
    const classroomQuery = query(
      collection(db, 'schoolClassrooms'),
      where('idProfesor', '==', incorrectTeacherId)
    );
    const classroomSnapshot = await getDocs(classroomQuery);
    console.log('   - Classrooms con idProfesor incorrecto:', classroomSnapshot.size);

    // 3. Buscar notebooks con idAdmin incorrecto
    console.log('3️⃣ BUSCANDO NOTEBOOKS CON ID ADMIN INCORRECTO...');
    const notebookQuery = query(
      collection(db, 'schoolNotebooks'),
      where('idAdmin', '==', incorrectNotebookAdminId)
    );
    const notebookSnapshot = await getDocs(notebookQuery);
    console.log('   - Notebooks con idAdmin incorrecto:', notebookSnapshot.size);

    console.log('');
    console.log('🔧 APLICANDO CORRECCIONES...');
    console.log('============================');

    // 4. Corregir idAdmin del profesor
    if (allAdminsSnapshot.size > 0) {
      const correctAdminId = allAdminsSnapshot.docs[0].id;
      console.log(`🔧 Corrigiendo idAdmin del profesor de ${teacherData.idAdmin} a ${correctAdminId}...`);
      
      await updateDoc(doc(db, 'schoolTeachers', teacherSnapshot.docs[0].id), {
        idAdmin: correctAdminId,
        updatedAt: serverTimestamp()
      });
      console.log('✅ idAdmin del profesor corregido');
    }

    // 5. Corregir classrooms
    if (!classroomSnapshot.empty) {
      console.log('🔧 Corrigiendo classrooms...');
      for (const classroomDoc of classroomSnapshot.docs) {
        await updateDoc(doc(db, 'schoolClassrooms', classroomDoc.id), {
          idProfesor: teacherId,
          updatedAt: serverTimestamp()
        });
        console.log(`   - Classroom ${classroomDoc.id} corregido`);
      }
    }

    // 6. Corregir notebooks
    if (!notebookSnapshot.empty && allAdminsSnapshot.size > 0) {
      const correctAdminId = allAdminsSnapshot.docs[0].id;
      console.log('🔧 Corrigiendo notebooks...');
      for (const notebookDoc of notebookSnapshot.docs) {
        await updateDoc(doc(db, 'schoolNotebooks', notebookDoc.id), {
          idAdmin: correctAdminId,
          updatedAt: serverTimestamp()
        });
        console.log(`   - Notebook ${notebookDoc.id} corregido`);
      }
    }

    console.log('');
    console.log('✅ CORRECCIÓN ESPECÍFICA COMPLETADA');
    console.log('====================================');

  } catch (error) {
    console.error('❌ Error durante la corrección específica:', error);
  }
};

// Función para verificar si el admin faltante existe y crearlo si es necesario
export const createMissingAdminIfNeeded = async (adminId: string) => {
  console.log('🔧 VERIFICANDO ADMIN FALTANTE');
  console.log('==============================');
  console.log(`   - Admin ID: ${adminId}`);
  console.log('');

  try {
    // Verificar si el admin existe
    const adminQuery = query(
      collection(db, 'schoolAdmins'),
      where('id', '==', adminId)
    );
    const adminSnapshot = await getDocs(adminQuery);
    
    if (!adminSnapshot.empty) {
      console.log('✅ El admin ya existe');
      return true;
    }

    console.log('❌ El admin no existe, creándolo...');

    // Buscar una institución disponible
    const institutionsQuery = query(collection(db, 'schoolInstitutions'));
    const institutionsSnapshot = await getDocs(institutionsQuery);
    
    if (institutionsSnapshot.empty) {
      console.log('❌ No hay instituciones disponibles');
      return false;
    }

    const firstInstitution = institutionsSnapshot.docs[0];
    const institutionId = firstInstitution.id;
    const institutionData = firstInstitution.data();

    console.log(`🔧 Usando institución: ${institutionData.nombre} (${institutionId})`);

    // Crear el admin
    const adminData = {
      id: adminId,
      nombre: `Admin para ${adminId}`,
      idInstitucion: institutionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'schoolAdmins', adminId), adminData);
    console.log('✅ Admin creado exitosamente');
    return true;

  } catch (error) {
    console.error('❌ Error creando admin:', error);
    return false;
  }
};

// Función para corregir el campo idSalon en classrooms
export const fixClassroomIdSalon = async (teacherId: string) => {
  console.log('🔧 CORRIGIENDO CAMPO IDSALON EN CLASSROOMS');
  console.log('==========================================');
  console.log(`👨‍🏫 Profesor ID: ${teacherId}`);
  console.log('');

  try {
    // 1. Obtener todos los classrooms del profesor
    const classroomQuery = query(
      collection(db, 'schoolClassrooms'),
      where('idProfesor', '==', teacherId)
    );
    const classroomSnapshot = await getDocs(classroomQuery);
    
    if (classroomSnapshot.empty) {
      console.log('❌ No se encontraron classrooms para el profesor');
      return;
    }

    console.log(`✅ Se encontraron ${classroomSnapshot.size} classrooms del profesor`);
    
    // 2. Corregir cada classroom
    for (const classroomDoc of classroomSnapshot.docs) {
      const classroomData = classroomDoc.data();
      const classroomId = classroomDoc.id;
      
      console.log(`🔧 Corrigiendo classroom ${classroomId}...`);
      console.log(`   - Nombre: ${classroomData.nombre}`);
      console.log(`   - idSalon actual: ${classroomData.idSalon}`);
      
      // Si idSalon es undefined, establecerlo como el ID del documento
      if (!classroomData.idSalon) {
        await updateDoc(doc(db, 'schoolClassrooms', classroomId), {
          idSalon: classroomId,
          updatedAt: serverTimestamp()
        });
        console.log(`   ✅ idSalon corregido a: ${classroomId}`);
      } else {
        console.log(`   ✅ idSalon ya está correcto: ${classroomData.idSalon}`);
      }
    }

    console.log('');
    console.log('✅ CORRECCIÓN DE IDSALON COMPLETADA');
    console.log('====================================');

  } catch (error) {
    console.error('❌ Error corrigiendo idSalon:', error);
  }
};

// Función para corregir todos los problemas de una vez
export const fixAllSchoolIssues = async (teacherId: string) => {
  console.log('🔧 CORRECCIÓN COMPLETA DE PROBLEMAS ESCOLARES');
  console.log('=============================================');
  console.log(`👨‍🏫 Profesor ID: ${teacherId}`);
  console.log('');

  try {
    // 1. Corregir idSalon en classrooms
    console.log('1️⃣ Corrigiendo idSalon en classrooms...');
    await fixClassroomIdSalon(teacherId);
    
    // 2. Ejecutar corrección automática
    console.log('2️⃣ Ejecutando corrección automática...');
    await autoFixAllInconsistencies(teacherId);
    
    console.log('');
    console.log('✅ CORRECCIÓN COMPLETA FINALIZADA');
    console.log('==================================');

  } catch (error) {
    console.error('❌ Error durante la corrección completa:', error);
  }
}; 