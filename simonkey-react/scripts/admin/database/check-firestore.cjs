const admin = require('firebase-admin');
const path = require('path');

// Cargar credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

console.log('=== Verificando Firestore ===\n');
console.log('Project ID:', serviceAccount.project_id);

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

// Obtener Firestore
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

async function checkFirestore() {
  try {
    // Intentar crear un documento temporal para verificar permisos
    const testRef = db.collection('_test_admin_connection').doc('test');
    
    console.log('1. Intentando escribir documento de prueba...');
    await testRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      test: true
    });
    console.log('✅ Escritura exitosa');
    
    console.log('\n2. Intentando leer el documento...');
    const doc = await testRef.get();
    if (doc.exists) {
      console.log('✅ Lectura exitosa:', doc.data());
    }
    
    console.log('\n3. Eliminando documento de prueba...');
    await testRef.delete();
    console.log('✅ Eliminación exitosa');
    
    console.log('\n4. Listando colecciones principales...');
    const collections = await db.listCollections();
    console.log(`Encontradas ${collections.length} colecciones:`);
    
    // Mostrar solo las primeras 10 colecciones
    collections.slice(0, 10).forEach(col => {
      console.log(`   - ${col.id}`);
    });
    
    if (collections.length > 10) {
      console.log(`   ... y ${collections.length - 10} más`);
    }
    
    console.log('\n✅ Firestore está funcionando correctamente');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Código de error:', error.code);
    
    if (error.code === 7) {
      console.log('\n⚠️  Error de permisos. Posibles soluciones:');
      console.log('1. Verifica que la cuenta de servicio tenga el rol "Firebase Admin SDK Administrator Service Agent"');
      console.log('2. Ve a IAM en Google Cloud Console y agrega los permisos necesarios');
      console.log('3. Espera unos minutos para que los permisos se propaguen');
    } else if (error.code === 5) {
      console.log('\n⚠️  Firestore podría no estar habilitado.');
      console.log('Ve a: https://console.firebase.google.com/project/' + serviceAccount.project_id + '/firestore');
      console.log('Y habilita Cloud Firestore si no está activo.');
    }
  }
}

checkFirestore().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});