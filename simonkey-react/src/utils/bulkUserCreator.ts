import { auth, db } from '../services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

interface UserToCreate {
  nombre: string;
  correo: string;
  institucion: string;
  isTeacher: boolean;
  password?: string;
}

export const createUserWithoutSignIn = async (userInfo: UserToCreate, superAdminEmail: string, superAdminPassword: string): Promise<string> => {
  // Esta función crea un usuario y luego restaura la sesión del super admin
  
  try {
    // 1. Crear el usuario (esto cerrará la sesión actual temporalmente)
    const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
    const userCredential = await createUserWithEmailAndPassword(auth, userInfo.correo, userInfo.password!);
    const newUserId = userCredential.user.uid;
    
    // 2. Actualizar el displayName
    await updateProfile(userCredential.user, {
      displayName: userInfo.nombre
    });
    
    // 3. Crear el perfil en Firestore
    const userProfile = {
      id: newUserId,
      email: userInfo.correo,
      username: userInfo.nombre,
      nombre: userInfo.nombre,
      displayName: userInfo.nombre,
      birthdate: '',
      subscription: 'SCHOOL',
      schoolRole: userInfo.isTeacher ? 'teacher' : 'student',
      idInstitucion: userInfo.institucion,
      notebookCount: 0,
      maxNotebooks: userInfo.isTeacher ? 999 : 50,
      maxConceptsPerNotebook: userInfo.isTeacher ? 999 : 100,
      canDeleteAndRecreate: false,
      emailVerified: true, // Marcamos como verificado para evitar la pantalla de verificación
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdViaUpload: true,
      uploadedBy: 'super_admin'
    };
    
    await setDoc(doc(db, 'users', newUserId), userProfile);
    
    // 4. Guardar en la colección específica según el rol
    if (userInfo.isTeacher) {
      await setDoc(doc(db, 'schoolTeachers', newUserId), {
        id: newUserId,
        email: userInfo.correo,
        name: userInfo.nombre,
        institution: userInfo.institucion,
        createdAt: Timestamp.now()
      });
    } else {
      await setDoc(doc(db, 'schoolStudents', newUserId), {
        id: newUserId,
        email: userInfo.correo,
        name: userInfo.nombre,
        institution: userInfo.institucion,
        createdAt: Timestamp.now()
      });
    }
    
    // 5. Cerrar sesión del nuevo usuario
    await auth.signOut();
    
    // 6. Re-autenticar al super admin
    await signInWithEmailAndPassword(auth, superAdminEmail, superAdminPassword);
    
    console.log('✅ Usuario creado y sesión de super admin restaurada');
    return newUserId;
    
  } catch (error) {
    console.error('Error en createUserWithoutSignIn:', error);
    
    // Intentar restaurar la sesión del super admin en caso de error
    try {
      await signInWithEmailAndPassword(auth, superAdminEmail, superAdminPassword);
    } catch (reAuthError) {
      console.error('Error restaurando sesión del super admin:', reAuthError);
    }
    
    throw error;
  }
};