import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { 
  calculateUserStats,
  cleanupOldData,
  exportUserData
} from '../services/firebaseFunctions';
import './CloudFunctionsTester.css';

const CloudFunctionsTester: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testFunction = async (functionName: string, testFunction: () => Promise<any>) => {
    if (!auth.currentUser) {
      setError('❌ Debes estar autenticado para probar las funciones');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log(`🧪 Probando función: ${functionName}`);
      const result = await testFunction();
      setResults({ functionName, result, timestamp: new Date().toISOString() });
      console.log(`✅ ${functionName} completada:`, result);
    } catch (err: any) {
      setError(`❌ Error en ${functionName}: ${err.message}`);
      console.error(`❌ Error en ${functionName}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const testCalculateStats = () => testFunction('calculateUserStats', () => 
    calculateUserStats(auth.currentUser!.uid)
  );

  const testCleanupData = () => {
    if (!window.confirm('¿Estás seguro de que quieres limpiar datos antiguos? Esta acción no se puede deshacer.')) {
      return;
    }
    testFunction('cleanupOldData', () => 
      cleanupOldData(auth.currentUser!.uid, 90)
    );
  };

  const testExportData = () => testFunction('exportUserData', () => 
    exportUserData(auth.currentUser!.uid)
  );

  return (
    <div className="cloud-functions-tester">
      <h2>🧪 Probador de Cloud Functions</h2>
      <p>Prueba las nuevas funciones de cloud functions de forma rápida</p>
      
      <div className="tester-controls">
        <button 
          onClick={testCalculateStats}
          disabled={loading}
          className="test-btn stats-btn"
        >
          📊 Probar Calcular Estadísticas
        </button>
        
        <button 
          onClick={testCleanupData}
          disabled={loading}
          className="test-btn cleanup-btn"
        >
          🧹 Probar Limpiar Datos
        </button>
        
        <button 
          onClick={testExportData}
          disabled={loading}
          className="test-btn export-btn"
        >
          📤 Probar Exportar Datos
        </button>
      </div>

      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Ejecutando función...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <h4>❌ Error</h4>
          <p>{error}</p>
        </div>
      )}

      {results && (
        <div className="results-section">
          <h4>✅ Resultados - {results.functionName}</h4>
          <p><strong>Timestamp:</strong> {results.timestamp}</p>
          <div className="results-content">
            <pre>{JSON.stringify(results.result, null, 2)}</pre>
          </div>
        </div>
      )}

      <div className="instructions">
        <h4>📋 Instrucciones</h4>
        <ul>
          <li>Debes estar autenticado para usar estas funciones</li>
          <li>Las funciones se ejecutan en el servidor de Firebase</li>
          <li>Los resultados se muestran en tiempo real</li>
          <li>Revisa la consola del navegador para logs detallados</li>
        </ul>
      </div>
    </div>
  );
};

export default CloudFunctionsTester; 