// src/components/Dashboard/StudyStreak.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

// First, define an interface for your streak data
interface StreakData {
  days: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
    [key: string]: boolean;  // For index access with dayOfWeek
  };
  currentStreak: number;
  lastVisit: Date | null;  // Allow both Date and null
  weeklyGoal: number;
}

// Define a type for days of the week
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Create the array with the specific type
const weekDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const StudyStreak = () => {
  const [streak, setStreak] = useState<StreakData>({
    days: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false
    },
    currentStreak: 0,
    lastVisit: null,
    weeklyGoal: 5
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreak = async () => {
      if (!auth.currentUser) return;

      try {
        setLoading(true);
        
        // Obtener la racha del usuario
        const streakRef = doc(db, 'users', auth.currentUser.uid, 'stats', 'streak');
        const streakDoc = await getDoc(streakRef);
        
        const today = new Date();
        
        // Mapeo de día en español a la clave en inglés
        const dayMapping = {
          'lunes': 'monday',
          'martes': 'tuesday',
          'miércoles': 'wednesday',
          'jueves': 'thursday',
          'viernes': 'friday',
          'sábado': 'saturday',
          'domingo': 'sunday'
        };
        
        const dayInSpanish = today.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        const dayOfWeek = dayMapping[dayInSpanish as keyof typeof dayMapping];
        
        let streakData: StreakData = {
          days: {
            monday: false,
            tuesday: false,
            wednesday: false,
            thursday: false,
            friday: false,
            saturday: false,
            sunday: false
          },
          currentStreak: 0,
          lastVisit: null,
          weeklyGoal: 5
        };
        
        if (streakDoc.exists()) {
          const data = streakDoc.data();
          streakData = {
            days: data.days || streakData.days,
            currentStreak: data.currentStreak || 0,
            lastVisit: data.lastVisit ? new Date(data.lastVisit.toDate()) : null,
            weeklyGoal: data.weeklyGoal || 5
          };
          
          // Marcar el día de hoy
          streakData.days[dayOfWeek] = true;
          
          // Actualizar la fecha de la última visita
          streakData.lastVisit = today;
          
          // Actualizar streakRef
          await updateDoc(streakRef, {
            days: streakData.days,
            currentStreak: streakData.currentStreak,
            lastVisit: serverTimestamp(),
            weeklyGoal: streakData.weeklyGoal
          });
        } else {
          // Si no existe, crear uno nuevo
          streakData.days[dayOfWeek] = true;
          streakData.lastVisit = today;
          streakData.currentStreak = 1;
          
          // Crear el documento de racha
          await updateDoc(streakRef, {
            days: streakData.days,
            currentStreak: streakData.currentStreak,
            lastVisit: serverTimestamp(),
            weeklyGoal: streakData.weeklyGoal
          });
        }
        
        setStreak(streakData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching streak:", error);
        setLoading(false);
      }
    };

    fetchStreak();
  }, []);

  // Calcular días activos esta semana
  const calculateActiveDays = () => {
    return Object.values(streak.days).filter(Boolean).length;
  };

  // Calcular porcentaje completado del objetivo semanal
  const calculateGoalPercentage = () => {
    const activeDays = calculateActiveDays();
    return Math.min(Math.round((activeDays / streak.weeklyGoal) * 100), 100);
  };

  if (loading) {
    return (
      <div className="streak-card loading">
        <div className="card-loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="streak-card">
      <div className="streak-header">
        <div className="streak-title">
          <i className="fas fa-fire"></i>
          <h3>Tu racha de estudio</h3>
        </div>
        <div className="streak-count">
          <span>{streak.currentStreak}</span> días
        </div>
      </div>
      
      <div className="streak-calendar">
        {weekDays.map((day: DayOfWeek) => (
          <div key={day} className={`day-circle ${streak.days[day] ? 'completed' : ''}`}>
            {day.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      
      <div className="weekly-goal">
        <div className="goal-text">
          <span>Objetivo semanal: {calculateActiveDays()}/{streak.weeklyGoal} días</span>
          <span className="goal-percentage">{calculateGoalPercentage()}%</span>
        </div>
        <div className="goal-progress-bar">
          <div 
            className="goal-progress-fill" 
            style={{ width: `${calculateGoalPercentage()}%` }}
          ></div>
        </div>
      </div>
      
      <div className="streak-motivation">
        {calculateActiveDays() >= streak.weeklyGoal ? (
          <p>¡Objetivo semanal completado! 🎉</p>
        ) : (
          <p>
            {streak.weeklyGoal - calculateActiveDays() === 1
              ? '¡Te falta 1 día para completar tu objetivo!'
              : `¡Te faltan ${streak.weeklyGoal - calculateActiveDays()} días para completar tu objetivo!`}
          </p>
        )}
      </div>
    </div>
  );
};

export default StudyStreak;