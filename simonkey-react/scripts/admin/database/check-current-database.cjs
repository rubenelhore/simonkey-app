const fs = require('fs');
const path = require('path');

console.log('=== Verificación de Base de Datos Actual ===\n');

// Buscar en archivos de configuración
const filesToCheck = [
  'src/services/firebase.ts',
  'src/firebase/config.ts',
  'functions/src/config.ts',
  'functions/src/index.ts'
];

console.log('🔍 Buscando configuración de base de datos...\n');

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, '../..', file);
  
  if (fs.existsSync(filePath)) {
    console.log(`📄 ${file}:`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Buscar referencias a databaseId
    const databaseIdMatch = content.match(/databaseId:\s*['"]([^'"]+)['"]/);
    if (databaseIdMatch) {
      console.log(`   ✅ databaseId encontrado: "${databaseIdMatch[1]}"`);
    }
    
    // Buscar getFirestore con parámetros
    const firestoreMatch = content.match(/getFirestore\([^)]*\)/g);
    if (firestoreMatch) {
      firestoreMatch.forEach(match => {
        if (match.includes('databaseId') || match.length > 20) {
          console.log(`   📌 getFirestore: ${match}`);
        }
      });
    }
    
    // Buscar initializeFirestore
    const initMatch = content.match(/initializeFirestore\([^}]+\}/gs);
    if (initMatch) {
      initMatch.forEach(match => {
        if (match.includes('databaseId')) {
          console.log(`   📌 initializeFirestore con databaseId`);
        }
      });
    }
    
    console.log('');
  } else {
    console.log(`❌ ${file} - No encontrado\n`);
  }
});

console.log('\n📋 RESUMEN:');
console.log('Si ves "databaseId: \'simonkey-general\'" significa que estás usando la base de datos nombrada.');
console.log('Si NO ves ningún databaseId, estás usando la base de datos (default).\n');

console.log('⚠️  IMPORTANTE:');
console.log('Para cambiar a la base de datos (default), debes:');
console.log('1. Eliminar TODOS los parámetros databaseId de getFirestore()');
console.log('2. Eliminar databaseId de initializeFirestore() si existe');
console.log('3. Asegurarte de que getFirestore() se llame sin parámetros');