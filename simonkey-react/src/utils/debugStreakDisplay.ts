// Utilidad temporal para depurar el problema de visualización de fueguitos
import { studyStreakService } from '../services/studyStreakService';

export async function debugStreakDisplay(userId: string) {
  console.log('=== DEBUG STREAK DISPLAY ===');
  console.log('User ID:', userId);
  
  try {
    // 1. Verificar si ha estudiado hoy
    const hasStudiedToday = await studyStreakService.hasStudiedToday(userId);
    console.log('Ha estudiado hoy:', hasStudiedToday);
    
    // 2. Obtener datos de racha
    const streakData = await studyStreakService.getUserStreak(userId);
    console.log('Datos de racha:', {
      currentStreak: streakData.currentStreak,
      lastStudyDate: streakData.lastStudyDate,
      historyLength: streakData.studyHistory?.length
    });
    
    // 3. Obtener días de la semana
    const weekDays = await studyStreakService.getWeekStudyDays(userId);
    console.log('Días de la semana con estudio:', weekDays);
    
    // 4. Verificar mapeo de días
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayMapping: { [key: number]: string } = {
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
      0: 'sunday'
    };
    
    console.log('Hoy es:', {
      fecha: today.toLocaleDateString('es-ES'),
      diaSemana: dayMapping[dayOfWeek],
      dayOfWeek: dayOfWeek
    });
    
    // 5. Calcular inicio de semana
    const startOfWeek = new Date(today);
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    startOfWeek.setDate(today.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    console.log('Inicio de semana:', startOfWeek.toLocaleDateString('es-ES'));
    
    return {
      hasStudiedToday,
      streakData,
      weekDays,
      debug: {
        today: today.toISOString(),
        startOfWeek: startOfWeek.toISOString(),
        dayOfWeek,
        dayName: dayMapping[dayOfWeek]
      }
    };
  } catch (error) {
    console.error('Error en debugStreakDisplay:', error);
    return null;
  }
}

// Exportar para uso en consola del navegador
if (typeof window !== 'undefined') {
  (window as any).debugStreakDisplay = debugStreakDisplay;
}