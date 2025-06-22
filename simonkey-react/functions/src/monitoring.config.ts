/**
 * Configuración de Monitoreo y Error Reporting para Cloud Functions
 * Este archivo configura la integración con Google Cloud Error Reporting y Cloud Monitoring
 */

import { ErrorReporting } from '@google-cloud/error-reporting';
import { MetricServiceClient } from '@google-cloud/monitoring';
import * as logger from "firebase-functions/logger";

// Configuración del Error Reporting
const errorReporting = new ErrorReporting({
  projectId: process.env.GCLOUD_PROJECT,
  reportMode: 'production',
  serviceContext: {
    service: 'simonkey-cloud-functions',
    version: process.env.FUNCTION_RUNTIME_VERSION || '1.0.0'
  }
});

// Configuración del cliente de Cloud Monitoring
const monitoring = new MetricServiceClient({
  projectId: process.env.GCLOUD_PROJECT
});

/**
 * Clase para manejo avanzado de métricas y alertas
 */
export class CloudMonitoring {
  private projectPath: string;

  constructor() {
    const projectId = process.env.GCLOUD_PROJECT || 'default-project';
    this.projectPath = monitoring.projectPath(projectId);
  }

  /**
   * Crear métrica personalizada en Cloud Monitoring
   */
  async createCustomMetric(
    metricType: string,
    value: number,
    labels: Record<string, string> = {},
    timestamp?: Date
  ): Promise<void> {
    try {
      const dataPoint = {
        interval: {
          endTime: {
            seconds: Math.floor((timestamp || new Date()).getTime() / 1000),
          },
        },
        value: {
          doubleValue: value,
        },
      };

      const timeSeriesData = {
        metric: {
          type: `custom.googleapis.com/${metricType}`,
          labels: labels,
        },
        resource: {
          type: 'cloud_function',
          labels: {
            function_name: process.env.FUNCTION_NAME || 'unknown',
            project_id: process.env.GCLOUD_PROJECT || 'unknown',
            region: process.env.FUNCTION_REGION || 'unknown',
          },
        },
        points: [dataPoint],
      };

      const request = {
        name: this.projectPath,
        timeSeries: [timeSeriesData],
      };

      await monitoring.createTimeSeries(request);
      
      logger.info('📊 Métrica personalizada enviada a Cloud Monitoring', {
        metricType,
        value,
        labels
      });
    } catch (error) {
      logger.error('❌ Error enviando métrica a Cloud Monitoring', error);
    }
  }

  /**
   * Reportar métricas de rendimiento de función
   */
  async reportFunctionPerformance(
    functionName: string,
    duration: number,
    success: boolean,
    requestId: string
  ): Promise<void> {
    const labels = {
      function_name: functionName,
      status: success ? 'success' : 'error',
      request_id: requestId
    };

    // Enviar métricas de duración y estado
    await Promise.all([
      this.createCustomMetric('function_duration_ms', duration, labels),
      this.createCustomMetric('function_invocations', 1, labels)
    ]);
  }

  /**
   * Reportar métricas de uso de recursos
   */
  async reportResourceUsage(
    functionName: string,
    memoryUsed: number,
    cpuUsed: number,
    requestId: string
  ): Promise<void> {
    const labels = {
      function_name: functionName,
      request_id: requestId
    };

    // Enviar métricas de recursos
    await Promise.all([
      this.createCustomMetric('memory_usage_mb', memoryUsed, labels),
      this.createCustomMetric('cpu_usage_percent', cpuUsed, labels)
    ]);
  }

  /**
   * Reportar métricas de operaciones de base de datos
   */
  async reportDatabaseOperations(
    operation: string,
    count: number,
    duration: number,
    success: boolean,
    requestId: string
  ): Promise<void> {
    const labels = {
      operation_type: operation,
      status: success ? 'success' : 'error',
      request_id: requestId
    };

    await Promise.all([
      this.createCustomMetric('db_operations_count', count, labels),
      this.createCustomMetric('db_operation_duration_ms', duration, labels)
    ]);
  }
}

/**
 * Clase para manejo avanzado de Error Reporting
 */
export class ErrorReportingService {
  /**
   * Reportar error estructurado a Cloud Error Reporting
   */
  async reportError(
    error: Error,
    context: {
      functionName: string;
      userId?: string;
      requestId: string;
      severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
      additionalContext?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      // Enriquecer el error con contexto adicional
      const enrichedError = new Error(error.message);
      enrichedError.stack = error.stack;
      enrichedError.name = error.name;

      // Agregar contexto al error
      (enrichedError as any).context = {
        ...context,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production'
      };

      // Reportar a Cloud Error Reporting
      errorReporting.report(enrichedError);

      logger.error('🚨 Error reportado a Cloud Error Reporting', {
        errorMessage: error.message,
        functionName: context.functionName,
        requestId: context.requestId,
        severity: context.severity || 'ERROR'
      });
    } catch (reportingError) {
      logger.error('❌ Error al reportar a Cloud Error Reporting', reportingError);
    }
  }

  /**
   * Reportar error crítico con alertas automáticas
   */
  async reportCriticalError(
    error: Error,
    context: {
      functionName: string;
      userId?: string;
      requestId: string;
      impact?: string;
      additionalContext?: Record<string, any>;
    }
  ): Promise<void> {
    await this.reportError(error, {
      ...context,
      severity: 'CRITICAL'
    });

    // Log adicional para errores críticos
    logger.error('💥 ERROR CRÍTICO - Requiere atención inmediata', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      alertLevel: 'CRITICAL',
      requiresImmediate: true
    });
  }
}

/**
 * Configuración de alertas y umbrales
 */
export const MONITORING_THRESHOLDS = {
  // Umbrales de rendimiento
  FUNCTION_DURATION_WARNING_MS: 30000, // 30 segundos
  FUNCTION_DURATION_CRITICAL_MS: 60000, // 1 minuto
  
  // Umbrales de memoria
  MEMORY_WARNING_PERCENT: 80,
  MEMORY_CRITICAL_PERCENT: 95,
  
  // Umbrales de errores
  ERROR_RATE_WARNING_PERCENT: 5,
  ERROR_RATE_CRITICAL_PERCENT: 10,
  
  // Umbrales de operaciones de BD
  DB_OPERATION_WARNING_MS: 5000, // 5 segundos
  DB_OPERATION_CRITICAL_MS: 10000, // 10 segundos
};

/**
 * Utilidades de alertas
 */
export class AlertUtils {
  private static cloudMonitoring = new CloudMonitoring();
  private static errorReporting = new ErrorReportingService();

  /**
   * Verificar y alertar si se exceden umbrales de rendimiento
   */
  static async checkPerformanceThresholds(
    functionName: string,
    duration: number,
    requestId: string
  ): Promise<void> {
    if (duration > MONITORING_THRESHOLDS.FUNCTION_DURATION_CRITICAL_MS) {
      const error = new Error(`Función ${functionName} excedió umbral crítico de duración: ${duration}ms`);
      await this.errorReporting.reportCriticalError(error, {
        functionName,
        requestId,
        impact: 'Alto - Rendimiento degradado significativamente'
      });
    } else if (duration > MONITORING_THRESHOLDS.FUNCTION_DURATION_WARNING_MS) {
      logger.warn('⚠️ Función excedió umbral de advertencia de duración', {
        functionName,
        duration,
        threshold: MONITORING_THRESHOLDS.FUNCTION_DURATION_WARNING_MS,
        requestId
      });
    }

    // Reportar métrica de rendimiento
    await this.cloudMonitoring.reportFunctionPerformance(
      functionName,
      duration,
      duration < MONITORING_THRESHOLDS.FUNCTION_DURATION_CRITICAL_MS,
      requestId
    );
  }

  /**
   * Verificar umbrales de operaciones de base de datos
   */
  static async checkDatabaseThresholds(
    operation: string,
    duration: number,
    requestId: string,
    success: boolean = true
  ): Promise<void> {
    if (duration > MONITORING_THRESHOLDS.DB_OPERATION_CRITICAL_MS) {
      const error = new Error(`Operación de BD ${operation} excedió umbral crítico: ${duration}ms`);
      await this.errorReporting.reportCriticalError(error, {
        functionName: operation,
        requestId,
        impact: 'Alto - Operaciones de base de datos lentas'
      });
    } else if (duration > MONITORING_THRESHOLDS.DB_OPERATION_WARNING_MS) {
      logger.warn('⚠️ Operación de BD excedió umbral de advertencia', {
        operation,
        duration,
        threshold: MONITORING_THRESHOLDS.DB_OPERATION_WARNING_MS,
        requestId
      });
    }

    // Reportar métrica de BD
    await this.cloudMonitoring.reportDatabaseOperations(
      operation,
      1,
      duration,
      success,
      requestId
    );
  }
}

// Instancias globales para uso en las Cloud Functions
export const cloudMonitoring = new CloudMonitoring();
export const errorReportingService = new ErrorReportingService();