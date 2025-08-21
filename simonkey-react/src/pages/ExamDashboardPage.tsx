import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { SchoolExam, ExamAttempt } from '../types/exam.types';

// Tipo para exámenes regulares (sin idEscuela)
type RegularExam = Omit<SchoolExam, 'idEscuela'>;
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/ExamDashboardPage.css';

interface StudentResult {
  studentId: string;
  studentName: string;
  studentEmail: string;
  attempt: ExamAttempt | null;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;
  completedAt: Date | null;
}

const ExamDashboardPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  
  console.log('🎯 ExamDashboardPage montado');
  console.log('📋 examId desde params:', examId);
  console.log('👤 Usuario actual:', auth.currentUser?.uid);
  
  const [exam, setExam] = useState<RegularExam | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'date'>('name');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedExam, setEditedExam] = useState<Partial<RegularExam>>({});

  useEffect(() => {
    loadExamData();
    
    // Actualizar automáticamente cada 30 segundos
    const interval = setInterval(() => {
      console.log('🔄 Actualizando datos automáticamente...');
      loadExamData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [examId]);

  const loadExamData = async () => {
    console.log('🔄 loadExamData iniciado');
    console.log('examId:', examId);
    console.log('auth.currentUser:', auth.currentUser);
    console.log('🕐 Timestamp:', new Date().toISOString());
    
    if (!examId || !auth.currentUser) {
      console.error('❌ Falta examId o usuario no autenticado');
      return;
    }
    
    setLoading(true);
    try {
      console.log('📄 Intentando cargar documento del examen...');
      console.log('  - Collection: exams');
      console.log('  - Document ID:', examId);
      console.log('  - User ID:', auth.currentUser.uid);
      
      // Primero, intentar obtener el perfil del usuario para verificar su rol
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('👤 Datos del usuario:', {
            schoolRole: userData.schoolRole,
            email: userData.email,
            idInstitucion: userData.idInstitucion
          });
        } else {
          console.error('❌ No se encontró el documento del usuario');
        }
      } catch (userError) {
        console.error('❌ Error obteniendo datos del usuario:', userError);
      }
      
      // DEBUG: Listar todos los exámenes para verificar
      try {
        console.log('🔍 DEBUG: Listando todos los exámenes...');
        const { getDocs, collection: firestoreCollection, query: firestoreQuery } = await import('firebase/firestore');
        const examsSnapshot = await getDocs(firestoreCollection(db, 'exams'));
        console.log(`📊 Total de exámenes en la colección: ${examsSnapshot.size}`);
        examsSnapshot.forEach(doc => {
          console.log(`  - ID: ${doc.id}, Profesor: ${doc.data().idProfesor}, Título: ${doc.data().title}`);
        });
      } catch (debugError) {
        console.error('❌ Error en debug de exámenes:', debugError);
      }
      
      // Cargar datos del examen
      console.log('🔍 Intentando getDoc...');
      
      // SOLUCIÓN ALTERNATIVA: Usar query en lugar de getDoc  
      let examData: RegularExam | null = null;
      
      try {
        console.log('🔄 Intentando con query alternativo...');
        const { getDocs, collection: firestoreCollection, query: firestoreQuery, where } = await import('firebase/firestore');
        const examQuery = firestoreQuery(
          firestoreCollection(db, 'exams'),
          where('__name__', '==', examId)
        );
        const examSnapshot = await getDocs(examQuery);
        
        if (!examSnapshot.empty) {
          console.log('✅ Examen encontrado con query alternativo');
          const examDoc = examSnapshot.docs[0];
          examData = { id: examDoc.id, ...examDoc.data() } as RegularExam;
        } else {
          console.error('❌ Examen no encontrado con query alternativo');
        }
      } catch (queryError) {
        console.error('❌ Error con query alternativo:', queryError);
      }
      
      // Si no funcionó el query, intentar getDoc
      if (!examData) {
        console.log('🔄 Intentando con getDoc original...');
        try {
          const examRef = doc(db, 'exams', examId);
          console.log('📍 Referencia del documento:', examRef.path);
          
          const examDoc = await getDoc(examRef);
          if (!examDoc.exists()) {
            alert('Examen no encontrado');
            navigate(-1);
            return;
          }
          
          examData = { id: examDoc.id, ...examDoc.data() } as RegularExam;
        } catch (getDocError) {
          console.error('❌ Error con getDoc:', getDocError);
          alert('Error al cargar el examen');
          navigate(-1);
          return;
        }
      }
      
      // Verificar que tenemos los datos del examen
      if (!examData) {
        console.error('❌ No se pudo cargar el examen');
        alert('Error al cargar el examen');
        navigate(-1);
        return;
      }
      
      // Establecer los datos del examen
      setExam(examData);
      setEditedExam({
        title: examData.title,
        description: examData.description,
        percentageQuestions: examData.percentageQuestions,
        timePerConcept: examData.timePerConcept,
        isActive: examData.isActive
      });
      
      // Cargar estudiantes usando el sistema de enrollments
      console.log('📚 Buscando estudiantes enrolados en la materia...');
      console.log('idMateria:', examData.idMateria);
      console.log('idProfesor:', examData.idProfesor);
      
      // Buscar todos los enrollments activos para esta materia y profesor
      const enrollmentsSnapshot = await getDocs(
        query(collection(db, 'enrollments'),
        where('materiaId', '==', examData.idMateria),
        where('teacherId', '==', examData.idProfesor),
        where('status', '==', 'active'))
      );
      
      console.log(`📊 Enrollments encontrados: ${enrollmentsSnapshot.size}`);
      
      // Obtener los IDs de los estudiantes enrolados
      const enrolledStudentIds: string[] = [];
      enrollmentsSnapshot.forEach(doc => {
        const enrollment = doc.data();
        enrolledStudentIds.push(enrollment.studentId);
        console.log(`  📝 Enrollment: estudiante ${enrollment.studentId}`);
      });
      
      console.log(`📊 Estudiantes enrolados: ${enrolledStudentIds.length}`);
      
      // Obtener los datos de los estudiantes enrolados
      const studentDocs: any[] = [];
      
      if (enrolledStudentIds.length > 0) {
        // Firestore no permite where('id', 'in', array) con más de 10 elementos
        // Dividir en chunks de 10 si es necesario
        const chunks = [];
        for (let i = 0; i < enrolledStudentIds.length; i += 10) {
          chunks.push(enrolledStudentIds.slice(i, i + 10));
        }
        
        for (const chunk of chunks) {
          const studentsQuery = query(
            collection(db, 'users'),
            where('__name__', 'in', chunk)
          );
          const chunkSnapshot = await getDocs(studentsQuery);
          
          chunkSnapshot.forEach(doc => {
            studentDocs.push(doc);
            console.log(`  👤 Estudiante cargado: ${doc.data().displayName || doc.data().email}`);
          });
        }
      }
      
      // Crear un snapshot-like object para mantener compatibilidad con el resto del código
      const studentsSnapshot = {
        docs: studentDocs,
        size: studentDocs.length
      } as any;
      
      console.log(`📊 Estudiantes finales encontrados: ${studentsSnapshot.size}`);
      
      // Cargar intentos de examen
      console.log('🔍 Buscando intentos de examen...');
      console.log('examId:', examId);
      
      const attemptsSnapshot = await getDocs(
        query(collection(db, 'examAttempts'), 
        where('examId', '==', examId))
      );
      
      console.log(`📝 Intentos encontrados: ${attemptsSnapshot.size}`);
      
      const attemptsByStudent = new Map<string, ExamAttempt>();
      const allAttempts: ExamAttempt[] = [];
      
      attemptsSnapshot.forEach(doc => {
        const attempt = { id: doc.id, ...doc.data() } as ExamAttempt;
        console.log('📄 Intento:', {
          id: doc.id,
          studentId: attempt.studentId,
          status: attempt.status,
          score: attempt.score
        });
        allAttempts.push(attempt);
      });
      
      // Agrupar intentos por estudiante y seleccionar el más relevante
      allAttempts.forEach(attempt => {
        const existingAttempt = attemptsByStudent.get(attempt.studentId);
        
        if (!existingAttempt) {
          attemptsByStudent.set(attempt.studentId, attempt);
        } else {
          // Priorizar intentos completados sobre otros estados
          if (attempt.status === 'completed' && existingAttempt.status !== 'completed') {
            attemptsByStudent.set(attempt.studentId, attempt);
          } else if (attempt.status === 'completed' && existingAttempt.status === 'completed') {
            // Si ambos están completados, usar el más reciente
            const attemptDate = attempt.completedAt?.toDate() || new Date(0);
            const existingDate = existingAttempt.completedAt?.toDate() || new Date(0);
            if (attemptDate > existingDate) {
              attemptsByStudent.set(attempt.studentId, attempt);
            }
          } else if (existingAttempt.status !== 'completed' && attempt.status === 'in_progress') {
            // Priorizar in_progress sobre not_started
            attemptsByStudent.set(attempt.studentId, attempt);
          }
        }
      });
      
      // Construir resultados
      const studentResults: StudentResult[] = [];
      
      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const attempt = attemptsByStudent.get(studentDoc.id) || null;
        
        console.log('👤 Procesando estudiante:', {
          id: studentDoc.id,
          name: studentData.displayName || studentData.email,
          hasAttempt: !!attempt,
          attemptStatus: attempt?.status
        });
        
        let score = 0;
        let correctAnswers = 0;
        let timeSpent = 0;
        let completedAt = null;
        
        if (attempt && attempt.status === 'completed') {
          score = attempt.score || 0;
          correctAnswers = attempt.answers.filter(a => a.isCorrect).length;
          timeSpent = examData.timePerConcept * attempt.assignedConcepts.length - attempt.timeRemaining;
          completedAt = attempt.completedAt?.toDate() || null;
        }
        
        studentResults.push({
          studentId: studentDoc.id,
          studentName: studentData.displayName || studentData.email,
          studentEmail: studentData.email,
          attempt,
          score,
          correctAnswers,
          totalQuestions: attempt ? attempt.assignedConcepts.length : 0,
          timeSpent,
          completedAt
        });
      }
      
      console.log('📊 Resultados finales:', studentResults);
      console.log(`✅ Total estudiantes procesados: ${studentResults.length}`);
      
      setResults(studentResults);
    } catch (error) {
      console.error('❌ Error cargando datos del examen:', error);
      alert('Error al cargar los datos del examen');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExam = async () => {
    if (!examId || !exam) return;
    
    try {
      await updateDoc(doc(db, 'exams', examId), {
        ...editedExam,
        updatedAt: new Date()
      });
      
      setExam({ ...exam, ...editedExam });
      setShowEditModal(false);
      alert('Examen actualizado correctamente');
    } catch (error) {
      console.error('Error actualizando examen:', error);
      alert('Error al actualizar el examen');
    }
  };

  const handleDeleteExam = async () => {
    if (!examId || !confirm('¿Estás seguro de que quieres eliminar este examen? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      // Eliminar todos los intentos asociados
      const attemptsSnapshot = await getDocs(
        query(collection(db, 'examAttempts'), where('examId', '==', examId))
      );
      
      const deletePromises = attemptsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Eliminar el examen
      await deleteDoc(doc(db, 'exams', examId));
      
      alert('Examen eliminado correctamente');
      navigate(-1);
    } catch (error) {
      console.error('Error eliminando examen:', error);
      alert('Error al eliminar el examen');
    }
  };

  const getFilteredResults = () => {
    let filtered = [...results];
    
    // Aplicar filtro
    if (filter === 'completed') {
      filtered = filtered.filter(r => r.attempt && r.attempt.status === 'completed');
    } else if (filter === 'pending') {
      filtered = filtered.filter(r => !r.attempt || r.attempt.status !== 'completed');
    }
    
    // Aplicar ordenamiento
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.score - a.score;
        case 'date':
          const dateA = a.completedAt?.getTime() || 0;
          const dateB = b.completedAt?.getTime() || 0;
          return dateB - dateA;
        default:
          return a.studentName.localeCompare(b.studentName);
      }
    });
    
    return filtered;
  };

  const calculateStats = () => {
    const completedResults = results.filter(r => r.attempt && r.attempt.status === 'completed');
    
    if (completedResults.length === 0) {
      return {
        averageScore: 0,
        averageCorrect: 0,
        averageTime: 0,
        completionRate: 0,
        highestScore: 0,
        lowestScore: 0
      };
    }
    
    const totalScore = completedResults.reduce((sum, r) => sum + r.score, 0);
    const totalCorrect = completedResults.reduce((sum, r) => sum + r.correctAnswers, 0);
    const totalTime = completedResults.reduce((sum, r) => sum + r.timeSpent, 0);
    const scores = completedResults.map(r => r.score);
    
    return {
      averageScore: Math.round(totalScore / completedResults.length),
      averageCorrect: Math.round((totalCorrect / completedResults.length / (exam?.percentageQuestions || 10)) * 100),
      averageTime: Math.round(totalTime / completedResults.length),
      completionRate: Math.round((completedResults.length / results.length) * 100),
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores)
    };
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="exam-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Cargando resultados...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="exam-dashboard-error">
        <h2>Examen no encontrado</h2>
        <button onClick={() => navigate(-1)}>Volver</button>
      </div>
    );
  }

  const stats = calculateStats();
  const filteredResults = getFilteredResults();

  return (
    <div className="exam-dashboard-page">
      <HeaderWithHamburger
        title="Dashboard del Examen"
        subtitle={exam.title}
        showBackButton={true}
        onBackClick={() => navigate(-1)}
      />

      <div className="exam-dashboard-container">
        {/* Header con acciones */}
        <div className="dashboard-header">
          <div className="exam-info">
            <h1>
              {exam.title}
              <button 
                className="refresh-button"
                onClick={() => loadExamData()}
                title="Actualizar datos"
                style={{
                  marginLeft: '1rem',
                  padding: '0.5rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  transition: 'all 0.3s ease'
                }}
              >
                <i className="fas fa-sync-alt"></i>
              </button>
            </h1>
            {exam.description && <p className="exam-description">{exam.description}</p>}
            <div className="exam-meta">
              <span className={`exam-status ${exam.isActive ? 'active' : 'inactive'}`}>
                <i className={`fas fa-circle ${exam.isActive ? 'text-green' : 'text-gray'}`}></i>
                {exam.isActive ? 'Activo' : 'Inactivo'}
              </span>
              <span className="exam-date">
                Creado {formatDistanceToNow(exam.createdAt.toDate(), { addSuffix: true, locale: es })}
              </span>
            </div>
          </div>
          
          <div className="dashboard-actions">
            <button 
              className="action-btn secondary"
              onClick={() => setShowEditModal(true)}
            >
              <i className="fas fa-edit"></i>
              Editar
            </button>
            <button 
              className="action-btn danger"
              onClick={handleDeleteExam}
            >
              <i className="fas fa-trash"></i>
              Eliminar
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-users"></i>
            </div>
            <div className="stat-content">
              <div className="stat-value">{results.length}</div>
              <div className="stat-label">Estudiantes Totales</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.completionRate}%</div>
              <div className="stat-label">Tasa de Completación</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-star"></i>
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.averageScore}</div>
              <div className="stat-label">Puntuación Promedio</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-clock"></i>
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatTime(stats.averageTime)}</div>
              <div className="stat-label">Tiempo Promedio</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <i className="fas fa-trophy"></i>
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.highestScore}</div>
              <div className="stat-label">Puntuación Más Alta</div>
            </div>
          </div>
        </div>

        {/* Filtros y ordenamiento */}
        <div className="results-controls">
          <div className="filter-group">
            <label>Filtrar:</label>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">Todos</option>
              <option value="completed">Completados</option>
              <option value="pending">Pendientes</option>
            </select>
          </div>

          <div className="sort-group">
            <label>Ordenar por:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="sort-select"
            >
              <option value="name">Nombre</option>
              <option value="score">Puntuación</option>
              <option value="date">Fecha</option>
            </select>
          </div>
        </div>

        {/* Tabla de resultados */}
        <div className="results-table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Estado</th>
                <th>Puntuación</th>
                <th>Respuestas Correctas</th>
                <th>Tiempo</th>
                <th>Fecha</th>
                <th>Integridad</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map(result => (
                <tr key={result.studentId}>
                  <td>
                    <div className="student-info">
                      <div className="student-name">{result.studentName}</div>
                      <div className="student-email">{result.studentEmail}</div>
                    </div>
                  </td>
                  <td>
                    {result.attempt && result.attempt.status === 'completed' ? (
                      <span className="status-badge completed">
                        <i className="fas fa-check-circle"></i>
                        Completado
                      </span>
                    ) : result.attempt && result.attempt.status === 'in_progress' ? (
                      <span className="status-badge in-progress">
                        <i className="fas fa-clock"></i>
                        En progreso
                      </span>
                    ) : (
                      <span className="status-badge pending">
                        <i className="fas fa-circle"></i>
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td>
                    {result.attempt && result.attempt.status === 'completed' ? (
                      <div className="score-display">
                        <span className="score-value">{result.score}</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    {result.attempt && result.attempt.status === 'completed' ? (
                      <div className="correct-answers">
                        {result.correctAnswers}/{result.totalQuestions}
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    {result.attempt && result.attempt.status === 'completed' ? 
                      formatTime(result.timeSpent) : '-'}
                  </td>
                  <td>
                    {result.completedAt ? 
                      formatDistanceToNow(result.completedAt, { addSuffix: true, locale: es }) : 
                      '-'}
                  </td>
                  <td>
                    {result.attempt && result.attempt.status === 'completed' ? (
                      <div className="tab-switches-info">
                        {result.attempt.tabSwitches && result.attempt.tabSwitches > 0 ? (
                          <span className="tab-switch-warning">
                            <i className="fas fa-exclamation-triangle"></i>
                            {result.attempt.tabSwitches} {result.attempt.tabSwitches === 1 ? 'cambio' : 'cambios'} de pestaña
                          </span>
                        ) : (
                          <span className="tab-switch-ok">
                            <i className="fas fa-check-circle"></i>
                            Sin cambios de pestaña
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="tab-switch-na">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edición */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Editar Examen</h2>
            
            <div className="form-group">
              <label>Título del examen</label>
              <input
                type="text"
                value={editedExam.title || ''}
                onChange={(e) => setEditedExam({ ...editedExam, title: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Descripción (opcional)</label>
              <textarea
                value={editedExam.description || ''}
                onChange={(e) => setEditedExam({ ...editedExam, description: e.target.value })}
                className="form-textarea"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Porcentaje de preguntas</label>
              <input
                type="number"
                value={editedExam.percentageQuestions || 50}
                onChange={(e) => setEditedExam({ ...editedExam, percentageQuestions: parseInt(e.target.value) })}
                className="form-input"
                min="10"
                max="100"
                step="10"
              />
            </div>

            <div className="form-group">
              <label>Tiempo por concepto (segundos)</label>
              <input
                type="number"
                value={editedExam.timePerConcept || 60}
                onChange={(e) => setEditedExam({ ...editedExam, timePerConcept: parseInt(e.target.value) })}
                className="form-input"
                min="30"
                max="300"
                step="10"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editedExam.isActive || false}
                  onChange={(e) => setEditedExam({ ...editedExam, isActive: e.target.checked })}
                />
                Examen activo
              </label>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleUpdateExam}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamDashboardPage;