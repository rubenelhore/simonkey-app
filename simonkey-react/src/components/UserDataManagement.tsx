import React, { useState } from 'react';
import { useUserType } from '../hooks/useUserType';
import { deleteAllUserData } from '../services/userService';
import { auth } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
// import '../styles/UserDataManagement.css';

const UserDataManagement: React.FC = () => {
  const { isSuperAdmin } = useUserType();
  const [userId, setUserId] = useState('');
  const [auditResult, setAuditResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Función para auditar datos de usuario (simplificada)
  const auditUserData = async (userId: string): Promise<any> => {
    try {
      console.log('🔍 Auditando datos del usuario:', userId);
      
      const audit = {
        notebooks: 0,
        concepts: 0,
        studySessions: 0,
        userActivities: 0,
        reviewConcepts: 0,
        conceptStats: 0,
        learningData: 0,
        quizStats: 0,
        quizResults: 0,
        limits: 0,
        notebookLimits: 0,
        stats: 0,
        settings: 0
      };

      // Contar notebooks
      const notebooksQuery = query(collection(db, 'notebooks'), where('userId', '==', userId));
      const notebooksSnapshot = await getDocs(notebooksQuery);
      audit.notebooks = notebooksSnapshot.size;

      // Contar conceptos
      const conceptsQuery = query(collection(db, 'conceptos'), where('usuarioId', '==', userId));
      const conceptsSnapshot = await getDocs(conceptsQuery);
      audit.concepts = conceptsSnapshot.size;

      // Contar sesiones de estudio
      const studySessionsQuery = query(collection(db, 'studySessions'), where('userId', '==', userId));
      const studySessionsSnapshot = await getDocs(studySessionsQuery);
      audit.studySessions = studySessionsSnapshot.size;

      // Contar actividades de usuario
      const userActivitiesQuery = query(collection(db, 'userActivities'), where('userId', '==', userId));
      const userActivitiesSnapshot = await getDocs(userActivitiesQuery);
      audit.userActivities = userActivitiesSnapshot.size;

      // Contar conceptos de repaso
      const reviewConceptsQuery = query(collection(db, 'reviewConcepts'), where('userId', '==', userId));
      const reviewConceptsSnapshot = await getDocs(reviewConceptsQuery);
      audit.reviewConcepts = reviewConceptsSnapshot.size;

      // Contar estadísticas de conceptos
      const conceptStatsQuery = query(collection(db, 'conceptStats'), where('userId', '==', userId));
      const conceptStatsSnapshot = await getDocs(conceptStatsQuery);
      audit.conceptStats = conceptStatsSnapshot.size;

      console.log('📊 Resultado de la auditoría:', audit);
      return audit;
    } catch (error) {
      console.error('❌ Error durante la auditoría:', error);
      throw error;
    }
  };

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

  const handleDeleteUser = async () => {
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
      await deleteAllUserData(userId);
      setMessage('✅ Datos del usuario eliminados exitosamente');
      setAuditResult(null);
      setUserId('');
    } catch (error: any) {
      setMessage(`Error eliminando datos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="user-data-management">
        <div className="access-denied">
          <h2>🚫 Acceso Denegado</h2>
          <p>Solo los super administradores pueden acceder a esta funcionalidad.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-data-management">
      <div className="management-header">
        <h2>🗂️ Gestión de Datos de Usuario</h2>
        <p className="warning">
          ⚠️ Esta funcionalidad es solo para super administradores. 
          Las acciones aquí son IRREVERSIBLES.
        </p>
      </div>

      <div className="management-controls">
        <div className="input-group">
          <label htmlFor="userId">ID del Usuario:</label>
          <input
            id="userId"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Ingresa el ID del usuario"
            className="user-id-input"
            disabled={loading}
          />
        </div>

        <div className="action-buttons">
          <button 
            onClick={handleAudit}
            disabled={loading || !userId.trim()}
            className="audit-button"
          >
            {loading ? '🔍 Auditando...' : '🔍 Auditar Datos'}
          </button>

          <button 
            onClick={handleDeleteUser}
            disabled={loading || !userId.trim()}
            className="delete-button"
          >
            {loading ? '🗑️ Eliminando...' : '🗑️ Eliminar Datos'}
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
          <h3>📊 Resultados de la Auditoría</h3>
          <div className="audit-grid">
            <div className="audit-item">
              <span className="audit-label">📚 Notebooks:</span>
              <span className="audit-value">{auditResult.notebooks}</span>
            </div>
            <div className="audit-item">
              <span className="audit-label">📝 Conceptos:</span>
              <span className="audit-value">{auditResult.concepts}</span>
            </div>
            <div className="audit-item">
              <span className="audit-label">📊 Sesiones de Estudio:</span>
              <span className="audit-value">{auditResult.studySessions}</span>
            </div>
            <div className="audit-item">
              <span className="audit-label">📈 Actividades:</span>
              <span className="audit-value">{auditResult.userActivities}</span>
            </div>
            <div className="audit-item">
              <span className="audit-label">🔄 Conceptos de Repaso:</span>
              <span className="audit-value">{auditResult.reviewConcepts}</span>
            </div>
            <div className="audit-item">
              <span className="audit-label">📊 Estadísticas:</span>
              <span className="audit-value">{auditResult.conceptStats}</span>
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