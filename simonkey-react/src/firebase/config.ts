// src/firebase/config.ts

// Configuración centralizada de Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyC26QZw7297E_YOoF5OqR2Ck6x_bw5_Hic",
  authDomain: "simonkey.ai", // Dominio personalizado
  projectId: "simonkey-5c78f",
  storageBucket: "simonkey-5c78f.appspot.com",
  messagingSenderId: "235501879490",
  appId: "1:235501879490:web:05fea6dae9c63b2a827b5b",
  measurementId: "G-JECV0QEPBW"
};

// Configuración específica para desarrollo local
export const firebaseConfigDev = {
  apiKey: "AIzaSyC26QZw7297E_YOoF5OqR2Ck6x_bw5_Hic",
  authDomain: "simonkey-5c78f.firebaseapp.com", // Dominio por defecto para desarrollo
  projectId: "simonkey-5c78f",
  storageBucket: "simonkey-5c78f.appspot.com",
  messagingSenderId: "235501879490",
  appId: "1:235501879490:web:05fea6dae9c63b2a827b5b",
  measurementId: "G-JECV0QEPBW"
};

// Configuración para diferentes entornos
export const getFirebaseConfig = () => {
  // Para desarrollo local, usar el dominio por defecto de Firebase
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    console.log('🔧 Usando configuración de desarrollo con dominio por defecto de Firebase');
    return firebaseConfigDev;
  }
  
  // Para producción, usar el dominio personalizado
  console.log('🌐 Usando configuración de producción con dominio personalizado');
  return firebaseConfig;
};

