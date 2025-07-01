import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faPlay, faCheck, faExclamationTriangle, faSpinner } from '@fortawesome/free-solid-svg-icons';
// import { migrateSchoolCollectionsToUsers } from '../utils/migrateSchoolCollectionsToUsers';
import './SchoolMigrationTool.css';

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
  details: {
    students: number;
    teachers: number;
    admins: number;
    tutors: number;
  };
}

const SchoolMigrationTool: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDryRun = async () => {
    setIsRunning(true);
    setResult(null);
    // try {
    //   const migrationResult = await migrateSchoolCollectionsToUsers(true);
    //   setResult(migrationResult);
    // } catch (error) {
    //   console.error('Error during dry run:', error);
    //   setResult({
    //     success: false,
    //     migratedCount: 0,
    //     errors: [`Critical error: ${error instanceof Error ? error.message : String(error)}`],
    //     details: { students: 0, teachers: 0, admins: 0, tutors: 0 }
    //   });
    // } finally {
      setIsRunning(false);
    // }
  };

  const handleActualMigration = async () => {
    setIsRunning(true);
    setResult(null);
    setShowConfirm(false);
    // try {
    //   const migrationResult = await migrateSchoolCollectionsToUsers(false);
    //   setResult(migrationResult);
    // } catch (error) {
    //   console.error('Error during migration:', error);
    //   setResult({
    //     success: false,
    //     migratedCount: 0,
    //     errors: [`Critical error: ${error instanceof Error ? error.message : String(error)}`],
    //     details: { students: 0, teachers: 0, admins: 0, tutors: 0 }
    //   });
    // } finally {
      setIsRunning(false);
    // }
  };

  return (
    <div className="school-migration-tool">
      <div className="migration-header">
        <FontAwesomeIcon icon={faDatabase} className="header-icon" />
        <h2>Migración de Colecciones Escolares</h2>
      </div>

      <div className="migration-info">
        <p>
          Esta herramienta consolidará todas las colecciones escolares 
          (schoolStudents, schoolTeachers, schoolAdmins, schoolTutors) 
          en la colección principal <code>users</code>.
        </p>
        
        <div className="migration-benefits">
          <h3>Beneficios de la migración:</h3>
          <ul>
            <li>✅ Estructura más simple y mantenible</li>
            <li>✅ Mejor rendimiento (menos consultas)</li>
            <li>✅ Reglas de seguridad más simples</li>
            <li>✅ Menor posibilidad de inconsistencias</li>
          </ul>
        </div>
      </div>

      <div className="migration-actions">
        <button 
          className="btn-dry-run"
          onClick={handleDryRun}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin className="btn-icon" />
              Ejecutando...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faPlay} className="btn-icon" />
              Ejecutar Simulación (Dry Run)
            </>
          )}
        </button>

        <button 
          className="btn-migrate"
          onClick={() => setShowConfirm(true)}
          disabled={isRunning || !result || !result.success}
        >
          <FontAwesomeIcon icon={faDatabase} className="btn-icon" />
          Ejecutar Migración Real
        </button>
      </div>

      {showConfirm && (
        <div className="confirm-dialog">
          <div className="confirm-content">
            <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
            <h3>¿Estás seguro?</h3>
            <p>
              Esta acción migrará permanentemente todos los datos de las 
              colecciones escolares a la colección <code>users</code>.
            </p>
            <p className="warning-text">
              ⚠️ Esta operación no se puede deshacer. Asegúrate de tener 
              un respaldo de tu base de datos.
            </p>
            <div className="confirm-actions">
              <button 
                className="btn-cancel"
                onClick={() => setShowConfirm(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-confirm"
                onClick={handleActualMigration}
              >
                Sí, ejecutar migración
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className={`migration-result ${result.success ? 'success' : 'error'}`}>
          <div className="result-header">
            <FontAwesomeIcon 
              icon={result.success ? faCheck : faExclamationTriangle} 
              className="result-icon" 
            />
            <h3>
              {result.success ? 'Migración Completada' : 'Migración con Errores'}
            </h3>
          </div>

          <div className="result-summary">
            <div className="summary-item">
              <span className="label">Total migrado:</span>
              <span className="value">{result.migratedCount}</span>
            </div>
            <div className="summary-details">
              <div className="detail-item">
                <span className="label">Estudiantes:</span>
                <span className="value">{result.details.students}</span>
              </div>
              <div className="detail-item">
                <span className="label">Profesores:</span>
                <span className="value">{result.details.teachers}</span>
              </div>
              <div className="detail-item">
                <span className="label">Administradores:</span>
                <span className="value">{result.details.admins}</span>
              </div>
              <div className="detail-item">
                <span className="label">Tutores:</span>
                <span className="value">{result.details.tutors}</span>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="result-errors">
              <h4>Errores encontrados:</h4>
              <ul>
                {result.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolMigrationTool;