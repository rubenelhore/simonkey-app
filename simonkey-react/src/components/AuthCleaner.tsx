import { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';

const AuthCleaner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const auth = getAuth();
  
  useEffect(() => {
    // Verificar si hay una redirección pendiente antigua
    const pendingRedirect = sessionStorage.getItem('authRedirectPending');
    
    if (pendingRedirect) {
      const timestamp = parseInt(pendingRedirect, 10);
      const now = Date.now();
      
      // Si la redirección tiene más de 5 minutos, mostrar botón de desbloqueo
      if (isNaN(timestamp) || now - timestamp > 5 * 60 * 1000) {
        setIsVisible(true);
      }
    }
  }, []);
  
  const handleCleanup = async () => {
    try {
      // Limpiar localStorage
      localStorage.removeItem('user');
      Object.keys(localStorage).forEach(key => {
        if (key.includes('firebase:authUser')) {
          localStorage.removeItem(key);
        }
      });
      
      // Limpiar sessionStorage
      sessionStorage.removeItem('authRedirectPending');
      sessionStorage.removeItem('redirectTarget');
      
      // Cerrar sesión de Firebase
      if (auth.currentUser) {
        await signOut(auth);
      }
      
      // Mostrar mensaje
      alert('Sesión limpiada. La página se recargará ahora.');
      
      // Recargar página
      window.location.reload();
    } catch (error) {
      console.error('Error al limpiar sesión:', error);
      alert('Error al limpiar sesión. Intenta recargar la página manualmente.');
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <div style={{
      padding: '15px',
      margin: '15px 0',
      backgroundColor: '#fff8e1',
      border: '1px solid #ffe082',
      borderRadius: '4px'
    }}>
      <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
        <strong>⚠️ Problema detectado</strong>: Se ha detectado un inicio de sesión que no se completó correctamente.
      </p>
      <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
        Esto puede impedir que inicies sesión. Haz clic en el botón para solucionar el problema.
      </p>
      <button
        onClick={handleCleanup}
        style={{
          backgroundColor: '#ff9800',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        Desbloquear sesión
      </button>
    </div>
  );
};

export default AuthCleaner;