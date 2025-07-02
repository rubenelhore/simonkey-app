import { auth, db } from '../services/firebase';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';

/**
 * Debug completo del usuario actual
 */
export async function debugCurrentUser() {
  console.log('🔍 === DEBUG USUARIO ACTUAL ===');
  console.log('==============================');
  
  const user = auth.currentUser;
  if (!user) {
    console.log('❌ No hay usuario autenticado');
    return;
  }
  
  console.log('👤 Firebase Auth:');
  console.log('   UID:', user.uid);
  console.log('   Email:', user.email);
  
  try {
    // 1. Buscar el documento del usuario por email
    console.log('\n📋 Buscando documento del usuario...');
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', user.email)
    );
    
    const userSnapshot = await getDocs(usersQuery);
    if (userSnapshot.empty) {
      console.log('❌ No se encontró documento con ese email');
      
      // Intentar buscar por UID
      console.log('\n🔍 Intentando buscar por UID...');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        console.log('✅ Documento encontrado por UID:');
        console.log('   Data:', userDoc.data());
      }
      return;
    }
    
    userSnapshot.docs.forEach((doc, index) => {
      console.log(`\n✅ Documento ${index + 1}:`);
      console.log('   Document ID:', doc.id);
      const data = doc.data();
      console.log('   Datos:', {
        nombre: data.nombre,
        email: data.email,
        subscription: data.subscription,
        schoolRole: data.schoolRole,
        googleAuthUid: data.googleAuthUid,
        idAdmin: data.idAdmin
      });
      
      // Verificar si el Document ID coincide
      if (doc.id !== user.uid) {
        console.log('   ⚠️ Document ID diferente del Firebase UID');
        console.log(`      Document ID: ${doc.id}`);
        console.log(`      Firebase UID: ${user.uid}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  console.log('\n==============================');
}

/**
 * Verificar base de datos correcta
 */
export async function checkFirestoreDatabase() {
  console.log('🔍 === VERIFICANDO BASE DE DATOS ===');
  console.log('====================================');
  
  try {
    // Intentar leer una colección simple
    const testQuery = query(collection(db, 'users'));
    const snapshot = await getDocs(testQuery);
    console.log(`✅ Conectado a Firestore`);
    console.log(`   Usuarios en la base de datos: ${snapshot.size}`);
    
    // Verificar la configuración
    console.log('\n📊 Configuración de Firestore:');
    console.log('   Project ID:', 'simonkey-5c78f');
    console.log('   Database ID:', 'simonkey-general');
    
  } catch (error: any) {
    console.error('❌ Error accediendo a Firestore:', error);
    console.log('   Código:', error.code);
    console.log('   Mensaje:', error.message);
  }
  
  console.log('\n====================================');
}

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).debugCurrentUser = debugCurrentUser;
  (window as any).checkFirestoreDatabase = checkFirestoreDatabase;
}