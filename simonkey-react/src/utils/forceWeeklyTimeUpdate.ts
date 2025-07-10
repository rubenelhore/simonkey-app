import { db } from '../services/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export const forceWeeklyTimeUpdate = async (userId: string) => {
  try {
    console.log('[ForceWeeklyTimeUpdate] === FORZANDO ACTUALIZACIÓN DE TIEMPO SEMANAL ===');
    console.log('[ForceWeeklyTimeUpdate] Usuario:', userId);
    
    // Primero obtener los KPIs actuales
    const kpisDocRef = doc(db, 'users', userId, 'kpis', 'dashboard');
    const kpisDoc = await getDoc(kpisDocRef);
    
    if (!kpisDoc.exists()) {
      console.log('[ForceWeeklyTimeUpdate] ❌ No hay KPIs. Ejecuta testUpdateKPIs primero');
      return false;
    }
    
    const kpisData = kpisDoc.data();
    
    // Si no hay tiempoEstudioSemanal, crearlo con datos de ejemplo
    if (!kpisData.tiempoEstudioSemanal) {
      console.log('[ForceWeeklyTimeUpdate] Creando tiempoEstudioSemanal con datos de ejemplo...');
      
      const tiempoEstudioSemanal = {
        domingo: 30,
        lunes: 45,
        martes: 60,
        miercoles: 90,
        jueves: 40,
        viernes: 55,
        sabado: 25
      };
      
      await updateDoc(kpisDocRef, {
        tiempoEstudioSemanal: tiempoEstudioSemanal
      });
      
      console.log('[ForceWeeklyTimeUpdate] ✅ Tiempo semanal agregado:', tiempoEstudioSemanal);
      console.log('[ForceWeeklyTimeUpdate] Total:', Object.values(tiempoEstudioSemanal).reduce((a, b) => a + b, 0), 'minutos');
      
    } else {
      console.log('[ForceWeeklyTimeUpdate] Ya existe tiempoEstudioSemanal:', kpisData.tiempoEstudioSemanal);
      
      // Verificar si todos los días tienen 0
      const tiempoTotal = Object.values(kpisData.tiempoEstudioSemanal).reduce((sum: number, time: any) => sum + (time || 0), 0);
      
      if (tiempoTotal === 0) {
        console.log('[ForceWeeklyTimeUpdate] ⚠️ Todos los días tienen 0 minutos');
        console.log('[ForceWeeklyTimeUpdate] Actualizando con datos de ejemplo...');
        
        const tiempoEstudioSemanal = {
          domingo: 30,
          lunes: 45,
          martes: 60,
          miercoles: 90,
          jueves: 40,
          viernes: 55,
          sabado: 25
        };
        
        await updateDoc(kpisDocRef, {
          tiempoEstudioSemanal: tiempoEstudioSemanal
        });
        
        console.log('[ForceWeeklyTimeUpdate] ✅ Tiempo semanal actualizado');
      }
    }
    
    console.log('[ForceWeeklyTimeUpdate] Recarga la página de Progreso para ver los cambios');
    return true;
    
  } catch (error) {
    console.error('[ForceWeeklyTimeUpdate] Error:', error);
    throw error;
  }
};

// Función alternativa para actualizar con tiempo real desde las sesiones
export const updateWeeklyTimeFromSessions = async (userId: string) => {
  try {
    console.log('[UpdateWeeklyTimeFromSessions] Actualizando desde sesiones reales...');
    
    // Importar y ejecutar la función de debug que ya calcula el tiempo correcto
    const { debugWeeklyStudyTime } = await import('./debugWeeklyStudyTime');
    const weeklyTime = await debugWeeklyStudyTime(userId);
    
    if (weeklyTime) {
      // Actualizar los KPIs con el tiempo calculado
      const kpisDocRef = doc(db, 'users', userId, 'kpis', 'dashboard');
      await updateDoc(kpisDocRef, {
        tiempoEstudioSemanal: weeklyTime
      });
      
      console.log('[UpdateWeeklyTimeFromSessions] ✅ KPIs actualizados con tiempo real');
      console.log('[UpdateWeeklyTimeFromSessions] Recarga la página para ver los cambios');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[UpdateWeeklyTimeFromSessions] Error:', error);
    throw error;
  }
};

// Exponer las funciones para poder usarlas desde la consola
(window as any).forceWeeklyTimeUpdate = forceWeeklyTimeUpdate;
(window as any).updateWeeklyTimeFromSessions = updateWeeklyTimeFromSessions;