import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBook, faChartBar, faCalendarAlt, faBrain, faTrophy,
  faBookOpen, faGamepad, faClock, faGraduationCap
} from '@fortawesome/free-solid-svg-icons';
import { db, collection, query, where, getDocs, Timestamp } from '../services/firebase';
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

  useEffect(() => {
    if (user?.uid) {
      fetchTodayEvents();
    }
  }, [user?.uid]);

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
            <div className="horizontal-module materias-dominio-module">
              <div className="module-content">
                <div className="module-header">
                  <h3>Materias</h3>
                  <span className="current-date">Gestión</span>
                </div>
                <div className="materias-container">
                  <div className="no-materias">
                    <FontAwesomeIcon icon={faBook} style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Panel de Materias</p>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>Administra tus materias</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Módulo de Modos de Estudio */}
            <div className="horizontal-module study-modes-module">
              <div className="module-content">
                <div className="module-header">
                  <h3>Estudiantes</h3>
                  <span className="current-date">Seguimiento</span>
                </div>
                <div className="study-modes-grid">
                  <div className="study-mode-card intelligent-mode">
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-user-graduate"></i>
                    </div>
                    <span className="mode-title">Progreso</span>
                  </div>
                  
                  <div className="study-mode-card quiz-mode">
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-chart-line"></i>
                    </div>
                    <span className="mode-title">Métricas</span>
                  </div>
                  
                  <div className="study-mode-card free-mode">
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-tasks"></i>
                    </div>
                    <span className="mode-title">Tareas</span>
                  </div>
                  
                  <div className="study-mode-card games-mode">
                    <div className="mode-icon-wrapper">
                      <i className="fas fa-clipboard-list"></i>
                    </div>
                    <span className="mode-title">Evaluaciones</span>
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
                    <div className="no-events">
                      <FontAwesomeIcon icon={faCalendarAlt} style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Sin eventos para hoy</p>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
                        <span 
                          onClick={() => navigate('/calendar')}
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Agregar evento
                        </span>
                      </p>
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