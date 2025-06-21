import { auth, db } from '../services/firebase';
import { 
  signInWithEmailAndPassword
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
        
        // Verificar si ya existe como usuario en la colección users
        const userExists = await checkIfUserExists(teacherId);
        
        if (userExists) {
          console.log(`✅ Usuario ya existe en Firestore: ${emailToUse}`);
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
        
        // Crear documento en colección users (sin crear en Firebase Auth)
        await setDoc(doc(db, 'users', teacherId), {
          id: teacherId,
          email: emailToUse,
          username: teacherData.nombre,
          nombre: teacherData.nombre,
          displayName: teacherData.nombre,
          birthdate: '',
          subscription: UserSubscriptionType.SCHOOL,
          schoolRole: SchoolRole.TEACHER,
          notebookCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Campos específicos para profesores
          maxNotebooks: 999,
          maxConceptsPerNotebook: 999,
          canDeleteAndRecreate: false
        });
        
        // Actualizar el documento schoolTeachers con el email válido
        await setDoc(doc(db, 'schoolTeachers', teacherId), {
          ...teacherData,
          email: emailToUse, // Usar el email válido
          password: passwordToUse, // Usar el password válido
          updatedAt: serverTimestamp()
        });
        
        console.log(`✅ Profesor sincronizado en Firestore: ${teacherData.nombre} con email: ${emailToUse}`);
        results.success++;
        
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
        
        // Verificar si ya existe como usuario en la colección users
        const userExists = await checkIfUserExists(studentId);
        
        if (userExists) {
          console.log(`✅ Usuario ya existe en Firestore: ${emailToUse}`);
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
        
        // Crear documento en colección users (sin crear en Firebase Auth)
        await setDoc(doc(db, 'users', studentId), {
          id: studentId,
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
        
        // Actualizar el documento schoolStudents con el email válido
        await setDoc(doc(db, 'schoolStudents', studentId), {
          ...studentData,
          email: emailToUse, // Usar el email válido
          password: passwordToUse, // Usar el password válido
          updatedAt: serverTimestamp()
        });
        
        console.log(`✅ Estudiante sincronizado en Firestore: ${studentData.nombre} con email: ${emailToUse}`);
        results.success++;
        
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
    
    // Generar un ID único para el usuario
    const userId = `school_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Crear documento en colección users (sin crear en Firebase Auth)
    await setDoc(doc(db, 'users', userId), {
      id: userId,
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
    await setDoc(doc(db, collectionName, userId), {
      id: userId,
      nombre: userData.nombre,
      email: emailToUse,
      password: passwordToUse,
      subscription: UserSubscriptionType.SCHOOL,
      createdAt: serverTimestamp(),
      ...userData.additionalData
    });
    
    console.log(`✅ Usuario escolar creado en Firestore: ${userData.nombre} (ID: ${userId}) con email: ${emailToUse}`);
    
    return userId;
    
  } catch (error: any) {
    console.error('❌ Error creando usuario escolar:', error);
    throw error;
  }
};

/**
 * Migra usuarios existentes que tienen schoolRole: 'teacher' pero no están en schoolTeachers
 */
export const migrateExistingTeachers = async (): Promise<{
  success: number;
  errors: Array<{ id: string; email: string; error: string }>;
}> => {
  console.log('🔄 Iniciando migración de profesores existentes...');
  
  const results = {
    success: 0,
    errors: [] as Array<{ id: string; email: string; error: string }>
  };

  try {
    // Obtener todos los usuarios con schoolRole: 'teacher'
    const usersQuery = query(
      collection(db, 'users'),
      where('schoolRole', '==', 'teacher')
    );
    const usersSnapshot = await getDocs(usersQuery);
    
    console.log(`📚 Encontrados ${usersSnapshot.docs.length} usuarios con schoolRole: 'teacher'`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      try {
        console.log(`👨‍🏫 Procesando usuario profesor: ${userData.nombre} (${userData.email})`);
        
        // Verificar si ya existe en schoolTeachers
        const teacherQuery = query(
          collection(db, 'schoolTeachers'),
          where('id', '==', userId)
        );
        const teacherSnapshot = await getDocs(teacherQuery);
        
        if (!teacherSnapshot.empty) {
          console.log(`✅ Usuario ya existe en schoolTeachers: ${userData.email}`);
          results.success++;
          continue;
        }
        
        // Crear registro en schoolTeachers
        await setDoc(doc(db, 'schoolTeachers', userId), {
          id: userId,
          nombre: userData.nombre || userData.displayName || userData.username || 'Profesor',
          email: userData.email,
          password: '1234', // Password por defecto
          subscription: UserSubscriptionType.SCHOOL,
          idAdmin: '', // Se vinculará después
          createdAt: userData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log(`✅ Profesor migrado a schoolTeachers: ${userData.nombre}`);
        results.success++;
        
      } catch (error: any) {
        console.error(`❌ Error migrando profesor ${userData.email}:`, error);
        results.errors.push({
          id: userId,
          email: userData.email,
          error: error.message
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error general en migración de profesores:', error);
  }
  
  console.log(`🎯 Migración de profesores completada: ${results.success} exitosos, ${results.errors.length} errores`);
  return results;
}; 