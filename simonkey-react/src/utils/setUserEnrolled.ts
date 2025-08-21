import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Función para marcar un usuario como inscrito (isEnrolled: true)
 */
export const setUserEnrolled = async (userId: string) => {
  try {
    console.log(`🔧 Marcando usuario ${userId} como inscrito...`);
    
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isEnrolled: true,
      updatedAt: serverTimestamp()
    });
    
    console.log(`✅ Usuario ${userId} marcado como inscrito exitosamente`);
    console.log('🔄 Recarga la página para ver los cambios');
    
    return true;
  } catch (error) {
    console.error('❌ Error marcando usuario como inscrito:', error);
    return false;
  }
};

// Hacer la función disponible globalmente para usar en la consola
(window as any).setUserEnrolled = setUserEnrolled;