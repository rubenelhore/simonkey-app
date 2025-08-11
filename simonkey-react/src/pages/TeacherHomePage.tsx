import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBook, faChartBar, faCalendarAlt, faBrain, faTrophy,
  faBookOpen, faGamepad, faClock, faGraduationCap
} from '@fortawesome/free-solid-svg-icons';
import { db, collection, query, where, getDocs, getDoc, doc, Timestamp } from '../services/firebase';
import '../styles/InicioPage.css';

// Interface for calendar events
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'study' | 'quiz' | 'custom';
  time?: string;
  description?: string;
}

const TeacherHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const teacherName = userProfile?.displayName || userProfile?.email?.split('@')[0] || 'Profesor';
  
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  
  // Estados para datos de exámenes
  const [examStats, setExamStats] = useState({
    totalExams: 0,
    activeExams: 0,
    scheduledExams: 0,
    finishedExams: 0
  });
  const [examsLoading, setExamsLoading] = useState(false);
  
  // Estados para materias del profesor
  const [teacherSubjects, setTeacherSubjects] = useState<any[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Función para cargar eventos del día actual
  const fetchTodayEvents = async () => {
    if (!user?.uid) return;

    try {
      setEventsLoading(true);
      // Usar fecha local directamente sin ajustes de timezone
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayString = `${year}-${month}-${day}`;
      
      console.log('🗓️ Loading events for today (local):', todayString);
      
      const eventsQuery = query(
        collection(db, 'calendarEvents'),
        where('userId', '==', user.uid)
      );
      
      const snapshot = await getDocs(eventsQuery);
      const events: CalendarEvent[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        let eventDate = data.date;
        
        // Normalizar el formato de fecha
        if (data.date instanceof Timestamp) {
          const date = data.date.toDate();
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          eventDate = `${year}-${month}-${day}`;
        } else if (typeof data.date === 'string' && data.date.includes('T')) {
          // Si viene en formato ISO, extraer solo la fecha
          eventDate = data.date.split('T')[0];
        } else if (typeof data.date === 'string') {
          // Si ya viene en formato YYYY-MM-DD, usarlo tal como está
          eventDate = data.date;
        }
        
        console.log('🗓️ Comparing dates - Event:', eventDate, 'Today:', todayString);
        
        if (eventDate === todayString) {
          events.push({
            id: doc.id,
            title: data.title,
            date: eventDate,
            type: data.type || 'custom',
            time: data.time || '',
            description: data.description || ''
          });
        }
      });
      
      // Sort events by time
      events.sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });
      
      setTodayEvents(events);
      
    } catch (error) {
      console.error('Error fetching today events:', error);
      setTodayEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  // Función para cargar estadísticas de exámenes
  const fetchExamStats = async () => {
    if (!user?.uid) return;

    try {
      setExamsLoading(true);
      
      // Obtener exámenes del profesor
      const examsQuery = query(
        collection(db, 'schoolExams'),
        where('idProfesor', '==', userProfile?.id || user.uid)
      );
      const examsSnap = await getDocs(examsQuery);
      
      let totalExams = 0;
      let activeExams = 0;
      let scheduledExams = 0;
      let finishedExams = 0;
      
      const now = new Date();
      
      examsSnap.forEach(doc => {
        const examData = doc.data();
        totalExams++;
        
        // Determinar el estado del examen
        const status = determineExamStatus(examData);
        
        switch (status) {
          case 'active':
            activeExams++;
            break;
          case 'scheduled':
            scheduledExams++;
            break;
          case 'finished':
            finishedExams++;
            break;
        }
      });
      
      console.log('📊 [TeacherHome] Estadísticas de exámenes:', { totalExams, activeExams, scheduledExams, finishedExams });
      
      setExamStats({
        totalExams,
        activeExams,
        scheduledExams,
        finishedExams
      });
      
    } catch (error) {
      console.error('Error fetching exam stats:', error);
      setExamStats({
        totalExams: 0,
        activeExams: 0,
        scheduledExams: 0,
        finishedExams: 0
      });
    } finally {
      setExamsLoading(false);
    }
  };

  // Función para determinar el estado del examen
  const determineExamStatus = (exam: any): 'draft' | 'scheduled' | 'active' | 'finished' => {
    const now = new Date();
    
    // Si no está activo en el sistema, es borrador
    if (!exam.isActive) {
      return 'draft';
    }
    
    // Si tiene fecha de finalización y ya pasó, está finalizado
    if (exam.endDate) {
      const endDate = exam.endDate.toDate ? exam.endDate.toDate() : new Date(exam.endDate);
      if (now > endDate) {
        return 'finished';
      }
    }
    
    // Si tiene fecha programada y aún no llega, está programado
    if (exam.scheduledDate) {
      const scheduledDate = exam.scheduledDate.toDate ? exam.scheduledDate.toDate() : new Date(exam.scheduledDate);
      if (now < scheduledDate) {
        return 'scheduled';
      }
    }
    
    // Si está activo y no tiene restricciones de fecha, está activo
    return 'active';
  };

  // Función para cargar las materias del profesor
  const fetchTeacherSubjects = async () => {
    // Si ya se están cargando o ya hay materias cargadas, no cargar de nuevo
    if (subjectsLoading || teacherSubjects.length > 0) {
      console.log('📚 [TeacherHome] Saltando carga de materias - ya cargadas o en proceso');
      return;
    }
    
    try {
      setSubjectsLoading(true);
      console.log('📚 [TeacherHome] Iniciando carga de materias del profesor');
      console.log('📚 [TeacherHome] userProfile:', userProfile);
      console.log('📚 [TeacherHome] user?.uid:', user?.uid);
      
      // Para profesores escolares, cargar las materias desde schoolNotebooks
      if (userProfile?.schoolRole === 'teacher') {
        console.log('📚 [TeacherHome] Es profesor escolar, buscando notebooks...');
        console.log('📚 [TeacherHome] idEscuela:', userProfile?.idEscuela);
        
        // Obtener todos los notebooks del profesor
        const notebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('idProfesor', '==', userProfile.id || user?.uid)
        );
        const notebooksSnap = await getDocs(notebooksQuery);
        
        console.log('📚 [TeacherHome] Notebooks encontrados:', notebooksSnap.size);
        
        // Extraer IDs únicos de materias
        const materiaIds = new Set<string>();
        const materiaData = new Map<string, any>();
        
        notebooksSnap.forEach(doc => {
          const notebook = doc.data();
          console.log('📚 [TeacherHome] Notebook:', doc.id, 'idMateria:', notebook.idMateria);
          if (notebook.idMateria) {
            materiaIds.add(notebook.idMateria);
          }
        });
        
        console.log('📚 [TeacherHome] IDs únicos de materias encontradas:', Array.from(materiaIds));
        
        // Cargar información de cada materia
        const subjects = [];
        const addedMateriaIds = new Set(); // Para evitar duplicados
        
        for (const materiaId of materiaIds) {
          console.log('📚 [TeacherHome] Buscando materia con ID:', materiaId);
          
          // Evitar duplicados
          if (addedMateriaIds.has(materiaId)) {
            console.log('📚 [TeacherHome] Materia ya agregada, saltando:', materiaId);
            continue;
          }
          
          // Buscar directamente por ID del documento
          const materiaDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
          
          if (materiaDoc.exists()) {
            const materiaData = materiaDoc.data();
            console.log('📚 [TeacherHome] Materia encontrada:', {
              id: materiaDoc.id,
              nombre: materiaData.nombre,
              idAdmin: materiaData.idAdmin,
              idEscuela: materiaData.idEscuela,
              idProfesor: materiaData.idProfesor
            });
            subjects.push({
              id: materiaDoc.id,
              ...materiaData
            });
            addedMateriaIds.add(materiaId);
          } else {
            console.log('📚 [TeacherHome] No se encontró la materia con ID:', materiaId);
          }
        }
        
        console.log('📚 [TeacherHome] Total de materias cargadas:', subjects.length);
        console.log('📚 [TeacherHome] Materias:', subjects);
        setTeacherSubjects(subjects);
      } else if (userProfile?.subjectIds && userProfile.subjectIds.length > 0) {
        // Para otros tipos de usuarios con subjectIds
        console.log('📚 Cargando materias desde subjectIds:', userProfile.subjectIds);
        
        const subjects: any[] = [];
        for (const subjectId of userProfile.subjectIds) {
          const subjectQuery = query(
            collection(db, 'schoolSubjects')
          );
          const subjectSnap = await getDocs(subjectQuery);
          
          subjectSnap.forEach(doc => {
            if (doc.id === subjectId) {
              subjects.push({
                id: doc.id,
                ...doc.data()
              });
            }
          });
        }
        
        console.log('📚 Materias cargadas:', subjects);
        setTeacherSubjects(subjects);
      } else {
        console.log('👤 El profesor no tiene materias asignadas');
        setTeacherSubjects([]);
      }
      
    } catch (error) {
      console.error('Error cargando materias del profesor:', error);
      setTeacherSubjects([]);
    } finally {
      setSubjectsLoading(false);
    }
  };

  // UseEffect para cargar eventos y estadísticas
  useEffect(() => {
    if (user?.uid && userProfile) {
      fetchTodayEvents();
      fetchExamStats();
    }
  }, [user?.uid, userProfile]);

  // UseEffect separado para cargar materias solo una vez
  useEffect(() => {
    if (user?.uid && userProfile && !subjectsLoading && teacherSubjects.length === 0) {
      fetchTeacherSubjects();
    }
  }, [user?.uid, userProfile?.id]); // Solo depende del ID del perfil, no del objeto completo

  // Función para navegar al calendario con fecha específica
  const handleEventClick = (event: CalendarEvent) => {
    console.log('🗓️ Original event date:', event.date);
    
    // Usar directamente la fecha del evento ya que debería estar en formato YYYY-MM-DD
    let formattedDate = event.date;
    
    // Validar que la fecha esté en el formato correcto
    if (event.date && event.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      formattedDate = event.date;
    } else if (event.date) {
      // Si la fecha viene en formato diferente, convertirla correctamente
      const date = new Date(event.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    }
    
    console.log('🗓️ Final date for navigation:', formattedDate);
    
    // Navegar al calendario con la fecha del evento
    navigate('/calendar', { 
      state: { 
        selectedDate: formattedDate,
        view: 'day'
      } 
    });
  };

  return (
    <div className="dashboard-container">
      <HeaderWithHamburger title="Panel de Profesor" />
      
      <div className="dashboard-content">
        
        {/* 🟪 FILA 1: Solo Bienvenida */}
        <section className="row-1">
          <div className="welcome-section">
            <h1 className="welcome-greeting">Hola, {teacherName}</h1>
          </div>
        </section>

        {/* 🟦 FILA 2: Módulos horizontales */}
        <section className="row-2">
          <div className="horizontal-modules-container">
            
            {/* Módulo de Materias */}
            <div 
              className="horizontal-module materias-dominio-module"
              onClick={() => {
                console.log('🚀 Click en módulo Materias - Navegando a /materias');
                navigate('/materias');
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="module-content">
                <div className="module-header">
                  <h3>Materias</h3>
                  <span className="current-date">
                    {subjectsLoading ? 'Cargando...' : `${teacherSubjects.length} asignadas`}
                  </span>
                </div>
                <div className="materias-container">
                  {subjectsLoading ? (
                    <div className="no-materias">
                      <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '0.5rem' }}></i>
                      <p style={{ margin: 0, fontWeight: 600 }}>Cargando materias...</p>
                    </div>
                  ) : teacherSubjects.length > 0 ? (
                    <div className="materias-list" style={{ padding: '0.5rem' }}>
                      {teacherSubjects.slice(0, 3).map((subject, index) => (
                        <div 
                          key={subject.id} 
                          className="materia-item" 
                          style={{
                            padding: '0.75rem',
                            marginBottom: '0.5rem',
                            background: 'rgba(97, 71, 255, 0.05)',
                            borderRadius: '8px',
                            borderLeft: '3px solid #6147FF',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FontAwesomeIcon 
                              icon={faGraduationCap} 
                              style={{ color: '#6147FF', fontSize: '1rem' }}
                            />
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                              {subject.nombre || subject.name}
                            </span>
                          </div>
                          {subject.grado && (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '1.5rem' }}>
                              {subject.grado}
                            </span>
                          )}
                        </div>
                      ))}
                      {teacherSubjects.length > 3 && (
                        <p style={{ 
                          textAlign: 'center', 
                          fontSize: '0.75rem', 
                          color: '#6147FF',
                          marginTop: '0.5rem',
                          fontWeight: 600
                        }}>
                          +{teacherSubjects.length - 3} más...
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="no-materias">
                      <FontAwesomeIcon icon={faBook} style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Sin materias asignadas</p>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
                        Contacta con el administrador
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Módulo de Exámenes */}
            <div className="horizontal-module study-modes-module">
              <div className="module-content">
                <div className="module-header">
                  <h3>Mis Exámenes</h3>
                  <span className="current-date">Gestión</span>
                </div>
                <div className="study-modes-grid">
                  <div 
                    className="study-mode-card intelligent-mode clickable" 
                    onClick={() => navigate('/school/teacher/exams', { state: { filter: 'all' } })}
                    title="Ver todos los exámenes"
                  >
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-file-alt"></i>
                    </div>
                    <span className="mode-title">
                      Total: {examsLoading ? '...' : examStats.totalExams}
                    </span>
                  </div>
                  
                  <div 
                    className="study-mode-card quiz-mode clickable"
                    onClick={() => navigate('/school/teacher/exams', { state: { filter: 'active' } })}
                    title="Ver exámenes activos"
                  >
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-play-circle"></i>
                    </div>
                    <span className="mode-title">
                      Activos: {examsLoading ? '...' : examStats.activeExams}
                    </span>
                  </div>
                  
                  <div 
                    className="study-mode-card free-mode clickable"
                    onClick={() => navigate('/school/teacher/exams', { state: { filter: 'scheduled' } })}
                    title="Ver exámenes programados"
                  >
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-clock"></i>
                    </div>
                    <span className="mode-title">
                      Programados: {examsLoading ? '...' : examStats.scheduledExams}
                    </span>
                  </div>
                  
                  <div 
                    className="study-mode-card games-mode clickable"
                    onClick={() => navigate('/school/teacher/exams', { state: { filter: 'finished' } })}
                    title="Ver exámenes finalizados"
                  >
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-check-circle"></i>
                    </div>
                    <span className="mode-title">
                      Finalizados: {examsLoading ? '...' : examStats.finishedExams}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Módulo de Progreso */}
            <div className="horizontal-module progress-module">
              <div className="module-content">
                <div className="module-header">
                  <h3>Analítica</h3>
                  <span className="current-date">Resumen</span>
                </div>
                <div className="progress-insights-container">
                  <div className="progress-metric">
                    <div className="progress-metric-value">
                      <i className="fas fa-users"></i>
                      <span>---</span>
                    </div>
                    <span className="progress-metric-label">Estudiantes Activos</span>
                  </div>
                  
                  <div className="progress-metric">
                    <div className="progress-metric-value">
                      <i className="fas fa-chart-bar"></i>
                      <span>---%</span>
                    </div>
                    <span className="progress-metric-label">Promedio General</span>
                  </div>
                  
                  <div className="progress-metric">
                    <div className="progress-metric-value">
                      <i className="fas fa-clock"></i>
                      <span>--- min</span>
                    </div>
                    <span className="progress-metric-label">Tiempo Promedio</span>
                  </div>
                  
                  <div className="progress-metric">
                    <div className="progress-metric-value">
                      <i className="fas fa-file-alt"></i>
                      <span>---</span>
                    </div>
                    <span className="progress-metric-label">Exámenes Creados</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Módulo de Calendario */}
            <div className="horizontal-module calendar-module">
              <div className="module-content">
                <div className="module-header">
                  <h3>Calendario</h3>
                  <span className="current-date">
                    {(() => {
                      const today = new Date();
                      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                      const dayName = days[today.getDay()];
                      const dayNumber = String(today.getDate()).padStart(2, '0');
                      return `${dayName}. ${dayNumber}`;
                    })()}
                  </span>
                </div>
                <div className="calendar-container">
                  {eventsLoading ? (
                    <div className="loading-events">
                      <i className="fas fa-spinner fa-spin" style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}></i>
                      <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Cargando eventos...</p>
                    </div>
                  ) : todayEvents.length > 0 ? (
                    <div className="events-list">
                      {todayEvents.slice(0, 3).map(event => (
                        <div 
                          key={event.id} 
                          className="event-item clickable"
                          onClick={() => handleEventClick(event)}
                          title="Click para ver en el calendario"
                        >
                          <div className="event-time">
                            {event.time || 'Todo el día'}
                          </div>
                          <div className="event-details">
                            <div className="event-title">{event.title}</div>
                            {event.description && (
                              <div className="event-description">{event.description}</div>
                            )}
                          </div>
                          <div className={`event-type ${event.type}`}>
                            <i className={`fas ${
                              event.type === 'study' ? 'fa-book' : 
                              event.type === 'quiz' ? 'fa-trophy' : 
                              'fa-calendar-alt'
                            }`}></i>
                          </div>
                        </div>
                      ))}
                      {todayEvents.length > 3 && (
                        <div className="more-events">
                          <span>+{todayEvents.length - 3} eventos más</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="events-list">
                      <div className="event-item" style={{ opacity: 0.6, cursor: 'default' }}>
                        <div className="event-time">
                          Todo el día
                        </div>
                        <div className="event-details">
                          <div className="event-title">No tienes eventos hoy</div>
                          <div className="event-description">
                            <span 
                              onClick={() => navigate('/calendar')}
                              style={{ cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}
                            >
                              Agregar evento al calendario
                            </span>
                          </div>
                        </div>
                        <div className="event-type custom" style={{ opacity: 0.5 }}>
                          <i className="fas fa-calendar-alt"></i>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        </section>
      </div>
    </div>
  );
};

export default TeacherHomePage;