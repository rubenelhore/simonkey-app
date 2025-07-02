import React, { useState, useEffect, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
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
        const key = date.toDateString();
        if (!allEvents[key]) allEvents[key] = [];
        allEvents[key].push({ 
          id: docSnap.id, 
          title: data.title,
          type: 'custom'
        });
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
    const key = newEventDate.toDateString();
    const eventData = {
      userId: user.uid,
      date: Timestamp.fromDate(newEventDate),
      title: newEventTitle.trim(),
      createdAt: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, 'calendarEvents'), eventData);
    setEventsByDate(prev => ({
      ...prev,
      [key]: prev[key] ? [...prev[key], { id: docRef.id, title: newEventTitle.trim(), type: 'custom' }] : [{ id: docRef.id, title: newEventTitle.trim(), type: 'custom' }]
    }));
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

  return (
    <>
      <HeaderWithHamburger title="Calendario" />
      <div style={{ minHeight: 'calc(100vh - 80px)', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', padding: '0 0' }}>
        {/* Módulo lateral izquierdo */}
        <aside style={{
          width: 280,
          minWidth: 220,
          maxWidth: 320,
          background: 'white',
          borderRadius: 28,
          boxShadow: '0 2px 8px rgba(97,71,255,0.05)',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          marginLeft: 32,
          marginRight: 32,
          marginTop: 32,
          marginBottom: 32,
          minHeight: 724
        }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 24, color: '#6147FF', letterSpacing: 1 }}>Acciones</h2>
          <button style={{
            background: 'linear-gradient(90deg, #6147FF 0%, #A685E2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 16,
            padding: '16px 28px',
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 20,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(97,71,255,0.08)',
            transition: 'background 0.2s'
          }}
          onClick={openCreateEventModal}
          >
            + Crear evento
          </button>
          <div style={{ marginTop: 32, color: '#888', fontSize: 16, textAlign: 'center' }}>
            Aquí podrás crear, ver y gestionar tus eventos del calendario.
          </div>
          
          {/* Leyenda de tipos de eventos */}
          <div style={{ 
            marginTop: 40, 
            padding: 20, 
            background: '#f8f9fa', 
            borderRadius: 12, 
            width: '100%' 
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#6147FF', marginBottom: 12 }}>Tipos de eventos</h3>
            <div style={{ fontSize: 14, color: '#666' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }}></div>
                <span>📝 Quiz disponible</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></div>
                <span>🧠 Estudio inteligente</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6147FF' }}></div>
                <span>📅 Evento personalizado</span>
              </div>
            </div>
          </div>
        </aside>
        {/* Calendario principal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', minHeight: 640, maxWidth: '100%', marginRight: 32 }}>
          <div style={{ width: '100%', maxWidth: 1400, minWidth: 0, height: 480, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginTop: 32 }}>
            <Calendar
              onChange={(newValue) => {
                if (!showEventModal) {
                  setValue(newValue);
                }
              }}
              value={showEventModal ? null : value}
              locale="es-ES"
              className="big-calendar formal-calendar"
              onClickDay={handleDayClick}
              tileContent={renderTileContent}
              tileClassName={tileClassName}
            />
          </div>
          {/* Módulo de acciones para esta semana */}
          <div style={{
            width: '100%',
            maxWidth: 1400,
            margin: '24px 0 0 0',
            background: 'white',
            borderRadius: 20,
            boxShadow: '0 4px 24px rgba(97,71,255,0.07)',
            padding: '40px 48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            height: 210,
            overflow: 'hidden',
            position: 'relative'
          }}>
            <h3 style={{ 
              fontSize: '1.3rem', 
              fontWeight: 700, 
              color: '#6147FF', 
              marginBottom: 16
            }}>Acciones para esta semana</h3>
              {eventosSemana.length === 0 ? (
                <div style={{ color: '#888', fontSize: 20, textAlign: 'center', width: '100%', margin: '24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span role="img" aria-label="changuito durmiendo" style={{ fontSize: 28 }}>🙈💤</span>
                  No hay eventos para esta semana
                </div>
              ) : (
                <ul style={{ color: '#333', fontSize: 18, margin: 0, padding: 0, listStyle: 'none', width: '100%' }}>
                  {eventosSemana.map((ev, idx) => {
                    const getEventIcon = () => {
                      switch(ev.type) {
                        case 'quiz': return '📝';
                        case 'smart': return '🧠';
                        default: return '📅';
                      }
                    };
                    
                    return (
                      <li key={idx} style={{ 
                        marginBottom: 10,
                        cursor: ev.type !== 'custom' ? 'pointer' : 'default',
                        transition: 'color 0.2s'
                      }}
                      onClick={() => {
                        if (ev.type !== 'custom' && ev.notebookId) {
                          navigate('/study', { state: { selectedNotebookId: ev.notebookId } });
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (ev.type !== 'custom') {
                          e.currentTarget.style.color = '#6147FF';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#333';
                      }}
                      >
                        <span style={{ marginRight: 8 }}>{getEventIcon()}</span>
                        <b>{ev.date.toLocaleDateString('es-ES', { weekday: 'long' })}:</b> {ev.title}
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
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