import React, { useState } from 'react';
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
  faPercent,
  faStopwatch,
  faUserClock,
  faGraduationCap
} from '@fortawesome/free-solid-svg-icons';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/ProgressPage.css';

interface Materia {
  id: string;
  nombre: string;
}

interface ScoreData {
  cuaderno: string;
  scorePromedio: number;
}

interface StudyTimeData {
  dia: string;
  tiempo: number;
}

interface ConceptoRanking {
  nombre: string;
  porcentajeDominio: number;
}

interface CuadernoData {
  id: string;
  nombre: string;
  porcentajeDominio: number;
  tiempoEfectivo: number; // minutos promedio por alumno por concepto
  tiempoActivo: number; // minutos promedio por alumno por semana
  estudioPromedio: number; // número de estudios inteligentes promedio por alumno por semana
  topConceptos: ConceptoRanking[];
  lowConceptos: ConceptoRanking[];
}

const SchoolTeacherAnalyticsPage: React.FC = () => {
  const [selectedMateria, setSelectedMateria] = useState<string>('matematicas');
  const [showMateriaDropdown, setShowMateriaDropdown] = useState(false);

  // Datos dummy adaptados para profesores
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

  // Datos dummy para score promedio por cuaderno
  const scorePromedioData: ScoreData[] = [
    { cuaderno: 'Álgebra', scorePromedio: 340 },
    { cuaderno: 'Cálculo', scorePromedio: 288 },
    { cuaderno: 'Geometría', scorePromedio: 410 },
    { cuaderno: 'Estadística', scorePromedio: 243 },
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
      porcentajeDominio: 75,
      tiempoEfectivo: 15, // 15 minutos promedio por concepto
      tiempoActivo: 180, // 180 minutos promedio por semana
      estudioPromedio: 4.2, // 4.2 estudios inteligentes promedio por semana
      topConceptos: [
        { nombre: 'Matrices', porcentajeDominio: 92 },
        { nombre: 'Determinantes', porcentajeDominio: 88 },
        { nombre: 'Vectores', porcentajeDominio: 85 },
        { nombre: 'Sistemas lineales', porcentajeDominio: 83 },
        { nombre: 'Espacios vectoriales', porcentajeDominio: 81 }
      ],
      lowConceptos: [
        { nombre: 'Transformaciones lineales', porcentajeDominio: 45 },
        { nombre: 'Eigenvalores', porcentajeDominio: 48 },
        { nombre: 'Diagonalización', porcentajeDominio: 52 },
        { nombre: 'Producto interno', porcentajeDominio: 55 },
        { nombre: 'Ortogonalización', porcentajeDominio: 58 }
      ]
    },
    {
      id: '2',
      nombre: 'Cálculo Diferencial',
      porcentajeDominio: 68,
      tiempoEfectivo: 18,
      tiempoActivo: 140,
      estudioPromedio: 3.5,
      topConceptos: [
        { nombre: 'Límites básicos', porcentajeDominio: 90 },
        { nombre: 'Derivadas simples', porcentajeDominio: 87 },
        { nombre: 'Regla de la cadena', porcentajeDominio: 82 },
        { nombre: 'Optimización', porcentajeDominio: 79 },
        { nombre: 'Tangentes', porcentajeDominio: 77 }
      ],
      lowConceptos: [
        { nombre: 'Series de Taylor', porcentajeDominio: 42 },
        { nombre: 'Integrales implícitas', porcentajeDominio: 46 },
        { nombre: 'Aplicaciones físicas', porcentajeDominio: 50 },
        { nombre: 'Problemas de tasa', porcentajeDominio: 53 },
        { nombre: 'Derivadas parciales', porcentajeDominio: 56 }
      ]
    },
    {
      id: '3',
      nombre: 'Geometría Analítica',
      porcentajeDominio: 82,
      tiempoEfectivo: 12,
      tiempoActivo: 210,
      estudioPromedio: 5.1,
      topConceptos: [
        { nombre: 'Rectas', porcentajeDominio: 95 },
        { nombre: 'Circunferencias', porcentajeDominio: 92 },
        { nombre: 'Parábolas', porcentajeDominio: 89 },
        { nombre: 'Elipses', porcentajeDominio: 86 },
        { nombre: 'Hipérbolas', porcentajeDominio: 84 }
      ],
      lowConceptos: [
        { nombre: 'Rotación de ejes', porcentajeDominio: 60 },
        { nombre: 'Superficies 3D', porcentajeDominio: 62 },
        { nombre: 'Coordenadas polares', porcentajeDominio: 65 },
        { nombre: 'Ecuaciones paramétricas', porcentajeDominio: 68 },
        { nombre: 'Transformaciones', porcentajeDominio: 70 }
      ]
    },
    {
      id: '4',
      nombre: 'Estadística',
      porcentajeDominio: 62,
      tiempoEfectivo: 20,
      tiempoActivo: 120,
      estudioPromedio: 2.8,
      topConceptos: [
        { nombre: 'Media y mediana', porcentajeDominio: 88 },
        { nombre: 'Varianza', porcentajeDominio: 82 },
        { nombre: 'Distribución normal', porcentajeDominio: 78 },
        { nombre: 'Correlación', porcentajeDominio: 75 },
        { nombre: 'Probabilidad básica', porcentajeDominio: 73 }
      ],
      lowConceptos: [
        { nombre: 'Pruebas de hipótesis', porcentajeDominio: 38 },
        { nombre: 'ANOVA', porcentajeDominio: 42 },
        { nombre: 'Regresión múltiple', porcentajeDominio: 45 },
        { nombre: 'Intervalos de confianza', porcentajeDominio: 48 },
        { nombre: 'Distribuciones especiales', porcentajeDominio: 51 }
      ]
    },
  ];

  // Métricas globales (promedio de todos los cuadernos)
  const globalDominioConceptos = Math.round(cuadernosData.reduce((acc, c) => acc + c.porcentajeDominio, 0) / cuadernosData.length);
  const globalTiempoEfectivo = Math.round(cuadernosData.reduce((acc, c) => acc + c.tiempoEfectivo, 0) / cuadernosData.length);
  const globalTiempoActivo = Math.round(cuadernosData.reduce((acc, c) => acc + c.tiempoActivo, 0) / cuadernosData.length);
  const globalEstudioPromedio = (cuadernosData.reduce((acc, c) => acc + c.estudioPromedio, 0) / cuadernosData.length).toFixed(1);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Generar insights para profesores
  const generateInsights = () => {
    const avgMasteryRate = cuadernosData.reduce((acc, c) => acc + c.porcentajeDominio, 0) / cuadernosData.length;
    const totalStudents = 25; // Número promedio de estudiantes
    const activeStudents = Math.floor(totalStudents * 0.85); // 85% de estudiantes activos
    
    const insights = [
      {
        id: 1,
        type: 'class-performance',
        title: 'Rendimiento de la Clase',
        content: `El dominio promedio de conceptos en tu clase es del ${avgMasteryRate.toFixed(0)}%, con un tiempo efectivo de ${globalTiempoEfectivo} minutos por concepto.`,
        icon: faChartLine,
        color: avgMasteryRate > 75 ? 'green' : 'orange'
      },
      {
        id: 2,
        type: 'student-engagement',
        title: 'Participación Estudiantil',
        content: `${activeStudents} de ${totalStudents} estudiantes están activamente participando en las actividades esta semana.`,
        icon: faBrain,
        color: activeStudents/totalStudents > 0.8 ? 'blue' : 'orange'
      }
    ];
    
    return insights;
  };

  const insights = generateInsights();

  return (
    <>
      <HeaderWithHamburger title="Analítica del Profesor" />
      <div className="progress-layout">
        <div className="progress-modules-row">
          <div className="progress-module-col">
            {/* Módulo 1: % Dominio de Conceptos Global */}
            <div className="progress-module kpi-module">
              <div className="kpi-icon icon-trophy">
                <FontAwesomeIcon icon={faPercent} />
              </div>
              <div className="kpi-content">
                <h3>Dominio de Conceptos</h3>
                <p className="kpi-value">{globalDominioConceptos}%</p>
                <span className="kpi-label">promedio global</span>
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
              {/* Módulo 2: Tiempo Efectivo de Estudio */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-percentil">
                  <FontAwesomeIcon icon={faStopwatch} />
                </div>
                <div className="kpi-content">
                  <h3>Tiempo Efectivo</h3>
                  <p className="kpi-value">{globalTiempoEfectivo} min</p>
                  <span className="kpi-label">por concepto</span>
                </div>
              </div>

              {/* Módulo 3: Tiempo Activo de Estudio */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-time">
                  <FontAwesomeIcon icon={faUserClock} />
                </div>
                <div className="kpi-content">
                  <h3>Tiempo Activo</h3>
                  <p className="kpi-value">{formatTime(globalTiempoActivo)}</p>
                  <span className="kpi-label">por alumno/semana</span>
                </div>
              </div>

              {/* Módulo 4: Estudios Promedio */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-brain">
                  <FontAwesomeIcon icon={faGraduationCap} />
                </div>
                <div className="kpi-content">
                  <h3>Estudios Promedio</h3>
                  <p className="kpi-value">{globalEstudioPromedio}</p>
                  <span className="kpi-label">por alumno/semana</span>
                </div>
              </div>
            </div>

            {/* Módulo Inferior */}
            <div className="progress-bottom-module">
              {/* Gráficos */}
              <div className="charts-container">
                <div className="chart-section">
                  <h3><FontAwesomeIcon icon={faChartLine} className="chart-icon" /> Score Promedio por Cuaderno</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={scorePromedioData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cuaderno" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${value} pts`} />
                      <Bar dataKey="scorePromedio" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                    </BarChart>
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
                        <th>% Dominio</th>
                        <th>Tiempo Efectivo</th>
                        <th>Tiempo Activo</th>
                        <th>Estudio Promedio</th>
                        <th>Top 5 Conceptos</th>
                        <th>Low 5 Conceptos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuadernosData.map((cuaderno) => (
                        <tr key={cuaderno.id}>
                          <td className="notebook-name">{cuaderno.nombre}</td>
                          <td className="percentage mastery">{cuaderno.porcentajeDominio}%</td>
                          <td>{cuaderno.tiempoEfectivo} min</td>
                          <td>{formatTime(cuaderno.tiempoActivo)}</td>
                          <td className="smart-studies">{cuaderno.estudioPromedio}</td>
                          <td>
                            <div className="concepts-wrapper">
                              {cuaderno.topConceptos.map((concepto, idx) => (
                                <div key={idx} className="concept-item top">
                                  <span className="concept-name">{concepto.nombre}</span>
                                  <span className="concept-percentage">{concepto.porcentajeDominio}%</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="concepts-wrapper">
                              {cuaderno.lowConceptos.map((concepto, idx) => (
                                <div key={idx} className="concept-item low">
                                  <span className="concept-name">{concepto.nombre}</span>
                                  <span className="concept-percentage">{concepto.porcentajeDominio}%</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Módulo de Insights para Profesores */}
              <div className="insights-module">
                <div className="insights-header">
                  <FontAwesomeIcon icon={faLightbulb} className="insights-header-icon" />
                  <h3>Insights de la Clase</h3>
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

export default SchoolTeacherAnalyticsPage;