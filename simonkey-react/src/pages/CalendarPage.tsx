import React, { useState, useEffect, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { db, collection, addDoc, query, where, getDocs, Timestamp } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

// El tipo correcto para el valor del calendario
// Puede ser Date, [Date, Date] (rango), o null
// Usamos 'any' para evitar problemas de tipado con la librería
const CalendarPage: React.FC = () => {
  const [value, setValue] = useState<any>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [eventsByDate, setEventsByDate] = useState<Record<string, string[]>>({});
  const { user } = useAuth();

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setSelectedDate(null);
  };

  const openCreateEventModal = () => {
    setShowCreateEventModal(true);
    setNewEventDate(new Date());
    setNewEventTitle('');
  };

  const closeCreateEventModal = () => {
    setShowCreateEventModal(false);
  };

  // Cargar eventos del usuario al montar
  useEffect(() => {
    if (!user) return;
    const fetchEvents = async () => {
      const q = query(collection(db, 'calendarEvents'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const events: Record<string, string[]> = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.date && data.date.toDate ? data.date.toDate() : new Date(data.date);
        const key = date.toDateString();
        if (!events[key]) events[key] = [];
        events[key].push(data.title);
      });
      setEventsByDate(events);
    };
    fetchEvents();
  }, [user]);

  // Guardar evento en Firestore
  const handleCreateEvent = async () => {
    if (!newEventDate || !newEventTitle.trim() || !user) return;
    const key = newEventDate.toDateString();
    const eventData = {
      userId: user.uid,
      date: Timestamp.fromDate(newEventDate),
      title: newEventTitle.trim(),
      createdAt: Timestamp.now()
    };
    await addDoc(collection(db, 'calendarEvents'), eventData);
    setEventsByDate(prev => ({
      ...prev,
      [key]: prev[key] ? [...prev[key], newEventTitle.trim()] : [newEventTitle.trim()]
    }));
    setShowCreateEventModal(false);
  };

  // Formato de fecha para mostrar
  const formatDate = (date: Date) =>
    date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Obtener eventos del día seleccionado
  const events = selectedDate ? eventsByDate[selectedDate.toDateString()] || [] : [];

  // Renderizar tileContent para mostrar punto en días con eventos
  const renderTileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month' && eventsByDate[date.toDateString()] && eventsByDate[date.toDateString()].length > 0) {
      return (
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#6147FF',
          margin: '4px auto 0 auto',
        }}></div>
      );
    }
    return null;
  };

  // --- Lógica para eventos de la semana actual ---
  function getWeekRange(date = new Date()) {
    const day = date.getDay() || 7; // Lunes = 1, Domingo = 7
    const monday = new Date(date);
    monday.setHours(0,0,0,0);
    monday.setDate(date.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    return { start: monday, end: sunday };
  }
  const { start: weekStart, end: weekEnd } = getWeekRange();
  // Convertir eventsByDate a lista de eventos con fecha
  const eventosSemana = useMemo(() => {
    const eventos: { date: Date, title: string }[] = [];
    Object.entries(eventsByDate).forEach(([dateStr, titles]) => {
      const date = new Date(dateStr);
      if (date >= weekStart && date <= weekEnd) {
        titles.forEach(title => eventos.push({ date, title }));
      }
    });
    // Ordenar por fecha
    return eventos.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [eventsByDate, weekStart, weekEnd]);

  return (
    <>
      <HeaderWithHamburger title="Calendario" />
      <div style={{ minHeight: 'calc(100vh - 80px)', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', padding: '0 0' }}>
        {/* Módulo lateral izquierdo */}
        <aside style={{
          width: 370,
          minWidth: 270,
          maxWidth: 400,
          background: 'white',
          borderRadius: 28,
          boxShadow: '0 2px 8px rgba(97,71,255,0.05)',
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          marginLeft: 32,
          marginRight: 32,
          marginTop: 32,
          marginBottom: 32,
          minHeight: 700
        }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 32, color: '#6147FF', letterSpacing: 1 }}>Acciones</h2>
          <button style={{
            background: 'linear-gradient(90deg, #6147FF 0%, #A685E2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 18,
            padding: '18px 36px',
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 24,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(97,71,255,0.08)',
            transition: 'background 0.2s'
          }}
          onClick={openCreateEventModal}
          >
            + Crear evento
          </button>
          <div style={{ marginTop: 40, color: '#888', fontSize: 18, textAlign: 'center' }}>
            Aquí podrás crear, ver y gestionar tus eventos del calendario.
          </div>
        </aside>
        {/* Calendario principal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', minHeight: 600, maxWidth: '100%', marginRight: 32 }}>
          <div style={{ width: '100%', maxWidth: 1200, minWidth: 0, height: 520, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginTop: 32 }}>
            <Calendar
              onChange={setValue}
              value={showEventModal ? null : value}
              locale="es-ES"
              className="big-calendar formal-calendar"
              onClickDay={handleDayClick}
              tileContent={renderTileContent}
            />
          </div>
          {/* Módulo de acciones para esta semana */}
          <div style={{
            width: '100%',
            maxWidth: 1200,
            margin: '32px 0 0 0',
            background: 'white',
            borderRadius: 20,
            boxShadow: '0 4px 24px rgba(97,71,255,0.07)',
            padding: '32px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            minHeight: 160
          }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#6147FF', marginBottom: 16 }}>Acciones para esta semana</h3>
            {eventosSemana.length === 0 ? (
              <div style={{ color: '#888', fontSize: 20, textAlign: 'center', width: '100%', margin: '24px 0' }}>
                <span role="img" aria-label="changuito durmiendo" style={{ fontSize: 38, display: 'block', marginBottom: 8 }}>🙈💤</span>
                No hay eventos para esta semana
              </div>
            ) : (
              <ul style={{ color: '#333', fontSize: 18, margin: 0, padding: 0, listStyle: 'none', width: '100%' }}>
                {eventosSemana.map((ev, idx) => (
                  <li key={idx} style={{ marginBottom: 10 }}>
                    <b>{ev.date.toLocaleDateString('es-ES', { weekday: 'long' })}:</b> {ev.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {/* Modal de eventos del día */}
      {showEventModal && selectedDate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'white',
            borderRadius: 18,
            boxShadow: '0 8px 32px rgba(97,71,255,0.12)',
            padding: '40px 32px 32px 32px',
            minWidth: 340,
            maxWidth: 400,
            textAlign: 'center',
            position: 'relative',
          }}>
            <button onClick={closeEventModal} style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'none',
              border: 'none',
              fontSize: 22,
              color: '#6147FF',
              cursor: 'pointer',
              fontWeight: 700
            }}>&times;</button>
            <h2 style={{ color: '#6147FF', fontWeight: 700, fontSize: '1.3rem', marginBottom: 16 }}>
              {formatDate(selectedDate)}
            </h2>
            {events.length === 0 ? (
              <div style={{ color: '#888', fontSize: 18, marginTop: 16 }}>
                No tienes eventos agendados para este día
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {events.map((event, idx) => (
                  <li key={idx} style={{ color: '#333', fontSize: 17, marginBottom: 10 }}>{event}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {/* Modal dummy para crear evento */}
      {showCreateEventModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'white',
            borderRadius: 18,
            boxShadow: '0 8px 32px rgba(97,71,255,0.12)',
            padding: '40px 32px 32px 32px',
            minWidth: 340,
            maxWidth: 400,
            textAlign: 'center',
            position: 'relative',
          }}>
            <button onClick={closeCreateEventModal} style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'none',
              border: 'none',
              fontSize: 22,
              color: '#6147FF',
              cursor: 'pointer',
              fontWeight: 700
            }}>&times;</button>
            <h2 style={{ color: '#6147FF', fontWeight: 700, fontSize: '1.3rem', marginBottom: 16 }}>
              Crear evento
            </h2>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 600, color: '#6147FF', fontSize: 16 }}>Fecha:</label><br />
              <input type="date" value={newEventDate ? newEventDate.toISOString().split('T')[0] : ''} 
                onChange={e => {
                  if (e.target.value) {
                    const [year, month, day] = e.target.value.split('-');
                    setNewEventDate(new Date(Number(year), Number(month) - 1, Number(day)));
                  } else {
                    setNewEventDate(null);
                  }
                }} 
                style={{ fontSize: 16, padding: 8, borderRadius: 8, border: '1.5px solid #e0e7ef', marginTop: 6 }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontWeight: 600, color: '#6147FF', fontSize: 16 }}>Título del evento:</label><br />
              <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} style={{ fontSize: 16, padding: 8, borderRadius: 8, border: '1.5px solid #e0e7ef', marginTop: 6, width: '90%' }} placeholder="Ej: Examen de matemáticas" />
            </div>
            <button style={{
              background: 'linear-gradient(90deg, #6147FF 0%, #A685E2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '12px 32px',
              fontSize: 18,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(97,71,255,0.08)',
              transition: 'background 0.2s'
            }}
            onClick={handleCreateEvent}
            >
              Crear
            </button>
          </div>
        </div>
      )}
      <style>{`
        .formal-calendar {
          width: 100% !important;
          height: 100% !important;
          font-size: 2.1rem !important;
          background: #fff !important;
          border-radius: 18px !important;
          box-shadow: 0 2px 8px rgba(97,71,255,0.05) !important;
          border: 1.5px solid #e0e7ef !important;
          padding: 18px 0 24px 0 !important;
          min-height: 480px;
          max-width: 1200px;
        }
        .formal-calendar .react-calendar__navigation {
          background: none;
          border-bottom: 1.5px solid #e0e7ef;
          margin-bottom: 16px;
        }
        .formal-calendar .react-calendar__navigation button {
          font-size: 1.3rem;
          padding: 10px 0;
          color: #6147FF;
          font-weight: 500;
          background: none;
          border-radius: 6px;
          transition: background 0.2s;
        }
        .formal-calendar .react-calendar__navigation button:enabled:hover {
          background: #f3f0ff;
        }
        .formal-calendar .react-calendar__month-view {
          min-height: 350px;
        }
        .formal-calendar .react-calendar__tile {
          min-height: 48px;
          font-size: 1.1rem;
          border-radius: 8px;
          color: #333;
          background: none;
          border: 1px solid transparent;
          transition: background 0.2s, color 0.2s, border 0.2s;
        }
        .formal-calendar .react-calendar__tile--active {
          background: #e0e7ff !important;
          color: #6147FF !important;
          font-weight: 700;
          border: 1.5px solid #6147FF !important;
        }
        .formal-calendar .react-calendar__tile:enabled:hover {
          background: #f8fafc !important;
          color: #6147FF !important;
          border: 1.5px solid #A685E2 !important;
        }
        .formal-calendar .react-calendar__tile--now {
          background: #f3f0ff !important;
          color: #6147FF !important;
          font-weight: 600;
          border: 1.5px solid #A685E2 !important;
        }
        .formal-calendar .react-calendar__month-view__weekdays {
          text-align: center;
          font-size: 1rem;
          color: #6147FF;
          font-weight: 500;
          background: none;
        }
      `}</style>
    </>
  );
};

export default CalendarPage; 