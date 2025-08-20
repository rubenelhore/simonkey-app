// src/services/firebase.ts

import { initializeApp } from 'firebase/app';
import { getAnalytics, Analytics } from 'firebase/analytics';
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
import { getFirebaseConfig } from '../firebase/config';

// Usar configuración centralizada
const firebaseConfig = getFirebaseConfig();

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Analytics si está disponible
let analytics: Analytics | undefined;
if (typeof window !== 'undefined') {
  const initAnalytics = () => {
    if (!analytics && navigator.onLine) {
      try {
        analytics = getAnalytics(app);
        console.log('✅ Analytics inicializado correctamente');
      } catch (error: any) {
        // Solo mostrar advertencia si no es un error de instalación offline
        if (!error?.message?.includes('app-offline')) {
          console.warn('📊 Error al inicializar Analytics:', error);
        }
      }
    }
  };
  
  // Intentar inicializar Analytics
  initAnalytics();
  
  // Reintentar cuando se recupere la conexión
  window.addEventListener('online', () => {
    console.log('🌐 Conexión recuperada, reintentando Analytics...');
    initAnalytics();
  });
  
  // Log cuando se pierda la conexión
  window.addEventListener('offline', () => {
    console.warn('📵 Conexión perdida');
  });
}

// Exportar la app y analytics para uso en diagnósticos
export { app, analytics };

// Exportar servicios de Firebase
export const auth = getAuth(app);

// Obtener Firestore con la base de datos específica (misma que Cloud Functions)
export const db = getFirestore(app);

export const storage = getStorage(app);
export const functions = getFunctions(app);

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