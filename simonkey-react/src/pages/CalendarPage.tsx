import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const userTypeData = useUserType();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const effectiveUserId = user?.uid;
  
  // Get initial date and view from navigation state
  const initialDate = location.state?.selectedDate || null;
  const initialView = location.state?.view || 'month';

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
        <CustomCalendar 
          events={events}
          onEventAdd={handleEventAdd}
          onEventEdit={handleEventEdit}
          onEventDelete={handleEventDelete}
          onDateSelect={handleDateSelect}
          initialDate={initialDate}
          initialView={initialView}
        />
      </div>
    </div>
  );
};

export default CalendarPage;