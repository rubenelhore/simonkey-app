import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import '../styles/TeacherAnalytics.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartBar,
  faDownload,
  faUsers,
  faExclamationTriangle,
  faTrophy,
  faEye,
  faFilter,
  faSync
} from '@fortawesome/free-solid-svg-icons';

interface Student {
  id: string;
  email: string;
  displayName: string;
  nombre: string;
}

interface StudentProgress {
  studentId: string;
  studentName: string;
  studentEmail: string;
  materiaId: string;
  materiaName: string;
  notebooks: NotebookProgress[];
  totalConcepts: number;
  masteredConcepts: number;
  strugglingConcepts: ConceptDifficulty[];
  studyTime: number;
  lastActivity: Date | null;
  overallScore: number;
  performanceCluster: 'alto' | 'medio' | 'bajo';
}

interface NotebookProgress {
  id: string;
  name: string;
  conceptCount: number;
  masteredCount: number;
  averageScore: number;
  timeSpent: number;
  lastStudied: Date | null;
}

interface ConceptDifficulty {
  conceptId: string;
  conceptName: string;
  attempts: number;
  successRate: number;
  averageScore: number;
  timeSpent: number;
}

interface TeacherAnalytics {
  totalStudents: number;
  activeStudents: number;
  averageProgress: number;
  topPerformers: StudentProgress[];
  strugglingStudents: StudentProgress[];
  mostDifficultConcepts: ConceptDifficulty[];
  materiaStats: {
    [materiaId: string]: {
      name: string;
      studentCount: number;
      averageProgress: number;
      totalConcepts: number;
    }
  };
}

const TeacherStudentAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([]);
  const [selectedMateria, setSelectedMateria] = useState<string>('all');
  const [selectedCluster, setSelectedCluster] = useState<string>('all');
  const [materias, setMaterias] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    loadTeacherAnalytics();
  }, []);

  const loadTeacherAnalytics = async () => {
    if (!auth.currentUser) return;
    
    try {
      setLoading(true);
      console.log('🔄 Cargando análisis de estudiantes...');

      // 1. Obtener las materias del profesor
      const materiasQuery = query(
        collection(db, 'materias'),
        where('userId', '==', auth.currentUser.uid)
      );
      const materiasSnapshot = await getDocs(materiasQuery);
      const teacherMaterias = materiasSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().title || doc.data().nombre
      }));
      
      setMaterias(teacherMaterias);
      console.log(`📚 Materias del profesor: ${teacherMaterias.length}`);

      // 2. Obtener estudiantes inscritos en estas materias
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('teacherId', '==', auth.currentUser.uid),
        where('status', '==', 'active')
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      
      console.log(`👥 Inscripciones encontradas: ${enrollmentsSnapshot.docs.length}`);

      // 3. Procesar datos de cada estudiante
      const studentsProgress: StudentProgress[] = [];
      const studentIds = new Set<string>();

      for (const enrollmentDoc of enrollmentsSnapshot.docs) {
        const enrollmentData = enrollmentDoc.data();
        const studentId = enrollmentData.studentId;
        const materiaId = enrollmentData.materiaId;

        if (studentIds.has(studentId)) continue;
        studentIds.add(studentId);

        // Obtener datos del estudiante
        const studentDocRef = doc(db, 'users', studentId);
        const studentDoc = await getDoc(studentDocRef);
        
        if (!studentDoc.exists()) continue;
        
        const studentData = studentDoc.data();
        
        // Obtener notebooks del estudiante para esta materia
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', studentId),
          where('materiaId', '==', materiaId)
        );
        const notebooksSnapshot = await getDocs(notebooksQuery);
        
        const notebooks: NotebookProgress[] = [];
        let totalConcepts = 0;
        let masteredConcepts = 0;
        let totalStudyTime = 0;

        for (const notebookDoc of notebooksSnapshot.docs) {
          const notebookData = notebookDoc.data();
          
          // Obtener conceptos del notebook
          const conceptsQuery = query(
            collection(db, 'notebooks', notebookDoc.id, 'concepts')
          );
          const conceptsSnapshot = await getDocs(conceptsQuery);
          
          const conceptCount = conceptsSnapshot.docs.length;
          const masteredCount = conceptsSnapshot.docs.filter(
            doc => doc.data().masteryLevel >= 0.8
          ).length;

          totalConcepts += conceptCount;
          masteredConcepts += masteredCount;

          notebooks.push({
            id: notebookDoc.id,
            name: notebookData.title,
            conceptCount,
            masteredCount,
            averageScore: notebookData.averageScore || 0,
            timeSpent: notebookData.timeSpent || 0,
            lastStudied: notebookData.lastStudied?.toDate() || null
          });

          totalStudyTime += notebookData.timeSpent || 0;
        }

        const overallScore = totalConcepts > 0 ? (masteredConcepts / totalConcepts) * 100 : 0;
        
        // Determinar cluster de rendimiento
        let performanceCluster: 'alto' | 'medio' | 'bajo' = 'medio';
        if (overallScore >= 80) performanceCluster = 'alto';
        else if (overallScore < 50) performanceCluster = 'bajo';

        const materiaName = teacherMaterias.find(m => m.id === materiaId)?.name || 'Materia';

        studentsProgress.push({
          studentId,
          studentName: studentData.displayName || studentData.nombre || 'Usuario',
          studentEmail: studentData.email || '',
          materiaId,
          materiaName,
          notebooks,
          totalConcepts,
          masteredConcepts,
          strugglingConcepts: [], // Se calculará después
          studyTime: totalStudyTime,
          lastActivity: null, // Se calculará después
          overallScore,
          performanceCluster
        });
      }

      setStudentProgress(studentsProgress);

      // 4. Generar analytics generales
      const totalStudents = studentsProgress.length;
      const activeStudents = studentsProgress.filter(s => s.lastActivity && 
        (Date.now() - s.lastActivity.getTime()) < 7 * 24 * 60 * 60 * 1000 // Última semana
      ).length;
      
      const averageProgress = totalStudents > 0 ? 
        studentsProgress.reduce((sum, s) => sum + s.overallScore, 0) / totalStudents : 0;

      const topPerformers = [...studentsProgress]
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 5);

      const strugglingStudents = [...studentsProgress]
        .filter(s => s.performanceCluster === 'bajo')
        .sort((a, b) => a.overallScore - b.overallScore)
        .slice(0, 5);

      setAnalytics({
        totalStudents,
        activeStudents,
        averageProgress,
        topPerformers,
        strugglingStudents,
        mostDifficultConcepts: [],
        materiaStats: {}
      });

      console.log('✅ Análisis completado');
      console.log(`📊 ${totalStudents} estudiantes analizados`);
      console.log(`🏆 Top performers: ${topPerformers.length}`);
      console.log(`⚠️ Estudiantes con dificultades: ${strugglingStudents.length}`);

    } catch (error) {
      console.error('❌ Error cargando análisis:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!studentProgress.length) return;

    const headers = [
      'Estudiante',
      'Email', 
      'Materia',
      'Cuadernos',
      'Conceptos Totales',
      'Conceptos Dominados',
      'Porcentaje Progreso',
      'Tiempo Estudio (min)',
      'Cluster Rendimiento'
    ];

    const csvData = studentProgress.map(student => [
      student.studentName,
      student.studentEmail,
      student.materiaName,
      student.notebooks.length,
      student.totalConcepts,
      student.masteredConcepts,
      `${student.overallScore.toFixed(1)}%`,
      Math.round(student.studyTime / 60),
      student.performanceCluster
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analisis_estudiantes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredStudents = studentProgress.filter(student => {
    if (selectedMateria !== 'all' && student.materiaId !== selectedMateria) return false;
    if (selectedCluster !== 'all' && student.performanceCluster !== selectedCluster) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="analytics-loading">
        <FontAwesomeIcon icon={faSync} spin size="2x" />
        <p>Analizando el progreso de tus estudiantes...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-error">
        <p>Error cargando el análisis. Inténtalo de nuevo.</p>
        <button onClick={loadTeacherAnalytics} className="retry-btn">
          <FontAwesomeIcon icon={faSync} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="teacher-analytics">
      <div className="analytics-header">
        <h2>📊 Análisis de Estudiantes</h2>
        <button onClick={exportToCSV} className="export-btn">
          <FontAwesomeIcon icon={faDownload} /> Exportar CSV
        </button>
      </div>

      {/* Resumen General */}
      <div className="analytics-summary">
        <div className="summary-card">
          <FontAwesomeIcon icon={faUsers} className="summary-icon" />
          <div className="summary-content">
            <h3>{analytics.totalStudents}</h3>
            <p>Total Estudiantes</p>
          </div>
        </div>
        
        <div className="summary-card">
          <FontAwesomeIcon icon={faChartBar} className="summary-icon" />
          <div className="summary-content">
            <h3>{analytics.averageProgress.toFixed(1)}%</h3>
            <p>Progreso Promedio</p>
          </div>
        </div>

        <div className="summary-card">
          <FontAwesomeIcon icon={faTrophy} className="summary-icon" />
          <div className="summary-content">
            <h3>{analytics.topPerformers.length}</h3>
            <p>Alto Rendimiento</p>
          </div>
        </div>

        <div className="summary-card">
          <FontAwesomeIcon icon={faExclamationTriangle} className="summary-icon" />
          <div className="summary-content">
            <h3>{analytics.strugglingStudents.length}</h3>
            <p>Necesitan Apoyo</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="analytics-filters">
        <div className="filter-group">
          <label>Materia:</label>
          <select 
            value={selectedMateria} 
            onChange={(e) => setSelectedMateria(e.target.value)}
          >
            <option value="all">Todas las Materias</option>
            {materias.map(materia => (
              <option key={materia.id} value={materia.id}>
                {materia.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Rendimiento:</label>
          <select 
            value={selectedCluster} 
            onChange={(e) => setSelectedCluster(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="alto">Alto Rendimiento</option>
            <option value="medio">Rendimiento Medio</option>
            <option value="bajo">Necesitan Apoyo</option>
          </select>
        </div>
      </div>

      {/* Lista de Estudiantes */}
      <div className="students-list">
        <h3>📋 Detalle por Estudiante ({filteredStudents.length})</h3>
        
        {filteredStudents.map(student => (
          <div key={student.studentId} className={`student-card ${student.performanceCluster}`}>
            <div className="student-header">
              <div className="student-info">
                <h4>{student.studentName}</h4>
                <p>{student.studentEmail}</p>
                <span className="materia-badge">{student.materiaName}</span>
              </div>
              <div className="student-metrics">
                <div className={`performance-badge ${student.performanceCluster}`}>
                  {student.performanceCluster === 'alto' && '🏆'}
                  {student.performanceCluster === 'medio' && '📊'}
                  {student.performanceCluster === 'bajo' && '⚠️'}
                  {student.performanceCluster}
                </div>
                <div className="score">{student.overallScore.toFixed(1)}%</div>
              </div>
            </div>
            
            <div className="student-details">
              <div className="detail-item">
                <span className="detail-label">📚 Cuadernos:</span>
                <span className="detail-value">{student.notebooks.length}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">🎯 Conceptos:</span>
                <span className="detail-value">
                  {student.masteredConcepts}/{student.totalConcepts} dominados
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">⏱️ Tiempo de estudio:</span>
                <span className="detail-value">{Math.round(student.studyTime / 60)} min</span>
              </div>
            </div>
            
            {student.notebooks.length > 0 && (
              <div className="notebooks-progress">
                <h5>📖 Progreso por Cuaderno:</h5>
                {student.notebooks.map(notebook => (
                  <div key={notebook.id} className="notebook-item">
                    <span className="notebook-name">{notebook.name}</span>
                    <div className="notebook-stats">
                      <span>{notebook.masteredCount}/{notebook.conceptCount} conceptos</span>
                      <span className="progress-bar-container">
                        <div 
                          className="progress-bar" 
                          style={{
                            width: `${(notebook.masteredCount / notebook.conceptCount) * 100}%`
                          }}
                        ></div>
                      </span>
                      <span>{((notebook.masteredCount / notebook.conceptCount) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="no-students">
          <FontAwesomeIcon icon={faUsers} size="3x" />
          <p>No se encontraron estudiantes con los filtros aplicados.</p>
        </div>
      )}
    </div>
  );
};

export default TeacherStudentAnalytics;