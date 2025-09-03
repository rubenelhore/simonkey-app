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

      this.isInitialized = true;
      console.log('✅ Listeners globales inicializados correctamente');
      
      // Hacer disponible el debug
      (window as any).notificationListenerStatus = () => {
        console.log('📡 Estado del listener global:', this.isInitialized);
        return this.isInitialized;
      };
      
    } catch (error) {
      console.error('❌ Error inicializando listeners globales:', error);
    }
  }

  // Verificar si ya están inicializados
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }
}

export const globalNotificationListener = GlobalNotificationListener.getInstance();