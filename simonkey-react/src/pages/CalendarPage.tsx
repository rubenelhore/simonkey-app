import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es as esES } from 'date-fns/locale';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { db, collection, addDoc, query, where, getDocs, Timestamp, doc, updateDoc, deleteDoc, getDoc } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';
import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';
import { getNextSmartStudyDate } from '../utils/sm3Algorithm';
import { Notebook } from '../types/interfaces';

// El tipo correcto para el valor del calendario
// Puede ser Date, [Date, Date] (rango), o null
// Usamos 'any' para evitar problemas de tipado con la librería
// Tipos para eventos de estudio
interface StudyEvent {
  id: string;
  title: string;
  type: 'quiz' | 'smart' | 'custom';
  notebookId?: string;
  notebookTitle?: string;
  date?: Date; // <-- Para eventos personalizados con hora
  details?: string; // <-- Para detalles opcionales
}

// Configuración de localización para react-big-calendar
const locales = {
  'es': esES,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Toolbar personalizado para ocultar el botón 'Hoy'
import { ToolbarProps } from 'react-big-calendar';
function CustomToolbar(toolbar: ToolbarProps<{ title: string; start: Date; end: Date; type: string; notebookId?: string }, object>) {
  return (
    <div className="rbc-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <span className="rbc-btn-group">
        <button type="button" onClick={() => toolbar.onNavigate('PREV')}>Anterior</button>
        <button type="button" onClick={() => toolbar.onNavigate('NEXT')}>Siguiente</button>
      </span>
      <span className="rbc-toolbar-label" style={{ fontWeight: 700, fontSize: 18 }}>{toolbar.label}</span>
      <span className="rbc-btn-group" style={{ display: 'flex', gap: 0 }}>
        {["day", "week", "month"].map((view, idx) => (
          <button
            key={view}
            type="button"
            className={toolbar.view === view ? 'rbc-active' : ''}
            onClick={() => toolbar.onView(view as any)}
            style={{
              // Unir botones: sin margen entre ellos, solo el primero puede tener border-radius a la izquierda y el último a la derecha
              marginLeft: 0,
              borderRadius: idx === 0 ? '6px 0 0 6px' : idx === 2 ? '0 6px 6px 0' : '0',
              fontWeight: toolbar.view === view ? 700 : 400,
              borderRight: idx < 2 ? '1px solid #e0e7ef' : 'none',
              borderLeft: 'none',
              borderTop: '1.5px solid #e0e7ef',
              borderBottom: '1.5px solid #e0e7ef',
              background: toolbar.view === view ? '#e0e7ff' : '#fff',
              color: toolbar.view === view ? '#6147FF' : '#333',
              zIndex: 1
            }}
          >
            {view === 'day' ? 'Día' : view === 'week' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </span>
    </div>
  );
}

const CalendarPage: React.FC = () => {
  const [value, setValue] = useState<any>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [eventsByDate, setEventsByDate] = useState<Record<string, StudyEvent[]>>({});
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventTitle, setEditingEventTitle] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isSchoolStudent } = useUserType();
  const { schoolNotebooks } = useSchoolStudentData();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  // Estado para la vista del calendario
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("month");
  // Día actual para la vista de día
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);
  const todayEvents = eventsByDate[today.toDateString()] || [];
  // Estado para la fecha actual del calendario
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any>(null); // Nuevo estado para el evento seleccionado
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false); // Nuevo estado para el modal de detalles
  const [savingEvent, setSavingEvent] = useState(false); // Nuevo estado para feedback de guardado
  const [deletingEvent, setDeletingEvent] = useState(false); // Nuevo estado para feedback de borrado

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setSelectedDate(null);
    setValue(null); // Desmarcar el día seleccionado
  };

  const openCreateEventModal = () => {
    setShowCreateEventModal(true);
    setNewEventDate(new Date());
    setNewEventTitle('');
  };

  const closeCreateEventModal = () => {
    setShowCreateEventModal(false);
  };

  const handleCreateEventFromPopup = () => {
    if (selectedDate) {
      setNewEventDate(selectedDate);
      setNewEventTitle('');
      setShowEventModal(false);
      setShowCreateEventModal(true);
    }
  };

  // Cargar notebooks del usuario
  useEffect(() => {
    if (!user) return;
    const loadNotebooks = async () => {
      // Para usuarios regulares, usar el UID directamente
      // Para usuarios escolares, usar los notebooks ya cargados por el hook
      const userId = user.uid;
      
      if (isSchoolStudent && schoolNotebooks && schoolNotebooks.length > 0) {
        setNotebooks(schoolNotebooks);
      } else {
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', userId)
        );
        const snapshot = await getDocs(notebooksQuery);
        const userNotebooks: Notebook[] = [];
        snapshot.forEach(doc => {
          userNotebooks.push({ id: doc.id, ...doc.data() } as Notebook);
        });
        setNotebooks(userNotebooks);
      }
    };
    loadNotebooks();
  }, [user, isSchoolStudent, schoolNotebooks]);

  // Función para calcular próximas fechas de estudio
  const calculateStudyDates = async (notebook: Notebook, userId: string) => {
    const studyDates: { quiz?: Date; smart?: Date; quizAvailable?: boolean; smartAvailable?: boolean } = {};
    
    console.log(`[CALENDAR] Calculando fechas para cuaderno: ${notebook.title}`);
    
    try {
      // Obtener límites del notebook
      const notebookLimitsRef = doc(db, 'users', userId, 'notebookLimits', notebook.id);
      const notebookLimitsDoc = await getDoc(notebookLimitsRef);
      
      if (notebookLimitsDoc.exists()) {
        const limits = notebookLimitsDoc.data();
        
        // Calcular disponibilidad de quiz
        studyDates.quizAvailable = false;
        if (limits.lastQuizDate) {
          const lastQuiz = limits.lastQuizDate.toDate();
          const daysSinceLastQuiz = Math.floor((Date.now() - lastQuiz.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceLastQuiz >= 7) {
            studyDates.quizAvailable = true;
            studyDates.quiz = new Date(); // Disponible hoy
          } else {
            const nextQuiz = new Date(lastQuiz);
            nextQuiz.setDate(nextQuiz.getDate() + 7);
            studyDates.quiz = nextQuiz; // Disponible en el futuro
          }
        } else {
          // Primer quiz
          studyDates.quizAvailable = true;
          studyDates.quiz = new Date(); // Disponible hoy
        }
        
        // Verificar disponibilidad de estudio inteligente
        studyDates.smartAvailable = false;
        
        // Primero verificar si ya se usó hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (limits.lastSmartStudyDate) {
          const lastSmart = limits.lastSmartStudyDate.toDate();
          lastSmart.setHours(0, 0, 0, 0);
          
          if (lastSmart.getTime() === today.getTime()) {
            // Ya se usó hoy, estará disponible mañana
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            studyDates.smart = tomorrow;
            studyDates.smartAvailable = false;
          } else {
            // No se ha usado hoy, verificar si hay conceptos para repasar
            const learningRef = collection(db, 'users', userId, 'learningData');
            const learningQuery = query(learningRef, where('notebookId', '==', notebook.id));
            const learningSnapshot = await getDocs(learningQuery);
            
            let hasConceptsToReview = false;
            learningSnapshot.forEach(doc => {
              const data = doc.data();
              if (data.nextReviewDate) {
                const reviewDate = data.nextReviewDate.toDate();
                if (reviewDate <= new Date()) {
                  hasConceptsToReview = true;
                }
              }
            });
            
            if (hasConceptsToReview) {
              studyDates.smartAvailable = true;
              studyDates.smart = new Date(); // Disponible hoy
            } else {
              // No hay conceptos para repasar hoy, buscar próxima fecha
              let nextSmartDate: Date | null = null;
              learningSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.nextReviewDate) {
                  const reviewDate = data.nextReviewDate.toDate();
                  if (reviewDate > new Date() && (!nextSmartDate || reviewDate < nextSmartDate)) {
                    nextSmartDate = reviewDate;
                  }
                }
              });
              
              if (nextSmartDate) {
                studyDates.smart = nextSmartDate;
              }
            }
          }
        } else {
          // Nunca se ha usado, verificar si hay conceptos
          const learningRef = collection(db, 'users', userId, 'learningData');
          const learningQuery = query(learningRef, where('notebookId', '==', notebook.id));
          const learningSnapshot = await getDocs(learningQuery);
          
          if (!learningSnapshot.empty) {
            studyDates.smartAvailable = true;
            studyDates.smart = new Date(); // Disponible hoy
          }
        }
      } else {
        // No hay límites, es un cuaderno nuevo
        console.log(`[CALENDAR] Cuaderno nuevo sin límites: ${notebook.title}`);
        
        // Para cuadernos nuevos, verificar si tienen conceptos
        // Intentar primero con usuarioId
        let conceptsQuery = query(
          collection(db, 'conceptos'),
          where('cuadernoId', '==', notebook.id),
          where('usuarioId', '==', userId)
        );
        let conceptsSnapshot = await getDocs(conceptsQuery);
        
        // Si no encuentra con usuarioId, intentar solo con cuadernoId
        if (conceptsSnapshot.empty) {
          console.log(`[CALENDAR] No se encontraron conceptos con usuarioId, intentando solo con cuadernoId`);
          conceptsQuery = query(
            collection(db, 'conceptos'),
            where('cuadernoId', '==', notebook.id)
          );
          conceptsSnapshot = await getDocs(conceptsQuery);
        }
        
        let hasConcepts = false;
        let totalConceptCount = 0;
        conceptsSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`[CALENDAR] Documento de conceptos encontrado:`, data);
          if (data.conceptos && Array.isArray(data.conceptos) && data.conceptos.length > 0) {
            hasConcepts = true;
            totalConceptCount += data.conceptos.length;
          }
        });
        
        console.log(`[CALENDAR] Cuaderno ${notebook.title} tiene ${totalConceptCount} conceptos`);
        
        if (hasConcepts) {
          // Si tiene conceptos, tanto quiz como estudio inteligente están disponibles
          studyDates.quizAvailable = true;
          studyDates.quiz = new Date();
          studyDates.smartAvailable = true;
          studyDates.smart = new Date();
          console.log(`[CALENDAR] Estudios disponibles hoy para cuaderno nuevo: ${notebook.title}`);
        } else {
          console.log(`[CALENDAR] Cuaderno nuevo sin conceptos: ${notebook.title}`);
        }
      }
    } catch (error) {
      console.error('Error calculating study dates:', error);
    }
    
    console.log(`[CALENDAR] Fechas calculadas para ${notebook.title}:`, studyDates);
    return studyDates;
  };

  // Cargar eventos del usuario al montar
  useEffect(() => {
    if (!user || notebooks.length === 0) return;
    
    const fetchAllEvents = async () => {
      // Para usuarios escolares, necesitamos obtener el ID efectivo
      let userId = user.uid;
      
      // Si es un estudiante escolar, buscar su ID de documento
      if (isSchoolStudent) {
        try {
          const usersQuery = query(
            collection(db, 'users'),
            where('email', '==', user.email)
          );
          const usersSnapshot = await getDocs(usersQuery);
          if (!usersSnapshot.empty) {
            userId = usersSnapshot.docs[0].id;
            console.log(`[CALENDAR] Usuario escolar detectado, usando ID: ${userId}`);
          }
        } catch (error) {
          console.error('[CALENDAR] Error obteniendo ID de usuario escolar:', error);
        }
      }
      
      const allEvents: Record<string, StudyEvent[]> = {};
      
      // 1. Cargar eventos personalizados
      const q = query(collection(db, 'calendarEvents'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const date = data.date && data.date.toDate ? data.date.toDate() : new Date(data.date);
        // Usar el id como clave única
        allEvents[docSnap.id] = [{
          id: docSnap.id,
          title: data.title,
          type: 'custom',
          date: date
        }];
      });
      
      // 2. Cargar eventos de estudio para cada notebook
      console.log(`[CALENDAR] Procesando ${notebooks.length} notebooks`);
      
      for (const notebook of notebooks) {
        console.log(`[CALENDAR] Procesando notebook: ${notebook.title} (ID: ${notebook.id})`);
        const studyDates = await calculateStudyDates(notebook, userId);
        
        // Agregar eventos de quiz
        if (studyDates.quiz) {
          console.log(`[CALENDAR] Agregando quiz para ${notebook.title} en fecha: ${studyDates.quiz.toDateString()}`);
          const quizKey = studyDates.quiz.toDateString();
          if (!allEvents[quizKey]) allEvents[quizKey] = [];
          
          // Si el quiz está disponible hoy, mostrar como "Disponible"
          const quizTitle = studyDates.quizAvailable 
            ? `📝 Quiz disponible: ${notebook.title}`
            : `📝 Quiz programado: ${notebook.title}`;
          
          allEvents[quizKey].push({
            id: `quiz-${notebook.id}`,
            title: quizTitle,
            type: 'quiz',
            notebookId: notebook.id,
            notebookTitle: notebook.title
          });
        }
        
        // Agregar eventos de estudio inteligente
        if (studyDates.smart) {
          console.log(`[CALENDAR] Agregando estudio inteligente para ${notebook.title} en fecha: ${studyDates.smart.toDateString()}`);
          const smartKey = studyDates.smart.toDateString();
          if (!allEvents[smartKey]) allEvents[smartKey] = [];
          
          // Si el estudio inteligente está disponible hoy, mostrar como "Disponible"
          const smartTitle = studyDates.smartAvailable
            ? `🧠 Estudio inteligente disponible: ${notebook.title}`
            : `🧠 Estudio inteligente programado: ${notebook.title}`;
          
          allEvents[smartKey].push({
            id: `smart-${notebook.id}`,
            title: smartTitle,
            type: 'smart',
            notebookId: notebook.id,
            notebookTitle: notebook.title
          });
        }
      }
      
      console.log('[CALENDAR] Todos los eventos procesados:', allEvents);
      setEventsByDate(allEvents);
    };
    
    fetchAllEvents().catch(error => {
      console.error('[CALENDAR] Error cargando eventos:', error);
    });
  }, [user, notebooks]);

  // Guardar evento en Firestore
  const handleCreateEvent = async () => {
    if (!newEventDate || !newEventTitle.trim() || !user) return;
    const eventData = {
      userId: user.uid,
      date: Timestamp.fromDate(newEventDate),
      title: newEventTitle.trim(),
      createdAt: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, 'calendarEvents'), eventData);
    setEventsByDate(prev => {
      // En vez de agrupar por día, agregamos el evento con la fecha completa
      const newEvent: StudyEvent & { date: Date } = {
        id: docRef.id,
        title: newEventTitle.trim(),
        type: 'custom',
        date: newEventDate
      };
      // Creamos una copia plana de todos los eventos previos
      const allEvents: Record<string, (StudyEvent & { date?: Date })[]> = { ...prev };
      // Usamos el id como clave única para evitar colisiones
      allEvents[docRef.id] = [newEvent];
      return allEvents;
    });
    setShowCreateEventModal(false);
  };

  // Editar evento
  const handleEditEvent = (eventId: string, currentTitle: string) => {
    setEditingEventId(eventId);
    setEditingEventTitle(currentTitle);
  };

  const handleSaveEditEvent = async (eventId: string, dateKey: string) => {
    if (!editingEventTitle.trim()) return;
    await updateDoc(doc(db, 'calendarEvents', eventId), { title: editingEventTitle.trim() });
    setEventsByDate(prev => ({
      ...prev,
      [dateKey]: prev[dateKey].map(ev => ev.id === eventId ? { ...ev, title: editingEventTitle.trim() } : ev)
    }));
    setEditingEventId(null);
    setEditingEventTitle('');
  };

  const handleDeleteEvent = async (eventId: string, dateKey: string) => {
    await deleteDoc(doc(db, 'calendarEvents', eventId));
    setEventsByDate(prev => ({
      ...prev,
      [dateKey]: prev[dateKey].filter(ev => ev.id !== eventId)
    }));
    setEditingEventId(null);
    setEditingEventTitle('');
    // Cerrar el popup después de eliminar el evento
    closeEventModal();
  };

  // Nueva función para abrir el modal de detalles al hacer click en un evento
  const handleSelectEvent = (event: any) => {
    setSelectedEvent(event);
    setShowEventDetailsModal(true);
  };

  // Nueva función para cerrar el modal de detalles
  const closeEventDetailsModal = () => {
    setShowEventDetailsModal(false);
    setSelectedEvent(null);
  };

  // Nueva función para guardar cambios en el evento personalizado
  const handleSaveEventDetails = async () => {
    if (!selectedEvent || !selectedEvent.id) return;
    setSavingEvent(true);
    try {
      await updateDoc(doc(db, 'calendarEvents', selectedEvent.id), {
        title: selectedEvent.title,
        date: Timestamp.fromDate(new Date(selectedEvent.date)),
        details: selectedEvent.details || ''
      });
      setEventsByDate(prev => {
        const updated = { ...prev };
        if (updated[selectedEvent.id]) {
          updated[selectedEvent.id][0] = {
            ...updated[selectedEvent.id][0],
            title: selectedEvent.title,
            date: new Date(selectedEvent.date),
            details: selectedEvent.details || ''
          };
        }
        return updated;
      });
      closeEventDetailsModal();
    } catch (e) {
      alert('Error al guardar los cambios. Intenta de nuevo.');
    } finally {
      setSavingEvent(false);
    }
  };

  // Nueva función para borrar el evento personalizado desde el modal
  const handleDeleteEventFromModal = async () => {
    if (!selectedEvent || !selectedEvent.id) return;
    setDeletingEvent(true);
    try {
      await deleteDoc(doc(db, 'calendarEvents', selectedEvent.id));
      setEventsByDate(prev => {
        const updated = { ...prev };
        delete updated[selectedEvent.id];
        return updated;
      });
      closeEventDetailsModal();
    } catch (e) {
      alert('Error al eliminar el evento. Intenta de nuevo.');
    } finally {
      setDeletingEvent(false);
    }
  };

  // Formato de fecha para mostrar
  const formatDate = (date: Date) =>
    date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Obtener eventos del día seleccionado
  const events = selectedDate ? eventsByDate[selectedDate.toDateString()] || [] : [];

  // Renderizar tileContent para mostrar punto en días con eventos
  const renderTileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month' && eventsByDate[date.toDateString()] && eventsByDate[date.toDateString()].length > 0) {
      const events = eventsByDate[date.toDateString()];
      const hasQuiz = events.some(e => e.type === 'quiz');
      const hasSmart = events.some(e => e.type === 'smart');
      const hasCustom = events.some(e => e.type === 'custom');
      
      return (
        <div style={{
          display: 'flex',
          gap: 2,
          margin: '4px auto 0 auto',
          justifyContent: 'center'
        }}>
          {hasQuiz && (
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#f59e0b', // Naranja para quiz
            }}></div>
          )}
          {hasSmart && (
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#10b981', // Verde para estudio inteligente
            }}></div>
          )}
          {hasCustom && (
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#6147FF', // Morado para eventos personalizados
            }}></div>
          )}
        </div>
      );
    }
    return null;
  };

  // Función para agregar atributos a los días
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dayOfWeek = date.getDay();
      return `day-${dayOfWeek}`;
    }
    return '';
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
    const eventos: { date: Date, title: string, type: string, notebookId?: string }[] = [];
    Object.entries(eventsByDate).forEach(([dateStr, events]) => {
      const date = new Date(dateStr);
      if (date >= weekStart && date <= weekEnd) {
        events.forEach(event => eventos.push({ 
          date, 
          title: event.title, 
          type: event.type,
          notebookId: event.notebookId 
        }));
      }
    });
    // Ordenar por fecha
    return eventos.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [eventsByDate, weekStart, weekEnd]);

  // Adaptar eventos a formato de react-big-calendar
  const allEvents = useMemo(() => {
    const result: { id: string; title: string; start: Date; end: Date; type: string; notebookId?: string; details?: string; allDay?: boolean }[] = [];
    Object.values(eventsByDate).forEach(events => {
      events.forEach(ev => {
        let startDate: Date | null = null;
        if ('date' in ev && ev.date instanceof Date) {
          startDate = ev.date;
        } else if ((ev as any).date && (ev as any).date.toDate) {
          startDate = (ev as any).date.toDate();
        }
        if (!startDate) startDate = new Date();
        // Si es quiz o smart, marcar como allDay y ajustar hora a 00:00
        if (ev.type === 'quiz' || ev.type === 'smart') {
          const allDayDate = new Date(startDate);
          allDayDate.setHours(0, 0, 0, 0);
          result.push({
            id: ev.id,
            title: ev.title,
            start: allDayDate,
            end: allDayDate,
            type: ev.type,
            notebookId: ev.notebookId,
            details: ev.details || '',
            allDay: true
          });
        } else {
          result.push({
            id: ev.id,
            title: ev.title,
            start: startDate,
            end: new Date(startDate.getTime() + 60 * 60 * 1000),
            type: ev.type,
            notebookId: ev.notebookId,
            details: ev.details || '',
            allDay: false
          });
        }
      });
    });
    return result;
  }, [eventsByDate]);

  return (
    <>
      <HeaderWithHamburger title="Calendario" />
      <div style={{ minHeight: 'calc(100vh - 80px)', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '0 0' }}>
        {/* Calendario principal */}
        <div style={{ width: '100%', maxWidth: 1400, minWidth: 0, background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(79,70,229,0.07)', padding: '18px 18px 0 18px', marginTop: 32 }}>
          <BigCalendar
            localizer={localizer}
            events={allEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 700, width: '100%' }}
            views={{ month: true, week: true, day: true }}
            view={calendarView}
            onView={v => setCalendarView(v as any)}
            defaultView="month"
            date={currentDate}
            onNavigate={date => setCurrentDate(date)}
            selectable
            onSelectSlot={(slotInfo: { start: Date }) => {
              if (calendarView === 'day' && slotInfo.start) {
                setNewEventDate(new Date(slotInfo.start)); // Asegura que la hora seleccionada se use
                setShowCreateEventModal(true);
              } else {
                setCalendarView('day');
                setCurrentDate(slotInfo.start);
              }
            }}
            onSelectEvent={handleSelectEvent}
            messages={{
              month: 'Mes',
              week: 'Semana',
              day: 'Día',
              today: 'Hoy',
              previous: 'Anterior',
              next: 'Siguiente',
              agenda: 'Agenda',
              date: 'Fecha',
              time: 'Hora',
              event: 'Evento',
              noEventsInRange: 'No hay eventos en este rango',
            }}
            toolbar={true}
            components={{ toolbar: CustomToolbar }}
            popup={true}
            culture="es"
            min={new Date(1970, 0, 1, 0, 0)}
            max={new Date(1970, 0, 1, 23, 59)}
            slotPropGetter={(date) => {
              const hour = date.getHours && typeof date.getHours === 'function' ? date.getHours() : null;
              if (hour !== null && hour >= 0 && hour < 6) {
                return {
                  style: {
                    background: '#f3f4f6', // gris profesional
                    opacity: 1
                  }
                };
              }
              return { style: {} };
            }}
          />
        </div>
      </div>
      {/* Modal de eventos del día */}
      {showEventModal && selectedDate && (
        <div 
          style={{
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
          }}
          onClick={closeEventModal}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: 18,
              boxShadow: '0 8px 32px rgba(97,71,255,0.12)',
              padding: '40px 32px 32px 32px',
              minWidth: 340,
              maxWidth: 400,
              textAlign: 'center',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
              <div style={{ color: '#888', fontSize: 18, marginTop: 16, marginBottom: 20 }}>
                No tienes eventos agendados para este día
                <button 
                  onClick={handleCreateEventFromPopup}
                  style={{
                    background: 'linear-gradient(90deg, #6147FF 0%, #A685E2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 12,
                    padding: '8px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(97,71,255,0.08)',
                    transition: 'background 0.2s',
                    marginTop: 12,
                    display: 'block',
                    margin: '12px auto 0 auto'
                  }}
                >
                  + Crear evento
                </button>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {events.map((event, idx) => {
                  const getEventIcon = () => {
                    switch(event.type) {
                      case 'quiz': return '📝';
                      case 'smart': return '🧠';
                      default: return '📅';
                    }
                  };
                  
                  const getEventColor = () => {
                    switch(event.type) {
                      case 'quiz': return '#f59e0b';
                      case 'smart': return '#10b981';
                      default: return '#6147FF';
                    }
                  };
                  
                  const canEdit = event.type === 'custom';
                  
                  return (
                    <li key={event.id} style={{ 
                      color: '#333', 
                      fontSize: 17, 
                      marginBottom: 10, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8,
                      cursor: event.type !== 'custom' ? 'pointer' : 'default',
                      transition: 'background-color 0.2s',
                      padding: '8px',
                      borderRadius: '8px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (event.type !== 'custom') {
                        e.currentTarget.style.backgroundColor = 'rgba(97, 71, 255, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={() => {
                      if (event.type !== 'custom' && event.notebookId) {
                        navigate('/study', { state: { selectedNotebookId: event.notebookId } });
                      }
                    }}
                    >
                      {editingEventId === event.id && canEdit ? (
                        <>
                          <input
                            type="text"
                            value={editingEventTitle}
                            onChange={e => setEditingEventTitle(e.target.value)}
                            style={{ fontSize: 16, flex: 1, padding: 4, borderRadius: 6, border: '1.5px solid #e0e7ef' }}
                            autoFocus
                            onClick={e => e.stopPropagation()}
                          />
                          <button onClick={(e) => { e.stopPropagation(); handleSaveEditEvent(event.id, selectedDate.toDateString()); }} style={{ color: '#6147FF', fontWeight: 700, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }} title="Guardar"><i className="fas fa-check"></i></button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingEventId(null); setEditingEventTitle(''); }} style={{ color: '#c00', fontWeight: 700, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }} title="Cancelar"><i className="fas fa-times"></i></button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 20, marginRight: 8 }}>{getEventIcon()}</span>
                          <span style={{ flex: 1, textAlign: 'left', color: getEventColor(), fontWeight: event.type !== 'custom' ? 600 : 400 }}>
                            {event.title}
                            {event.type !== 'custom' && (
                              <span style={{ fontSize: 12, color: '#666', display: 'block' }}>Clic para ir al estudio</span>
                            )}
                          </span>
                          {canEdit && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleEditEvent(event.id, event.title); }} style={{ color: '#6147FF', fontWeight: 700, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }} title="Editar"><i className="fas fa-pencil-alt"></i></button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id, selectedDate.toDateString()); }} style={{ color: '#c00', fontWeight: 700, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }} title="Borrar"><i className="fas fa-trash"></i></button>
                            </>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
      {/* Modal de detalles del evento seleccionado */}
      {showEventDetailsModal && selectedEvent && (
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
        }}
        onClick={closeEventDetailsModal}
        >
          <div style={{
            background: 'white',
            borderRadius: 18,
            boxShadow: '0 8px 32px rgba(97,71,255,0.12)',
            padding: '40px 32px 32px 32px',
            minWidth: 340,
            maxWidth: 400,
            textAlign: 'center',
            position: 'relative',
          }}
          onClick={e => e.stopPropagation()}
          >
            <button onClick={closeEventDetailsModal} style={{
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
              Detalles del evento
            </h2>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 600, color: '#6147FF', fontSize: 16 }}>Título:</label><br />
              <input type="text" value={selectedEvent.title} onChange={e => setSelectedEvent({ ...selectedEvent, title: e.target.value })} style={{ fontSize: 16, padding: 8, borderRadius: 8, border: '1.5px solid #e0e7ef', marginTop: 6, width: '90%' }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 600, color: '#6147FF', fontSize: 16 }}>Fecha:</label><br />
              <input type="date" value={selectedEvent.date ? new Date(selectedEvent.date).toISOString().split('T')[0] : ''}
                onChange={e => {
                  if (e.target.value && selectedEvent.date) {
                    const [year, month, day] = e.target.value.split('-');
                    const prev = new Date(selectedEvent.date);
                    const newDate = new Date(Number(year), Number(month) - 1, Number(day), prev.getHours(), prev.getMinutes());
                    setSelectedEvent({ ...selectedEvent, date: newDate });
                  }
                }}
                style={{ fontSize: 16, padding: 8, borderRadius: 8, border: '1.5px solid #e0e7ef', marginTop: 6 }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 600, color: '#6147FF', fontSize: 16 }}>Hora:</label><br />
              <input type="time" value={selectedEvent.date ? new Date(selectedEvent.date).toISOString().substring(11,16) : ''}
                onChange={e => {
                  if (e.target.value && selectedEvent.date) {
                    const [hours, minutes] = e.target.value.split(':');
                    const prev = new Date(selectedEvent.date);
                    const newDate = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), Number(hours), Number(minutes));
                    setSelectedEvent({ ...selectedEvent, date: newDate });
                  }
                }}
                style={{ fontSize: 16, padding: 8, borderRadius: 8, border: '1.5px solid #e0e7ef', marginTop: 6, minWidth: 90 }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 600, color: '#6147FF', fontSize: 16 }}>Detalles:</label><br />
              <textarea value={selectedEvent.details || ''} onChange={e => setSelectedEvent({ ...selectedEvent, details: e.target.value })} style={{ fontSize: 16, padding: 8, borderRadius: 8, border: '1.5px solid #e0e7ef', marginTop: 6, width: '90%', minHeight: 60 }} placeholder="Agrega detalles del evento (opcional)" />
            </div>
            <button style={{
              background: savingEvent ? '#A685E2' : 'linear-gradient(90deg, #6147FF 0%, #A685E2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '12px 32px',
              fontSize: 18,
              fontWeight: 600,
              cursor: savingEvent ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(97,71,255,0.08)',
              transition: 'background 0.2s',
              marginRight: 12,
              opacity: savingEvent ? 0.7 : 1
            }}
            onClick={handleSaveEventDetails}
            disabled={savingEvent || deletingEvent}
            >
              {savingEvent ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button style={{
              background: deletingEvent ? '#eee' : '#fff',
              color: '#c00',
              border: '1.5px solid #c00',
              borderRadius: 12,
              padding: '12px 32px',
              fontSize: 18,
              fontWeight: 600,
              cursor: deletingEvent ? 'not-allowed' : 'pointer',
              marginLeft: 12,
              opacity: deletingEvent ? 0.7 : 1
            }}
            onClick={handleDeleteEventFromModal}
            disabled={deletingEvent || savingEvent}
            >
              {deletingEvent ? 'Eliminando...' : 'Borrar evento'}
            </button>
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
            <div>
              <label style={{ fontWeight: 600, color: '#6147FF', fontSize: 16 }}>Fecha:</label><br />
              <input type="date" value={newEventDate ? newEventDate.toISOString().split('T')[0] : ''}
                onChange={e => {
                  if (e.target.value && newEventDate) {
                    const [year, month, day] = e.target.value.split('-');
                    const prev = newEventDate;
                    const newDate = new Date(Number(year), Number(month) - 1, Number(day), prev.getHours(), prev.getMinutes());
                    setNewEventDate(newDate);
                  } else if (e.target.value) {
                    const [year, month, day] = e.target.value.split('-');
                    setNewEventDate(new Date(Number(year), Number(month) - 1, Number(day)));
                  } else {
                    setNewEventDate(null);
                  }
                }}
                style={{ fontSize: 16, padding: 8, borderRadius: 8, border: '1.5px solid #e0e7ef', marginTop: 6 }} />
            </div>
            <div>
              <label style={{ fontWeight: 600, color: '#6147FF', fontSize: 16 }}>Hora:</label><br />
              <input type="time" value={newEventDate ? newEventDate.toISOString().substring(11,16) : ''}
                onChange={e => {
                  if (e.target.value && newEventDate) {
                    const [hours, minutes] = e.target.value.split(':');
                    const prev = newEventDate;
                    const newDate = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), Number(hours), Number(minutes));
                    setNewEventDate(newDate);
                  }
                }}
                style={{ fontSize: 16, padding: 8, borderRadius: 8, border: '1.5px solid #e0e7ef', marginTop: 6, minWidth: 90 }} />
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
          min-height: 440px;
          max-width: 1400px;
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
          min-height: 56px;
          font-size: 1.2rem;
          border-radius: 0px;
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
        .formal-calendar .react-calendar__month-view__days__day.day-6,
        .formal-calendar .react-calendar__month-view__days__day.day-0 {
          background-color: #f8f9fa !important;
        }
      `}</style>
    </>
  );
};

export default CalendarPage; 