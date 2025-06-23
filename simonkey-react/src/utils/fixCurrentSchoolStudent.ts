import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
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

// Exponer función globalmente para uso en consola
if (typeof window !== 'undefined') {
  (window as any).fixCurrentSchoolStudent = fixCurrentSchoolStudent;
  (window as any).fixDuplicateAutoCreatedUser = fixDuplicateAutoCreatedUser;
} 