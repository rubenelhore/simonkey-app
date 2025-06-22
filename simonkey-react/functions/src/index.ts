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
import { v4 as uuidv4 } from 'uuid';
import { 
  cloudMonitoring, 
  errorReportingService, 
  AlertUtils,
  MONITORING_THRESHOLDS 
} from './monitoring.config';

// Inicializar Firebase Admin
admin.initializeApp();

// ========================================
// SISTEMA DE LOGGING ESTRUCTURADO Y TRAZABILIDAD
// ========================================

/**
 * Interfaz para el contexto de logging estructurado
 */
interface LogContext {
  requestId: string;
  userId?: string;
  functionName: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Clase para manejo de logging estructurado y trazabilidad
 */
class StructuredLogger {
  private context: LogContext;

  constructor(functionName: string, userId?: string, metadata?: Record<string, any>) {
    this.context = {
      requestId: uuidv4(),
      userId,
      functionName,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    // Log inicial de la petición
    this.info("🚀 Función iniciada", {
      requestId: this.context.requestId,
      userId: this.context.userId,
      metadata: this.context.metadata
    });
  }

  /**
   * Log de información con contexto estructurado
   */
  info(message: string, additionalData?: Record<string, any>) {
    logger.info(message, {
      ...this.context,
      level: 'INFO',
      additionalData,
      labels: {
        function: this.context.functionName,
        requestId: this.context.requestId,
        userId: this.context.userId || 'anonymous'
      }
    });
  }

  /**
   * Log de advertencias con contexto estructurado
   */
  warn(message: string, additionalData?: Record<string, any>) {
    logger.warn(message, {
      ...this.context,
      level: 'WARNING',
      additionalData,
      labels: {
        function: this.context.functionName,
        requestId: this.context.requestId,
        userId: this.context.userId || 'anonymous'
      }
    });
  }

  /**
   * Log de errores con contexto estructurado y stack trace
   */
  error(message: string, error?: Error | any, additionalData?: Record<string, any>) {
    const errorDetails = error ? {
      errorMessage: error.message || String(error),
      errorStack: error.stack,
      errorCode: error.code,
      errorType: error.constructor?.name
    } : {};

    logger.error(message, {
      ...this.context,
      level: 'ERROR',
      error: errorDetails,
      additionalData,
      labels: {
        function: this.context.functionName,
        requestId: this.context.requestId,
        userId: this.context.userId || 'anonymous',
        errorType: error?.constructor?.name || 'UnknownError'
      }
    });

    // Reportar error a Cloud Error Reporting si es un error real
    if (error instanceof Error) {
      errorReportingService.reportError(error, {
        functionName: this.context.functionName,
        userId: this.context.userId,
        requestId: this.context.requestId,
        severity: 'ERROR',
        additionalContext: additionalData
      }).catch(reportingError => {
        logger.warn('⚠️ No se pudo reportar error a Cloud Error Reporting', reportingError);
      });
    }
  }

  /**
   * Log de métricas de rendimiento
   */
  metric(metricName: string, value: number, unit: string = '', additionalData?: Record<string, any>) {
    logger.info(`📊 Métrica: ${metricName}`, {
      ...this.context,
      level: 'METRIC',
      metric: {
        name: metricName,
        value,
        unit,
        timestamp: new Date().toISOString()
      },
      additionalData,
      labels: {
        function: this.context.functionName,
        requestId: this.context.requestId,
        userId: this.context.userId || 'anonymous',
        metricType: metricName
      }
    });
  }

  /**
   * Log de finalización exitosa con métricas de tiempo
   */
  success(message: string, result?: any, startTime?: number) {
    const duration = startTime ? Date.now() - startTime : undefined;
    
    this.info(`✅ ${message}`, {
      result: this.sanitizeResult(result),
      performance: duration ? {
        duration: `${duration}ms`,
        durationMs: duration
      } : undefined
    });

    if (duration) {
      this.metric(`${this.context.functionName}_duration`, duration, 'ms');
      
      // Reportar métricas de rendimiento a Cloud Monitoring
      cloudMonitoring.reportFunctionPerformance(
        this.context.functionName,
        duration,
        true,
        this.context.requestId
      ).catch(error => {
        logger.warn('⚠️ No se pudo reportar métrica de rendimiento', error);
      });

      // Verificar umbrales de rendimiento
      AlertUtils.checkPerformanceThresholds(
        this.context.functionName,
        duration,
        this.context.requestId
      ).catch(error => {
        logger.warn('⚠️ No se pudo verificar umbrales de rendimiento', error);
      });
    }
  }

  /**
   * Crear un logger hijo con contexto adicional
   */
  child(additionalContext: Record<string, any>): StructuredLogger {
    const childLogger = Object.create(this);
    childLogger.context = {
      ...this.context,
      metadata: {
        ...this.context.metadata,
        ...additionalContext
      }
    };
    return childLogger;
  }

  /**
   * Obtener el ID de la petición para incluir en respuestas
   */
  getRequestId(): string {
    return this.context.requestId;
  }

  /**
   * Obtener el nombre de la función
   */
  getFunctionName(): string {
    return this.context.functionName;
  }

  /**
   * Obtener el ID del usuario
   */
  getUserId(): string | undefined {
    return this.context.userId;
  }

  /**
   * Sanitizar resultado para evitar exponer información sensible
   */
  private sanitizeResult(result: any): any {
    if (!result) return result;
    
    // Crear una copia del resultado
    const sanitized = JSON.parse(JSON.stringify(result));
    
    // Eliminar campos sensibles
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitizeObject = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }
}

/**
 * Clase para manejo centralizado de errores
 */
class ErrorHandler {
  private logger: StructuredLogger;

  constructor(logger: StructuredLogger) {
    this.logger = logger;
  }

  /**
   * Crear HttpsError con logging estructurado
   */
  createError(
    code: 'unauthenticated' | 'permission-denied' | 'invalid-argument' | 'not-found' | 'already-exists' | 'resource-exhausted' | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented' | 'internal' | 'unavailable' | 'data-loss',
    message: string,
    originalError?: Error | any,
    additionalData?: Record<string, any>
  ): HttpsError {
    
    // Log del error con contexto completo
    this.logger.error(`❌ Error ${code}: ${message}`, originalError, {
      errorCode: code,
      userMessage: message,
      additionalData
    });

    // Crear mensaje de error user-friendly
    const userFriendlyMessage = this.getUserFriendlyMessage(code, message);
    
    // Incluir requestId en los detalles del error para trazabilidad
    const errorDetails = {
      requestId: this.logger.getRequestId(),
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    return new HttpsError(code, userFriendlyMessage, errorDetails);
  }

  /**
   * Manejar errores inesperados
   */
  handleUnexpectedError(error: Error | any, context?: string): HttpsError {
    const contextMessage = context ? ` en ${context}` : '';
    
    this.logger.error(`🚨 Error inesperado${contextMessage}`, error, {
      context,
      isUnexpectedError: true
    });

    // Reportar error crítico a Cloud Error Reporting
    if (error instanceof Error) {
      errorReportingService.reportCriticalError(error, {
        functionName: this.logger.getFunctionName(),
        userId: this.logger.getUserId(),
        requestId: this.logger.getRequestId(),
        impact: `Alto - Error inesperado${contextMessage}`,
        additionalContext: { context, isUnexpectedError: true }
      }).catch(reportingError => {
        this.logger.warn('⚠️ No se pudo reportar error crítico', reportingError);
      });
    }

    // No exponer detalles del error interno al usuario
    return this.createError(
      'internal', 
      `Ocurrió un error interno${contextMessage}. Por favor, contacta al soporte técnico.`,
      error,
      { context }
    );
  }

  /**
   * Obtener mensaje user-friendly basado en el código de error
   */
  private getUserFriendlyMessage(code: string, originalMessage: string): string {
    const friendlyMessages: Record<string, string> = {
      'unauthenticated': 'Debes iniciar sesión para realizar esta acción.',
      'permission-denied': 'No tienes permisos para realizar esta acción.',
      'invalid-argument': 'Los datos proporcionados no son válidos.',
      'not-found': 'El recurso solicitado no fue encontrado.',
      'already-exists': 'El recurso ya existe.',
      'resource-exhausted': 'Has alcanzado el límite de recursos permitidos.',
      'failed-precondition': 'No se cumplen las condiciones necesarias para esta acción.',
      'internal': 'Ocurrió un error interno. Por favor, inténtalo de nuevo más tarde.'
    };

    return friendlyMessages[code] || originalMessage;
  }
}

/**
 * Middleware para validaciones comunes
 */
class ValidationMiddleware {
  private logger: StructuredLogger;
  private errorHandler: ErrorHandler;

  constructor(logger: StructuredLogger) {
    this.logger = logger;
    this.errorHandler = new ErrorHandler(logger);
  }

  /**
   * Validar autenticación
   */
  validateAuth(request: any): void {
    if (!request.auth) {
      throw this.errorHandler.createError(
        'unauthenticated',
        'Debes estar autenticado para usar esta función'
      );
    }
    
    this.logger.info('🔐 Usuario autenticado', {
      userId: request.auth.uid,
      email: request.auth.token?.email
    });
  }

  /**
   * Validar datos requeridos
   */
  validateRequiredFields(data: any, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => 
      data[field] === undefined || data[field] === null || data[field] === ''
    );

    if (missingFields.length > 0) {
      throw this.errorHandler.createError(
        'invalid-argument',
        `Campos requeridos faltantes: ${missingFields.join(', ')}`,
        undefined,
        { missingFields, providedData: Object.keys(data) }
      );
    }

    this.logger.info('✅ Validación de campos requeridos exitosa', {
      requiredFields,
      providedFields: Object.keys(data)
    });
  }

  /**
   * Validar email
   */
  validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw this.errorHandler.createError(
        'invalid-argument',
        'El formato del email no es válido',
        undefined,
        { providedEmail: email }
      );
    }
  }
}

// ========================================
// FUNCIONES CLOUD MEJORADAS
// ========================================

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
    const startTime = Date.now();
    const { userId, deletedBy } = request.data;
    
    // Inicializar logging estructurado
    const structuredLogger = new StructuredLogger('deleteUserData', request.auth?.uid, {
      targetUserId: userId,
      deletedBy: deletedBy || request.auth?.uid
    });
    
    const validator = new ValidationMiddleware(structuredLogger);
    const errorHandler = new ErrorHandler(structuredLogger);
    
    try {
      // Validaciones
      validator.validateAuth(request);
      validator.validateRequiredFields(request.data, ['userId']);
      
      structuredLogger.info("🗑️ Iniciando eliminación de usuario", {
        targetUserId: userId,
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
      const db = admin.firestore();
      const auth = admin.auth();

      // 1. ELIMINAR NOTEBOOKS Y CONCEPTOS (operación optimizada)
      structuredLogger.info("📚 Eliminando notebooks y conceptos...");
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
        structuredLogger.info(`✅ Eliminados ${deletedItems.notebooks} notebooks y ${deletedItems.concepts} conceptos`);
        structuredLogger.metric('notebooks_deleted', deletedItems.notebooks);
        structuredLogger.metric('concepts_deleted', deletedItems.concepts);
      } catch (error) {
        const errorMsg = `Error eliminando notebooks: ${error}`;
        structuredLogger.error(errorMsg, error);
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

      const result = {
        success: true,
        message: `Usuario eliminado exitosamente. ${totalDeleted} elementos eliminados.`,
        deletedItems,
        errors: errors.length > 0 ? errors : undefined,
        requestId: structuredLogger.getRequestId()
      };

      structuredLogger.metric('total_items_deleted', totalDeleted);
      structuredLogger.success("🎉 Eliminación de usuario completada", result, startTime);

      return result;

    } catch (error: any) {
      throw errorHandler.handleUnexpectedError(error, 'eliminación de usuario');
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
