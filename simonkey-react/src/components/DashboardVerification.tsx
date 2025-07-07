import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';
import '../styles/DashboardVerification.css';

interface User {
  id: string;
  email: string;
  nombre: string;
  displayName?: string;
  subscription: UserSubscriptionType;
}

interface SchoolUser {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  role: 'admin' | 'teacher' | 'student';
  schoolId?: string;
  schoolName?: string;
}

interface DashboardKPIs {
  global: {
    scoreGlobal: number;
    percentilPromedioGlobal: number;
    tiempoEstudioGlobal: number;
    estudiosInteligentesGlobal: number;
  };
  cuadernos: {
    [cuadernoId: string]: {
      scoreCuaderno: number;
      posicionRanking: number;
      percentilCuaderno: number;
      numeroConceptos: number;
      tiempoEstudioLocal: number;
      estudiosInteligentesLocal: number;
      porcentajeExitoEstudiosInteligentes: number;
      porcentajeDominioConceptos: number;
      conceptosDominados: number;
      conceptosNoDominados: number;
    };
  };
  materias?: {
    [materiaId: string]: {
      scoreMateria: number;
      percentilMateria: number;
      tiempoEstudioMateria: number;
      estudiosInteligentesMateria: number;
    };
  };
}

interface TeacherMetrics {
  global: {
    porcentajeDominioConceptos: number;
    tiempoEfectivo: number;
    tiempoActivo: number;
    estudioPromedio: number;
    scorePromedio: number;
    totalAlumnos: number;
    totalMaterias: number;
    totalCuadernos: number;
    ultimaActualizacion: any;
  };
  materias: {
    [materiaId: string]: {
      nombreMateria: string;
      porcentajeDominioConceptos: number;
      tiempoEfectivo: number;
      tiempoActivo: number;
      estudioPromedio: number;
      scorePromedio: number;
      totalAlumnos: number;
      totalCuadernos: number;
    };
  };
  cuadernos: {
    [cuadernoId: string]: {
      nombreCuaderno: string;
      materiaId: string;
      scorePromedio: number;
      porcentajeDominioConceptos: number;
      tiempoEfectivo: number;
      tiempoActivo: number;
      estudioPromedio: number;
      totalAlumnos: number;
      conceptosDominados: number;
      conceptosTotales: number;
    };
  };
  tiempoEstudioSemanal: {
    lunes: number;
    martes: number;
    miercoles: number;
    jueves: number;
    viernes: number;
    sabado: number;
    domingo: number;
  };
}

const DashboardVerification: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<'pro' | 'free' | 'school' | ''>('');
  const [isTeacher, setIsTeacher] = useState(false);
  
  // Para cuentas escolares
  const [schoolTeachers, setSchoolTeachers] = useState<SchoolUser[]>([]);
  const [schoolStudents, setSchoolStudents] = useState<SchoolUser[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  
  // Para cuentas free/pro
  const [regularUsers, setRegularUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  
  // Datos del dashboard
  const [dashboardData, setDashboardData] = useState<DashboardKPIs | TeacherMetrics | null>(null);
  const [error, setError] = useState<string>('');

  // Cargar usuarios según el tipo de cuenta
  useEffect(() => {
    if (!accountType) return;
    
    const loadUsers = async () => {
      setLoading(true);
      setError('');
      try {
        if (accountType === 'school') {
          console.log('Loading school users from users collection...');
          
          // Cargar teachers
          const teachersQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.TEACHER)
          );
          const teachersSnap = await getDocs(teachersQuery);
          const teachersData = teachersSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            role: 'teacher'
          } as SchoolUser)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
          console.log('Loaded teachers:', teachersData.length);
          setSchoolTeachers(teachersData);

          // Cargar students
          const studentsQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.STUDENT)
          );
          const studentsSnap = await getDocs(studentsQuery);
          const studentsData = studentsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            role: 'student'
          } as SchoolUser)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
          console.log('Loaded students:', studentsData.length);
          setSchoolStudents(studentsData);
        } else {
          // Cargar usuarios regulares (free/pro)
          console.log('Loading regular users for type:', accountType);
          
          if (accountType === 'pro') {
            // Para Pro, incluir también SUPER_ADMIN
            const proQuery = query(
              collection(db, 'users'),
              where('subscription', '==', 'pro')
            );
            const proSnap = await getDocs(proQuery);
            
            const superAdminQuery = query(
              collection(db, 'users'),
              where('subscription', '==', UserSubscriptionType.SUPER_ADMIN)
            );
            const superAdminSnap = await getDocs(superAdminQuery);
            
            // Combinar resultados únicos
            const allUsers = new Map();
            proSnap.docs.forEach(doc => {
              allUsers.set(doc.id, { id: doc.id, ...doc.data() });
            });
            superAdminSnap.docs.forEach(doc => {
              allUsers.set(doc.id, { id: doc.id, ...doc.data() });
            });
            
            const usersData = Array.from(allUsers.values())
              .sort((a, b) => 
                ((a.nombre || a.displayName || a.email || '').localeCompare(
                  b.nombre || b.displayName || b.email || ''
                ))
              );
            console.log('Loaded Pro + SuperAdmin users:', usersData.length);
            setRegularUsers(usersData);
          } else {
            // Para Free, solo usuarios free
            const usersQuery = query(
              collection(db, 'users'),
              where('subscription', '==', accountType)
            );
            const usersSnap = await getDocs(usersQuery);
            const usersData = usersSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as User)).sort((a, b) => 
              ((a.nombre || a.displayName || a.email || '').localeCompare(
                b.nombre || b.displayName || b.email || ''
              ))
            );
            console.log('Loaded users:', usersData.length);
            setRegularUsers(usersData);
          }
        }
      } catch (error) {
        console.error('Error loading users:', error);
        setError('Error al cargar usuarios');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [accountType]);

  // Cargar datos del dashboard cuando se selecciona un usuario
  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    setDashboardData(null);
    
    try {
      let userId = '';
      let isTeacherDashboard = false;
      
      if (accountType === 'school') {
        if (isTeacher && selectedTeacher) {
          userId = selectedTeacher;
          isTeacherDashboard = true;
        } else if (!isTeacher && selectedStudent) {
          userId = selectedStudent;
        }
      } else {
        userId = selectedUser;
      }
      
      if (!userId) {
        setError('Por favor selecciona un usuario');
        return;
      }
      
      console.log('Loading dashboard data for user:', userId, 'isTeacher:', isTeacherDashboard);
      
      if (isTeacherDashboard) {
        // Cargar métricas del profesor
        console.log('Attempting to load teacher metrics from path:', `teacherKpis/${userId}`);
        const teacherMetricsDoc = await getDoc(doc(db, 'teacherKpis', userId));
        console.log('Teacher metrics doc exists:', teacherMetricsDoc.exists());
        if (teacherMetricsDoc.exists()) {
          const data = teacherMetricsDoc.data();
          console.log('Teacher metrics data:', data);
          setDashboardData(data as TeacherMetrics);
        } else {
          setError('No se encontraron métricas para este profesor. Es posible que aún no se hayan generado.');
        }
      } else {
        // Cargar KPIs del estudiante/usuario regular
        const kpisPath = `users/${userId}/kpis/dashboard`;
        console.log('Attempting to load KPIs from path:', kpisPath);
        
        // Primero verifiquemos si el usuario existe
        const userDoc = await getDoc(doc(db, 'users', userId));
        console.log('User exists:', userDoc.exists());
        if (userDoc.exists()) {
          console.log('User data:', userDoc.data());
        }
        
        // Ahora intentemos cargar los KPIs
        const kpisDoc = await getDoc(doc(db, 'users', userId, 'kpis', 'dashboard'));
        console.log('KPIs doc exists:', kpisDoc.exists());
        
        if (kpisDoc.exists()) {
          const data = kpisDoc.data();
          console.log('KPIs data:', data);
          setDashboardData(data as DashboardKPIs);
        } else {
          // Intentemos ver si hay algún documento en la colección kpis
          console.log('Checking if kpis collection exists...');
          try {
            const kpisCollection = collection(db, 'users', userId, 'kpis');
            const kpisSnapshot = await getDocs(kpisCollection);
            console.log('Documents in kpis collection:', kpisSnapshot.size);
            kpisSnapshot.forEach(doc => {
              console.log('Document ID:', doc.id, 'Data:', doc.data());
            });
          } catch (e) {
            console.log('Error checking kpis collection:', e);
          }
          
          setError('No se encontraron KPIs para este usuario. Es posible que el usuario no haya realizado ningún estudio aún.');
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Formatear tiempo en minutos a horas y minutos
  const formatTime = (minutes: number): string => {
    if (!minutes || minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Función para verificar si los datos son de profesor
  const isTeacherMetrics = (data: any): data is TeacherMetrics => {
    return data && 'tiempoEfectivo' in (data.global || {});
  };

  return (
    <div className="dashboard-verification">
      {/* Selector de tipo de cuenta */}
      <div className="verification-section">
        <h3>Tipo de Cuenta</h3>
        <div className="account-type-selector">
          <button
            className={`type-button ${accountType === 'pro' ? 'active' : ''}`}
            onClick={() => {
              setAccountType('pro');
              // Reset selections
              setSelectedUser('');
              setSelectedTeacher('');
              setSelectedStudent('');
              setDashboardData(null);
              setIsTeacher(false);
            }}
          >
            <i className="fas fa-crown"></i> Pro
          </button>
          <button
            className={`type-button ${accountType === 'free' ? 'active' : ''}`}
            onClick={() => {
              setAccountType('free');
              // Reset selections
              setSelectedUser('');
              setSelectedTeacher('');
              setSelectedStudent('');
              setDashboardData(null);
              setIsTeacher(false);
            }}
          >
            <i className="fas fa-user"></i> Free
          </button>
          <button
            className={`type-button ${accountType === 'school' ? 'active' : ''}`}
            onClick={() => {
              setAccountType('school');
              // Reset selections
              setSelectedUser('');
              setSelectedTeacher('');
              setSelectedStudent('');
              setDashboardData(null);
              setIsTeacher(false);
            }}
          >
            <i className="fas fa-school"></i> Escolar
          </button>
        </div>
      </div>

      {/* Selector de tipo de usuario escolar */}
      {accountType === 'school' && (
        <div className="verification-section">
          <h3>Tipo de Usuario Escolar</h3>
          <div className="school-type-selector">
            <label className="radio-option">
              <input
                type="radio"
                name="schoolUserType"
                value="student"
                checked={!isTeacher}
                onChange={() => {
                  setIsTeacher(false);
                  setSelectedTeacher('');
                  setDashboardData(null);
                }}
              />
              <span>Alumno</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="schoolUserType"
                value="teacher"
                checked={isTeacher}
                onChange={() => {
                  setIsTeacher(true);
                  setSelectedStudent('');
                  setDashboardData(null);
                }}
              />
              <span>Profesor</span>
            </label>
          </div>
        </div>
      )}

      {/* Selectores condicionales según tipo de cuenta */}
      {accountType === 'school' && isTeacher && (
        <div className="verification-section">
          <h3>Profesor</h3>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
            Total de profesores: {schoolTeachers.length}
          </p>
          <div className="selector-group">
            <select
              value={selectedTeacher}
              onChange={(e) => {
                setSelectedTeacher(e.target.value);
                setDashboardData(null);
              }}
              className="form-select"
            >
              <option value="">Seleccionar profesor...</option>
              {schoolTeachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.nombre || teacher.email || 'Sin nombre'} {teacher.apellidos || ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {accountType === 'school' && !isTeacher && (
        <div className="verification-section">
          <h3>Estudiante</h3>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
            Total de estudiantes: {schoolStudents.length}
          </p>
          <div className="selector-group">
            <select
              value={selectedStudent}
              onChange={(e) => {
                setSelectedStudent(e.target.value);
                setDashboardData(null);
              }}
              className="form-select"
            >
              <option value="">Seleccionar estudiante...</option>
              {schoolStudents.map(student => (
                <option key={student.id} value={student.id}>
                  {student.nombre || student.email || 'Sin nombre'} {student.apellidos || ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {(accountType === 'free' || accountType === 'pro') && (
        <div className="verification-section">
          <h3>Usuario</h3>
          <div className="selector-group">
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setDashboardData(null);
              }}
              className="form-select"
            >
              <option value="">Seleccionar usuario...</option>
              {regularUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.nombre || user.displayName || user.email} - {user.email} {user.subscription === UserSubscriptionType.SUPER_ADMIN ? '(Super Admin)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Botón para cargar datos */}
      {((accountType === 'school' && ((isTeacher && selectedTeacher) || (!isTeacher && selectedStudent))) || 
        ((accountType === 'free' || accountType === 'pro') && selectedUser)) && (
        <div className="verification-section">
          <button 
            className="load-button"
            onClick={loadDashboardData}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Cargar Datos del Dashboard'}
          </button>
        </div>
      )}

      {/* Mostrar error si existe */}
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      {/* Mostrar datos del dashboard */}
      {dashboardData && (
        <div className="dashboard-data">
          <h3>Datos del Dashboard</h3>
          
          {isTeacherMetrics(dashboardData) ? (
            // Dashboard del Profesor
            <div className="teacher-dashboard">
              <h4>Métricas Globales del Profesor</h4>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-label">% Dominio de Conceptos (Global)</div>
                  <div className="metric-value">{dashboardData.global.porcentajeDominioConceptos}%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Tiempo Efectivo de Estudio</div>
                  <div className="metric-value">{dashboardData.global.tiempoEfectivo} min/concepto</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Tiempo Activo de Estudio</div>
                  <div className="metric-value">{formatTime(dashboardData.global.tiempoActivo)}/alumno/semana</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Estudios Promedio</div>
                  <div className="metric-value">{dashboardData.global.estudioPromedio}/alumno/semana</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Score Promedio</div>
                  <div className="metric-value">{dashboardData.global.scorePromedio}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Total de Alumnos</div>
                  <div className="metric-value">{dashboardData.global.totalAlumnos}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Total de Materias</div>
                  <div className="metric-value">{dashboardData.global.totalMaterias}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Total de Cuadernos</div>
                  <div className="metric-value">{dashboardData.global.totalCuadernos}</div>
                </div>
              </div>

              {/* Tiempo de estudio semanal */}
              <h4>Tiempo de Estudio Semanal</h4>
              <div className="weekly-time">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lunes</th>
                      <th>Martes</th>
                      <th>Miércoles</th>
                      <th>Jueves</th>
                      <th>Viernes</th>
                      <th>Sábado</th>
                      <th>Domingo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{formatTime(dashboardData.tiempoEstudioSemanal.lunes)}</td>
                      <td>{formatTime(dashboardData.tiempoEstudioSemanal.martes)}</td>
                      <td>{formatTime(dashboardData.tiempoEstudioSemanal.miercoles)}</td>
                      <td>{formatTime(dashboardData.tiempoEstudioSemanal.jueves)}</td>
                      <td>{formatTime(dashboardData.tiempoEstudioSemanal.viernes)}</td>
                      <td>{formatTime(dashboardData.tiempoEstudioSemanal.sabado)}</td>
                      <td>{formatTime(dashboardData.tiempoEstudioSemanal.domingo)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Métricas por Materia */}
              {Object.keys(dashboardData.materias).length > 0 && (
                <>
                  <h4>Métricas por Materia</h4>
                  <div className="subjects-data">
                    {Object.entries(dashboardData.materias).map(([materiaId, materia]) => (
                      <div key={materiaId} className="subject-card">
                        <h5>{materia.nombreMateria}</h5>
                        <div className="subject-metrics">
                          <div className="metric-row">
                            <span>% Dominio:</span>
                            <span>{materia.porcentajeDominioConceptos}%</span>
                          </div>
                          <div className="metric-row">
                            <span>Tiempo Efectivo:</span>
                            <span>{materia.tiempoEfectivo} min</span>
                          </div>
                          <div className="metric-row">
                            <span>Tiempo Activo:</span>
                            <span>{formatTime(materia.tiempoActivo)}</span>
                          </div>
                          <div className="metric-row">
                            <span>Estudios Promedio:</span>
                            <span>{materia.estudioPromedio}</span>
                          </div>
                          <div className="metric-row">
                            <span>Score Promedio:</span>
                            <span>{materia.scorePromedio}</span>
                          </div>
                          <div className="metric-row">
                            <span>Total Alumnos:</span>
                            <span>{materia.totalAlumnos}</span>
                          </div>
                          <div className="metric-row">
                            <span>Total Cuadernos:</span>
                            <span>{materia.totalCuadernos}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Métricas por Cuaderno */}
              {Object.keys(dashboardData.cuadernos).length > 0 && (
                <>
                  <h4>Métricas por Cuaderno</h4>
                  <div className="notebooks-data">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Cuaderno</th>
                          <th>Score Promedio</th>
                          <th>% Dominio</th>
                          <th>Tiempo Efectivo</th>
                          <th>Tiempo Activo</th>
                          <th>Estudios Promedio</th>
                          <th>Alumnos</th>
                          <th>Conceptos Dom/Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(dashboardData.cuadernos).map(([cuadernoId, cuaderno]) => (
                          <tr key={cuadernoId}>
                            <td>{cuaderno.nombreCuaderno}</td>
                            <td>{cuaderno.scorePromedio}</td>
                            <td>{cuaderno.porcentajeDominioConceptos}%</td>
                            <td>{cuaderno.tiempoEfectivo} min</td>
                            <td>{formatTime(cuaderno.tiempoActivo)}</td>
                            <td>{cuaderno.estudioPromedio}</td>
                            <td>{cuaderno.totalAlumnos}</td>
                            <td>{cuaderno.conceptosDominados}/{cuaderno.conceptosTotales}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : (
            // Dashboard del Estudiante/Usuario Regular
            <div className="student-dashboard">
              <h4>KPIs Globales</h4>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-label">Score Global</div>
                  <div className="metric-value">{dashboardData.global.scoreGlobal}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Percentil Promedio Global</div>
                  <div className="metric-value">{dashboardData.global.percentilPromedioGlobal}°</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Tiempo de Estudio Global</div>
                  <div className="metric-value">{formatTime(dashboardData.global.tiempoEstudioGlobal)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Estudios Inteligentes Global</div>
                  <div className="metric-value">{dashboardData.global.estudiosInteligentesGlobal}</div>
                </div>
              </div>

              {/* KPIs por Cuaderno */}
              {Object.keys(dashboardData.cuadernos).length > 0 && (
                <>
                  <h4>KPIs por Cuaderno</h4>
                  <div className="notebooks-data">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Cuaderno</th>
                          <th>Score</th>
                          <th>Ranking</th>
                          <th>Percentil</th>
                          <th>Conceptos</th>
                          <th>Tiempo Estudio</th>
                          <th>E. Inteligentes</th>
                          <th>% Éxito</th>
                          <th>% Dominio</th>
                          <th>Dominados/No Dom.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(dashboardData.cuadernos).map(([cuadernoId, cuaderno]) => (
                          <tr key={cuadernoId}>
                            <td>{cuadernoId}</td>
                            <td>{cuaderno.scoreCuaderno}</td>
                            <td>#{cuaderno.posicionRanking}</td>
                            <td>{cuaderno.percentilCuaderno}°</td>
                            <td>{cuaderno.numeroConceptos}</td>
                            <td>{formatTime(cuaderno.tiempoEstudioLocal)}</td>
                            <td>{cuaderno.estudiosInteligentesLocal}</td>
                            <td>{cuaderno.porcentajeExitoEstudiosInteligentes}%</td>
                            <td>{cuaderno.porcentajeDominioConceptos}%</td>
                            <td>{cuaderno.conceptosDominados}/{cuaderno.conceptosNoDominados}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* KPIs por Materia (solo para escolares) */}
              {dashboardData.materias && Object.keys(dashboardData.materias).length > 0 && (
                <>
                  <h4>KPIs por Materia</h4>
                  <div className="subjects-data">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Materia</th>
                          <th>Score</th>
                          <th>Percentil</th>
                          <th>Tiempo Estudio</th>
                          <th>Estudios Inteligentes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(dashboardData.materias).map(([materiaId, materia]) => (
                          <tr key={materiaId}>
                            <td>{materiaId}</td>
                            <td>{materia.scoreMateria}</td>
                            <td>{materia.percentilMateria}°</td>
                            <td>{formatTime(materia.tiempoEstudioMateria)}</td>
                            <td>{materia.estudiosInteligentesMateria}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mostrar el JSON completo para debugging */}
          <details className="raw-data">
            <summary>Ver datos JSON completos</summary>
            <pre>{JSON.stringify(dashboardData, null, 2)}</pre>
          </details>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando datos...</p>
        </div>
      )}
    </div>
  );
};

export default DashboardVerification;