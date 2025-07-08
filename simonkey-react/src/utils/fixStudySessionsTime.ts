import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

/**
 * Función para corregir el campo timeSpent en las sesiones de estudio existentes
 * Esto es necesario porque las sesiones anteriores no tienen el campo timeSpent en minutos
 */
export const fixStudySessionsTime = async (userId?: string): Promise<void> => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) {
      console.error('No se pudo obtener el ID del usuario');
      return;
    }

    console.log('[Fix Study Sessions] Iniciando corrección de tiempos para usuario:', targetUserId);

    // Obtener todas las sesiones del usuario
    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', targetUserId)
    );

    const sessionsSnap = await getDocs(sessionsQuery);
    console.log('[Fix Study Sessions] Sesiones encontradas:', sessionsSnap.size);

    let updatedCount = 0;

    for (const sessionDoc of sessionsSnap.docs) {
      const session = sessionDoc.data();
      
      // Solo actualizar si no tiene timeSpent pero sí tiene sessionDuration o startTime/endTime
      if (!session.metrics?.timeSpent) {
        let timeSpentMinutes = 0;
        
        if (session.metrics?.sessionDuration) {
          // Si tiene sessionDuration en segundos, convertir a minutos
          timeSpentMinutes = Math.round(session.metrics.sessionDuration / 60);
        } else if (session.startTime && session.endTime) {
          // Calcular desde startTime y endTime
          const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
          const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
          const durationMs = end.getTime() - start.getTime();
          timeSpentMinutes = Math.round(durationMs / 60000); // Convertir a minutos
        } else if (session.startTime && !session.endTime) {
          // Si no tiene endTime, estimar 5 minutos para sesiones completadas
          console.log(`[Fix Study Sessions] Sesión ${sessionDoc.id} sin endTime, estimando 5 minutos`);
          timeSpentMinutes = 5;
        }

        if (timeSpentMinutes > 0) {
          console.log(`[Fix Study Sessions] Actualizando sesión ${sessionDoc.id} con ${timeSpentMinutes} minutos`);
          
          await updateDoc(doc(db, 'studySessions', sessionDoc.id), {
            'metrics.timeSpent': timeSpentMinutes
          });
          
          updatedCount++;
        }
      }
    }

    console.log(`[Fix Study Sessions] ✅ Corrección completada. ${updatedCount} sesiones actualizadas.`);
    
    // Si se actualizaron sesiones, forzar actualización de KPIs
    if (updatedCount > 0) {
      try {
        const { kpiService } = await import('../services/kpiService');
        console.log('[Fix Study Sessions] Actualizando KPIs después de corregir tiempos...');
        await kpiService.updateUserKPIs(targetUserId);
      } catch (kpiError) {
        console.error('[Fix Study Sessions] Error actualizando KPIs:', kpiError);
      }
    }

    return;
  } catch (error) {
    console.error('[Fix Study Sessions] Error corrigiendo tiempos:', error);
    throw error;
  }
};

// Hacer la función disponible globalmente para usar desde la consola
if (typeof window !== 'undefined') {
  (window as any).fixStudySessionsTime = fixStudySessionsTime;
}