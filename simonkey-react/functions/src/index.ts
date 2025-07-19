/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { beforeUserCreated } from "firebase-functions/v2/identity";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions/v1";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Importar funciones de congelación programada
export { processScheduledFreezeUnfreeze, processScheduledFreezeUnfreezeManual } from './scheduledFreezeUnfreeze';

// Inicializar Firebase Admin con el bucket de Storage
admin.initializeApp({
  storageBucket: 'simonkey-5c78f.appspot.com'
});

// Usar la base de datos simonkey-general
const getDb = () => {
  // En firebase-admin 12.x, usar getFirestore con el nombre de la base de datos
  return getFirestore();
};

// Configuración de límites por tipo de suscripción
const SUBSCRIPTION_LIMITS = {
  FREE: {
    dailyGeminiCalls: 50,
    maxConceptsPerFile: 20,
    maxExplanationLength: 500
  },
  PRO: {
    dailyGeminiCalls: 200,
    maxConceptsPerFile: 50,
    maxExplanationLength: 1000
  },
  SCHOOL: {
    dailyGeminiCalls: 500,
    maxConceptsPerFile: 100,
    maxExplanationLength: 1500
  },
  SUPER_ADMIN: {
    dailyGeminiCalls: 1000,
    maxConceptsPerFile: 200,
    maxExplanationLength: 2000
  }
} as const;

type SubscriptionType = keyof typeof SUBSCRIPTION_LIMITS;
type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Función auxiliar para obtener límites de suscripción con fallback seguro
 */
const getSubscriptionLimits = (subscriptionType: string) => {
  logger.info("🔍 Obteniendo límites de suscripción", { 
    originalType: subscriptionType,
    typeOf: typeof subscriptionType,
    isNull: subscriptionType === null,
    isUndefined: subscriptionType === undefined
  });

  // Manejar casos edge
  if (!subscriptionType || subscriptionType === 'null' || subscriptionType === 'undefined') {
    logger.warn("⚠️ Tipo de suscripción vacío o inválido, usando límites FREE", { subscriptionType });
    return SUBSCRIPTION_LIMITS.FREE;
  }

  // Normalizar el tipo de suscripción
  const normalizedType = subscriptionType?.toUpperCase() as SubscriptionType;
  
  logger.info("📋 Tipo normalizado", { 
    original: subscriptionType, 
    normalized: normalizedType 
  });
  
  // Si el tipo está en SUBSCRIPTION_LIMITS, usarlo
  if (SUBSCRIPTION_LIMITS[normalizedType]) {
    logger.info("✅ Límites encontrados en SUBSCRIPTION_LIMITS", { 
      type: normalizedType, 
      limits: SUBSCRIPTION_LIMITS[normalizedType] 
    });
    return SUBSCRIPTION_LIMITS[normalizedType];
  }
  
  // Fallbacks para tipos no estándar
  if (normalizedType === 'SCHOOL' || normalizedType?.includes('SCHOOL')) {
    logger.info("🏫 Usando límites SCHOOL por fallback", { type: normalizedType });
    return SUBSCRIPTION_LIMITS.SCHOOL;
  }
  
  if (normalizedType === 'SUPER_ADMIN' || normalizedType?.includes('ADMIN')) {
    logger.info("👑 Usando límites SUPER_ADMIN por fallback", { type: normalizedType });
    return SUBSCRIPTION_LIMITS.SUPER_ADMIN;
  }
  
  if (normalizedType === 'PRO' || normalizedType?.includes('PREMIUM')) {
    logger.info("⭐ Usando límites PRO por fallback", { type: normalizedType });
    return SUBSCRIPTION_LIMITS.PRO;
  }
  
  // Por defecto, usar límites FREE
  logger.warn("⚠️ Tipo de suscripción no reconocido, usando límites FREE", { 
    originalType: subscriptionType,
    normalizedType: normalizedType,
    availableTypes: Object.keys(SUBSCRIPTION_LIMITS)
  });
  return SUBSCRIPTION_LIMITS.FREE;
};

/**
 * Función para eliminar completamente todos los datos de un usuario
 * Esta función reemplaza la compleja lógica del cliente con operaciones optimizadas del servidor
 */
export const deleteUserData = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 540, // 9 minutos máximo
    memory: "1GiB",
  },
  async (request) => {
    const { userId, deletedBy } = request.data;
    
    // Verificar que el usuario que llama la función es super admin
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    logger.info("🗑️ Iniciando eliminación de usuario", {
      userId,
      deletedBy: deletedBy || request.auth.uid,
      caller: request.auth.uid
    });

    const deletedItems = {
      notebooks: 0,
      concepts: 0,
      studySessions: 0,
      userActivities: 0,
      reviewConcepts: 0,
      conceptStats: 0,
      learningData: 0,
      quizStats: 0,
      quizResults: 0,
      limits: 0,
      notebookLimits: 0,
      stats: 0,
      settings: 0,
      userDocument: false,
      authAccount: false
    };

    const errors: string[] = [];

    try {
      const db = getDb();
      const auth = admin.auth();

      // 1. ELIMINAR NOTEBOOKS Y CONCEPTOS (operación optimizada)
      logger.info("📚 Eliminando notebooks y conceptos...");
      try {
        const notebooksQuery = db.collection("notebooks").where("userId", "==", userId);
        const notebooksSnapshot = await notebooksQuery.get();
        
        const batch = db.batch();
        
        // Eliminar conceptos de cada notebook
        for (const notebookDoc of notebooksSnapshot.docs) {
          const conceptsQuery = db.collection("conceptos").where("cuadernoId", "==", notebookDoc.id);
          const conceptsSnapshot = await conceptsQuery.get();
          
          conceptsSnapshot.docs.forEach(conceptDoc => {
            batch.delete(conceptDoc.ref);
            deletedItems.concepts++;
          });
          
          batch.delete(notebookDoc.ref);
          deletedItems.notebooks++;
        }
        
        await batch.commit();
        logger.info(`✅ Eliminados ${deletedItems.notebooks} notebooks y ${deletedItems.concepts} conceptos`);
      } catch (error) {
        const errorMsg = `Error eliminando notebooks: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }

      // 2. ELIMINAR SESIONES DE ESTUDIO
      logger.info("📊 Eliminando sesiones de estudio...");
      try {
        const studySessionsQuery = db.collection("studySessions").where("userId", "==", userId);
        const studySessionsSnapshot = await studySessionsQuery.get();
        
        const batch = db.batch();
        studySessionsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedItems.studySessions++;
        });
        await batch.commit();
        logger.info(`✅ Eliminadas ${deletedItems.studySessions} sesiones de estudio`);
      } catch (error) {
        const errorMsg = `Error eliminando sesiones: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }

      // 3. ELIMINAR ACTIVIDADES DE USUARIO
      logger.info("📈 Eliminando actividades de usuario...");
      try {
        const userActivitiesQuery = db.collection("userActivities").where("userId", "==", userId);
        const userActivitiesSnapshot = await userActivitiesQuery.get();
        
        const batch = db.batch();
        userActivitiesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedItems.userActivities++;
        });
        await batch.commit();
        logger.info(`✅ Eliminadas ${deletedItems.userActivities} actividades`);
      } catch (error) {
        const errorMsg = `Error eliminando actividades: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }

      // 4. ELIMINAR CONCEPTOS DE REPASO
      logger.info("🔄 Eliminando conceptos de repaso...");
      try {
        const reviewConceptsQuery = db.collection("reviewConcepts").where("userId", "==", userId);
        const reviewConceptsSnapshot = await reviewConceptsQuery.get();
        
        const batch = db.batch();
        reviewConceptsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedItems.reviewConcepts++;
        });
        await batch.commit();
        logger.info(`✅ Eliminados ${deletedItems.reviewConcepts} conceptos de repaso`);
      } catch (error) {
        const errorMsg = `Error eliminando conceptos de repaso: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }

      // 5. ELIMINAR ESTADÍSTICAS DE CONCEPTOS
      logger.info("📊 Eliminando estadísticas de conceptos...");
      try {
        const conceptStatsQuery = db.collection("conceptStats").where("userId", "==", userId);
        const conceptStatsSnapshot = await conceptStatsQuery.get();
        
        const batch = db.batch();
        conceptStatsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedItems.conceptStats++;
        });
        await batch.commit();
        logger.info(`✅ Eliminadas ${deletedItems.conceptStats} estadísticas de conceptos`);
      } catch (error) {
        const errorMsg = `Error eliminando estadísticas: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }

      // 6. ELIMINAR SUBCOLECCIONES DEL USUARIO (operación masiva)
      logger.info("🗂️ Eliminando subcolecciones del usuario...");
      const subcollections = [
        "learningData",
        "quizStats", 
        "quizResults",
        "limits",
        "notebookLimits",
        "stats",
        "settings"
      ];

      for (const subcollection of subcollections) {
        try {
          const subcollectionRef = db.collection("users").doc(userId).collection(subcollection);
          const snapshot = await subcollectionRef.get();
          
          const batch = db.batch();
          let count = 0;
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            count++;
          });
          await batch.commit();
          
          // Actualizar contador según la subcolección
          if (subcollection === "learningData") deletedItems.learningData = count;
          else if (subcollection === "quizStats") deletedItems.quizStats = count;
          else if (subcollection === "quizResults") deletedItems.quizResults = count;
          else if (subcollection === "limits") deletedItems.limits = count;
          else if (subcollection === "notebookLimits") deletedItems.notebookLimits = count;
          else if (subcollection === "stats") deletedItems.stats = count;
          else if (subcollection === "settings") deletedItems.settings = count;
          
          logger.info(`✅ Eliminados ${count} documentos de ${subcollection}`);
        } catch (error) {
          const errorMsg = `Error eliminando ${subcollection}: ${error}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // 7. ELIMINAR DOCUMENTO PRINCIPAL DEL USUARIO
      logger.info("👤 Eliminando documento principal del usuario...");
      try {
        await db.collection("users").doc(userId).delete();
        deletedItems.userDocument = true;
        logger.info("✅ Documento principal del usuario eliminado");
      } catch (error) {
        const errorMsg = `Error eliminando documento principal: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }

      // 8. ELIMINAR DE LA COLECCIÓN EN ESPAÑOL (SI EXISTE)
      try {
        await db.collection("usuarios").doc(userId).delete();
        logger.info("✅ Documento de usuario en español eliminado");
      } catch (error) {
        // No es un error crítico si no existe
        logger.info("ℹ️ No se encontró documento de usuario en español");
      }

      // 9. ELIMINAR CUENTA DE FIREBASE AUTH (Admin SDK)
      logger.info("🔐 Eliminando cuenta de Firebase Auth...");
      try {
        await auth.deleteUser(userId);
        deletedItems.authAccount = true;
        logger.info("✅ Cuenta de Firebase Auth eliminada exitosamente");
      } catch (error: any) {
        const errorMsg = `Error eliminando cuenta de Auth: ${error.message}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }

      // 10. CREAR REGISTRO DE ELIMINACIÓN PARA AUDITORÍA
      try {
        await db.collection("userDeletions").doc(userId).set({
          userId,
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          deletedBy: deletedBy || request.auth.uid,
          status: "completed",
          deletedItems,
          errors: errors.length > 0 ? errors : null
        });
        logger.info("📝 Registro de eliminación creado para auditoría");
      } catch (error) {
        const errorMsg = `Error creando registro de auditoría: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }

      const totalDeleted = deletedItems.notebooks + deletedItems.concepts + 
                          deletedItems.studySessions + deletedItems.userActivities + 
                          deletedItems.reviewConcepts + deletedItems.conceptStats + 
                          deletedItems.learningData + deletedItems.quizStats + 
                          deletedItems.quizResults + deletedItems.limits + 
                          deletedItems.notebookLimits + deletedItems.stats + 
                          deletedItems.settings;

      logger.info("🎉 Eliminación de usuario completada", {
        userId,
        totalDeleted,
        errors: errors.length
      });

      return {
        success: true,
        message: `Usuario eliminado exitosamente. ${totalDeleted} elementos eliminados.`,
        deletedItems,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error: any) {
      logger.error("❌ Error crítico durante eliminación de usuario", {
        userId,
        error: error.message,
        stack: error.stack
      });

      throw new HttpsError(
        "internal",
        `Error eliminando usuario: ${error.message}`,
        { userId, errors }
      );
    }
  }
);

/**
 * Función para verificar el estado de eliminación de un usuario
 */
export const checkUserDeletionStatus = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  async (request) => {
    const { userId } = request.data;
    
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    try {
      const db = getDb();
      const auth = admin.auth();

      // Verificar si existe en Firestore
      const userDoc = await db.collection("users").doc(userId).get();
      const existsInFirestore = userDoc.exists;

      // Verificar si existe en Auth
      let existsInAuth = false;
      try {
        await auth.getUser(userId);
        existsInAuth = true;
      } catch (error) {
        existsInAuth = false;
      }

      // Verificar registro de eliminación
      const deletionDoc = await db.collection("userDeletions").doc(userId).get();
      const deletionRecord = deletionDoc.exists ? deletionDoc.data() : null;

      return {
        userId,
        existsInFirestore,
        existsInAuth,
        deletionRecord,
        status: existsInFirestore || existsInAuth ? "active" : "deleted"
      };

    } catch (error: any) {
      throw new HttpsError(
        "internal",
        `Error verificando estado: ${error.message}`
      );
    }
  }
);

/**
 * Función para calcular y actualizar estadísticas automáticas de usuario
 * Se ejecuta cuando se crean/modifican conceptos, sesiones de estudio, etc.
 */
export const calculateUserStats = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 60,
  },
  async (request) => {
    const { userId } = request.data;
    
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    logger.info("📊 Calculando estadísticas para usuario", { userId });

    try {
      const db = getDb();
      
      // 1. Contar notebooks
      const notebooksQuery = db.collection("notebooks").where("userId", "==", userId);
      const notebooksSnapshot = await notebooksQuery.get();
      const totalNotebooks = notebooksSnapshot.size;

      // 2. Contar conceptos totales (optimizado para evitar errores de índice)
      let totalConcepts = 0;
      let masteredConcepts = 0;
      
      try {
        // Intentar consulta con usuarioId primero
        const conceptsQuery = db.collection("conceptos").where("usuarioId", "==", userId);
        const conceptsSnapshot = await conceptsQuery.get();
        
        conceptsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.conceptos && Array.isArray(data.conceptos)) {
            totalConcepts += data.conceptos.length;
            data.conceptos.forEach((concepto: any) => {
              if (concepto.dominado) masteredConcepts++;
            });
          }
        });
      } catch (conceptError) {
        logger.warn("⚠️ Error consultando conceptos por usuarioId, intentando método alternativo", { error: conceptError });
        
        // Método alternativo: buscar conceptos por notebooks del usuario
        const userNotebooks = notebooksSnapshot.docs.map(doc => doc.id);
        for (const notebookId of userNotebooks) {
          try {
            const notebookConceptsQuery = db.collection("conceptos").where("cuadernoId", "==", notebookId);
            const notebookConceptsSnapshot = await notebookConceptsQuery.get();
            
            notebookConceptsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.conceptos && Array.isArray(data.conceptos)) {
                totalConcepts += data.conceptos.length;
                data.conceptos.forEach((concepto: any) => {
                  if (concepto.dominado) masteredConcepts++;
                });
              }
            });
          } catch (notebookError) {
            logger.warn(`⚠️ Error consultando conceptos del notebook ${notebookId}`, { error: notebookError });
          }
        }
      }

      // 3. Calcular tiempo total de estudio
      const studySessionsQuery = db.collection("studySessions").where("userId", "==", userId);
      const studySessionsSnapshot = await studySessionsQuery.get();
      let totalStudyTime = 0;
      
      studySessionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.metrics && data.metrics.timeSpent) {
          totalStudyTime += data.metrics.timeSpent;
        }
      });

      // 4. Contar sesiones completadas
      const completedSessions = studySessionsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.endTime && data.metrics;
      }).length;

      // 5. Calcular streak actual (con manejo de errores)
      let currentStreak = 0;
      try {
        const userActivitiesQuery = db.collection("userActivities")
          .where("userId", "==", userId)
          .where("type", "==", "study_session_completed")
          .orderBy("timestamp", "desc")
          .limit(30);
        const activitiesSnapshot = await userActivitiesQuery.get();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const activityDates = activitiesSnapshot.docs.map(doc => {
          const data = doc.data();
          const date = data.timestamp.toDate();
          date.setHours(0, 0, 0, 0);
          return date;
        });

        // Calcular streak consecutivo
        let checkDate = new Date(today);
        for (let i = 0; i < 30; i++) {
          const hasActivity = activityDates.some(date => 
            date.getTime() === checkDate.getTime()
          );
          if (hasActivity) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      } catch (streakError) {
        logger.warn("⚠️ Error calculando streak, usando valor por defecto", { error: streakError });
        currentStreak = 0;
      }

      // 6. Guardar estadísticas actualizadas
      const statsData = {
        totalNotebooks,
        totalConcepts,
        masteredConcepts,
        totalStudyTimeMinutes: Math.floor(totalStudyTime / 60),
        completedSessions,
        currentStreak,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("users").doc(userId).collection("stats").doc("summary").set(statsData);

      logger.info("✅ Estadísticas calculadas y guardadas", statsData);

      return {
        success: true,
        stats: statsData
      };

    } catch (error: any) {
      logger.error("❌ Error calculando estadísticas", {
        userId,
        error: error.message
      });

      throw new HttpsError(
        "internal",
        `Error calculando estadísticas: ${error.message}`,
        { userId, error: error.message }
      );
    }
  }
);

/**
 * Función para limpiar datos antiguos automáticamente
 * Elimina sesiones de estudio y actividades muy antiguas para optimizar la base de datos
 */
export const cleanupOldData = onCall(
  {
    maxInstances: 5,
    timeoutSeconds: 300, // 5 minutos
  },
  async (request) => {
    const { userId, daysToKeep = 90 } = request.data;
    
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    logger.info("🧹 Iniciando limpieza de datos antiguos", { userId, daysToKeep });

    try {
      const db = getDb();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedItems = {
        oldStudySessions: 0,
        oldActivities: 0,
        oldQuizResults: 0
      };

      // 1. Limpiar sesiones de estudio antiguas
      const oldSessionsQuery = db.collection("studySessions")
        .where("userId", "==", userId)
        .where("startTime", "<", cutoffDate);
      const oldSessionsSnapshot = await oldSessionsQuery.get();
      
      const batch1 = db.batch();
      oldSessionsSnapshot.docs.forEach(doc => {
        batch1.delete(doc.ref);
        deletedItems.oldStudySessions++;
      });
      await batch1.commit();

      // 2. Limpiar actividades antiguas
      const oldActivitiesQuery = db.collection("userActivities")
        .where("userId", "==", userId)
        .where("timestamp", "<", cutoffDate);
      const oldActivitiesSnapshot = await oldActivitiesQuery.get();
      
      const batch2 = db.batch();
      oldActivitiesSnapshot.docs.forEach(doc => {
        batch2.delete(doc.ref);
        deletedItems.oldActivities++;
      });
      await batch2.commit();

      // 3. Limpiar resultados de quiz antiguos
      const oldQuizResultsQuery = db.collection("users").doc(userId).collection("quizResults")
        .where("completedAt", "<", cutoffDate);
      const oldQuizResultsSnapshot = await oldQuizResultsQuery.get();
      
      const batch3 = db.batch();
      oldQuizResultsSnapshot.docs.forEach(doc => {
        batch3.delete(doc.ref);
        deletedItems.oldQuizResults++;
      });
      await batch3.commit();

      const totalDeleted = deletedItems.oldStudySessions + 
                          deletedItems.oldActivities + 
                          deletedItems.oldQuizResults;

      logger.info("✅ Limpieza completada", {
        userId,
        deletedItems,
        totalDeleted
      });

      return {
        success: true,
        message: `Limpieza completada. ${totalDeleted} elementos eliminados.`,
        deletedItems
      };

    } catch (error: any) {
      logger.error("❌ Error durante limpieza", {
        userId,
        error: error.message
      });

      throw new HttpsError(
        "internal",
        `Error durante limpieza: ${error.message}`
      );
    }
  }
);

/**
 * Función para exportar datos de usuario en formato JSON
 * Útil para respaldos o migración de datos
 */
export const exportUserData = onCall(
  {
    maxInstances: 5,
    timeoutSeconds: 120,
  },
  async (request) => {
    const { userId } = request.data;
    
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    logger.info("📤 Exportando datos de usuario", { userId });

    try {
      const db = getDb();
      
      const exportData: {
        user: any;
        notebooks: any[];
        concepts: any[];
        studySessions: any[];
        learningData: any[];
        quizResults: any[];
        stats: { [key: string]: any };
        exportDate: string;
      } = {
        user: null,
        notebooks: [],
        concepts: [],
        studySessions: [],
        learningData: [],
        quizResults: [],
        stats: {},
        exportDate: new Date().toISOString()
      };

      // 1. Datos del usuario
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        exportData.user = userDoc.data();
      }

      // 2. Notebooks
      const notebooksQuery = db.collection("notebooks").where("userId", "==", userId);
      const notebooksSnapshot = await notebooksQuery.get();
      notebooksSnapshot.docs.forEach(doc => {
        exportData.notebooks.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // 3. Conceptos
      const conceptsQuery = db.collection("conceptos").where("usuarioId", "==", userId);
      const conceptsSnapshot = await conceptsQuery.get();
      conceptsSnapshot.docs.forEach(doc => {
        exportData.concepts.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // 4. Sesiones de estudio
      const studySessionsQuery = db.collection("studySessions").where("userId", "==", userId);
      const studySessionsSnapshot = await studySessionsQuery.get();
      studySessionsSnapshot.docs.forEach(doc => {
        exportData.studySessions.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // 5. Datos de aprendizaje
      const learningDataQuery = db.collection("users").doc(userId).collection("learningData");
      const learningDataSnapshot = await learningDataQuery.get();
      learningDataSnapshot.docs.forEach(doc => {
        exportData.learningData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // 6. Resultados de quiz
      const quizResultsQuery = db.collection("users").doc(userId).collection("quizResults");
      const quizResultsSnapshot = await quizResultsQuery.get();
      quizResultsSnapshot.docs.forEach(doc => {
        exportData.quizResults.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // 7. Estadísticas
      const statsQuery = db.collection("users").doc(userId).collection("stats");
      const statsSnapshot = await statsQuery.get();
      statsSnapshot.docs.forEach(doc => {
        exportData.stats[doc.id] = doc.data();
      });

      logger.info("✅ Exportación completada", {
        userId,
        notebooksCount: exportData.notebooks.length,
        conceptsCount: exportData.concepts.length,
        sessionsCount: exportData.studySessions.length
      });

      return {
        success: true,
        data: exportData,
        summary: {
          notebooks: exportData.notebooks.length,
          concepts: exportData.concepts.length,
          studySessions: exportData.studySessions.length,
          learningData: exportData.learningData.length,
          quizResults: exportData.quizResults.length
        }
      };

    } catch (error: any) {
      logger.error("❌ Error exportando datos", {
        userId,
        error: error.message
      });

      throw new HttpsError(
        "internal",
        `Error exportando datos: ${error.message}`
      );
    }
  }
);

/**
 * Función para sincronizar usuarios escolares (profesores y estudiantes)
 * Reemplaza las funciones de syncSchoolUsers.ts del cliente
 */
export const syncSchoolUsers = onCall(
  {
    maxInstances: 5,
    timeoutSeconds: 300, // 5 minutos
    memory: "512MiB",
  },
  async (request) => {
    const { type = 'all', userId } = request.data; // type: 'all', 'teachers', 'students', 'specific'
    
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    logger.info("🔄 Iniciando sincronización de usuarios escolares", { type, userId });

    try {
      const db = getDb();
      
      const results = {
        teachers: { success: 0, errors: [] as Array<{ id: string; email: string; error: string }> },
        students: { success: 0, errors: [] as Array<{ id: string; email: string; error: string }> }
      };

      // Función auxiliar para validar email
      const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      // Función auxiliar para generar email válido
      const generateValidEmail = (nombre: string, id: string): string => {
        const cleanName = nombre
          .toLowerCase()
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 10);
        const uniqueId = id.substring(0, 6);
        return `${cleanName}.${uniqueId}@school.simonkey.com`;
      };

      // Función auxiliar para obtener password válido
      const getValidPassword = (originalPassword?: string): string => {
        if (originalPassword && originalPassword.length >= 6) {
          return originalPassword;
        }
        return 'school123';
      };

      // Función auxiliar para verificar si usuario existe
      const checkIfUserExists = async (userId: string): Promise<boolean> => {
        try {
          const userDoc = await db.collection("users").doc(userId).get();
          return userDoc.exists;
        } catch (error) {
          return false;
        }
      };

      // Función auxiliar para actualizar documento de usuario
      const updateUserDocument = async (userId: string, updates: any): Promise<void> => {
        await db.collection("users").doc(userId).set({
          ...updates,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      };

      // Sincronizar profesores
      if (type === 'all' || type === 'teachers') {
        logger.info("👨‍🏫 Sincronizando profesores...");
        
        let teachersSnapshot;
        if (type === 'specific' && userId) {
          const teacherDoc = await db.collection("schoolTeachers").doc(userId).get();
          teachersSnapshot = { docs: [teacherDoc] };
        } else {
          teachersSnapshot = await db.collection("schoolTeachers").get();
        }
        
        for (const teacherDoc of teachersSnapshot.docs) {
          const teacherData = teacherDoc.data();
          const teacherId = teacherDoc.id;
          
          if (!teacherData) {
            logger.warn(`⚠️ Datos de profesor vacíos para ID: ${teacherId}`);
            continue;
          }
          
          try {
            logger.info(`👨‍🏫 Procesando profesor: ${teacherData.nombre} (${teacherData.email})`);
            
            // Validar email y generar uno válido si es necesario
            let emailToUse = teacherData.email;
            if (!isValidEmail(teacherData.email)) {
              emailToUse = generateValidEmail(teacherData.nombre, teacherId);
              logger.info(`📧 Email inválido detectado. Usando: ${emailToUse}`);
            }
            
            // Obtener password válido
            const passwordToUse = getValidPassword(teacherData.password);
            
            // Verificar si ya existe como usuario
            const userExists = await checkIfUserExists(teacherId);
            
            if (userExists) {
              logger.info(`✅ Usuario ya existe en Firestore: ${emailToUse}`);
              await updateUserDocument(teacherId, {
                subscription: 'SCHOOL',
                schoolRole: 'TEACHER',
                nombre: teacherData.nombre,
                email: emailToUse,
                username: teacherData.nombre,
                displayName: teacherData.nombre
              });
              results.teachers.success++;
              continue;
            }
            
            // Crear documento en colección users
            await db.collection("users").doc(teacherId).set({
              id: teacherId,
              email: emailToUse,
              username: teacherData.nombre,
              nombre: teacherData.nombre,
              displayName: teacherData.nombre,
              birthdate: '',
              subscription: 'SCHOOL',
              schoolRole: 'TEACHER',
              notebookCount: 0,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              maxNotebooks: 999,
              maxConceptsPerNotebook: 999,
              canDeleteAndRecreate: false
            });
            
            // Actualizar el documento schoolTeachers
            await db.collection("schoolTeachers").doc(teacherId).set({
              ...teacherData,
              email: emailToUse,
              password: passwordToUse,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            logger.info(`✅ Profesor sincronizado: ${teacherData.nombre}`);
            results.teachers.success++;
            
          } catch (error: any) {
            logger.error(`❌ Error sincronizando profesor ${teacherData.email}:`, error);
            results.teachers.errors.push({
              id: teacherId,
              email: teacherData.email,
              error: error.message
            });
          }
        }
      }

      // Sincronizar estudiantes
      if (type === 'all' || type === 'students') {
        logger.info("👨‍🎓 Sincronizando estudiantes...");
        
        let studentsSnapshot;
        if (type === 'specific' && userId) {
          const studentDoc = await db.collection("schoolStudents").doc(userId).get();
          studentsSnapshot = { docs: [studentDoc] };
        } else {
          studentsSnapshot = await db.collection("schoolStudents").get();
        }
        
        for (const studentDoc of studentsSnapshot.docs) {
          const studentData = studentDoc.data();
          const studentId = studentDoc.id;
          
          if (!studentData) {
            logger.warn(`⚠️ Datos de estudiante vacíos para ID: ${studentId}`);
            continue;
          }
          
          try {
            logger.info(`👨‍🎓 Procesando estudiante: ${studentData.nombre} (${studentData.email})`);
            
            // Validar email y generar uno válido si es necesario
            let emailToUse = studentData.email;
            if (!isValidEmail(studentData.email)) {
              emailToUse = generateValidEmail(studentData.nombre, studentId);
              logger.info(`📧 Email inválido detectado. Usando: ${emailToUse}`);
            }
            
            // Obtener password válido
            const passwordToUse = getValidPassword(studentData.password);
            
            // Verificar si ya existe como usuario
            const userExists = await checkIfUserExists(studentId);
            
            if (userExists) {
              logger.info(`✅ Usuario ya existe en Firestore: ${emailToUse}`);
              await updateUserDocument(studentId, {
                subscription: 'SCHOOL',
                schoolRole: 'STUDENT',
                nombre: studentData.nombre,
                email: emailToUse,
                username: studentData.nombre,
                displayName: studentData.nombre
              });
              results.students.success++;
              continue;
            }
            
            // Crear documento en colección users
            await db.collection("users").doc(studentId).set({
              id: studentId,
              email: emailToUse,
              username: studentData.nombre,
              nombre: studentData.nombre,
              displayName: studentData.nombre,
              birthdate: '',
              subscription: 'SCHOOL',
              schoolRole: 'STUDENT',
              notebookCount: 0,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              maxNotebooks: 0,
              maxConceptsPerNotebook: 0,
              canDeleteAndRecreate: false
            });
            
            // Actualizar el documento schoolStudents
            await db.collection("schoolStudents").doc(studentId).set({
              ...studentData,
              email: emailToUse,
              password: passwordToUse,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            logger.info(`✅ Estudiante sincronizado: ${studentData.nombre}`);
            results.students.success++;
            
          } catch (error: any) {
            logger.error(`❌ Error sincronizando estudiante ${studentData.email}:`, error);
            results.students.errors.push({
              id: studentId,
              email: studentData.email,
              error: error.message
            });
          }
        }
      }

      const totalSuccess = results.teachers.success + results.students.success;
      const totalErrors = results.teachers.errors.length + results.students.errors.length;

      logger.info("🎉 Sincronización completada", {
        type,
        totalSuccess,
        totalErrors,
        results
      });

      return {
        success: true,
        message: `Sincronización completada. ${totalSuccess} exitosos, ${totalErrors} errores.`,
        results
      };

    } catch (error: any) {
      logger.error("❌ Error crítico durante sincronización", {
        type,
        error: error.message,
        stack: error.stack
      });

      throw new HttpsError(
        "internal",
        `Error durante sincronización: ${error.message}`,
        { type, error: error.message }
      );
    }
  }
);

/**
 * Función para crear usuarios escolares
 * Reemplaza createSchoolUser de utils
 */
export const createSchoolUser = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 60,
  },
  async (request) => {
    const { userData } = request.data;
    
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    logger.info("🔄 Creando usuario escolar", { userData });

    try {
      const db = getDb();
      
      // Validar datos requeridos
      if (!userData.email || !userData.nombre || !userData.role) {
        throw new HttpsError(
          "invalid-argument",
          "Datos requeridos: email, nombre, role"
        );
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw new HttpsError(
          "invalid-argument",
          "Email inválido"
        );
      }

      // Obtener password válido y detectar si es la contraseña por defecto
      const passwordToUse = userData.password && userData.password.length >= 6 
        ? userData.password 
        : 'school123';
      
      // Marcar si necesita cambiar contraseña (cuando usa la contraseña por defecto)
      const requiresPasswordChange = !userData.password || userData.password === 'school123';
      
      logger.info("🔐 Verificación de contraseña por defecto", {
        providedPassword: userData.password,
        usingDefaultPassword: passwordToUse === 'school123',
        requiresPasswordChange: requiresPasswordChange
      });

      // Crear usuario en Firebase Auth primero
      let authUser;
      try {
        authUser = await admin.auth().createUser({
          email: userData.email,
          password: passwordToUse,
          displayName: userData.nombre,
          emailVerified: false
        });
        logger.info("✅ Usuario creado en Firebase Auth", { uid: authUser.uid, email: userData.email });
      } catch (authError: any) {
        logger.error("❌ Error creando usuario en Auth", { error: authError.message });
        
        // Si el email ya existe, dar un mensaje más claro
        if (authError.code === 'auth/email-already-exists') {
          throw new HttpsError(
            "already-exists",
            `El email ${userData.email} ya está en uso. Por favor usa otro email o elimina el usuario existente desde Firebase Console.`
          );
        }
        
        throw new HttpsError(
          "already-exists",
          `Error creando usuario: ${authError.message}`
        );
      }

      // Usar el UID de Firebase Auth como userId
      const userId = authUser.uid;

      // Determinar el schoolRole basado en el role proporcionado
      logger.info("🎯 Role recibido:", { role: userData.role, tipo: typeof userData.role });
      
      let schoolRole: string;
      switch (userData.role) {
        case 'admin':
          schoolRole = 'admin';
          logger.info("✅ Asignando rol de admin");
          break;
        case 'teacher':
          schoolRole = 'teacher';
          logger.info("✅ Asignando rol de teacher");
          break;
        case 'student':
          schoolRole = 'student';
          logger.info("✅ Asignando rol de student");
          break;
        case 'tutor':
          schoolRole = 'tutor';
          logger.info("✅ Asignando rol de tutor");
          break;
        default:
          schoolRole = 'student';
          logger.warn("⚠️ Role no reconocido, asignando student por defecto", { role: userData.role });
      }

      // Crear documento solo en colección users
      await db.collection("users").doc(userId).set({
        id: userId,
        email: userData.email,
        username: userData.nombre,
        nombre: userData.nombre,
        displayName: userData.nombre,
        birthdate: '',
        subscription: 'school',
        schoolRole: schoolRole,
        notebookCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        maxNotebooks: userData.role === 'teacher' ? 999 : 0,
        maxConceptsPerNotebook: userData.role === 'teacher' ? 999 : 0,
        canDeleteAndRecreate: false,
        requiresPasswordChange: requiresPasswordChange,
        ...userData.additionalData
      });

      logger.info("✅ Usuario escolar creado exitosamente", { userId, email: userData.email });

      return {
        success: true,
        userId,
        message: `Usuario escolar creado: ${userData.nombre} (${userData.email})`
      };

    } catch (error: any) {
      logger.error("❌ Error creando usuario escolar", {
        userData,
        error: error.message
      });

      throw new HttpsError(
        "internal",
        `Error creando usuario escolar: ${error.message}`,
        { userData, error: error.message }
      );
    }
  }
);

/**
 * Función para arreglar usuarios huérfanos
 * Reemplaza fixOrphanUsers de utils
 */
export const fixOrphanUsers = onCall(
  {
    maxInstances: 5,
    timeoutSeconds: 120,
  },
  async (request) => {
    const { userId } = request.data;
    
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    logger.info("🔧 Arreglando usuarios huérfanos", { userId });

    try {
      const db = getDb();
      const auth = admin.auth();
      
      const results = {
        success: 0,
        errors: [] as Array<{ email: string; error: string }>
      };

      // Si se proporciona un userId específico, arreglar solo ese usuario
      if (userId) {
        try {
          const userRecord = await auth.getUser(userId);
          const userDoc = await db.collection("users").doc(userId).get();
          
          if (!userDoc.exists) {
            logger.info(`⚠️ Usuario ${userRecord.email} no existe en Firestore, creando...`);
            
            // Buscar en schoolTeachers
            const teachersQuery = db.collection("schoolTeachers").where("email", "==", userRecord.email);
            const teachersSnapshot = await teachersQuery.get();
            
            // Buscar en schoolStudents
            const studentsQuery = db.collection("schoolStudents").where("email", "==", userRecord.email);
            const studentsSnapshot = await studentsQuery.get();
            
            if (!teachersSnapshot.empty) {
              // Es un profesor escolar
              const teacherData = teachersSnapshot.docs[0].data();
              logger.info(`👨‍🏫 Encontrado en schoolTeachers: ${teacherData.nombre}`);
              
              await db.collection("users").doc(userId).set({
                id: userId,
                email: userRecord.email,
                username: teacherData.nombre,
                nombre: teacherData.nombre,
                displayName: teacherData.nombre,
                birthdate: '',
                subscription: 'SCHOOL',
                schoolRole: 'TEACHER',
                notebookCount: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                maxNotebooks: 999,
                maxConceptsPerNotebook: 999,
                canDeleteAndRecreate: false,
                emailVerified: true
              });
              
              logger.info(`✅ Usuario profesor creado en Firestore: ${userRecord.email}`);
              results.success++;
              
            } else if (!studentsSnapshot.empty) {
              // Es un estudiante escolar
              const studentData = studentsSnapshot.docs[0].data();
              logger.info(`👨‍🎓 Encontrado en schoolStudents: ${studentData.nombre}`);
              
              await db.collection("users").doc(userId).set({
                id: userId,
                email: userRecord.email,
                username: studentData.nombre,
                nombre: studentData.nombre,
                displayName: studentData.nombre,
                birthdate: '',
                subscription: 'SCHOOL',
                schoolRole: 'STUDENT',
                notebookCount: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                maxNotebooks: 0,
                maxConceptsPerNotebook: 0,
                canDeleteAndRecreate: false,
                emailVerified: true
              });
              
              logger.info(`✅ Usuario estudiante creado en Firestore: ${userRecord.email}`);
              results.success++;
              
            } else {
              // No encontrado en ninguna colección escolar, crear como usuario normal
              logger.info(`👤 Usuario no encontrado en colecciones escolares, creando como usuario normal`);
              
              await db.collection("users").doc(userId).set({
                id: userId,
                email: userRecord.email,
                username: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuario',
                nombre: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuario',
                displayName: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuario',
                birthdate: '',
                subscription: 'FREE',
                notebookCount: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                maxNotebooks: 3,
                maxConceptsPerNotebook: 10,
                canDeleteAndRecreate: false,
                emailVerified: true
              });
              
              logger.info(`✅ Usuario normal creado en Firestore: ${userRecord.email}`);
              results.success++;
            }
          } else {
            logger.info(`✅ Usuario ${userRecord.email} ya existe en Firestore`);
            results.success++;
          }
        } catch (error: any) {
          logger.error(`❌ Error arreglando usuario ${userId}:`, error);
          results.errors.push({
            email: userId,
            error: error.message
          });
        }
      } else {
        // Arreglar todos los usuarios (limitado a los últimos 100 para evitar timeouts)
        const listUsersResult = await auth.listUsers(100);
        
        for (const userRecord of listUsersResult.users) {
          try {
            const userDoc = await db.collection("users").doc(userRecord.uid).get();
            
            if (!userDoc.exists) {
              logger.info(`⚠️ Usuario huérfano detectado: ${userRecord.email}`);
              
              // Buscar en colecciones escolares
              const teachersQuery = db.collection("schoolTeachers").where("email", "==", userRecord.email);
              const teachersSnapshot = await teachersQuery.get();
              
              const studentsQuery = db.collection("schoolStudents").where("email", "==", userRecord.email);
              const studentsSnapshot = await studentsQuery.get();
              
              if (!teachersSnapshot.empty) {
                const teacherData = teachersSnapshot.docs[0].data();
                await db.collection("users").doc(userRecord.uid).set({
                  id: userRecord.uid,
                  email: userRecord.email,
                  username: teacherData.nombre,
                  nombre: teacherData.nombre,
                  displayName: teacherData.nombre,
                  birthdate: '',
                  subscription: 'SCHOOL',
                  schoolRole: 'TEACHER',
                  notebookCount: 0,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  maxNotebooks: 999,
                  maxConceptsPerNotebook: 999,
                  canDeleteAndRecreate: false,
                  emailVerified: true
                });
                results.success++;
              } else if (!studentsSnapshot.empty) {
                const studentData = studentsSnapshot.docs[0].data();
                await db.collection("users").doc(userRecord.uid).set({
                  id: userRecord.uid,
                  email: userRecord.email,
                  username: studentData.nombre,
                  nombre: studentData.nombre,
                  displayName: studentData.nombre,
                  birthdate: '',
                  subscription: 'SCHOOL',
                  schoolRole: 'STUDENT',
                  notebookCount: 0,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  maxNotebooks: 0,
                  maxConceptsPerNotebook: 0,
                  canDeleteAndRecreate: false,
                  emailVerified: true
                });
                results.success++;
              } else {
                await db.collection("users").doc(userRecord.uid).set({
                  id: userRecord.uid,
                  email: userRecord.email,
                  username: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuario',
                  nombre: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuario',
                  displayName: userRecord.displayName || userRecord.email?.split('@')[0] || 'Usuario',
                  birthdate: '',
                  subscription: 'FREE',
                  notebookCount: 0,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  maxNotebooks: 3,
                  maxConceptsPerNotebook: 10,
                  canDeleteAndRecreate: false,
                  emailVerified: true
                });
                results.success++;
              }
            }
          } catch (error: any) {
            logger.error(`❌ Error arreglando usuario ${userRecord.email}:`, error);
            results.errors.push({
              email: userRecord.email || '',
              error: error.message
            });
          }
        }
      }

      logger.info("🎉 Reparación de usuarios huérfanos completada", results);

      return {
        success: true,
        message: `Reparación completada. ${results.success} exitosos, ${results.errors.length} errores.`,
        results
      };

    } catch (error: any) {
      logger.error("❌ Error crítico durante reparación de usuarios", {
        userId,
        error: error.message,
        stack: error.stack
      });

      throw new HttpsError(
        "internal",
        `Error durante reparación: ${error.message}`,
        { userId, error: error.message }
      );
    }
  }
);

/**
 * Función para migrar usuarios existentes
 * Reemplaza migrateUsers de utils
 */
export const migrateUsers = onCall(
  {
    maxInstances: 5,
    timeoutSeconds: 300, // 5 minutos
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    logger.info("🔄 Iniciando migración de usuarios existentes...");

    try {
      const db = getDb();
      
      let updatedCount = 0;
      let errorCount = 0;

      // Función para determinar tipo de suscripción
      const determineUserSubscription = (email: string): string => {
        if (email === 'ruben.elhore@gmail.com') return 'SUPER_ADMIN';
        if (email?.includes('school.simonkey.com')) return 'SCHOOL';
        if (email?.includes('pro') || email?.includes('premium')) return 'PRO';
        return 'FREE';
      };

      // Obtener todos los usuarios
      const usersSnapshot = await db.collection("users").get();
      
      for (const userDoc of usersSnapshot.docs) {
        try {
          const userData = userDoc.data();
          
          // Verificar si ya tiene el campo subscription
          if (!userData.subscription) {
            const subscriptionType = determineUserSubscription(userData.email);
            
            // Actualizar el documento del usuario
            await db.collection("users").doc(userDoc.id).update({
              subscription: subscriptionType,
              maxNotebooks: subscriptionType === 'FREE' ? 4 : -1,
              maxConceptsPerNotebook: subscriptionType === 'FREE' || subscriptionType === 'PRO' ? 100 : -1,
              notebooksCreatedThisWeek: 0,
              conceptsCreatedThisWeek: 0,
              weekStartDate: new Date()
            });
            
            logger.info(`Usuario ${userData.email} migrado a tipo: ${subscriptionType}`);
            updatedCount++;
          } else {
            logger.info(`Usuario ${userData.email} ya tiene tipo: ${userData.subscription}`);
          }
        } catch (error: any) {
          logger.error(`Error migrando usuario ${userDoc.id}:`, error);
          errorCount++;
        }
      }
      
      logger.info(`🎉 Migración completada. Usuarios actualizados: ${updatedCount}, Errores: ${errorCount}`);

      return {
        success: true,
        message: `Migración completada. ${updatedCount} usuarios actualizados, ${errorCount} errores.`,
        updatedCount,
        errorCount
      };

    } catch (error: any) {
      logger.error("❌ Error en la migración:", error);

      throw new HttpsError(
        "internal",
        `Error en la migración: ${error.message}`,
        { error: error.message }
      );
    }
  }
);

// =============================================================================
// CLOUD FUNCTIONS CON TRIGGERS DE FIRESTORE - AUTOMACIÓN
// =============================================================================

/**
 * TRIGGER: Eliminación automática de cuentas de Firebase Auth
 * 
 * Esta función se ejecuta automáticamente cuando se crea un documento en la colección 'userDeletions'
 * Elimina la cuenta de Firebase Auth correspondiente, completando el proceso de eliminación iniciado
 * por los super admins desde el frontend.
 * 
 * Beneficios:
 * - Automatiza la eliminación completa de usuarios
 * - Garantiza que usuarios eliminados no puedan reingresar
 * - Centraliza la lógica de eliminación en el backend
 * - Mejora la seguridad y consistencia del sistema
 */
export const onUserDeletionCreated = onDocumentCreated(
  {
    document: 'userDeletions/{userId}',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 300
  },
  async (event) => {
    const userId = event.params.userId;
    const deletionData = event.data?.data();
    
    logger.info("🗑️ Procesando eliminación automática de usuario", { 
      userId, 
      deletionData 
    });

    try {
      const db = getDb();
      const auth = admin.auth();

      // Verificar que el documento tiene la información necesaria
      if (!deletionData || deletionData.status === 'completed') {
        logger.info("ℹ️ Eliminación ya procesada o datos inválidos", { userId });
        return null;
      }

      // Actualizar estado a 'processing'
      await event.data?.ref.update({
        status: 'processing',
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      let authDeleted = false;
      let error = null;

      try {
        // Verificar si el usuario existe en Firebase Auth
        await auth.getUser(userId);
        
        // Eliminar cuenta de Firebase Auth
        await auth.deleteUser(userId);
        authDeleted = true;
        
        logger.info("✅ Cuenta de Firebase Auth eliminada automáticamente", { userId });
        
      } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
          logger.info("ℹ️ Usuario ya no existe en Firebase Auth", { userId });
          authDeleted = true; // Ya no existe, misión cumplida
        } else {
          error = authError.message;
          logger.error("❌ Error eliminando cuenta de Firebase Auth", { 
            userId, 
            error: authError.message 
          });
        }
      }

      // Actualizar el documento con el resultado
      await event.data?.ref.update({
        status: authDeleted ? 'completed' : 'failed',
        authAccountDeleted: authDeleted,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        autoProcessingError: error,
        processedBy: 'automatic-trigger'
      });

      if (authDeleted) {
        logger.info("🎉 Eliminación automática completada exitosamente", { userId });
      } else {
        logger.error("❌ Eliminación automática falló", { userId, error });
      }

      return null;

    } catch (error: any) {
      logger.error("❌ Error crítico en eliminación automática", {
        userId,
        error: error.message,
        stack: error.stack
      });

      // Actualizar estado a fallido
      try {
        await event.data?.ref.update({
          status: 'failed',
          autoProcessingError: error.message,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        logger.error("❌ Error actualizando estado de eliminación fallida", { 
          userId, 
          updateError 
        });
      }

      return null;
    }
  });

/**
 * TRIGGER: Creación automática de perfil en Firestore para nuevos usuarios de Auth
 * 
 * Esta función se ejecuta cuando se crea un nuevo usuario en Firebase Auth
 * Genera automáticamente su perfil en Firestore con la configuración inicial apropiada
 * 
 * Beneficios:
 * - Garantiza que todos los usuarios tengan un perfil en Firestore
 * - Automatiza la configuración inicial de usuarios
 * - Evita cuentas "huérfanas" en Firebase Auth
 * - Establece límites y configuraciones por defecto
 */
// Temporarily using v1 for Auth triggers until v2 identity triggers are properly supported
// TODO: Migrate to v2 when Firebase CLI supports it
export const onAuthUserCreated = functions
  .region('us-central1')
  .runWith({
    memory: '256MB',
    timeoutSeconds: 300
  })
  .auth.user().onCreate(async (user) => {
    const userId = user.uid;
    const email = user.email;
  
  logger.info("👤 Nuevo usuario creado en Firebase Auth, verificando si necesita perfil en Firestore", { 
    userId, 
    email 
  });

  try {
    const db = getDb();

    // Verificar si ya existe el perfil (por seguridad)
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists) {
      logger.info("ℹ️ Perfil de usuario ya existe en Firestore", { userId, email });
      return null;
    }

    // VERIFICACIÓN CRÍTICA: Buscar si ya existe un usuario escolar con el mismo email
    if (email) {
      logger.info("🔍 Verificando si existe usuario escolar con el mismo email", { email });
      
      // Buscar en colección users por email (tanto en campo email como googleAuthEmail)
      const existingUsersQuery = db.collection("users").where("email", "==", email);
      const existingUsersSnapshot = await existingUsersQuery.get();
      
      // También buscar por googleAuthEmail
      const existingUsersByGoogleEmailQuery = db.collection("users").where("googleAuthEmail", "==", email);
      const existingUsersByGoogleEmailSnapshot = await existingUsersByGoogleEmailQuery.get();
      
      if (!existingUsersSnapshot.empty || !existingUsersByGoogleEmailSnapshot.empty) {
        const existingUser = !existingUsersSnapshot.empty 
          ? existingUsersSnapshot.docs[0] 
          : existingUsersByGoogleEmailSnapshot.docs[0];
        const existingUserData = existingUser.data();
        
        logger.warn("⚠️ Usuario existente encontrado con el mismo email", { 
          existingUserId: existingUser.id,
          newUserId: userId,
          email,
          existingUserType: existingUserData.subscription
        });
        
        // Si el usuario existente es escolar, NO crear nuevo perfil
        if (existingUserData.subscription === 'SCHOOL' || existingUserData.subscription === 'school') {
          logger.info("🚫 Usuario escolar existente detectado, NO creando perfil duplicado", { 
            existingUserId: existingUser.id,
            newUserId: userId,
            email,
            subscription: existingUserData.subscription
          });
          
          // En su lugar, actualizar el usuario existente con el nuevo UID de Google Auth
          await db.collection("users").doc(existingUser.id).update({
            googleAuthUid: userId,
            googleAuthEmail: email,
            googleAuthDisplayName: user.displayName,
            googleAuthPhotoURL: user.photoURL,
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          logger.info("✅ Usuario escolar existente vinculado con nuevo UID de Google Auth", { 
            existingUserId: existingUser.id,
            newUserId: userId 
          });
          
          return null;
        }
      }
      
      // Buscar en colecciones escolares específicas
      const teachersQuery = db.collection("schoolTeachers").where("email", "==", email);
      const teachersSnapshot = await teachersQuery.get();
      
      const studentsQuery = db.collection("schoolStudents").where("email", "==", email);
      const studentsSnapshot = await studentsQuery.get();

      if (!teachersSnapshot.empty || !studentsSnapshot.empty) {
        logger.info("👨‍🎓 Usuario escolar detectado en colecciones escolares", { 
          email,
          isTeacher: !teachersSnapshot.empty,
          isStudent: !studentsSnapshot.empty
        });
        
        // Para usuarios escolares, NO crear perfil automáticamente
        // El frontend se encargará de la vinculación
        logger.info("🚫 Usuario escolar detectado, NO creando perfil automático", { email });
        return null;
      }
    }

    // Determinar tipo de usuario y configuración
    let userType = 'FREE';
    let maxNotebooks = 3;
    let maxConceptsPerNotebook = 10;
    let schoolRole = null;

    // Verificar si es un usuario escolar (solo para casos no detectados anteriormente)
    if (email) {
      if (email === 'ruben.elhore@gmail.com') {
        userType = 'SUPER_ADMIN';
        maxNotebooks = 999;
        maxConceptsPerNotebook = 999;
        logger.info("👑 Usuario identificado como super admin", { userId, email });
      }
    }

    // Crear perfil de usuario en Firestore
    const userProfile = {
      id: userId,
      email: email || '',
      username: user.displayName || email?.split('@')[0] || 'Usuario',
      nombre: user.displayName || email?.split('@')[0] || 'Usuario',
      displayName: user.displayName || email?.split('@')[0] || 'Usuario',
      birthdate: '',
      subscription: userType,
      schoolRole: schoolRole,
      notebookCount: 0,
      maxNotebooks: maxNotebooks,
      maxConceptsPerNotebook: maxConceptsPerNotebook,
      canDeleteAndRecreate: false,
      emailVerified: user.emailVerified || false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      
      // Configuraciones adicionales
      notebooksCreatedThisWeek: 0,
      conceptsCreatedThisWeek: 0,
      weekStartDate: new Date(),
      
      // Metadatos de creación automática
      autoCreated: true,
      autoCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
      autoCreatedBy: 'auth-trigger'
    };

    await db.collection("users").doc(userId).set(userProfile);
    
    logger.info("✅ Perfil de usuario creado automáticamente en Firestore", { 
      userId, 
      email, 
      userType,
      schoolRole
    });

    // Crear estadísticas iniciales del usuario
    try {
      await db.collection("users").doc(userId).collection("stats").doc("summary").set({
        totalNotebooks: 0,
        totalConcepts: 0,
        masteredConcepts: 0,
        totalStudyTimeMinutes: 0,
        completedSessions: 0,
        currentStreak: 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        autoCreated: true
      });
      
      logger.info("✅ Estadísticas iniciales creadas automáticamente", { userId });
    } catch (statsError) {
      logger.error("⚠️ Error creando estadísticas iniciales", { userId, statsError });
    }

    // Registrar actividad de creación
    try {
      await db.collection("userActivities").add({
        userId: userId,
        type: 'user_created',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          userType: userType,
          schoolRole: schoolRole,
          autoCreated: true,
          email: email
        }
      });
      
      logger.info("✅ Actividad de creación registrada", { userId });
    } catch (activityError) {
      logger.error("⚠️ Error registrando actividad", { userId, activityError });
    }

    return null;

  } catch (error: any) {
    logger.error("❌ Error crítico creando perfil automático de usuario", {
      userId,
      email,
      error: error.message,
      stack: error.stack
    });

    // No lanzar error para evitar bloquear la creación de la cuenta en Auth
    return null;
  }
});

/**
 * TRIGGER: Inicialización automática cuando se crea un perfil de usuario en Firestore
 * 
 * Esta función se ejecuta cuando se crea un documento en la colección 'users'
 * Realiza tareas de inicialización y configuración adicional
 * 
 * Beneficios:
 * - Automatiza la configuración de nuevos usuarios
 * - Garantiza consistencia en la inicialización
 * - Realiza tareas de preparación del entorno del usuario
 */
export const onUserProfileCreated = onDocumentCreated(
  {
    document: 'users/{userId}',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 300
  },
  async (event) => {
    const userId = event.params.userId;
    const userData = event.data?.data();
    
    logger.info("👤 Nuevo perfil de usuario creado, inicializando configuraciones", { 
      userId, 
      email: userData.email,
      subscription: userData.subscription 
    });

    try {
      const db = getDb();

      // Crear configuraciones predeterminadas del usuario
      const defaultSettings = {
        theme: 'system',
        language: 'es',
        notifications: {
          email: true,
          push: true,
          studyReminders: true,
          weeklyReports: true
        },
        privacy: {
          shareStats: false,
          shareProgress: false
        },
        study: {
          defaultStudyTime: 25, // minutos
          autoPlay: false,
          showHints: true
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        autoCreated: true
      };

      await db.collection("users").doc(userId).collection("settings").doc("preferences").set(defaultSettings);
      logger.info("✅ Configuraciones predeterminadas creadas", { userId });

      // Crear límites de usuario basados en su suscripción
      const limits = {
        maxNotebooks: userData.maxNotebooks || 3,
        maxConceptsPerNotebook: userData.maxConceptsPerNotebook || 10,
        maxStudySessionsPerDay: userData.subscription === 'FREE' ? 5 : -1,
        maxExportsPerWeek: userData.subscription === 'FREE' ? 1 : -1,
        canCreatePublicNotebooks: userData.subscription !== 'FREE',
        canUseAdvancedFeatures: userData.subscription === 'PRO' || userData.subscription === 'SUPER_ADMIN',
        resetDate: admin.firestore.FieldValue.serverTimestamp(),
        autoCreated: true
      };

      await db.collection("users").doc(userId).collection("limits").doc("current").set(limits);
      logger.info("✅ Límites de usuario configurados", { userId, limits });

      // Si es un usuario escolar, crear configuraciones específicas
      if (userData.subscription === 'SCHOOL') {
        const schoolConfig = {
          role: userData.schoolRole,
          canCreateNotebooks: userData.schoolRole === 'TEACHER',
          canViewAllStudents: userData.schoolRole === 'TEACHER',
          canExportData: userData.schoolRole === 'TEACHER',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("users").doc(userId).collection("school").doc("config").set(schoolConfig);
        logger.info("✅ Configuración escolar creada", { userId, schoolConfig });
      }

      // Crear documento de progreso inicial
      const initialProgress = {
        level: 1,
        experience: 0,
        badges: [],
        achievements: [],
        streakRecord: 0,
        totalStudyDays: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("users").doc(userId).collection("progress").doc("current").set(initialProgress);
      logger.info("✅ Progreso inicial configurado", { userId });

      logger.info("🎉 Inicialización de usuario completada exitosamente", { 
        userId, 
        email: userData.email 
      });

      return null;

    } catch (error: any) {
      logger.error("❌ Error en inicialización automática de usuario", {
        userId,
        userData: userData,
        error: error.message,
        stack: error.stack
      });

      // No lanzar error para evitar bloquear otras operaciones
      return null;
    }
  });

/**
 * TRIGGER: Limpieza automática cuando se elimina un notebook
 * 
 * Esta función se ejecuta cuando se elimina un documento de la colección 'notebooks'
 * Limpia automáticamente todos los conceptos y datos relacionados
 * 
 * Beneficios:
 * - Mantiene la base de datos limpia automáticamente
 * - Evita datos huérfanos y referencias rotas
 * - Optimiza el rendimiento eliminando datos innecesarios
 */
export const onNotebookDeleted = onDocumentDeleted(
  {
    document: 'notebooks/{notebookId}',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 300
  },
  async (event) => {
    const notebookId = event.params.notebookId;
    const notebookData = event.data?.data();
    
    logger.info("📚 Notebook eliminado, iniciando limpieza automática", { 
      notebookId, 
      userId: notebookData.userId,
      title: notebookData.title 
    });

    try {
      const db = getDb();
      let deletedItems = {
        concepts: 0,
        studySessions: 0,
        conceptStats: 0,
        reviewConcepts: 0
      };

      // 1. Eliminar todos los conceptos relacionados con este notebook
      try {
        const conceptsQuery = db.collection("conceptos").where("cuadernoId", "==", notebookId);
        const conceptsSnapshot = await conceptsQuery.get();
        
        const batch = db.batch();
        conceptsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedItems.concepts++;
        });
        await batch.commit();
        
        logger.info(`✅ Eliminados ${deletedItems.concepts} conceptos`, { notebookId });
      } catch (error) {
        logger.error("❌ Error eliminando conceptos", { notebookId, error });
      }

      // 2. Eliminar sesiones de estudio relacionadas
      try {
        const sessionsQuery = db.collection("studySessions")
          .where("notebookId", "==", notebookId);
        const sessionsSnapshot = await sessionsQuery.get();
        
        const batch = db.batch();
        sessionsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedItems.studySessions++;
        });
        await batch.commit();
        
        logger.info(`✅ Eliminadas ${deletedItems.studySessions} sesiones de estudio`, { notebookId });
      } catch (error) {
        logger.error("❌ Error eliminando sesiones de estudio", { notebookId, error });
      }

      // 3. Eliminar estadísticas de conceptos relacionadas
      try {
        const statsQuery = db.collection("conceptStats")
          .where("notebookId", "==", notebookId);
        const statsSnapshot = await statsQuery.get();
        
        const batch = db.batch();
        statsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedItems.conceptStats++;
        });
        await batch.commit();
        
        logger.info(`✅ Eliminadas ${deletedItems.conceptStats} estadísticas de conceptos`, { notebookId });
      } catch (error) {
        logger.error("❌ Error eliminando estadísticas", { notebookId, error });
      }

      // 4. Eliminar conceptos de repaso relacionados
      try {
        const reviewQuery = db.collection("reviewConcepts")
          .where("notebookId", "==", notebookId);
        const reviewSnapshot = await reviewQuery.get();
        
        const batch = db.batch();
        reviewSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedItems.reviewConcepts++;
        });
        await batch.commit();
        
        logger.info(`✅ Eliminados ${deletedItems.reviewConcepts} conceptos de repaso`, { notebookId });
      } catch (error) {
        logger.error("❌ Error eliminando conceptos de repaso", { notebookId, error });
      }

      // 5. Actualizar contador de notebooks del usuario
      if (notebookData.userId) {
        try {
          const userRef = db.collection("users").doc(notebookData.userId);
          await userRef.update({
            notebookCount: admin.firestore.FieldValue.increment(-1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          logger.info("✅ Contador de notebooks actualizado", { 
            userId: notebookData.userId, 
            notebookId 
          });
        } catch (error) {
          logger.error("❌ Error actualizando contador de notebooks", { 
            userId: notebookData.userId, 
            notebookId, 
            error 
          });
        }
      }

      // 6. Registrar actividad de eliminación
      try {
        await db.collection("userActivities").add({
          userId: notebookData.userId,
          type: 'notebook_deleted',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          metadata: {
            notebookId: notebookId,
            notebookTitle: notebookData.title,
            deletedItems: deletedItems,
            autoCleanup: true
          }
        });
        
        logger.info("✅ Actividad de eliminación registrada", { notebookId });
      } catch (error) {
        logger.error("❌ Error registrando actividad", { notebookId, error });
      }

      const totalDeleted = Object.values(deletedItems).reduce((sum, count) => sum + count, 0);
      
      logger.info("🎉 Limpieza automática de notebook completada", { 
        notebookId, 
        totalDeleted,
        deletedItems 
      });

      return null;

    } catch (error: any) {
      logger.error("❌ Error crítico en limpieza automática de notebook", {
        notebookId,
        error: error.message,
        stack: error.stack
      });

      return null;
    }
  });

/**
 * 🔒 FUNCIONES SEGURAS DE GEMINI API
 * 
 * Estas funciones manejan todas las llamadas a Gemini API de forma segura desde el backend
 * Protegen las claves API y implementan límites de uso por tipo de suscripción
 */

/**
 * Genera conceptos a partir de un archivo de texto
 * Función segura que reemplaza la llamada directa desde el frontend
 */
export const generateConceptsFromFile = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 300,
    memory: "2GiB",
    secrets: ["GEMINI_API_KEY"]
  },
  async (request) => {
    // Verificar autenticación
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { fileContent, notebookId, fileName, isSchoolNotebook = false, fileType = 'text', materialId } = request.data;
    const userId = request.auth.uid;

    // Validar tamaño del archivo (máximo 50MB en base64)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (fileContent && fileContent.length > MAX_FILE_SIZE) {
      throw new HttpsError(
        "invalid-argument", 
        `El archivo es demasiado grande. Tamaño máximo permitido: 50MB`
      );
    }

    logger.info("🤖 Generando conceptos desde archivo", {
      userId,
      notebookId,
      fileName,
      isSchoolNotebook,
      fileType,
      materialId,
      contentLength: fileContent?.length || 0,
      sizeMB: fileContent ? (fileContent.length / 1024 / 1024).toFixed(2) : 0
    });

    try {
      const db = getDb();
      
      // Verificar límites de uso
      let userDoc = await db.collection("users").doc(userId).get();
      let userData;
      let actualUserId = userId; // Para tracking del ID real usado
      
      if (!userDoc.exists) {
        // Si no se encuentra por UID, buscar por email para usuarios escolares
        logger.info("🔍 Usuario no encontrado por UID, buscando por email", { userId });
        
        const userEmail = request.auth?.token?.email;
        if (userEmail) {
          const usersQuery = await db.collection("users")
            .where("email", "==", userEmail)
            .limit(1)
            .get();
          
          if (!usersQuery.empty) {
            userDoc = usersQuery.docs[0];
            userData = userDoc.data();
            actualUserId = userDoc.id; // Usar el ID del documento encontrado
            logger.info("✅ Usuario escolar encontrado por email", { 
              originalUid: userId,
              documentId: actualUserId,
              email: userEmail,
              schoolRole: userData?.schoolRole 
            });
          } else {
            throw new HttpsError("not-found", "Usuario no encontrado");
          }
        } else {
          throw new HttpsError("not-found", "Usuario no encontrado");
        }
      } else {
        userData = userDoc.data();
      }
      
      logger.info("👤 Datos del usuario obtenidos", {
        userId,
        userData: {
          subscriptionType: userData?.subscriptionType,
          subscription: userData?.subscription,
          email: userData?.email,
          schoolRole: userData?.schoolRole
        }
      });
      
      let subscriptionType = (userData?.subscriptionType || userData?.subscription || "FREE") as string;
      
      logger.info("📋 Tipo de suscripción determinado", {
        userId,
        subscriptionType,
        source: userData?.subscriptionType ? 'subscriptionType' : userData?.subscription ? 'subscription' : 'default'
      });
      
      // Mapear "school" a "SCHOOL" si es necesario
      if (subscriptionType === "school") {
        subscriptionType = "SCHOOL";
        logger.info("🏫 Tipo de suscripción mapeado de 'school' a 'SCHOOL'", { userId });
      }
      
      const limits = getSubscriptionLimits(subscriptionType);

      // Verificar límite diario (usar actualUserId para usuarios escolares)
      const today = new Date().toISOString().split('T')[0];
      const usageRef = db.collection("users").doc(actualUserId).collection("geminiUsage").doc(today);
      const usageDoc = await usageRef.get();
      
      const currentUsage = usageDoc.exists ? usageDoc.data()?.count || 0 : 0;
      if (currentUsage >= limits.dailyGeminiCalls) {
        throw new HttpsError(
          "resource-exhausted", 
          `Límite diario alcanzado (${limits.dailyGeminiCalls} llamadas). Actualiza a PRO para más llamadas.`
        );
      }

      // Obtener clave API desde variables de entorno (Firebase Functions v2)
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new HttpsError("internal", "Configuración de API no disponible");
      }

      // Inicializar Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Determinar el tipo MIME basado en el nombre del archivo
      const getMimeType = (filename: string): string => {
        const ext = filename.toLowerCase().split('.').pop();
        switch (ext) {
          case 'pdf': return 'application/pdf';
          case 'txt': return 'text/plain';
          case 'doc': return 'application/msword';
          case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          case 'jpg':
          case 'jpeg': return 'image/jpeg';
          case 'png': return 'image/png';
          case 'gif': return 'image/gif';
          case 'webp': return 'image/webp';
          default: return 'text/plain';
        }
      };

      const mimeType = getMimeType(fileName || '');
      logger.info("📄 Tipo MIME detectado", { fileName, mimeType });

      // Prompt optimizado para extraer conceptos educativos
      const prompt = `
Eres un experto creando tarjetas de estudio efectivas. Analiza el documento y extrae los conceptos clave.

## REGLAS DE EXTRACCIÓN  

1. **Descarta las preguntas**  
   - Ignora cualquier línea que contenga "¿" o "?"  
   - Ignora frases que empiecen con palabras interrogativas (qué, cuál, quién, dónde, cuándo, por qué, how, who, what, which).

2. **Identifica la respuesta** (concepto) y su explicación breve.  

3. **Límites de longitud**  
   - **Término** ≤ 50 caracteres, sin signos de puntuación salvo tildes.  
   - **Definición** ≤ 200 caracteres, clara y concisa.  
   - Si la explicación excede el límite, simplifícala conservando el sentido.

4. **Independencia término‑definición**  
   - El término no debe aparecer en la definición ni la definición en el término.

5. **Elimina duplicados y cruces**  
   - Al finalizar, analiza el json. ELIMINA las tarjetas que tengan el mismo término o definición. OJO: Lee bien, si ves que dos json se parecen, quedate con el primero.

6. **Idioma**  
   - Mantén término y definición en el idioma original del documento.

## FORMATO DE RESPUESTA:
Responde ÚNICAMENTE con este JSON válido:

{
  "conceptos": [
    {
      "termino": "Nombre simple del concepto",
      "definicion": "Explicación clara y concisa",
    }
  ]
}
`;

      let result;
      
      // Si es un archivo (PDF, imagen, etc.), usar la funcionalidad de archivos de Gemini
      if (fileType === 'file' && fileContent) {
        try {
          // Convertir base64 a buffer
          const fileBuffer = Buffer.from(fileContent, 'base64');
          
          // Para archivos muy grandes, considerar procesar solo una parte
          const fileSizeMB = fileBuffer.length / 1024 / 1024;
          logger.info("📏 Tamaño del archivo", { 
            fileName, 
            sizeMB: fileSizeMB.toFixed(2),
            sizeBytes: fileBuffer.length
          });
          
          // Si el archivo es muy grande (>10MB), advertir
          if (fileSizeMB > 10) {
            logger.warn("⚠️ Archivo grande detectado", { 
              fileName, 
              sizeMB: fileSizeMB.toFixed(2),
              warning: "El procesamiento puede tardar más tiempo"
            });
          }
          
          // Crear el archivo para Gemini
          const fileData = {
            inlineData: {
              data: fileContent,
              mimeType: mimeType
            }
          };
          
          logger.info("📁 Procesando archivo con Gemini", { 
            fileName, 
            mimeType, 
            fileSize: fileBuffer.length,
            timestamp: new Date().toISOString()
          });
          
          // Para archivos grandes, usar configuración más conservadora
          if (fileSizeMB > 10) {
            result = await model.generateContent([prompt, fileData]);
          } else {
            result = await model.generateContent([prompt, fileData]);
          }
          
          logger.info("✅ Archivo procesado exitosamente", { 
            fileName,
            processingTime: new Date().toISOString()
          });
        } catch (fileError: any) {
          logger.error("❌ Error procesando archivo con Gemini", { 
            error: fileError.message,
            errorCode: fileError.code,
            errorDetails: fileError.details,
            fileName,
            fileType,
            mimeType
          });
          
          // Proporcionar mensajes de error más específicos
          if (fileError.message?.includes('timeout')) {
            throw new HttpsError("deadline-exceeded", "El archivo es muy grande y tardó demasiado en procesarse. Intenta con un archivo más pequeño.");
          } else if (fileError.message?.includes('size')) {
            throw new HttpsError("invalid-argument", "El archivo excede el tamaño máximo permitido por el servicio de IA.");
          } else {
            throw new HttpsError("internal", `Error procesando archivo: ${fileError.message}`);
          }
        }
      } else {
        // Procesar como texto plano (fallback)
        logger.info("📝 Procesando como texto plano", { contentLength: fileContent?.length });
        result = await model.generateContent(prompt + `\n\nCONTENIDO A ANALIZAR:\n${fileContent}`);
      }

      const response = await result.response;
      const text = response.text();

      // Log de la respuesta de Gemini para debugging
      logger.info("🤖 Respuesta de Gemini", {
        userId,
        responseLength: text.length,
        responsePreview: text.substring(0, 500) + "..."
      });

      // Parsear respuesta JSON
      let concepts;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          logger.error("❌ No se encontró JSON válido en la respuesta", { text });
          throw new Error("No se encontró JSON válido en la respuesta");
        }
        concepts = JSON.parse(jsonMatch[0]);
        logger.info("✅ JSON parseado correctamente", { concepts });
      } catch (parseError) {
        logger.error("❌ Error parseando respuesta de Gemini", { error: parseError, text });
        
        // Intento de respaldo: buscar conceptos en el texto
        logger.info("🔄 Intentando extracción de respaldo...");
        const fallbackConcepts = extractConceptsFromText(text);
        if (fallbackConcepts.length > 0) {
          concepts = { conceptos: fallbackConcepts };
          logger.info("✅ Conceptos extraídos con método de respaldo", { concepts });
        } else {
          throw new HttpsError("internal", "Error procesando respuesta de IA");
        }
      }

      // Validar y limitar conceptos
      const validConcepts = concepts.conceptos?.slice(0, limits.maxConceptsPerFile) || [];
      
      logger.info("📊 Conceptos extraídos", {
        userId,
        totalConcepts: concepts.conceptos?.length || 0,
        validConcepts: validConcepts.length,
        concepts: validConcepts
      });

      // Actualizar contador de uso
      await usageRef.set({
        count: currentUsage + 1,
        lastUsed: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Guardar conceptos en la colección correspondiente
      const conceptIds: string[] = [];
      const batch = db.batch();
      
      if (isSchoolNotebook) {
        // Guardar en schoolConcepts
        const schoolConceptRef = db.collection("schoolConcepts").doc();
        const conceptData = {
          cuadernoId: notebookId,
          usuarioId: actualUserId, // Usar actualUserId para usuarios escolares
          conceptos: validConcepts.map((concept: any, index: number) => ({
            id: `${schoolConceptRef.id}_${index}`,
            término: concept.termino,
            definición: concept.definicion,
            fuente: fileName || 'Archivo subido',
            ejemplos: concept.ejemplos || [],
            importancia: concept.importancia || '',
            materialId: materialId || null
          })),
          creadoEn: admin.firestore.FieldValue.serverTimestamp()
        };
        
        batch.set(schoolConceptRef, conceptData);
        conceptIds.push(schoolConceptRef.id);
        
        logger.info("✅ Conceptos guardados en schoolConcepts", {
          conceptCount: validConcepts.length,
          conceptIds,
          materialId: materialId || 'no-material'
        });
      } else {
        // Guardar en conceptos (colección normal)
        const conceptRef = db.collection("conceptos").doc();
        const conceptData = {
          cuadernoId: notebookId,
          usuarioId: userId,
          conceptos: validConcepts.map((concept: any, index: number) => ({
            id: `${conceptRef.id}_${index}`,
            término: concept.termino,
            definición: concept.definicion,
            fuente: fileName || 'Archivo subido',
            ejemplos: concept.ejemplos || [],
            importancia: concept.importancia || '',
            materialId: materialId || null
          })),
          creadoEn: admin.firestore.FieldValue.serverTimestamp()
        };
        
        batch.set(conceptRef, conceptData);
        conceptIds.push(conceptRef.id);
        
        logger.info("✅ Conceptos guardados en conceptos", {
          conceptCount: validConcepts.length,
          conceptIds,
          materialId: materialId || 'no-material'
        });
      }

      await batch.commit();

      // Registrar actividad
      await db.collection("userActivities").add({
        userId: actualUserId, // Usar actualUserId para consistencia
        type: 'concepts_generated',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          notebookId,
          fileName,
          conceptsCount: validConcepts.length,
          subscriptionType,
          isSchoolNotebook,
          fileType,
          mimeType
        }
      });

      logger.info("✅ Conceptos generados exitosamente", {
        userId,
        notebookId,
        conceptsCount: validConcepts.length,
        isSchoolNotebook,
        fileType
      });

      return {
        success: true,
        concepts: validConcepts,
        conceptIds,
        conceptCount: validConcepts.length,
        usage: {
          current: currentUsage + 1,
          limit: limits.dailyGeminiCalls,
          remaining: limits.dailyGeminiCalls - (currentUsage + 1)
        }
      };

    } catch (error: any) {
      logger.error("❌ Error generando conceptos", {
        userId,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Error generando conceptos: " + error.message);
    }
  }
);

/**
 * Explica un concepto específico usando IA
 * Función segura que reemplaza la llamada directa desde el frontend
 */
export const explainConcept = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: ["GEMINI_API_KEY"]
  },
  async (request) => {
    // Verificar autenticación
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { concept, context, difficulty } = request.data;
    const userId = request.auth.uid;

    logger.info("🧠 Explicando concepto", {
      userId,
      concept: concept?.substring(0, 50) + "...",
      difficulty
    });

    try {
      const db = getDb();
      
      // Verificar límites de uso
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "Usuario no encontrado");
      }

      const userData = userDoc.data();
      let subscriptionType = (userData?.subscriptionType || userData?.subscription || "FREE") as string;
      
      // Mapear "school" a "SCHOOL" si es necesario
      if (subscriptionType === "school") {
        subscriptionType = "SCHOOL";
      }
      
      const limits = getSubscriptionLimits(subscriptionType);

      // Verificar límite diario
      const today = new Date().toISOString().split('T')[0];
      const usageRef = db.collection("users").doc(userId).collection("geminiUsage").doc(today);
      const usageDoc = await usageRef.get();
      
      const currentUsage = usageDoc.exists ? usageDoc.data()?.count || 0 : 0;
      if (currentUsage >= limits.dailyGeminiCalls) {
        throw new HttpsError(
          "resource-exhausted", 
          `Límite diario alcanzado (${limits.dailyGeminiCalls} llamadas). Actualiza a PRO para más llamadas.`
        );
      }

      // Obtener clave API desde variables de entorno (Firebase Functions v2)
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new HttpsError("internal", "Configuración de API no disponible");
      }

      // Inicializar Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Prompt adaptado a la dificultad
      const difficultyPrompts = {
        beginner: "Explica de manera muy simple y básica, como si fuera para un niño de 10 años",
        intermediate: "Explica de manera clara y práctica, con ejemplos concretos",
        advanced: "Explica de manera técnica y detallada, incluyendo conceptos avanzados"
      };

      const difficultyPrompt = difficultyPrompts[(difficulty as DifficultyLevel) || 'intermediate'];

      const prompt = `
${difficultyPrompt} el siguiente concepto:

CONCEPTO: ${concept}
${context ? `CONTEXTO: ${context}` : ''}

Proporciona una explicación de máximo ${limits.maxExplanationLength} caracteres que incluya:
- Definición clara
- Ejemplos prácticos
- Analogías o comparaciones útiles
- Puntos clave para recordar

Responde de manera directa y útil para el estudio.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const explanation = response.text().trim();

      // Actualizar contador de uso
      await usageRef.set({
        count: currentUsage + 1,
        lastUsed: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Registrar actividad
      await db.collection("userActivities").add({
        userId,
        type: 'concept_explained',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          concept: concept.substring(0, 100),
          difficulty,
          explanationLength: explanation.length,
          subscriptionType
        }
      });

      logger.info("✅ Concepto explicado exitosamente", {
        userId,
        explanationLength: explanation.length
      });

      return {
        success: true,
        explanation,
        usage: {
          current: currentUsage + 1,
          limit: limits.dailyGeminiCalls,
          remaining: limits.dailyGeminiCalls - (currentUsage + 1)
        }
      };

    } catch (error: any) {
      logger.error("❌ Error explicando concepto", {
        userId,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Error explicando concepto: " + error.message);
    }
  }
);

/**
 * Genera contenido general usando IA
 * Función segura para generación de contenido diverso
 */
export const generateContent = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 45,
    memory: "512MiB",
    secrets: ["GEMINI_API_KEY"]
  },
  async (request) => {
    // Verificar autenticación
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { prompt, contentType, options } = request.data;
    const userId = request.auth.uid;

    logger.info("🎨 Generando contenido", {
      userId,
      contentType,
      promptLength: prompt?.length || 0
    });

    try {
      const db = getDb();
      
      // Verificar límites de uso
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "Usuario no encontrado");
      }

      const userData = userDoc.data();
      let subscriptionType = (userData?.subscriptionType || "FREE") as string;
      
      // Mapear "school" a "SCHOOL" si es necesario
      if (subscriptionType === "school") {
        subscriptionType = "SCHOOL";
      }
      
      const limits = getSubscriptionLimits(subscriptionType);

      // Verificar límite diario
      const today = new Date().toISOString().split('T')[0];
      const usageRef = db.collection("users").doc(userId).collection("geminiUsage").doc(today);
      const usageDoc = await usageRef.get();
      
      const currentUsage = usageDoc.exists ? usageDoc.data()?.count || 0 : 0;
      if (currentUsage >= limits.dailyGeminiCalls) {
        throw new HttpsError(
          "resource-exhausted", 
          `Límite diario alcanzado (${limits.dailyGeminiCalls} llamadas). Actualiza a PRO para más llamadas.`
        );
      }

      // Obtener clave API desde variables de entorno (Firebase Functions v2)
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new HttpsError("internal", "Configuración de API no disponible");
      }

      // Inicializar Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Construir prompt según el tipo de contenido
      let enhancedPrompt = prompt;
      
      switch (contentType) {
        case 'quiz':
          enhancedPrompt = `Genera un cuestionario educativo basado en: ${prompt}
          
          Responde en formato JSON:
          {
            "preguntas": [
              {
                "pregunta": "Texto de la pregunta",
                "opciones": ["A", "B", "C", "D"],
                "respuestaCorrecta": 0,
                "explicacion": "Explicación de la respuesta"
              }
            ]
          }
          
          Genera 5 preguntas variadas y desafiantes.`;
          break;
          
        case 'summary':
          enhancedPrompt = `Crea un resumen conciso y estructurado de: ${prompt}
          
          Incluye:
          - Puntos principales
          - Conceptos clave
          - Conclusiones importantes
          
          Máximo ${limits.maxExplanationLength} caracteres.`;
          break;
          
        case 'examples':
          enhancedPrompt = `Genera ejemplos prácticos y variados para: ${prompt}
          
          Incluye:
          - Ejemplos de la vida real
          - Casos de uso
          - Aplicaciones prácticas
          
          Máximo ${limits.maxExplanationLength} caracteres.`;
          break;
          
        default:
          enhancedPrompt = prompt;
      }

      const result = await model.generateContent(enhancedPrompt);
      const response = await result.response;
      const content = response.text().trim();

      // Actualizar contador de uso
      await usageRef.set({
        count: currentUsage + 1,
        lastUsed: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Registrar actividad
      await db.collection("userActivities").add({
        userId,
        type: 'content_generated',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          contentType,
          contentLength: content.length,
          subscriptionType
        }
      });

      logger.info("✅ Contenido generado exitosamente", {
        userId,
        contentType,
        contentLength: content.length
      });

      return {
        success: true,
        content,
        contentType,
        usage: {
          current: currentUsage + 1,
          limit: limits.dailyGeminiCalls,
          remaining: limits.dailyGeminiCalls - (currentUsage + 1)
        }
      };

    } catch (error: any) {
      logger.error("❌ Error generando contenido", {
        userId,
        contentType,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "Error generando contenido: " + error.message);
    }
  }
);

/**
 * Función de respaldo para extraer conceptos de texto cuando Gemini no devuelve JSON válido
 */
const extractConceptsFromText = (text: string): any[] => {
  const concepts = [];
  
  // Buscar patrones comunes de conceptos en el texto
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  for (const line of lines) {
    // Buscar líneas que contengan definiciones (patrón: término - definición)
    const definitionMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (definitionMatch) {
      const termino = definitionMatch[1].trim();
      const definicion = definitionMatch[2].trim();
      
      if (termino.length > 2 && definicion.length > 10) {
        concepts.push({
          termino,
          definicion,
          ejemplos: [],
          importancia: "Concepto importante del contenido"
        });
      }
    }
    
    // Buscar líneas que contengan términos en negrita o mayúsculas
    const boldMatch = line.match(/\*\*([^*]+)\*\*/);
    if (boldMatch) {
      const termino = boldMatch[1].trim();
      if (termino.length > 3 && !concepts.find(c => c.termino === termino)) {
        concepts.push({
          termino,
          definicion: "Concepto clave identificado en el contenido",
          ejemplos: [],
          importancia: "Término importante destacado en el texto"
        });
      }
    }
  }
  
  return concepts.slice(0, 10); // Máximo 10 conceptos de respaldo
};

/**
 * Función para subir materiales a Firebase Storage desde Cloud Functions
 * Evita problemas de CORS al subir desde el servidor
 */
export const uploadMaterialToStorage = onCall(
  {
    cors: true,
    invoker: "public"
  },
  async (request) => {
    const db = getDb();
    
    try {
      // Verificar que el usuario esté autenticado
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Usuario no autenticado");
      }

      const { materialId, fileName, fileContent, notebookId, userId, fileType } = request.data;

      // Validar datos requeridos
      if (!materialId || !fileName || !fileContent || !notebookId || !userId) {
        throw new HttpsError(
          "invalid-argument",
          "Faltan datos requeridos para subir el material"
        );
      }

      // Verificar que el usuario sea el propietario
      if (request.auth.uid !== userId) {
        throw new HttpsError(
          "permission-denied",
          "No tienes permisos para subir este material"
        );
      }

      logger.info("📤 Subiendo material a Storage", {
        materialId,
        fileName,
        notebookId,
        userId
      });

      // Obtener referencia al bucket de Storage
      const bucket = admin.storage().bucket();
      
      // Crear la ruta del archivo con un nombre único para evitar conflictos
      const timestamp = Date.now();
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `materials/${userId}/${notebookId}/${materialId}_${timestamp}_${safeFileName}`;
      const file = bucket.file(filePath);

      logger.info("📦 Preparando archivo para subir", {
        filePath,
        fileSize: fileContent.length,
        fileType
      });

      // Convertir base64 a buffer
      let buffer;
      try {
        buffer = Buffer.from(fileContent, 'base64');
        logger.info("✅ Buffer creado exitosamente", { bufferSize: buffer.length });
      } catch (bufferError: any) {
        logger.error("❌ Error creando buffer", { error: bufferError.message });
        throw new HttpsError("invalid-argument", "Error procesando el archivo");
      }

      // Subir el archivo
      try {
        await file.save(buffer, {
          metadata: {
            contentType: fileType || 'application/octet-stream',
            metadata: {
              materialId,
              notebookId,
              userId,
              uploadedAt: new Date().toISOString()
            }
          }
        });
        logger.info("✅ Archivo guardado en Storage exitosamente");
      } catch (saveError: any) {
        logger.error("❌ Error guardando archivo en Storage", { 
          error: saveError.message,
          code: saveError.code
        });
        throw new HttpsError("internal", "Error guardando el archivo en Storage");
      }

      // Hacer el archivo público y obtener la URL
      try {
        await file.makePublic();
        logger.info("✅ Archivo hecho público");
      } catch (publicError: any) {
        logger.error("❌ Error haciendo archivo público", { 
          error: publicError.message,
          code: publicError.code
        });
        // Continuar sin hacer público, pero registrar el error
      }

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      logger.info("✅ Material subido exitosamente", {
        materialId,
        publicUrl,
        filePath
      });

      // Actualizar el documento en Firestore con la URL real
      try {
        await db.collection('materials').doc(materialId).update({
          url: publicUrl,
          pending: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info("✅ Documento actualizado en Firestore");
      } catch (updateError: any) {
        logger.error("❌ Error actualizando documento en Firestore", {
          error: updateError.message,
          materialId
        });
        // No fallar la función si solo falla la actualización
      }

      return {
        success: true,
        url: publicUrl,
        message: "Material subido exitosamente"
      };

    } catch (error: any) {
      logger.error("❌ Error subiendo material", {
        error: error.message,
        code: error.code
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Error subiendo material: ${error.message}`
      );
    }
  }
);

// Exportar las funciones de rankings
export { updateInstitutionRankings, scheduledRankingsUpdate } from './updateRankings';

// TRIGGER: Incrementa notebookCount en la materia al crear un cuaderno
export const onNotebookCreated = functions.firestore
  .document('notebooks/{notebookId}')
  .onCreate(async (snap, context) => {
    const notebookData = snap.data();
    const materiaId = notebookData.materiaId;
    if (materiaId) {
      const materiaRef = admin.firestore().collection('materias').doc(materiaId);
      await materiaRef.update({
        notebookCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return null;
  });

// TRIGGER: Decrementa notebookCount en la materia al eliminar un cuaderno
export const onNotebookDeletedMateria = functions.firestore
  .document('notebooks/{notebookId}')
  .onDelete(async (snap, context) => {
    const notebookData = snap.data();
    const materiaId = notebookData.materiaId;
    if (materiaId) {
      const materiaRef = admin.firestore().collection('materias').doc(materiaId);
      await materiaRef.update({
        notebookCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return null;
  });
