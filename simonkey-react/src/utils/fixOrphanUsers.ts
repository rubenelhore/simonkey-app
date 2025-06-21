import { auth, db } from '../services/firebase';
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
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

/**
 * Arreglar usuarios que existen en Firebase Auth pero no en Firestore
 */
export const fixOrphanUsers = async (): Promise<{
  success: number;
  errors: Array<{ email: string; error: string }>;
}> => {
  console.log('🔧 Iniciando reparación de usuarios huérfanos...');
  
  const results = {
    success: 0,
    errors: [] as Array<{ email: string; error: string }>
  };

  try {
    // Obtener todos los usuarios de Firebase Auth (esto requiere Admin SDK, pero podemos usar una aproximación)
    // Por ahora, vamos a verificar usuarios específicos que sabemos que tienen problemas
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return results;
    }

    console.log(`🔍 Verificando usuario actual: ${currentUser.email} (${currentUser.uid})`);
    
    // Verificar si existe en Firestore
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    if (!userDoc.exists()) {
      console.log(`⚠️ Usuario ${currentUser.email} no existe en Firestore, creando...`);
      
      try {
        // Buscar en schoolTeachers
        const teachersQuery = query(collection(db, 'schoolTeachers'), where('email', '==', currentUser.email));
        const teachersSnapshot = await getDocs(teachersQuery);
        
        // Buscar en schoolStudents
        const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', currentUser.email));
        const studentsSnapshot = await getDocs(studentsQuery);
        
        if (!teachersSnapshot.empty) {
          // Es un profesor escolar
          const teacherData = teachersSnapshot.docs[0].data();
          console.log(`👨‍🏫 Encontrado en schoolTeachers: ${teacherData.nombre}`);
          
          await setDoc(doc(db, 'users', currentUser.uid), {
            id: currentUser.uid,
            email: currentUser.email,
            username: teacherData.nombre,
            nombre: teacherData.nombre,
            displayName: teacherData.nombre,
            birthdate: '',
            subscription: UserSubscriptionType.SCHOOL,
            schoolRole: SchoolRole.TEACHER,
            notebookCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            maxNotebooks: 999,
            maxConceptsPerNotebook: 999,
            canDeleteAndRecreate: false,
            emailVerified: true
          });
          
          console.log(`✅ Usuario profesor creado en Firestore: ${currentUser.email}`);
          results.success++;
          
        } else if (!studentsSnapshot.empty) {
          // Es un estudiante escolar
          const studentData = studentsSnapshot.docs[0].data();
          console.log(`👨‍🎓 Encontrado en schoolStudents: ${studentData.nombre}`);
          
          await setDoc(doc(db, 'users', currentUser.uid), {
            id: currentUser.uid,
            email: currentUser.email,
            username: studentData.nombre,
            nombre: studentData.nombre,
            displayName: studentData.nombre,
            birthdate: '',
            subscription: UserSubscriptionType.SCHOOL,
            schoolRole: SchoolRole.STUDENT,
            notebookCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            maxNotebooks: 0,
            maxConceptsPerNotebook: 0,
            canDeleteAndRecreate: false,
            emailVerified: true
          });
          
          console.log(`✅ Usuario estudiante creado en Firestore: ${currentUser.email}`);
          results.success++;
          
        } else {
          // No encontrado en ninguna colección escolar, crear como usuario normal
          console.log(`👤 Usuario no encontrado en colecciones escolares, creando como usuario normal`);
          
          await setDoc(doc(db, 'users', currentUser.uid), {
            id: currentUser.uid,
            email: currentUser.email,
            username: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
            nombre: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
            birthdate: '',
            subscription: UserSubscriptionType.FREE,
            notebookCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            maxNotebooks: 3,
            maxConceptsPerNotebook: 10,
            canDeleteAndRecreate: false,
            emailVerified: true
          });
          
          console.log(`✅ Usuario normal creado en Firestore: ${currentUser.email}`);
          results.success++;
        }
        
      } catch (error: any) {
        console.error(`❌ Error creando usuario en Firestore: ${error.message}`);
        results.errors.push({
          email: currentUser.email || '',
          error: error.message
        });
      }
      
    } else {
      console.log(`✅ Usuario ${currentUser.email} ya existe en Firestore`);
      results.success++;
    }
    
  } catch (error: any) {
    console.error('❌ Error general en reparación de usuarios:', error);
    results.errors.push({
      email: 'unknown',
      error: error.message
    });
  }
  
  console.log(`🎯 Reparación completada: ${results.success} exitosos, ${results.errors.length} errores`);
  return results;
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
      await fixOrphanUsers();
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