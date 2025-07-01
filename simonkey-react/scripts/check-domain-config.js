// scripts/check-domain-config.js

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC26QZw7297E_YOoF5OqR2Ck6x_bw5_Hic",
  authDomain: "simonkey.ai", // Dominio personalizado
  projectId: "simonkey-5c78f",
  storageBucket: "simonkey-5c78f.firebasestorage.app",
  messagingSenderId: "235501879490",
  appId: "1:235501879490:web:05fea6dae9c63b2a827b5b"
};

console.log('🔍 Verificando configuración de Firebase...');
console.log('📋 Configuración actual:');
console.log(JSON.stringify(firebaseConfig, null, 2));

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

console.log('\n✅ Firebase inicializado correctamente');
console.log(`🌐 Auth Domain configurado: ${firebaseConfig.authDomain}`);
console.log(`📦 Project ID: ${firebaseConfig.projectId}`);

console.log('\n📝 Pasos para completar la configuración:');
console.log('1. Ve a Firebase Console: https://console.firebase.google.com/');
console.log('2. Selecciona tu proyecto: simonkey-5c78f');
console.log('3. Ve a Authentication → Settings → Authorized domains');
console.log('4. Agrega simonkey.ai a la lista de dominios autorizados');
console.log('5. Guarda los cambios');
console.log('\n⚠️  IMPORTANTE: Los cambios pueden tardar hasta 5 minutos en propagarse');

console.log('\n🔗 Enlaces útiles:');
console.log('- Firebase Console: https://console.firebase.google.com/project/simonkey-5c78f/authentication/settings');
console.log('- Documentación: https://firebase.google.com/docs/auth/web/google-signin#configure_oauth_20_client_id'); 