// src/components/Dashboard/StudyReminder.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

const StudyReminder = () => {
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [days, setDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  });
  const [reminderTime, setReminderTime] = useState('18:00');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchReminderSettings = async () => {
      if (!auth.currentUser) return;
      
      try {
        setLoading(true);
        
        const reminderRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'reminders');
        const reminderDoc = await getDoc(reminderRef);
        
        if (reminderDoc.exists()) {
          const data = reminderDoc.data();
          
          setReminderEnabled(data.enabled || false);
          setDays(data.days || days);
          setReminderTime(data.time || '18:00');
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching reminder settings:", error);
        setLoading(false);
      }
    };
    
    fetchReminderSettings();
  }, []);

  const toggleDay = (day: DayOfWeek) => {
    setDays({
      ...days,
      [day]: !days[day]
    });
  };

  const handleTimeChange = (e: { target: { value: React.SetStateAction<string>; }; }) => {
    setReminderTime(e.target.value);
  };

  const toggleReminderEnabled = () => {
    setReminderEnabled(!reminderEnabled);
  };

  const handleSaveSettings = async () => {
    if (!auth.currentUser) return;
    
    try {
      setIsSaving(true);
      
      const reminderRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'reminders');
      
      await setDoc(reminderRef, {
        enabled: reminderEnabled,
        days,
        time: reminderTime
      });
      
      setSaveSuccess(true);
      
      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      
      setIsSaving(false);
    } catch (error) {
      console.error("Error saving reminder settings:", error);
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="reminder-card loading">
        <div className="card-loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="reminder-card">
      <div className="reminder-header">
        <div className="reminder-title">
          <i className="fas fa-bell"></i>
          <h3>Recordatorios de estudio</h3>
        </div>
        <button 
          className="toggle-expand-button" 
          onClick={() => setExpanded(!expanded)}
        >
          <i className={`fas fa-chevron-${expanded ? 'up' : 'down'}`}></i>
        </button>
      </div>
      
      <div className="reminder-toggle">
        <div className="toggle-switch">
          <input
            type="checkbox"
            id="reminder-toggle"
            checked={reminderEnabled}
            onChange={toggleReminderEnabled}
          />
          <label htmlFor="reminder-toggle"></label>
        </div>
        <span>{reminderEnabled ? 'Activados' : 'Desactivados'}</span>
      </div>
      
      {expanded && (
        <div className="reminder-settings">
          <div className="reminder-days">
            <h4>Días de estudio</h4>
            <div className="days-selector">
              {[
                { key: 'monday', label: 'L' },
                { key: 'tuesday', label: 'M' },
                { key: 'wednesday', label: 'X' },
                { key: 'thursday', label: 'J' },
                { key: 'friday', label: 'V' },
                { key: 'saturday', label: 'S' },
                { key: 'sunday', label: 'D' }
              ].map(day => (
                <button
                  key={day.key}
                  className={`day-button ${days[day.key as keyof typeof days] ? 'active' : ''}`}
                  onClick={() => toggleDay(day.key as DayOfWeek)}
                  disabled={!reminderEnabled}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="reminder-time">
            <h4>Hora de recordatorio</h4>
            <input
              type="time"
              value={reminderTime}
              onChange={handleTimeChange}
              disabled={!reminderEnabled}
              className="time-input"
            />
          </div>
          
          <div className="reminder-actions">
            <button 
              className="save-button"
              onClick={handleSaveSettings}
              disabled={isSaving || !reminderEnabled}
            >
              {isSaving ? (
                <>
                  <div className="button-spinner"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar</span>
              )}
            </button>
            
            {saveSuccess && (
              <div className="save-success-message">
                <i className="fas fa-check-circle"></i>
                <span>¡Configuración guardada!</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="reminder-footer">
        <p>
          {reminderEnabled 
            ? `Recordatorios activos para ${Object.entries(days).filter(([_, active]) => active).length} días a las ${reminderTime}`
            : 'Los recordatorios están desactivados'}
        </p>
      </div>
    </div>
  );
};

export default StudyReminder;