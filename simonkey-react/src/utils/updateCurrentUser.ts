import { db, auth } from '../services/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { UserSubscriptionType } from '../types/interfaces';

/**
 * Actualiza el usuario actual como super admin
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
    await updateDoc(userDocRef, {
      subscription: UserSubscriptionType.SUPER_ADMIN,
      maxNotebooks: -1,
      maxConceptsPerNotebook: -1,
      notebooksCreatedThisWeek: 0,
      conceptsCreatedThisWeek: 0,
      weekStartDate: new Date()
    });

    console.log('✅ Usuario actualizado exitosamente como Super Admin');
    console.log('Recarga la página para ver los cambios');
    
    return true;
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return false;
  }
};

// Exponer la función globalmente
if (typeof window !== 'undefined') {
  (window as any).updateAsSuperAdmin = updateCurrentUserAsSuperAdmin;
} 