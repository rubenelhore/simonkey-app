import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { UserProfile, UserSubscriptionType, SchoolRole } from '../types/interfaces';

export const diagnoseStudentProfile = async () => {
  console.log('🔍 === DIAGNÓSTICO DE PERFIL DE ESTUDIANTE ===');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return null;
    }

    console.log('👤 Usuario actual:', user.email);
    console.log('🆔 Auth UID:', user.uid);
    console.log('✅ Email verificado:', user.emailVerified);

    // 1. Intentar obtener el perfil directamente con el UID
    console.log('\n🔍 Buscando perfil con UID directo...');
    const directProfile = await getDoc(doc(db, 'users', user.uid));
    
    if (directProfile.exists()) {
      console.log('✅ Perfil encontrado con UID directo');
      const data = directProfile.data();
      console.log('📋 Datos del perfil:', {
        nombre: data.nombre,
        email: data.email,
        subscription: data.subscription,
        schoolRole: data.schoolRole,
        googleAuthUid: data.googleAuthUid
      });
      return { found: true, profileId: user.uid, profileData: data };
    }

    // 2. Buscar por email
    console.log('\n🔍 Buscando perfil por email...');
    const emailQuery = query(collection(db, 'users'), where('email', '==', user.email));
    const emailSnapshot = await getDocs(emailQuery);
    
    if (!emailSnapshot.empty) {
      console.log(`✅ Se encontraron ${emailSnapshot.size} perfiles con este email`);
      
      emailSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`\n📋 Perfil ID: ${doc.id}`);
        console.log('   - Nombre:', data.nombre);
        console.log('   - Email:', data.email);
        console.log('   - Subscription:', data.subscription);
        console.log('   - School Role:', data.schoolRole);
        console.log('   - Google Auth UID:', data.googleAuthUid);
        console.log('   - ID en datos:', data.id);
      });

      // Priorizar perfil escolar
      const schoolProfile = emailSnapshot.docs.find(doc => 
        doc.data().subscription === UserSubscriptionType.SCHOOL
      );
      
      if (schoolProfile) {
        console.log('\n🏫 Perfil escolar encontrado:', schoolProfile.id);
        return { 
          found: true, 
          profileId: schoolProfile.id, 
          profileData: schoolProfile.data(),
          needsLinking: !schoolProfile.data().googleAuthUid 
        };
      }

      // Si no hay perfil escolar, usar el primero
      const firstProfile = emailSnapshot.docs[0];
      return { 
        found: true, 
        profileId: firstProfile.id, 
        profileData: firstProfile.data(),
        needsLinking: firstProfile.id !== user.uid 
      };
    }

    console.log('❌ No se encontró ningún perfil');
    return { found: false };

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return null;
  }
};

export const fixStudentProfileLoading = async () => {
  console.log('🔧 === ARREGLANDO PERFIL DE ESTUDIANTE ===');
  
  try {
    const diagnosis = await diagnoseStudentProfile();
    
    if (!diagnosis) {
      console.log('❌ No se pudo realizar el diagnóstico');
      return false;
    }

    if (!diagnosis.found) {
      console.log('⚠️ No se encontró perfil, creando uno nuevo...');
      return await createStudentProfile();
    }

    const user = auth.currentUser;
    if (!user) return false;

    // Si el perfil necesita vinculación con Google Auth
    if (diagnosis.needsLinking && diagnosis.profileId) {
      console.log('🔗 Vinculando perfil con Google Auth UID...');
      
      await updateDoc(doc(db, 'users', diagnosis.profileId), {
        googleAuthUid: user.uid,
        updatedAt: new Date()
      });
      
      console.log('✅ Perfil vinculado correctamente');
    }

    // Verificar si el perfil tiene todos los campos necesarios
    const profileData = diagnosis.profileData;
    if (!profileData) {
      console.log('❌ No hay datos de perfil para actualizar');
      return false;
    }
    
    const updates: any = {};

    if (!profileData.nombre || profileData.nombre === '') {
      updates.nombre = user.displayName || user.email?.split('@')[0] || 'Estudiante';
    }

    if (!profileData.subscription) {
      updates.subscription = UserSubscriptionType.SCHOOL;
    }

    if (!profileData.schoolRole) {
      updates.schoolRole = SchoolRole.STUDENT;
    }

    if (!profileData.notebookCount && profileData.notebookCount !== 0) {
      updates.notebookCount = 0;
    }

    if (Object.keys(updates).length > 0 && diagnosis.profileId) {
      console.log('📝 Actualizando campos faltantes:', updates);
      await updateDoc(doc(db, 'users', diagnosis.profileId), {
        ...updates,
        updatedAt: new Date()
      });
      console.log('✅ Campos actualizados');
    }

    // Forzar recarga del perfil
    console.log('🔄 Forzando recarga del perfil...');
    if (user) {
      await user.reload();
    }

    // Recargar la página para que AuthContext tome los cambios
    console.log('✅ Perfil arreglado. Recargando página...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);

    return true;

  } catch (error) {
    console.error('❌ Error arreglando perfil:', error);
    return false;
  }
};

const createStudentProfile = async () => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      console.log('❌ No hay usuario autenticado');
      return false;
    }

    console.log('🆕 Creando nuevo perfil de estudiante...');

    const newProfile: any = {
      id: user.uid,
      email: user.email,
      nombre: user.displayName || user.email.split('@')[0],
      displayName: user.displayName || user.email.split('@')[0],
      username: user.email.split('@')[0],
      subscription: UserSubscriptionType.SCHOOL,
      schoolRole: SchoolRole.STUDENT,
      googleAuthUid: user.uid,
      notebookCount: 0,
      conceptCount: 0,
      studyStreak: 0,
      totalStudyTime: 0,
      interests: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await setDoc(doc(db, 'users', user.uid), newProfile);
    console.log('✅ Perfil de estudiante creado');

    // Recargar página
    setTimeout(() => {
      window.location.reload();
    }, 1000);

    return true;

  } catch (error) {
    console.error('❌ Error creando perfil:', error);
    return false;
  }
};

// Registrar funciones globalmente
if (typeof window !== 'undefined') {
  (window as any).diagnoseStudentProfile = diagnoseStudentProfile;
  (window as any).fixStudentProfileLoading = fixStudentProfileLoading;
  console.log('🔧 Funciones disponibles:');
  console.log('   - window.diagnoseStudentProfile() - Diagnostica el estado del perfil');
  console.log('   - window.fixStudentProfileLoading() - Arregla el problema de carga del perfil');
}