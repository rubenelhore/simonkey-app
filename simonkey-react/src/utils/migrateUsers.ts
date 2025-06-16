import { db } from '../services/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { determineUserSubscription } from '../services/userService';
import { UserSubscriptionType } from '../types/interfaces';

/**
 * Script para migrar usuarios existentes y asignarles el tipo de suscripción apropiado
 * Este script debe ejecutarse una sola vez para actualizar usuarios existentes
 */
export const migrateExistingUsers = async () => {
  try {
    console.log('Iniciando migración de usuarios existentes...');
    
    // Obtener todos los usuarios
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        
        // Verificar si ya tiene el campo subscription
        if (!userData.subscription) {
          const subscriptionType = determineUserSubscription(userData.email);
          
          // Actualizar el documento del usuario
          await updateDoc(doc(db, 'users', userDoc.id), {
            subscription: subscriptionType,
            // Establecer límites por defecto
            maxNotebooks: subscriptionType === UserSubscriptionType.FREE ? 4 : -1,
            maxConceptsPerNotebook: subscriptionType === UserSubscriptionType.FREE || subscriptionType === UserSubscriptionType.PRO ? 100 : -1,
            notebooksCreatedThisWeek: 0,
            conceptsCreatedThisWeek: 0,
            weekStartDate: new Date()
          });
          
          console.log(`Usuario ${userData.email} migrado a tipo: ${subscriptionType}`);
          updatedCount++;
        } else {
          console.log(`Usuario ${userData.email} ya tiene tipo: ${userData.subscription}`);
        }
      } catch (error) {
        console.error(`Error migrando usuario ${userDoc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Migración completada. Usuarios actualizados: ${updatedCount}, Errores: ${errorCount}`);
    return { updatedCount, errorCount };
  } catch (error) {
    console.error('Error en la migración:', error);
    throw error;
  }
};

/**
 * Función para ejecutar la migración desde la consola del navegador
 * Solo debe ejecutarse por el super admin
 */
export const runMigration = async () => {
  // Verificar si el usuario actual es super admin
  const currentUser = localStorage.getItem('user');
  if (currentUser) {
    const userData = JSON.parse(currentUser);
    if (userData.email === 'ruben.elhore@gmail.com') {
      console.log('Ejecutando migración como super admin...');
      return await migrateExistingUsers();
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