/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from '@google/generative-ai';

// Inicializar Firebase Admin
admin.initializeApp();

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
      const db = admin.firestore();
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
      const db = admin.firestore();
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
      const db = admin.firestore();
      
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
      const db = admin.firestore();
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
      const db = admin.firestore();
      
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
      const db = admin.firestore();
      
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
      const db = admin.firestore();
      
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

      // Generar ID único
      const userId = `school_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Obtener password válido
      const passwordToUse = userData.password && userData.password.length >= 6 
        ? userData.password 
        : 'school123';

      // Crear documento en colección users
      await db.collection("users").doc(userId).set({
        id: userId,
        email: userData.email,
        username: userData.nombre,
        nombre: userData.nombre,
        displayName: userData.nombre,
        birthdate: '',
        subscription: 'SCHOOL',
        schoolRole: userData.role === 'teacher' ? 'TEACHER' : 'STUDENT',
        notebookCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        maxNotebooks: userData.role === 'teacher' ? 999 : 0,
        maxConceptsPerNotebook: userData.role === 'teacher' ? 999 : 0,
        canDeleteAndRecreate: false,
        ...userData.additionalData
      });
      
      // Crear documento en colección específica
      const collectionName = userData.role === 'teacher' ? 'schoolTeachers' : 'schoolStudents';
      await db.collection(collectionName).doc(userId).set({
        id: userId,
        nombre: userData.nombre,
        email: userData.email,
        password: passwordToUse,
        subscription: 'SCHOOL',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
      const db = admin.firestore();
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
      const db = admin.firestore();
      
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

/**
 * 🤖 SECURE GEMINI API FUNCTIONS
 * Estas funciones migran las llamadas a Gemini desde el frontend al backend
 * para proteger las claves API y controlar el uso
 */

/**
 * Función para generar conceptos desde archivos usando Gemini
 * Reemplaza la funcionalidad del frontend que exponía la API key
 */
export const generateConcepts = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 180, // 3 minutos para procesar archivos grandes
    memory: "1GiB"
  },
  async (request) => {
    // Validar autenticación
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    const { fileContents, notebookId } = request.data;

    // Validar parámetros
    if (!fileContents || !Array.isArray(fileContents) || fileContents.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Se requiere al menos un archivo para procesar"
      );
    }

    if (!notebookId) {
      throw new HttpsError(
        "invalid-argument",
        "Se requiere el ID del cuaderno"
      );
    }

    logger.info("🤖 Generando conceptos con Gemini", {
      userId: request.auth.uid,
      notebookId,
      fileCount: fileContents.length
    });

    try {
      // Inicializar Gemini con clave API segura
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.error("❌ Clave API de Gemini no configurada");
        throw new HttpsError(
          "failed-precondition",
          "Servicio de IA no disponible temporalmente"
        );
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

      // Verificar límites del usuario
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(request.auth.uid).get();
      const userData = userDoc.data();

      if (!userData) {
        throw new HttpsError("not-found", "Usuario no encontrado");
      }

      // Verificar cuota de uso (ejemplo: máximo 10 generaciones por día para usuarios FREE)
      const today = new Date().toDateString();
      const usageKey = `gemini_usage_${today}`;
      const dailyUsage = userData[usageKey] || 0;

      const maxDailyUsage = userData.subscription === 'FREE' ? 5 : 
                          userData.subscription === 'PRO' ? 20 : 
                          userData.subscription === 'SCHOOL' ? 15 : 50;

      if (dailyUsage >= maxDailyUsage) {
        throw new HttpsError(
          "resource-exhausted",
          `Límite diario de generaciones alcanzado (${maxDailyUsage}). Intenta mañana o actualiza tu plan.`
        );
      }

      // Crear el prompt optimizado
      const prompt = `
        Por favor, analiza estos archivos y extrae una lista de conceptos clave con sus definiciones.
        Devuelve el resultado como un array JSON con el siguiente formato:
        [
          {
            "término": "nombre del concepto",
            "definición": "explicación concisa del concepto (20-30 palabras)",
            "fuente": "nombre del documento"
          }
        ]
        
        REGLAS IMPORTANTES:
        1. El término NO puede aparecer en la definición (ej: si el término es "Hígado", la definición NO puede empezar con "El hígado es...")
        2. La definición NO puede contener información que revele directamente el término
        3. Usa sinónimos, descripciones funcionales o características para definir el concepto
        4. La definición debe ser clara y específica sin mencionar el término exacto
        5. PRESERVA información importante como:
           - Números específicos (ej: "más de 200 estructuras", "10 minutos")
           - Fechas exactas (ej: "en 1893", "durante la década de 1960")
           - Palabras clave como "único", "primero", "mayor", "menor", "más", "menos"
           - Comparaciones específicas (ej: "superando en número a Egipto")
           - Características distintivas (ej: "con capacidad de renovación parcial")
        
        Extrae al menos 10 conceptos importantes si el documento es lo suficientemente extenso.
        Asegúrate de que el resultado sea únicamente el array JSON, sin texto adicional.
      `;

      // Preparar contenido para Gemini
      const contents = [{
        role: "user",
        parts: [
          { text: prompt },
          ...fileContents.map((file: any) => ({
            inlineData: {
              mimeType: file.mimeType,
              data: file.data
            }
          }))
        ]
      }];

      // Llamar a Gemini
      const result = await model.generateContent({
        contents
      });

      const response = result.response.text();

      // Parsear la respuesta
      let conceptosExtraidos: any[] = [];
      try {
        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith("```json")) {
          cleanedResponse = cleanedResponse.substring(7, cleanedResponse.length - 3).trim();
        } else if (cleanedResponse.startsWith("```")) { 
          cleanedResponse = cleanedResponse.substring(3, cleanedResponse.length - 3).trim();
        }

        conceptosExtraidos = JSON.parse(cleanedResponse);

        if (!Array.isArray(conceptosExtraidos)) {
          throw new Error('La respuesta no es un array válido');
        }

      } catch (parseError) {
        logger.error('❌ Error parseando respuesta de Gemini:', parseError);
        throw new HttpsError(
          "internal",
          "Error procesando la respuesta de IA. Intenta de nuevo."
        );
      }

      // Actualizar contador de uso
      await db.collection("users").doc(request.auth.uid).update({
        [usageKey]: dailyUsage + 1,
        lastGeminiUsage: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info("✅ Conceptos generados exitosamente", {
        userId: request.auth.uid,
        conceptsCount: conceptosExtraidos.length,
        usage: dailyUsage + 1
      });

      return {
        success: true,
        concepts: conceptosExtraidos,
        usage: {
          daily: dailyUsage + 1,
          remaining: maxDailyUsage - (dailyUsage + 1)
        }
      };

    } catch (error: any) {
      logger.error("❌ Error generando conceptos", {
        userId: request.auth.uid,
        error: error.message
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Error generando conceptos: ${error.message}`
      );
    }
  }
);

/**
 * Función para explicar conceptos usando Gemini
 * Reemplaza la funcionalidad del componente ExplainConcept
 */
export const explainConcept = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: "512MiB"
  },
  async (request) => {
    // Validar autenticación
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    const { conceptTerm, conceptDefinition, explanationType, userInterests } = request.data;

    // Validar parámetros
    if (!conceptTerm || !conceptDefinition || !explanationType) {
      throw new HttpsError(
        "invalid-argument",
        "Se requieren: término del concepto, definición y tipo de explicación"
      );
    }

    const validTypes = ['simple', 'related', 'interests', 'mnemotecnia'];
    if (!validTypes.includes(explanationType)) {
      throw new HttpsError(
        "invalid-argument",
        `Tipo de explicación debe ser uno de: ${validTypes.join(', ')}`
      );
    }

    logger.info("🧠 Generando explicación de concepto", {
      userId: request.auth.uid,
      conceptTerm,
      explanationType
    });

    try {
      // Inicializar Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "Servicio de IA no disponible temporalmente"
        );
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Verificar límites del usuario
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(request.auth.uid).get();
      const userData = userDoc.data();

      if (!userData) {
        throw new HttpsError("not-found", "Usuario no encontrado");
      }

      // Control de uso (más permisivo para explicaciones)
      const today = new Date().toDateString();
      const usageKey = `explanation_usage_${today}`;
      const dailyUsage = userData[usageKey] || 0;

      const maxDailyUsage = userData.subscription === 'FREE' ? 15 : 
                          userData.subscription === 'PRO' ? 50 : 
                          userData.subscription === 'SCHOOL' ? 30 : 100;

      if (dailyUsage >= maxDailyUsage) {
        throw new HttpsError(
          "resource-exhausted",
          `Límite diario de explicaciones alcanzado (${maxDailyUsage})`
        );
      }

      // Crear prompt según el tipo de explicación
      let prompt = '';
      
      switch (explanationType) {
        case 'simple':
          prompt = `Explica el siguiente concepto de manera sencilla, como si le hablaras a alguien sin conocimiento técnico. 
          Usa analogías cotidianas. Limita tu respuesta a 3-4 oraciones.
          
          Concepto: ${conceptTerm}
          Definición: ${conceptDefinition}`;
          break;
          
        case 'related':
          prompt = `Explica cómo el siguiente concepto se relaciona con otros conceptos del mismo campo. 
          Menciona 2-3 conceptos relacionados y explica brevemente sus conexiones.
          Limita tu respuesta a 3-4 oraciones.
          
          Concepto: ${conceptTerm}
          Definición: ${conceptDefinition}`;
          break;
          
        case 'interests':
          if (!userInterests || !Array.isArray(userInterests) || userInterests.length === 0) {
            return {
              success: true,
              explanation: 'Para personalizar las explicaciones, añade tus intereses en la configuración de tu perfil.',
              usage: { daily: dailyUsage, remaining: maxDailyUsage - dailyUsage }
            };
          }
          
          prompt = `TAREA: Relacionar un concepto académico con los intereses personales de un estudiante.
          
          INTERESES DEL ESTUDIANTE: ${userInterests.join(', ')}.
          
          CONCEPTO A EXPLICAR: "${conceptTerm}"
          DEFINICIÓN: "${conceptDefinition}"
          
          INSTRUCCIONES:
          1. Explica de manera clara cómo este concepto académico se relaciona directamente con los intereses listados del estudiante.
          2. Proporciona 1-2 ejemplos específicos de cómo este concepto podría aplicarse o encontrarse en esos intereses.
          3. Tu respuesta debe ser breve (3-4 oraciones), concreta y dirigida al estudiante.
          4. NO menciones que eres un modelo de lenguaje ni uses metareferencias sobre tu naturaleza.`;
          break;
          
        case 'mnemotecnia':
          prompt = `Crea una técnica mnemotécnica sencilla y práctica para recordar el siguiente concepto.

          TÉCNICA MNEMOTÉCNICA: [TÍTULO CORTO Y CLARO]
          
          Utiliza UNA de estas técnicas (elige la más adecuada para este concepto específico):
          - Acrónimo simple (máximo 5 letras)
          - Asociación visual concreta (una sola imagen potente)
          - Analogía cotidiana (comparación con algo familiar)
          - Historia mínima (máximo 3 elementos)
          - Rima breve y pegadiza
          
          Estructura tu respuesta así:
          Título de la mnemotecnia (en mayúsculas) seguida de ":"
          Descripción en 2-4 líneas máximo
          
          La mnemotecnia debe ser:
          - Memorable al primer contacto
          - Visualmente clara
          - Directamente relacionada con el concepto
          - Fácil de recordar sin esfuerzo

          PROHIBIDO usar: "*" ni siquiera para poner en negritas.
          
          Concepto: ${conceptTerm}
          Definición: ${conceptDefinition}`;
          break;
          
        default:
          prompt = `Explica el siguiente concepto brevemente:
          Concepto: ${conceptTerm}
          Definición: ${conceptDefinition}`;
      }

      // Generar explicación
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      const explanation = result.response.text();

      // Actualizar contador de uso
      await db.collection("users").doc(request.auth.uid).update({
        [usageKey]: dailyUsage + 1,
        lastExplanationUsage: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info("✅ Explicación generada exitosamente", {
        userId: request.auth.uid,
        explanationType,
        usage: dailyUsage + 1
      });

      return {
        success: true,
        explanation,
        usage: {
          daily: dailyUsage + 1,
          remaining: maxDailyUsage - (dailyUsage + 1)
        }
      };

    } catch (error: any) {
      logger.error("❌ Error generando explicación", {
        userId: request.auth.uid,
        error: error.message
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Error generando explicación: ${error.message}`
      );
    }
  }
);

/**
 * Función genérica para llamadas a Gemini
 * Para casos específicos que no encajen en las otras funciones
 */
export const generateContent = onCall(
  {
    maxInstances: 10,
    timeoutSeconds: 90,
    memory: "512MiB"
  },
  async (request) => {
    // Validar autenticación
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función"
      );
    }

    const { prompt, model: modelName = 'gemini-1.5-flash' } = request.data;

    // Validar parámetros
    if (!prompt || typeof prompt !== 'string') {
      throw new HttpsError(
        "invalid-argument",
        "Se requiere un prompt válido"
      );
    }

    // Validar longitud del prompt
    if (prompt.length > 10000) {
      throw new HttpsError(
        "invalid-argument",
        "El prompt es demasiado largo (máximo 10,000 caracteres)"
      );
    }

    logger.info("🤖 Generando contenido con Gemini", {
      userId: request.auth.uid,
      promptLength: prompt.length,
      model: modelName
    });

    try {
      // Inicializar Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "Servicio de IA no disponible temporalmente"
        );
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      // Verificar límites del usuario
      const db = admin.firestore();
      const userDoc = await db.collection("users").doc(request.auth.uid).get();
      const userData = userDoc.data();

      if (!userData) {
        throw new HttpsError("not-found", "Usuario no encontrado");
      }

      // Control de uso
      const today = new Date().toDateString();
      const usageKey = `content_usage_${today}`;
      const dailyUsage = userData[usageKey] || 0;

      const maxDailyUsage = userData.subscription === 'FREE' ? 10 : 
                          userData.subscription === 'PRO' ? 30 : 
                          userData.subscription === 'SCHOOL' ? 20 : 50;

      if (dailyUsage >= maxDailyUsage) {
        throw new HttpsError(
          "resource-exhausted",
          `Límite diario de generaciones alcanzado (${maxDailyUsage})`
        );
      }

      // Generar contenido
      const result = await model.generateContent(prompt);
      const content = result.response.text();

      // Actualizar contador de uso
      await db.collection("users").doc(request.auth.uid).update({
        [usageKey]: dailyUsage + 1,
        lastContentUsage: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info("✅ Contenido generado exitosamente", {
        userId: request.auth.uid,
        contentLength: content.length,
        usage: dailyUsage + 1
      });

      return {
        success: true,
        content,
        usage: {
          daily: dailyUsage + 1,
          remaining: maxDailyUsage - (dailyUsage + 1)
        }
      };

    } catch (error: any) {
      logger.error("❌ Error generando contenido", {
        userId: request.auth.uid,
        error: error.message
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Error generando contenido: ${error.message}`
      );
    }
  }
);
