import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Timestamp | null;
  totalStudyDays: number;
}

const StreakTracker: React.FC = () => {
  const { user } = useAuth();
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    totalStudyDays: 0
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

  // Mapeo de días de la semana
  const dayMapping: { [key: string]: string } = {
    'lunes': 'monday',
    'martes': 'tuesday',
    'miércoles': 'wednesday',
    'jueves': 'thursday',
    'viernes': 'friday',
    'sábado': 'saturday',
    'domingo': 'sunday'
  };

  // Función auxiliar para obtener el número de semana ISO (Lunes como primer día)
  const getWeekNumber = (date: Date): number => {
    const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((( (tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  };

  // Función simplificada para obtener la fecha a medianoche (hora local)
  const getMidnight = (date: Date): Date => {
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  };

  // Función simplificada para verificar si dos fechas son días consecutivos
  const isConsecutiveDay = (date1: Date, date2: Date): boolean => {
    const day1 = getMidnight(date1);
    const day2 = getMidnight(date2);
    const diffTime = day2.getTime() - day1.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays === 1;
  };

  // Función para verificar si dos fechas son el mismo día
  const isSameDay = (date1: Date, date2: Date): boolean => {
    const day1 = getMidnight(date1);
    const day2 = getMidnight(date2);
    return day1.getTime() === day2.getTime();
  };

  // Función para calcular la racha real basada en días activos
  const calculateRealStreak = (days: { [key: string]: boolean }, today: Date): number => {
    const todayMidnight = getMidnight(today);
    let streak = 0;
    
    // Verificar hacia atrás desde hoy
    for (let i = 0; i < 30; i++) { // Revisar hasta 30 días atrás
      const checkDate = new Date(todayMidnight);
      checkDate.setDate(checkDate.getDate() - i);
      
      const dayName = checkDate.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      const dayKey = dayMapping[dayName];
      
      if (days[dayKey]) {
        streak++;
      } else {
        break; // Si encontramos un día inactivo, paramos
      }
    }
    
    return streak;
  };

  const fetchAndUpdateStreak = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Obtener la racha del usuario
      const streakRef = doc(db, 'users', user.uid, 'stats', 'streak');
      const streakDoc = await getDoc(streakRef);
      
      const today = new Date();
      const todayMidnight = getMidnight(today);
      
      const dayInSpanish = today.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      const dayOfWeek = dayMapping[dayInSpanish] || 'monday';
      
      let currentData: StreakData;
      
      if (streakDoc.exists()) {
        const data = streakDoc.data();
        const lastVisitTimestamp = data?.lastVisit as Timestamp | undefined;
        const lastVisit = lastVisitTimestamp ? lastVisitTimestamp.toDate() : null;
        const consecutiveDays = data?.consecutiveDays ?? data?.currentStreak ?? 0;
        
        // Leer days o inicializar si no existe
        let days = data?.days || {
          monday: false, tuesday: false, wednesday: false, thursday: false,
          friday: false, saturday: false, sunday: false
        };

        // --- Lógica de Reseteo Semanal Visual ---
        if (lastVisit) {
          const currentWeek = getWeekNumber(today);
          const lastVisitWeek = getWeekNumber(lastVisit);
          const currentYear = today.getFullYear();
          const lastVisitYear = lastVisit.getFullYear();

          // Resetear visualización semanal si es una semana o año diferente
          if (currentWeek !== lastVisitWeek || currentYear !== lastVisitYear) {
            days = {
              monday: false, tuesday: false, wednesday: false, thursday: false,
              friday: false, saturday: false, sunday: false
            };
          }
        }

        // --- Lógica de Racha Consecutiva ---
        let updatedConsecutiveDays = consecutiveDays;
        
        if (lastVisit) {
          if (isSameDay(lastVisit, today)) {
            // Mismo día, mantener la racha actual
          } else if (isConsecutiveDay(lastVisit, today)) {
            // Día consecutivo, incrementar racha
            updatedConsecutiveDays += 1;
          } else {
            // Días no consecutivos, reiniciar racha a 1
            updatedConsecutiveDays = 1;
          }
        } else {
          // Primera visita, iniciar racha en 1
          updatedConsecutiveDays = 1;
        }

        // Verificación adicional: si no hay días activos en la semana actual excepto hoy,
        // y la racha es mayor a 1, probablemente hay un error
        const activeDaysThisWeek = Object.values(days).filter(Boolean).length;
        if (activeDaysThisWeek === 1 && updatedConsecutiveDays > 1) {
          updatedConsecutiveDays = 1;
        }

        // Marcar el día actual como activo en la visualización semanal
        days[dayOfWeek] = true;

        // Calcular la racha real basada en el historial
        const realStreak = calculateRealStreak(days, today);
        
        // Usar la racha real si es diferente de la calculada
        if (realStreak !== updatedConsecutiveDays) {
          updatedConsecutiveDays = realStreak;
        }

        currentData = {
          days: days,
          lastVisit: today,
          consecutiveDays: updatedConsecutiveDays
        };

      } else {
        // Primera vez que el usuario visita / no existe documento
        currentData = {
          days: {
            monday: false, tuesday: false, wednesday: false, thursday: false,
            friday: false, saturday: false, sunday: false
          },
          lastVisit: today,
          consecutiveDays: 1
        };
        currentData.days[dayOfWeek] = true;
      }

      // Guardar en Firestore
      const dataToSave = {
        days: currentData.days,
        lastVisit: serverTimestamp(),
        consecutiveDays: currentData.consecutiveDays
      };
      
      await setDoc(streakRef, dataToSave);

      // Actualizar estado local
      setStreakData({
        days: currentData.days,
        lastVisit: today,
        consecutiveDays: currentData.consecutiveDays
      });

    } catch (error) {
      console.error("Error al actualizar la racha:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndUpdateStreak();
  }, [user]);

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
      <div className="streak-calendar">
        {weekDays.map((day) => (
          <div
            key={day.key}
            className={`day-indicator ${streakData.days[day.key] ? 'active' : ''}`}
          >
            <span className="day-label">{day.label}</span>
            {streakData.days[day.key] && (
              <span className="day-fire">🔥</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StreakTracker;