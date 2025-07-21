import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { studyStreakService } from '../services/studyStreakService';
import { useAuth } from '../contexts/AuthContext';
import { debugStreakDisplay } from '../utils/debugStreakDisplay';

interface StreakDisplayData {
  days: {
    [key: string]: boolean; // 'monday', 'tuesday', etc.
  };
  consecutiveDays: number;
  streakBonus: number;
  hasStudiedToday: boolean;
}

interface StreakTrackerProps {
  streakData?: {
    days: { [key: string]: boolean };
    consecutiveDays: number;
    streakBonus: number;
    hasStudiedToday: boolean;
  };
}

const StreakTracker: React.FC<StreakTrackerProps> = ({ streakData: streakDataProp }) => {
  const [user] = useAuthState(auth);
  const { effectiveUserId } = useAuth();
  const [streakData, setStreakData] = useState<StreakDisplayData>(streakDataProp || {
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
  const [loading, setLoading] = useState(!streakDataProp);

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
      
      // Primero verificar si ha estudiado hoy
      const hasStudiedToday = await studyStreakService.hasStudiedToday(userId);
      
      // Solo actualizar la racha si ha estudiado
      let currentStreak = 0;
      const streakData = await studyStreakService.getUserStreak(userId);
      
      if (hasStudiedToday) {
        currentStreak = await studyStreakService.updateStreakIfStudied(userId);
      } else {
        // Si no ha estudiado hoy, verificar si la racha sigue activa
        if (streakData.lastStudyDate) {
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          
          // Solo mantener la racha si estudió ayer
          if (streakData.lastStudyDate.toDateString() === yesterday.toDateString()) {
            currentStreak = streakData.currentStreak;
          } else {
            // La racha se rompió, mostrar 0
            currentStreak = 0;
          }
        } else {
          // Nunca ha estudiado, mostrar 0
          currentStreak = 0;
        }
      }
      
      // Obtener los días de estudio de la semana actual
      const weekStudyDays = await studyStreakService.getWeekStudyDays(userId);
      
      // Calcular el bonus de puntos solo si hay racha
      const streakBonus = currentStreak > 0 ? studyStreakService.getStreakBonus(currentStreak) : 0;
      
      console.log('[StreakTracker] Racha actual:', currentStreak);
      console.log('[StreakTracker] Días de estudio esta semana:', weekStudyDays);
      console.log('[StreakTracker] Ha estudiado hoy:', hasStudiedToday);
      console.log('[StreakTracker] Bonus de racha:', streakBonus);
      
      // Log adicional para depuración
      const today = new Date();
      console.log('[StreakTracker] Fecha actual:', today.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }));
      console.log('[StreakTracker] getDay():', today.getDay());
      
      // Debug adicional
      if (userId === 'dTjO1PRNgRgvmOYItXhHseqpOY72') {
        debugStreakDisplay(userId);
      }
      
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
    if (streakDataProp) {
      setStreakData(streakDataProp);
      setLoading(false);
      return;
    }
    fetchAndUpdateStreak();
    
    // Actualizar cada 5 minutos para reflejar cambios en tiempo real
    const interval = setInterval(() => {
      fetchAndUpdateStreak();
    }, 5 * 60 * 1000);
    
    // Escuchar evento de juego completado para actualizar inmediatamente
    const handleGameCompleted = (event: CustomEvent) => {
      console.log('[StreakTracker] Juego completado detectado, actualizando racha...', event.detail);
      // Esperar un poco para que la sesión se guarde en Firebase
      setTimeout(() => {
        fetchAndUpdateStreak();
      }, 1000);
    };
    
    window.addEventListener('gameCompleted', handleGameCompleted as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('gameCompleted', handleGameCompleted as EventListener);
    };
  }, [streakDataProp, user, effectiveUserId]);

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
          {streakData.hasStudiedToday ? streakData.consecutiveDays : 0} {streakData.hasStudiedToday ? (streakData.consecutiveDays === 1 ? 'día' : 'días') : 'días'} consecutivos
        </span>
      </div>
      
      {/* Mostrar bonus de puntos */}
      {streakData.consecutiveDays > 0 && streakData.hasStudiedToday && (
        <div className="streak-bonus">
          <span className="bonus-label">Bonus: </span>
          <span className="bonus-points">+{streakData.streakBonus.toLocaleString()}pts</span>
        </div>
      )}
      
      {/* Mostrar siempre el calendario, pero solo resaltar si la racha es 2 o más */}
      <div className="streak-calendar">
        {weekDays.map((day) => (
          <div
            key={day.key}
            className={`day-indicator${streakData.consecutiveDays >= 2 && streakData.days[day.key] ? ' active' : ''}`}
          >
            <span className="day-label">{day.label}</span>
          </div>
        ))}
      </div>
      
      {/* Mensaje motivacional */}
      {(streakData.consecutiveDays === 0 || !streakData.hasStudiedToday) && (
        <div className="streak-motivation">
          <p className="motivation-text">
            {(!streakData.hasStudiedToday || streakData.consecutiveDays === 0)
              ? "¡Venga! Estudia al menos 1 minuto para iniciar tu racha"
              : "¡Sigue así! Estudia al menos 1 minuto para mantener tu racha"}
          </p>
        </div>
      )}
    </div>
  );
};

export default StreakTracker;