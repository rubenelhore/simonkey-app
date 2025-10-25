// scripts/check-firebase-initialization.js

import { initializeApp, getApps } from 'firebase/app';

console.log('🔍 Verificando inicialización de Firebase...');

// Configuración de Firebase
const config = {
  apiKey: "AIzaSyC26QZw7297E_YOoF5OqR2Ck6x_bw5_Hic",
  authDomain: "simonkey.ai",
  projectId: "simonkey-5c78f",
  storageBucket: "simonkey-5c78f.firebasestorage.app",
  messagingSenderId: "235501879490",
  appId: "1:235501879490:web:05fea6dae9c63b2a827b5b"
};
console.log('📋 Configuración:', JSON.stringify(config, null, 2));

// Verificar si ya hay apps inicializadas
const existingApps = getApps();
console.log(`📊 Apps de Firebase existentes: ${existingApps.length}`);

if (existingApps.length > 0) {
  console.log('⚠️  Ya hay apps de Firebase inicializadas:');
  existingApps.forEach((app, index) => {
    console.log(`  ${index + 1}. ${app.name} - ${app.options.projectId}`);
  });
}

// Intentar inicializar una nueva app
try {
  const app = initializeApp(config);
  console.log('✅ Firebase inicializado correctamente');
  console.log(`🌐 Auth Domain: ${app.options.authDomain}`);
  console.log(`📦 Project ID: ${app.options.projectId}`);
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error.message);
  
  if (error.message.includes('duplicate-app')) {
    console.log('\n💡 SOLUCIÓN:');
    console.log('1. Verifica que no haya múltiples inicializaciones de Firebase');
    console.log('2. Asegúrate de que todos los archivos usen la misma configuración');
    console.log('3. Revisa que no se importe fixUserProfile.ts en producción');
  }
}

console.log('\n📝 Verificación completada'); 