import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { gamePointsService } from '../services/gamePointsService';
import { studyStreakService } from '../services/studyStreakService';
import { getDomainProgressForNotebook } from '../utils/domainProgress';

interface UserMetrics {
  id: string;
  nombre: string;
  displayName?: string;
  email: string;
  teacherNames?: string;
  scoreGlobal: number;
  repasoInteligente: {
    score: number;
    sessions: number;
  };
  estudioActivo: {
    score: number;
    sessions: number;
  };
  estudioLibre: {
    score: number;
    sessions: number;
  };
  quiz: {
    score: number;
    sessions: number;
  };
  juegos: {
    score: number;
    sessions: number;
  };
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// Cache for expensive operations
const notebookPointsCache = new Map();
const userStreakCache = new Map();

// Función que calcula puntos por notebook SIN incluir streak bonus (se suma una vez al total del usuario)
const calculateNotebookPointsWithoutStreak = async (notebookId: string, userId: string) => {
  try {
    
    // Use the same queries as ProgressPage - query studySessions collection directly
    const [
      smartStudySnapshot,
      voiceRecognitionSnapshot,
      freeStudySnapshot,
      quizStatsDoc,
      notebookPoints
    ] = await Promise.all([
      // Smart study sessions
      getDocs(query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        where('notebookId', '==', notebookId),
        where('mode', '==', 'intelligent')
      )),
      // Voice recognition sessions
      getDocs(query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        where('notebookId', '==', notebookId),
        where('mode', '==', 'voice-recognition')
      )),
      // Free study sessions
      getDocs(query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        where('notebookId', '==', notebookId),
        where('mode', '==', 'free')
      )),
      // Quiz stats
      getDoc(doc(db, 'users', userId, 'quizStats', notebookId)),
      // Game points
      gamePointsService.getNotebookPoints(userId, notebookId).catch(() => ({ totalPoints: 0 }))
    ]);

    // Calculate scores from sessions (same logic as ProgressPage)
    const smartStudyPoints = smartStudySnapshot.docs.reduce((sum, doc) => {
      const session = doc.data();
      return sum + (session.score || 0);
    }, 0);

    const voiceRecognitionPoints = voiceRecognitionSnapshot.docs.reduce((sum, doc) => {
      const session = doc.data();
      return sum + (session.score || 0);
    }, 0);

    const freeStudyPoints = freeStudySnapshot.docs.reduce((sum, doc) => {
      const session = doc.data();
      return sum + (session.score || 0);
    }, 0);

    // Get quiz points
    const quizPoints = quizStatsDoc.exists() ? (quizStatsDoc.data().maxScore || 0) : 0;

    // Get game points
    const gamePointsValue = notebookPoints.totalPoints || 0;

    // Calculate individual points (same as ProgressPage) - SIN streak bonus
    const puntosRepasoInteligente = Math.round(smartStudyPoints * 1000);
    const puntosEstudioActivo = Math.round(voiceRecognitionPoints * 1000);
    const puntosEstudioLibre = Math.round(freeStudyPoints * 1000);
    const puntosQuiz = quizPoints;
    const puntosJuegos = gamePointsValue;

    return {
      puntosRepasoInteligente,
      puntosEstudioActivo,
      puntosEstudioLibre,
      puntosQuiz,
      puntosJuegos,
      porcentajeDominio: 0
    };
    
  } catch (error) {
    console.error(`Error calculating points for notebook ${notebookId}:`, error);
    return {
      puntosRepasoInteligente: 0,
      puntosEstudioActivo: 0,
      puntosEstudioLibre: 0,
      puntosQuiz: 0,
      puntosJuegos: 0,
      porcentajeDominio: 0
    };
  }
};

// Función que replica EXACTAMENTE el cálculo de ProgressPage para cada usuario
const calculateUserModuleStatsExact = async (userId: string) => {
  let totalRepasoScore = 0, totalRepasoSessions = 0;
  let totalActivoScore = 0, totalActivoSessions = 0;
  let totalLibreScore = 0, totalLibreSessions = 0;
  let totalQuizScore = 0, totalQuizSessions = 0;
  let totalJuegosScore = 0, totalJuegosSessions = 0;
  let userStreakBonus = 0;

  try {
    
    // Obtener todos los cuadernos del usuario desde sus studySessions
    const studySessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', userId)
    );
    const studySessionsSnapshot = await getDocs(studySessionsQuery);
    
    // Obtener lista única de notebookIds
    const notebookIds = new Set<string>();
    studySessionsSnapshot.forEach((doc) => {
      const session = doc.data();
      if (session.notebookId) {
        notebookIds.add(session.notebookId);
      }
    });

    // Obtener el streak del usuario UNA SOLA VEZ
    const userStreak = await studyStreakService.getUserStreak(userId).catch(() => ({ currentStreak: 0 }));
    userStreakBonus = studyStreakService.getStreakBonus(userStreak.currentStreak);

    // Para cada notebook, calcular puntos SIN incluir streak bonus (se suma al final)
    for (const notebookId of notebookIds) {
      try {
        const notebookPoints = await calculateNotebookPointsWithoutStreak(notebookId, userId);
        
        totalRepasoScore += notebookPoints.puntosRepasoInteligente;
        totalActivoScore += notebookPoints.puntosEstudioActivo;
        totalLibreScore += notebookPoints.puntosEstudioLibre;
        totalQuizScore += notebookPoints.puntosQuiz;
        totalJuegosScore += notebookPoints.puntosJuegos;
        
        // Contar sesiones por notebook
        studySessionsSnapshot.forEach((doc) => {
          const session = doc.data();
          if (session.notebookId === notebookId) {
            const mode = session.mode || session.studyMode;
            if (mode === 'intelligent') totalRepasoSessions++;
            else if (mode === 'voice-recognition') totalActivoSessions++;
            else if (mode === 'free') totalLibreSessions++;
            else if (mode === 'quiz') totalQuizSessions++;
          }
        });
        
        // Obtener games sessions para este notebook
        const gameSessionsQuery = query(
          collection(db, 'gameSessions'),
          where('userId', '==', userId),
          where('notebookId', '==', notebookId)
        );
        const gameSessionsSnapshot = await getDocs(gameSessionsQuery);
        totalJuegosSessions += gameSessionsSnapshot.size;
        
      } catch (error) {
        console.warn(`Error calculando puntos para notebook ${notebookId}:`, error);
      }
    }

    return {
      repasoInteligente: { score: totalRepasoScore, sessions: totalRepasoSessions },
      estudioActivo: { score: totalActivoScore, sessions: totalActivoSessions },
      estudioLibre: { score: totalLibreScore, sessions: totalLibreSessions },
      quiz: { score: totalQuizScore, sessions: totalQuizSessions },
      juegos: { score: totalJuegosScore, sessions: totalJuegosSessions },
      streakBonus: userStreakBonus // Devolver el streak bonus por separado
    };
    
  } catch (error) {
    console.error('Error en calculateUserModuleStatsExact:', error);
    return {
      repasoInteligente: { score: 0, sessions: 0 },
      estudioActivo: { score: 0, sessions: 0 },
      estudioLibre: { score: 0, sessions: 0 },
      quiz: { score: 0, sessions: 0 },
      juegos: { score: 0, sessions: 0 },
      streakBonus: 0
    };
  }
};

const UserMetricsTable: React.FC = () => {
  const [userMetrics, setUserMetrics] = useState<UserMetrics[]>([]);
  const [filteredMetrics, setFilteredMetrics] = useState<UserMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'scoreGlobal', direction: 'desc' });
  const [filters, setFilters] = useState({
    search: '',
    minScore: '',
    teacher: ''
  });

  const loadUserMetrics = async () => {
    try {
      setLoading(true);
      console.log('📊 Cargando métricas de usuarios...');

      // Obtener usuarios básicos
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      const metricsData: UserMetrics[] = [];
      
      // Procesar todos los usuarios
      const batchSize = 5;
      const users = usersSnapshot.docs; // TODOS los usuarios
      const totalUsers = users.length;
      
      setLoadingProgress({ current: 0, total: totalUsers });
      
      console.log(`📊 Procesando ${totalUsers} usuarios`);
      
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (userDoc) => {
          const userData = userDoc.data();
          const userId = userDoc.id;
          
          try {
            // Ejecutar consultas en paralelo para cada usuario
            const [enrollmentsSnapshot] = await Promise.all([
              getDocs(query(collection(db, 'enrollments'), where('studentId', '==', userId)))
            ]);
            
            // Calcular métricas usando la función EXACTA de ProgressPage
            const moduleStats = await calculateUserModuleStatsExact(userId);
            
            // Procesar profesores enrolados
            let teacherNames = '';
            if (enrollmentsSnapshot.size > 0) {
              const teacherIds = new Set();
              enrollmentsSnapshot.forEach((doc) => {
                const enrollment = doc.data();
                if (enrollment.teacherId) {
                  teacherIds.add(enrollment.teacherId);
                }
              });
              
              if (teacherIds.size > 0) {
                const teacherPromises = Array.from(teacherIds).map(async (teacherId) => {
                  try {
                    const teacherDoc = await getDoc(doc(db, 'users', teacherId as string));
                    if (teacherDoc.exists()) {
                      const teacherData = teacherDoc.data();
                      return teacherData.displayName || teacherData.nombre || teacherId;
                    }
                  } catch (error) {
                    console.warn('Error obteniendo profesor:', error);
                  }
                  return teacherId;
                });
                
                const teacherNamesArray = await Promise.all(teacherPromises);
                teacherNames = teacherNamesArray.join(', ');
              }
            }
            
            // Calcular Score General como suma exacta de todos los módulos + streak bonus (igual que ProgressPage)
            const calculatedScoreGlobal = 
              moduleStats.repasoInteligente.score + 
              moduleStats.estudioActivo.score + 
              moduleStats.estudioLibre.score + 
              moduleStats.quiz.score + 
              moduleStats.juegos.score + 
              (moduleStats.streakBonus || 0);
            
            // Usar siempre el score calculado para que coincida con los módulos + streak
            const finalScoreGlobal = calculatedScoreGlobal;
            
            // Debug info solo para los primeros usuarios
            if (i < 15) { // Primeros 3 lotes (15 usuarios)
              console.log(`📊 [MUESTRA] Usuario: ${userData.email || userData.displayName || userId}`);
              console.log(`  📊 Score Final: ${finalScoreGlobal}`);
              console.log(`  📊 Módulos: R=${moduleStats.repasoInteligente.score}, A=${moduleStats.estudioActivo.score}, L=${moduleStats.estudioLibre.score}, Q=${moduleStats.quiz.score}, J=${moduleStats.juegos.score}`);
              console.log(`  📊 Streak Bonus: ${moduleStats.streakBonus || 0}`);
              console.log(`  ✅ Suma total: ${calculatedScoreGlobal}, Coincide: ${calculatedScoreGlobal === finalScoreGlobal}`);
              console.log('---');
            }
            
            return {
              id: userId,
              nombre: userData.displayName || userData.nombre || 'Sin nombre',
              displayName: userData.displayName,
              email: userData.email || 'Sin email',
              teacherNames,
              scoreGlobal: finalScoreGlobal,
              repasoInteligente: moduleStats.repasoInteligente,
              estudioActivo: moduleStats.estudioActivo,
              estudioLibre: moduleStats.estudioLibre,
              quiz: moduleStats.quiz,
              juegos: moduleStats.juegos
            };
            
          } catch (error) {
            console.warn(`Error procesando usuario ${userData.email}:`, error);
            return null;
          }
        });
        
        // Ejecutar lote y agregar resultados
        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(result => result !== null);
        metricsData.push(...validResults as UserMetrics[]);
        
        // Actualizar progreso
        const processedCount = Math.min(i + batchSize, users.length);
        setLoadingProgress({ current: processedCount, total: totalUsers });
        console.log(`📊 Procesados ${processedCount}/${totalUsers} usuarios`);
      }
      
      console.log(`📊 Métricas cargadas para ${metricsData.length} usuarios`);
      setUserMetrics(metricsData);
      setFilteredMetrics(metricsData);
      
    } catch (error) {
      console.error('Error cargando métricas:', error);
    } finally {
      setLoading(false);
      setLoadingProgress({ current: 0, total: 0 });
    }
  };

  const sortData = (data: UserMetrics[], sortConfig: SortConfig | null): UserMetrics[] => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      const aVal = getMetricsValue(a, sortConfig.key);
      const bVal = getMetricsValue(b, sortConfig.key);
      
      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getMetricsValue = (metrics: UserMetrics, key: string): any => {
    switch (key) {
      case 'nombre':
        return (metrics.displayName || metrics.nombre || '').toLowerCase();
      case 'email':
        return metrics.email.toLowerCase();
      case 'teacherNames':
        return (metrics.teacherNames || '').toLowerCase();
      case 'scoreGlobal':
        return metrics.scoreGlobal || 0;
      case 'repasoInteligente':
        return metrics.repasoInteligente.score || 0;
      case 'estudioActivo':
        return metrics.estudioActivo.score || 0;
      case 'estudioLibre':
        return metrics.estudioLibre.score || 0;
      case 'quiz':
        return metrics.quiz.score || 0;
      case 'juegos':
        return metrics.juegos.score || 0;
      case 'repasoSessions':
        return metrics.repasoInteligente.sessions || 0;
      case 'activoSessions':
        return metrics.estudioActivo.sessions || 0;
      case 'libreSessions':
        return metrics.estudioLibre.sessions || 0;
      case 'quizSessions':
        return metrics.quiz.sessions || 0;
      case 'juegosSessions':
        return metrics.juegos.sessions || 0;
      default:
        return '';
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: string): string => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return '↕️'; // Both arrows
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const filterMetrics = () => {
    let filtered = userMetrics.filter(metrics => {
      const nombre = (metrics.displayName || metrics.nombre || '').toLowerCase();
      const email = metrics.email.toLowerCase();
      const teacher = (metrics.teacherNames || '').toLowerCase();
      
      const matchesSearch = !filters.search || 
        nombre.includes(filters.search.toLowerCase()) ||
        email.includes(filters.search.toLowerCase());
      
      const matchesMinScore = !filters.minScore || 
        metrics.scoreGlobal >= parseInt(filters.minScore);
      
      const matchesTeacher = !filters.teacher || 
        teacher.includes(filters.teacher.toLowerCase());
      
      return matchesSearch && matchesMinScore && matchesTeacher;
    });
    
    // Apply sorting
    filtered = sortData(filtered, sortConfig);
    
    setFilteredMetrics(filtered);
  };

  useEffect(() => {
    loadUserMetrics();
  }, []);

  useEffect(() => {
    filterMetrics();
  }, [filters, userMetrics, sortConfig]);

  if (loading) {
    const progressPercent = loadingProgress.total > 0 
      ? Math.round((loadingProgress.current / loadingProgress.total) * 100) 
      : 0;
    
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando métricas de usuarios...</p>
        <div className="progress-info">
          <div className="progress-bar" style={{ width: '300px', height: '20px', backgroundColor: '#f0f0f0', borderRadius: '10px', overflow: 'hidden', margin: '10px 0' }}>
            <div 
              className="progress-fill" 
              style={{ 
                width: `${progressPercent}%`, 
                height: '100%', 
                backgroundColor: '#4CAF50',
                transition: 'width 0.3s ease',
                borderRadius: '10px'
              }}
            ></div>
          </div>
          <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#666' }}>
            {loadingProgress.current} / {loadingProgress.total} usuarios procesados ({progressPercent}%)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-section">
      <div className="section-header">
        <h2>📊 Métricas de Usuarios ({filteredMetrics.length} de {userMetrics.length})</h2>
        <div className="action-buttons">
          <button 
            className="refresh-btn"
            onClick={loadUserMetrics}
            disabled={loading}
          >
            🔄 Actualizar Métricas
          </button>
        </div>
      </div>
      
      <div className="metrics-filters">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={filters.search}
          onChange={(e) => setFilters({...filters, search: e.target.value})}
          className="search-input"
        />
        
        <input
          type="number"
          placeholder="Score mínimo..."
          value={filters.minScore}
          onChange={(e) => setFilters({...filters, minScore: e.target.value})}
          className="search-input"
          style={{ width: '150px' }}
        />
        
        <input
          type="text"
          placeholder="Filtrar por profesor..."
          value={filters.teacher}
          onChange={(e) => setFilters({...filters, teacher: e.target.value})}
          className="search-input"
        />
        
        <button 
          className="clear-filters-btn"
          onClick={() => setFilters({ search: '', minScore: '', teacher: '' })}
        >
          🗑️ Limpiar Filtros
        </button>
      </div>

      <div className="simple-table-container">
        <table className="simple-metrics-table">
          <thead>
            <tr>
              <th style={{ width: '15%', cursor: 'pointer' }} onClick={() => handleSort('nombre')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Nombre {getSortIcon('nombre')}
                </div>
              </th>
              <th style={{ width: '15%', cursor: 'pointer' }} onClick={() => handleSort('teacherNames')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Profesor {getSortIcon('teacherNames')}
                </div>
              </th>
              <th style={{ width: '10%', cursor: 'pointer' }} onClick={() => handleSort('scoreGlobal')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Score General {getSortIcon('scoreGlobal')}
                </div>
              </th>
              <th style={{ width: '12%', cursor: 'pointer' }} onClick={() => handleSort('repasoInteligente')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Repaso Inteligente {getSortIcon('repasoInteligente')}
                </div>
              </th>
              <th style={{ width: '12%', cursor: 'pointer' }} onClick={() => handleSort('estudioActivo')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Estudio Activo {getSortIcon('estudioActivo')}
                </div>
              </th>
              <th style={{ width: '12%', cursor: 'pointer' }} onClick={() => handleSort('estudioLibre')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Estudio Libre {getSortIcon('estudioLibre')}
                </div>
              </th>
              <th style={{ width: '12%', cursor: 'pointer' }} onClick={() => handleSort('quiz')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Quiz {getSortIcon('quiz')}
                </div>
              </th>
              <th style={{ width: '12%', cursor: 'pointer' }} onClick={() => handleSort('juegos')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Juegos {getSortIcon('juegos')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.map((metrics) => (
              <tr key={metrics.id}>
                <td style={{ width: '15%' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                    {metrics.nombre}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    {metrics.email}
                  </div>
                </td>
                <td style={{ width: '15%' }}>
                  <div style={{ fontSize: '0.8rem', color: '#374151' }}>
                    {metrics.teacherNames || 'Sin profesor'}
                  </div>
                </td>
                <td style={{ width: '10%' }}>
                  <span style={{ 
                    fontWeight: 'bold',
                    color: metrics.scoreGlobal >= 20000 ? '#16a34a' : 
                           metrics.scoreGlobal >= 10000 ? '#ea580c' : 
                           metrics.scoreGlobal >= 1000 ? '#d97706' : '#dc2626'
                  }}>
                    {metrics.scoreGlobal.toLocaleString()}
                  </span>
                </td>
                <td style={{ width: '12%' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                    {metrics.repasoInteligente.score.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    ({metrics.repasoInteligente.sessions} sesiones)
                  </div>
                </td>
                <td style={{ width: '12%' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                    {metrics.estudioActivo.score.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    ({metrics.estudioActivo.sessions} sesiones)
                  </div>
                </td>
                <td style={{ width: '12%' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                    {metrics.estudioLibre.score.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    ({metrics.estudioLibre.sessions} sesiones)
                  </div>
                </td>
                <td style={{ width: '12%' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                    {metrics.quiz.score.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    ({metrics.quiz.sessions} sesiones)
                  </div>
                </td>
                <td style={{ width: '12%' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                    {metrics.juegos.score.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    ({metrics.juegos.sessions} partidas)
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredMetrics.length === 0 && userMetrics.length > 0 && (
          <div className="no-users">
            <p>No se encontraron usuarios con los filtros aplicados</p>
          </div>
        )}
        
        {userMetrics.length === 0 && (
          <div className="no-users">
            <p>No se encontraron métricas</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserMetricsTable;