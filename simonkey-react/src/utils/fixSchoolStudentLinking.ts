import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

/**
 * Función específica para arreglar el problema de vinculación de estudiantes escolares
 * Este problema ocurre cuando un estudiante intenta acceder y se crea una nueva cuenta
 * en lugar de usar la existente en schoolStudents
 */
export const fixSchoolStudentLinking = async (email?: string) => {
  console.log('🔧 === ARREGLANDO VINCULACIÓN DE SCHOOL STUDENT ===');
  
  const currentUser = auth.currentUser;
  const userEmail = email || currentUser?.email;
  
  if (!userEmail) {
    console.log('❌ No hay email disponible para arreglar');
    return { success: false, message: 'No hay email disponible' };
  }
  
  if (!currentUser) {
    console.log('❌ No hay usuario autenticado');
    return { success: false, message: 'No hay usuario autenticado' };
  }
  
  console.log('📧 Email a arreglar:', userEmail);
  
  try {
    // 1. Buscar el estudiante en schoolStudents
    console.log('\n🔍 1. Buscando en schoolStudents...');
    const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', userEmail));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    if (studentsSnapshot.empty) {
      console.log('❌ No se encontró estudiante en schoolStudents');
      return { success: false, message: 'No se encontró estudiante en schoolStudents' };
    }
    
    const studentDoc = studentsSnapshot.docs[0];
    const studentData = studentDoc.data();
    console.log('✅ Estudiante encontrado en schoolStudents:', studentData);
    
    // 2. Verificar si existe en users con el UID de Google Auth
    console.log('\n🔍 2. Verificando en users con UID de Google Auth...');
    let userExistsWithGoogleUID = false;
    let userDocWithGoogleUID: any = null;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        userExistsWithGoogleUID = true;
        userDocWithGoogleUID = userDoc;
        console.log('⚠️ Existe usuario en users con UID de Google Auth:', userDoc.data());
      }
    } catch (error) {
      console.log('✅ No existe usuario en users con UID de Google Auth');
    }
    
    // 3. Verificar si existe en users con el email
    console.log('\n🔍 3. Verificando en users con email...');
    const usersQuery = query(collection(db, 'users'), where('email', '==', userEmail));
    const usersSnapshot = await getDocs(usersQuery);
    
    let userExistsWithEmail = false;
    let userDocWithEmail: any = null;
    
    if (!usersSnapshot.empty) {
      userExistsWithEmail = true;
      userDocWithEmail = usersSnapshot.docs[0];
      console.log('⚠️ Existe usuario en users con email:', userDocWithEmail.data());
    }
    
    // 4. Determinar la acción a tomar
    console.log('\n🔍 4. Determinando acción...');
    
    if (userExistsWithGoogleUID && userExistsWithEmail) {
      // Caso más complejo: hay dos usuarios, uno con UID y otro con email
      console.log('⚠️ Caso complejo: existen dos usuarios');
      
      const userWithUID = userDocWithGoogleUID.data();
      const userWithEmail = userDocWithEmail.data();
      
      // Si el usuario con email es el correcto (tiene subscription SCHOOL)
      if (userWithEmail.subscription === UserSubscriptionType.SCHOOL) {
        console.log('✅ Usuario con email es el correcto, eliminando el de UID...');
        
        // Eliminar el usuario con UID de Google Auth
        await updateDoc(doc(db, 'users', currentUser.uid), {
          subscription: UserSubscriptionType.FREE, // Cambiar a FREE para que no interfiera
          schoolRole: undefined,
          updatedAt: serverTimestamp()
        });
        
        // Actualizar el usuario correcto con la información de Google Auth
        await updateDoc(doc(db, 'users', userDocWithEmail.id), {
          googleAuthUid: currentUser.uid,
          googleAuthEmail: currentUser.email,
          googleAuthDisplayName: currentUser.displayName,
          googleAuthPhotoURL: currentUser.photoURL,
          linkedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Usuario correcto vinculado con Google Auth');
        return { 
          success: true, 
          message: 'Usuario correcto vinculado con Google Auth',
          userId: userDocWithEmail.id
        };
        
      } else {
        // Si el usuario con UID es el correcto
        console.log('✅ Usuario con UID es el correcto, actualizando...');
        
        // Actualizar el usuario con UID para que tenga los datos correctos
        await updateDoc(doc(db, 'users', currentUser.uid), {
          subscription: UserSubscriptionType.SCHOOL,
          schoolRole: SchoolRole.STUDENT,
          email: userEmail,
          nombre: studentData.nombre,
          displayName: studentData.nombre,
          username: studentData.nombre,
          maxNotebooks: 0,
          maxConceptsPerNotebook: 0,
          updatedAt: serverTimestamp()
        });
        
        // Eliminar el usuario con email
        await updateDoc(doc(db, 'users', userDocWithEmail.id), {
          subscription: UserSubscriptionType.FREE,
          schoolRole: undefined,
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Usuario con UID actualizado correctamente');
        return { 
          success: true, 
          message: 'Usuario con UID actualizado correctamente',
          userId: currentUser.uid
        };
      }
      
    } else if (userExistsWithGoogleUID && !userExistsWithEmail) {
      // Solo existe el usuario con UID de Google Auth
      console.log('✅ Solo existe usuario con UID, actualizando...');
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        subscription: UserSubscriptionType.SCHOOL,
        schoolRole: SchoolRole.STUDENT,
        email: userEmail,
        nombre: studentData.nombre,
        displayName: studentData.nombre,
        username: studentData.nombre,
        maxNotebooks: 0,
        maxConceptsPerNotebook: 0,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Usuario con UID actualizado correctamente');
      return { 
        success: true, 
        message: 'Usuario con UID actualizado correctamente',
        userId: currentUser.uid
      };
      
    } else if (!userExistsWithGoogleUID && userExistsWithEmail) {
      // Solo existe el usuario con email
      console.log('✅ Solo existe usuario con email, vinculando con Google Auth...');
      
      await updateDoc(doc(db, 'users', userDocWithEmail.id), {
        googleAuthUid: currentUser.uid,
        googleAuthEmail: currentUser.email,
        googleAuthDisplayName: currentUser.displayName,
        googleAuthPhotoURL: currentUser.photoURL,
        linkedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Usuario con email vinculado con Google Auth');
      return { 
        success: true, 
        message: 'Usuario con email vinculado con Google Auth',
        userId: userDocWithEmail.id
      };
      
    } else {
      // No existe en users, crear nuevo perfil
      console.log('✅ No existe en users, creando nuevo perfil...');
      
      const userProfile = {
        id: studentDoc.id, // Usar el ID del estudiante
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        googleAuthUid: currentUser.uid,
        googleAuthEmail: currentUser.email,
        linkedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'users', studentDoc.id), userProfile);
      console.log('✅ Nuevo perfil creado exitosamente');
      return { 
        success: true, 
        message: 'Nuevo perfil creado exitosamente',
        userId: studentDoc.id
      };
    }
    
  } catch (error) {
    console.error('❌ Error arreglando vinculación de schoolStudent:', error);
    return { 
      success: false, 
      message: `Error: ${error}` 
    };
  }
};

// Exponer función globalmente para uso en consola
if (typeof window !== 'undefined') {
  (window as any).fixSchoolStudentLinking = fixSchoolStudentLinking;
} 