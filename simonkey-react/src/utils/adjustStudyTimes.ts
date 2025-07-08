import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

/**
 * Función para ajustar los tiempos de estudio a valores más realistas
 */
export const adjustStudyTimes = async (userId?: string, maxMinutesPerSession: number = 5): Promise<void> => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) {
      console.error('No se pudo obtener el ID del usuario');
      return;
    }

    console.log('[Adjust Study Times] Iniciando ajuste de tiempos para usuario:', targetUserId);
    console.log('[Adjust Study Times] Tiempo máximo por sesión:', maxMinutesPerSession, 'minutos');

    // Obtener todas las sesiones del usuario
    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', targetUserId)
    );

    const sessionsSnap = await getDocs(sessionsQuery);
    console.log('[Adjust Study Times] Sesiones encontradas:', sessionsSnap.size);

    let adjustedCount = 0;
    const updates: Promise<void>[] = [];

    for (const sessionDoc of sessionsSnap.docs) {
      const session = sessionDoc.data();
      let currentTimeSpent = 0;
      
      // Obtener el tiempo actual
      if (session.metrics?.timeSpent) {
        currentTimeSpent = session.metrics.timeSpent;
      } else if (session.metrics?.sessionDuration) {
        currentTimeSpent = Math.round(session.metrics.sessionDuration / 60);
      }
      
      // Si el tiempo es mayor al máximo permitido, ajustarlo
      if (currentTimeSpent > maxMinutesPerSession) {
        console.log(`[Adjust Study Times] Ajustando sesión ${sessionDoc.id}: ${currentTimeSpent} -> ${maxMinutesPerSession} minutos`);
        
        const updatePromise = updateDoc(doc(db, 'studySessions', sessionDoc.id), {
          'metrics.timeSpent': maxMinutesPerSession,
          'metrics.sessionDuration': maxMinutesPerSession * 60, // También actualizar en segundos
          'metrics.adjustedAt': new Date(),
          'metrics.originalTimeSpent': currentTimeSpent
        });
        
        updates.push(updatePromise);
        adjustedCount++;
      }
    }

    // Ejecutar todas las actualizaciones
    if (updates.length > 0) {
      console.log('[Adjust Study Times] Ejecutando actualizaciones...');
      await Promise.all(updates);
      console.log(`[Adjust Study Times] ✅ Ajuste completado. ${adjustedCount} sesiones actualizadas.`);
      
      // Actualizar KPIs después de ajustar
      try {
        const { kpiService } = await import('../services/kpiService');
        console.log('[Adjust Study Times] Actualizando KPIs después de ajustar tiempos...');
        await kpiService.updateUserKPIs(targetUserId);
      } catch (kpiError) {
        console.error('[Adjust Study Times] Error actualizando KPIs:', kpiError);
      }
    } else {
      console.log('[Adjust Study Times] No hay sesiones que ajustar.');
    }

  } catch (error) {
    console.error('[Adjust Study Times] Error:', error);
    throw error;
  }
};

/**
 * Función para restaurar los tiempos originales (si los guardamos)
 */
export const restoreOriginalTimes = async (userId?: string): Promise<void> => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) {
      console.error('No se pudo obtener el ID del usuario');
      return;
    }

    console.log('[Restore Study Times] Iniciando restauración de tiempos originales...');

    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', targetUserId)
    );

    const sessionsSnap = await getDocs(sessionsQuery);
    let restoredCount = 0;

    for (const sessionDoc of sessionsSnap.docs) {
      const session = sessionDoc.data();
      
      if (session.metrics?.originalTimeSpent) {
        console.log(`[Restore Study Times] Restaurando sesión ${sessionDoc.id}: ${session.metrics.originalTimeSpent} minutos`);
        
        await updateDoc(doc(db, 'studySessions', sessionDoc.id), {
          'metrics.timeSpent': session.metrics.originalTimeSpent,
          'metrics.sessionDuration': session.metrics.originalTimeSpent * 60,
          'metrics.adjustedAt': null,
          'metrics.originalTimeSpent': null
        });
        
        restoredCount++;
      }
    }

    console.log(`[Restore Study Times] ✅ Restauración completada. ${restoredCount} sesiones restauradas.`);

  } catch (error) {
    console.error('[Restore Study Times] Error:', error);
    throw error;
  }
};

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).adjustStudyTimes = adjustStudyTimes;
  (window as any).restoreOriginalTimes = restoreOriginalTimes;
}