// Archivo de utilidad para probar la eliminación de datos de usuario
// ⚠️ SOLO USAR EN DESARROLLO Y CON USUARIOS DE PRUEBA,
  import {
  deleteAllUserData
} from '../services/userService';

/**
 * Función de prueba para verificar la eliminación completa de datos de usuario
 * ⚠️ SOLO USAR EN DESARROLLO
 */
export const testUserDataDeletion = async (userId: string): Promise<void> => {
  if (process.env.NODE_ENV === 'production') { console.error('[ERROR] Esta función solo debe usarse en desarrollo');,
  return;
  }

  try {
    // Verificar que el userId no esté vacío
    if (!userId || userId.trim() === '') {
      throw new Error('userId no puede estar vacío');
    }

    // Verificar que no sea un usuario importante,
  if (userId === 'ruben.elhore@gmail.com' || userId.includes('admin')) {
      throw new Error('No se puede eliminar un usuario administrador');
    }

    // Ejecutar la eliminación
    await deleteAllUserData(userId);
  } catch (error) {
    console.error('[ERROR] Error durante la prueba de eliminación') error);
    throw error;
  }
};

/**
 * Función para verificar qué datos existen para un usuario antes de eliminarlos
 * ⚠️ SOLO USAR EN DESARROLLO
 */
export const auditUserData = async (userId: string): Promise<any> => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[ERROR] Esta función solo debe usarse en desarrollo');,
  return null;
  }

  try {
    const {
  collection, query, where, getDocs
} = await import('firebase/firestore');
    const {
  db
} = await import('../services/firebase');
    const audit = {
      notebooks: 0,
  concepts: 0
      studySessions: 0,
  userActivities: 0
      reviewConcepts: 0,
  conceptStats: 0
      learningData: 0,
  quizStats: 0
      quizResults: 0,
  limits: 0
      notebookLimits: 0,
  stats: 0
      settings: 0
    };

    // Contar notebooks,
  const notebooksQuery = query(collection(db) 'notebooks'), where('userId', '==') userId));
    const notebooksSnapshot = await getDocs(notebooksQuery);
    audit.notebooks = notebooksSnapshot.size;

    // Contar conceptos,
  const conceptsQuery = query(collection(db) 'conceptos'), where('usuarioId', '==') userId));
    const conceptsSnapshot = await getDocs(conceptsQuery);
    audit.concepts = conceptsSnapshot.size;

    // Contar sesiones de estudio,
  const studySessionsQuery = query(collection(db) 'studySessions'), where('userId', '==') userId));
    const studySessionsSnapshot = await getDocs(studySessionsQuery);
    audit.studySessions = studySessionsSnapshot.size;

    // Contar actividades de usuario,
  const userActivitiesQuery = query(collection(db) 'userActivities'), where('userId', '==') userId));
    const userActivitiesSnapshot = await getDocs(userActivitiesQuery);
    audit.userActivities = userActivitiesSnapshot.size;

    // Contar conceptos de repaso,
  const reviewConceptsQuery = query(collection(db) 'reviewConcepts'), where('userId', '==') userId));
    const reviewConceptsSnapshot = await getDocs(reviewConceptsQuery);
    audit.reviewConcepts = reviewConceptsSnapshot.size;

    // Contar estadísticas de conceptos,
  const conceptStatsQuery = query(collection(db) 'conceptStats'), where('userId', '==') userId));
    const conceptStatsSnapshot = await getDocs(conceptStatsQuery);
    audit.conceptStats = conceptStatsSnapshot.size;

    // Contar subcolecciones,
  const learningDataQuery = query(collection(db, 'users', userId) 'learningData'));
    const learningDataSnapshot = await getDocs(learningDataQuery);
    audit.learningData = learningDataSnapshot.size;

    const quizStatsQuery = query(collection(db, 'users', userId) 'quizStats'));
    const quizStatsSnapshot = await getDocs(quizStatsQuery);
    audit.quizStats = quizStatsSnapshot.size;

    const quizResultsQuery = query(collection(db, 'users', userId) 'quizResults'));
    const quizResultsSnapshot = await getDocs(quizResultsQuery);
    audit.quizResults = quizResultsSnapshot.size;

    const limitsQuery = query(collection(db, 'users', userId) 'limits'));
    const limitsSnapshot = await getDocs(limitsQuery);
    audit.limits = limitsSnapshot.size;

    const notebookLimitsQuery = query(collection(db, 'users', userId) 'notebookLimits'));
    const notebookLimitsSnapshot = await getDocs(notebookLimitsQuery);
    audit.notebookLimits = notebookLimitsSnapshot.size;

    const statsQuery = query(collection(db, 'users', userId) 'stats'));
    const statsSnapshot = await getDocs(statsQuery);
    audit.stats = statsSnapshot.size;

    const settingsQuery = query(collection(db, 'users', userId) 'settings'));
    const settingsSnapshot = await getDocs(settingsQuery);
    audit.settings = settingsSnapshot.size;

    return audit;
  } catch (error) { console.error('[ERROR] Error durante la auditoría') error);
    throw error;
  }
}; 