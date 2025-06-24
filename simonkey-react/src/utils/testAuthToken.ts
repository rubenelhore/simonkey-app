import { auth } from '../services/firebase';

/**
 * Verifica el token de autenticación actual
 */
export const testAuthToken = async () => {
  console.log('🔐 === VERIFICANDO TOKEN DE AUTENTICACIÓN ===');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario actual:', currentUser.uid);
    console.log('📧 Email:', currentUser.email);
    
    // Obtener el token ID
    const token = await currentUser.getIdToken();
    console.log('🎫 Token obtenido:', token ? 'Sí' : 'No');
    console.log('📏 Longitud del token:', token?.length);
    
    // Decodificar el token para ver su contenido (solo para debug)
    const tokenParts = token.split('.');
    if (tokenParts.length === 3) {
      try {
        const payload = JSON.parse(atob(tokenParts[1]));
        console.log('📦 Payload del token:', payload);
        console.log('  - UID:', payload.user_id || payload.uid);
        console.log('  - Email:', payload.email);
        console.log('  - Expiración:', new Date(payload.exp * 1000).toLocaleString());
      } catch (e) {
        console.log('⚠️ No se pudo decodificar el token');
      }
    }
    
    // Forzar refresh del token
    console.log('🔄 Forzando refresh del token...');
    const newToken = await currentUser.getIdToken(true);
    console.log('🎫 Nuevo token obtenido:', newToken ? 'Sí' : 'No');
    
  } catch (error) {
    console.error('❌ Error verificando token:', error);
  }
};

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).testAuthToken = testAuthToken;
  console.log('🔧 Función testAuthToken() disponible en la consola');
}