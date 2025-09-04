import { notificationService } from './notificationService';

class GlobalNotificationListener {
  private static instance: GlobalNotificationListener;
  private isInitialized = false;

  static getInstance(): GlobalNotificationListener {
    if (!this.instance) {
      this.instance = new GlobalNotificationListener();
    }
    return this.instance;
  }

  // Inicializar listeners globales una sola vez
  initialize(): void {
    if (this.isInitialized) {
      console.log('⚠️ Listeners globales ya están inicializados');
      return;
    }

    console.log('🚀 Inicializando listeners globales de notificaciones...');

    try {
      // Inicializar listeners para cuadernos y documentos
      console.log('📚 Configurando listener para cuadernos...');
      notificationService.listenForNewNotebooks();
      
      console.log('📄 Configurando listener para documentos...');
      notificationService.listenForNewDocuments();
      
      console.log('📎 Configurando listener para materiales...');
      notificationService.listenForNewMaterials();
      
      // Solo los profesores pueden escuchar conceptos (para evitar problemas de permisos)
      console.log('💡 Configurando listener para conceptos (solo profesores)...');
      notificationService.listenForNewConceptsAsTeacher();

      this.isInitialized = true;
      console.log('✅ Listeners globales inicializados correctamente');
      
      // Hacer disponible el debug
      (window as any).notificationListenerStatus = () => {
        console.log('📡 Estado del listener global:', this.isInitialized);
        return this.isInitialized;
      };
      
      // Función de prueba para crear notificación manual
      (window as any).testConceptNotification = (studentId: string, conceptId: string = 'test') => {
        console.log('🧪 Ejecutando prueba de notificación de concepto...');
        return notificationService.testCreateConceptNotification(studentId, conceptId);
      };
      
    } catch (error) {
      console.error('❌ Error inicializando listeners globales:', error);
    }
  }

  // Verificar si ya están inicializados
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  // Resetear estado para permitir reinicialización (útil para testing y logout/login)
  reset(): void {
    console.log('🔄 Reseteando listeners globales...');
    this.isInitialized = false;
  }
}

export const globalNotificationListener = GlobalNotificationListener.getInstance();