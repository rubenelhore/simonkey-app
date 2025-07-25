import React, { useState, useEffect } from 'react';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import CustomCalendar from '../components/CustomCalendar';
import { db, collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, Timestamp } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'study' | 'quiz' | 'custom';
  color?: string;
  time?: string;
  description?: string;
  userId?: string;
  notebookId?: string;
}

const NewCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const userTypeData = useUserType();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const effectiveUserId = user?.uid;

  // Cargar eventos desde Firebase
  useEffect(() => {
    if (!effectiveUserId) return;
    
    const loadEvents = async () => {
      try {
        setLoading(true);
        const eventsQuery = query(
          collection(db, 'calendarEvents'),
          where('userId', '==', effectiveUserId)
        );
        
        const snapshot = await getDocs(eventsQuery);
        const loadedEvents: CalendarEvent[] = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const event: CalendarEvent = {
            id: doc.id,
            title: data.title,
            date: data.date instanceof Timestamp ? data.date.toDate().toISOString().split('T')[0] : data.date,
            type: data.type || 'custom',
            time: data.time || '',
            description: data.description || '',
            color: getEventColor(data.type || 'custom'),
            userId: data.userId,
            notebookId: data.notebookId
          };
          loadedEvents.push(event);
        });
        
        setEvents(loadedEvents);
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [effectiveUserId]);

  const getEventColor = (type: string) => {
    switch (type) {
      case 'study': return '#10b981';
      case 'quiz': return '#f59e0b';
      default: return '#6366f1';
    }
  };

  const handleEventAdd = async (eventData: Omit<CalendarEvent, 'id'>) => {
    if (!effectiveUserId) return;
    
    try {
      const docRef = await addDoc(collection(db, 'calendarEvents'), {
        ...eventData,
        userId: effectiveUserId,
        date: eventData.date,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      const newEvent: CalendarEvent = {
        ...eventData,
        id: docRef.id,
        color: getEventColor(eventData.type)
      };
      
      setEvents(prev => [...prev, newEvent]);
    } catch (error) {
      console.error('Error adding event:', error);
      alert('Error al agregar el evento. Por favor, intenta de nuevo.');
    }
  };

  const handleEventEdit = async (eventData: CalendarEvent) => {
    if (!effectiveUserId) return;
    
    try {
      const eventRef = doc(db, 'calendarEvents', eventData.id);
      await updateDoc(eventRef, {
        title: eventData.title,
        date: eventData.date,
        type: eventData.type,
        time: eventData.time || '',
        description: eventData.description || '',
        updatedAt: Timestamp.now()
      });

      setEvents(prev => 
        prev.map(event => 
          event.id === eventData.id 
            ? { ...eventData, color: getEventColor(eventData.type) }
            : event
        )
      );
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Error al actualizar el evento. Por favor, intenta de nuevo.');
    }
  };

  const handleEventDelete = async (eventId: string) => {
    if (!effectiveUserId) return;
    
    if (!confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'calendarEvents', eventId));
      setEvents(prev => prev.filter(event => event.id !== eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error al eliminar el evento. Por favor, intenta de nuevo.');
    }
  };

  const handleDateSelect = (date: string) => {
    console.log('Fecha seleccionada:', date);
  };

  if (loading) {
    return (
      <div>
        <HeaderWithHamburger title="Calendario" />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          fontSize: '1.1rem',
          color: '#6b7280'
        }}>
          Cargando calendario...
        </div>
      </div>
    );
  }

  return (
    <div>
      <HeaderWithHamburger title="Calendario" />
      <div style={{ 
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            color: '#111827',
            margin: '0 0 0.5rem 0'
          }}>
            Mi Calendario
          </h1>
          <p style={{ 
            color: '#6b7280', 
            fontSize: '1rem',
            margin: 0
          }}>
            Organiza tus estudios, exámenes y eventos personales
          </p>
        </div>

        <CustomCalendar 
          events={events}
          onEventAdd={handleEventAdd}
          onEventEdit={handleEventEdit}
          onEventDelete={handleEventDelete}
          onDateSelect={handleDateSelect}
        />

        {/* Leyenda de tipos de eventos */}
        <div style={{ 
          marginTop: '2rem',
          padding: '1.5rem',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ 
            fontSize: '1.1rem', 
            fontWeight: '600', 
            color: '#374151',
            margin: '0 0 1rem 0'
          }}>
            Tipos de Eventos
          </h3>
          <div style={{ 
            display: 'flex', 
            gap: '2rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                background: '#6366f1', 
                borderRadius: '4px'
              }}></div>
              <span style={{ fontSize: '0.9rem', color: '#4b5563' }}>Personal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                background: '#10b981', 
                borderRadius: '4px'
              }}></div>
              <span style={{ fontSize: '0.9rem', color: '#4b5563' }}>Estudio</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                background: '#f59e0b', 
                borderRadius: '4px'
              }}></div>
              <span style={{ fontSize: '0.9rem', color: '#4b5563' }}>Examen</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewCalendarPage;