import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import './CustomCalendar.css';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'study' | 'quiz' | 'custom';
  color?: string;
  time?: string;
  description?: string;
}

interface CustomCalendarProps {
  events?: CalendarEvent[];
  onEventAdd?: (event: Omit<CalendarEvent, 'id'>) => void;
  onEventEdit?: (event: CalendarEvent) => void;
  onEventDelete?: (eventId: string) => void;
  onDateSelect?: (date: string) => void;
}

const CustomCalendar: React.FC<CustomCalendarProps> = ({
  events = [],
  onEventAdd,
  onEventEdit,
  onEventDelete,
  onDateSelect
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [newEvent, setNewEvent] = useState<{
    title: string;
    time: string;
    type: 'study' | 'quiz' | 'custom' | '';
    description: string;
    duration: number;
  }>({
    title: '',
    time: '',
    type: '',
    description: '',
    duration: 1
  });
  const [fieldErrors, setFieldErrors] = useState<{
    title: boolean;
    type: boolean;
  }>({
    title: false,
    type: false
  });

  // Obtener días del mes
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();

    const days = [];
    
    // Días del mes anterior (grises)
    for (let i = startDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({
        date: prevDate.getDate(),
        dateString: prevDate.toISOString().split('T')[0],
        isCurrentMonth: false,
        isToday: false
      });
    }
    
    // Días del mes actual
    const today = new Date().toISOString().split('T')[0];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = new Date(year, month, day).toISOString().split('T')[0];
      days.push({
        date: day,
        dateString,
        isCurrentMonth: true,
        isToday: dateString === today
      });
    }
    
    // Días del mes siguiente (grises)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const nextDate = new Date(year, month + 1, day);
      days.push({
        date: day,
        dateString: nextDate.toISOString().split('T')[0],
        isCurrentMonth: false,
        isToday: false
      });
    }
    
    return days;
  };

  // Obtener días de la semana
  const getDaysInWeek = (date: Date) => {
    const days = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const dateString = currentDate.toISOString().split('T')[0];
      days.push({
        date: currentDate.getDate(),
        dateString,
        isCurrentMonth: true,
        isToday: dateString === new Date().toISOString().split('T')[0],
        fullDate: currentDate
      });
    }
    return days;
  };

  // Obtener día actual con horas
  const getDayView = () => {
    const hours = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourDate = new Date(currentDate);
      hourDate.setHours(hour, 0, 0, 0);
      hours.push({
        hour,
        hourString: `${hour.toString().padStart(2, '0')}:00`,
        dateString: currentDate.toISOString().split('T')[0],
        isToday: currentDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
      });
    }
    return hours;
  };

  // Obtener días según el modo de vista
  const getDays = () => {
    switch (viewMode) {
      case 'day':
        return getDayView();
      case 'week':
        return getDaysInWeek(currentDate);
      case 'month':
      default:
        return getDaysInMonth(currentDate);
    }
  };

  const days = getDays();
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const navigate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      switch (viewMode) {
        case 'day':
          if (direction === 'prev') {
            newDate.setDate(prev.getDate() - 1);
          } else {
            newDate.setDate(prev.getDate() + 1);
          }
          break;
        case 'week':
          if (direction === 'prev') {
            newDate.setDate(prev.getDate() - 7);
          } else {
            newDate.setDate(prev.getDate() + 7);
          }
          break;
        case 'month':
        default:
          if (direction === 'prev') {
            newDate.setMonth(prev.getMonth() - 1);
          } else {
            newDate.setMonth(prev.getMonth() + 1);
          }
          break;
      }
      return newDate;
    });
  };

  // Obtener el título según el modo de vista
  const getTitle = () => {
    const formatDate = (date: Date) => {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      return date.toLocaleDateString('es-ES', options);
    };

    switch (viewMode) {
      case 'day':
        return formatDate(currentDate);
      case 'week':
        const weekStart = new Date(currentDate);
        const day = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - day);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.getDate()} - ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
      case 'month':
      default:
        return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  };

  const getEventsForDate = (dateString: string) => {
    return events.filter(event => event.date === dateString);
  };

  const handleDateClick = (dateString: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    setSelectedDate(dateString);
    onDateSelect?.(dateString);
  };

  const handleDateDoubleClick = (dateString: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;
    // Cambiar a vista día y establecer la fecha seleccionada
    // Usar directamente el dateString para evitar problemas de zona horaria
    const [year, month, day] = dateString.split('-').map(Number);
    const clickedDate = new Date(year, month - 1, day);
    setCurrentDate(clickedDate);
    setViewMode('day');
    setSelectedDate(dateString);
  };

  const handleHourClick = (dateString: string, hour: number) => {
    // Establecer la fecha y hora seleccionadas
    setSelectedDate(dateString);
    const hourString = `${hour.toString().padStart(2, '0')}:00`;
    setNewEvent(prev => ({ ...prev, time: hourString }));
    // Abrir modal para crear evento
    setShowEventModal(true);
    onDateSelect?.(dateString);
  };

  const handleEventSubmit = () => {
    // Validar campos requeridos
    const errors = {
      title: !newEvent.title.trim(),
      type: !newEvent.type
    };
    
    setFieldErrors(errors);
    
    // Si hay errores, no continuar
    if (errors.title || errors.type || !selectedDate) {
      return;
    }
    
    const eventData = {
      title: newEvent.title,
      date: selectedDate,
      type: newEvent.type as 'study' | 'quiz' | 'custom',
      time: newEvent.time,
      description: newEvent.description,
      color: getEventColor(newEvent.type)
    };

    if (editingEvent) {
      onEventEdit?.({ ...eventData, id: editingEvent.id });
    } else {
      onEventAdd?.(eventData);
    }

    resetModal();
  };

  const resetModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
    setNewEvent({ title: '', time: '', type: '', description: '', duration: 1 });
    setFieldErrors({ title: false, type: false });
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'study': return '#10b981';
      case 'quiz': return '#f59e0b';
      default: return '#6366f1';
    }
  };

  const openEventModal = (event?: CalendarEvent) => {
    setFieldErrors({ title: false, type: false }); // Limpiar errores al abrir modal
    if (event) {
      setEditingEvent(event);
      setNewEvent({
        title: event.title,
        time: event.time || '',
        type: event.type,
        description: event.description || '',
        duration: (event as any).duration || 1
      });
    }
    setShowEventModal(true);
  };

  // Obtener la hora actual
  const getCurrentHour = () => {
    return new Date().getHours();
  };

  const getCurrentMinutes = () => {
    return new Date().getMinutes();
  };

  const isCurrentDay = (dateString: string) => {
    return dateString === new Date().toISOString().split('T')[0];
  };

  const isOffHours = (hour: number) => {
    return hour >= 23 || hour <= 6;
  };

  // Auto-scroll a las 7am en vista de día
  useEffect(() => {
    if (viewMode === 'day') {
      const scrollToSevenAM = () => {
        const hourGrid = document.querySelector('.hour-grid');
        if (hourGrid) {
          // Hora 7 (index 7) * 35px de altura por hora
          const scrollPosition = 7 * 35;
          hourGrid.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
        }
      };
      
      // Delay para asegurar que el DOM esté renderizado
      setTimeout(scrollToSevenAM, 100);
    }
  }, [viewMode, currentDate]);

  return (
    <div className="custom-calendar">
      {/* Header del calendario */}
      <div className="calendar-header">
        <div className="calendar-nav">
          <button 
            className="nav-btn" 
            onClick={() => navigate('prev')}
            aria-label="Anterior"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          
          <h2 className="calendar-title">
            {getTitle()}
          </h2>
          
          <button 
            className="nav-btn" 
            onClick={() => navigate('next')}
            aria-label="Siguiente"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>

        <div className="view-buttons">
          <button 
            className={`view-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => {
              setCurrentDate(new Date());
              setViewMode('day');
            }}
          >
            Hoy
          </button>
          <button 
            className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Semana
          </button>
          <button 
            className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Días de la semana */}
      {viewMode !== 'day' && (
        <div className="calendar-weekdays">
          {dayNames.map(day => (
            <div key={day} className="weekday">
              {day}
            </div>
          ))}
        </div>
      )}

      {/* Grid del calendario */}
      {viewMode === 'day' ? (
        <div className="day-schedule">
          <div className="day-schedule-header">
            <h3>{dayNames[currentDate.getDay()]} {currentDate.getDate()}</h3>
          </div>
          <div className="hour-grid">
            {getDayView().map((hourSlot) => {
              const hourEvents = events.filter(event => {
                if (event.date !== hourSlot.dateString) return false;
                if (!event.time) return hourSlot.hour === 0; // Eventos sin hora van en 00:00
                const eventHour = parseInt(event.time.split(':')[0]);
                return eventHour === hourSlot.hour;
              });

              const currentHour = getCurrentHour();
              const currentMinutes = getCurrentMinutes();
              const isCurrentHour = hourSlot.hour === currentHour && isCurrentDay(hourSlot.dateString);
              const timeIndicatorPosition = isCurrentHour ? (currentMinutes / 60) * 35 : 0; // 35px es la altura del slot
              const isOffHour = isOffHours(hourSlot.hour);

              return (
                <div key={hourSlot.hour} className={`hour-slot ${isCurrentHour ? 'current-hour' : ''} ${isOffHour ? 'off-hours' : ''}`}>
                  <div className="hour-label">{hourSlot.hourString}</div>
                  <div 
                    className="hour-content"
                    onClick={() => handleHourClick(hourSlot.dateString, hourSlot.hour)}
                  >
                    {hourEvents.map(event => (
                      <div
                        key={event.id}
                        className="hour-event"
                        style={{ backgroundColor: event.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEventModal(event);
                        }}
                      >
                        <div className="hour-event-title">{event.title}</div>
                        {event.description && (
                          <div className="hour-event-description">{event.description}</div>
                        )}
                      </div>
                    ))}
                    {isCurrentHour && (
                      <div 
                        className="current-time-indicator" 
                        style={{ top: `${timeIndicatorPosition}px` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`calendar-grid ${viewMode}`}>
          {days.map((day, index) => {
            // Type guard to ensure we have the right properties
            if (!('date' in day) || !('isCurrentMonth' in day)) {
              return null; // Skip if this is an hour slot instead of a day
            }
            
            const dayEvents = viewMode === 'week' 
              ? getEventsForDate(day.dateString)
              : getEventsForDate(day.dateString);
            const isSelected = selectedDate === day.dateString;
            
            return (
              <div
                key={index}
                className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleDateClick(day.dateString, day.isCurrentMonth)}
                onDoubleClick={() => handleDateDoubleClick(day.dateString, day.isCurrentMonth)}
              >
                <div className="day-header">
                  <span className="day-number">{day.date}</span>
                  {viewMode === 'week' && (
                    <span className="day-name">{dayNames[new Date(day.dateString).getDay()]}</span>
                  )}
                </div>
                
                {/* Eventos del día */}
                <div className="day-events">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className="event-dot"
                      style={{ backgroundColor: event.color }}
                      title={`${event.time ? event.time + ' - ' : ''}${event.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEventModal(event);
                      }}
                    >
                      <span className="event-title">{event.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="more-events">+{dayEvents.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Modal para eventos */}
      {showEventModal && (
        <div className="modal-overlay-small" onClick={resetModal}>
          <div className="event-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-small">
              <span>{editingEvent ? 'Editar evento' : 'Crear nuevo evento'}</span>
              <button className="close-btn-small" onClick={resetModal}>×</button>
            </div>
            
            <div className="modal-content-small">
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => {
                  setNewEvent(prev => ({ ...prev, title: e.target.value }));
                  if (fieldErrors.title) setFieldErrors(prev => ({ ...prev, title: false }));
                }}
                placeholder="Título"
                className={`input-small ${fieldErrors.title ? 'error' : ''}`}
                autoFocus
              />

              <input
                type="time"
                value={newEvent.time}
                onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                className="input-small"
              />

              <select
                value={newEvent.duration}
                onChange={(e) => setNewEvent(prev => ({ ...prev, duration: parseFloat(e.target.value) }))}
                className="select-small"
              >
                <option value={0.5}>30m</option>
                <option value={1}>1h</option>
                <option value={2}>2h</option>
                <option value={3}>3h</option>
                <option value={4}>4h</option>
              </select>

              <select
                value={newEvent.type}
                onChange={(e) => {
                  setNewEvent(prev => ({ ...prev, type: e.target.value as any }));
                  if (fieldErrors.type) setFieldErrors(prev => ({ ...prev, type: false }));
                }}
                className={`select-small type-select-small ${fieldErrors.type ? 'error' : ''}`}
              >
                <option value="" disabled>Tipo</option>
                <option value="custom">● Personal</option>
                <option value="study">● Estudio</option>
                <option value="quiz">● Examen</option>
              </select>

              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción (opcional)"
                className="textarea-small"
                rows={3}
              />
            </div>
            
            <div className="modal-footer-small">
              {editingEvent && (
                <button className="btn-delete-small" onClick={() => { onEventDelete?.(editingEvent.id); resetModal(); }}>
                  🗑
                </button>
              )}
              <div className="buttons-row">
                <button className="btn-cancel-small" onClick={resetModal}>
                  Cancelar
                </button>
                <button 
                  className="btn-save-small" 
                  onClick={handleEventSubmit}
                >
                  {editingEvent ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomCalendar;