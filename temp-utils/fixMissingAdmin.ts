import {
  db
} from '../services/firebase';
import {
  collection, getDocs, query, where, doc, getDoc, updateDoc, setDoc, serverTimestamp
} from 'firebase/firestore';

export const diagnoseSchoolDataStructure = async (teacherId: string) => {
  try {
    // 1. Verificar datos del profesor en schoolTeachers
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', teacherId)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    if (teacherSnapshot.empty) {
      return;
    }

    const teacherData = teacherSnapshot.docs[0].data();
    // 2. Verificar datos del admin
    if (teacherData.idAdmin) {
      const adminQuery = query(
        collection(db, 'schoolAdmins'),
        where('id', '==', teacherData.idAdmin)
      );
      const adminSnapshot = await getDocs(adminQuery);
      if (adminSnapshot.empty) {
        // Buscar todos los admins para ver qué IDs existen
        const allAdminsQuery = query(collection(db, 'schoolAdmins'));
        const allAdminsSnapshot = await getDocs(allAdminsQuery);
        allAdminsSnapshot.forEach(doc => {
          const adminData = doc.data();
        });
      } else {
        const adminData = adminSnapshot.docs[0].data();
      }
    }
    // 3. Verificar salones asignados al profesor
    const classroomQuery = query(
      collection(db, 'schoolClassrooms'),
      where('idProfesor', '==', teacherId)
    );
    const classroomSnapshot = await getDocs(classroomQuery);
    if (classroomSnapshot.empty) {
      // Buscar todos los salones para ver qué IDs de profesor existen
      const allClassroomsQuery = query(collection(db, 'schoolClassrooms'));
      const allClassroomsSnapshot = await getDocs(allClassroomsQuery);
      allClassroomsSnapshot.forEach(doc => {
        const classroomData = doc.data();
      });
    } else {
      classroomSnapshot.forEach(doc => {
        const classroomData = doc.data();
      });
    }

    // 4. Verificar cuadernos disponibles
    const allNotebooksQuery = query(collection(db, 'schoolNotebooks'));
    const allNotebooksSnapshot = await getDocs(allNotebooksQuery);
    allNotebooksSnapshot.forEach(doc => {
      const notebookData = doc.data();
    });
    // 5. Verificar instituciones
    const allInstitutionsQuery = query(collection(db, 'schoolInstitutions'));
    const allInstitutionsSnapshot = await getDocs(allInstitutionsQuery);
    allInstitutionsSnapshot.forEach(doc => {
      const institutionData = doc.data();
    });
    // 6. Análisis de inconsistencias
    // Verificar si el idAdmin del profesor existe en schoolAdmins
    if (teacherData.idAdmin) {
      const adminExists = await getDocs(query(
        collection(db, 'schoolAdmins'),
        where('id', '==', teacherData.idAdmin)
      ));
      if (adminExists.empty) {
      } else {
      }
    }

    // Verificar si hay salones con idProfesor diferente al actual
    const allClassrooms = await getDocs(collection(db, 'schoolClassrooms'));
    const classroomsWithDifferentTeacher = allClassrooms.docs.filter(doc => {
      const data = doc.data();
      return data.idProfesor && data.idProfesor !== teacherId;
    });
    if (classroomsWithDifferentTeacher.length > 0) {
      classroomsWithDifferentTeacher.forEach(doc => {
        const data = doc.data();
      });
    }

    // Verificar si hay cuadernos con idAdmin diferente al del profesor
    const allNotebooks = await getDocs(collection(db, 'schoolNotebooks'));
    const notebooksWithDifferentAdmin = allNotebooks.docs.filter(doc => {
      const data = doc.data();
      return data.idAdmin && data.idAdmin !== teacherData.idAdmin;
    });
    if (notebooksWithDifferentAdmin.length > 0) {
      notebooksWithDifferentAdmin.forEach(doc => {
        const data = doc.data();
      });
    }

  } catch (error) {
    console.error('[ERROR] Error durante el diagnóstico', error);
  }
};

// Función para corregir inconsistencias
export const fixSchoolDataInconsistencies = async (teacherId: string) => {
  try {
    // Primero ejecutar el diagnóstico
    await diagnoseSchoolDataStructure(teacherId);
    // Aquí se pueden agregar las correcciones específicas
    // Por ejemplo, actualizar IDs incorrectos, crear registros faltantes, etc.
    
  } catch (error) {
    console.error('[ERROR] Error durante las correcciones', error);
  }
};

// Función para corregir inconsistencias específicas
export const fixSpecificInconsistencies = async (teacherId: string) => {
  try {
    // 1. Verificar si el profesor existe en schoolTeachers
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', teacherId)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    if (teacherSnapshot.empty) {
      return;
    }

    const teacherData = teacherSnapshot.docs[0].data();
    // 2. Buscar el admin correcto
    const allAdminsQuery = query(collection(db, 'schoolAdmins'));
    const allAdminsSnapshot = await getDocs(allAdminsQuery);
    if (allAdminsSnapshot.empty) {
      return;
    }

    // Mostrar todos los admins disponibles
    allAdminsSnapshot.forEach(doc => {
      const adminData = doc.data();
    });
    // 3. Buscar classrooms con idProfesor incorrecto
    const allClassroomsQuery = query(collection(db, 'schoolClassrooms'));
    const allClassroomsSnapshot = await getDocs(allClassroomsQuery);
    const classroomsToFix = allClassroomsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.idProfesor && data.idProfesor !== teacherId;
    });
    if (classroomsToFix.length > 0) {
      classroomsToFix.forEach(doc => {
        const data = doc.data();
      });
    }

    // 4. Buscar notebooks con idAdmin incorrecto
    const allNotebooksQuery = query(collection(db, 'schoolNotebooks'));
    const allNotebooksSnapshot = await getDocs(allNotebooksQuery);
    const notebooksToFix = allNotebooksSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.idAdmin && data.idAdmin !== teacherData.idAdmin;
    });
    if (notebooksToFix.length > 0) {
      notebooksToFix.forEach(doc => {
        const data = doc.data();
      });
    }

  } catch (error) {
    console.error('[ERROR] Error durante la corrección', error);
  }
};

// Función para crear admin faltante
export const createMissingAdmin = async (adminId: string, adminName: string, institutionId: string) => {
  try {
    // Verificar si la institución existe
    const institutionDoc = await getDoc(doc(db, 'schoolInstitutions', institutionId));
    if (!institutionDoc.exists()) {
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
    return true;

  } catch (error) {
    console.error('[ERROR] Error creando admin', error);
    return false;
  }
};

// Función para corregir idProfesor en classrooms
export const fixClassroomTeacherId = async (classroomId: string, correctTeacherId: string) => {
  try {
    await updateDoc(doc(db, 'schoolClassrooms', classroomId), {
      idProfesor: correctTeacherId,
      updatedAt: serverTimestamp()
    });
    return true;

  } catch (error) {
    console.error('[ERROR] Error corrigiendo classroom', error);
    return false;
  }
};

// Función para corregir idAdmin en notebooks
export const fixNotebookAdminId = async (notebookId: string, correctAdminId: string) => {
  try {
    await updateDoc(doc(db, 'schoolNotebooks', notebookId), {
      idAdmin: correctAdminId,
      updatedAt: serverTimestamp()
    });
    return true;

  } catch (error) {
    console.error('[ERROR] Error corrigiendo notebook', error);
    return false;
  }
};

// Función para corregir todas las inconsistencias automáticamente
export const autoFixAllInconsistencies = async (teacherId: string) => {
  try {
    // 1. Obtener datos del profesor,
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', teacherId)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    if (teacherSnapshot.empty) {
      return;
    }

    const teacherData = teacherSnapshot.docs[0].data();
    // 2. Buscar admin correcto (asumiendo que debe existir uno)
    const allAdminsQuery = query(collection(db, 'schoolAdmins'));
    const allAdminsSnapshot = await getDocs(allAdminsQuery);
    if (allAdminsSnapshot.empty) {
      return;
    }

    // Usar el primer admin disponible como referencia,
    const firstAdmin = allAdminsSnapshot.docs[0];
    const correctAdminId = firstAdmin.id;
    // 3. Corregir idAdmin del profesor si es necesario
    if (teacherData.idAdmin !== correctAdminId) {
      await updateDoc(doc(db, 'schoolTeachers', teacherSnapshot.docs[0].id), {
        idAdmin: correctAdminId,
        updatedAt: serverTimestamp()
      });
    }

    // 4. Corregir classrooms,
    const allClassroomsQuery = query(collection(db, 'schoolClassrooms'));
    const allClassroomsSnapshot = await getDocs(allClassroomsQuery);
    for (const classroomDoc of allClassroomsSnapshot.docs) {
      const classroomData = classroomDoc.data();
      if (classroomData.idProfesor && classroomData.idProfesor !== teacherId) {
        await fixClassroomTeacherId(classroomDoc.id, teacherId);
      }
    }

    // 5. Corregir notebooks,
    const allNotebooksQuery = query(collection(db, 'schoolNotebooks'));
    const allNotebooksSnapshot = await getDocs(allNotebooksQuery);
    for (const notebookDoc of allNotebooksSnapshot.docs) {
      const notebookData = notebookDoc.data();
      if (notebookData.idAdmin && notebookData.idAdmin !== correctAdminId) {
        await fixNotebookAdminId(notebookDoc.id, correctAdminId);
      }
    }

  } catch (error) {
    console.error('[ERROR] Error durante la corrección automática', error);
  }
};

// Función específica para el caso del profesor WNRWoNNj5sdaeSNii7KeK9IXIso2
export const fixSpecificTeacherCase = async () => {
  const teacherId = 'WNRWoNNj5sdaeSNii7KeK9IXIso2';
  const incorrectAdminId = 'a2fhWpo9sI8M5YKsdKPH';
  const incorrectTeacherId = 'jexlLlOtcqDx2Afjbj3e';
  const incorrectNotebookAdminId = '2RMQYiXdOfAz3Bc96dBv';

  try {
    // 1. Verificar el estado actual
    // Verificar profesor,
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', teacherId)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    if (teacherSnapshot.empty) {
      return;
    }

    const teacherData = teacherSnapshot.docs[0].data();
    // Verificar si el admin incorrecto existe,
    const incorrectAdminQuery = query(
      collection(db, 'schoolAdmins'),
      where('id', '==', incorrectAdminId)
    );
    const incorrectAdminSnapshot = await getDocs(incorrectAdminQuery);
    // Buscar admins disponibles,
    const allAdminsQuery = query(collection(db, 'schoolAdmins'));
    const allAdminsSnapshot = await getDocs(allAdminsQuery);
    // 2. Buscar classrooms con idProfesor incorrecto,
    const classroomQuery = query(
      collection(db, 'schoolClassrooms'),
      where('idProfesor', '==', incorrectTeacherId)
    );
    const classroomSnapshot = await getDocs(classroomQuery);
    // 3. Buscar notebooks con idAdmin incorrecto,
    const notebookQuery = query(
      collection(db, 'schoolNotebooks'),
      where('idAdmin', '==', incorrectNotebookAdminId)
    );
    const notebookSnapshot = await getDocs(notebookQuery);
    // 4. Corregir idAdmin del profesor
    if (allAdminsSnapshot.size > 0) {
      const correctAdminId = allAdminsSnapshot.docs[0].id;
      await updateDoc(doc(db, 'schoolTeachers', teacherSnapshot.docs[0].id), {
        idAdmin: correctAdminId,
        updatedAt: serverTimestamp()
      });
    }

    // 5. Corregir classrooms
    if (!classroomSnapshot.empty) {
      for (const classroomDoc of classroomSnapshot.docs) {
        await updateDoc(doc(db, 'schoolClassrooms', classroomDoc.id), {
          idProfesor: teacherId,
          updatedAt: serverTimestamp()
        });
      }
    }

    // 6. Corregir notebooks
    if (!notebookSnapshot.empty && allAdminsSnapshot.size > 0) {
      const correctAdminId = allAdminsSnapshot.docs[0].id;
      for (const notebookDoc of notebookSnapshot.docs) {
        await updateDoc(doc(db, 'schoolNotebooks', notebookDoc.id), {
          idAdmin: correctAdminId,
          updatedAt: serverTimestamp()
        });
      }
    }

  } catch (error) {
    console.error('[ERROR] Error durante la corrección específica', error);
  }
};

// Función para verificar si el admin faltante existe y crearlo si es necesario
export const createMissingAdminIfNeeded = async (adminId: string) => {
  try {
    // Verificar si el admin existe,
    const adminQuery = query(
      collection(db, 'schoolAdmins'),
      where('id', '==', adminId)
    );
    const adminSnapshot = await getDocs(adminQuery);
    if (!adminSnapshot.empty) {
      return true;
    }

    // Buscar una institución disponible,
    const institutionsQuery = query(collection(db, 'schoolInstitutions'));
    const institutionsSnapshot = await getDocs(institutionsQuery);
    if (institutionsSnapshot.empty) {
      return false;
    }
    const firstInstitution = institutionsSnapshot.docs[0];
    const institutionId = firstInstitution.id;
    const institutionData = firstInstitution.data();
    // Crear el admin,
    const adminData = {
      id: adminId,
      nombre: `Admin para ${adminId}`,
      idInstitucion: institutionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'schoolAdmins', adminId), adminData);
    return true;

  } catch (error) {
    console.error('[ERROR] Error creando admin', error);
    return false;
  }
};

// Función para corregir el campo idSalon en classrooms
export const fixClassroomIdSalon = async (teacherId: string) => {
  try {
    // 1. Obtener todos los classrooms del profesor,
    const classroomQuery = query(
      collection(db, 'schoolClassrooms'),
      where('idProfesor', '==', teacherId)
    );
    const classroomSnapshot = await getDocs(classroomQuery);
    if (classroomSnapshot.empty) {
      return;
    }

    // 2. Corregir cada classroom
    for (const classroomDoc of classroomSnapshot.docs) {
      const classroomData = classroomDoc.data();
      const classroomId = classroomDoc.id;
      
      // Si idSalon es undefined, establecerlo como el ID del documento
      if (!classroomData.idSalon) {
        await updateDoc(doc(db, 'schoolClassrooms', classroomId), {
          idSalon: classroomId,
          updatedAt: serverTimestamp()
        });
      }
    }

  } catch (error) {
    console.error('[ERROR] Error corrigiendo idSalon', error);
  }
};

// Función para corregir todos los problemas de una vez
export const fixAllSchoolIssues = async (teacherId: string) => {
  try {
    // 1. Corregir idSalon en classrooms
    await fixClassroomIdSalon(teacherId);
    // 2. Ejecutar corrección automática
    await autoFixAllInconsistencies(teacherId);
  } catch (error) {
    console.error('[ERROR] Error durante la corrección completa', error);
  }
}; 