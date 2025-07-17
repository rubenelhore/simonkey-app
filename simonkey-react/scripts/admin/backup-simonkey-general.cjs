const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Cargar credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

console.log('=== Respaldo de simonkey-general ===\n');

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

// Obtener Firestore
const { getFirestore } = require('firebase-admin/firestore');

// Conectar a la base de datos simonkey-general
const db = getFirestore('simonkey-general');

// Crear directorio de respaldo
const backupDir = path.join(__dirname, `../../backups/simonkey-general-${new Date().toISOString().split('T')[0]}`);
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Función para respaldar una colección
async function backupCollection(collectionName, parentPath = '') {
  try {
    const fullPath = parentPath ? `${parentPath}/${collectionName}` : collectionName;
    console.log(`📁 Respaldando: ${fullPath}`);
    
    const collectionRef = parentPath 
      ? db.doc(parentPath).collection(collectionName)
      : db.collection(collectionName);
    
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log(`   ⚠️  Colección vacía`);
      return 0;
    }
    
    const data = {};
    let count = 0;
    
    for (const doc of snapshot.docs) {
      data[doc.id] = doc.data();
      count++;
      
      // Respaldar subcolecciones
      const subcollections = await doc.ref.listCollections();
      for (const subcol of subcollections) {
        const subcolData = await backupCollection(subcol.id, `${fullPath}/${doc.id}`);
        if (subcolData > 0) {
          data[doc.id]._subcollections = data[doc.id]._subcollections || {};
          data[doc.id]._subcollections[subcol.id] = subcolData;
        }
      }
    }
    
    // Guardar a archivo
    const fileName = fullPath.replace(/\//g, '_') + '.json';
    const filePath = path.join(backupDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`   ✅ ${count} documentos respaldados`);
    return count;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return 0;
  }
}

// Función principal
async function runBackup() {
  console.log(`📂 Directorio de respaldo: ${backupDir}\n`);
  
  const startTime = Date.now();
  let totalDocs = 0;
  
  try {
    // Listar todas las colecciones
    console.log('🔍 Listando colecciones...');
    const collections = await db.listCollections();
    console.log(`📊 Encontradas ${collections.length} colecciones\n`);
    
    // Respaldar cada colección
    for (const collection of collections) {
      const count = await backupCollection(collection.id);
      totalDocs += count;
    }
    
    // Crear archivo de metadatos
    const metadata = {
      timestamp: new Date().toISOString(),
      projectId: serviceAccount.project_id,
      databaseId: 'simonkey-general',
      totalCollections: collections.length,
      totalDocuments: totalDocs,
      collections: collections.map(c => c.id)
    };
    
    fs.writeFileSync(
      path.join(backupDir, '_metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ RESPALDO COMPLETADO');
    console.log('='.repeat(50));
    console.log(`⏱️  Tiempo: ${duration} segundos`);
    console.log(`📄 Documentos: ${totalDocs}`);
    console.log(`📁 Ubicación: ${backupDir}`);
    
  } catch (error) {
    console.error('\n❌ Error durante el respaldo:', error.message);
    process.exit(1);
  }
}

// Ejecutar respaldo
runBackup().then(() => {
  console.log('\n✅ Proceso completado exitosamente');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});