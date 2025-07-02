import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Obtiene el ID efectivo del usuario (para usuarios escolares es el ID del documento, no el UID)
 */
export async function getEffectiveUserId(): Promise<{ id: string; isSchoolUser: boolean } | null> {
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    return null;
  }
  
  try {
    // Buscar por email para encontrar usuarios escolares
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', currentUser.email)
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      const isSchoolUser = userData.subscription?.toLowerCase() === 'school';
      
      return {
        id: userDoc.id, // ID del documento (school_xxx para usuarios escolares)
        isSchoolUser
      };
    }
    
    // Si no se encuentra por email, usar el UID de Firebase
    return {
      id: currentUser.uid,
      isSchoolUser: false
    };
    
  } catch (error) {
    console.error('Error obteniendo ID efectivo del usuario:', error);
    return {
      id: currentUser.uid,
      isSchoolUser: false
    };
  }
}