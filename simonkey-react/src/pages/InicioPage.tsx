import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFire, faClock, faChartLine, faGift, faMedal, faTrophy,
  faBook, faGraduationCap, faChartBar, faCalendarAlt, faCalendar
} from '@fortawesome/free-solid-svg-icons';
import { StudyStreakService } from '../services/studyStreakService';
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

// División levels configuration
const DIVISION_LEVELS = {
  WOOD: { name: 'Madera', icon: '🪵', color: '#8B4513', ranges: [1, 5, 10, 15, 20] },
  STONE: { name: 'Piedra', icon: '⛰️', color: '#808080', ranges: [25, 35, 45, 55, 65] },
  BRONZE: { name: 'Bronce', icon: '🥉', color: '#CD7F32', ranges: [75, 90, 110, 130, 150] },
  SILVER: { name: 'Plata', icon: '🥈', color: '#C0C0C0', ranges: [170, 200, 230, 260, 300] },
  GOLD: { name: 'Oro', icon: '🥇', color: '#FFD700', ranges: [330, 380, 430, 480, 550] },
  RUBY: { name: 'Rubí', icon: '💎', color: '#E0115F', ranges: [600, 700, 850, 1000, 1200] },
  JADE: { name: 'Jade', icon: '💚', color: '#50C878', ranges: [1400, 1650, 1900, 2200, 2500] },
  CRYSTAL: { name: 'Cristal', icon: '💙', color: '#0F52BA', ranges: [2800, 3200, 3700, 4200, 4800] },
  COSMIC: { name: 'Cósmico', icon: '💜', color: '#9966CC', ranges: [5400, 6100, 6900, 7800, 8800] },
  VOID: { name: 'Vacío', icon: '⚫', color: '#1C1C1C', ranges: [10000, 11500, 13000, 15000, 17000] },
  LEGEND: { name: 'Leyenda', icon: '⭐', color: '#FF6B35', ranges: [20000, 25000, 30000, 40000, 50000] }
};

const InicioPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  const userName = userProfile?.displayName || userProfile?.email?.split('@')[0] || 'Santiago';
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [weeklyProgress, setWeeklyProgress] = useState<string>('0%');
  const [currentScore, setCurrentScore] = useState(0);
  const [hasStudiedToday, setHasStudiedToday] = useState(false);
  const [currentDivision, setCurrentDivision] = useState<{ name: string; icon: string }>({ name: 'Madera', icon: '🪵' });
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Calculate division based on concepts learned
  const calculateDivision = (concepts: number) => {
    let divisionKey = 'WOOD';
    
    // Find current division based on concepts
    for (const [key, data] of Object.entries(DIVISION_LEVELS)) {
      const maxInDivision = Math.max(...data.ranges);
      if (concepts >= maxInDivision) {
        continue;
      } else {
        divisionKey = key;
        break;
      }
    }
    
    // If beyond the highest division, stay at legend
    if (concepts >= 50000) {
      divisionKey = 'LEGEND';
    }
    
    const division = DIVISION_LEVELS[divisionKey as keyof typeof DIVISION_LEVELS];
    setCurrentDivision({ name: division.name, icon: division.icon });
  };

  // Fetch today's calendar events
  const fetchTodayEvents = async () => {
    if (!user?.uid) {
      setEventsLoading(false);
      return;
    }

    try {
      setEventsLoading(true);
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const eventsQuery = query(
        collection(db, 'calendarEvents'),
        where('userId', '==', user.uid)
      );
      
      const snapshot = await getDocs(eventsQuery);
      const events: CalendarEvent[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Filter for today's events
        let eventDate = data.date;
        if (data.date instanceof Timestamp) {
          const date = data.date.toDate();
          eventDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        
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

  const fetchData = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    
    try {
        // Obtener racha
        const streakService = StudyStreakService.getInstance();
        const streakData = await streakService.getUserStreak(user.uid);
        setCurrentStreak(streakData.currentStreak);
        
        // Verificar si ha estudiado hoy
        const studiedToday = await streakService.hasStudiedToday(user.uid);
        setHasStudiedToday(studiedToday);

        // Obtener KPIs actuales
        const kpiService = await import('../services/kpiService');
        const kpisData = await kpiService.getKPIsFromCache(user.uid);
        const globalScore = kpisData?.global?.scoreGlobal || 0;
        setCurrentScore(Math.ceil(globalScore));
        
        // Obtener conceptos dominados y calcular división
        const conceptStats = await kpiService.kpiService.getTotalDominatedConceptsByUser(user.uid);
        calculateDivision(conceptStats.conceptosDominados);

        // Obtener historial de posiciones para calcular progreso
        const { getPositionHistory } = await import('../utils/createPositionHistory');
        const history = await getPositionHistory(user.uid, 'general', 2); // Obtener últimas 2 semanas
        
        if (history.length >= 2) {
          // Comparar score actual con el de la semana pasada
          const currentWeekScore = history[0].score;
          const lastWeekScore = history[1].score;
          
          if (lastWeekScore > 0) {
            const percentageChange = ((currentWeekScore - lastWeekScore) / lastWeekScore) * 100;
            const sign = percentageChange >= 0 ? '+' : '';
            setWeeklyProgress(`${sign}${Math.round(percentageChange)}%`);
          } else if (currentWeekScore > 0) {
            setWeeklyProgress('+100%');
          } else {
            setWeeklyProgress('0%');
          }
        } else {
          setWeeklyProgress('N/A');
        }
      } catch (error) {
        console.error('Error obteniendo datos:', error);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchData();
      fetchTodayEvents();
    } else {
      setLoading(false);
      setEventsLoading(false);
    }
  }, [user]);

  // Refrescar datos cuando la página recibe el foco (usuario regresa después de estudiar)
  useEffect(() => {
    const handleFocus = () => {
      if (user?.uid) {
        console.log('Página recibió foco, actualizando datos...');
        fetchData();
        fetchTodayEvents();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  // Datos del dashboard
  const dailyStats = {
    streak: currentStreak,
    todayMinutes: 0,
    weeklyProgress: weeklyProgress,
    weeklyTimeChange: '+15%', // Cambio porcentual en tiempo semanal
    currentDivision: currentDivision.name,
    divisionIcon: currentDivision.icon,
    globalScore: currentScore
  };

  return (
    <div className="dashboard-container">
      <HeaderWithHamburger title="Página de Inicio" />
      
      <div className="dashboard-content">
        
        {/* 🟪 FILA 1: Bienvenida y resumen diario */}
        <section className="row-1">
          <div className="welcome-section">
            <h1 className="welcome-greeting">Hola, {userName}</h1>
          </div>
          
          <div className="daily-metrics">
            <div className="metric-card">
              <FontAwesomeIcon icon={faFire} className="metric-icon fire" />
              <div className="metric-content">
                <span className="metric-label">Racha</span>
                <span className="metric-value">{loading ? '...' : `${dailyStats.streak} días`}</span>
              </div>
            </div>
            
            <div className="metric-card">
              <FontAwesomeIcon icon={faGift} className="metric-icon bonus" />
              <div className="metric-content">
                <span className="metric-label">Bonus</span>
                <span className="metric-value">{loading ? '...' : `${dailyStats.streak * 200} pts`}</span>
              </div>
            </div>
            
            <div className="metric-card">
              <FontAwesomeIcon icon={faChartLine} className="metric-icon progress" />
              <div className="metric-content">
                <span className="metric-label">Estudio Hoy</span>
                <span className="metric-value" style={{ 
                  color: hasStudiedToday ? '#10b981' : '#ef4444',
                  fontSize: '0.9rem'
                }}>
                  {loading ? '...' : hasStudiedToday ? 'INICIADO' : 'NO INICIADO'}
                </span>
              </div>
            </div>
            
            <div className="metric-card">
              <FontAwesomeIcon icon={faMedal} className="metric-icon division" />
              <div className="metric-content">
                <span className="metric-label">División</span>
                <span className="metric-value">
                  <span style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}>{dailyStats.divisionIcon}</span>
                  {dailyStats.currentDivision}
                </span>
              </div>
            </div>
            
            <div className="metric-card">
              <FontAwesomeIcon icon={faTrophy} className="metric-icon score" />
              <div className="metric-content">
                <span className="metric-label">Score Global</span>
                <span className="metric-value">{loading ? '...' : dailyStats.globalScore.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 🟦 FILA 2: Módulos horizontales */}
        <section className="row-2">
          <div className="horizontal-modules-container">
            <div className="horizontal-module">
              <div className="module-content">
                <h3>Módulo 1</h3>
                <p>Contenido del primer módulo</p>
              </div>
            </div>
            
            <div className="horizontal-module">
              <div className="module-content">
                <h3>Módulo 2</h3>
                <p>Contenido del segundo módulo</p>
              </div>
            </div>
            
            <div className="horizontal-module">
              <div className="module-content">
                <h3>Módulo 3</h3>
                <p>Contenido del tercer módulo</p>
              </div>
            </div>
            
            <div className="horizontal-module calendar-module">
              <div className="module-content">
                <div className="module-header">
                  <h3>Calendario</h3>
                  <span className="current-date">
                    {(() => {
                      const today = new Date();
                      const weekday = today.toLocaleDateString('es-ES', { weekday: 'short' });
                      const day = today.getDate().toString().padStart(2, '0');
                      return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}. ${day}`;
                    })()}
                  </span>
                </div>
                <div className="events-container">
                  {eventsLoading ? (
                    <p className="loading-text">Cargando eventos...</p>
                  ) : todayEvents.length > 0 ? (
                    <div className="events-list">
                      {todayEvents.map(event => (
                        <div 
                          key={event.id} 
                          className="event-item clickable-event"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/calendar', { 
                              state: { 
                                selectedDate: event.date,
                                view: 'day'
                              } 
                            });
                          }}
                        >
                          <div className="event-time">{event.time || 'Todo el día'}</div>
                          <div className="event-title">{event.title}</div>
                          {event.description && (
                            <div className="event-description">{event.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-events">No tienes eventos hoy</p>
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

export default InicioPage;