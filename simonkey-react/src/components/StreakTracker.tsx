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
  streakDays?: string[]; // Días que forman parte de la racha actual
  visitHistory?: Date[]; // Historial de visitas recientes
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
    consecutiveDays: 0,
    streakDays: [],
    visitHistory: []
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

  // Función para calcular la racha basada en el historial de visitas
  const calculateStreakFromHistory = (visitHistory: Date[]): number => {
    if (!visitHistory || visitHistory.length === 0) return 1;
    
    // Ordenar las fechas de más reciente a más antigua
    const sortedDates = [...visitHistory].sort((a, b) => b.getTime() - a.getTime());
    
    // Eliminar duplicados (mismo día)
    const uniqueDates: Date[] = [];
    for (const date of sortedDates) {
      if (!uniqueDates.some(d => isSameDay(d, date))) {
        uniqueDates.push(date);
      }
    }
    
    if (uniqueDates.length === 0) return 1;
    
    console.log('🔍 Fechas únicas en el historial:', uniqueDates.map(d => 
      d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    ));
    
    // Verificar si hay una visita hoy o ayer
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const mostRecent = uniqueDates[0];
    
    // Si la última visita no es ni hoy ni ayer, la racha se rompió
    if (!isSameDay(mostRecent, today) && !isSameDay(mostRecent, yesterday)) {
      console.log('🔴 Racha rota - última visita fue:', mostRecent.toLocaleDateString('es-ES'));
      return 1;
    }
    
    // Si la última visita fue ayer, empezamos desde ayer
    let startDate = isSameDay(mostRecent, yesterday) ? yesterday : today;
    let startIndex = isSameDay(mostRecent, yesterday) ? 0 : 0;
    
    console.log('📍 Comenzando cálculo desde:', startDate.toLocaleDateString('es-ES'));
    
    // Contar días consecutivos
    let streak = 1;
    let expectedDate = new Date(startDate);
    
    for (let i = startIndex; i < uniqueDates.length; i++) {
      const currentDate = uniqueDates[i];
      
      if (isSameDay(currentDate, expectedDate)) {
        // Este día es parte de la racha
        if (i > startIndex) streak++;
        
        // El próximo día esperado es el día anterior
        expectedDate = new Date(expectedDate);
        expectedDate.setDate(expectedDate.getDate() - 1);
        
        console.log(`✅ Día ${i + 1}: ${currentDate.toLocaleDateString('es-ES')} - Racha: ${streak}`);
      } else if (currentDate < expectedDate) {
        // Hemos saltado días, la racha termina aquí
        console.log(`❌ Racha interrumpida. Esperaba ${expectedDate.toLocaleDateString('es-ES')}, encontré ${currentDate.toLocaleDateString('es-ES')}`);
        break;
      }
    }
    
    // Si la última visita fue ayer y hoy estamos agregando una nueva, incrementar la racha
    if (isSameDay(mostRecent, yesterday)) {
      streak++;
      console.log('📈 Incrementando racha porque hoy es un nuevo día');
    }
    
    console.log('✅ Racha final calculada:', streak);
    return streak;
  };

  // Función para calcular qué días de la semana forman parte de la racha actual
  const calculateStreakDays = (consecutiveDays: number, today: Date): string[] => {
    const streakDays: string[] = [];
    const todayMidnight = getMidnight(today);
    
    // Agregar los días de la racha actual (desde hoy hacia atrás)
    for (let i = 0; i < consecutiveDays && i < 7; i++) { // Máximo 7 días (una semana)
      const checkDate = new Date(todayMidnight);
      checkDate.setDate(checkDate.getDate() - i);
      
      const dayName = checkDate.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      const dayKey = dayMapping[dayName];
      
      if (dayKey) {
        streakDays.push(dayKey);
      }
    }
    
    return streakDays;
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
      
      console.log('🚀 StreakTracker - Fecha actual:', today.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }));
      
      const dayInSpanish = today.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
      const dayOfWeek = dayMapping[dayInSpanish] || 'monday';
      
      let currentData: StreakData;
      
      if (streakDoc.exists()) {
        const data = streakDoc.data();
        const lastVisitTimestamp = data?.lastVisit as Timestamp | undefined;
        const lastVisit = lastVisitTimestamp ? lastVisitTimestamp.toDate() : null;
        
        // Leer el historial de visitas
        let visitHistory: Date[] = [];
        if (data?.visitHistory && Array.isArray(data.visitHistory)) {
          visitHistory = data.visitHistory.map((timestamp: any) => {
            if (timestamp instanceof Timestamp) {
              return timestamp.toDate();
            }
            return new Date(timestamp);
          });
        }
        
        console.log('📅 Historial de visitas recuperado:', visitHistory.map(date => 
          date.toLocaleDateString('es-ES', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        ));
        
        // Limpiar visitas antiguas (mantener solo últimos 30 días)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        visitHistory = visitHistory.filter(date => date > thirtyDaysAgo);
        
        // Leer days o inicializar si no existe
        let days = data?.days || {
          monday: false, tuesday: false, wednesday: false, thursday: false,
          friday: false, saturday: false, sunday: false
        };

        // --- Lógica de Reseteo Semanal Visual ---
        // Siempre empezar con todos los días en false para la semana actual
        days = {
          monday: false, tuesday: false, wednesday: false, thursday: false,
          friday: false, saturday: false, sunday: false
        };
        
        console.log('🔄 Reseteando visualización semanal');

        // --- Lógica de Racha Consecutiva ---
        // Agregar hoy al historial si no es el mismo día
        if (!lastVisit || !isSameDay(lastVisit, today)) {
          console.log('✅ Agregando visita de hoy al historial');
          visitHistory.push(today);
        } else {
          console.log('⚠️ Ya hay una visita registrada para hoy, no se duplica');
        }
        
        console.log('📊 ANTES de calcular racha - Historial ordenado:', 
          [...visitHistory].sort((a, b) => b.getTime() - a.getTime()).map(d => 
            d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
          )
        );
        
        // Calcular la racha basada en el historial
        const updatedConsecutiveDays = calculateStreakFromHistory(visitHistory);
        
        console.log('📊 Racha calculada:', {
          visitHistory: visitHistory.map(d => d.toLocaleDateString()),
          consecutiveDays: updatedConsecutiveDays,
          today: today.toLocaleDateString()
        });
        
        // Marcar solo los días de esta semana que están en el historial de visitas
        const currentWeek = getWeekNumber(today);
        const currentYear = today.getFullYear();
        
        console.log('📅 Marcando días visitados de la semana actual');
        
        // Revisar el historial y marcar solo los días visitados de esta semana
        for (const visitDate of visitHistory) {
          const visitWeek = getWeekNumber(visitDate);
          const visitYear = visitDate.getFullYear();
          
          // Solo marcar si la visita fue en la semana actual
          if (visitWeek === currentWeek && visitYear === currentYear) {
            const dayName = visitDate.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
            const dayKey = dayMapping[dayName];
            if (dayKey) {
              days[dayKey] = true;
              console.log(`✅ Marcando ${dayKey} como visitado (${visitDate.toLocaleDateString('es-ES')})`);
            }
          }
        }

        // Calcular qué días forman parte de la racha actual
        const streakDays = calculateStreakDays(updatedConsecutiveDays, today);

        currentData = {
          days: days,
          lastVisit: today,
          consecutiveDays: updatedConsecutiveDays,
          streakDays: streakDays,
          visitHistory: visitHistory
        };

      } else {
        // Primera vez que el usuario visita / no existe documento
        const streakDays = calculateStreakDays(1, today); // Racha de 1 día
        currentData = {
          days: {
            monday: false, tuesday: false, wednesday: false, thursday: false,
            friday: false, saturday: false, sunday: false
          },
          lastVisit: today,
          consecutiveDays: 1,
          streakDays: streakDays,
          visitHistory: [today]
        };
        currentData.days[dayOfWeek] = true;
      }

      // Guardar en Firestore
      const dataToSave = {
        days: currentData.days,
        lastVisit: serverTimestamp(),
        consecutiveDays: currentData.consecutiveDays,
        visitHistory: currentData.visitHistory?.map(date => Timestamp.fromDate(date)) || []
      };
      
      await setDoc(streakRef, dataToSave);

      // Actualizar estado local
      setStreakData({
        days: currentData.days,
        lastVisit: today,
        consecutiveDays: currentData.consecutiveDays,
        streakDays: currentData.streakDays,
        visitHistory: currentData.visitHistory
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
            {/* Mostrar fuego solo si el día es parte de la racha actual */}
            {streakData.days[day.key] && streakData.streakDays?.includes(day.key) && (
              <span className="day-fire">🔥</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StreakTracker;