import { auth, db } from '../services/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { UserSubscriptionType } from '../types/interfaces';

/**
 * Crea el perfil de usuario faltante en la colección 'users'
 * Útil cuando un usuario está autenticado pero no tiene documento en Firestore
 */
export const createMissingUserProfile = async () => {
  console.log('🔧 === CREANDO PERFIL DE USUARIO FALTANTE ===');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return false;
    }
    
    console.log('👤 Usuario actual:', currentUser.email);
    console.log('🆔 UID:', currentUser.uid);
    
    // Verificar si ya existe
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      console.log('✅ El usuario ya existe en Firestore');
      const userData = userDoc.data();
      console.log('📋 Datos actuales:', {
        subscription: userData.subscription,
        schoolRole: userData.schoolRole,
        email: userData.email
      });
      return true;
    }
    
    // Crear perfil de usuario
    console.log('⚠️ Usuario no existe en Firestore, creando perfil...');
    
    // Determinar el tipo de suscripción
    let subscription = UserSubscriptionType.FREE;
    if (currentUser.email === 'ruben.elhore@gmail.com' || 
        currentUser.email === 'santiagoarceofel@gmail.com') {
      subscription = UserSubscriptionType.SUPER_ADMIN;
    }
    
    const userData = {
      id: currentUser.uid,
      email: currentUser.email || '',
      username: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
      nombre: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
      displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
      birthdate: '',
      subscription: subscription,
      notebookCount: 0,
      maxNotebooks: subscription === UserSubscriptionType.SUPER_ADMIN ? -1 : 4,
      maxConceptsPerNotebook: subscription === UserSubscriptionType.SUPER_ADMIN ? -1 : 100,
      notebooksCreatedThisWeek: 0,
      conceptsCreatedThisWeek: 0,
      weekStartDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      emailVerified: currentUser.emailVerified,
      isActive: true,
      photoURL: currentUser.photoURL || null
    };
    
    await setDoc(userDocRef, userData);
    console.log('✅ Perfil de usuario creado exitosamente');
    console.log('📋 Datos creados:', {
      subscription: userData.subscription,
      email: userData.email,
      maxNotebooks: userData.maxNotebooks
    });
    
    // Recargar página en 2 segundos
    console.log('🔄 Recargando página en 2 segundos...');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error creando perfil de usuario:', error);
    return false;
  }
};

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).createMissingUserProfile = createMissingUserProfile;
  console.log('🔧 Función createMissingUserProfile() disponible en la consola');
}