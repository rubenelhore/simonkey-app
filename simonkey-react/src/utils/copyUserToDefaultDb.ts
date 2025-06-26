import { auth } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';

/**
 * Copia el usuario de simonkey-general a la base de datos default
 * TEMPORAL: Solo hasta que se actualicen las Cloud Functions
 */
export const copyUserToDefaultDb = async () => {
  console.log('🔄 === COPIANDO USUARIO A BASE DE DATOS DEFAULT ===');
  console.log('⚠️ NOTA: Esta es una solución temporal');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario actual:', currentUser.uid);
    
    // Obtener el usuario de simonkey-general
    const app = getApp();
    const dbGeneral = getFirestore(app);
    const userDocRef = doc(dbGeneral, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log('❌ Usuario no encontrado en simonkey-general');
      return;
    }
    
    const userData = userDoc.data();
    console.log('✅ Usuario encontrado en simonkey-general:', userData);
    
    // Intentar copiar a la base de datos default
    try {
      const dbDefault = getFirestore(app); // Sin especificar = default
      const defaultUserRef = doc(dbDefault, 'users', currentUser.uid);
      
      // Verificar si ya existe
      const defaultUserDoc = await getDoc(defaultUserRef);
      if (defaultUserDoc.exists()) {
        console.log('⚠️ Usuario ya existe en base de datos default');
        console.log('📋 Datos actuales:', defaultUserDoc.data());
        return;
      }
      
      console.log('❌ No se puede escribir en la base de datos default desde el cliente');
      console.log('💡 Las Cloud Functions necesitan ser actualizadas para usar simonkey-general');
      console.log('');
      console.log('📝 Solución alternativa:');
      console.log('1. Actualiza las Cloud Functions para usar simonkey-general');
      console.log('2. O crea manualmente el usuario en la base de datos (default) desde la consola de Firebase');
      
    } catch (error) {
      console.error('❌ Error accediendo a la base de datos default:', error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).copyUserToDefaultDb = copyUserToDefaultDb;
  console.log('🔧 Función copyUserToDefaultDb() disponible en la consola');
}