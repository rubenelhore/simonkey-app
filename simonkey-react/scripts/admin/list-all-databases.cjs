const admin = require('firebase-admin');
const path = require('path');

// Cargar credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

console.log('=== Listando todas las bases de datos ===\n');

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const { getFirestore } = require('firebase-admin/firestore');

async function testDatabases() {
  console.log('Project ID:', serviceAccount.project_id);
  console.log('\n🔍 Probando diferentes configuraciones de base de datos:\n');
  
  // 1. Probar sin especificar (esto debería usar default)
  console.log('1. Sin especificar base de datos (usa default):');
  try {
    const dbDefault = getFirestore();
    const testRef = dbDefault.collection('_test').doc('test');
    await testRef.set({ test: true, timestamp: new Date() });
    const doc = await testRef.get();
    console.log('   ✅ Funciona - Esta es la base de datos por defecto');
    await testRef.delete();
  } catch (error) {
    console.log('   ❌ Error:', error.code, error.message);
  }
  
  // 2. Probar con '(default)' explícito
  console.log('\n2. Con databaseId = "(default)":');
  try {
    const dbDefaultExplicit = getFirestore('(default)');
    const testRef = dbDefaultExplicit.collection('_test').doc('test');
    await testRef.set({ test: true, timestamp: new Date() });
    const doc = await testRef.get();
    console.log('   ✅ Funciona');
    await testRef.delete();
  } catch (error) {
    console.log('   ❌ Error:', error.code, error.message);
  }
  
  // 3. Probar con 'default' (sin paréntesis)
  console.log('\n3. Con databaseId = "default":');
  try {
    const dbDefaultNoParen = getFirestore('default');
    const testRef = dbDefaultNoParen.collection('_test').doc('test');
    await testRef.set({ test: true, timestamp: new Date() });
    const doc = await testRef.get();
    console.log('   ✅ Funciona - Creaste una base de datos llamada "default"');
    await testRef.delete();
  } catch (error) {
    console.log('   ❌ Error:', error.code, error.message);
  }
  
  // 4. Probar simonkey-general
  console.log('\n4. Con databaseId = "simonkey-general":');
  try {
    const dbGeneral = getFirestore('simonkey-general');
    const collections = await dbGeneral.listCollections();
    console.log('   ✅ Funciona - Tiene', collections.length, 'colecciones');
  } catch (error) {
    console.log('   ❌ Error:', error.code, error.message);
  }
  
  console.log('\n📊 RESUMEN:');
  console.log('- La base de datos por defecto real es la que funciona SIN especificar databaseId');
  console.log('- Si creaste una base llamada "default", esa NO es la base de datos por defecto');
  console.log('- La base de datos por defecto en Firebase Console aparece como "(default)"');
  
  console.log('\n💡 RECOMENDACIÓN:');
  console.log('Si la opción 1 (sin especificar) no funcionó, significa que:');
  console.log('1. No tienes una base de datos por defecto creada');
  console.log('2. O creaste una base con nombre "default" que NO es la por defecto');
  console.log('\nEn Firebase Console, la base de datos por defecto debe aparecer como "(default)" con paréntesis.');
}

testDatabases().then(() => {
  console.log('\n✅ Prueba completada');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});