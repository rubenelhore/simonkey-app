import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Función de depuración para verificar el perfil del usuario actual
 */
export const debugUserProfile = async () => {
  console.log('🔍 === DEPURACIÓN DE PERFIL DE USUARIO ===');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario autenticado:');
    console.log('  - UID:', currentUser.uid);
    console.log('  - Email:', currentUser.email);
    console.log('  - Display Name:', currentUser.displayName);
    console.log('  - Email Verified:', currentUser.emailVerified);
    
    // Verificar en Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      console.log('✅ Usuario encontrado en Firestore');
      const userData = userDoc.data();
      console.log('📋 Datos del usuario:', userData);
      console.log('  - Subscription:', userData.subscription);
      console.log('  - School Role:', userData.schoolRole);
      console.log('  - Notebook Count:', userData.notebookCount);
    } else {
      console.log('❌ Usuario NO encontrado en Firestore');
      console.log('⚠️ Esto explica el error "Usuario no encontrado"');
      console.log('💡 Ejecuta: window.createMissingUserProfile()');
    }
    
    // Verificar el cuaderno actual
    const urlPath = window.location.pathname;
    const notebookIdMatch = urlPath.match(/\/notebook\/([^/]+)/);
    if (notebookIdMatch) {
      const notebookId = notebookIdMatch[1];
      console.log('📓 Notebook ID actual:', notebookId);
      
      // Verificar si es un cuaderno escolar
      const isSchoolPath = urlPath.includes('/school/');
      console.log('🏫 Es cuaderno escolar:', isSchoolPath);
    }
    
  } catch (error) {
    console.error('❌ Error en depuración:', error);
  }
};

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).debugUserProfile = debugUserProfile;
  console.log('🔧 Función debugUserProfile() disponible en la consola');
}