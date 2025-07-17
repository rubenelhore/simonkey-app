const admin = require('firebase-admin');
const path = require('path');

// Cargar credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

// ========== OPERACIONES DISPONIBLES ==========

// 1. Limpiar usuarios sin email
async function limpiarUsuariosSinEmail() {
  console.log('Buscando usuarios sin email...');
  const snapshot = await db.collection('users')
    .where('email', '==', null)
    .get();
  
  console.log(`Encontrados ${snapshot.size} usuarios sin email`);
  
  for (const doc of snapshot.docs) {
    console.log(`- Eliminando usuario ${doc.id}`);
    // await doc.ref.delete(); // Descomentar para ejecutar
  }
}

// 2. Migrar estructura de datos
async function migrarEstructuraDatos() {
  console.log('Migrando estructura de datos...');
  const snapshot = await db.collection('notebooks').get();
  
  const batch = db.batch();
  let count = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    // Ejemplo: cambiar campo 'titulo' a 'title'
    if (data.titulo && !data.title) {
      batch.update(doc.ref, {
        title: data.titulo,
        titulo: admin.firestore.FieldValue.delete()
      });
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Migrados ${count} documentos`);
  }
}

// 3. Estadísticas generales
async function obtenerEstadisticas() {
  console.log('=== Estadísticas de la Base de Datos ===\n');
  
  const collections = [
    'users', 'notebooks', 'conceptos', 'studySessions',
    'schoolNotebooks', 'schools', 'userActivities'
  ];
  
  for (const collection of collections) {
    const snapshot = await db.collection(collection).get();
    console.log(`${collection}: ${snapshot.size} documentos`);
  }
}

// 4. Buscar y corregir inconsistencias
async function corregirInconsistencias() {
  console.log('Buscando inconsistencias...');
  
  // Ejemplo: usuarios con notebooks huérfanos
  const users = await db.collection('users').get();
  
  for (const userDoc of users.docs) {
    const userId = userDoc.id;
    const notebooks = await db.collection('notebooks')
      .where('userId', '==', userId)
      .get();
    
    if (notebooks.empty && userDoc.data().notebookCount > 0) {
      console.log(`Usuario ${userId} tiene notebookCount=${userDoc.data().notebookCount} pero no tiene notebooks`);
      // await userDoc.ref.update({ notebookCount: 0 });
    }
  }
}

// 5. Operaciones de mantenimiento
async function mantenimientoDiario() {
  console.log('Ejecutando mantenimiento diario...');
  
  // Limpiar sesiones de estudio antiguas (más de 6 meses)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const oldSessions = await db.collection('studySessions')
    .where('startTime', '<', sixMonthsAgo)
    .get();
  
  console.log(`Encontradas ${oldSessions.size} sesiones antiguas`);
  
  // Batch delete
  const batch = db.batch();
  let count = 0;
  
  oldSessions.forEach(doc => {
    batch.delete(doc.ref);
    count++;
    
    if (count === 500) {
      // await batch.commit();
      // batch = db.batch();
      count = 0;
    }
  });
  
  if (count > 0) {
    // await batch.commit();
  }
}

// ========== MENÚ PRINCIPAL ==========
async function main() {
  const args = process.argv.slice(2);
  const operation = args[0];
  
  console.log('=== Firebase Admin Operations ===\n');
  
  switch (operation) {
    case 'stats':
      await obtenerEstadisticas();
      break;
      
    case 'clean-users':
      await limpiarUsuariosSinEmail();
      break;
      
    case 'migrate':
      await migrarEstructuraDatos();
      break;
      
    case 'check':
      await corregirInconsistencias();
      break;
      
    case 'maintenance':
      await mantenimientoDiario();
      break;
      
    default:
      console.log('Operaciones disponibles:');
      console.log('  node admin-operations.cjs stats         - Ver estadísticas');
      console.log('  node admin-operations.cjs clean-users   - Limpiar usuarios sin email');
      console.log('  node admin-operations.cjs migrate       - Migrar estructura de datos');
      console.log('  node admin-operations.cjs check         - Buscar inconsistencias');
      console.log('  node admin-operations.cjs maintenance   - Mantenimiento diario');
      console.log('\n⚠️  Las operaciones destructivas están comentadas por seguridad');
  }
}

// Ejecutar
main().then(() => {
  console.log('\n✅ Operación completada');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});