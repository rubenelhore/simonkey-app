import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy,
  Timestamp
} from 'firebase/firestore';

export const debugWeeklyStudyTime = async (userId: string) => {
  try {
    console.log('[DebugWeeklyStudyTime] === ANALIZANDO TIEMPO DE ESTUDIO SEMANAL ===');
    console.log('[DebugWeeklyStudyTime] Usuario:', userId);
    
    // Obtener la fecha de inicio de la semana actual
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
    
    console.log('[DebugWeeklyStudyTime] Semana actual:', {
      inicio: currentWeekStart.toLocaleString(),
      fin: currentWeekEnd.toLocaleString()
    });
    
    // Inicializar contadores por día
    const weeklyTime = {
      domingo: 0,
      lunes: 0,
      martes: 0,
      miercoles: 0,
      jueves: 0,
      viernes: 0,
      sabado: 0
    };
    
    const daysOfWeek = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    
    // 1. Buscar sesiones de estudio
    console.log('\n[DebugWeeklyStudyTime] 📚 SESIONES DE ESTUDIO:');
    const studySessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', userId)
    );
    const studySessionsSnap = await getDocs(studySessionsQuery);
    
    let sessionCount = 0;
    studySessionsSnap.forEach(doc => {
      const session = doc.data();
      if (session.startTime) {
        const sessionDate = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
        
        if (sessionDate >= currentWeekStart && sessionDate < currentWeekEnd) {
          sessionCount++;
          const dayOfWeek = sessionDate.getDay();
          const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyTime;
          
          let duration = 0;
          if (session.metrics?.sessionDuration) {
            duration = Math.round(session.metrics.sessionDuration / 60); // segundos a minutos
          } else if (session.metrics?.timeSpent) {
            duration = session.metrics.timeSpent; // ya en minutos
          } else if (session.startTime && session.endTime) {
            const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
            const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
            duration = Math.round((end.getTime() - start.getTime()) / 60000); // ms a minutos
          }
          
          weeklyTime[dayName] += duration;
          
          console.log(`  - ${sessionDate.toLocaleString()}: ${duration} min (${session.mode || 'unknown'}) - ${dayName}`);
        }
      }
    });
    console.log(`  Total sesiones esta semana: ${sessionCount}`);
    
    // 2. Buscar quiz results
    console.log('\n[DebugWeeklyStudyTime] 🎯 QUIZ RESULTS:');
    const quizResultsQuery = query(
      collection(db, 'users', userId, 'quizResults')
    );
    const quizResultsSnap = await getDocs(quizResultsQuery);
    
    let quizCount = 0;
    quizResultsSnap.forEach(doc => {
      const result = doc.data();
      if (result.timestamp) {
        const quizDate = result.timestamp.toDate ? result.timestamp.toDate() : new Date(result.timestamp);
        
        if (quizDate >= currentWeekStart && quizDate < currentWeekEnd) {
          quizCount++;
          const dayOfWeek = quizDate.getDay();
          const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyTime;
          
          const duration = result.totalTime ? Math.round(result.totalTime / 60) : 0;
          weeklyTime[dayName] += duration;
          
          console.log(`  - ${quizDate.toLocaleString()}: ${duration} min - ${dayName}`);
        }
      }
    });
    console.log(`  Total quizzes esta semana: ${quizCount}`);
    
    // 3. Buscar mini quiz results
    console.log('\n[DebugWeeklyStudyTime] 🎲 MINI QUIZ RESULTS:');
    const miniQuizQuery = query(
      collection(db, 'users', userId, 'miniQuizResults')
    );
    const miniQuizSnap = await getDocs(miniQuizQuery);
    
    let miniQuizCount = 0;
    miniQuizSnap.forEach(doc => {
      const result = doc.data();
      if (result.timestamp) {
        const miniQuizDate = result.timestamp.toDate ? result.timestamp.toDate() : new Date(result.timestamp);
        
        if (miniQuizDate >= currentWeekStart && miniQuizDate < currentWeekEnd) {
          miniQuizCount++;
          const dayOfWeek = miniQuizDate.getDay();
          const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyTime;
          
          const duration = result.totalTime ? Math.round(result.totalTime / 60) : 0;
          weeklyTime[dayName] += duration;
          
          console.log(`  - ${miniQuizDate.toLocaleString()}: ${duration} min - ${dayName}`);
        }
      }
    });
    console.log(`  Total mini quizzes esta semana: ${miniQuizCount}`);
    
    // 4. Buscar actividades (como respaldo)
    console.log('\n[DebugWeeklyStudyTime] 📊 ACTIVIDADES:');
    const activitiesQuery = query(
      collection(db, 'activities'),
      where('userId', '==', userId),
      where('type', 'in', ['study_session', 'study', 'intelligent_study', 'free_study'])
    );
    const activitiesSnap = await getDocs(activitiesQuery);
    
    let activityCount = 0;
    activitiesSnap.forEach(doc => {
      const activity = doc.data();
      if (activity.timestamp) {
        const activityDate = activity.timestamp.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp);
        
        if (activityDate >= currentWeekStart && activityDate < currentWeekEnd) {
          activityCount++;
          const dayOfWeek = activityDate.getDay();
          const dayName = daysOfWeek[dayOfWeek] as keyof typeof weeklyTime;
          
          // Estimar 5 minutos por actividad si no hay duración específica
          const duration = 5;
          weeklyTime[dayName] += duration;
          
          console.log(`  - ${activityDate.toLocaleString()}: ${duration} min (estimado) - ${activity.type} - ${dayName}`);
        }
      }
    });
    console.log(`  Total actividades esta semana: ${activityCount}`);
    
    // 5. Comparar con KPIs guardados
    console.log('\n[DebugWeeklyStudyTime] 📈 KPIS GUARDADOS:');
    const kpisDoc = await getDoc(doc(db, 'users', userId, 'kpis', 'dashboard'));
    if (kpisDoc.exists()) {
      const kpis = kpisDoc.data();
      if (kpis.tiempoEstudioSemanal) {
        console.log('  Tiempo semanal en KPIs:', kpis.tiempoEstudioSemanal);
      } else {
        console.log('  ⚠️ No hay tiempoEstudioSemanal en los KPIs');
      }
    } else {
      console.log('  ❌ No se encontraron KPIs para este usuario');
    }
    
    // Resumen final
    console.log('\n[DebugWeeklyStudyTime] === RESUMEN FINAL ===');
    console.log('Tiempo calculado por día:');
    Object.entries(weeklyTime).forEach(([dia, minutos]) => {
      console.log(`  ${dia}: ${minutos} minutos (${Math.round(minutos / 60 * 10) / 10} horas)`);
    });
    
    const totalMinutos = Object.values(weeklyTime).reduce((sum, min) => sum + min, 0);
    console.log(`\nTOTAL SEMANA: ${totalMinutos} minutos (${Math.round(totalMinutos / 60 * 10) / 10} horas)`);
    console.log('===================================');
    
    return weeklyTime;
    
  } catch (error) {
    console.error('[DebugWeeklyStudyTime] Error:', error);
    throw error;
  }
};

// Exponer la función para poder usarla desde la consola
(window as any).debugWeeklyStudyTime = debugWeeklyStudyTime;