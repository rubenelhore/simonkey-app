import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  query, 
  where, 
  serverTimestamp,
  deleteDoc 
} from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

/**
 * Crea un usuario de prueba para verificar el sistema de réplicas
 */
export const createTestUserForReplica = async (): Promise<{
  success: boolean;
  userId: string;
  message: string;
}> => {
  try {
    console.log('🧪 Creando usuario de prueba para verificar sistema de réplicas...');
    
    // Generar ID único
    const userId = `test_replica_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Crear usuario de prueba en la colección users
    const testUserData = {
      id: userId,
      email: `test_replica_${Date.now()}@test.com`,
      nombre: 'Usuario de Prueba Réplica',
      displayName: 'Usuario de Prueba Réplica',
      username: 'test_replica_user',
      birthdate: '',
      subscription: UserSubscriptionType.SCHOOL,
      schoolRole: SchoolRole.TEACHER,
      notebookCount: 0,
      maxNotebooks: 999,
      maxConceptsPerNotebook: 999,
      canDeleteAndRecreate: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'users', userId), testUserData);
    
    console.log('✅ Usuario de prueba creado:', userId);
    
    return {
      success: true,
      userId,
      message: `Usuario de prueba creado exitosamente con ID: ${userId}`
    };
    
  } catch (error: any) {
    console.error('❌ Error creando usuario de prueba:', error);
    return {
      success: false,
      userId: '',
      message: `Error: ${error.message}`
    };
  }
};

/**
 * Verifica que las réplicas se crearon correctamente
 */
export const verifyReplicaCreation = async (userId: string): Promise<{
  success: boolean;
  message: string;
  details: {
    existsInUsers: boolean;
    existsInTeachers: boolean;
    existsInStudents: boolean;
    userData?: any;
    teacherData?: any;
    studentData?: any;
  };
}> => {
  try {
    console.log(`🔍 Verificando réplicas para usuario: ${userId}`);
    
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
    
    const details = {
      existsInUsers,
      existsInTeachers,
      existsInStudents,
      userData,
      teacherData,
      studentData
    };
    
    // Verificar que las réplicas están correctas según el rol
    let success = false;
    let message = '';
    
    if (userData?.schoolRole === SchoolRole.TEACHER) {
      if (existsInUsers && existsInTeachers && !existsInStudents) {
        success = true;
        message = '✅ Sistema de réplicas funcionando correctamente para PROFESOR';
      } else {
        success = false;
        message = '❌ Error en sistema de réplicas para PROFESOR';
      }
    } else if (userData?.schoolRole === SchoolRole.STUDENT) {
      if (existsInUsers && existsInStudents && !existsInTeachers) {
        success = true;
        message = '✅ Sistema de réplicas funcionando correctamente para ESTUDIANTE';
      } else {
        success = false;
        message = '❌ Error en sistema de réplicas para ESTUDIANTE';
      }
    } else {
      success = false;
      message = '❌ Usuario no tiene rol escolar asignado';
    }
    
    return { success, message, details };
    
  } catch (error: any) {
    console.error('❌ Error verificando réplicas:', error);
    return {
      success: false,
      message: `Error verificando réplicas: ${error.message}`,
      details: {
        existsInUsers: false,
        existsInTeachers: false,
        existsInStudents: false
      }
    };
  }
};

/**
 * Limpia los datos de prueba
 */
export const cleanupTestData = async (userId: string): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    console.log(`🧹 Limpiando datos de prueba para usuario: ${userId}`);
    
    // Eliminar de users
    await deleteDoc(doc(db, 'users', userId));
    console.log('✅ Usuario eliminado de users');
    
    // Eliminar de schoolTeachers
    const teacherQuery = query(collection(db, 'schoolTeachers'), where('id', '==', userId));
    const teacherSnapshot = await getDocs(teacherQuery);
    if (!teacherSnapshot.empty) {
      await deleteDoc(doc(db, 'schoolTeachers', userId));
      console.log('✅ Usuario eliminado de schoolTeachers');
    }
    
    // Eliminar de schoolStudents
    const studentQuery = query(collection(db, 'schoolStudents'), where('id', '==', userId));
    const studentSnapshot = await getDocs(studentQuery);
    if (!studentSnapshot.empty) {
      await deleteDoc(doc(db, 'schoolStudents', userId));
      console.log('✅ Usuario eliminado de schoolStudents');
    }
    
    return {
      success: true,
      message: '✅ Datos de prueba limpiados exitosamente'
    };
    
  } catch (error: any) {
    console.error('❌ Error limpiando datos de prueba:', error);
    return {
      success: false,
      message: `Error limpiando datos: ${error.message}`
    };
  }
};

/**
 * Ejecuta una prueba completa del sistema de réplicas
 */
export const runCompleteReplicaTest = async (): Promise<{
  success: boolean;
  message: string;
  testUserId?: string;
}> => {
  try {
    console.log('🚀 Iniciando prueba completa del sistema de réplicas...');
    
    // 1. Crear usuario de prueba
    const createResult = await createTestUserForReplica();
    if (!createResult.success) {
      return {
        success: false,
        message: `Error creando usuario de prueba: ${createResult.message}`
      };
    }
    
    const testUserId = createResult.userId;
    console.log('✅ Usuario de prueba creado:', testUserId);
    
    // 2. Esperar un momento para que se procesen las réplicas
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Verificar que las réplicas se crearon
    const verifyResult = await verifyReplicaCreation(testUserId);
    
    // 4. Limpiar datos de prueba
    await cleanupTestData(testUserId);
    
    if (verifyResult.success) {
      return {
        success: true,
        message: '🎉 Prueba completa exitosa: Sistema de réplicas funcionando correctamente',
        testUserId
      };
    } else {
      return {
        success: false,
        message: `❌ Prueba fallida: ${verifyResult.message}`,
        testUserId
      };
    }
    
  } catch (error: any) {
    console.error('❌ Error en prueba completa:', error);
    return {
      success: false,
      message: `Error en prueba completa: ${error.message}`
    };
  }
}; 