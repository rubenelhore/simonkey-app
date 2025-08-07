/**
 * Cache Manager - Gestiona el caché de la página de inicio
 */

export class CacheManager {
  private static readonly CACHE_PREFIX = 'inicio_cache_';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Limpia todo el caché de inicio para un usuario
   */
  static clearInicioCache(userId: string): void {
    try {
      localStorage.removeItem(`${this.CACHE_PREFIX}materias_${userId}`);
      localStorage.removeItem(`${this.CACHE_PREFIX}events_${userId}`);
      localStorage.removeItem(`${this.CACHE_PREFIX}main_data_${userId}`);
      console.log('🗑️ Cache de inicio limpiado para usuario:', userId);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Limpia solo el caché de materias para un usuario
   */
  static clearMateriasCache(userId: string): void {
    try {
      localStorage.removeItem(`${this.CACHE_PREFIX}materias_${userId}`);
      console.log('🗑️ Cache de materias limpiado para usuario:', userId);
    } catch (error) {
      console.error('Error clearing materias cache:', error);
    }
  }

  /**
   * Limpia solo el caché de eventos para un usuario
   */
  static clearEventsCache(userId: string): void {
    try {
      localStorage.removeItem(`${this.CACHE_PREFIX}events_${userId}`);
      console.log('🗑️ Cache de eventos limpiado para usuario:', userId);
    } catch (error) {
      console.error('Error clearing events cache:', error);
    }
  }

  /**
   * Limpia solo el caché de datos principales para un usuario
   */
  static clearMainDataCache(userId: string): void {
    try {
      localStorage.removeItem(`${this.CACHE_PREFIX}main_data_${userId}`);
      console.log('🗑️ Cache de datos principales limpiado para usuario:', userId);
    } catch (error) {
      console.error('Error clearing main data cache:', error);
    }
  }

  /**
   * Verifica si un cache es válido
   */
  static isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  /**
   * Obtiene datos del caché
   */
  static getCachedData(key: string): any {
    try {
      const cached = localStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error reading cache:', error);
    }
    return null;
  }

  /**
   * Fuerza la actualización del caché de materias en la próxima visita a inicio
   */
  static invalidateMateriasCache(userId: string): void {
    this.clearMateriasCache(userId);
    
    // También disparar evento personalizado para que InicioPage se actualice si está activa
    window.dispatchEvent(new CustomEvent('invalidate-materias-cache', { 
      detail: { userId } 
    }));
  }
}