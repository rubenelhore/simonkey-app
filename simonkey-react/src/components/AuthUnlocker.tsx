import React from 'react';
import { getAuth, signOut } from 'firebase/auth';

const AuthUnlocker: React.FC = () => {
  const handleUnlock = async () => {
    try {
      // Limpiar datos de sesión
      sessionStorage.clear();
      localStorage.removeItem('user');
      
      // Limpiar cookies de Firebase Auth
      document.cookie.split(";").forEach(function(c) {
        if (c.trim().startsWith("firebaseAuth") || c.trim().startsWith("__session")) {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        }
      });
      
      // Cerrar sesión con Firebase
      const auth = getAuth();
      await signOut(auth);
      
      // Recargar la página
      console.log("✅ Datos de autenticación limpiados. Recargando página...");
      window.location.reload();
    } catch (err) {
      console.error("Error al desbloquear autenticación:", err);
    }
  };

  return (
    <div style={{ margin: '1rem 0', textAlign: 'center' }}>
      <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
        ¿Problemas para iniciar sesión?
      </div>
      <button 
        onClick={handleUnlock}
        style={{
          background: 'transparent',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '0.5rem 1rem',
          fontSize: '0.9rem',
          cursor: 'pointer'
        }}
      >
        Desbloquear sesión
      </button>
    </div>
  );
};

export default AuthUnlocker;