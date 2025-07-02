import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  migrateUserNotebooksToDefaultMateria, 
  checkUserMigrationStatus 
} from '../utils/migrateNotebooksToMaterias';
import '../styles/MigrationTool.css';

const MigrationTool: React.FC = () => {
  const { user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    needsMigration: boolean;
    notebooksWithoutMateria: number;
    hasDefaultMateria: boolean;
  } | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    notebooksMigrated: number;
    materiaCreated: boolean;
    error?: string;
  } | null>(null);

  const checkStatus = async () => {
    if (!user?.uid) return;

    setIsChecking(true);
    try {
      const status = await checkUserMigrationStatus(user.uid);
      setMigrationStatus(status);
    } catch (error) {
      console.error('Error verificando estado:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const runMigration = async () => {
    if (!user?.uid) return;

    setIsMigrating(true);
    setMigrationResult(null);
    
    try {
      const result = await migrateUserNotebooksToDefaultMateria(user.uid);
      setMigrationResult(result);
      
      // Actualizar el estado después de la migración
      await checkStatus();
    } catch (error) {
      console.error('Error en migración:', error);
      setMigrationResult({
        notebooksMigrated: 0,
        materiaCreated: false,
        error: 'Error durante la migración'
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="migration-tool">
      <h3>🔄 Herramienta de Migración</h3>
      <p>Esta herramienta migra tus cuadernos existentes a la nueva estructura de materias.</p>
      
      <div className="migration-actions">
        <button 
          onClick={checkStatus}
          disabled={isChecking || isMigrating}
          className="check-button"
        >
          {isChecking ? 'Verificando...' : 'Verificar Estado'}
        </button>
      </div>

      {migrationStatus && (
        <div className="migration-status">
          <h4>Estado de Migración:</h4>
          <ul>
            <li>
              <span>Necesita migración:</span> 
              <strong>{migrationStatus.needsMigration ? 'Sí' : 'No'}</strong>
            </li>
            <li>
              <span>Cuadernos sin materia:</span> 
              <strong>{migrationStatus.notebooksWithoutMateria}</strong>
            </li>
            <li>
              <span>Tiene materia "General":</span> 
              <strong>{migrationStatus.hasDefaultMateria ? 'Sí' : 'No'}</strong>
            </li>
          </ul>
          
          {migrationStatus.needsMigration && (
            <button 
              onClick={runMigration}
              disabled={isMigrating}
              className="migrate-button"
            >
              {isMigrating ? 'Migrando...' : `Migrar ${migrationStatus.notebooksWithoutMateria} cuaderno(s)`}
            </button>
          )}
        </div>
      )}

      {migrationResult && (
        <div className={`migration-result ${migrationResult.error ? 'error' : 'success'}`}>
          <h4>Resultado de Migración:</h4>
          {migrationResult.error ? (
            <p className="error-message">❌ Error: {migrationResult.error}</p>
          ) : (
            <>
              <p>✅ Migración completada exitosamente</p>
              <ul>
                <li>Cuadernos migrados: <strong>{migrationResult.notebooksMigrated}</strong></li>
                <li>Materia creada: <strong>{migrationResult.materiaCreated ? 'Sí' : 'No'}</strong></li>
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MigrationTool;