import { db, app } from '../services/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

/**
 * Verificar la configuración completa de Firebase
 */
export async function verifyFirebaseSetup() {
  console.log('🔍 === VERIFICACIÓN DE CONFIGURACIÓN FIREBASE ===');
  console.log('================================================');
  
  // 1. Verificar la app
  console.log('\n1️⃣ Firebase App:');
  console.log('   Name:', app.name);
  console.log('   Options:', {
    projectId: app.options.projectId,
    authDomain: app.options.authDomain,
    databaseURL: app.options.databaseURL
  });
  
  // 2. Verificar Firestore
  console.log('\n2️⃣ Firestore:');
  console.log('   Type:', db.type);
  console.log('   Settings:', db._settings);
  
  // IMPORTANTE: La base de datos debe ser 'simonkey-general'
  if (db._settings?.databaseId !== 'simonkey-general') {
    console.log('   ⚠️ ADVERTENCIA: La base de datos no es simonkey-general');
    console.log('   Database actual:', db._settings?.databaseId || 'default');
  } else {
    console.log('   ✅ Base de datos correcta: simonkey-general');
  }
  
  // 3. Intentar una query simple
  console.log('\n3️⃣ Test de conexión:');
  try {
    const testQuery = query(collection(db, 'users'), limit(1));
    const snapshot = await getDocs(testQuery);
    console.log('   ✅ Conexión exitosa');
    console.log('   Documentos obtenidos:', snapshot.size);
  } catch (error: any) {
    console.log('   ❌ Error de conexión:', error.message);
    console.log('   Código:', error.code);
  }
  
  // 4. Instrucciones para Firebase Console
  console.log('\n4️⃣ IMPORTANTE - Verificar en Firebase Console:');
  console.log('   1. Ve a Firebase Console > Firestore Database');
  console.log('   2. En la parte superior, verifica que dice "simonkey-general"');
  console.log('   3. Si no, selecciona la base de datos correcta del dropdown');
  console.log('   4. Ve a la pestaña "Rules" y verifica que las reglas estén aplicadas');
  console.log('   5. Las reglas deben estar en la base de datos "simonkey-general"');
  
  console.log('\n5️⃣ SOLUCIÓN SI HAY PROBLEMAS:');
  console.log('   Si las reglas están en la base de datos incorrecta:');
  console.log('   1. Selecciona "simonkey-general" en el dropdown');
  console.log('   2. Ve a Rules');
  console.log('   3. Copia y pega las reglas actualizadas');
  console.log('   4. Publica las reglas');
  
  console.log('\n================================================');
}

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).verifyFirebaseSetup = verifyFirebaseSetup;
}