import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, deleteDoc, setDoc } from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

/**
 * Función específica para arreglar el problema actual del estudiante rubenelhore23@gmail.com
 * Versión que funciona con permisos limitados
 */
export const fixCurrentSchoolStudent = async () => {
  console.log('🔧 === ARREGLANDO ESTUDIANTE ACTUAL (VERSIÓN PERMISOS LIMITADOS) ===');
  
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    console.log('❌ No hay usuario autenticado');
    return { success: false, message: 'No hay usuario autenticado' };
  }
  
  console.log('👤 Usuario actual:', currentUser.email, 'UID:', currentUser.uid);
  
  try {
    // 1. Verificar el perfil actual del usuario autenticado
    console.log('\n🔍 1. Verificando perfil actual...');
    const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    if (!currentUserDoc.exists()) {
      console.log('❌ No existe perfil para el usuario autenticado actual');
      return { success: false, message: 'No existe perfil para el usuario autenticado actual' };
    }
    
    const currentUserData = currentUserDoc.data();
    console.log('⚠️ Perfil actual del usuario autenticado:', currentUserData);
    
    // 2. Buscar si existe un usuario con el email correcto en users
    console.log('\n🔍 2. Buscando usuario con email correcto en users...');
    const usersQuery = query(collection(db, 'users'), where('email', '==', 'rubenelhore23@gmail.com'));
    const usersSnapshot = await getDocs(usersQuery);
    
    if (usersSnapshot.empty) {
      console.log('❌ No se encontró usuario con email rubenelhore23@gmail.com en users');
      return { success: false, message: 'No se encontró usuario con email rubenelhore23@gmail.com en users' };
    }
    
    const correctUserDoc = usersSnapshot.docs[0];
    const correctUserData = correctUserDoc.data();
    console.log('✅ Usuario correcto encontrado en users:', correctUserData);
    
    // 3. Verificar si el usuario correcto es un estudiante escolar
    if (correctUserData.subscription !== UserSubscriptionType.SCHOOL || correctUserData.schoolRole !== SchoolRole.STUDENT) {
      console.log('❌ El usuario encontrado no es un estudiante escolar');
      return { success: false, message: 'El usuario encontrado no es un estudiante escolar' };
    }
    
    // 4. Si el usuario correcto es diferente al actual, actualizar el correcto
    if (correctUserDoc.id !== currentUser.uid) {
      console.log('\n🔧 3. Actualizando perfil correcto con Google Auth...');
      await updateDoc(doc(db, 'users', correctUserDoc.id), {
        googleAuthUid: currentUser.uid,
        googleAuthEmail: currentUser.email,
        googleAuthDisplayName: currentUser.displayName,
        googleAuthPhotoURL: currentUser.photoURL,
        linkedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // 5. Cambiar el perfil actual a FREE para que no interfiera
      console.log('\n🔧 4. Cambiando perfil actual a FREE...');
      await updateDoc(doc(db, 'users', currentUser.uid), {
        subscription: UserSubscriptionType.FREE,
        schoolRole: undefined,
        email: 'temp_' + currentUser.uid + '@temp.com', // Email temporal para evitar conflictos
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Problema arreglado exitosamente');
      console.log('📋 Resumen:');
      console.log('  - Perfil correcto del estudiante:', correctUserDoc.id);
      console.log('  - Vinculado con Google Auth UID:', currentUser.uid);
      console.log('  - Perfil incorrecto cambiado a FREE');
      
      return { 
        success: true, 
        message: 'Problema arreglado exitosamente. Recarga la página para ver los cambios.',
        correctUserId: correctUserDoc.id
      };
      
    } else {
      // El usuario actual es el correcto, solo actualizar la información
      console.log('\n🔧 3. Usuario actual es el correcto, actualizando información...');
      await updateDoc(doc(db, 'users', currentUser.uid), {
        subscription: UserSubscriptionType.SCHOOL,
        schoolRole: SchoolRole.STUDENT,
        email: 'rubenelhore23@gmail.com',
        nombre: correctUserData.nombre || 'Rubén Elhore',
        displayName: correctUserData.displayName || 'Rubén Elhore',
        username: correctUserData.username || 'Rubén Elhore',
        maxNotebooks: 0,
        maxConceptsPerNotebook: 0,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Usuario actual actualizado correctamente');
      return { 
        success: true, 
        message: 'Usuario actual actualizado correctamente. Recarga la página para ver los cambios.',
        correctUserId: currentUser.uid
      };
    }
    
  } catch (error) {
    console.error('❌ Error arreglando estudiante actual:', error);
    return { 
      success: false, 
      message: `Error: ${error}` 
    };
  }
};

/**
 * Elimina usuarios duplicados creados automáticamente y vincula con usuario escolar existente
 */
export const fixDuplicateAutoCreatedUser = async (): Promise<{
  success: boolean;
  message: string;
  deletedUserId?: string;
  linkedUserId?: string;
}> => {
  try {
    console.log('🔧 === ARREGLANDO USUARIO DUPLICADO CREADO AUTOMÁTICAMENTE ===');
    
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      return {
        success: false,
        message: 'No hay usuario autenticado'
      };
    }

    console.log('🔍 Usuario actual:', currentUser.email, 'UID:', currentUser.uid);
    
    // Buscar todos los usuarios con el mismo email
    const usersQuery = query(collection(db, 'users'), where('email', '==', currentUser.email));
    const usersSnapshot = await getDocs(usersQuery);
    
    if (usersSnapshot.empty) {
      return {
        success: false,
        message: 'No se encontraron usuarios con este email'
      };
    }
    
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));
    
    console.log('🔍 Usuarios encontrados:', users.length);
    users.forEach(user => {
      console.log(`  - ID: ${user.id}, Subscription: ${user.subscription}, AutoCreated: ${user.autoCreated}`);
    });
    
    // Encontrar el usuario escolar (no autoCreated) y el usuario duplicado (autoCreated)
    const schoolUser = users.find(u => u.subscription === 'SCHOOL' && !u.autoCreated);
    const autoCreatedUser = users.find(u => u.autoCreated && u.id === currentUser.uid);
    
    if (!schoolUser) {
      return {
        success: false,
        message: 'No se encontró usuario escolar existente'
      };
    }
    
    if (!autoCreatedUser) {
      return {
        success: false,
        message: 'No se encontró usuario duplicado autoCreated'
      };
    }
    
    console.log('✅ Usuario escolar encontrado:', schoolUser.id);
    console.log('⚠️ Usuario duplicado encontrado:', autoCreatedUser.id);
    
    // Vincular el usuario escolar con el UID de Google Auth
    await updateDoc(doc(db, 'users', schoolUser.id), {
      googleAuthUid: currentUser.uid,
      googleAuthEmail: currentUser.email,
      googleAuthDisplayName: currentUser.displayName,
      googleAuthPhotoURL: currentUser.photoURL,
      linkedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Usuario escolar vinculado con Google Auth UID');
    
    // Eliminar el usuario duplicado
    await deleteDoc(doc(db, 'users', autoCreatedUser.id));
    console.log('✅ Usuario duplicado eliminado');
    
    // Eliminar estadísticas del usuario duplicado si existen
    try {
      const statsQuery = query(collection(db, 'users', autoCreatedUser.id, 'stats'));
      const statsSnapshot = await getDocs(statsQuery);
      
      for (const statDoc of statsSnapshot.docs) {
        await deleteDoc(statDoc.ref);
      }
      console.log('✅ Estadísticas del usuario duplicado eliminadas');
    } catch (error) {
      console.log('⚠️ No se pudieron eliminar estadísticas:', error);
    }
    
    // Eliminar configuraciones del usuario duplicado si existen
    try {
      const settingsQuery = query(collection(db, 'users', autoCreatedUser.id, 'settings'));
      const settingsSnapshot = await getDocs(settingsQuery);
      
      for (const settingDoc of settingsSnapshot.docs) {
        await deleteDoc(settingDoc.ref);
      }
      console.log('✅ Configuraciones del usuario duplicado eliminadas');
    } catch (error) {
      console.log('⚠️ No se pudieron eliminar configuraciones:', error);
    }
    
    console.log('✅ === USUARIO DUPLICADO ARREGLADO ===');
    
    return {
      success: true,
      message: 'Usuario duplicado eliminado y vinculado correctamente',
      deletedUserId: autoCreatedUser.id,
      linkedUserId: schoolUser.id
    };
    
  } catch (error) {
    console.error('❌ Error arreglando usuario duplicado:', error);
    return {
      success: false,
      message: `Error: ${error}`
    };
  }
};

/**
 * Verifica si existe un usuario en schoolStudents antes de crear una cuenta FREE
 */
export const checkSchoolStudentBeforeAuth = async (email: string): Promise<{
  exists: boolean;
  studentData?: any;
  studentId?: string;
}> => {
  try {
    console.log('🔍 Verificando si existe estudiante escolar con email:', email);
    
    const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', email));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    if (!studentsSnapshot.empty) {
      const studentDoc = studentsSnapshot.docs[0];
      const studentData = studentDoc.data();
      
      console.log('✅ Estudiante escolar encontrado:', {
        id: studentDoc.id,
        nombre: studentData.nombre,
        email: studentData.email
      });
      
      return {
        exists: true,
        studentData: studentData,
        studentId: studentDoc.id
      };
    }
    
    console.log('❌ No se encontró estudiante escolar con email:', email);
    return { exists: false };
    
  } catch (error) {
    console.error('❌ Error verificando estudiante escolar:', error);
    return { exists: false };
  }
};

/**
 * Función para arreglar la vinculación de un estudiante escolar con Google Auth
 */
export const fixSchoolStudentLinking = async (email: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log('🔧 === ARREGLANDO VINCULACIÓN DE ESTUDIANTE ESCOLAR ===');
    console.log('📧 Email del estudiante:', email);
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: 'No hay usuario autenticado' };
    }
    
    console.log('👤 Usuario actual de Google Auth:', currentUser.email, 'UID:', currentUser.uid);
    
    // 1. Buscar el estudiante en schoolStudents
    const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', email));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    if (studentsSnapshot.empty) {
      return { success: false, message: `No se encontró estudiante escolar con email: ${email}` };
    }
    
    const studentDoc = studentsSnapshot.docs[0];
    const studentData = studentDoc.data();
    const studentId = studentDoc.id;
    
    console.log('✅ Estudiante escolar encontrado:', {
      id: studentId,
      nombre: studentData.nombre,
      email: studentData.email
    });
    
    // 2. Verificar si ya existe un perfil en users con el ID del estudiante
    const existingUserDoc = await getDoc(doc(db, 'users', studentId));
    
    if (!existingUserDoc.exists()) {
      console.log('⚠️ No existe perfil en users, creando...');
      
      // Crear el perfil en la colección users usando el ID del estudiante
      await setDoc(doc(db, 'users', studentId), {
        id: studentId,
        email: studentData.email,
        username: studentData.nombre,
        nombre: studentData.nombre,
        displayName: studentData.nombre,
        birthdate: '',
        subscription: UserSubscriptionType.SCHOOL,
        schoolRole: SchoolRole.STUDENT,
        notebookCount: 0,
        maxNotebooks: 0,
        maxConceptsPerNotebook: 0,
        canDeleteAndRecreate: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Perfil creado en users con ID del estudiante');
    } else {
      console.log('✅ Perfil ya existe en users con ID del estudiante');
    }
    
    // 3. Actualizar con información de Google Auth
    await updateDoc(doc(db, 'users', studentId), {
      subscription: UserSubscriptionType.SCHOOL,
      schoolRole: SchoolRole.STUDENT,
      googleAuthUid: currentUser.uid,
      googleAuthEmail: currentUser.email,
      googleAuthDisplayName: currentUser.displayName,
      googleAuthPhotoURL: currentUser.photoURL,
      linkedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Estudiante escolar vinculado exitosamente con Google Auth');
    
    // 4. Si el usuario actual tiene un perfil diferente, marcarlo como temporal
    if (currentUser.uid !== studentId) {
      console.log('⚠️ Usuario actual tiene UID diferente, marcando como temporal...');
      
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          subscription: UserSubscriptionType.FREE,
          schoolRole: undefined,
          email: 'temp_' + currentUser.uid + '@temp.com',
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Perfil actual marcado como temporal');
      } catch (error) {
        console.log('⚠️ No se pudo marcar perfil actual como temporal:', error);
      }
    }
    
    return {
      success: true,
      message: `Estudiante escolar vinculado exitosamente. ID: ${studentId}`,
      details: {
        studentId,
        studentName: studentData.nombre,
        googleAuthUid: currentUser.uid
      }
    };
    
  } catch (error) {
    console.error('❌ Error arreglando vinculación de estudiante escolar:', error);
    return {
      success: false,
      message: `Error: ${error}`
    };
  }
};

/**
 * Función para diagnosticar el estado de vinculación de usuarios escolares
 */
export const diagnoseSchoolStudentLinking = async (email: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log('🔍 === DIAGNÓSTICO DE VINCULACIÓN DE ESTUDIANTE ESCOLAR ===');
    console.log('📧 Email del estudiante:', email);
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: 'No hay usuario autenticado' };
    }
    
    console.log('👤 Usuario actual de Google Auth:', currentUser.email, 'UID:', currentUser.uid);
    
    // 1. Buscar el estudiante en schoolStudents
    const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', email));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    if (studentsSnapshot.empty) {
      return { success: false, message: `No se encontró estudiante escolar con email: ${email}` };
    }
    
    const studentDoc = studentsSnapshot.docs[0];
    const studentData = studentDoc.data();
    const studentId = studentDoc.id;
    
    console.log('✅ Estudiante escolar encontrado:', {
      id: studentId,
      nombre: studentData.nombre,
      email: studentData.email
    });
    
    // 2. Verificar si existe un perfil en users con el ID del estudiante
    const studentUserDoc = await getDoc(doc(db, 'users', studentId));
    const studentUserExists = studentUserDoc.exists();
    const studentUserData = studentUserExists ? studentUserDoc.data() : null;
    
    console.log('📋 Perfil del estudiante en users:', {
      existe: studentUserExists,
      datos: studentUserData
    });
    
    // 3. Verificar si existe un perfil en users con el UID de Google Auth
    const googleAuthUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const googleAuthUserExists = googleAuthUserDoc.exists();
    const googleAuthUserData = googleAuthUserExists ? googleAuthUserDoc.data() : null;
    
    console.log('📋 Perfil con UID de Google Auth en users:', {
      existe: googleAuthUserExists,
      datos: googleAuthUserData
    });
    
    // 4. Buscar usuarios vinculados con este UID de Google Auth
    const linkedUsersQuery = query(collection(db, 'users'), where('googleAuthUid', '==', currentUser.uid));
    const linkedUsersSnapshot = await getDocs(linkedUsersQuery);
    
    console.log('🔗 Usuarios vinculados con este UID de Google Auth:', linkedUsersSnapshot.size);
    linkedUsersSnapshot.docs.forEach(doc => {
      console.log('  - ID:', doc.id, 'Datos:', doc.data());
    });
    
    // 5. Análisis del problema
    let problem = '';
    let solution = '';
    
    if (!studentUserExists) {
      problem = 'El estudiante escolar no tiene perfil en la colección users';
      solution = 'Crear perfil en users con ID del estudiante';
    } else if (!studentUserData?.googleAuthUid) {
      problem = 'El estudiante escolar no tiene Google Auth vinculado';
      solution = 'Vincular Google Auth UID al estudiante';
    } else if (studentUserData.googleAuthUid !== currentUser.uid) {
      problem = 'El estudiante escolar tiene un Google Auth UID diferente';
      solution = 'Actualizar Google Auth UID del estudiante';
    } else if (googleAuthUserExists && googleAuthUserData?.subscription === 'FREE') {
      problem = 'Existe un perfil FREE con el UID de Google Auth que interfiere';
      solution = 'Marcar perfil FREE como temporal o eliminarlo';
    } else {
      problem = 'No se detectó problema específico';
      solution = 'Verificar configuración manualmente';
    }
    
    return {
      success: true,
      message: `Diagnóstico completado. Problema: ${problem}. Solución: ${solution}`,
      details: {
        studentId,
        studentName: studentData.nombre,
        studentUserExists,
        studentUserData,
        googleAuthUserExists,
        googleAuthUserData,
        linkedUsersCount: linkedUsersSnapshot.size,
        problem,
        solution
      }
    };
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return {
      success: false,
      message: `Error: ${error}`
    };
  }
};

/**
 * Función para forzar la carga del perfil correcto del estudiante escolar
 */
export const forceLoadSchoolStudentProfile = async (email: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log('🔧 === FORZANDO CARGA DE PERFIL DE ESTUDIANTE ESCOLAR ===');
    console.log('📧 Email del estudiante:', email);
    
    // 1. Buscar el estudiante en schoolStudents
    const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', email));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    if (studentsSnapshot.empty) {
      return { success: false, message: `No se encontró estudiante escolar con email: ${email}` };
    }
    
    const studentDoc = studentsSnapshot.docs[0];
    const studentData = studentDoc.data();
    const studentId = studentDoc.id;
    
    console.log('✅ Estudiante escolar encontrado:', {
      id: studentId,
      nombre: studentData.nombre,
      email: studentData.email
    });
    
    // 2. Verificar si existe un perfil en users con el ID del estudiante
    const studentUserDoc = await getDoc(doc(db, 'users', studentId));
    
    if (!studentUserDoc.exists()) {
      return { success: false, message: 'El estudiante escolar no tiene perfil en la colección users' };
    }
    
    const studentUserData = studentUserDoc.data();
    console.log('📋 Perfil del estudiante en users:', studentUserData);
    
    // 3. Verificar si tiene Google Auth vinculado
    if (!studentUserData.googleAuthUid) {
      return { success: false, message: 'El estudiante escolar no tiene Google Auth vinculado' };
    }
    
    console.log('🔗 Google Auth UID vinculado:', studentUserData.googleAuthUid);
    
    // 4. Buscar si existe un perfil con el UID de Google Auth que sea diferente
    const googleAuthUserDoc = await getDoc(doc(db, 'users', studentUserData.googleAuthUid));
    
    if (googleAuthUserDoc.exists()) {
      const googleAuthUserData = googleAuthUserDoc.data();
      console.log('📋 Perfil con UID de Google Auth:', googleAuthUserData);
      
      // Si el perfil con UID de Google Auth es diferente al estudiante, marcarlo como temporal
      if (googleAuthUserDoc.id !== studentId && googleAuthUserData.subscription === 'FREE') {
        console.log('⚠️ Marcando perfil FREE como temporal...');
        await updateDoc(doc(db, 'users', googleAuthUserDoc.id), {
          subscription: UserSubscriptionType.FREE,
          schoolRole: undefined,
          email: 'temp_' + googleAuthUserDoc.id + '@temp.com',
          updatedAt: serverTimestamp()
        });
        console.log('✅ Perfil FREE marcado como temporal');
      }
    }
    
    // 5. Actualizar el perfil del estudiante para asegurar que esté correcto
    await updateDoc(doc(db, 'users', studentId), {
      subscription: UserSubscriptionType.SCHOOL,
      schoolRole: SchoolRole.STUDENT,
      email: studentData.email,
      nombre: studentData.nombre,
      displayName: studentData.nombre,
      username: studentData.nombre,
      maxNotebooks: 0,
      maxConceptsPerNotebook: 0,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Perfil del estudiante actualizado correctamente');
    
    return {
      success: true,
      message: `Perfil del estudiante escolar cargado correctamente. ID: ${studentId}`,
      details: {
        studentId,
        studentName: studentData.nombre,
        googleAuthUid: studentUserData.googleAuthUid,
        subscription: 'SCHOOL',
        schoolRole: 'STUDENT'
      }
    };
    
  } catch (error) {
    console.error('❌ Error forzando carga de perfil:', error);
    return {
      success: false,
      message: `Error: ${error}`
    };
  }
};

/**
 * Función para cambiar al perfil del estudiante escolar desde cualquier cuenta
 */
export const switchToSchoolStudentProfile = async (email: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log('🔄 === CAMBIANDO AL PERFIL DE ESTUDIANTE ESCOLAR ===');
    console.log('📧 Email del estudiante:', email);
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: 'No hay usuario autenticado' };
    }
    
    console.log('👤 Usuario actual:', currentUser.email, 'UID:', currentUser.uid);
    
    // 1. Buscar el estudiante en schoolStudents
    const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', email));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    if (studentsSnapshot.empty) {
      return { success: false, message: `No se encontró estudiante escolar con email: ${email}` };
    }
    
    const studentDoc = studentsSnapshot.docs[0];
    const studentData = studentDoc.data();
    const studentId = studentDoc.id;
    
    console.log('✅ Estudiante escolar encontrado:', {
      id: studentId,
      nombre: studentData.nombre,
      email: studentData.email
    });
    
    // 2. Verificar si existe un perfil en users con el ID del estudiante
    const studentUserDoc = await getDoc(doc(db, 'users', studentId));
    
    if (!studentUserDoc.exists()) {
      return { success: false, message: 'El estudiante escolar no tiene perfil en la colección users' };
    }
    
    const studentUserData = studentUserDoc.data();
    console.log('📋 Perfil del estudiante en users:', studentUserData);
    
    // 3. Actualizar el perfil del estudiante con el UID de Google Auth actual
    await updateDoc(doc(db, 'users', studentId), {
      subscription: UserSubscriptionType.SCHOOL,
      schoolRole: SchoolRole.STUDENT,
      googleAuthUid: currentUser.uid,
      googleAuthEmail: currentUser.email,
      googleAuthDisplayName: currentUser.displayName,
      googleAuthPhotoURL: currentUser.photoURL,
      email: studentData.email,
      nombre: studentData.nombre,
      displayName: studentData.nombre,
      username: studentData.nombre,
      maxNotebooks: 0,
      maxConceptsPerNotebook: 0,
      linkedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Perfil del estudiante vinculado con Google Auth actual');
    
    // 4. Si el usuario actual tiene un perfil diferente, marcarlo como temporal
    if (currentUser.uid !== studentId) {
      console.log('⚠️ Marcando perfil actual como temporal...');
      
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          subscription: UserSubscriptionType.FREE,
          schoolRole: undefined,
          email: 'temp_' + currentUser.uid + '@temp.com',
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Perfil actual marcado como temporal');
      } catch (error) {
        console.log('⚠️ No se pudo marcar perfil actual como temporal:', error);
      }
    }
    
    return {
      success: true,
      message: `Cambiado al perfil del estudiante escolar. Recarga la página para ver los cambios.`,
      details: {
        studentId,
        studentName: studentData.nombre,
        googleAuthUid: currentUser.uid
      }
    };
    
  } catch (error) {
    console.error('❌ Error cambiando al perfil del estudiante:', error);
    return {
      success: false,
      message: `Error: ${error}`
    };
  }
};

// Exponer función globalmente para uso en consola
if (typeof window !== 'undefined') {
  (window as any).fixCurrentSchoolStudent = fixCurrentSchoolStudent;
  (window as any).fixDuplicateAutoCreatedUser = fixDuplicateAutoCreatedUser;
  (window as any).checkSchoolStudentBeforeAuth = checkSchoolStudentBeforeAuth;
  (window as any).fixSchoolStudentLinking = fixSchoolStudentLinking;
  (window as any).diagnoseSchoolStudentLinking = diagnoseSchoolStudentLinking;
  (window as any).forceLoadSchoolStudentProfile = forceLoadSchoolStudentProfile;
  (window as any).switchToSchoolStudentProfile = switchToSchoolStudentProfile;
} 