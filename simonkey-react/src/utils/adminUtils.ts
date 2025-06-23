import { db, auth } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp,
  query,
  where,
  deleteDoc
} from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

/**
 * Actualizar usuario actual como super admin
 * Solo funciona si el email es ruben.elhore@gmail.com
 */
export const updateCurrentUserAsSuperAdmin = async () => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.error('No hay usuario autenticado');
      return false;
    }

    if (currentUser.email !== 'ruben.elhore@gmail.com' && currentUser.email !== 'santiagoarceofel@gmail.com') {
      console.error('Solo ruben.elhore@gmail.com o santiagoarceofel@gmail.com pueden ser super admin');
      return false;
    }

    console.log('Actualizando usuario como Super Admin...');
    
    // Verificar si el documento existe
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.error('Documento de usuario no encontrado');
      return false;
    }

    // Actualizar el usuario como super admin
    await setDoc(userDocRef, {
      subscription: UserSubscriptionType.SUPER_ADMIN,
      maxNotebooks: -1,
      maxConceptsPerNotebook: -1,
      notebooksCreatedThisWeek: 0,
      conceptsCreatedThisWeek: 0,
      weekStartDate: new Date()
    }, { merge: true });

    console.log('✅ Usuario actualizado exitosamente como Super Admin');
    console.log('Recarga la página para ver los cambios');
    
    return true;
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return false;
  }
};

/**
 * Crear admin faltante para casos específicos
 */
export const createMissingAdmin = async (adminId: string, adminName: string, institutionId: string) => {
  try {
    console.log('🔧 Creando admin faltante...');
    
    await setDoc(doc(db, 'schoolAdmins', adminId), {
      id: adminId,
      nombre: adminName,
      email: 'admin@escuela.edu.mx',
      password: '1234',
      idInstitucion: institutionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Admin creado exitosamente!');
    return true;
  } catch (error) {
    console.error('❌ Error creando admin:', error);
    return false;
  }
};

/**
 * Verificar y arreglar el usuario actual si es necesario
 */
export const checkAndFixCurrentUser = async (): Promise<boolean> => {
  try {
    console.log('🔧 checkAndFixCurrentUser - Iniciando verificación...');
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('🔧 checkAndFixCurrentUser - No hay usuario autenticado');
      return false;
    }
    
    console.log(`🔧 checkAndFixCurrentUser - Verificando usuario: ${currentUser.email} (${currentUser.uid})`);
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    console.log(`🔧 checkAndFixCurrentUser - Documento existe: ${userDoc.exists()}`);
    
    if (!userDoc.exists()) {
      console.log(`🔧 Usuario huérfano detectado: ${currentUser.email}`);
      // Usar la cloud function para arreglar usuarios huérfanos
      const { fixOrphanUsers } = await import('../services/firebaseFunctions');
      await fixOrphanUsers(currentUser.uid);
      return true;
    } else {
      console.log(`🔧 Usuario ya existe en Firestore: ${currentUser.email}`);
      const userData = userDoc.data();
      console.log(`🔧 Datos del usuario:`, userData);
      return false;
    }
  } catch (error) {
    console.error('Error verificando usuario actual:', error);
    return false;
  }
};

// Función global para actualizar el perfil del usuario con idNotebook
export const updateUserProfileWithNotebook = async (userId: string, notebookId: string) => {
  try {
    console.log('🔧 Actualizando perfil del usuario...');
    
    const { doc, updateDoc } = await import('../services/firebase');
    const { db } = await import('../services/firebase');
    
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      idNotebook: notebookId
    });
    
    console.log('✅ Perfil del usuario actualizado con idNotebook:', notebookId);
    return true;
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    return false;
  }
};

// Función global para completar el proceso de asignación de notebooks
export const completeNotebookAssignment = async (studentEmail: string) => {
  try {
    console.log('🔍 Buscando estudiante:', studentEmail);
    
    const { query, collection, where, getDocs, updateDoc, doc } = await import('../services/firebase');
    const { db } = await import('../services/firebase');
    
    // Buscar el estudiante en schoolStudents
    const studentQuery = query(
      collection(db, 'schoolStudents'),
      where('email', '==', studentEmail)
    );
    const studentSnapshot = await getDocs(studentQuery);
    
    if (studentSnapshot.empty) {
      console.log('❌ No se encontró el estudiante en schoolStudents');
      return false;
    }

    const studentData = studentSnapshot.docs[0].data();
    console.log('👨‍🎓 Estudiante encontrado:', studentData.nombre);
    console.log('📚 idNotebook:', studentData.idNotebook);

    if (!studentData.idNotebook) {
      console.log('❌ El estudiante no tiene idNotebook asignado');
      return false;
    }

    // Actualizar el perfil del usuario en users
    const userRef = doc(db, 'users', studentData.id);
    await updateDoc(userRef, {
      idNotebook: studentData.idNotebook
    });
    
    console.log('✅ Perfil del usuario actualizado con idNotebook:', studentData.idNotebook);
    console.log('💡 El estudiante puede recargar la página para ver los notebooks');
    return true;

  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
};

// Exponer funciones globalmente para uso en consola
if (typeof window !== 'undefined') {
  (window as any).updateAsSuperAdmin = updateCurrentUserAsSuperAdmin;
  (window as any).createMissingAdmin = createMissingAdmin;
  (window as any).checkAndFixCurrentUser = checkAndFixCurrentUser;
  (window as any).updateUserProfileWithNotebook = updateUserProfileWithNotebook;
  (window as any).completeNotebookAssignment = completeNotebookAssignment;
  
  // Función específica para el estudiante actual
  (window as any).fixCurrentStudentNotebook = async () => {
    return await completeNotebookAssignment('0161875@up.edu.mx');
  };
  
  // Función para actualizar directamente el usuario específico
  (window as any).fixUserNotebookDirect = async () => {
    return await updateUserProfileWithNotebook('u1fRjwpdmOPFTtlEUsMGiWnqwST2', '1vKFhWs3IX2AbDDt853l');
  };
} 