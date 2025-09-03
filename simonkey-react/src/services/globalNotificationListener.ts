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

    // Inicializar listeners para cuadernos y documentos
    notificationService.listenForNewNotebooks();
    notificationService.listenForNewDocuments();

    this.isInitialized = true;
    console.log('✅ Listeners globales inicializados correctamente');
  }

  // Verificar si ya están inicializados
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }
}

export const globalNotificationListener = GlobalNotificationListener.getInstance();