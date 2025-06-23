import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

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

/**
 * Migra usuarios existentes que tienen schoolRole: 'student' pero no están en schoolStudents
 */
export const migrateExistingStudents = async (): Promise<{
  success: number;
  errors: Array<{ id: string; email: string; error: string }>;
}> => {
  console.log('🔄 Iniciando migración de estudiantes existentes...');
  
  const results = {
    success: 0,
    errors: [] as Array<{ id: string; email: string; error: string }>
  };

  try {
    // Obtener todos los usuarios con schoolRole: 'student'
    const usersQuery = query(
      collection(db, 'users'),
      where('schoolRole', '==', 'student')
    );
    const usersSnapshot = await getDocs(usersQuery);
    
    console.log(`📚 Encontrados ${usersSnapshot.docs.length} usuarios con schoolRole: 'student'`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      try {
        console.log(`👨‍🎓 Procesando usuario estudiante: ${userData.nombre} (${userData.email})`);
        
        // Verificar si ya existe en schoolStudents
        const studentQuery = query(
          collection(db, 'schoolStudents'),
          where('id', '==', userId)
        );
        const studentSnapshot = await getDocs(studentQuery);
        
        if (!studentSnapshot.empty) {
          console.log(`✅ Usuario ya existe en schoolStudents: ${userData.email}`);
          results.success++;
          continue;
        }
        
        // Crear registro en schoolStudents
        await setDoc(doc(db, 'schoolStudents', userId), {
          id: userId,
          nombre: userData.nombre || userData.displayName || userData.username || 'Estudiante',
          email: userData.email,
          password: '1234', // Password por defecto
          subscription: UserSubscriptionType.SCHOOL,
          idAdmin: '', // Se vinculará después
          idTeacher: '', // Se vinculará después
          idNotebook: '', // Se vinculará después
          createdAt: userData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log(`✅ Estudiante migrado a schoolStudents: ${userData.nombre}`);
        results.success++;
        
      } catch (error: any) {
        console.error(`❌ Error migrando estudiante ${userData.email}:`, error);
        results.errors.push({
          id: userId,
          email: userData.email,
          error: error.message
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error general en migración de estudiantes:', error);
  }
  
  console.log(`🎯 Migración de estudiantes completada: ${results.success} exitosos, ${results.errors.length} errores`);
  return results;
};

/**
 * Migra tanto profesores como estudiantes existentes
 */
export const migrateAllExistingSchoolUsers = async (): Promise<{
  teachers: { success: number; errors: Array<{ id: string; email: string; error: string }> };
  students: { success: number; errors: Array<{ id: string; email: string; error: string }> };
}> => {
  console.log('🚀 Iniciando migración completa de usuarios escolares existentes...');
  
  const teachersResult = await migrateExistingTeachers();
  const studentsResult = await migrateExistingStudents();
  
  console.log('🎉 Migración completa finalizada');
  return {
    teachers: teachersResult,
    students: studentsResult
  };
};

/**
 * Verifica el estado de sincronización de un usuario específico
 */
export const checkUserSyncStatus = async (userId: string): Promise<{
  existsInUsers: boolean;
  existsInTeachers: boolean;
  existsInStudents: boolean;
  userData?: any;
  teacherData?: any;
  studentData?: any;
}> => {
  try {
    // Verificar en users
    const userDoc = await getDoc(doc(db, 'users', userId));
    const existsInUsers = userDoc.exists();
    const userData = existsInUsers ? userDoc.data() : null;
    
    // Verificar en schoolTeachers
    const teacherQuery = query(collection(db, 'schoolTeachers'), where('id', '==', userId));
    const teacherSnapshot = await getDocs(teacherQuery);
    const existsInTeachers = !teacherSnapshot.empty;
    const teacherData = existsInTeachers ? teacherSnapshot.docs[0].data() : null;
    
    // Verificar en schoolStudents
    const studentQuery = query(collection(db, 'schoolStudents'), where('id', '==', userId));
    const studentSnapshot = await getDocs(studentQuery);
    const existsInStudents = !studentSnapshot.empty;
    const studentData = existsInStudents ? studentSnapshot.docs[0].data() : null;
    
    return {
      existsInUsers,
      existsInTeachers,
      existsInStudents,
      userData,
      teacherData,
      studentData
    };
    
  } catch (error) {
    console.error('Error verificando estado de sincronización:', error);
    throw error;
  }
}; 