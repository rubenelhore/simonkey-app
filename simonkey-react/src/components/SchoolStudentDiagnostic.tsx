import React, { useState } from 'react';
import { diagnoseSchoolStudentIssue, fixSchoolStudentIssue } from '../utils/diagnoseSchoolStudent';
import { fixSchoolStudentLinking } from '../utils/fixSchoolStudentLinking';
import { fixCurrentSchoolStudent, fixDuplicateAutoCreatedUser } from '../utils/fixCurrentSchoolStudent';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';

const SchoolStudentDiagnostic: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string>('');
  const [email, setEmail] = useState('');
  const { user } = useAuth();
  const { isSchoolStudent, isSchoolTeacher, isSchoolUser, userProfile } = useUserType();

  const runDiagnostic = async () => {
    setIsRunning(true);
    setDiagnosticResult('');
    
    try {
      // Capturar los logs de la consola
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      await diagnoseSchoolStudentIssue(email || user?.email || undefined);
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n'));
      
    } catch (error) {
      setDiagnosticResult(`Error ejecutando diagnóstico: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runFix = async () => {
    setIsRunning(true);
    setDiagnosticResult('');
    
    try {
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      await fixSchoolStudentIssue(email || user?.email || undefined);
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n'));
      
    } catch (error) {
      setDiagnosticResult(`Error ejecutando arreglo: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runLinkingFix = async () => {
    setIsRunning(true);
    setDiagnosticResult('');
    
    try {
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      const result = await fixSchoolStudentLinking(email || user?.email || undefined);
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n') + '\n\n' + `Resultado: ${result.success ? '✅' : '❌'} ${result.message}`);
      
    } catch (error) {
      setDiagnosticResult(`Error ejecutando arreglo de vinculación: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runCurrentFix = async () => {
    setIsRunning(true);
    setDiagnosticResult('');
    
    try {
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      const result = await fixCurrentSchoolStudent();
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n') + '\n\n' + `Resultado: ${result.success ? '✅' : '❌'} ${result.message}`);
      
    } catch (error) {
      setDiagnosticResult(`Error ejecutando arreglo actual: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runDuplicateFix = async () => {
    setIsRunning(true);
    setDiagnosticResult('');
    
    try {
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      const result = await fixDuplicateAutoCreatedUser();
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n') + '\n\n' + `Resultado: ${result.success ? '✅' : '❌'} ${result.message}`);
      
    } catch (error) {
      setDiagnosticResult(`Error ejecutando arreglo de duplicado: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runSchoolStudentLinkingFix = async () => {
    setIsRunning(true);
    setDiagnosticResult('');
    
    try {
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      const { fixSchoolStudentLinking } = await import('../utils/fixCurrentSchoolStudent');
      const result = await fixSchoolStudentLinking(email || user?.email || '');
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n') + '\n\n' + `Resultado: ${result.success ? '✅' : '❌'} ${result.message}`);
      
    } catch (error) {
      setDiagnosticResult(`Error ejecutando arreglo de vinculación: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runDiagnoseSchoolStudentLinking = async () => {
    setIsRunning(true);
    setDiagnosticResult('');
    
    try {
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      const { diagnoseSchoolStudentLinking } = await import('../utils/fixCurrentSchoolStudent');
      const result = await diagnoseSchoolStudentLinking(email || user?.email || '');
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n') + '\n\n' + `Resultado: ${result.success ? '✅' : '❌'} ${result.message}`);
      
    } catch (error) {
      setDiagnosticResult(`Error ejecutando diagnóstico: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runForceLoadSchoolStudentProfile = async () => {
    setIsRunning(true);
    setDiagnosticResult('');
    
    try {
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      const { forceLoadSchoolStudentProfile } = await import('../utils/fixCurrentSchoolStudent');
      const result = await forceLoadSchoolStudentProfile(email || user?.email || '');
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n') + '\n\n' + `Resultado: ${result.success ? '✅' : '❌'} ${result.message}`);
      
    } catch (error) {
      setDiagnosticResult(`Error forzando carga de perfil: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runSwitchToSchoolStudentProfile = async () => {
    setIsRunning(true);
    setDiagnosticResult('');
    
    try {
      const originalLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      const { switchToSchoolStudentProfile } = await import('../utils/fixCurrentSchoolStudent');
      const result = await switchToSchoolStudentProfile(email || user?.email || '');
      
      console.log = originalLog;
      setDiagnosticResult(logs.join('\n') + '\n\n' + `Resultado: ${result.success ? '✅' : '❌'} ${result.message}`);
      
    } catch (error) {
      setDiagnosticResult(`Error cambiando al perfil del estudiante: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="diagnostic-container" style={{
      padding: '20px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      margin: '20px 0',
      fontFamily: 'monospace'
    }}>
      <h3 style={{ color: '#333', marginBottom: '15px' }}>
        🔍 Diagnóstico Específico para School Student
      </h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Email a diagnosticar:
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={user?.email || "Ingresa el email"}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <h4>Estado Actual:</h4>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>👤 Usuario autenticado: {user ? 'Sí' : 'No'}</li>
          <li>📧 Email: {user?.email || 'No disponible'}</li>
          <li>🏫 Es usuario escolar: {isSchoolUser ? 'Sí' : 'No'}</li>
          <li>👨‍🏫 Es profesor: {isSchoolTeacher ? 'Sí' : 'No'}</li>
          <li>👨‍🎓 Es estudiante: {isSchoolStudent ? 'Sí' : 'No'}</li>
          <li>📋 Subscription: {userProfile?.subscription || 'No disponible'}</li>
          <li>🎭 SchoolRole: {userProfile?.schoolRole || 'No disponible'}</li>
        </ul>
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <button
          onClick={runDiagnostic}
          disabled={isRunning}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            marginRight: '10px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          🔍 Ejecutar Diagnóstico
        </button>
        
        <button
          onClick={runFix}
          disabled={isRunning}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            marginRight: '10px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          🔧 Arreglar General
        </button>
        
        <button
          onClick={runLinkingFix}
          disabled={isRunning}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            marginRight: '10px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          🔗 Arreglar Vinculación
        </button>
        
        <button
          onClick={runCurrentFix}
          disabled={isRunning}
          style={{
            backgroundColor: '#ffc107',
            color: 'black',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            marginRight: '10px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          ⚡ Arreglar Actual
        </button>
        
        <button
          onClick={runDuplicateFix}
          disabled={isRunning}
          style={{
            backgroundColor: '#e83e8c',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          🗑️ Eliminar Duplicado
        </button>
        
        <button
          onClick={runSchoolStudentLinkingFix}
          disabled={isRunning}
          style={{
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            marginLeft: '10px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          🔗 Arreglar Vinculación Escolar
        </button>
        
        <button
          onClick={runDiagnoseSchoolStudentLinking}
          disabled={isRunning}
          style={{
            backgroundColor: '#fd7e14',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            marginLeft: '10px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          🔍 Diagnosticar Vinculación
        </button>
        
        <button
          onClick={runForceLoadSchoolStudentProfile}
          disabled={isRunning}
          style={{
            backgroundColor: '#20c997',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            marginLeft: '10px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          🔧 Forzar Carga de Perfil
        </button>
        
        <button
          onClick={runSwitchToSchoolStudentProfile}
          disabled={isRunning}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            marginLeft: '10px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          🔄 Cambiar a Perfil Estudiante
        </button>
      </div>
      
      {isRunning && (
        <div style={{ color: '#007bff', marginBottom: '15px' }}>
          ⏳ Ejecutando...
        </div>
      )}
      
      {diagnosticResult && (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '15px',
          maxHeight: '400px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontSize: '12px'
        }}>
          <h4>Resultado del diagnóstico:</h4>
          {diagnosticResult}
        </div>
      )}
      
      <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
        <h4>Instrucciones:</h4>
        <ol>
          <li>Ingresa el email del estudiante que está teniendo problemas</li>
          <li>Ejecuta el diagnóstico para ver qué está pasando</li>
          <li>Si el diagnóstico muestra problemas de vinculación, usa "Arreglar Vinculación"</li>
          <li>Si el diagnóstico muestra otros problemas, usa "Arreglar General"</li>
          <li>Si estás autenticado como el estudiante problemático, usa "Arreglar Actual"</li>
          <li>Recarga la página después del arreglo</li>
        </ol>
        
        <h4>Tipos de arreglo:</h4>
        <ul>
          <li><strong>Arreglar General:</strong> Crea o actualiza el perfil del estudiante en la colección users</li>
          <li><strong>Arreglar Vinculación:</strong> Resuelve conflictos entre usuarios duplicados y vincula correctamente con Google Auth</li>
          <li><strong>Arreglar Actual:</strong> Arregla específicamente el problema del usuario autenticado actual (para rubenelhore23@gmail.com)</li>
          <li><strong>Arreglar Vinculación Escolar:</strong> Vincula específicamente un estudiante escolar con su cuenta de Google Auth</li>
          <li><strong>Diagnosticar Vinculación:</strong> Analiza el estado actual de vinculación y identifica problemas específicos</li>
          <li><strong>Forzar Carga de Perfil:</strong> <strong>NUEVO</strong> - Fuerza la carga del perfil correcto del estudiante escolar</li>
          <li><strong>Cambiar a Perfil Estudiante:</strong> <strong>NUEVO</strong> - Cambia desde cualquier cuenta al perfil del estudiante escolar</li>
        </ul>
        
        <h4>Para el problema actual:</h4>
        <ol>
          <li>Ingresa el email del estudiante que creaste (ej: rubenelhore23@gmail.com)</li>
          <li>Haz clic en <strong>"🔍 Diagnosticar Vinculación"</strong> para ver qué está pasando</li>
          <li>Si el diagnóstico muestra que todo está bien pero sigue creando cuenta FREE, usa <strong>"🔄 Cambiar a Perfil Estudiante"</strong></li>
          <li>Si hay problemas de vinculación, usa <strong>"🔧 Forzar Carga de Perfil"</strong></li>
          <li>Recarga la página después del arreglo</li>
        </ol>
      </div>
    </div>
  );
};

export default SchoolStudentDiagnostic; 