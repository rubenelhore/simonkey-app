import { db } from '../services/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export const createTestStudySessions = async (userId: string, notebookId: string) => {
  try {
    console.log('[CreateTestStudySessions] Creando sesiones de prueba para usuario:', userId);
    console.log('[CreateTestStudySessions] Cuaderno:', notebookId);
    
    // Obtener la fecha actual y calcular el inicio de la semana
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);
    
    // Crear sesiones para diferentes días de la semana
    const sessions = [
      // Domingo - 30 minutos
      {
        date: new Date(currentWeekStart),
        duration: 30 * 60, // segundos
        mode: 'smart'
      },
      // Lunes - 45 minutos
      {
        date: new Date(currentWeekStart.getTime() + 1 * 24 * 60 * 60 * 1000),
        duration: 45 * 60,
        mode: 'smart'
      },
      // Martes - 60 minutos
      {
        date: new Date(currentWeekStart.getTime() + 2 * 24 * 60 * 60 * 1000),
        duration: 60 * 60,
        mode: 'free'
      },
      // Miércoles - 90 minutos
      {
        date: new Date(currentWeekStart.getTime() + 3 * 24 * 60 * 60 * 1000),
        duration: 90 * 60,
        mode: 'smart'
      },
      // Jueves - 40 minutos
      {
        date: new Date(currentWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000),
        duration: 40 * 60,
        mode: 'smart'
      },
      // Viernes - 55 minutos
      {
        date: new Date(currentWeekStart.getTime() + 5 * 24 * 60 * 60 * 1000),
        duration: 55 * 60,
        mode: 'free'
      },
      // Sábado - 25 minutos
      {
        date: new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        duration: 25 * 60,
        mode: 'smart'
      }
    ];
    
    console.log('[CreateTestStudySessions] Creando', sessions.length, 'sesiones de estudio...');
    
    for (const session of sessions) {
      const startTime = session.date;
      const endTime = new Date(startTime.getTime() + session.duration * 1000);
      
      const sessionData = {
        userId: userId,
        notebookId: notebookId,
        mode: session.mode,
        startTime: Timestamp.fromDate(startTime),
        endTime: Timestamp.fromDate(endTime),
        metrics: {
          sessionDuration: session.duration,
          timeSpent: Math.round(session.duration / 60), // minutos
          conceptsStudied: Math.floor(Math.random() * 10) + 5,
          conceptsDominados: Math.floor(Math.random() * 5) + 2,
          conceptosNoDominados: Math.floor(Math.random() * 3) + 1
        },
        validated: session.mode === 'smart' ? Math.random() > 0.3 : false,
        createdAt: Timestamp.now()
      };
      
      await addDoc(collection(db, 'studySessions'), sessionData);
      
      console.log(`[CreateTestStudySessions] Sesión creada para ${session.date.toLocaleDateString()} - ${Math.round(session.duration / 60)} minutos`);
    }
    
    console.log('[CreateTestStudySessions] ✅ Todas las sesiones creadas exitosamente');
    console.log('[CreateTestStudySessions] Ahora ejecuta testUpdateKPIs para actualizar los KPIs');
    
    return true;
  } catch (error) {
    console.error('[CreateTestStudySessions] Error:', error);
    throw error;
  }
};

// Exponer la función para poder usarla desde la consola
(window as any).createTestStudySessions = createTestStudySessions;