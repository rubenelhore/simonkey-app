import React, { useState } from 'react';
import { useUserType } from '../hooks/useUserType';
import { auditUserData, testUserDataDeletion } from '../utils/testUserDeletion';
import './UserDataManagement.css';

const UserDataManagement: React.FC = () => {
  const { isSuperAdmin } = useUserType();
  const [userId, setUserId] = useState('');
  const [auditResult, setAuditResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Solo mostrar para super admins
  if (!isSuperAdmin) {
    return null;
  }

  const handleAudit = async () => {
    if (!userId.trim()) {
      setMessage('Por favor ingresa un ID de usuario');
      return;
    }

    setLoading(true);
    setMessage('');
    setAuditResult(null);

    try {
      const result = await auditUserData(userId);
      setAuditResult(result);
      setMessage('Auditoría completada exitosamente');
    } catch (error: any) {
      setMessage(`Error en la auditoría: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestDeletion = async () => {
    if (!userId.trim()) {
      setMessage('Por favor ingresa un ID de usuario');
      return;
    }

    if (!window.confirm(`¿Estás seguro de que quieres ELIMINAR TODOS los datos del usuario ${userId}? Esta acción es IRREVERSIBLE.`)) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await testUserDataDeletion(userId);
      setMessage('Eliminación de prueba completada exitosamente');
      setAuditResult(null);
    } catch (error: any) {
      setMessage(`Error en la eliminación: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-data-management">
      <h3>🔧 Gestión de Datos de Usuario (Solo Super Admin)</h3>
      
      <div className="management-controls">
        <div className="input-group">
          <label htmlFor="userId">ID de Usuario:</label>
          <input
            type="text"
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Ingresa el ID del usuario"
            disabled={loading}
          />
        </div>

        <div className="action-buttons">
          <button
            onClick={handleAudit}
            disabled={loading || !userId.trim()}
            className="audit-button"
          >
            {loading ? 'Auditando...' : '🔍 Auditar Datos'}
          </button>

          <button
            onClick={handleTestDeletion}
            disabled={loading || !userId.trim()}
            className="delete-button"
          >
            {loading ? 'Eliminando...' : '🗑️ Eliminar Datos (Prueba)'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {auditResult && (
        <div className="audit-results">
          <h4>📊 Resultados de la Auditoría</h4>
          <div className="audit-grid">
            <div className="audit-item">
              <span className="label">📚 Notebooks:</span>
              <span className="value">{auditResult.notebooks}</span>
            </div>
            <div className="audit-item">
              <span className="label">📝 Conceptos:</span>
              <span className="value">{auditResult.concepts}</span>
            </div>
            <div className="audit-item">
              <span className="label">⏱️ Sesiones de Estudio:</span>
              <span className="value">{auditResult.studySessions}</span>
            </div>
            <div className="audit-item">
              <span className="label">📈 Actividades:</span>
              <span className="value">{auditResult.userActivities}</span>
            </div>
            <div className="audit-item">
              <span className="label">🔄 Conceptos de Repaso:</span>
              <span className="value">{auditResult.reviewConcepts}</span>
            </div>
            <div className="audit-item">
              <span className="label">📊 Estadísticas de Conceptos:</span>
              <span className="value">{auditResult.conceptStats}</span>
            </div>
            <div className="audit-item">
              <span className="label">🧠 Datos de Aprendizaje:</span>
              <span className="value">{auditResult.learningData}</span>
            </div>
            <div className="audit-item">
              <span className="label">📝 Estadísticas de Quiz:</span>
              <span className="value">{auditResult.quizStats}</span>
            </div>
            <div className="audit-item">
              <span className="label">📊 Resultados de Quiz:</span>
              <span className="value">{auditResult.quizResults}</span>
            </div>
            <div className="audit-item">
              <span className="label">⏰ Límites:</span>
              <span className="value">{auditResult.limits}</span>
            </div>
            <div className="audit-item">
              <span className="label">📚 Límites de Notebooks:</span>
              <span className="value">{auditResult.notebookLimits}</span>
            </div>
            <div className="audit-item">
              <span className="label">📈 Estadísticas:</span>
              <span className="value">{auditResult.stats}</span>
            </div>
            <div className="audit-item">
              <span className="label">⚙️ Configuraciones:</span>
              <span className="value">{auditResult.settings}</span>
            </div>
          </div>
        </div>
      )}

      <div className="warning-box">
        <h4>⚠️ Advertencias Importantes</h4>
        <ul>
          <li>Esta herramienta solo debe usarse en desarrollo</li>
          <li>La eliminación de datos es IRREVERSIBLE</li>
          <li>No eliminar usuarios administradores</li>
          <li>Hacer backup antes de cualquier eliminación</li>
        </ul>
      </div>
    </div>
  );
};

export default UserDataManagement; 