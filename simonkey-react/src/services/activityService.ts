import { db } from './firebase';
import { doc, updateDoc, serverTimestamp, getDoc, addDoc, collection } from 'firebase/firestore';

export interface UserActivity {
  lastActivity: Date;
  sessionStart: Date;
  totalActiveTime: number; // en minutos
  activityCount: number;
  lastPage: string;
  deviceInfo: {
    userAgent: string;
    screenSize: string;
    timezone: string;
  };
}

// Cache para throttling - evitar múltiples peticiones en corto tiempo
const activityCache = new Map<string, { lastSent: number; pending: boolean }>();
const THROTTLE_DELAY = 30000; // 30 segundos entre peticiones del mismo tipo

// Sistema de batch para agrupar actividades
const activityBatch: Array<{
  userId: string;
  page: string;
  action: string;
  metadata?: any;
  timestamp: Date;
}> = [];
const BATCH_SIZE = 5; // Enviar cuando hay 5 actividades
const BATCH_TIMEOUT = 60000; // O enviar después de 1 minuto
let batchTimeout: NodeJS.Timeout | null = null;

/**
 * Envía el batch de actividades al servidor
 */
const sendActivityBatch = async () => {
  if (activityBatch.length === 0) return;
  
  try {
    console.log(`📦 Enviando batch de ${activityBatch.length} actividades`);
    
    // Agrupar por usuario para optimizar
    const userGroups = new Map<string, typeof activityBatch>();
    activityBatch.forEach(activity => {
      if (!userGroups.has(activity.userId)) {
        userGroups.set(activity.userId, []);
      }
      userGroups.get(activity.userId)!.push(activity);
    });
    
    // Enviar cada grupo de usuario
    for (const [userId, activities] of Array.from(userGroups.entries())) {
      const batchData = {
        userId,
        activities: activities.map((a: { page: string; action: string; metadata?: any; timestamp: Date }) => ({
          page: a.page,
          action: a.action,
          timestamp: new Date().toISOString(),
          metadata: a.metadata || {},
          userAgent: navigator.userAgent,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })),
        batchTimestamp: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'userActivityBatch'), batchData);
    }
    
    // Limpiar batch
    activityBatch.length = 0;
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
    
    console.log('✅ Batch de actividades enviado exitosamente');
    
  } catch (error) {
    console.error('❌ Error enviando batch de actividades:', error);
    // Limpiar batch en caso de error
    activityBatch.length = 0;
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
  }
};

/**
 * Agrega actividad al batch
 */
const addToBatch = (userId: string, page: string, action: string, metadata?: any) => {
  activityBatch.push({
    userId,
    page,
    action,
    metadata,
    timestamp: new Date()
  });
  
  // Enviar si el batch está lleno
  if (activityBatch.length >= BATCH_SIZE) {
    sendActivityBatch();
    return;
  }
  
  // Configurar timeout para enviar el batch
  if (!batchTimeout) {
    batchTimeout = setTimeout(sendActivityBatch, BATCH_TIMEOUT);
  }
};

// Función para obtener o generar un ID de sesión
const getSessionId = (): string => {
  let sessionId = localStorage.getItem('userSessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('userSessionId', sessionId);
  }
  return sessionId;
};

/**
 * Registra actividad del usuario con throttling para reducir costos
 */
export const recordUserActivity = async (
  userId: string, 
  page: string, 
  action: string,
  metadata?: any
) => {
  try {
    // Crear clave única para este tipo de actividad
    const activityKey = `${userId}-${page}-${action}`;
    const now = Date.now();
    
    // Verificar si ya se envió recientemente
    const cached = activityCache.get(activityKey);
    if (cached && (now - cached.lastSent) < THROTTLE_DELAY) {
      console.log(`⏸️ Actividad throttled: ${action} en ${page} (esperando ${THROTTLE_DELAY/1000}s)`);
      return; // Evitar petición duplicada
    }
    
    // Marcar como enviada
    activityCache.set(activityKey, { lastSent: now, pending: true });
    
    // Solo registrar actividades importantes para reducir costos
    const importantActions = ['page_view', 'navigation', 'login', 'logout', 'important_click'];
    const isImportant = importantActions.includes(action);
    
    if (!isImportant) {
      console.log(`💡 Actividad no crítica ignorada: ${action} (para reducir costos)`);
      return;
    }
    
    // Usar sistema de batch para reducir peticiones
    addToBatch(userId, page, action, metadata);
    
    console.log(`📊 Actividad agregada al batch: ${action} en ${page}`);
    
    // Actualizar cache
    activityCache.set(activityKey, { lastSent: now, pending: false });
    
  } catch (error) {
    console.error('❌ Error registrando actividad:', error);
    // Limpiar cache en caso de error
    const activityKey = `${userId}-${page}-${action}`;
    activityCache.delete(activityKey);
  }
};

/**
 * Obtiene la información de actividad del usuario
 */
export const getUserActivity = async (userId: string): Promise<UserActivity | null> => {
  try {
    if (!userId) return null;

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    return {
      lastActivity: data.lastActivity?.toDate() || new Date(),
      sessionStart: data.sessionStart?.toDate() || new Date(),
      totalActiveTime: data.totalActiveTime || 0,
      activityCount: data.activityCount || 0,
      lastPage: data.lastPage || 'unknown',
      deviceInfo: data.deviceInfo || {
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
  } catch (error) {
    console.error('❌ Error obteniendo actividad del usuario:', error);
    return null;
  }
};

/**
 * Marca el inicio de una nueva sesión
 */
export const startUserSession = async (userId: string): Promise<void> => {
  try {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      sessionStart: serverTimestamp(),
      lastActivity: serverTimestamp(),
      activityCount: 0,
      totalActiveTime: 0,
      lastPage: window.location.pathname,
      deviceInfo: {
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });

    console.log(`✅ Nueva sesión iniciada para usuario ${userId}`);
    
  } catch (error) {
    console.error('❌ Error iniciando sesión de usuario:', error);
  }
};

/**
 * Marca el fin de la sesión
 */
export const endUserSession = async (userId: string): Promise<void> => {
  try {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    
    // Obtener datos actuales para calcular tiempo total
    const userDoc = await getDoc(userRef);
    const currentData = userDoc.exists() ? userDoc.data() : {};
    
    let totalActiveTime = currentData.totalActiveTime || 0;
    if (currentData.lastActivity) {
      const lastActivity = currentData.lastActivity.toDate();
      const now = new Date();
      const timeDiff = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60));
      if (timeDiff <= 5) {
        totalActiveTime += timeDiff;
      }
    }

    await updateDoc(userRef, {
      sessionEnd: serverTimestamp(),
      totalActiveTime: Math.max(totalActiveTime, 0),
      lastActivity: serverTimestamp()
    });

    console.log(`✅ Sesión finalizada para usuario ${userId}`);
    
  } catch (error) {
    console.error('❌ Error finalizando sesión de usuario:', error);
  }
};

/**
 * Registra una acción específica del usuario
 */
export const recordUserAction = async (
  userId: string,
  action: string,
  details?: any
): Promise<void> => {
  try {
    if (!userId) return;

    await recordUserActivity(userId, window.location.pathname, action);
    
    // Si hay detalles adicionales, guardarlos en un subcolección
    if (details) {
      const activityRef = doc(db, 'users', userId, 'activityLog', Date.now().toString());
      await updateDoc(activityRef, {
        action,
        details,
        timestamp: serverTimestamp(),
        page: window.location.pathname
      });
    }
    
  } catch (error) {
    console.error('❌ Error registrando acción del usuario:', error);
  }
}; 