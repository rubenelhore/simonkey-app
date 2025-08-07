import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp, 
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';

interface StudyStreakData {
  currentStreak: number;
  lastStudyDate: Date | null;
  studyHistory: Date[]; // Días que ha estudiado
  updatedAt: Date;
}

export class StudyStreakService {
  private static instance: StudyStreakService;

  private constructor() {}

  static getInstance(): StudyStreakService {
    if (!StudyStreakService.instance) {
      StudyStreakService.instance = new StudyStreakService();
    }
    return StudyStreakService.instance;
  }

  /**
   * Obtiene la fecha a medianoche (hora local)
   */
  private getMidnight(date: Date): Date {
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  }

  /**
   * Verifica si dos fechas son el mismo día
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    const day1 = this.getMidnight(date1);
    const day2 = this.getMidnight(date2);
    return day1.getTime() === day2.getTime();
  }

  /**
   * Verifica si dos fechas son días consecutivos
   */
  private isConsecutiveDay(date1: Date, date2: Date): boolean {
    const day1 = this.getMidnight(date1);
    const day2 = this.getMidnight(date2);
    const diffTime = day2.getTime() - day1.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays === 1;
  }

  /**
   * Obtiene la racha actual del usuario
   */
  async getUserStreak(userId: string): Promise<StudyStreakData> {
    try {
      const streakRef = doc(db, 'users', userId, 'stats', 'studyStreak');
      const streakDoc = await getDoc(streakRef);

      if (streakDoc.exists()) {
        const data = streakDoc.data();
        const lastStudyDate = data.lastStudyDate ? data.lastStudyDate.toDate() : null;
        let currentStreak = data.currentStreak || 0;
        
        // Verificar si la racha sigue siendo válida
        if (lastStudyDate && currentStreak > 0) {
          const today = new Date();
          const daysSinceLastStudy = Math.floor((today.getTime() - lastStudyDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Si han pasado más de 1 día sin estudiar, la racha se rompe
          if (daysSinceLastStudy > 1) {
            console.log('[StudyStreakService] Racha rota - días sin estudiar:', daysSinceLastStudy);
            currentStreak = 0;
            
            // Actualizar en Firebase para reflejar la racha rota
            await setDoc(streakRef, {
              ...data,
              currentStreak: 0,
              updatedAt: serverTimestamp()
            });
          }
        }
        
        return {
          currentStreak,
          lastStudyDate,
          studyHistory: data.studyHistory ? 
            data.studyHistory.map((t: Timestamp) => t.toDate()) : [],
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date()
        };
      }

      // Si no existe, devolver datos iniciales
      return {
        currentStreak: 0,
        lastStudyDate: null,
        studyHistory: [],
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('[StudyStreakService] Error obteniendo racha:', error);
      return {
        currentStreak: 0,
        lastStudyDate: null,
        studyHistory: [],
        updatedAt: new Date()
      };
    }
  }

  /**
   * Verifica si el usuario ha estudiado hoy (al menos 1 segundo en cualquier actividad)
   */
  async hasStudiedToday(userId: string): Promise<boolean> {
    try {
      const today = new Date();
      const startOfDay = this.getMidnight(today);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      console.log('[StudyStreakService] Verificando estudio para hoy:', {
        userId,
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString()
      });

      // Verificar sesiones de estudio
      const studySessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        where('startTime', '>=', Timestamp.fromDate(startOfDay)),
        where('startTime', '<', Timestamp.fromDate(endOfDay))
      );

      const studySessionsSnap = await getDocs(studySessionsQuery);
      console.log('[StudyStreakService] Sesiones de estudio encontradas:', studySessionsSnap.size);
      
      // Verificar si hay al menos una sesión con duración > 0
      for (const doc of studySessionsSnap.docs) {
        const session = doc.data();
        const duration = session.metrics?.sessionDuration || 0;
        if (duration > 0) {
          console.log('[StudyStreakService] ✅ Encontrada sesión de estudio con duración:', duration);
          return true;
        }
      }

      // Verificar quizzes
      const quizResultsQuery = query(
        collection(db, 'users', userId, 'quizResults'),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        where('timestamp', '<', Timestamp.fromDate(endOfDay))
      );

      const quizResultsSnap = await getDocs(quizResultsQuery);
      console.log('[StudyStreakService] Resultados de quiz encontrados:', quizResultsSnap.size);
      
      if (quizResultsSnap.size > 0) {
        console.log('[StudyStreakService] ✅ Encontrado quiz completado hoy');
        return true;
      }

      // Verificar mini quizzes
      const miniQuizResultsQuery = query(
        collection(db, 'users', userId, 'miniQuizResults'),
        where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
        where('timestamp', '<', Timestamp.fromDate(endOfDay))
      );

      const miniQuizResultsSnap = await getDocs(miniQuizResultsQuery);
      console.log('[StudyStreakService] Mini quiz encontrados:', miniQuizResultsSnap.size);
      
      if (miniQuizResultsSnap.size > 0) {
        console.log('[StudyStreakService] ✅ Encontrado mini quiz completado hoy');
        return true;
      }

      // Verificar sesiones de juego
      // Use a simpler query to avoid index requirement
      const gameSessionsQuery = query(
        collection(db, 'gameSessions'),
        where('userId', '==', userId)
      );

      const gameSessionsSnap = await getDocs(gameSessionsQuery);
      
      // Filter results manually to avoid needing composite index
      const todayGameSessions = gameSessionsSnap.docs.filter(doc => {
        const data = doc.data();
        if (!data.timestamp) return false;
        const sessionDate = data.timestamp.toDate();
        return sessionDate >= startOfDay && sessionDate < endOfDay;
      });
      console.log('[StudyStreakService] Sesiones de juego encontradas:', todayGameSessions.length);
      
      // Verificar si hay al menos una sesión de juego con duración > 0
      for (const doc of todayGameSessions) {
        const session = doc.data();
        console.log('[StudyStreakService] Datos de sesión de juego:', session);
        const duration = session.duration || 0;
        if (duration > 0 || session.completed) {
          console.log('[StudyStreakService] ✅ Encontrada sesión de juego válida con duración:', duration, 'completada:', session.completed);
          return true;
        }
      }

      console.log('[StudyStreakService] ❌ No se encontró actividad de estudio hoy');
      return false;
    } catch (error) {
      console.error('[StudyStreakService] Error verificando estudio de hoy:', error);
      return false;
    }
  }

  /**
   * Actualiza la racha del usuario si ha estudiado hoy
   */
  async updateStreakIfStudied(userId: string): Promise<number> {
    try {
      const hasStudied = await this.hasStudiedToday(userId);
      
      if (!hasStudied) {
        console.log('[StudyStreakService] Usuario no ha estudiado hoy, no se actualiza racha');
        const currentStreak = await this.getUserStreak(userId);
        return currentStreak.currentStreak;
      }

      console.log('[StudyStreakService] Usuario ha estudiado hoy, actualizando racha');
      
      const streakRef = doc(db, 'users', userId, 'stats', 'studyStreak');
      const currentStreak = await this.getUserStreak(userId);
      const today = new Date();
      
      // Si ya se actualizó hoy, no hacer nada
      if (currentStreak.lastStudyDate && this.isSameDay(currentStreak.lastStudyDate, today)) {
        console.log('[StudyStreakService] Racha ya actualizada hoy');
        return currentStreak.currentStreak;
      }

      let newStreak = 1;
      let studyHistory = currentStreak.studyHistory || [];

      // Si hay una última fecha de estudio
      if (currentStreak.lastStudyDate) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Si estudió ayer, continuar la racha
        if (this.isSameDay(currentStreak.lastStudyDate, yesterday)) {
          newStreak = currentStreak.currentStreak + 1;
          console.log('[StudyStreakService] Continuando racha:', newStreak);
        } else {
          // La racha se rompió, empezar nueva
          console.log('[StudyStreakService] Racha rota, empezando nueva');
          newStreak = 1;
        }
      }

      // Agregar hoy al historial
      studyHistory.push(today);

      // Mantener solo los últimos 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      studyHistory = studyHistory.filter(date => date > thirtyDaysAgo);

      // Actualizar en Firestore
      await setDoc(streakRef, {
        currentStreak: newStreak,
        lastStudyDate: serverTimestamp(),
        studyHistory: studyHistory.map(date => Timestamp.fromDate(date)),
        updatedAt: serverTimestamp()
      });

      console.log('[StudyStreakService] Racha actualizada a:', newStreak);
      return newStreak;
    } catch (error) {
      console.error('[StudyStreakService] Error actualizando racha:', error);
      return 0;
    }
  }

  /**
   * Obtiene el bonus de puntos por racha (200 pts por día)
   */
  getStreakBonus(streakDays: number): number {
    return streakDays * 200;
  }

  /**
   * Calcula qué días de la semana actual tienen estudio
   */
  async getWeekStudyDays(userId: string): Promise<{ [key: string]: boolean }> {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      // Ajustar al lunes de esta semana (día 1)
      const currentDay = today.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Si es domingo (0), son 6 días desde el lunes
      startOfWeek.setDate(today.getDate() - daysFromMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7); // Domingo

      console.log('[StudyStreakService] Obteniendo días de estudio de la semana:', {
        startOfWeek: startOfWeek.toISOString(),
        endOfWeek: endOfWeek.toISOString(),
        userId: userId
      });

      // Mapeo de días (getDay() devuelve 0=domingo, 1=lunes, etc.)
      const dayMapping: { [key: number]: string } = {
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday',
        0: 'sunday'
      };
      
      console.log('[StudyStreakService] Hoy es:', today.toLocaleDateString('es-ES', { weekday: 'long' }), 'getDay():', today.getDay());

      const weekDays: { [key: string]: boolean } = {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      };

      // 1. Obtener sesiones de estudio de la semana
      const studySessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        where('startTime', '>=', startOfWeek),
        where('startTime', '<', endOfWeek)
      );

      const studySessionsSnap = await getDocs(studySessionsQuery);
      console.log('[StudyStreakService] Sesiones de estudio encontradas:', studySessionsSnap.size);
      
      // Marcar días con sesiones de estudio
      studySessionsSnap.forEach(doc => {
        const session = doc.data();
        const duration = session.metrics?.sessionDuration || 0;
        if (duration > 0 && session.startTime) {
          const date = session.startTime.toDate();
          const dayOfWeek = date.getDay();
          const dayKey = dayMapping[dayOfWeek];
          if (dayKey) {
            weekDays[dayKey] = true;
            console.log('[StudyStreakService] Marcando día con estudio:', {
              dayKey,
              fecha: date.toLocaleDateString('es-ES'),
              hora: date.toLocaleTimeString('es-ES'),
              dayOfWeek,
              sessionId: doc.id,
              duration
            });
          }
        }
      });

      // 2. Obtener quizzes de la semana
      const quizResultsQuery = query(
        collection(db, 'users', userId, 'quizResults'),
        where('timestamp', '>=', startOfWeek),
        where('timestamp', '<', endOfWeek)
      );

      const quizResultsSnap = await getDocs(quizResultsQuery);
      console.log('[StudyStreakService] Quizzes encontrados:', quizResultsSnap.size);
      
      // Marcar días con quizzes
      quizResultsSnap.forEach(doc => {
        const quiz = doc.data();
        if (quiz.timestamp) {
          const date = quiz.timestamp.toDate();
          const dayOfWeek = date.getDay();
          const dayKey = dayMapping[dayOfWeek];
          if (dayKey) {
            weekDays[dayKey] = true;
            console.log('[StudyStreakService] Marcando día con quiz:', {
              dayKey,
              fecha: date.toLocaleDateString('es-ES'),
              hora: date.toLocaleTimeString('es-ES'),
              dayOfWeek,
              quizId: doc.id,
              score: quiz.score
            });
          }
        }
      });

      // 3. Obtener mini quizzes de la semana
      const miniQuizResultsQuery = query(
        collection(db, 'users', userId, 'miniQuizResults'),
        where('timestamp', '>=', startOfWeek),
        where('timestamp', '<', endOfWeek)
      );

      const miniQuizResultsSnap = await getDocs(miniQuizResultsQuery);
      
      // Marcar días con mini quizzes
      miniQuizResultsSnap.forEach(doc => {
        const quiz = doc.data();
        if (quiz.timestamp) {
          const date = quiz.timestamp.toDate();
          const dayOfWeek = date.getDay();
          const dayKey = dayMapping[dayOfWeek];
          if (dayKey) {
            weekDays[dayKey] = true;
          }
        }
      });

      // 4. Obtener sesiones de juego de la semana
      // Use a simpler query to avoid index requirement
      const gameSessionsQuery = query(
        collection(db, 'gameSessions'),
        where('userId', '==', userId)
      );

      const gameSessionsSnap = await getDocs(gameSessionsQuery);
      
      // Filter results manually to avoid needing composite index
      const weekGameSessions = gameSessionsSnap.docs.filter(doc => {
        const data = doc.data();
        if (!data.timestamp) return false;
        const sessionDate = data.timestamp.toDate();
        return sessionDate >= startOfWeek && sessionDate < endOfWeek;
      });
      console.log('[StudyStreakService] Sesiones de juego encontradas:', weekGameSessions.length);

      // Marcar días con sesiones de juego
      weekGameSessions.forEach(doc => {
        const session = doc.data();
        const duration = session.duration || 0;
        if (duration > 0 && session.timestamp) {
          const date = session.timestamp.toDate();
          const dayOfWeek = date.getDay();
          const dayKey = dayMapping[dayOfWeek];
          if (dayKey) {
            weekDays[dayKey] = true;
            console.log('[StudyStreakService] Marcando día con juego:', {
              dayKey,
              fecha: date.toLocaleDateString('es-ES'),
              hora: date.toLocaleTimeString('es-ES'),
              dayOfWeek,
              gameId: doc.id,
              gameType: session.gameType,
              duration
            });
          }
        }
      });

      console.log('[StudyStreakService] Días con estudio en la semana:', weekDays);
      return weekDays;
    } catch (error) {
      console.error('[StudyStreakService] Error obteniendo días de estudio:', error);
      return {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      };
    }
  }
}

// Exportar instancia única
export const studyStreakService = StudyStreakService.getInstance();