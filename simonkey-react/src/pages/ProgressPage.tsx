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
  faBook
} from '@fortawesome/free-solid-svg-icons';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/ProgressPage.css';

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

const ProgressPage: React.FC = () => {
  const [selectedMateria, setSelectedMateria] = useState<string>('matematicas');
  const [showMateriaDropdown, setShowMateriaDropdown] = useState(false);

  // Datos dummy
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
    { posicion: 6, nombre: 'Tú', score: 1980 },
    { posicion: 7, nombre: 'Elena Sánchez', score: 1920 },
    { posicion: 8, nombre: 'Pedro Gómez', score: 1850 },
  ];

  const positionHistoryData: PositionData[] = [
    { semana: 'Sem 1', posicion: 8 },
    { semana: 'Sem 2', posicion: 7 },
    { semana: 'Sem 3', posicion: 9 },
    { semana: 'Sem 4', posicion: 6 },
    { semana: 'Sem 5', posicion: 6 },
    { semana: 'Sem 6', posicion: 5 },
    { semana: 'Sem 7', posicion: 6 },
    { semana: 'Sem 8', posicion: 6 },
  ];

  const studyTimeData: StudyTimeData[] = [
    { dia: 'Lun', tiempo: 45 },
    { dia: 'Mar', tiempo: 60 },
    { dia: 'Mié', tiempo: 30 },
    { dia: 'Jue', tiempo: 75 },
    { dia: 'Vie', tiempo: 50 },
    { dia: 'Sáb', tiempo: 90 },
    { dia: 'Dom', tiempo: 40 },
  ];

  const cuadernosData: CuadernoData[] = [
    {
      id: '1',
      nombre: 'Álgebra Lineal',
      score: 450,
      posicion: 3,
      totalAlumnos: 25,
      conceptos: 48,
      tiempoEstudio: 240,
      estudiosInteligentes: 12,
      porcentajeExito: 85,
      porcentajeDominio: 72,
      estudiosLibres: 8,
    },
    {
      id: '2',
      nombre: 'Cálculo Diferencial',
      score: 380,
      posicion: 5,
      totalAlumnos: 30,
      conceptos: 36,
      tiempoEstudio: 180,
      estudiosInteligentes: 8,
      porcentajeExito: 75,
      porcentajeDominio: 65,
      estudiosLibres: 6,
    },
    {
      id: '3',
      nombre: 'Geometría Analítica',
      score: 520,
      posicion: 2,
      totalAlumnos: 22,
      conceptos: 42,
      tiempoEstudio: 300,
      estudiosInteligentes: 15,
      porcentajeExito: 90,
      porcentajeDominio: 80,
      estudiosLibres: 10,
    },
    {
      id: '4',
      nombre: 'Estadística',
      score: 310,
      posicion: 8,
      totalAlumnos: 28,
      conceptos: 30,
      tiempoEstudio: 150,
      estudiosInteligentes: 6,
      porcentajeExito: 70,
      porcentajeDominio: 60,
      estudiosLibres: 5,
    },
  ];

  const globalScore = cuadernosData.reduce((acc, c) => acc + c.score, 0);
  const globalPercentil = 75; // Dummy
  const globalStudyTime = cuadernosData.reduce((acc, c) => acc + c.tiempoEstudio, 0);
  const globalSmartStudies = cuadernosData.reduce((acc, c) => acc + c.estudiosInteligentes, 0);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <>
      <HeaderWithHamburger title="Progreso" />
      <div className="progress-layout">
        <div className="progress-modules-row">
          <div className="progress-module-col">
            {/* Módulo 1: Score Global */}
            <div className="progress-module kpi-module">
              <div className="kpi-icon icon-trophy">
                <FontAwesomeIcon icon={faTrophy} />
              </div>
              <div className="kpi-content">
                <h3>Score Global</h3>
                <p className="kpi-value">{globalScore.toLocaleString()}</p>
                <span className="kpi-label">puntos totales</span>
              </div>
            </div>

            {/* Módulo Lateral: Selector de Materias y Ranking */}
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
                <h4>Tabla de Posiciones</h4>
                <div className="ranking-list">
                  {rankingData.map((student) => (
                    <div 
                      key={student.posicion} 
                      className={`ranking-item ${student.nombre === 'Tú' ? 'current-user' : ''}`}
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
              {/* Módulo 2: Percentil Promedio Global */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-percentil">
                  <FontAwesomeIcon icon={faBullseye} />
                </div>
                <div className="kpi-content">
                  <h3>Percentil Global</h3>
                  <p className="kpi-value">{globalPercentil}°</p>
                  <span className="kpi-label">percentil</span>
                </div>
              </div>

              {/* Módulo 3: Tiempo de Estudio Global */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-time">
                  <FontAwesomeIcon icon={faClock} />
                </div>
                <div className="kpi-content">
                  <h3>Tiempo de Estudio</h3>
                  <p className="kpi-value">{formatTime(globalStudyTime)}</p>
                  <span className="kpi-label">tiempo total</span>
                </div>
              </div>

              {/* Módulo 4: Estudios Inteligentes Global */}
              <div className="progress-module kpi-module">
                <div className="kpi-icon icon-brain">
                  <FontAwesomeIcon icon={faBrain} />
                </div>
                <div className="kpi-content">
                  <h3>Estudios Inteligentes</h3>
                  <p className="kpi-value">{globalSmartStudies}</p>
                  <span className="kpi-label">sesiones validadas</span>
                </div>
              </div>
            </div>

            {/* Módulo Inferior */}
            <div className="progress-bottom-module">
              {/* Gráficos */}
              <div className="charts-container">
                <div className="chart-section">
                  <h3><FontAwesomeIcon icon={faChartLine} className="chart-icon" /> Posicionamiento Histórico</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={positionHistoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="semana" />
                      <YAxis reversed domain={[1, 10]} />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="posicion" 
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        dot={{ fill: '#8B5CF6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-section">
                  <h3><FontAwesomeIcon icon={faCalendarAlt} className="chart-icon" /> Tiempo de Estudio Semanal</h3>
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
                <h3><FontAwesomeIcon icon={faBook} className="table-icon" /> Detalle por Cuaderno</h3>
                <div className="notebooks-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Cuaderno</th>
                        <th>Score</th>
                        <th>Posición</th>
                        <th>Conceptos</th>
                        <th>Tiempo</th>
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
                          <td className="score-cell">{cuaderno.score}</td>
                          <td className="position-cell">
                            {cuaderno.posicion}/{cuaderno.totalAlumnos}
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProgressPage;