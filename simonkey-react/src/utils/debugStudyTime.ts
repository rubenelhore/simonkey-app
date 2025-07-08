import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

/**
 * Función para debuggear y ver qué sesiones están causando el tiempo alto
 */
export const debugStudyTime = async (userId?: string): Promise<void> => {
  try {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) {
      console.error('No se pudo obtener el ID del usuario');
      return;
    }

    console.log('[Debug Study Time] Analizando sesiones para usuario:', targetUserId);

    // Obtener la fecha de inicio de la semana actual
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);

    console.log('[Debug Study Time] Semana actual:', {
      inicio: currentWeekStart.toISOString(),
      fin: currentWeekEnd.toISOString()
    });

    // Obtener todas las sesiones del usuario
    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', targetUserId)
    );

    const sessionsSnap = await getDocs(sessionsQuery);
    console.log('[Debug Study Time] Total de sesiones encontradas:', sessionsSnap.size);

    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const timeByDay = new Map<number, { total: 0, sessions: any[] }>();
    
    // Inicializar
    for (let i = 0; i < 7; i++) {
      timeByDay.set(i, { total: 0, sessions: [] });
    }

    // Analizar cada sesión
    sessionsSnap.forEach(doc => {
      const session = doc.data();
      const sessionDate = session.startTime?.toDate ? session.startTime.toDate() : new Date(session.startTime);
      
      // Solo procesar sesiones de esta semana
      if (sessionDate >= currentWeekStart && sessionDate < currentWeekEnd) {
        const dayOfWeek = sessionDate.getDay();
        let duration = 0;
        
        // Calcular duración
        if (session.metrics?.timeSpent) {
          duration = session.metrics.timeSpent;
        } else if (session.metrics?.sessionDuration) {
          duration = Math.round(session.metrics.sessionDuration / 60);
        } else if (session.startTime && session.endTime) {
          const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
          const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
          duration = Math.round((end.getTime() - start.getTime()) / 60000);
        }
        
        const dayData = timeByDay.get(dayOfWeek)!;
        dayData.total += duration;
        dayData.sessions.push({
          id: doc.id,
          date: sessionDate.toISOString(),
          duration: duration,
          mode: session.mode,
          notebookId: session.notebookId,
          hasTimeSpent: !!session.metrics?.timeSpent,
          hasSessionDuration: !!session.metrics?.sessionDuration,
          hasEndTime: !!session.endTime
        });
      }
    });

    // Mostrar resultados
    console.log('[Debug Study Time] === RESUMEN POR DÍA ===');
    for (let i = 0; i < 7; i++) {
      const dayData = timeByDay.get(i)!;
      if (dayData.sessions.length > 0) {
        console.log(`\n${weekDays[i]}: ${dayData.total} minutos (${dayData.sessions.length} sesiones)`);
        dayData.sessions.forEach(s => {
          console.log(`  - Sesión ${s.id.substring(0, 8)}...`);
          console.log(`    Fecha: ${new Date(s.date).toLocaleString()}`);
          console.log(`    Duración: ${s.duration} minutos`);
          console.log(`    Modo: ${s.mode}`);
          console.log(`    Campos disponibles: ${s.hasTimeSpent ? 'timeSpent' : ''} ${s.hasSessionDuration ? 'sessionDuration' : ''} ${s.hasEndTime ? 'endTime' : ''}`);
        });
      }
    }

    // Buscar también en actividades
    console.log('\n[Debug Study Time] === BUSCANDO EN ACTIVIDADES ===');
    const activitiesQuery = query(
      collection(db, 'activities'),
      where('userId', '==', targetUserId),
      where('type', 'in', ['study_session', 'study', 'intelligent_study', 'free_study'])
    );
    
    const activitiesSnap = await getDocs(activitiesQuery);
    let activityCount = 0;
    
    activitiesSnap.forEach(doc => {
      const activity = doc.data();
      const activityDate = activity.timestamp?.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp);
      
      if (activityDate >= currentWeekStart && activityDate < currentWeekEnd) {
        activityCount++;
        console.log(`  - Actividad: ${activity.type} en ${activityDate.toLocaleString()}`);
      }
    });
    
    console.log(`[Debug Study Time] Actividades de estudio esta semana: ${activityCount}`);

  } catch (error) {
    console.error('[Debug Study Time] Error:', error);
  }
};

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).debugStudyTime = debugStudyTime;
}