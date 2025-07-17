const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Leer el archivo de credenciales
const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ No se encontró el archivo serviceAccountKey.json');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

console.log('=== Información de conexión ===');
console.log('Project ID:', serviceAccount.project_id);
console.log('Client Email:', serviceAccount.client_email);
console.log('Private Key ID:', serviceAccount.private_key_id.substring(0, 10) + '...');

// Inicializar con el proyecto específico
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  console.log('✅ Firebase Admin inicializado');
} catch (error) {
  console.error('❌ Error al inicializar:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// Probar conexión
async function testConnection() {
  console.log('\n=== Probando conexión ===');
  
  try {
    // Intentar una operación simple
    const serverTime = admin.firestore.FieldValue.serverTimestamp();
    console.log('✅ Cliente Firestore creado correctamente');
    
    // Intentar listar colecciones
    console.log('\nListando colecciones...');
    const collections = await db.listCollections();
    
    if (collections.length === 0) {
      console.log('⚠️  No se encontraron colecciones (la base de datos podría estar vacía)');
    } else {
      console.log(`✅ Se encontraron ${collections.length} colecciones:`);
      collections.forEach(col => {
        console.log(`   - ${col.id}`);
      });
    }
    
    // Si hay colección users, intentar leer
    const usersCollection = collections.find(col => col.id === 'users');
    if (usersCollection) {
      console.log('\nIntentando leer colección users...');
      const snapshot = await db.collection('users').limit(1).get();
      console.log(`✅ Colección users accesible. Documentos: ${snapshot.size}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error detallado:');
    console.error('Código:', error.code);
    console.error('Mensaje:', error.message);
    
    if (error.code === 5) {
      console.log('\n📌 Error NOT_FOUND puede significar:');
      console.log('1. El proyecto no existe o el ID es incorrecto');
      console.log('2. Firestore no está habilitado en este proyecto');
      console.log('3. La cuenta de servicio no tiene permisos');
      console.log('\nVerifica en Firebase Console:');
      console.log(`https://console.firebase.google.com/project/${serviceAccount.project_id}/firestore`);
    }
  }
}

testConnection().then(() => {
  console.log('\n✅ Prueba completada');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error no manejado:', err);
  process.exit(1);
});