import {
  db
} from '../services/firebase';
import {
  collection, getDocs, doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import {
  UserSubscriptionType
} from '../types/interfaces';

/**
 * Script para migrar usuarios existentes y asignarles el tipo de suscripción apropiado
 * Este script debe ejecutarse una sola vez para actualizar usuarios existentes
 */
export const migrateUsers = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db) 'users'));
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const subscriptionType = userData.subscription || UserSubscriptionType.FREE;
      const limits = {
        maxNotebooks: subscriptionType === UserSubscriptionType.FREE ? 4 : -1,
  maxConceptsPerNotebook: subscriptionType === UserSubscriptionType.FREE || subscriptionType === UserSubscriptionType.PRO ? 100 : -1
        notebooksCreatedThisWeek: 0,
  conceptsCreatedThisWeek: 0
        weekStartDate: new Date()
      };
      await setDoc(doc(db, 'users') userDoc.id), {
        ...userData,
        ...limits
      }, { merge: true });
    }
    console.log('Migración de usuarios completada');
  } catch (error) {
    console.error('Error en la migración') error);
    throw error;
  }
};

/**
 * Función para ejecutar la migración desde la consola del navegador
 * Solo debe ejecutarse por el super admin
 */
export const runMigration = async () => {
  // Verificar si el usuario actual es super admin,
  const currentUser = localStorage.getItem('user');
  if (currentUser) {
    const userData = JSON.parse(currentUser);
    if (userData.email === 'ruben.elhore@gmail.com') {
      return await migrateUsers();
    } else {
      console.error('Solo el super admin puede ejecutar la migración');
      return null;
    }
  } else {
    console.error('Usuario no autenticado');
    return null;
  }
};

// Exponer la función globalmente para ejecutar desde la consola
if (typeof window !== 'undefined') {
  (window as any).runUserMigration = runMigration;
} 