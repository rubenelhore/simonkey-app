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
import { useAuth } from '../contexts/AuthContext';
import { getTeacherMetricsWithProfile } from '../utils/getTeacherMetrics';
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
  const { userProfile } = useAuth();
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
    if (userProfile) {
      loadTeacherMetrics();
    }
  }, [userProfile]);

  // Procesar datos cuando cambien las métricas o la materia seleccionada
  useEffect(() => {
    if (teacherMetrics) {
      processMaterias();
      if (selectedMateria) {
        processRankingData();
      }
      processStudyTimeData();
      processCuadernosData();
    }
  }, [teacherMetrics, selectedMateria]);

  const loadTeacherMetrics = async () => {
    if (!auth.currentUser || !userProfile) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('[TeacherAnalytics] Cargando métricas usando helper...');
      
      // Usar el helper que maneja correctamente los IDs
      const metrics = await getTeacherMetricsWithProfile(userProfile);
      
      console.log('[TeacherAnalytics] Métricas obtenidas:', metrics);
      console.log('[TeacherAnalytics] Métricas.materias:', metrics?.materias);
      console.log('[TeacherAnalytics] Métricas.global:', metrics?.global);
      
      setTeacherMetrics(metrics || {});
      
    } catch (error) {
      console.error('[TeacherAnalytics] Error cargando métricas:', error);
    } finally {
      setLoading(false);
    }
  };


  const processMaterias = () => {
    console.log('[TeacherAnalytics] processMaterias - teacherMetrics:', teacherMetrics);
    console.log('[TeacherAnalytics] processMaterias - teacherMetrics.materias:', teacherMetrics?.materias);
    
    if (!teacherMetrics?.materias || Object.keys(teacherMetrics.materias).length === 0) {
      console.log('[TeacherAnalytics] No hay materias en los metrics');
      setMaterias([]);
      return;
    }
    
    const materiasArray: Materia[] = Object.entries(teacherMetrics.materias).map(([id, data]: [string, any]) => ({
      id,
      nombre: data.nombreMateria || 'Sin nombre'
    }));
    
    console.log('[TeacherAnalytics] Materias procesadas:', materiasArray);
    setMaterias(materiasArray);
    
    // Seleccionar la primera materia por defecto
    if (materiasArray.length > 0 && !selectedMateria) {
      setSelectedMateria(materiasArray[0].id);
    }
  };

  const processRankingData = async () => {
    if (!teacherMetrics || !selectedMateria || !userProfile) return;
    
    try {
      console.log('[TeacherAnalytics] Procesando ranking para materia:', selectedMateria);
      console.log('[TeacherAnalytics] UserProfile idInstitucion:', userProfile.idInstitucion);
      
      // Obtener los cuadernos de esta materia
      const notebooksQuery = query(
        collection(db, 'schoolNotebooks'),
        where('idMateria', '==', selectedMateria)
      );
      const notebooksSnapshot = await getDocs(notebooksQuery);
      const notebookIds = notebooksSnapshot.docs.map(doc => doc.id);
      
      if (notebookIds.length === 0) {
        console.log('[TeacherAnalytics] No hay cuadernos para esta materia');
        setRankingData([]);
        return;
      }
      
      console.log('[TeacherAnalytics] Cuadernos encontrados:', notebookIds.length);
      console.log('[TeacherAnalytics] IDs de cuadernos:', notebookIds);
      
      // Buscar el ID de la institución en múltiples campos posibles
      let institutionId = userProfile.idEscuela || userProfile.idInstitucion || userProfile.schoolData?.idEscuela;
      
      console.log('[TeacherAnalytics] Buscando ID institución:', {
        idEscuela: userProfile.idEscuela,
        idInstitucion: userProfile.idInstitucion,
        schoolDataIdEscuela: userProfile.schoolData?.idEscuela,
        idAdmin: userProfile.idAdmin,
        encontrado: institutionId
      });
      
      // Si no se encuentra directamente, intentar obtener desde el admin
      if (!institutionId && userProfile.idAdmin) {
        console.log('[TeacherAnalytics] No se encontró ID directo, buscando en admin:', userProfile.idAdmin);
        
        try {
          const adminDoc = await getDoc(doc(db, 'users', userProfile.idAdmin));
          
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            institutionId = adminData.idEscuela || adminData.idInstitucion || adminData.schoolData?.idEscuela;
            console.log('[TeacherAnalytics] ID institución obtenido del admin:', institutionId);
          } else {
            console.log('[TeacherAnalytics] Admin no encontrado en users collection');
          }
        } catch (error) {
          console.error('[TeacherAnalytics] Error obteniendo datos del admin:', error);
        }
      }
      
      // Si no tenemos ID de institución, mostrar advertencia pero continuar
      if (!institutionId) {
        console.warn('[TeacherAnalytics] No se encontró ID de institución, se buscarán estudiantes por cuadernos');
      }
      
      // Obtener estudiantes de la institución que tengan estos cuadernos
      let studentsSnapshot;
      const studentScores: { id: string; nombre: string; score: number }[] = [];
      
      // Estrategia múltiple para encontrar estudiantes
      if (institutionId) {
        // Primero intentar con idEscuela
        let studentsQuery = query(
          collection(db, 'users'),
          where('idEscuela', '==', institutionId),
          where('schoolRole', '==', 'student'),
          where('subscription', '==', 'school')
        );
        
        console.log('[TeacherAnalytics] Query 1 - buscando con idEscuela:', institutionId);
        studentsSnapshot = await getDocs(studentsQuery);
        console.log('[TeacherAnalytics] Estudiantes encontrados con idEscuela:', studentsSnapshot.size);
        
        // Si no encuentra con idEscuela, intentar con idInstitucion
        if (studentsSnapshot.size === 0) {
          console.log('[TeacherAnalytics] Intentando con idInstitucion...');
          studentsQuery = query(
            collection(db, 'users'),
            where('idInstitucion', '==', institutionId),
            where('schoolRole', '==', 'student'),
            where('subscription', '==', 'school')
          );
          
          studentsSnapshot = await getDocs(studentsQuery);
          console.log('[TeacherAnalytics] Estudiantes encontrados con idInstitucion:', studentsSnapshot.size);
        }
        
        // Si aún no encuentra, buscar por idAdmin
        if (studentsSnapshot.size === 0 && userProfile.idAdmin) {
          console.log('[TeacherAnalytics] Intentando con idAdmin directo...');
          studentsQuery = query(
            collection(db, 'users'),
            where('idAdmin', '==', userProfile.idAdmin),
            where('schoolRole', '==', 'student'),
            where('subscription', '==', 'school')
          );
          
          studentsSnapshot = await getDocs(studentsQuery);
          console.log('[TeacherAnalytics] Estudiantes encontrados con idAdmin:', studentsSnapshot.size);
        }
        
        // Si aún no encuentra, buscar sin filtro de subscription
        if (studentsSnapshot.size === 0) {
          console.log('[TeacherAnalytics] Intentando sin filtro de subscription...');
          studentsQuery = query(
            collection(db, 'users'),
            where('idEscuela', '==', institutionId),
            where('schoolRole', '==', 'student')
          );
          
          studentsSnapshot = await getDocs(studentsQuery);
          console.log('[TeacherAnalytics] Estudiantes sin filtro subscription:', studentsSnapshot.size);
        }
      }
      
      // Si aún no hay estudiantes o no hay institutionId, buscar todos los estudiantes escolares
      if (!studentsSnapshot || studentsSnapshot.size === 0) {
        console.log('[TeacherAnalytics] Buscando todos los estudiantes escolares...');
        
        const allStudentsQuery = query(
          collection(db, 'users'),
          where('schoolRole', '==', 'student'),
          where('subscription', '==', 'school')
        );
        
        studentsSnapshot = await getDocs(allStudentsQuery);
        console.log('[TeacherAnalytics] Total estudiantes escolares encontrados:', studentsSnapshot.size);
        
        // Si encuentra estudiantes, mostrar una muestra de sus campos
        if (studentsSnapshot.size > 0) {
          const firstStudent = studentsSnapshot.docs[0].data();
          console.log('[TeacherAnalytics] Ejemplo de campos del estudiante:', {
            id: studentsSnapshot.docs[0].id,
            idEscuela: firstStudent.idEscuela,
            idInstitucion: firstStudent.idInstitucion,
            idAdmin: firstStudent.idAdmin,
            schoolRole: firstStudent.schoolRole,
            subscription: firstStudent.subscription,
            email: firstStudent.email
          });
        }
      }
      
      // Para cada estudiante, obtener sus KPIs
      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const studentNotebooks = studentData.idCuadernos || [];
        
        console.log(`[TeacherAnalytics] Procesando estudiante ${studentDoc.id}:`, {
          nombre: studentData.nombre,
          email: studentData.email,
          cuadernos: studentNotebooks.length,
          idCuadernos: studentNotebooks,
          idMateria: studentData.idMateria
        });
        
        // Verificar si el estudiante tiene algún cuaderno de esta materia
        const hasNotebookFromSubject = notebookIds.some(id => studentNotebooks.includes(id));
        
        // También verificar si el estudiante tiene la misma materia directamente
        const hasSubjectDirect = studentData.idMateria === selectedMateria;
        
        console.log(`[TeacherAnalytics] Estudiante tiene cuaderno de la materia: ${hasNotebookFromSubject}`);
        console.log(`[TeacherAnalytics] Estudiante tiene idMateria directa: ${hasSubjectDirect}`);
        
        if (hasNotebookFromSubject || hasSubjectDirect) {
          try {
            // Obtener KPIs del estudiante
            const kpisDoc = await getDoc(doc(db, 'users', studentDoc.id, 'kpis', 'dashboard'));
            
            if (kpisDoc.exists()) {
              const kpisData = kpisDoc.data();
              let totalScore = 0;
              let notebookCount = 0;
              
              // Sumar scores de los cuadernos de esta materia
              for (const notebookId of notebookIds) {
                if (kpisData.cuadernos?.[notebookId]) {
                  totalScore += kpisData.cuadernos[notebookId].scoreCuaderno || 0;
                  notebookCount++;
                }
              }
              
              // Si el estudiante tiene idMateria pero no cuadernos específicos, buscar todos sus cuadernos
              if (hasSubjectDirect && notebookCount === 0 && kpisData.cuadernos) {
                console.log(`[TeacherAnalytics] Buscando cuadernos del estudiante por idMateria`);
                for (const [cuadernoId, cuadernoData] of Object.entries(kpisData.cuadernos)) {
                  // Verificar si este cuaderno pertenece a la materia
                  const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', cuadernoId));
                  if (notebookDoc.exists() && notebookDoc.data().idMateria === selectedMateria) {
                    totalScore += (cuadernoData as any).scoreCuaderno || 0;
                    notebookCount++;
                  }
                }
              }
              
              if (notebookCount > 0 || totalScore > 0) {
                studentScores.push({
                  id: studentDoc.id,
                  nombre: studentData.nombre || studentData.displayName || 'Estudiante',
                  score: totalScore
                });
              }
            }
          } catch (error) {
            console.error(`Error obteniendo KPIs del estudiante ${studentDoc.id}:`, error);
          }
        }
      }
      
      // Ordenar por score descendente y tomar los top 5
      const topStudents = studentScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((student, index) => ({
          posicion: index + 1,
          nombre: student.nombre,
          score: student.score
        }));
      
      console.log('[TeacherAnalytics] Top estudiantes:', topStudents);
      
      if (topStudents.length === 0) {
        console.log('[TeacherAnalytics] No se encontraron estudiantes con scores para mostrar');
        console.log('[TeacherAnalytics] Total estudiantes procesados:', studentScores.length);
      }
      
      setRankingData(topStudents);
      
    } catch (error) {
      console.error('[TeacherAnalytics] Error procesando ranking:', error);
      setRankingData([]);
    }
  };

  const processStudyTimeData = () => {
    console.log('[TeacherAnalytics] processStudyTimeData - tiempoEstudioSemanal:', teacherMetrics?.tiempoEstudioSemanal);
    
    if (!teacherMetrics?.tiempoEstudioSemanal) {
      console.log('[TeacherAnalytics] No hay datos de tiempo semanal, usando valores en cero');
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
    console.log('[TeacherAnalytics] processCuadernosData - cuadernos:', teacherMetrics?.cuadernos);
    console.log('[TeacherAnalytics] processCuadernosData - selectedMateria:', selectedMateria);
    
    if (!teacherMetrics?.cuadernos || !selectedMateria) {
      console.log('[TeacherAnalytics] No hay cuadernos o no hay materia seleccionada');
      return;
    }
    
    try {
      const cuadernosTemp: CuadernoData[] = [];
      const scoreData: ScoreData[] = [];
      
      // Filtrar cuadernos por materia seleccionada
      console.log('[TeacherAnalytics] Filtrando cuadernos para materia:', selectedMateria);
      for (const [cuadernoId, cuadernoData] of Object.entries(teacherMetrics.cuadernos)) {
        const data = cuadernoData as any;
        console.log(`[TeacherAnalytics] Cuaderno ${cuadernoId}:`, data);
        console.log(`[TeacherAnalytics] materiaId del cuaderno:`, data.materiaId);
        
        if (data.materiaId === selectedMateria) {
          console.log(`[TeacherAnalytics] ✅ Cuaderno ${cuadernoId} coincide con materia seleccionada`);
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

  console.log('[TeacherAnalytics] Métricas globales:', {
    globalDominioConceptos,
    globalTiempoEfectivo,
    globalTiempoActivo,
    globalEstudioPromedio,
    teacherMetricsGlobal: teacherMetrics?.global
  });

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
                  <p className="kpi-value">{globalTiempoEfectivo * 60} seg</p>
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
                            <td>{cuaderno.tiempoEfectivo * 60} seg</td>
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