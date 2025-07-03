import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { cleanOrphanNotebooks } from '../utils/cleanOrphanNotebooks';

export const useOrphanNotebooksCleanup = () => {
  const { user, isAuthenticated } = useAuth();
  const [cleanupStatus, setCleanupStatus] = useState<'idle' | 'checking' | 'cleaning' | 'completed' | null>(null);
  const [cleanupMessage, setCleanupMessage] = useState<string>('');

  useEffect(() => {
    const runCleanup = async () => {
      if (!user?.uid || !isAuthenticated) return;

      // Verificar si ya se ejecutó la limpieza en esta sesión
      const cleanupKey = `orphan_cleanup_${user.uid}`;
      const alreadyCleaned = sessionStorage.getItem(cleanupKey);
      
      if (alreadyCleaned) {
        return;
      }

      setCleanupStatus('checking');
      
      try {
        console.log('🔍 Verificando cuadernos huérfanos...');
        const result = await cleanOrphanNotebooks(user.uid);
        
        if (result.orphanCount > 0) {
          setCleanupStatus('cleaning');
          setCleanupMessage(`Se limpiaron ${result.cleanedCount} cuaderno(s) huérfano(s)`);
          console.log(`✅ Limpieza completada: ${result.cleanedCount} cuadernos`);
        }
        
        setCleanupStatus('completed');
        
        // Marcar como limpiado en esta sesión
        sessionStorage.setItem(cleanupKey, 'true');
        
        // Limpiar el mensaje después de 5 segundos
        setTimeout(() => {
          setCleanupStatus(null);
          setCleanupMessage('');
        }, 5000);
        
      } catch (error) {
        console.error('❌ Error en limpieza automática:', error);
        setCleanupStatus(null);
      }
    };

    runCleanup();
  }, [user, isAuthenticated]);

  return {
    cleanupStatus,
    cleanupMessage
  };
};