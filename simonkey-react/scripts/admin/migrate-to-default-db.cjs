const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Cargar credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

console.log('=== Migración de simonkey-general a (default) ===\n');

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

// Obtener Firestore
const { getFirestore } = require('firebase-admin/firestore');

// Conectar a ambas bases de datos
const dbGeneral = getFirestore('simonkey-general'); // Base de datos origen
const dbDefault = getFirestore(); // Base de datos destino (default)

// Colecciones a migrar
const COLLECTIONS_TO_MIGRATE = [
  'users',
  'cuadernos',
  'conceptos',
  'schoolNotebooks',
  'schoolConcepts',
  'schools',
  'studySessions',
  'rankings',
  'userGameStats',
  'userTickets',
  'achievements',
  'userAchievements',
  'dailyStudyTime',
  'weeklyStudyTime',
  'positionHistory',
  'kpis',
  'activityLog',
  'migrationStatus',
  'sharedLinks',
  'userTypes',
  'betaAccessCodes',
  'conceptExplanations',
  'teacherMetrics'
];

// Estadísticas
let stats = {
  collections: {},
  totalDocuments: 0,
  totalSubcollections: 0,
  errors: []
};

// Función para migrar una colección
async function migrateCollection(collectionName, parentRef = null) {
  try {
    console.log(`\n📁 Migrando colección: ${collectionName}`);
    
    // Obtener referencia a las colecciones
    const sourceCollection = parentRef 
      ? dbGeneral.collection(parentRef).doc(collectionName.split('/')[0]).collection(collectionName.split('/')[1])
      : dbGeneral.collection(collectionName);
      
    const targetCollection = parentRef
      ? dbDefault.collection(parentRef).doc(collectionName.split('/')[0]).collection(collectionName.split('/')[1])
      : dbDefault.collection(collectionName);
    
    // Obtener todos los documentos
    const snapshot = await sourceCollection.get();
    
    if (snapshot.empty) {
      console.log(`   ⚠️  Colección vacía o no existe`);
      return 0;
    }
    
    console.log(`   📊 Documentos encontrados: ${snapshot.size}`);
    
    // Migrar en lotes para mejor rendimiento
    const batch = dbDefault.batch();
    let batchCount = 0;
    let documentsCount = 0;
    
    for (const doc of snapshot.docs) {
      const targetDoc = targetCollection.doc(doc.id);
      batch.set(targetDoc, doc.data());
      batchCount++;
      documentsCount++;
      
      // Firestore tiene un límite de 500 operaciones por batch
      if (batchCount === 500) {
        await batch.commit();
        console.log(`   ✅ Migrados ${documentsCount} documentos...`);
        batchCount = 0;
      }
      
      // Migrar subcolecciones si existen
      const subcollections = await doc.ref.listCollections();
      if (subcollections.length > 0) {
        console.log(`   📂 Migrando ${subcollections.length} subcolecciones de ${doc.id}`);
        for (const subcollection of subcollections) {
          const subPath = `${doc.id}/${subcollection.id}`;
          await migrateCollection(subPath, collectionName);
          stats.totalSubcollections++;
        }
      }
    }
    
    // Commit del último batch si queda algo
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`   ✅ Migración completada: ${documentsCount} documentos`);
    
    // Actualizar estadísticas
    stats.collections[collectionName] = documentsCount;
    stats.totalDocuments += documentsCount;
    
    return documentsCount;
    
  } catch (error) {
    console.error(`   ❌ Error migrando ${collectionName}:`, error.message);
    stats.errors.push({ collection: collectionName, error: error.message });
    return 0;
  }
}

// Función principal
async function runMigration() {
  console.log('🚀 Iniciando migración...\n');
  console.log('⚠️  ADVERTENCIA: Esta operación copiará todos los datos');
  console.log('   desde "simonkey-general" a la base de datos "(default)"');
  console.log('   Los datos existentes en (default) NO serán eliminados\n');
  
  // Dar 5 segundos para cancelar
  console.log('Iniciando en 5 segundos... (Ctrl+C para cancelar)');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const startTime = Date.now();
  
  // Verificar conexión a ambas bases de datos
  console.log('\n🔍 Verificando conexión...');
  try {
    // Test simonkey-general
    const testGeneral = await dbGeneral.collection('_test').doc('test').set({ test: true });
    await dbGeneral.collection('_test').doc('test').delete();
    console.log('✅ Conexión a simonkey-general exitosa');
    
    // Test default
    const testDefault = await dbDefault.collection('_test').doc('test').set({ test: true });
    await dbDefault.collection('_test').doc('test').delete();
    console.log('✅ Conexión a (default) exitosa');
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    if (error.message.includes('NOT_FOUND')) {
      console.log('\n⚠️  Asegúrate de que ambas bases de datos existen en Firebase Console');
    }
    process.exit(1);
  }
  
  // Migrar cada colección
  for (const collection of COLLECTIONS_TO_MIGRATE) {
    await migrateCollection(collection);
  }
  
  // Buscar colecciones adicionales no listadas
  console.log('\n🔍 Buscando colecciones adicionales...');
  try {
    const allCollections = await dbGeneral.listCollections();
    const additionalCollections = allCollections
      .map(col => col.id)
      .filter(id => !COLLECTIONS_TO_MIGRATE.includes(id));
    
    if (additionalCollections.length > 0) {
      console.log(`📌 Encontradas ${additionalCollections.length} colecciones adicionales:`);
      for (const collection of additionalCollections) {
        console.log(`   - ${collection}`);
        await migrateCollection(collection);
      }
    }
  } catch (error) {
    console.error('❌ Error listando colecciones:', error.message);
  }
  
  // Mostrar resumen
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(50));
  console.log(`⏱️  Tiempo total: ${duration} segundos`);
  console.log(`📄 Documentos migrados: ${stats.totalDocuments}`);
  console.log(`📂 Subcolecciones migradas: ${stats.totalSubcollections}`);
  console.log(`❌ Errores: ${stats.errors.length}`);
  
  console.log('\n📁 Detalle por colección:');
  Object.entries(stats.collections).forEach(([collection, count]) => {
    console.log(`   ${collection}: ${count} documentos`);
  });
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errores encontrados:');
    stats.errors.forEach(err => {
      console.log(`   ${err.collection}: ${err.error}`);
    });
  }
  
  console.log('\n✅ Migración completada');
  console.log('\n📌 Próximos pasos:');
  console.log('1. Verifica los datos en Firebase Console');
  console.log('2. Actualiza la configuración del frontend para usar (default)');
  console.log('3. Actualiza las reglas de seguridad si es necesario');
  console.log('4. Realiza pruebas antes de cambiar completamente');
}

// Ejecutar migración
runMigration().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});