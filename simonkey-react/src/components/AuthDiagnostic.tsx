import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { diagnoseAuthIssues, fixOrphanUser } from '../utils/authDebug';

const AuthDiagnostic: React.FC = () => {
  const { user, userProfile, loading, isAuthenticated, isEmailVerified } = useAuth();
  const { isSuperAdmin, isSchoolUser, isSchoolTeacher, isSchoolStudent, loading: userTypeLoading } = useUserType();
  const [diagnosticResult, setDiagnosticResult] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setDiagnosticResult('Ejecutando diagnóstico...');
    
    try {
      // Capturar logs de la consola
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };

      await diagnoseAuthIssues();
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n'));
    } catch (error) {
      setDiagnosticResult(`Error ejecutando diagnóstico: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const fixUser = async () => {
    setIsRunning(true);
    setDiagnosticResult('Arreglando usuario...');
    
    try {
      const result = await fixOrphanUser();
      setDiagnosticResult(result ? '✅ Usuario arreglado exitosamente' : '❌ Error arreglando usuario');
    } catch (error) {
      setDiagnosticResult(`Error arreglando usuario: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const reloadPage = () => {
    window.location.reload();
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      margin: '20px 0',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>🔍 Diagnóstico de Autenticación</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <strong>Estado actual:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>Loading: {loading ? '✅' : '❌'}</li>
          <li>UserType Loading: {userTypeLoading ? '✅' : '❌'}</li>
          <li>Autenticado: {isAuthenticated ? '✅' : '❌'}</li>
          <li>Email Verificado: {isEmailVerified ? '✅' : '❌'}</li>
          <li>Usuario: {user ? `${user.email} (${user.uid})` : 'No hay usuario'}</li>
          <li>Perfil: {userProfile ? `${userProfile.subscription} - ${userProfile.schoolRole || 'Sin rol'}` : 'No hay perfil'}</li>
          <li>Super Admin: {isSuperAdmin ? '✅' : '❌'}</li>
          <li>Usuario Escolar: {isSchoolUser ? '✅' : '❌'}</li>
          <li>Profesor: {isSchoolTeacher ? '✅' : '❌'}</li>
          <li>Estudiante: {isSchoolStudent ? '✅' : '❌'}</li>
        </ul>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={runDiagnostic}
          disabled={isRunning}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? 'Ejecutando...' : '🔍 Ejecutar Diagnóstico'}
        </button>
        
        <button 
          onClick={fixUser}
          disabled={isRunning}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? 'Arreglando...' : '🔧 Arreglar Usuario'}
        </button>
        
        <button 
          onClick={reloadPage}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Recargar Página
        </button>
      </div>

      {diagnosticResult && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          padding: '10px',
          maxHeight: '300px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          <strong>Resultado del diagnóstico:</strong>
          <br />
          {diagnosticResult}
        </div>
      )}
    </div>
  );
};

export default AuthDiagnostic; 