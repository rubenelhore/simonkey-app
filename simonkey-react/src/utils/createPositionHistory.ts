import { db } from '../services/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  doc,
  setDoc,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';

interface PositionHistoryEntry {
  userId: string;
  institutionId: string;
  subjectId: string;
  position: number;
  totalStudents: number;
  score: number;
  weekStart: Timestamp;
  weekEnd: Timestamp;
  createdAt: Timestamp;
}

export const saveCurrentPositionToHistory = async (
  userId: string, 
  institutionId: string, 
  subjectId: string,
  position: number,
  totalStudents: number,
  score: number
) => {
  try {
    console.log('[SavePositionHistory] Guardando posición actual en historial');
    
    // Calcular el inicio de la semana actual
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
    
    // Crear el documento de historial
    const historyEntry: PositionHistoryEntry = {
      userId,
      institutionId,
      subjectId,
      position,
      totalStudents,
      score,
      weekStart: Timestamp.fromDate(currentWeekStart),
      weekEnd: Timestamp.fromDate(currentWeekEnd),
      createdAt: Timestamp.now()
    };
    
    // Usar ID único basado en usuario, materia y semana
    const historyId = `${userId}_${subjectId}_${currentWeekStart.getTime()}`;
    
    // Guardar en la colección positionHistory
    await setDoc(doc(db, 'positionHistory', historyId), historyEntry);
    
    console.log('[SavePositionHistory] ✅ Posición guardada exitosamente');
    console.log('[SavePositionHistory] Detalles:', {
      userId,
      subjectId,
      position,
      semana: currentWeekStart.toLocaleDateString()
    });
    
    return true;
  } catch (error) {
    console.error('[SavePositionHistory] Error:', error);
    throw error;
  }
};

export const getPositionHistory = async (
  userId: string,
  subjectId: string,
  weeksCount: number = 8
) => {
  try {
    console.log('[GetPositionHistory] Obteniendo historial de posiciones');
    console.log('[GetPositionHistory] Usuario:', userId);
    console.log('[GetPositionHistory] Materia:', subjectId);
    
    // Calcular fecha límite (hace X semanas)
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - (weeksCount * 7));
    
    // Buscar historial del usuario para la materia
    const historyQuery = query(
      collection(db, 'positionHistory'),
      where('userId', '==', userId),
      where('subjectId', '==', subjectId),
      where('weekStart', '>=', Timestamp.fromDate(limitDate)),
      orderBy('weekStart', 'desc'),
      limit(weeksCount)
    );
    
    const historySnap = await getDocs(historyQuery);
    
    const history: Array<{
      semana: string;
      posicion: number;
      score: number;
      date: Date;
    }> = [];
    
    historySnap.forEach(doc => {
      const data = doc.data() as PositionHistoryEntry;
      const weekStart = data.weekStart.toDate();
      
      // Formatear fecha como DD/MM
      const day = weekStart.getDate().toString().padStart(2, '0');
      const month = (weekStart.getMonth() + 1).toString().padStart(2, '0');
      
      history.push({
        semana: `${day}/${month}`,
        posicion: data.position,
        score: data.score,
        date: weekStart
      });
    });
    
    // Ordenar por fecha ascendente (más antigua primero)
    history.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    console.log('[GetPositionHistory] Historial encontrado:', history.length, 'entradas');
    
    // Si no hay suficiente historial, completar con la posición actual
    if (history.length < weeksCount && history.length > 0) {
      const lastPosition = history[history.length - 1].posicion;
      const currentWeekStart = new Date();
      currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
      
      for (let i = history.length; i < weeksCount; i++) {
        const weekDate = new Date(currentWeekStart);
        weekDate.setDate(weekDate.getDate() - ((weeksCount - i - 1) * 7));
        
        const day = weekDate.getDate().toString().padStart(2, '0');
        const month = (weekDate.getMonth() + 1).toString().padStart(2, '0');
        
        history.unshift({
          semana: `${day}/${month}`,
          posicion: lastPosition,
          score: 0,
          date: weekDate
        });
      }
    }
    
    return history;
    
  } catch (error) {
    console.error('[GetPositionHistory] Error:', error);
    return [];
  }
};

// Función para inicializar el historial con datos simulados (solo para pruebas)
export const initializePositionHistory = async (
  userId: string,
  institutionId: string,
  subjectId: string,
  currentPosition: number
) => {
  try {
    console.log('[InitializePositionHistory] Inicializando historial de posiciones');
    
    const today = new Date();
    
    // Crear entradas para las últimas 8 semanas
    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      // Simular variación realista en las posiciones
      let position = currentPosition;
      if (i > 0) {
        const variation = Math.floor(Math.random() * 3) - 1; // -1, 0, o 1
        position = Math.max(1, currentPosition + variation * Math.ceil(i / 2));
      }
      
      const historyEntry: PositionHistoryEntry = {
        userId,
        institutionId,
        subjectId,
        position,
        totalStudents: 30, // Valor de ejemplo
        score: Math.max(0, 5000 - (position * 100) + Math.floor(Math.random() * 200)),
        weekStart: Timestamp.fromDate(weekStart),
        weekEnd: Timestamp.fromDate(weekEnd),
        createdAt: Timestamp.now()
      };
      
      const historyId = `${userId}_${subjectId}_${weekStart.getTime()}`;
      await setDoc(doc(db, 'positionHistory', historyId), historyEntry);
      
      console.log(`[InitializePositionHistory] Semana ${i}: Posición ${position}`);
    }
    
    console.log('[InitializePositionHistory] ✅ Historial inicializado');
    return true;
    
  } catch (error) {
    console.error('[InitializePositionHistory] Error:', error);
    throw error;
  }
};

// Exponer las funciones para poder usarlas desde la consola
(window as any).saveCurrentPositionToHistory = saveCurrentPositionToHistory;
(window as any).getPositionHistory = getPositionHistory;
(window as any).initializePositionHistory = initializePositionHistory;