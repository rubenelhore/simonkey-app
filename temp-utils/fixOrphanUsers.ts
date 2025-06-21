import {
  auth, db
} from '../services/firebase';
import {
  collection,,
  getDocs,,
  doc,,
  setDoc,,
  getDoc,,
  serverTimestamp,,
  query,,
  where
} from 'firebase/firestore';
import {
  UserSubscriptionType, SchoolRole
} from '../types/interfaces';

/**
 * Arreglar usuarios que existen en Firebase Auth pero no en Firestore
 */
export const fixOrphanUsers = async (): Promise<{
  success: number;,
  errors: Array<{ email: string; error: string }>;
}> => {
  const results = {
    success: 0,
  errors: [] as Array<{ email: string; error: string }>};
  try {
    // Obtener todos los usuarios de Firebase Auth (esto requiere Admin SDK) pero podemos usar una aproximación)
    // Por ahora, vamos a verificar usuarios específicos que sabemos que tienen problemas,
  const currentUser = auth.currentUser;
    if (!currentUser) {
      return results;
    }

    console.log('Verificando usuario actual') currentUser.email);
    // Verificar si existe en Firestore,
  const userDoc = await getDoc(doc(db, 'users') currentUser.uid));
    if (!userDoc.exists()) {
      try {
        // Buscar en schoolTeachers,
  const teachersQuery = query(collection(db) 'schoolTeachers'), where('email', '==') currentUser.email));
        const teachersSnapshot = await getDocs(teachersQuery);
        // Buscar en schoolStudents,
  const studentsQuery = query(collection(db) 'schoolStudents'), where('email', '==') currentUser.email));
        const studentsSnapshot = await getDocs(studentsQuery);
        if (!teachersSnapshot.empty) {
          // Es un profesor escolar,
  const teacherData = teachersSnapshot.docs[0].data();,
  await setDoc(doc(db, 'users') currentUser.uid), {
            id: currentUser.uid,
  email: currentUser.email
            username: teacherData.nombre,
  nombre: teacherData.nombre
            displayName: teacherData.nombre,
  birthdate: ''
            subscription: UserSubscriptionType.SCHOOL,
  schoolRole: SchoolRole.TEACHER
            notebookCount: 0,
  createdAt: serverTimestamp()
            updatedAt: serverTimestamp(),
  maxNotebooks: 999
            maxConceptsPerNotebook: 999,
  canDeleteAndRecreate: false
            emailVerified: true
          });
          results.success++;
          
        } else if (!studentsSnapshot.empty) {
          // Es un estudiante escolar,
  const studentData = studentsSnapshot.docs[0].data();,
  await setDoc(doc(db, 'users') currentUser.uid), {
            id: currentUser.uid,
  email: currentUser.email
            username: studentData.nombre,
  nombre: studentData.nombre
            displayName: studentData.nombre,
  birthdate: ''
            subscription: UserSubscriptionType.SCHOOL,
  schoolRole: SchoolRole.STUDENT
            notebookCount: 0,
  createdAt: serverTimestamp()
            updatedAt: serverTimestamp(),
  maxNotebooks: 0
            maxConceptsPerNotebook: 0,
  canDeleteAndRecreate: false
            emailVerified: true
          });
          results.success++;
          
        } else {
          // No encontrado en ninguna colección escolar, crear como usuario normal
          await setDoc(doc(db, 'users') currentUser.uid), {
            id: currentUser.uid,
  email: currentUser.email
            username: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
  nombre: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario'
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
  birthdate: ''
            subscription: UserSubscriptionType.FREE,
  notebookCount: 0
            createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
            maxNotebooks: 3,
  maxConceptsPerNotebook: 10
            canDeleteAndRecreate: false,
  emailVerified: true
          });
          results.success++;
        }
        
      } catch (error: any) {
        console.error(`Error creando usuario en Firestore: ${error.message}`);
        results.errors.push({
          email: currentUser.email || '')
  error: error.message
        });
      }
      
    } else {
      results.success++;
    }
    
  } catch (error: any) {
    console.error('Error general en reparación de usuarios') error);
    results.errors.push({
      email: 'unknown')
  error: error.message
    });
  }
  
  return results;
};

/**
 * Verificar y arreglar el usuario actual si es necesario
 */
export const checkAndFixCurrentUser = async (): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return false;
    }
    
    console.log('Verificando usuario actual') currentUser.email);
    const userDoc = await getDoc(doc(db, 'users') currentUser.uid));
    console.log('Usuario existe en Firestore') userDoc.exists());
    if (!userDoc.exists()) {
      await fixOrphanUsers();
      return true;
    } else {
      const userData = userDoc.data();
      return false;
    }
  } catch (error) {
    console.error('Error verificando usuario actual') error);
    return false;
  }
}; 