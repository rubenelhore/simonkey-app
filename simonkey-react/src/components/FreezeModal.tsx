import React, { useState } from 'react';
import '../styles/FreezeModal.css';

interface FreezeModalProps {
  isOpen: boolean;
  isFrozen: boolean;
  notebookTitle: string;
  onClose: () => void;
  onConfirm: (type: 'now' | 'scheduled', scheduledDate?: Date) => void;
}

const FreezeModal: React.FC<FreezeModalProps> = ({ isOpen, isFrozen, notebookTitle, onClose, onConfirm }) => {
  const [selectedOption, setSelectedOption] = useState<'now' | 'scheduled'>('now');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedOption === 'now') {
      onConfirm('now');
    } else {
      if (!selectedDate || !selectedTime) {
        alert('Por favor selecciona fecha y hora');
        return;
      }
      const scheduledDateTime = new Date(`${selectedDate}T${selectedTime}`);
      if (scheduledDateTime <= new Date()) {
        alert('La fecha y hora deben ser futuras');
        return;
      }
      onConfirm('scheduled', scheduledDateTime);
    }
  };

  // Obtener fecha mínima (hoy)
  const today = new Date().toISOString().split('T')[0];
  
  // Obtener hora actual para establecer como mínima si la fecha es hoy
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="freeze-modal-overlay" onClick={onClose}>
      <div className="freeze-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="freeze-modal-header">
          <h3>
            <i className={`fas ${isFrozen ? 'fa-sun' : 'fa-snowflake'}`}></i>
            {isFrozen ? 'Descongelar' : 'Congelar'} cuaderno
          </h3>
          <button className="freeze-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="freeze-modal-body">
          <p className="notebook-name">{notebookTitle}</p>
          
          <div className="freeze-options">
            <label className="freeze-option">
              <input
                type="radio"
                name="freezeOption"
                value="now"
                checked={selectedOption === 'now'}
                onChange={() => setSelectedOption('now')}
              />
              <div className="option-content">
                <span className="option-title">
                  {isFrozen ? 'Descongelar ahora' : 'Congelar ahora'}
                </span>
                <span className="option-description">
                  {isFrozen 
                    ? 'Los estudiantes podrán acceder inmediatamente'
                    : 'Los estudiantes no podrán acceder inmediatamente'}
                </span>
              </div>
            </label>
            
            <label className="freeze-option">
              <input
                type="radio"
                name="freezeOption"
                value="scheduled"
                checked={selectedOption === 'scheduled'}
                onChange={() => setSelectedOption('scheduled')}
              />
              <div className="option-content">
                <span className="option-title">
                  {isFrozen ? 'Programar descongelación' : 'Programar congelación'}
                </span>
                <span className="option-description">
                  {isFrozen 
                    ? 'Se descongelará automáticamente en la fecha indicada'
                    : 'Se congelará automáticamente en la fecha indicada'}
                </span>
              </div>
            </label>
          </div>
          
          {selectedOption === 'scheduled' && (
            <div className="schedule-inputs">
              <div className="input-group">
                <label htmlFor="freezeDate">Fecha:</label>
                <input
                  type="date"
                  id="freezeDate"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={today}
                  required
                />
              </div>
              
              <div className="input-group">
                <label htmlFor="freezeTime">Hora:</label>
                <input
                  type="time"
                  id="freezeTime"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  min={selectedDate === today ? currentTime : undefined}
                  required
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="freeze-modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-confirm" onClick={handleConfirm}>
            <i className={`fas ${isFrozen ? 'fa-sun' : 'fa-snowflake'}`}></i>
            {isFrozen ? 'Descongelar' : 'Congelar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreezeModal;