import { studyStreakService } from '../services/studyStreakService';
import { auth } from '../services/firebase';

/**
 * Función de utilidad para forzar la actualización de la racha
 * Útil para debugging
 */
export async function forceUpdateStreak() {
  const user = auth.currentUser;
  if (!user) {
    console.log('❌ No hay usuario autenticado');
    return;
  }

  try {
    console.log('🔄 Forzando actualización de racha para:', user.uid);
    
    // Verificar si ha estudiado hoy
    const hasStudied = await studyStreakService.hasStudiedToday(user.uid);
    console.log('📚 ¿Ha estudiado hoy?:', hasStudied);
    
    // Actualizar la racha
    const newStreak = await studyStreakService.updateStreakIfStudied(user.uid);
    console.log('🔥 Racha actualizada:', newStreak);
    
    // Obtener días de estudio de la semana
    const weekDays = await studyStreakService.getWeekStudyDays(user.uid);
    console.log('📅 Días con estudio esta semana:', weekDays);
    
    // Obtener datos completos de la racha
    const streakData = await studyStreakService.getUserStreak(user.uid);
    console.log('📊 Datos completos de la racha:', streakData);
    
  } catch (error) {
    console.error('❌ Error actualizando racha:', error);
  }
}

// Exponer globalmente para debugging
if (typeof window !== 'undefined') {
  (window as any).forceUpdateStreak = forceUpdateStreak;
  console.log('🛠️ Función forceUpdateStreak() disponible en la consola');
}