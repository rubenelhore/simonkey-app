import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeApp } from 'firebase/app';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC26QZw7297E_YOoF5OqR2Ck6x_bw5_Hic",
  authDomain: "simonkey-5c78f.firebaseapp.com",
  projectId: "simonkey-5c78f",
  storageBucket: "simonkey-5c78f.firebasestorage.app",
  messagingSenderId: "235501879490",
  appId: "1:235501879490:web:05fea6dae9c63b2a827b5b"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firebase Functions
const functions = getFunctions(app);

// Tipos para las funciones
interface DeleteUserDataRequest {
  userId: string;
  deletedBy?: string;
}

interface DeleteUserDataResponse {
  success: boolean;
  message: string;
  deletedItems: {
    notebooks: number;
    concepts: number;
    studySessions: number;
    userActivities: number;
    reviewConcepts: number;
    conceptStats: number;
    learningData: number;
    quizStats: number;
    quizResults: number;
    limits: number;
    notebookLimits: number;
    stats: number;
    settings: number;
    userDocument: boolean;
    authAccount: boolean;
  };
  errors?: string[];
}

interface CheckUserDeletionStatusRequest {
  userId: string;
}

interface CheckUserDeletionStatusResponse {
  userId: string;
  existsInFirestore: boolean;
  existsInAuth: boolean;
  deletionRecord: any;
  status: 'active' | 'deleted';
}

/**
 * Eliminar completamente todos los datos de un usuario usando Firebase Functions
 * Esta función reemplaza la lógica compleja del cliente con operaciones optimizadas del servidor
 */
export const deleteUserDataWithFunction = async (
  userId: string, 
  deletedBy?: string
): Promise<DeleteUserDataResponse> => {
  try {
    console.log('🚀 Llamando Firebase Function para eliminar usuario:', userId);
    
    const deleteUserFunction = httpsCallable<DeleteUserDataRequest, DeleteUserDataResponse>(
      functions, 
      'deleteUserData'
    );
    
    const result = await deleteUserFunction({ userId, deletedBy });
    const data = result.data;
    
    console.log('✅ Función ejecutada exitosamente:', data);
    return data;
    
  } catch (error: any) {
    console.error('❌ Error llamando Firebase Function:', error);
    
    // Manejar errores específicos de Firebase Functions
    if (error.code === 'functions/unavailable') {
      throw new Error('La función no está disponible. Verifica que esté desplegada.');
    } else if (error.code === 'functions/unauthenticated') {
      throw new Error('Debes estar autenticado para usar esta función.');
    } else if (error.code === 'functions/permission-denied') {
      throw new Error('No tienes permisos para usar esta función.');
    } else if (error.code === 'functions/invalid-argument') {
      throw new Error('Argumentos inválidos proporcionados a la función.');
    } else if (error.code === 'functions/deadline-exceeded') {
      throw new Error('La función tardó demasiado en ejecutarse.');
    } else if (error.code === 'functions/resource-exhausted') {
      throw new Error('Recursos agotados. Intenta más tarde.');
    } else if (error.code === 'functions/failed-precondition') {
      throw new Error('Condición previa fallida.');
    } else if (error.code === 'functions/aborted') {
      throw new Error('La función fue abortada.');
    } else if (error.code === 'functions/out-of-range') {
      throw new Error('Valor fuera de rango.');
    } else if (error.code === 'functions/unimplemented') {
      throw new Error('La función no está implementada.');
    } else if (error.code === 'functions/internal') {
      throw new Error('Error interno del servidor.');
    } else if (error.code === 'functions/data-loss') {
      throw new Error('Pérdida de datos.');
    } else {
      throw new Error(`Error desconocido: ${error.message}`);
    }
  }
};

/**
 * Verificar el estado de eliminación de un usuario
 */
export const checkUserDeletionStatus = async (
  userId: string
): Promise<CheckUserDeletionStatusResponse> => {
  try {
    console.log('🔍 Verificando estado de eliminación para usuario:', userId);
    
    const checkStatusFunction = httpsCallable<CheckUserDeletionStatusRequest, CheckUserDeletionStatusResponse>(
      functions, 
      'checkUserDeletionStatus'
    );
    
    const result = await checkStatusFunction({ userId });
    const data = result.data;
    
    console.log('✅ Estado verificado:', data);
    return data;
    
  } catch (error: any) {
    console.error('❌ Error verificando estado:', error);
    throw new Error(`Error verificando estado: ${error.message}`);
  }
};

/**
 * Función de conveniencia para eliminar usuario con confirmación y feedback
 */
export const deleteUserWithConfirmation = async (
  userId: string,
  userName: string,
  onProgress?: (message: string) => void,
  onSuccess?: (result: DeleteUserDataResponse) => void,
  onError?: (error: string) => void
): Promise<void> => {
  try {
    // Confirmación
    const confirmed = window.confirm(
      `¿Estás seguro de que quieres eliminar completamente al usuario "${userName}"?\n\n` +
      `Esta acción eliminará TODOS sus datos incluyendo:\n` +
      `• Notebooks y conceptos\n` +
      `• Sesiones de estudio\n` +
      `• Estadísticas y progreso\n` +
      `• Cuenta de Firebase Auth\n\n` +
      `Esta acción es IRREVERSIBLE.`
    );
    
    if (!confirmed) {
      onProgress?.('Eliminación cancelada por el usuario');
      return;
    }
    
    onProgress?.('🚀 Iniciando eliminación con Firebase Functions...');
    
    // Llamar a la función
    const result = await deleteUserDataWithFunction(userId);
    
    if (result.success) {
      const totalDeleted = result.deletedItems.notebooks + result.deletedItems.concepts + 
                          result.deletedItems.studySessions + result.deletedItems.userActivities + 
                          result.deletedItems.reviewConcepts + result.deletedItems.conceptStats + 
                          result.deletedItems.learningData + result.deletedItems.quizStats + 
                          result.deletedItems.quizResults + result.deletedItems.limits + 
                          result.deletedItems.notebookLimits + result.deletedItems.stats + 
                          result.deletedItems.settings;
      
      onProgress?.(`✅ Usuario eliminado exitosamente!\n\n` +
        `📊 Resumen de eliminación:\n` +
        `• ${result.deletedItems.notebooks} notebooks\n` +
        `• ${result.deletedItems.concepts} conceptos\n` +
        `• ${result.deletedItems.studySessions} sesiones de estudio\n` +
        `• ${result.deletedItems.userActivities} actividades\n` +
        `• ${result.deletedItems.reviewConcepts} conceptos de repaso\n` +
        `• ${result.deletedItems.conceptStats} estadísticas\n` +
        `• ${result.deletedItems.learningData} datos de aprendizaje\n` +
        `• ${result.deletedItems.quizStats} estadísticas de quiz\n` +
        `• ${result.deletedItems.quizResults} resultados de quiz\n` +
        `• ${result.deletedItems.limits} límites\n` +
        `• ${result.deletedItems.notebookLimits} límites de notebooks\n` +
        `• ${result.deletedItems.stats} estadísticas\n` +
        `• ${result.deletedItems.settings} configuraciones\n` +
        `• Documento principal: ${result.deletedItems.userDocument ? 'Eliminado' : 'No encontrado'}\n` +
        `• Cuenta Auth: ${result.deletedItems.authAccount ? 'Eliminada' : 'No eliminada'}\n\n` +
        `Total: ${totalDeleted} elementos eliminados`
      );
      
      onSuccess?.(result);
    } else {
      onProgress?.(`❌ Error en la eliminación: ${result.message}`);
      onError?.(result.message);
    }
    
  } catch (error: any) {
    const errorMessage = `❌ Error eliminando usuario: ${error.message}`;
    onProgress?.(errorMessage);
    onError?.(errorMessage);
  }
};

/**
 * Calcular y actualizar estadísticas automáticas de usuario
 */
export const calculateUserStats = async (
  userId: string
): Promise<{
  success: boolean;
  stats: {
    totalNotebooks: number;
    totalConcepts: number;
    masteredConcepts: number;
    totalStudyTimeMinutes: number;
    completedSessions: number;
    currentStreak: number;
    lastUpdated: any;
  };
}> => {
  try {
    console.log('📊 Calculando estadísticas para usuario:', userId);
    
    const calculateStatsFunction = httpsCallable<
      { userId: string },
      {
        success: boolean;
        stats: {
          totalNotebooks: number;
          totalConcepts: number;
          masteredConcepts: number;
          totalStudyTimeMinutes: number;
          completedSessions: number;
          currentStreak: number;
          lastUpdated: any;
        };
      }
    >(functions, 'calculateUserStats');
    
    const result = await calculateStatsFunction({ userId });
    const data = result.data;
    
    console.log('✅ Estadísticas calculadas:', data);
    return data;
    
  } catch (error: any) {
    console.error('❌ Error calculando estadísticas:', error);
    throw new Error(`Error calculando estadísticas: ${error.message}`);
  }
};

/**
 * Limpiar datos antiguos automáticamente
 */
export const cleanupOldData = async (
  userId: string,
  daysToKeep: number = 90
): Promise<{
  success: boolean;
  message: string;
  deletedItems: {
    oldStudySessions: number;
    oldActivities: number;
    oldQuizResults: number;
  };
}> => {
  try {
    console.log('🧹 Iniciando limpieza de datos antiguos para usuario:', userId);
    
    const cleanupFunction = httpsCallable<
      { userId: string; daysToKeep: number },
      {
        success: boolean;
        message: string;
        deletedItems: {
          oldStudySessions: number;
          oldActivities: number;
          oldQuizResults: number;
        };
      }
    >(functions, 'cleanupOldData');
    
    const result = await cleanupFunction({ userId, daysToKeep });
    const data = result.data;
    
    console.log('✅ Limpieza completada:', data);
    return data;
    
  } catch (error: any) {
    console.error('❌ Error durante limpieza:', error);
    throw new Error(`Error durante limpieza: ${error.message}`);
  }
};

/**
 * Exportar datos de usuario en formato JSON
 */
export const exportUserData = async (
  userId: string
): Promise<{
  success: boolean;
  data: {
    user: any;
    notebooks: any[];
    concepts: any[];
    studySessions: any[];
    learningData: any[];
    quizResults: any[];
    stats: { [key: string]: any };
    exportDate: string;
  };
  summary: {
    notebooks: number;
    concepts: number;
    studySessions: number;
    learningData: number;
    quizResults: number;
  };
}> => {
  try {
    console.log('📤 Exportando datos de usuario:', userId);
    
    const exportFunction = httpsCallable(functions, 'exportUserData');
    const result = await exportFunction({ userId });
    const data = result.data as any;
    
    console.log('✅ Datos exportados exitosamente');
    return data;
    
  } catch (error: any) {
    console.error('❌ Error exportando datos:', error);
    throw new Error(`Error exportando datos: ${error.message}`);
  }
};

// ===== NUEVAS FUNCIONES OPTIMIZADAS =====

/**
 * Sincronizar usuarios escolares (profesores y estudiantes)
 * Reemplaza las funciones de syncSchoolUsers.ts del cliente
 */
export const syncSchoolUsers = async (
  type: 'all' | 'teachers' | 'students' | 'specific' = 'all',
  userId?: string
): Promise<{
  success: boolean;
  message: string;
  results: {
    teachers: { success: number; errors: Array<{ id: string; email: string; error: string }> };
    students: { success: number; errors: Array<{ id: string; email: string; error: string }> };
  };
}> => {
  try {
    console.log('🔄 Sincronizando usuarios escolares:', { type, userId });
    
    const syncFunction = httpsCallable(functions, 'syncSchoolUsers');
    const result = await syncFunction({ type, userId });
    const data = result.data as any;
    
    console.log('✅ Sincronización completada:', data);
    return data;
    
  } catch (error: any) {
    console.error('❌ Error sincronizando usuarios:', error);
    throw new Error(`Error sincronizando usuarios: ${error.message}`);
  }
};

/**
 * Crear usuario escolar
 * Reemplaza createSchoolUser de utils
 */
export const createSchoolUser = async (
  userData: {
    email: string;
    nombre: string;
    password?: string;
    role: 'teacher' | 'student';
    additionalData?: any;
  }
): Promise<{
  success: boolean;
  userId: string;
  message: string;
}> => {
  try {
    console.log('🔄 Creando usuario escolar:', userData);
    
    const createFunction = httpsCallable(functions, 'createSchoolUser');
    const result = await createFunction({ userData });
    const data = result.data as any;
    
    console.log('✅ Usuario escolar creado:', data);
    return data;
    
  } catch (error: any) {
    console.error('❌ Error creando usuario escolar:', error);
    throw new Error(`Error creando usuario escolar: ${error.message}`);
  }
};

/**
 * Arreglar usuarios huérfanos
 * Reemplaza fixOrphanUsers de utils
 */
export const fixOrphanUsers = async (
  userId?: string
): Promise<{
  success: boolean;
  message: string;
  results: {
    success: number;
    errors: Array<{ email: string; error: string }>;
  };
}> => {
  try {
    console.log('🔧 Arreglando usuarios huérfanos:', { userId });
    
    const fixFunction = httpsCallable(functions, 'fixOrphanUsers');
    const result = await fixFunction({ userId });
    const data = result.data as any;
    
    console.log('✅ Reparación completada:', data);
    return data;
    
  } catch (error: any) {
    console.error('❌ Error arreglando usuarios:', error);
    throw new Error(`Error arreglando usuarios: ${error.message}`);
  }
};

/**
 * Migrar usuarios existentes
 * Reemplaza migrateUsers de utils
 */
export const migrateUsers = async (): Promise<{
  success: boolean;
  message: string;
  updatedCount: number;
  errorCount: number;
}> => {
  try {
    console.log('🔄 Migrando usuarios existentes...');
    
    const migrateFunction = httpsCallable(functions, 'migrateUsers');
    const result = await migrateFunction({});
    const data = result.data as any;
    
    console.log('✅ Migración completada:', data);
    return data;
    
  } catch (error: any) {
    console.error('❌ Error migrando usuarios:', error);
    throw new Error(`Error migrando usuarios: ${error.message}`);
  }
}; 