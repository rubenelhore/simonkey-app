import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { studyStreakService } from '../services/studyStreakService';
import { useAuth } from '../contexts/AuthContext';

interface StreakDisplayData {
  days: {
    [key: string]: boolean; // 'monday', 'tuesday', etc.
  };
  consecutiveDays: number;
  streakBonus: number;
  hasStudiedToday: boolean;
}

const StreakTracker: React.FC = () => {
  const [user] = useAuthState(auth);
  const { effectiveUserId } = useAuth();
  const [streakData, setStreakData] = useState<StreakDisplayData>({
    days: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false
    },
    consecutiveDays: 0,
    streakBonus: 0,
    hasStudiedToday: false
  });
  const [loading, setLoading] = useState(true);

  // Días de la semana en español, abreviados
  const weekDays = [
    { key: 'monday', label: 'L' },
    { key: 'tuesday', label: 'M' },
    { key: 'wednesday', label: 'X' },
    { key: 'thursday', label: 'J' },
    { key: 'friday', label: 'V' },
    { key: 'saturday', label: 'S' },
    { key: 'sunday', label: 'D' }
  ];

  const fetchAndUpdateStreak = async () => {
    if (!user || !effectiveUserId) return;

    try {
      setLoading(true);
      
      // Usar el ID efectivo del usuario (puede ser diferente para usuarios escolares)
      const userId = effectiveUserId;
      console.log('[StreakTracker] Usando userId:', userId, 'Firebase UID:', user.uid);
      
      // Actualizar la racha si ha estudiado hoy
      const currentStreak = await studyStreakService.updateStreakIfStudied(userId);
      
      // Obtener los días de estudio de la semana actual
      const weekStudyDays = await studyStreakService.getWeekStudyDays(userId);
      
      // Verificar si ha estudiado hoy
      const hasStudiedToday = await studyStreakService.hasStudiedToday(userId);
      
      // Calcular el bonus de puntos
      const streakBonus = studyStreakService.getStreakBonus(currentStreak);
      
      console.log('[StreakTracker] Racha actual:', currentStreak);
      console.log('[StreakTracker] Días de estudio esta semana:', weekStudyDays);
      console.log('[StreakTracker] Ha estudiado hoy:', hasStudiedToday);
      console.log('[StreakTracker] Bonus de racha:', streakBonus);
      
      setStreakData({
        days: weekStudyDays,
        consecutiveDays: currentStreak,
        streakBonus: streakBonus,
        hasStudiedToday: hasStudiedToday
      });

    } catch (error) {
      console.error("Error al actualizar la racha:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndUpdateStreak();
    
    // Actualizar cada 5 minutos para reflejar cambios en tiempo real
    const interval = setInterval(() => {
      fetchAndUpdateStreak();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user, effectiveUserId]);

  if (loading) {
    return (
      <div className="streak-tracker-loading">
        Cargando racha...
      </div>
    );
  }

  return (
    <div className="streak-tracker">
      <h2>Tu racha actual</h2>
      <div className="streak-counter">
        <span className="streak-fire">🔥</span>
        <span className="streak-days">
          {streakData.consecutiveDays} {streakData.consecutiveDays === 1 ? 'día' : 'días'} consecutivos
        </span>
      </div>
      
      {/* Mostrar bonus de puntos */}
      {streakData.consecutiveDays > 0 && (
        <div className="streak-bonus">
          <span className="bonus-label">Bonus: </span>
          <span className="bonus-points">+{streakData.streakBonus.toLocaleString()}pts</span>
        </div>
      )}
      
      <div className="streak-calendar">
        {weekDays.map((day) => (
          <div
            key={day.key}
            className={`day-indicator ${streakData.days[day.key] ? 'active' : ''}`}
          >
            <span className="day-label">{day.label}</span>
            {/* Mostrar fuego si estudiaron ese día */}
            {streakData.days[day.key] && (
              <span className="day-fire">🔥</span>
            )}
          </div>
        ))}
      </div>
      
      {/* Mensaje motivacional */}
      {(streakData.consecutiveDays === 0 || !streakData.hasStudiedToday) && (
        <div className="streak-motivation">
          <p className="motivation-text">
            {streakData.consecutiveDays > 0 
              ? "¡Sigue así! Estudia al menos 1 minuto para mantener tu racha"
              : "Estudia al menos 1 minuto para comenzar tu racha"}
          </p>
        </div>
      )}
    </div>
  );
};

export default StreakTracker;