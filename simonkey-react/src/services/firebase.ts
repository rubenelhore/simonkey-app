// src/services/firebase.ts

import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { getStorage } from "firebase/storage";
import { getFunctions, httpsCallable } from 'firebase/functions';

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC26QZw7297E_YOoF5OqR2Ck6x_bw5_Hic",
  authDomain: "simonkey-5c78f.firebaseapp.com",
  projectId: "simonkey-5c78f",
  storageBucket: "simonkey-5c78f.firebasestorage.app",
  messagingSenderId: "235501879490",
  appId: "1:235501879490:web:05fea6dae9c63b2a827b5b"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar la app para uso en diagnósticos
export { app };

// Exportar servicios de Firebase
export const auth = getAuth(app);

// Obtener Firestore con la base de datos específica (misma que Cloud Functions)
export const db = getFirestore(app, 'simonkey-general');

export const storage = getStorage(app);

// Configurar persistencia para autenticación (mantener sesión activa)
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Error configurando persistencia de autenticación:", error);
  });

// Exportación explícita de Firestore (para mayor claridad)
export const firestore = db;

// Exportar tipos y funciones de Firestore comúnmente usados
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
};

// Funciones de utilidad para trabajar con Firebase
export const firebaseUtils = {
  // Convertir timestamps de Firestore a Date
  timestampToDate: (timestamp: any) => {
    if (!timestamp) return null;
    return timestamp.toDate ? timestamp.toDate() : timestamp;
  },
  
  // Eliminar campos undefined antes de enviar a Firestore
  cleanUndefinedFields: (obj: Record<string, any>) => {
    const cleanedObj = { ...obj };
    Object.keys(cleanedObj).forEach(key => {
      if (cleanedObj[key] === undefined) {
        delete cleanedObj[key];
      }
    });
    return cleanedObj;
  }
};