const admin = require('firebase-admin');
const path = require('path');

// Cargar credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

console.log('=== Test de Actualización con Firebase Admin ===\n');

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore(); // Ahora usa (default)

async function testAdminOperations() {
  try {
    console.log('1. Listando algunos usuarios...');
    const usersSnapshot = await db.collection('users').limit(5).get();
    
    console.log(`   Encontrados ${usersSnapshot.size} usuarios:\n`);
    
    const users = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        email: data.email,
        name: data.nombre || data.displayName || 'Sin nombre',
        subscription: data.subscription || 'free'
      });
      console.log(`   - ${data.email} (${doc.id})`);
    });
    
    console.log('\n2. Probando actualización de timestamp...');
    
    // Seleccionar un usuario para prueba
    if (users.length > 0) {
      const testUserId = users[0].id;
      console.log(`   Actualizando usuario: ${users[0].email}`);
      
      // Actualizar con un campo de prueba
      await db.collection('users').doc(testUserId).update({
        lastAdminTest: admin.firestore.FieldValue.serverTimestamp(),
        adminTestMessage: 'Prueba de Firebase Admin SDK - ' + new Date().toISOString()
      });
      
      console.log('   ✅ Actualización exitosa');
      
      // Leer de vuelta para confirmar
      const updatedDoc = await db.collection('users').doc(testUserId).get();
      const updatedData = updatedDoc.data();
      
      console.log('\n3. Verificando actualización:');
      console.log(`   - lastAdminTest: ${updatedData.lastAdminTest?.toDate()}`);
      console.log(`   - adminTestMessage: ${updatedData.adminTestMessage}`);
      
      // Limpiar campos de prueba
      console.log('\n4. Limpiando campos de prueba...');
      await db.collection('users').doc(testUserId).update({
        lastAdminTest: admin.firestore.FieldValue.delete(),
        adminTestMessage: admin.firestore.FieldValue.delete()
      });
      console.log('   ✅ Campos de prueba eliminados');
    }
    
    console.log('\n5. Operaciones disponibles con Admin SDK:');
    console.log('   - Leer/escribir sin restricciones de seguridad');
    console.log('   - Operaciones en batch (hasta 500 documentos)');
    console.log('   - Consultas sin límites de cliente');
    console.log('   - Acceso a todas las colecciones');
    console.log('   - Operaciones administrativas');
    
    console.log('\n✅ Firebase Admin SDK funcionando correctamente con (default)');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Detalles:', error);
  }
}

// Ejemplo de función para actualización masiva
async function ejemploActualizacionMasiva() {
  console.log('\n\n=== Ejemplo: Actualización Masiva ===\n');
  console.log('Aquí hay un ejemplo de cómo hacer actualizaciones masivas:\n');
  
  console.log(`
async function actualizarTodosLosUsuarios() {
  const batch = db.batch();
  let count = 0;
  
  const snapshot = await db.collection('users').get();
  
  snapshot.forEach(doc => {
    batch.update(doc.ref, {
      ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    count++;
    
    // Firestore permite máximo 500 operaciones por batch
    if (count === 500) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  });
  
  // Commit del último batch
  if (count > 0) {
    await batch.commit();
  }
  
  console.log(\`Actualizados \${snapshot.size} usuarios\`);
}
`);
}

// Ejecutar prueba
testAdminOperations().then(() => {
  ejemploActualizacionMasiva();
  console.log('\n✅ Prueba completada exitosamente');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});