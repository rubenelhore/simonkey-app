const admin = require('firebase-admin');
const path = require('path');

// Cargar credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

console.log('=== Test de Conexión a Base de Datos (default) ===\n');

// Inicializar Admin SDK para base de datos default
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

// Obtener Firestore
const { getFirestore } = require('firebase-admin/firestore');

// Conectar a la base de datos default (sin especificar databaseId)
const db = getFirestore(); // Esto usa (default)

async function testDefaultDatabase() {
  try {
    console.log('🔍 Probando conexión a base de datos (default)...\n');
    
    // 1. Intentar escribir
    console.log('1. Test de escritura...');
    const testDoc = db.collection('_test_connection').doc('test');
    await testDoc.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message: 'Test desde admin SDK'
    });
    console.log('   ✅ Escritura exitosa');
    
    // 2. Intentar leer
    console.log('\n2. Test de lectura...');
    const doc = await testDoc.get();
    if (doc.exists) {
      console.log('   ✅ Lectura exitosa:', doc.data());
    }
    
    // 3. Limpiar
    await testDoc.delete();
    console.log('   ✅ Eliminación exitosa');
    
    // 4. Listar colecciones
    console.log('\n3. Listando colecciones en (default)...');
    const collections = await db.listCollections();
    
    if (collections.length === 0) {
      console.log('   ⚠️  No hay colecciones en (default)');
      console.log('   Esto es normal si aún no has migrado los datos');
    } else {
      console.log(`   ✅ Encontradas ${collections.length} colecciones:`);
      const mainCollections = [
        'users', 'cuadernos', 'conceptos', 'schoolNotebooks', 
        'schools', 'rankings', 'kpis'
      ];
      
      mainCollections.forEach(colName => {
        const exists = collections.some(col => col.id === colName);
        console.log(`      ${exists ? '✅' : '❌'} ${colName}`);
      });
      
      // Mostrar otras colecciones
      const otherCollections = collections
        .map(col => col.id)
        .filter(id => !mainCollections.includes(id))
        .slice(0, 5);
        
      if (otherCollections.length > 0) {
        console.log('      📁 Otras:', otherCollections.join(', '));
      }
    }
    
    // 5. Verificar datos si existen
    console.log('\n4. Verificando datos (si existen)...');
    const usersSnap = await db.collection('users').limit(1).get();
    console.log(`   Usuarios: ${usersSnap.empty ? '❌ No hay datos' : '✅ Hay datos'}`);
    
    const notebooksSnap = await db.collection('cuadernos').limit(1).get();
    console.log(`   Cuadernos: ${notebooksSnap.empty ? '❌ No hay datos' : '✅ Hay datos'}`);
    
    console.log('\n✅ La base de datos (default) está accesible y funcionando');
    
    if (collections.length === 0 || usersSnap.empty) {
      console.log('\n📌 Nota: Parece que (default) está vacía.');
      console.log('   Ejecuta el script de migración para copiar los datos desde simonkey-general');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === 5) {
      console.log('\n⚠️  La base de datos (default) podría no estar habilitada');
      console.log('   Ve a Firebase Console y asegúrate de que Firestore esté activo');
    }
  }
}

testDefaultDatabase().then(() => {
  console.log('\n✅ Test completado');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});