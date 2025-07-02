import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  checkUserMigrationStatus, 
  migrateUserNotebooksToDefaultMateria 
} from '../utils/migrateNotebooksToMaterias';

export const useAutoMigration = () => {
  const { user, isAuthenticated } = useAuth();
  const [migrationStatus, setMigrationStatus] = useState<'checking' | 'migrating' | 'completed' | 'error' | null>(null);
  const [migrationMessage, setMigrationMessage] = useState<string>('');

  useEffect(() => {
    const runAutoMigration = async () => {
      if (!user?.uid || !isAuthenticated) return;

      // Verificar si ya se ejecutó la migración en esta sesión
      const migrationKey = `migration_checked_${user.uid}`;
      const alreadyChecked = sessionStorage.getItem(migrationKey);
      
      if (alreadyChecked) {
        return;
      }

      setMigrationStatus('checking');
      
      try {
        // Verificar si el usuario necesita migración
        const status = await checkUserMigrationStatus(user.uid);
        
        if (status.needsMigration) {
          console.log(`🔄 Auto-migración: Usuario ${user.uid} necesita migración de ${status.notebooksWithoutMateria} cuadernos`);
          setMigrationStatus('migrating');
          setMigrationMessage(`Migrando ${status.notebooksWithoutMateria} cuaderno(s) a la nueva estructura...`);
          
          // Ejecutar migración
          const result = await migrateUserNotebooksToDefaultMateria(user.uid);
          
          if (result.error) {
            setMigrationStatus('error');
            setMigrationMessage(`Error en migración: ${result.error}`);
            console.error('❌ Error en auto-migración:', result.error);
          } else {
            setMigrationStatus('completed');
            setMigrationMessage(
              `✅ Migración completada: ${result.notebooksMigrated} cuaderno(s) migrado(s)` +
              (result.materiaCreated ? ' y materia "General" creada.' : '.')
            );
            console.log('✅ Auto-migración completada exitosamente');
          }
        } else {
          setMigrationStatus('completed');
          console.log('✅ Usuario no necesita migración');
        }
        
        // Marcar como verificado en esta sesión
        sessionStorage.setItem(migrationKey, 'true');
        
        // Limpiar el mensaje después de 5 segundos
        setTimeout(() => {
          setMigrationStatus(null);
          setMigrationMessage('');
        }, 5000);
        
      } catch (error) {
        console.error('❌ Error en auto-migración:', error);
        setMigrationStatus('error');
        setMigrationMessage('Error verificando migración');
        
        // Limpiar el mensaje de error después de 5 segundos
        setTimeout(() => {
          setMigrationStatus(null);
          setMigrationMessage('');
        }, 5000);
      }
    };

    runAutoMigration();
  }, [user, isAuthenticated]);

  return {
    migrationStatus,
    migrationMessage
  };
};