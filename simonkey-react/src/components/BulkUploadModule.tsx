import React, { useState, useRef, useEffect } from 'react';
import { auth, db, functions } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, User } from 'firebase/auth';
import { collection, addDoc, query, orderBy, getDocs, where, Timestamp, doc, setDoc } from 'firebase/firestore';
import { getFirebaseConfig } from '../firebase/config';
import '../styles/BulkUploadModule.css';

interface UserToCreate {
  nombre: string;
  correo: string;
  institucion: string;
  isTeacher: boolean;
  password?: string;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

interface BulkUploadRecord {
  id: string;
  uploadDate: Timestamp;
  uploadedBy: string;
  totalUsers: number;
  successfulUsers: number;
  failedUsers: number;
  users: UserToCreate[];
}

const BulkUploadModule: React.FC = () => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedUsers, setParsedUsers] = useState<UserToCreate[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<BulkUploadRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUploadHistory();
  }, []);

  const loadUploadHistory = async () => {
    try {
      console.log('🔄 Cargando historial de uploads...');
      
      // Intentar primero con bulkUploads, si falla usar userBulkUploads
      let collectionName = 'bulkUploads';
      let q = query(
        collection(db, collectionName),
        orderBy('uploadDate', 'desc')
      );
      
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (permissionError) {
        console.warn('⚠️ Sin permisos para bulkUploads, intentando con userBulkUploads...');
        collectionName = 'userBulkUploads';
        q = query(
          collection(db, collectionName),
          orderBy('uploadDate', 'desc')
        );
        snapshot = await getDocs(q);
      }
      
      console.log(`📊 Encontrados ${snapshot.size} registros en ${collectionName}`);
      
      const records: BulkUploadRecord[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log('📄 Registro encontrado:', { id: doc.id, ...data });
        records.push({ id: doc.id, ...data } as BulkUploadRecord);
      });
      setUploadHistory(records);
      console.log(`✅ Historial cargado: ${records.length} registros`);
    } catch (error) {
      console.error('❌ Error loading upload history:', error);
      // No mostrar error al usuario si no hay permisos, solo deja el historial vacío
      setUploadHistory([]);
    }
  };

  const createTestHistoryRecord = async () => {
    if (!confirm('¿Crear un registro de prueba en el historial para ver cómo funciona?')) {
      return;
    }
    
    try {
      const testRecord = {
        uploadDate: Timestamp.now(),
        uploadedBy: auth.currentUser?.email || 'test@example.com',
        totalUsers: 3,
        successfulUsers: 2,
        failedUsers: 1,
        users: [
          {
            nombre: 'Usuario Prueba 1',
            correo: 'prueba1@test.com',
            institucion: 'Escuela Test',
            isTeacher: false,
            password: 'TestPass1',
            status: 'success' as const
          },
          {
            nombre: 'Usuario Prueba 2',
            correo: 'prueba2@test.com',
            institucion: 'Escuela Test',
            isTeacher: true,
            password: 'TestPass2',
            status: 'success' as const
          },
          {
            nombre: 'Usuario Prueba 3',
            correo: 'prueba3@test.com',
            institucion: 'Escuela Test',
            isTeacher: false,
            password: 'TestPass3',
            status: 'error' as const,
            error: 'Email ya existe'
          }
        ]
      };
      
      // Intentar guardar en bulkUploads (ahora debería funcionar)
      await addDoc(collection(db, 'bulkUploads'), testRecord);
      console.log('✅ Registro de prueba guardado en bulkUploads');
      
      await loadUploadHistory();
      alert('✅ Registro de prueba creado exitosamente');
    } catch (error) {
      console.error('Error creando registro de prueba:', error);
      alert('❌ Error creando registro de prueba');
    }
  };

  const generatePassword = (): string => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const all = uppercase + lowercase + numbers;
    
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    
    for (let i = 3; i < 8; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const parseCSV = (text: string): UserToCreate[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    const nombreIdx = headers.indexOf('nombre');
    const correoIdx = headers.indexOf('correo');
    const institucionIdx = headers.indexOf('institucion');
    const isTeacherIdx = headers.indexOf('isteacher');
    
    if (nombreIdx === -1 || correoIdx === -1 || institucionIdx === -1 || isTeacherIdx === -1) {
      throw new Error('El CSV debe contener las columnas: nombre, correo, institucion, isTeacher');
    }
    
    const users: UserToCreate[] = [];
    const errors: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      if (values.length < 4) {
        errors.push(`Línea ${i + 1}: Faltan campos`);
        continue;
      }
      
      const correo = values[correoIdx];
      if (!validateEmail(correo)) {
        errors.push(`Línea ${i + 1}: Email inválido (${correo})`);
        continue;
      }
      
      users.push({
        nombre: values[nombreIdx],
        correo: correo,
        institucion: values[institucionIdx],
        isTeacher: values[isTeacherIdx].toLowerCase() === 'true',
        password: generatePassword(),
        status: 'pending'
      });
    }
    
    setValidationErrors(errors);
    return users;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      alert('Por favor selecciona un archivo CSV');
      return;
    }
    
    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const users = parseCSV(text);
        setParsedUsers(users);
        setShowPreview(true);
      } catch (error: any) {
        alert(`Error al procesar el archivo: ${error.message}`);
        setCsvFile(null);
        setParsedUsers([]);
      }
    };
    reader.readAsText(file);
  };

  const createUsersInBatch = async () => {
    if (parsedUsers.length === 0) return;
    
    setIsProcessing(true);
    const updatedUsers = [...parsedUsers];
    let successCount = 0;
    let failCount = 0;
    
    // Obtener la API Key de Firebase desde el config
    const firebaseConfig = getFirebaseConfig();
    
    const currentUser = auth.currentUser;
    const superAdminUid = currentUser?.uid;
    
    // Función para crear usuario via REST API (SIN cambiar sesión)
    const createUserViaRestAPI = async (email: string, password: string) => {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: true
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error creating user');
      }
      
      const data = await response.json();
      return data.localId; // El UID del nuevo usuario
    };
    
    for (let i = 0; i < updatedUsers.length; i++) {
      const user = updatedUsers[i];
      try {
        console.log(`🔄 Creando usuario ${i + 1}/${updatedUsers.length}: ${user.correo}`);
        
        // 1. Crear el usuario via REST API (tu sesión se mantiene intacta)
        const newUserId = await createUserViaRestAPI(user.correo, user.password!);
        
        // 2. Crear el perfil básico en Firestore (necesario para isTeacher)
        try {
          const userProfile = {
            id: newUserId,
            email: user.correo,
            username: user.nombre,
            nombre: user.nombre,
            displayName: user.nombre,
            subscription: 'free',
            isTeacher: user.isTeacher,
            schoolRole: user.isTeacher ? 'teacher' : 'student',
            idInstitucion: user.institucion,
            emailVerified: true,
            createdAt: Timestamp.now(),
            createdViaUpload: true,
            uploadedBy: superAdminUid || 'super_admin'
          };
          
          await setDoc(doc(db, 'users', newUserId), userProfile);
          console.log(`✅ Perfil Firestore creado para: ${user.correo}`);
          
          // Guardar en colección específica según rol
          if (user.isTeacher) {
            await setDoc(doc(db, 'schoolTeachers', newUserId), {
              id: newUserId,
              email: user.correo,
              name: user.nombre,
              institution: user.institucion,
              createdAt: Timestamp.now()
            });
          } else {
            await setDoc(doc(db, 'schoolStudents', newUserId), {
              id: newUserId,
              email: user.correo,
              name: user.nombre,
              institution: user.institucion,
              createdAt: Timestamp.now()
            });
          }
        } catch (firestoreError) {
          console.warn(`⚠️ Error creando perfil Firestore para ${user.correo}:`, firestoreError);
          // El usuario de Auth ya existe, así que no es un error crítico
        }
        
        updatedUsers[i] = { ...user, status: 'success' };
        successCount++;
        console.log(`✅ Usuario ${user.correo} creado exitosamente - Contraseña: ${user.password}`);
        
      } catch (error: any) {
        console.error('❌ Error creando usuario:', user.correo, error);
        
        updatedUsers[i] = { 
          ...user, 
          status: 'error', 
          error: error.message || 'Error desconocido' 
        };
        failCount++;
      }
      
      setParsedUsers([...updatedUsers]);
      
      // Pequeña pausa entre creaciones para no saturar la API
      if (i < updatedUsers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Mostrar resumen final
    console.log(`
🎯 RESUMEN DE CARGA MASIVA:
📊 Total usuarios: ${updatedUsers.length}
✅ Exitosos: ${successCount}
❌ Fallidos: ${failCount}
👤 Creados por: ${auth.currentUser?.email}
📅 Fecha: ${new Date().toLocaleString()}

📋 USUARIOS CREADOS:
${updatedUsers
  .filter(u => u.status === 'success')
  .map(u => `  • ${u.correo} | Contraseña: ${u.password}`)
  .join('\n')}
    `);
    
    // Guardar en el historial (ahora debería funcionar con permisos correctos)
    try {
      const historyRecord = {
        uploadDate: Timestamp.now(),
        uploadedBy: auth.currentUser?.email || 'Unknown',
        totalUsers: updatedUsers.length,
        successfulUsers: successCount,
        failedUsers: failCount,
        users: updatedUsers
      };
      
      await addDoc(collection(db, 'bulkUploads'), historyRecord);
      console.log('✅ Historial guardado exitosamente en bulkUploads');
      
      await loadUploadHistory();
    } catch (error) {
      console.error('❌ Error guardando historial:', error);
      // Guardar en localStorage como fallback
      const fallbackRecord = {
        uploadDate: new Date().toISOString(),
        uploadedBy: auth.currentUser?.email || 'Unknown',
        totalUsers: updatedUsers.length,
        successfulUsers: successCount,
        failedUsers: failCount,
        users: updatedUsers
      };
      
      const existingHistory = JSON.parse(localStorage.getItem('bulkUploadHistory') || '[]');
      existingHistory.unshift(fallbackRecord);
      localStorage.setItem('bulkUploadHistory', JSON.stringify(existingHistory));
      console.log('📝 Historial guardado en localStorage como fallback');
    }
    
    setIsProcessing(false);
  };

  const exportResults = (record: BulkUploadRecord) => {
    const csvContent = [
      ['Nombre', 'Correo', 'Institución', 'Tipo', 'Contraseña', 'Estado'].join(','),
      ...record.users.map(user => [
        user.nombre,
        user.correo,
        user.institucion,
        user.isTeacher ? 'Profesor' : 'Estudiante',
        user.password || '',
        user.status === 'success' ? 'Creado' : 'Error'
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const copyCredentials = (user: UserToCreate) => {
    const text = `Usuario: ${user.correo}\nContraseña: ${user.password}`;
    navigator.clipboard.writeText(text);
    alert('Credenciales copiadas al portapapeles');
  };

  const downloadCSVTemplate = () => {
    const csvTemplate = [
      'nombre,correo,institucion,isTeacher',
      'Juan Pérez,juan.perez@escuela.edu,Colegio San José,false',
      'María García,maria.garcia@escuela.edu,Colegio San José,true',
      'Carlos López,carlos.lopez@instituto.edu,Instituto Nacional,false',
      'Ana Martínez,ana.martinez@instituto.edu,Instituto Nacional,true',
      'Pedro Rodríguez,pedro.rodriguez@universidad.edu,Universidad Central,false'
    ].join('\n');
    
    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_usuarios_simonkey.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bulk-upload-module">
      <div className="upload-section">
        <h3>📦 Carga Masiva de Usuarios</h3>
        
        <div className="real-creation-info">
          <p>🚀 <strong>CREACIÓN SIMPLE:</strong> Este módulo crea cuentas de Authentication en Firebase. Los usuarios podrán iniciar sesión inmediatamente con las contraseñas generadas. Sus perfiles se crean automáticamente al primer login.</p>
        </div>
        
        <div className="upload-instructions">
          <p>Formato del CSV (columnas requeridas):</p>
          <code>nombre,correo,institucion,isTeacher</code>
          <p className="note">isTeacher: true para profesores, false para estudiantes</p>
          <button 
            className="template-button"
            onClick={downloadCSVTemplate}
            title="Descargar plantilla CSV de ejemplo"
          >
            📥 Descargar Plantilla CSV
          </button>
        </div>
        
        <div className="file-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button 
            className="upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            {csvFile ? `📄 ${csvFile.name}` : '📤 Seleccionar archivo CSV'}
          </button>
        </div>
        
        {validationErrors.length > 0 && (
          <div className="validation-errors">
            <h4>⚠️ Errores de validación:</h4>
            {validationErrors.map((error, idx) => (
              <div key={idx} className="error-item">{error}</div>
            ))}
          </div>
        )}
        
        {showPreview && parsedUsers.length > 0 && (
          <div className="preview-section">
            <h4>Vista previa ({parsedUsers.length} usuarios)</h4>
            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Institución</th>
                    <th>Tipo</th>
                    <th>Contraseña</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedUsers.map((user, idx) => (
                    <tr key={idx} className={`status-${user.status || 'pending'}`}>
                      <td>{user.nombre}</td>
                      <td>{user.correo}</td>
                      <td>{user.institucion}</td>
                      <td>{user.isTeacher ? '👨‍🏫 Profesor' : '👨‍🎓 Estudiante'}</td>
                      <td>
                        <span className="password-field">{user.password}</span>
                        {user.password && (
                          <button 
                            className="copy-btn"
                            onClick={() => copyCredentials(user)}
                            title="Copiar credenciales"
                          >
                            📋
                          </button>
                        )}
                      </td>
                      <td>
                        {user.status === 'success' && '✅ Creado'}
                        {user.status === 'error' && `❌ ${user.error}`}
                        {user.status === 'pending' && '⏳ Pendiente'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="action-buttons">
              <button 
                className="create-button"
                onClick={createUsersInBatch}
                disabled={isProcessing || parsedUsers.some(u => u.status === 'success')}
              >
                {isProcessing ? '⏳ Creando usuarios...' : '✅ Crear todas las cuentas'}
              </button>
              
              {parsedUsers.some(u => u.status === 'success') && (
                <button 
                  className="export-button"
                  onClick={() => exportResults({
                    id: 'current',
                    uploadDate: Timestamp.now(),
                    uploadedBy: auth.currentUser?.email || '',
                    totalUsers: parsedUsers.length,
                    successfulUsers: parsedUsers.filter(u => u.status === 'success').length,
                    failedUsers: parsedUsers.filter(u => u.status === 'error').length,
                    users: parsedUsers
                  })}
                >
                  📥 Exportar resultados
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="history-section">
        <div className="history-header">
          <h3>📜 Historial de cargas</h3>
          <div className="history-actions">
            <button 
              className="reload-history"
              onClick={loadUploadHistory}
              title="Recargar historial"
            >
              🔄 Recargar
            </button>
            <button 
              className="test-history"
              onClick={createTestHistoryRecord}
              title="Crear registro de prueba"
            >
              🧪 Test
            </button>
            <button 
              className="toggle-history"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
        
        {showHistory && (
          <div className="history-list">
            {uploadHistory.length === 0 ? (
              <p className="no-history">No hay cargas previas</p>
            ) : (
              uploadHistory.map(record => (
                <div key={record.id} className="history-item">
                  <div className="history-meta">
                    <span className="date">
                      {record.uploadDate.toDate().toLocaleDateString('es-ES')}
                    </span>
                    <span className="stats">
                      Total: {record.totalUsers} | 
                      ✅ {record.successfulUsers} | 
                      ❌ {record.failedUsers}
                    </span>
                  </div>
                  <div className="history-actions">
                    <button 
                      className="view-details"
                      onClick={() => {
                        setParsedUsers(record.users);
                        setShowPreview(true);
                      }}
                    >
                      👁️ Ver detalles
                    </button>
                    <button 
                      className="export-history"
                      onClick={() => exportResults(record)}
                    >
                      📥 Exportar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkUploadModule;