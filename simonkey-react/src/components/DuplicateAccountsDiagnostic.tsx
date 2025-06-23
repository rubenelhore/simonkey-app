import React, { useState } from 'react';
import { checkCurrentUserDuplicates, cleanCurrentUserDuplicates, detectAndCleanDuplicateAccounts, diagnoseUserByEmail, cleanDuplicateAccountsForEmail, cleanAllDuplicateAccounts } from '../utils/fixDuplicateAccounts';
import { useAuth } from '../contexts/AuthContext';

const DuplicateAccountsDiagnostic: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticEmail, setDiagnosticEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleCheckCurrentUser = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await checkCurrentUserDuplicates();
      setResults({ type: 'currentUser', data: result });
      console.log('Resultado verificación usuario actual:', result);
    } catch (err: any) {
      setError(`Error verificando usuario actual: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanCurrentUser = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      console.log('🧹 Limpiando duplicados del usuario actual...');
      
      if (!currentUser?.email) {
        setMessage('❌ No se puede obtener el email del usuario actual');
        return;
      }
      
      const result = await cleanDuplicateAccountsForEmail(currentUser.email);
      
      if (result.success) {
        setMessage(`✅ Limpieza completada: ${result.message}`);
        // Recargar la página para aplicar los cambios
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage(`❌ Error en la limpieza: ${result.message}`);
      }
    } catch (error) {
      console.error('Error limpiando duplicados del usuario actual:', error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanAllDuplicates = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      console.log('🧹 Limpiando todas las cuentas duplicadas...');
      
      const result = await cleanAllDuplicateAccounts();
      
      if (result.success) {
        setMessage(`✅ Limpieza completada: ${result.message}`);
        // Recargar la página para aplicar los cambios
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage(`❌ Error en la limpieza: ${result.message}`);
      }
    } catch (error) {
      console.error('Error limpiando todas las duplicadas:', error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiagnoseEmail = async () => {
    if (!diagnosticEmail.trim()) {
      setError('Por favor, ingresa un email para diagnosticar');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await diagnoseUserByEmail(diagnosticEmail.trim());
      setResults({ type: 'diagnoseEmail', data: result });
      console.log('Resultado diagnóstico email:', result);
    } catch (err: any) {
      setError(`Error diagnosticando email: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderResults = () => {
    if (!results) return null;

    switch (results.type) {
      case 'currentUser':
        const currentUserData = results.data;
        return (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800">Verificación Usuario Actual</h3>
            <div className="mt-2 space-y-1">
              <p><strong>Tiene duplicados:</strong> {currentUserData.hasDuplicates ? 'Sí' : 'No'}</p>
              {currentUserData.hasDuplicates && (
                <>
                  <p><strong>Número de duplicados:</strong> {currentUserData.duplicateCount}</p>
                  <p><strong>Cuenta principal:</strong> {currentUserData.mainAccountId}</p>
                </>
              )}
            </div>
          </div>
        );

      case 'cleanCurrentUser':
        const cleanCurrentData = results.data;
        return (
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-green-800">Limpieza Usuario Actual</h3>
            <div className="mt-2 space-y-1">
              <p><strong>Éxito:</strong> {cleanCurrentData.success ? 'Sí' : 'No'}</p>
              <p><strong>Cuentas limpiadas:</strong> {cleanCurrentData.cleaned}</p>
              {cleanCurrentData.error && (
                <p className="text-red-600"><strong>Error:</strong> {cleanCurrentData.error}</p>
              )}
            </div>
          </div>
        );

      case 'cleanAll':
        const cleanAllData = results.data;
        return (
          <div className="mt-4 p-4 bg-purple-50 rounded-lg">
            <h3 className="font-semibold text-purple-800">Limpieza General</h3>
            <div className="mt-2 space-y-1">
              <p><strong>Duplicados encontrados:</strong> {cleanAllData.duplicatesFound}</p>
              <p><strong>Cuentas limpiadas:</strong> {cleanAllData.cleaned}</p>
              <p><strong>Errores:</strong> {cleanAllData.errors.length}</p>
              {cleanAllData.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold text-red-600">Errores:</p>
                  <ul className="list-disc list-inside text-sm text-red-600">
                    {cleanAllData.errors.map((err: any, index: number) => (
                      <li key={index}>{err.email}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );

      case 'diagnoseEmail':
        const diagnoseData = results.data;
        return (
          <div className="mt-4 p-4 bg-orange-50 rounded-lg">
            <h3 className="font-semibold text-orange-800">Diagnóstico de Email: {diagnosticEmail}</h3>
            <div className="mt-2 space-y-1">
              <p><strong>Encontrado:</strong> {diagnoseData.found ? 'Sí' : 'No'}</p>
              <p><strong>Resumen:</strong> {diagnoseData.summary}</p>
              {diagnoseData.locations.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold">Ubicaciones encontradas:</p>
                  <ul className="list-disc list-inside text-sm">
                    {diagnoseData.locations.map((loc: any, index: number) => (
                      <li key={index}>
                        <strong>{loc.collection}</strong> (ID: {loc.id})
                        {loc.collection === 'users' && (
                          <span> - Tipo: {loc.data.subscription || 'FREE'}</span>
                        )}
                        {loc.collection === 'schoolTeachers' && (
                          <span> - Nombre: {loc.data.nombre}</span>
                        )}
                        {loc.collection === 'schoolStudents' && (
                          <span> - Nombre: {loc.data.nombre}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        🔍 Diagnóstico de Cuentas Duplicadas
      </h2>
      
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Información Importante</h3>
          <p className="text-sm text-yellow-700">
            Este diagnóstico ayuda a identificar y limpiar cuentas duplicadas que se crean cuando 
            un usuario intenta iniciar sesión con Google Auth usando un email que ya existe en el sistema.
          </p>
        </div>

        {/* Diagnóstico manual por email */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">🔍 Diagnóstico Manual por Email</h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={diagnosticEmail}
              onChange={(e) => setDiagnosticEmail(e.target.value)}
              placeholder="Ingresa un email para diagnosticar"
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleDiagnoseEmail}
              disabled={isLoading || !diagnosticEmail.trim()}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Diagnosticando...' : 'Diagnosticar'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleCheckCurrentUser}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Verificando...' : 'Verificar Usuario Actual'}
          </button>

          <button
            onClick={handleCleanCurrentUser}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Limpiando...' : 'Limpiar Usuario Actual'}
          </button>

          <button
            onClick={handleCleanAllDuplicates}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Limpiando Todo...' : 'Limpiar Todas las Duplicadas'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 font-semibold">Error:</p>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {message && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 font-semibold">Estado:</p>
            <p className="text-green-600">{message}</p>
          </div>
        )}

        {renderResults()}

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">📋 Instrucciones</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            <li><strong>Diagnóstico Manual:</strong> Verifica si existe un usuario con un email específico</li>
            <li><strong>Verificar Usuario Actual:</strong> Comprueba si tu cuenta actual tiene duplicados</li>
            <li><strong>Limpiar Usuario Actual:</strong> Elimina duplicados de tu cuenta actual</li>
            <li><strong>Limpiar Todas las Duplicadas:</strong> Escanea y limpia todas las cuentas duplicadas del sistema</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DuplicateAccountsDiagnostic; 