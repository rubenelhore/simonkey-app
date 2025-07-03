import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronDown, 
  faTrophy, 
  faClock, 
  faBrain, 
  faBullseye, 
  faChartLine,
  faCalendarAlt,
  faBook,
  faLightbulb,
  faArrowUp,
  faArrowDown,
  faUserGraduate
} from '@fortawesome/free-solid-svg-icons';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import '../styles/ProgressPage.css';
import '../styles/SchoolSystem.css';

interface SchoolTeacher {
  id: string;
  nombre: string;
  email: string;
  idAdmin: string;
}

interface Materia {
  id: string;
  nombre: string;
}

interface PositionData {
  semana: string;
  posicion: number;
}

interface StudyTimeData {
  dia: string;
  tiempo: number;
}

interface CuadernoData {
  id: string;
  nombre: string;
  score: number;
  posicion: number;
  totalAlumnos: number;
  conceptos: number;
  tiempoEstudio: number;
  estudiosInteligentes: number;
  porcentajeExito: number;
  porcentajeDominio: number;
  estudiosLibres: number;
}

const SchoolAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { isSchoolAdmin } = useUserType();
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [teachers, setTeachers] = useState<SchoolTeacher[]>([]);
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [selectedMateria, setSelectedMateria] = useState<string>('matematicas');
  const [showMateriaDropdown, setShowMateriaDropdown] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cargar lista de profesores
  useEffect(() => {
    const loadTeachers = async () => {
      if (!user || !isSchoolAdmin) return;

      try {
        setLoading(true);
        // Buscar profesores asociados a este admin
        const teachersQuery = query(
          collection(db, 'users'),
          where('subscription', '==', 'school'),
          where('schoolRole', '==', 'teacher'),
          where('idAdmin', '==', user.uid)
        );

        const teachersSnapshot = await getDocs(teachersQuery);
        const teachersData: SchoolTeacher[] = [];

        teachersSnapshot.forEach((doc) => {
          const data = doc.data();
          teachersData.push({
            id: doc.id,
            nombre: data.nombre || data.displayName || '',
            email: data.email || '',
            idAdmin: data.idAdmin || ''
          });
        });

        setTeachers(teachersData);
        
        // Seleccionar el primer profesor por defecto
        if (teachersData.length > 0 && !selectedTeacher) {
          setSelectedTeacher(teachersData[0].id);
        }
      } catch (error) {
        console.error('Error loading teachers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeachers();
  }, [user, isSchoolAdmin, selectedTeacher]);

  // Datos dummy adaptados para el profesor seleccionado
  const materias: Materia[] = [
    { id: 'matematicas', nombre: 'Matemáticas' },
    { id: 'fisica', nombre: 'Física' },
    { id: 'quimica', nombre: 'Química' },
    { id: 'biologia', nombre: 'Biología' },
  ];

  const rankingData = [
    { posicion: 1, nombre: 'Juan Pérez', score: 2450 },
    { posicion: 2, nombre: 'María García', score: 2380 },
    { posicion: 3, nombre: 'Carlos López', score: 2290 },
    { posicion: 4, nombre: 'Ana Martínez', score: 2150 },
    { posicion: 5, nombre: 'Luis Rodríguez', score: 2050 },
    { posicion: 6, nombre: 'Elena Sánchez', score: 1920 },
    { posicion: 7, nombre: 'Pedro Gómez', score: 1850 },
    { posicion: 8, nombre: 'Laura Jiménez', score: 1780 },
  ];

  const positionHistoryData: PositionData[] = [
    { semana: 'Sem 1', posicion: 65 },
    { semana: 'Sem 2', posicion: 62 },
    { semana: 'Sem 3', posicion: 58 },
    { semana: 'Sem 4', posicion: 55 },
    { semana: 'Sem 5', posicion: 52 },
    { semana: 'Sem 6', posicion: 48 },
    { semana: 'Sem 7', posicion: 45 },
    { semana: 'Sem 8', posicion: 43 },
  ];

  const studyTimeData: StudyTimeData[] = [
    { dia: 'Lun', tiempo: 180 },
    { dia: 'Mar', tiempo: 220 },
    { dia: 'Mié', tiempo: 165 },
    { dia: 'Jue', tiempo: 240 },
    { dia: 'Vie', tiempo: 195 },
    { dia: 'Sáb', tiempo: 120 },
    { dia: 'Dom', tiempo: 90 },
  ];

  const cuadernosData: CuadernoData[] = [
    {
      id: '1',
      nombre: 'Álgebra Lineal',
      score: 8500,
      posicion: 3,
      totalAlumnos: 25,
      conceptos: 48,
      tiempoEstudio: 5400,
      estudiosInteligentes: 180,
      porcentajeExito: 82,
      porcentajeDominio: 75,
      estudiosLibres: 120,
    },
    {
      id: '2',
      nombre: 'Cálculo Diferencial',
      score: 7200,
      posicion: 5,
      totalAlumnos: 30,
      conceptos: 36,
      tiempoEstudio: 4200,
      estudiosInteligentes: 150,
      porcentajeExito: 78,
      porcentajeDominio: 68,
      estudiosLibres: 95,
    },
    {
      id: '3',
      nombre: 'Geometría Analítica',
      score: 9100,
      posicion: 2,
      totalAlumnos: 22,
      conceptos: 42,
      tiempoEstudio: 6300,
      estudiosInteligentes: 210,
      porcentajeExito: 88,
      porcentajeDominio: 82,
      estudiosLibres: 140,
    },
    {
      id: '4',
      nombre: 'Estadística',
      score: 6800,
      posicion: 8,
      totalAlumnos: 28,
      conceptos: 30,
      tiempoEstudio: 3600,
      estudiosInteligentes: 120,
      porcentajeExito: 72,
      porcentajeDominio: 62,
      estudiosLibres: 85,
    },
  ];

  const globalScore = cuadernosData.reduce((acc, c) => acc + c.score, 0);
  const globalPercentil = 85;
  const globalStudyTime = cuadernosData.reduce((acc, c) => acc + c.tiempoEstudio, 0);
  const globalSmartStudies = cuadernosData.reduce((acc, c) => acc + c.estudiosInteligentes, 0);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Generar insights para el admin sobre el profesor seleccionado
  const generateInsights = () => {
    const avgSuccessRate = cuadernosData.reduce((acc, c) => acc + c.porcentajeExito, 0) / cuadernosData.length;
    const avgMasteryRate = cuadernosData.reduce((acc, c) => acc + c.porcentajeDominio, 0) / cuadernosData.length;
    const totalStudents = 25;
    const activeStudents = Math.floor(totalStudents * 0.85);
    
    const selectedTeacherName = teachers.find(t => t.id === selectedTeacher)?.nombre || 'Profesor';
    
    const insights = [
      {
        id: 1,
        type: 'teacher-performance',
        title: 'Rendimiento del Profesor',
        content: `${selectedTeacherName} tiene un promedio de éxito del ${avgSuccessRate.toFixed(0)}% en sus clases, con un dominio promedio del ${avgMasteryRate.toFixed(0)}%.`,
        icon: faChartLine,
        color: avgSuccessRate > 75 ? 'green' : 'orange'
      },
      {
        id: 2,
        type: 'student-engagement',
        title: 'Participación Estudiantil',
        content: `${activeStudents} de ${totalStudents} estudiantes de ${selectedTeacherName} están activamente participando esta semana.`,
        icon: faBrain,
        color: activeStudents/totalStudents > 0.8 ? 'blue' : 'orange'
      }
    ];
    
    return insights;
  };

  const insights = generateInsights();

  // Redirigir si no es admin escolar
  useEffect(() => {
    if (!loading && !isSchoolAdmin) {
      navigate('/');
    }
  }, [loading, isSchoolAdmin, navigate]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando analítica...</p>
      </div>
    );
  }

  if (!isSchoolAdmin) {
    return null;
  }

  return (
    <>
      <HeaderWithHamburger title="Panel de Administración" subtitle="Analítica de Profesores" />
      <div className="progress-layout">
        <div className="admin-teacher-selector">
          <FontAwesomeIcon icon={faUserGraduate} className="selector-icon" />
          <button 
            className="teacher-dropdown-btn"
            onClick={() => setShowTeacherDropdown(!showTeacherDropdown)}
          >
            <span>{teachers.find(t => t.id === selectedTeacher)?.nombre || 'Seleccionar Profesor'}</span>
            <FontAwesomeIcon icon={faChevronDown} className={`dropdown-icon ${showTeacherDropdown ? 'open' : ''}`} />
          </button>
          
          {showTeacherDropdown && (
            <div className="teacher-dropdown">
              {teachers.map(teacher => (
                <div 
                  key={teacher.id}
                  className={`teacher-option ${selectedTeacher === teacher.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedTeacher(teacher.id);
                    setShowTeacherDropdown(false);
                  }}
                >
                  <span className="teacher-name">{teacher.nombre}</span>
                  <span className="teacher-email">{teacher.email}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="progress-modules-row">
          <div className="progress-module-col">
            {/* Módulo 1: Score Total de la Clase */}
            <div className="progress-module kpi-module">
              <div className="kpi-icon icon-trophy">
                <FontAwesomeIcon icon={faTrophy} />
              </div>
              <div className="kpi-content">
                <h3>Score Total Clase</h3>
                <p className="kpi-value">{globalScore.toLocaleString()}</p>
                <span className="kpi-label">puntos acumulados</span>
              </div>
            </div>

            {/* Módulo Lateral: Selector de Materias y Ranking de Estudiantes */}
            <div className="progress-side-module">
              <div className="materia-selector">
                <button 
                  className="materia-dropdown-btn"
                  onClick={() => setShowMateriaDropdown(!showMateriaDropdown)}
                >
                  <span>{materias.find(m => m.id === selectedMateria)?.nombre}</span>
                  <FontAwesomeIcon icon={faChevronDown} className={`dropdown-icon ${showMateriaDropdown ? 'open' : ''}`} />
                </button>
                
                {showMateriaDropdown && (
                  <div className="materia-dropdown">
                    {materias.map(materia => (
                      <div 
                        key={materia.id}
                        className={`materia-option ${selectedMateria === materia.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedMateria(materia.id);
                          setShowMateriaDropdown(false);
                        }}
                      >
                        {materia.nombre}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ranking-table">
                <h4>Top Estudiantes</h4>
                <div className="ranking-list">
                  {rankingData.map((student) => (
                    <div 
                      key={student.posicion} 
                      className="ranking-item"
                    >
                      <span className="ranking-position">#{student.posicion}</span>
                      <span className="ranking-name">{student.nombre}</span>
                      <span className="ranking-score">{student.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="progress-modules-right">
            <div className="progress-modules-right-row">
              {/* Módulo 2: Percentil Promedio de la Clase */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-percentil">
                  <FontAwesomeIcon icon={faBullseye} />
                </div>
                <div className="kpi-content">
                  <h3>Percentil Promedio</h3>
                  <p className="kpi-value">{globalPercentil}°</p>
                  <span className="kpi-label">percentil clase</span>
                </div>
              </div>

              {/* Módulo 3: Tiempo de Estudio Total */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-time">
                  <FontAwesomeIcon icon={faClock} />
                </div>
                <div className="kpi-content">
                  <h3>Tiempo Total Estudio</h3>
                  <p className="kpi-value">{formatTime(globalStudyTime)}</p>
                  <span className="kpi-label">tiempo acumulado</span>
                </div>
              </div>

              {/* Módulo 4: Estudios Inteligentes Totales */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-brain">
                  <FontAwesomeIcon icon={faBrain} />
                </div>
                <div className="kpi-content">
                  <h3>Estudios Inteligentes</h3>
                  <p className="kpi-value">{globalSmartStudies}</p>
                  <span className="kpi-label">sesiones totales</span>
                </div>
              </div>
            </div>

            {/* Módulo Inferior */}
            <div className="progress-bottom-module">
              {/* Gráficos */}
              <div className="charts-container">
                <div className="chart-section">
                  <h3><FontAwesomeIcon icon={faChartLine} className="chart-icon" /> Promedio de Calificaciones</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={positionHistoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="semana" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="posicion" 
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        dot={{ fill: '#8B5CF6' }}
                        name="Promedio %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-section">
                  <h3><FontAwesomeIcon icon={faCalendarAlt} className="chart-icon" /> Tiempo de Estudio por Día</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={studyTimeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dia" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${value} min`} />
                      <Bar dataKey="tiempo" fill="#10B981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabla de Cuadernos */}
              <div className="notebooks-table-container">
                <h3><FontAwesomeIcon icon={faBook} className="table-icon" /> Rendimiento por Cuaderno</h3>
                <div className="notebooks-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Cuaderno</th>
                        <th>Score Total</th>
                        <th>Ranking</th>
                        <th>Conceptos</th>
                        <th>Tiempo Total</th>
                        <th>E. Inteligentes</th>
                        <th>% Éxito</th>
                        <th>% Dominio</th>
                        <th>E. Libres</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuadernosData.map((cuaderno) => (
                        <tr key={cuaderno.id}>
                          <td className="notebook-name">{cuaderno.nombre}</td>
                          <td className="score-cell">{cuaderno.score.toLocaleString()}</td>
                          <td className="position-cell">
                            Top {cuaderno.posicion}
                          </td>
                          <td>{cuaderno.conceptos}</td>
                          <td>{formatTime(cuaderno.tiempoEstudio)}</td>
                          <td className="smart-studies">{cuaderno.estudiosInteligentes}</td>
                          <td className="percentage success">{cuaderno.porcentajeExito}%</td>
                          <td className="percentage mastery">{cuaderno.porcentajeDominio}%</td>
                          <td>{cuaderno.estudiosLibres}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Módulo de Insights para Administradores */}
              <div className="insights-module">
                <div className="insights-header">
                  <FontAwesomeIcon icon={faLightbulb} className="insights-header-icon" />
                  <h3>Insights del Profesor</h3>
                </div>
                <div className="insights-grid">
                  {insights.map((insight) => (
                    <div key={insight.id} className={`insight-card ${insight.color}`}>
                      <div className="insight-icon">
                        <FontAwesomeIcon icon={insight.icon} />
                      </div>
                      <div className="insight-content">
                        <h4>{insight.title}</h4>
                        <p>{insight.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SchoolAdminPage;