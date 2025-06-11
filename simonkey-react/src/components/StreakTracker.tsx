import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

interface StreakData {
  days: {
    [key: string]: boolean; // 'monday', 'tuesday', etc.
  };
  lastVisit: Date | null;
  consecutiveDays: number;
}

const StreakTracker: React.FC = () => {
  const [user] = useAuthState(auth);
  const [streakData, setStreakData] = useState<StreakData>({
    days: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false
    },
    lastVisit: null,
    consecutiveDays: 0
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

  // Función auxiliar para obtener el número de semana ISO (Lunes como primer día)
  const getWeekNumber = (date: Date): number => {
    const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Establecer el jueves más cercano; setUTCDate ajusta mes/año si es necesario
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
    // Inicio del año
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    // Calcular número de semana
    const weekNo = Math.ceil((( (tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  };

  // --- Helper to get UTC midnight for a date ---
  const getUTCMidnight = (date: Date): Date => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  };

  // --- Updated isNextDay using UTC midnight ---
  const isNextDay = (date1: Date, date2: Date): boolean => {
    const day1UTC = getUTCMidnight(date1);
    const day2UTC = getUTCMidnight(date2);
    const diffTime = day2UTC.getTime() - day1UTC.getTime();
    // Check if difference is exactly one day (86400000 milliseconds)
    return diffTime === 86400000;
  };

  const fetchAndUpdateStreak = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Obtener la racha del usuario
      const streakRef = doc(db, 'users', user.uid, 'stats', 'streak');
      const streakDoc = await getDoc(streakRef);
      
      const today = new Date();
      const todayUTC = getUTCMidnight(today); // Use UTC midnight for comparisons
      
      const dayMapping: { [key: string]: string } = {
        'lunes': 'monday',
        'martes': 'tuesday',
        'miércoles': 'wednesday',
        'jueves': 'thursday',
        'viernes': 'friday',
        'sábado': 'saturday',
        'domingo': 'sunday'
      };
      
      const dayInSpanish = today.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      const dayOfWeek = dayMapping[dayInSpanish] || 'monday';
      
      let currentData: StreakData;
      let shouldResetWeek = false;
      
      if (streakDoc.exists()) {
        const data = streakDoc.data();
        const lastVisitTimestamp = data?.lastVisit as Timestamp | undefined;
        const lastVisit = lastVisitTimestamp ? lastVisitTimestamp.toDate() : null;
        // Leer consecutiveDays, si no existe usar currentStreak (compatibilidad) o 0
        const consecutiveDays = data?.consecutiveDays ?? data?.currentStreak ?? 0;
        // Leer days o inicializar si no existe
        let days = data?.days || {
             monday: false, tuesday: false, wednesday: false, thursday: false,
             friday: false, saturday: false, sunday: false
           };
        console.log("[StreakTracker] Initial 'days' loaded from Firestore:", JSON.stringify(days)); // Log initial state
        console.log("[StreakTracker] Last Visit:", lastVisit?.toISOString(), "Today:", today.toISOString());

        // --- Lógica de Reseteo Semanal ---
        if (lastVisit) {
          const lastVisitUTC = getUTCMidnight(lastVisit); // Use UTC midnight for comparison checks
          const currentWeek = getWeekNumber(today); // getWeekNumber uses UTC internally
          const lastVisitWeek = getWeekNumber(lastVisit); // Pass original Date object
          const currentYear = todayUTC.getUTCFullYear(); // Compare UTC years
          const lastVisitYear = lastVisitUTC.getUTCFullYear(); // Compare UTC years

          // Resetear si es una semana o año diferente
          if (currentWeek !== lastVisitWeek || currentYear !== lastVisitYear) {
            console.log(`[StreakTracker] Resetting week visual. Current: W${currentWeek}/${currentYear}, Last: W${lastVisitWeek}/${lastVisitYear}`);
            shouldResetWeek = true;
            days = { // Reset days object
              monday: false, tuesday: false, wednesday: false, thursday: false,
              friday: false, saturday: false, sunday: false
            };
            console.log("[StreakTracker] --> 'days' object RESET.");
          } else {
             console.log(`[StreakTracker] Keeping same week visual. Current: W${currentWeek}/${currentYear}, Last: W${lastVisitWeek}/${lastVisitYear}`);
             console.log("[StreakTracker] --> 'days' object kept from Firestore.");
          }
        } else {
           // Si no hay lastVisit (muy raro si streakDoc existe), considera resetear
           shouldResetWeek = true;
             days = { // Reset days object
              monday: false, tuesday: false, wednesday: false, thursday: false,
              friday: false, saturday: false, sunday: false
            };
           console.log("[StreakTracker] No lastVisit found in existing doc, resetting 'days' object.");
        }

        // --- Lógica de Racha Consecutiva ---
        let updatedConsecutiveDays = consecutiveDays;
        if (lastVisit) {
          const lastVisitUTC = getUTCMidnight(lastVisit);
          // Compare UTC dates directly for same day check
          if (todayUTC.getTime() === lastVisitUTC.getTime()) {
            // Mismo día, no hacer nada con la racha consecutiva
            console.log("Mismo día (UTC), manteniendo racha consecutiva:", updatedConsecutiveDays);
          } else if (isNextDay(lastVisit, today)) { // isNextDay now uses UTC internally
            // Día siguiente, incrementar racha
            updatedConsecutiveDays += 1;
            console.log("Día consecutivo (UTC), incrementando racha a:", updatedConsecutiveDays);
          } else {
            // Días no consecutivos, reiniciar racha a 1 (por el día actual)
            updatedConsecutiveDays = 1;
            console.log("Día no consecutivo (UTC), reiniciando racha a 1");
          }
        } else {
           // Si no había lastVisit pero el documento existía, iniciar racha en 1
           updatedConsecutiveDays = 1;
           console.log("Documento existía sin lastVisit, iniciando racha consecutiva a 1");
        }


        // --- Preparar Datos Finales ---
        // Marcar el día actual como activo en la visualización semanal
        console.log("[StreakTracker] 'days' object BEFORE marking today:", JSON.stringify(days));
        days[dayOfWeek] = true;
        console.log(`[StreakTracker] Marked '${dayOfWeek}' as true. Final 'days' object for update:`, JSON.stringify(days));

        currentData = {
          days: days,
          lastVisit: today, // Se actualiza siempre al ejecutar esto
          consecutiveDays: updatedConsecutiveDays
        };

      } else {
        // Primera vez que el usuario visita / no existe documento
        console.log("[StreakTracker] First access or document not found, initializing.");
        currentData = {
          days: { // Inicializar días
            monday: false, tuesday: false, wednesday: false, thursday: false,
            friday: false, saturday: false, sunday: false
          },
          lastVisit: today,
          consecutiveDays: 1 // Primer día
        };
        // Marcar el día actual
        console.log(`[StreakTracker] Initializing 'days'. Marking day: ${dayOfWeek}`);
        currentData.days[dayOfWeek] = true;
        console.log("[StreakTracker] Initial 'days' object created:", JSON.stringify(currentData.days));
      }

      // --- Guardar en Firestore ---
      // No guardar currentStreak, solo consecutiveDays y days
      const dataToSave = {
        days: currentData.days,
        lastVisit: serverTimestamp(), // Usar serverTimestamp para la escritura
        consecutiveDays: currentData.consecutiveDays
      };
      console.log("[StreakTracker] Saving to Firestore:", JSON.stringify(dataToSave).replace('"__type__":"serverTimestamp"', 'serverTimestamp()')); // Approximate log
      await setDoc(streakRef, dataToSave);
      console.log("[StreakTracker] Firestore save complete.");

      // Actualizar estado local (usar 'today' para lastVisit que es un objeto Date)
      const stateToSet = {
          days: currentData.days,
          lastVisit: today, // Usamos el objeto Date local original para el estado
          consecutiveDays: currentData.consecutiveDays
      };
      console.log("[StreakTracker] Updating local state with:", JSON.stringify(stateToSet));
      setStreakData(stateToSet);

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