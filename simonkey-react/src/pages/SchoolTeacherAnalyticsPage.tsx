import React, { useState, useEffect } from 'react';
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
  faGraduationCap,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { teacherKpiService } from '../services/teacherKpiService';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
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
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const [showMateriaDropdown, setShowMateriaDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teacherMetrics, setTeacherMetrics] = useState<any>(null);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [scorePromedioData, setScorePromedioData] = useState<ScoreData[]>([]);
  const [studyTimeData, setStudyTimeData] = useState<StudyTimeData[]>([]);
  const [cuadernosData, setCuadernosData] = useState<CuadernoData[]>([]);

  // Cargar métricas del profesor al montar el componente
  useEffect(() => {
    loadTeacherMetrics();
  }, []);

  // Procesar datos cuando cambien las métricas o la materia seleccionada
  useEffect(() => {
    if (teacherMetrics) {
      processMaterias();
      processRankingData();
      processStudyTimeData();
      processCuadernosData();
    }
  }, [teacherMetrics, selectedMateria]);

  const loadTeacherMetrics = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('[TeacherAnalytics] Cargando métricas para profesor:', auth.currentUser.uid);
      
      // Obtener métricas del profesor
      let metrics = await teacherKpiService.getTeacherMetrics(auth.currentUser.uid);
      
      if (!metrics) {
        console.log('[TeacherAnalytics] No hay métricas, actualizando...');
        // Si no hay métricas, intentar actualizarlas
        await teacherKpiService.updateTeacherMetrics(auth.currentUser.uid);
        metrics = await teacherKpiService.getTeacherMetrics(auth.currentUser.uid);
      }
      
      console.log('[TeacherAnalytics] Métricas obtenidas:', metrics);
      setTeacherMetrics(metrics);
      
    } catch (error) {
      console.error('[TeacherAnalytics] Error cargando métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const processMaterias = () => {
    if (!teacherMetrics?.materias) return;
    
    const materiasArray: Materia[] = Object.entries(teacherMetrics.materias).map(([id, data]: [string, any]) => ({
      id,
      nombre: data.nombreMateria
    }));
    
    console.log('[TeacherAnalytics] Materias procesadas:', materiasArray);
    setMaterias(materiasArray);
    
    // Seleccionar la primera materia por defecto
    if (materiasArray.length > 0 && !selectedMateria) {
      setSelectedMateria(materiasArray[0].id);
    }
  };

  const processRankingData = async () => {
    if (!teacherMetrics || !selectedMateria) return;
    
    try {
      // Obtener los estudiantes de esta materia con sus scores
      const materiaData = teacherMetrics.materias[selectedMateria];
      if (!materiaData) return;
      
      // Por ahora usamos datos de ejemplo, pero aquí se podría hacer una query real
      // para obtener el ranking de estudiantes de la materia
      const mockRanking = [
        { posicion: 1, nombre: 'Estudiante Top 1', score: Math.floor(Math.random() * 500 + 2000) },
        { posicion: 2, nombre: 'Estudiante Top 2', score: Math.floor(Math.random() * 400 + 1600) },
        { posicion: 3, nombre: 'Estudiante Top 3', score: Math.floor(Math.random() * 300 + 1300) },
        { posicion: 4, nombre: 'Estudiante Top 4', score: Math.floor(Math.random() * 300 + 1000) },
        { posicion: 5, nombre: 'Estudiante Top 5', score: Math.floor(Math.random() * 200 + 800) },
      ];
      
      setRankingData(mockRanking);
    } catch (error) {
      console.error('[TeacherAnalytics] Error procesando ranking:', error);
      setRankingData([]);
    }
  };

  const processStudyTimeData = () => {
    if (!teacherMetrics?.tiempoEstudioSemanal) {
      setStudyTimeData([
        { dia: 'Lun', tiempo: 0 },
        { dia: 'Mar', tiempo: 0 },
        { dia: 'Mié', tiempo: 0 },
        { dia: 'Jue', tiempo: 0 },
        { dia: 'Vie', tiempo: 0 },
        { dia: 'Sáb', tiempo: 0 },
        { dia: 'Dom', tiempo: 0 },
      ]);
      return;
    }
    
    const weekData = teacherMetrics.tiempoEstudioSemanal;
    const chartData: StudyTimeData[] = [
      { dia: 'Lun', tiempo: weekData.lunes || 0 },
      { dia: 'Mar', tiempo: weekData.martes || 0 },
      { dia: 'Mié', tiempo: weekData.miercoles || 0 },
      { dia: 'Jue', tiempo: weekData.jueves || 0 },
      { dia: 'Vie', tiempo: weekData.viernes || 0 },
      { dia: 'Sáb', tiempo: weekData.sabado || 0 },
      { dia: 'Dom', tiempo: weekData.domingo || 0 },
    ];
    
    console.log('[TeacherAnalytics] Tiempo de estudio semanal:', chartData);
    setStudyTimeData(chartData);
  };

  const processCuadernosData = async () => {
    if (!teacherMetrics?.cuadernos || !selectedMateria) return;
    
    try {
      const cuadernosTemp: CuadernoData[] = [];
      const scoreData: ScoreData[] = [];
      
      // Filtrar cuadernos por materia seleccionada
      for (const [cuadernoId, cuadernoData] of Object.entries(teacherMetrics.cuadernos)) {
        const data = cuadernoData as any;
        
        if (data.materiaId === selectedMateria) {
          // Para los datos de la tabla
          cuadernosTemp.push({
            id: cuadernoId,
            nombre: data.nombreCuaderno,
            porcentajeDominio: data.porcentajeDominioConceptos || 0,
            tiempoEfectivo: data.tiempoEfectivo || 0,
            tiempoActivo: data.tiempoActivo || 0,
            estudioPromedio: data.estudioPromedio || 0,
            // Por ahora, conceptos top y low son mock, pero se podrían calcular
            topConceptos: [],
            lowConceptos: []
          });
          
          // Para el gráfico de scores
          scoreData.push({
            cuaderno: data.nombreCuaderno,
            scorePromedio: data.scorePromedio || 0
          });
        }
      }
      
      console.log('[TeacherAnalytics] Cuadernos procesados:', cuadernosTemp);
      setCuadernosData(cuadernosTemp);
      setScorePromedioData(scoreData);
      
    } catch (error) {
      console.error('[TeacherAnalytics] Error procesando cuadernos:', error);
      setCuadernosData([]);
      setScorePromedioData([]);
    }
  };

  // Métricas globales desde los datos reales
  const globalDominioConceptos = teacherMetrics?.global?.porcentajeDominioConceptos || 0;
  const globalTiempoEfectivo = teacherMetrics?.global?.tiempoEfectivo || 0;
  const globalTiempoActivo = teacherMetrics?.global?.tiempoActivo || 0;
  const globalEstudioPromedio = teacherMetrics?.global?.estudioPromedio || 0;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Generar insights para profesores
  const generateInsights = () => {
    const totalStudents = teacherMetrics?.global?.totalAlumnos || 0;
    const totalMaterias = teacherMetrics?.global?.totalMaterias || 0;
    const totalCuadernos = teacherMetrics?.global?.totalCuadernos || 0;
    
    const insights = [];
    
    if (globalDominioConceptos > 0) {
      insights.push({
        id: 1,
        type: 'class-performance',
        title: 'Rendimiento de la Clase',
        content: `El dominio promedio de conceptos en tu clase es del ${globalDominioConceptos}%, con un tiempo efectivo de ${globalTiempoEfectivo} minutos por concepto.`,
        icon: faChartLine,
        color: globalDominioConceptos > 75 ? 'green' : 'orange'
      });
    }
    
    if (totalStudents > 0) {
      insights.push({
        id: 2,
        type: 'student-engagement',
        title: 'Alcance de tu Enseñanza',
        content: `Estás enseñando a ${totalStudents} estudiantes en ${totalMaterias} materias con ${totalCuadernos} cuadernos activos.`,
        icon: faBrain,
        color: 'blue'
      });
    }
    
    // Si no hay insights basados en datos, mostrar mensaje de bienvenida
    if (insights.length === 0) {
      insights.push({
        id: 3,
        type: 'welcome',
        title: 'Bienvenido a Analytics',
        content: 'Las métricas se actualizarán cuando tus estudiantes completen actividades de estudio.',
        icon: faLightbulb,
        color: 'blue'
      });
    }
    
    return insights;
  };

  const insights = generateInsights();

  if (loading && !teacherMetrics) {
    return (
      <>
        <HeaderWithHamburger title="Analítica del Profesor" />
        <div className="progress-layout">
          <div className="loading-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column' }}>
            <FontAwesomeIcon icon={faSpinner} spin size="3x" />
            <p style={{ marginTop: '1rem' }}>Cargando métricas del profesor...</p>
          </div>
        </div>
      </>
    );
  }

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
              {materias.length === 0 ? (
                <div className="no-materias-message">
                  <p>No hay materias asignadas. Contacta a tu administrador para asignar materias.</p>
                </div>
              ) : (
                <>
                  <div className="materia-dropdown-container">
                    <button 
                      className="materia-dropdown-btn"
                      onClick={() => setShowMateriaDropdown(!showMateriaDropdown)}
                      type="button"
                    >
                      <span>{materias.find(m => m.id === selectedMateria)?.nombre || 'Seleccionar materia'}</span>
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
                      {rankingData.length > 0 ? (
                        rankingData.map((student) => (
                          <div 
                            key={student.posicion} 
                            className="ranking-item"
                          >
                            <span className="ranking-position">#{student.posicion}</span>
                            <span className="ranking-name">{student.nombre}</span>
                            <span className="ranking-score">{student.score}</span>
                          </div>
                        ))
                      ) : (
                        <div className="no-data-message" style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                          No hay datos de estudiantes disponibles
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
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
                      {cuadernosData.length > 0 ? (
                        cuadernosData.map((cuaderno) => (
                          <tr key={cuaderno.id}>
                            <td className="notebook-name">{cuaderno.nombre}</td>
                            <td className="percentage mastery">{cuaderno.porcentajeDominio}%</td>
                            <td>{cuaderno.tiempoEfectivo} min</td>
                            <td>{formatTime(cuaderno.tiempoActivo)}</td>
                            <td className="smart-studies">{cuaderno.estudioPromedio}</td>
                            <td>
                              <div className="concepts-wrapper">
                                {cuaderno.topConceptos.length > 0 ? (
                                  cuaderno.topConceptos.map((concepto, idx) => (
                                    <div key={idx} className="concept-item top">
                                      <span className="concept-name">{concepto.nombre}</span>
                                      <span className="concept-percentage">{concepto.porcentajeDominio}%</span>
                                    </div>
                                  ))
                                ) : (
                                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Sin datos</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="concepts-wrapper">
                                {cuaderno.lowConceptos.length > 0 ? (
                                  cuaderno.lowConceptos.map((concepto, idx) => (
                                    <div key={idx} className="concept-item low">
                                      <span className="concept-name">{concepto.nombre}</span>
                                      <span className="concept-percentage">{concepto.porcentajeDominio}%</span>
                                    </div>
                                  ))
                                ) : (
                                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Sin datos</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="no-data" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                            {selectedMateria ? 'No hay cuadernos para esta materia' : 'Selecciona una materia para ver los cuadernos'}
                          </td>
                        </tr>
                      )}
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