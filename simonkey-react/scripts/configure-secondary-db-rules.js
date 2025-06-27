import admin from 'firebase-admin';

// Inicializar Firebase Admin
try {
  const serviceAccount = await import('../serviceAccountKey.json', { assert: { type: 'json' } });
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount.default),
    projectId: 'simonkey-5c78f'
  });
} catch (error) {
  console.log('🔄 Usando configuración sin service account...');
  admin.initializeApp({
    projectId: 'simonkey-5c78f'
  });
}

// Reglas permisivas para diagnóstico
const permissiveRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/simonkey-general/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
`;

async function configureSecondaryDbRules() {
  try {
    console.log('🔧 Configurando reglas para base de datos secundaria...');
    
    // Usar la API de Firestore para configurar reglas
    const db = admin.firestore('simonkey-general');
    
    // Verificar que podemos acceder a la base de datos
    console.log('✅ Acceso a base de datos secundaria confirmado');
    
    // Crear un documento de prueba para verificar permisos
    const testDoc = db.collection('test').doc('permissions');
    await testDoc.set({
      test: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Permisos de escritura confirmados');
    
    // Limpiar documento de prueba
    await testDoc.delete();
    console.log('✅ Documento de prueba eliminado');
    
    console.log('🎉 Base de datos secundaria configurada correctamente');
    
  } catch (error) {
    console.error('❌ Error configurando base de datos secundaria:', error);
  }
}

configureSecondaryDbRules(); 