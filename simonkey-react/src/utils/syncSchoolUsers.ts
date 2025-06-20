import { auth, db } from '../services/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { SchoolTeacher, SchoolStudent, UserSubscriptionType, SchoolRole } from '../types/interfaces';

/**
 * Validar si un email tiene formato válido
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Generar un email válido basado en el nombre y un sufijo
 */
const generateValidEmail = (nombre: string, id: string): string => {
  // Limpiar nombre: quitar espacios, caracteres especiales, convertir a lowercase
  const cleanName = nombre
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 10); // Limitar a 10 caracteres
  
  // Tomar los primeros 6 caracteres del ID para unicidad
  const uniqueId = id.substring(0, 6);
  
  return `${cleanName}.${uniqueId}@school.simonkey.com`;
};

/**
 * Obtener password válido (mínimo 6 caracteres)
 */
const getValidPassword = (originalPassword?: string): string => {
  if (originalPassword && originalPassword.length >= 6) {
    return originalPassword;
  }
  return 'school123'; // Password por defecto de 9 caracteres
};

/**
 * Sincroniza todos los schoolTeachers para crear usuarios reales
 */
export const syncSchoolTeachers = async (): Promise<{
  success: number;
  errors: Array<{ id: string; email: string; error: string }>;
}> => {
  console.log('🔄 Iniciando sincronización de schoolTeachers...');
  
  const results = {
    success: 0,
    errors: [] as Array<{ id: string; email: string; error: string }>
  };

  try {
    // Obtener todos los schoolTeachers
    const teachersQuery = collection(db, 'schoolTeachers');
    const teachersSnapshot = await getDocs(teachersQuery);
    
    console.log(`📚 Encontrados ${teachersSnapshot.docs.length} schoolTeachers para sincronizar`);
    
    for (const teacherDoc of teachersSnapshot.docs) {
      const teacherData = teacherDoc.data() as SchoolTeacher;
      const teacherId = teacherDoc.id;
      
      try {
        console.log(`👨‍🏫 Procesando profesor: ${teacherData.nombre} (${teacherData.email})`);
        
        // Validar email y generar uno válido si es necesario
        let emailToUse = teacherData.email;
        if (!isValidEmail(teacherData.email)) {
          emailToUse = generateValidEmail(teacherData.nombre, teacherId);
          console.log(`📧 Email inválido detectado. Usando: ${emailToUse}`);
        }
        
        // Obtener password válido
        const passwordToUse = getValidPassword(teacherData.password);
        
        // Verificar si ya existe como usuario
        const userExists = await checkIfUserExists(teacherId);
        
        if (userExists) {
          console.log(`✅ Usuario ya existe: ${emailToUse}`);
          // Actualizar datos en la colección users si es necesario
          await updateUserDocument(teacherId, {
            subscription: UserSubscriptionType.SCHOOL,
            schoolRole: SchoolRole.TEACHER,
            nombre: teacherData.nombre,
            email: emailToUse,
            username: teacherData.nombre,
            displayName: teacherData.nombre
          });
          results.success++;
          continue;
        }
        
        // Crear usuario en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          emailToUse, 
          passwordToUse
        );
        
        const newUser = userCredential.user;
        console.log(`✅ Usuario creado en Firebase Auth: ${newUser.uid}`);
        
        // Crear/actualizar documento en colección users
        await setDoc(doc(db, 'users', newUser.uid), {
          id: newUser.uid,
          email: emailToUse,
          username: teacherData.nombre,
          nombre: teacherData.nombre,
          displayName: teacherData.nombre,
          birthdate: '',
          subscription: UserSubscriptionType.SCHOOL,
          schoolRole: SchoolRole.TEACHER,
          schoolId: teacherData.idAdmin,
          notebookCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Campos específicos para profesores
          maxNotebooks: 999,
          maxConceptsPerNotebook: 999,
          canDeleteAndRecreate: false
        });
        
        // Actualizar el documento schoolTeachers con el UID correcto y email válido
        await setDoc(doc(db, 'schoolTeachers', newUser.uid), {
          ...teacherData,
          id: newUser.uid,
          email: emailToUse, // Usar el email válido
          password: passwordToUse, // Usar el password válido
          updatedAt: serverTimestamp()
        });
        
        // Si el ID original era diferente, eliminar el documento anterior
        if (teacherId !== newUser.uid) {
          // Nota: Aquí podrías eliminar el documento anterior si quieres
          console.log(`📝 Nota: ID original ${teacherId} → nuevo ID ${newUser.uid}`);
        }
        
        console.log(`✅ Profesor sincronizado: ${teacherData.nombre} con email: ${emailToUse}`);
        results.success++;
        
        // Cerrar sesión para no interferir con otros usuarios
        await signOut(auth);
        
      } catch (error: any) {
        console.error(`❌ Error sincronizando profesor ${teacherData.email}:`, error);
        results.errors.push({
          id: teacherId,
          email: teacherData.email,
          error: error.message
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error general en sincronización de profesores:', error);
  }
  
  console.log(`🎯 Sincronización de profesores completada: ${results.success} exitosos, ${results.errors.length} errores`);
  return results;
};

/**
 * Sincroniza todos los schoolStudents para crear usuarios reales
 */
export const syncSchoolStudents = async (): Promise<{
  success: number;
  errors: Array<{ id: string; email: string; error: string }>;
}> => {
  console.log('🔄 Iniciando sincronización de schoolStudents...');
  
  const results = {
    success: 0,
    errors: [] as Array<{ id: string; email: string; error: string }>
  };

  try {
    // Obtener todos los schoolStudents
    const studentsQuery = collection(db, 'schoolStudents');
    const studentsSnapshot = await getDocs(studentsQuery);
    
    console.log(`👨‍🎓 Encontrados ${studentsSnapshot.docs.length} schoolStudents para sincronizar`);
    
    for (const studentDoc of studentsSnapshot.docs) {
      const studentData = studentDoc.data() as SchoolStudent;
      const studentId = studentDoc.id;
      
      try {
        console.log(`👨‍🎓 Procesando estudiante: ${studentData.nombre} (${studentData.email})`);
        
        // Validar email y generar uno válido si es necesario
        let emailToUse = studentData.email;
        if (!isValidEmail(studentData.email)) {
          emailToUse = generateValidEmail(studentData.nombre, studentId);
          console.log(`📧 Email inválido detectado. Usando: ${emailToUse}`);
        }
        
        // Obtener password válido
        const passwordToUse = getValidPassword(studentData.password);
        
        // Verificar si ya existe como usuario
        const userExists = await checkIfUserExists(studentId);
        
        if (userExists) {
          console.log(`✅ Usuario ya existe: ${emailToUse}`);
          // Actualizar datos en la colección users si es necesario
          await updateUserDocument(studentId, {
            subscription: UserSubscriptionType.SCHOOL,
            schoolRole: SchoolRole.STUDENT,
            nombre: studentData.nombre,
            email: emailToUse,
            username: studentData.nombre,
            displayName: studentData.nombre
          });
          results.success++;
          continue;
        }
        
        // Crear usuario en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          emailToUse, 
          passwordToUse
        );
        
        const newUser = userCredential.user;
        console.log(`✅ Usuario creado en Firebase Auth: ${newUser.uid}`);
        
        // Crear/actualizar documento en colección users
        await setDoc(doc(db, 'users', newUser.uid), {
          id: newUser.uid,
          email: emailToUse,
          username: studentData.nombre,
          nombre: studentData.nombre,
          displayName: studentData.nombre,
          birthdate: '',
          subscription: UserSubscriptionType.SCHOOL,
          schoolRole: SchoolRole.STUDENT,
          notebookCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Campos específicos para estudiantes
          maxNotebooks: 0, // No pueden crear cuadernos
          maxConceptsPerNotebook: 0, // No pueden crear conceptos
          canDeleteAndRecreate: false
        });
        
        // Actualizar el documento schoolStudents con el UID correcto y email válido
        await setDoc(doc(db, 'schoolStudents', newUser.uid), {
          ...studentData,
          id: newUser.uid,
          email: emailToUse, // Usar el email válido
          password: passwordToUse, // Usar el password válido
          updatedAt: serverTimestamp()
        });
        
        // Si el ID original era diferente, eliminar el documento anterior
        if (studentId !== newUser.uid) {
          console.log(`📝 Nota: ID original ${studentId} → nuevo ID ${newUser.uid}`);
        }
        
        console.log(`✅ Estudiante sincronizado: ${studentData.nombre} con email: ${emailToUse}`);
        results.success++;
        
        // Cerrar sesión para no interferir con otros usuarios
        await signOut(auth);
        
      } catch (error: any) {
        console.error(`❌ Error sincronizando estudiante ${studentData.email}:`, error);
        results.errors.push({
          id: studentId,
          email: studentData.email,
          error: error.message
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error general en sincronización de estudiantes:', error);
  }
  
  console.log(`🎯 Sincronización de estudiantes completada: ${results.success} exitosos, ${results.errors.length} errores`);
  return results;
};

/**
 * Sincroniza tanto profesores como estudiantes
 */
export const syncAllSchoolUsers = async (): Promise<{
  teachers: { success: number; errors: Array<{ id: string; email: string; error: string }> };
  students: { success: number; errors: Array<{ id: string; email: string; error: string }> };
}> => {
  console.log('🚀 Iniciando sincronización completa de usuarios escolares...');
  
  const teachersResult = await syncSchoolTeachers();
  const studentsResult = await syncSchoolStudents();
  
  console.log('🎉 Sincronización completa finalizada');
  console.log(`📊 Resumen:`);
  console.log(`   👨‍🏫 Profesores: ${teachersResult.success} exitosos, ${teachersResult.errors.length} errores`);
  console.log(`   👨‍🎓 Estudiantes: ${studentsResult.success} exitosos, ${studentsResult.errors.length} errores`);
  
  return {
    teachers: teachersResult,
    students: studentsResult
  };
};

/**
 * Verificar si un usuario ya existe en la colección users
 */
const checkIfUserExists = async (userId: string): Promise<boolean> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    return userDoc.exists();
  } catch (error) {
    return false;
  }
};

/**
 * Actualizar documento de usuario existente
 */
const updateUserDocument = async (userId: string, updates: any): Promise<void> => {
  try {
    await setDoc(doc(db, 'users', userId), {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating user document:', error);
  }
};

/**
 * Crear un nuevo usuario escolar (profesor o estudiante) de forma completa
 */
export const createSchoolUser = async (
  userData: {
    email: string;
    nombre: string;
    password?: string;
    role: 'teacher' | 'student';
    additionalData?: any;
  }
): Promise<string> => {
  try {
    console.log(`🔄 Creando usuario escolar: ${userData.nombre} (${userData.role})`);
    
    // Validar email y generar uno válido si es necesario
    let emailToUse = userData.email;
    if (!isValidEmail(userData.email)) {
      emailToUse = generateValidEmail(userData.nombre, Date.now().toString());
      console.log(`📧 Email inválido detectado. Usando: ${emailToUse}`);
    }
    
    // Obtener password válido
    const passwordToUse = getValidPassword(userData.password);
    
    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      emailToUse,
      passwordToUse
    );
    
    const newUser = userCredential.user;
    
    // Crear documento en colección users
    await setDoc(doc(db, 'users', newUser.uid), {
      id: newUser.uid,
      email: emailToUse,
      username: userData.nombre,
      nombre: userData.nombre,
      displayName: userData.nombre,
      birthdate: '',
      subscription: UserSubscriptionType.SCHOOL,
      schoolRole: userData.role === 'teacher' ? SchoolRole.TEACHER : SchoolRole.STUDENT,
      notebookCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      maxNotebooks: userData.role === 'teacher' ? 999 : 0,
      maxConceptsPerNotebook: userData.role === 'teacher' ? 999 : 0,
      canDeleteAndRecreate: false,
      ...userData.additionalData
    });
    
    // Crear documento en colección específica (schoolTeachers o schoolStudents)
    const collectionName = userData.role === 'teacher' ? 'schoolTeachers' : 'schoolStudents';
    await setDoc(doc(db, collectionName, newUser.uid), {
      id: newUser.uid,
      nombre: userData.nombre,
      email: emailToUse,
      password: passwordToUse,
      subscription: UserSubscriptionType.SCHOOL,
      createdAt: serverTimestamp(),
      ...userData.additionalData
    });
    
    console.log(`✅ Usuario escolar creado: ${userData.nombre} (ID: ${newUser.uid}) con email: ${emailToUse}`);
    
    // Cerrar sesión
    await signOut(auth);
    
    return newUser.uid;
    
  } catch (error: any) {
    console.error('❌ Error creando usuario escolar:', error);
    throw error;
  }
}; 