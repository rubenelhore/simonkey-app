const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Opciones de configuración
console.log('=== Configuración de Firebase Admin SDK ===\n');

// Opción 1: Usar archivo de credenciales de servicio (más seguro)
const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ Archivo de credenciales encontrado');
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} 
// Opción 2: Usar variables de entorno
else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('✅ Usando credenciales desde variable de entorno');
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
// Opción 3: Usar Application Default Credentials (en Google Cloud)
else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('✅ Usando Google Application Default Credentials');
  admin.initializeApp();
}
else {
  console.error('❌ No se encontraron credenciales de Firebase Admin');
  console.log('\nPara configurar Firebase Admin SDK, necesitas una de las siguientes opciones:\n');
  console.log('1. Descargar el archivo de credenciales de servicio:');
  console.log('   - Ve a Firebase Console > Configuración del proyecto > Cuentas de servicio');
  console.log('   - Haz clic en "Generar nueva clave privada"');
  console.log('   - Guarda el archivo como "serviceAccountKey.json" en la raíz del proyecto');
  console.log('   - Asegúrate de agregarlo a .gitignore\n');
  console.log('2. Configurar variable de entorno FIREBASE_SERVICE_ACCOUNT con el JSON completo\n');
  console.log('3. Configurar GOOGLE_APPLICATION_CREDENTIALS (para entornos de Google Cloud)\n');
  process.exit(1);
}

// Obtener servicios
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Exportar instancias configuradas
module.exports = {
  admin,
  db: getFirestore(),
  auth: getAuth()
};

console.log('✅ Firebase Admin SDK configurado correctamente\n');