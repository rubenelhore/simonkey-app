const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Cargar credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

console.log('=== Copiando Índices de Firestore ===\n');

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const { getFirestore } = require('firebase-admin/firestore');

async function getIndexes() {
  console.log('📋 Para copiar los índices de simonkey-general a (default):\n');
  
  console.log('1. Ve a la consola de Firebase:');
  console.log('   https://console.firebase.google.com/project/simonkey-5c78f/firestore/indexes\n');
  
  console.log('2. En el dropdown superior, selecciona "simonkey-general"\n');
  
  console.log('3. Verás todos los índices creados. Para cada índice:\n');
  console.log('   a) Anota la colección');
  console.log('   b) Anota los campos y su orden (ASCENDING/DESCENDING)');
  console.log('   c) Anota el ámbito (Collection/Collection group)\n');
  
  console.log('4. Cambia al dropdown a "(default)"\n');
  
  console.log('5. Crea los mismos índices manualmente\n');
  
  console.log('📌 Alternativamente, puedo generar un archivo de índices:');
  
  // Leer el archivo de índices actual si existe
  const indexesPath = path.join(__dirname, '../../firestore.indexes.json');
  
  if (fs.existsSync(indexesPath)) {
    const indexes = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));
    
    console.log('\n✅ Archivo firestore.indexes.json encontrado');
    console.log(`📊 Contiene ${indexes.indexes ? indexes.indexes.length : 0} índices\n`);
    
    if (indexes.indexes && indexes.indexes.length > 0) {
      console.log('Índices configurados:');
      console.log('='.repeat(60));
      
      indexes.indexes.forEach((index, i) => {
        console.log(`\n${i + 1}. Colección: ${index.collectionGroup}`);
        console.log('   Campos:');
        index.fields.forEach(field => {
          console.log(`   - ${field.fieldPath}: ${field.order || field.arrayConfig || 'CONTAINS'}`);
        });
        console.log(`   Scope: ${index.queryScope || 'COLLECTION'}`);
      });
      
      console.log('\n' + '='.repeat(60));
      console.log('\n🚀 Para aplicar estos índices a (default), ejecuta:');
      console.log('   firebase deploy --only firestore:indexes\n');
      
      console.log('⚠️  IMPORTANTE: Esto aplicará los índices a la base de datos');
      console.log('   actualmente seleccionada (default).\n');
    }
  } else {
    console.log('\n❌ No se encontró firestore.indexes.json');
    console.log('   Necesitarás copiar los índices manualmente desde la consola.\n');
  }
  
  // Crear un script para listar índices comunes basados en las colecciones migradas
  console.log('\n📝 Índices recomendados basados en colecciones comunes:\n');
  
  const commonIndexes = [
    {
      collection: 'users',
      fields: [
        { field: 'subscription', order: 'ASCENDING' },
        { field: 'createdAt', order: 'DESCENDING' }
      ]
    },
    {
      collection: 'studySessions',
      fields: [
        { field: 'userId', order: 'ASCENDING' },
        { field: 'date', order: 'DESCENDING' }
      ]
    },
    {
      collection: 'notebooks',
      fields: [
        { field: 'userId', order: 'ASCENDING' },
        { field: 'updatedAt', order: 'DESCENDING' }
      ]
    },
    {
      collection: 'conceptos',
      fields: [
        { field: 'cuadernoId', order: 'ASCENDING' },
        { field: 'usuarioId', order: 'ASCENDING' }
      ]
    },
    {
      collection: 'schoolNotebooks',
      fields: [
        { field: 'teacherId', order: 'ASCENDING' },
        { field: 'subject', order: 'ASCENDING' }
      ]
    },
    {
      collection: 'userActivities',
      fields: [
        { field: 'userId', order: 'ASCENDING' },
        { field: 'timestamp', order: 'DESCENDING' }
      ]
    }
  ];
  
  // Generar archivo de índices recomendados
  const recommendedIndexes = {
    indexes: commonIndexes.map(idx => ({
      collectionGroup: idx.collection,
      fields: idx.fields.map(f => ({
        fieldPath: f.field,
        order: f.order
      }))
    })),
    fieldOverrides: []
  };
  
  const recommendedPath = path.join(__dirname, '../../firestore-indexes-recommended.json');
  fs.writeFileSync(recommendedPath, JSON.stringify(recommendedIndexes, null, 2));
  
  console.log('He creado un archivo con índices recomendados:');
  console.log('📄 firestore-indexes-recommended.json\n');
  
  console.log('Para usar estos índices:');
  console.log('1. Revisa el archivo y ajusta según necesites');
  console.log('2. Reemplaza firestore.indexes.json con este archivo');
  console.log('3. Ejecuta: firebase deploy --only firestore:indexes');
}

getIndexes().then(() => {
  console.log('\n✅ Proceso completado');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});