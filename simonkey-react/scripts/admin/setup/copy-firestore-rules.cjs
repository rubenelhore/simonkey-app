const fs = require('fs');
const path = require('path');

console.log('=== Copiando Reglas de Firestore ===\n');

// Leer el archivo de reglas actual
const rulesPath = path.join(__dirname, '../../firestore.rules');

if (!fs.existsSync(rulesPath)) {
  console.error('❌ No se encontró el archivo firestore.rules');
  process.exit(1);
}

const rulesContent = fs.readFileSync(rulesPath, 'utf8');

console.log('📋 Archivo de reglas encontrado\n');
console.log('Las reglas actuales son para la base de datos (default).\n');

// Verificar si las reglas mencionan una base de datos específica
if (rulesContent.includes('database')) {
  console.log('⚠️  Las reglas parecen especificar una base de datos');
}

console.log('📌 Para aplicar las reglas a la base de datos (default):\n');
console.log('1. Ejecuta el siguiente comando:');
console.log('   firebase deploy --only firestore:rules\n');
console.log('2. O manualmente:');
console.log('   - Ve a Firebase Console: https://console.firebase.google.com/project/simonkey-5c78f/firestore/rules');
console.log('   - Selecciona la base de datos "(default)" en el dropdown');
console.log('   - Copia y pega las siguientes reglas:\n');
console.log('='.repeat(60));
console.log(rulesContent);
console.log('='.repeat(60));

// Crear un archivo de respaldo con las reglas para (default)
const backupPath = path.join(__dirname, '../../firestore-rules-default.txt');
fs.writeFileSync(backupPath, rulesContent);
console.log(`\n✅ Reglas guardadas en: firestore-rules-default.txt`);